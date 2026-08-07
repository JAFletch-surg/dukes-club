-- ═══════════════════════════════════════════════════════════════════
-- DUKES WEEKEND — booking functions
-- ═══════════════════════════════════════════════════════════════════
--
-- Run supabase/create-dukes-weekend.sql first, then this.
-- This script is idempotent — safe to run multiple times.
--
-- WHY THESE ARE FUNCTIONS AND NOT APPLICATION CODE
--
-- Capacity on this site has historically been advisory: the event page counts
-- bookings on load and disables a button. That is a read-then-write race, and
-- it is exactly what the Dukes Weekend must not do. Every rule that has to
-- hold no matter what the browser sends lives here instead, inside a
-- transaction that takes a row lock before it counts.
--
-- HOW THEY ARE CALLED
--
-- These are SECURITY DEFINER and derive the acting member from auth.uid(),
-- so they must be invoked with the caller's own JWT — the API routes build a
-- user-scoped Supabase client from the request's Bearer token and call .rpc()
-- on that, NOT on the service-role client (where auth.uid() would be NULL).
-- A route therefore cannot act on behalf of a member it has not
-- authenticated, even by mistake.
--
-- ERRORS
--
-- Failures raise a bare machine-readable code as the exception message
-- (NOT_A_MEMBER, COURSE_FULL, …). app/api/weekend/* maps those to HTTP
-- statuses and human wording; anything unrecognised is treated as a 500.
--

-- ───────────────────────────────────────────────────────────────────
-- 1. Membership helper
-- ───────────────────────────────────────────────────────────────────
-- The SQL counterpart of canBookEvent() in lib/membership-gates.ts: trainees
-- may not book in-person event types, and a Dukes Weekend is one.

CREATE OR REPLACE FUNCTION is_full_member()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('member', 'editor', 'admin', 'super_admin')
      AND approval_status = 'approved'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ───────────────────────────────────────────────────────────────────
-- 2. Accommodation guard — trigger on event_bookings
-- ───────────────────────────────────────────────────────────────────
-- Members can update their own booking row directly (see
-- add-event-bookings-update-own-policy.sql), so the room rules cannot live
-- only in save_weekend_booking() — someone could PATCH the row through
-- PostgREST and skip it. This trigger runs on every write path.
--
-- Sunday-requires-Saturday and Saturday-room-requires-in-person are already
-- CHECK constraints. What needs a trigger is the pair of rules that depend on
-- other tables: the Friday room's dependency on a Friday course booking, and
-- the per-night venue caps.
--
-- The FOR UPDATE lock on the parent event is what makes the cap counting safe
-- under concurrency: every room-affecting write to a given weekend serialises
-- behind it.

CREATE OR REPLACE FUNCTION weekend_booking_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_event          events%ROWTYPE;
  v_friday_courses INTEGER;
  v_rooms_used     INTEGER;
  v_new_friday     BOOLEAN;
  v_new_saturday   BOOLEAN;
BEGIN
  -- Only a request being newly made needs policing. Re-validating one that
  -- already exists would block unrelated edits — an admin recording the
  -- allocated room, say — and would re-litigate a decision already taken.
  v_new_friday := COALESCE(NEW.room_friday_requested, false)
                  AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.room_friday_requested, false));
  v_new_saturday := COALESCE(NEW.room_saturday_requested, false)
                    AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.room_saturday_requested, false));

  IF NOT (v_new_friday OR v_new_saturday) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_event FROM events WHERE id = NEW.event_id FOR UPDATE;

  -- Only Dukes Weekends have accommodation.
  IF v_event.event_type IS DISTINCT FROM 'Dukes Weekend' THEN
    RETURN NEW;
  END IF;

  -- Validation rule 6 — a Friday room is for members who are at the venue on
  -- Friday, which means holding a confirmed place on a Friday course.
  -- Waitlisted places do not count: they are not attendance.
  IF v_new_friday THEN
    SELECT COUNT(*) INTO v_friday_courses
    FROM weekend_course_bookings b
    JOIN weekend_courses c ON c.id = b.course_id
    WHERE b.user_id = NEW.user_id
      AND b.event_id = NEW.event_id
      AND b.status = 'booked'
      AND c.day = 'friday';

    IF v_friday_courses = 0 THEN
      RAISE EXCEPTION 'FRIDAY_ROOM_REQUIRES_FRIDAY_COURSE';
    END IF;
  END IF;

  -- Venue inventory caps. NULL capacity means uncapped.
  IF v_new_friday AND v_event.weekend_friday_room_capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_rooms_used
    FROM event_bookings
    WHERE event_id = NEW.event_id
      AND room_friday_requested
      AND status <> 'cancelled'
      AND id <> NEW.id;   -- do not count the row being written

    IF v_rooms_used >= v_event.weekend_friday_room_capacity THEN
      RAISE EXCEPTION 'FRIDAY_ROOMS_FULL';
    END IF;
  END IF;

  IF v_new_saturday AND v_event.weekend_saturday_room_capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_rooms_used
    FROM event_bookings
    WHERE event_id = NEW.event_id
      AND room_saturday_requested
      AND status <> 'cancelled'
      AND id <> NEW.id;

    IF v_rooms_used >= v_event.weekend_saturday_room_capacity THEN
      RAISE EXCEPTION 'SATURDAY_ROOMS_FULL';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS weekend_booking_guard_trigger ON event_bookings;
CREATE TRIGGER weekend_booking_guard_trigger
  BEFORE INSERT OR UPDATE ON event_bookings
  FOR EACH ROW EXECUTE FUNCTION weekend_booking_guard();

-- ───────────────────────────────────────────────────────────────────
-- 3. Waitlist promotion (internal)
-- ───────────────────────────────────────────────────────────────────
-- Called after a place frees up. The caller MUST already hold the course row
-- lock, so this never counts against a moving target.
--
-- Promotion re-runs the overlap rule: a member is allowed to sit on the
-- waitlist for a course that clashes with something they hold, but they must
-- not be promoted into a double booking. Such a candidate is skipped and left
-- queued rather than dropped, and the next eligible member takes the place.

CREATE OR REPLACE FUNCTION promote_weekend_waitlist(p_course_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_course    weekend_courses%ROWTYPE;
  v_booked    INTEGER;
  v_candidate weekend_course_bookings%ROWTYPE;
  v_clashes   BOOLEAN;
  v_promoted  JSONB := NULL;
  v_position  INTEGER := 0;
  v_row       weekend_course_bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_course FROM weekend_courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO v_booked
  FROM weekend_course_bookings
  WHERE course_id = p_course_id AND status = 'booked';

  IF v_booked < v_course.capacity THEN
    FOR v_candidate IN
      SELECT * FROM weekend_course_bookings
      WHERE course_id = p_course_id AND status = 'waitlisted'
      ORDER BY waitlist_position NULLS LAST, created_at
    LOOP
      SELECT EXISTS (
        SELECT 1
        FROM weekend_course_bookings b
        JOIN weekend_courses c ON c.id = b.course_id
        WHERE b.user_id = v_candidate.user_id
          AND b.event_id = v_course.event_id
          AND b.status = 'booked'
          AND b.course_id <> p_course_id
          AND v_course.starts_at < c.ends_at
          AND c.starts_at < v_course.ends_at
      ) INTO v_clashes;

      IF NOT v_clashes THEN
        UPDATE weekend_course_bookings
        SET status = 'booked', waitlist_position = NULL, updated_at = now()
        WHERE id = v_candidate.id;

        v_promoted := jsonb_build_object(
          'user_id',      v_candidate.user_id,
          'course_id',    p_course_id,
          'course_title', v_course.title
        );
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Resequence whoever is left so positions stay 1..n with no gaps.
  FOR v_row IN
    SELECT * FROM weekend_course_bookings
    WHERE course_id = p_course_id AND status = 'waitlisted'
    ORDER BY waitlist_position NULLS LAST, created_at
  LOOP
    v_position := v_position + 1;
    UPDATE weekend_course_bookings
    SET waitlist_position = v_position
    WHERE id = v_row.id;
  END LOOP;

  RETURN v_promoted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ───────────────────────────────────────────────────────────────────
-- 4. save_weekend_booking — day selection, streaming mode, rooms
-- ───────────────────────────────────────────────────────────────────
-- The single entry point for the weekend booking itself. Enforces validation
-- rules 1, 2, 3, 7 and 9 directly, and rule 6 via the trigger above.
--
-- Dropping a day is not just a flag change: it cascades. Cancelling Friday
-- releases that day's course places (promoting whoever is waiting) and
-- invalidates the Friday room request, because the thing that made the member
-- eligible is gone. What was invalidated comes back in the return value so
-- the API route can tell the member.

CREATE OR REPLACE FUNCTION save_weekend_booking(
  p_event_id      UUID,
  p_friday        BOOLEAN,
  p_saturday      BOOLEAN,
  p_sunday        BOOLEAN,
  p_saturday_mode TEXT,
  p_room_friday   BOOLEAN,
  p_room_saturday BOOLEAN
) RETURNS JSONB AS $$
DECLARE
  v_user        UUID := auth.uid();
  v_event       events%ROWTYPE;
  v_profile     profiles%ROWTYPE;
  v_booking     event_bookings%ROWTYPE;
  v_mode        TEXT;
  v_room_fri    BOOLEAN := COALESCE(p_room_friday, false);
  v_room_sat    BOOLEAN := COALESCE(p_room_saturday, false);
  v_dropped     RECORD;
  v_promoted    JSONB;
  v_promotions  JSONB := '[]'::jsonb;
  v_cancelled   INTEGER := 0;
  v_fri_cleared BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- Locking the event here also pre-acquires the lock the room guard needs,
  -- so the whole booking is serialised per weekend.
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;

  IF v_event.event_type IS DISTINCT FROM 'Dukes Weekend' THEN
    RAISE EXCEPTION 'NOT_A_WEEKEND_EVENT';
  END IF;

  IF v_event.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'EVENT_NOT_PUBLISHED';
  END IF;

  -- Validation rule 1 — members only, and trainees are not full members.
  IF NOT is_full_member() THEN
    RAISE EXCEPTION 'NOT_A_MEMBER';
  END IF;

  -- Bookings and changes both close at the same moment. This is also the
  -- cutoff for switching courses (open question 5).
  IF v_event.application_deadline IS NOT NULL AND v_event.application_deadline < now() THEN
    RAISE EXCEPTION 'BOOKING_CLOSED';
  END IF;

  IF NOT (COALESCE(p_friday, false) OR COALESCE(p_saturday, false)) THEN
    -- Sunday cannot stand alone, so with neither Friday nor Saturday there is
    -- nothing bookable left. Cancelling is a separate action.
    RAISE EXCEPTION 'NO_DAYS_SELECTED';
  END IF;

  -- Validation rule 2. Rule 3 needs no check — Friday alone is simply allowed.
  IF COALESCE(p_sunday, false) AND NOT COALESCE(p_saturday, false) THEN
    RAISE EXCEPTION 'SUNDAY_REQUIRES_SATURDAY';
  END IF;

  -- Saturday attendance mode. Streaming is free and only offered on some
  -- weekends, so it is a per-event toggle rather than a separate ticket.
  IF COALESCE(p_saturday, false) THEN
    v_mode := COALESCE(p_saturday_mode, 'in_person');
    IF v_mode NOT IN ('in_person', 'stream') THEN
      RAISE EXCEPTION 'INVALID_SATURDAY_MODE';
    END IF;
    IF v_mode = 'stream' AND NOT COALESCE(v_event.weekend_stream_enabled, false) THEN
      RAISE EXCEPTION 'STREAMING_NOT_AVAILABLE';
    END IF;
  ELSE
    v_mode := NULL;
  END IF;

  -- A stream attendee is not at the venue on Saturday night. Forced rather
  -- than rejected so a member switching to the stream keeps their booking.
  IF v_mode IS DISTINCT FROM 'in_person' THEN
    v_room_sat := false;
  END IF;

  -- Same for Friday: no Friday, no Friday room.
  IF NOT COALESCE(p_friday, false) THEN
    v_room_fri := false;
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user;

  SELECT * INTO v_booking
  FROM event_bookings
  WHERE event_id = p_event_id AND user_id = v_user;

  -- ── Cascade: release course places for any day being dropped ──
  --
  -- Runs before the booking row is written so the room guard sees the final,
  -- consistent state.
  IF FOUND THEN
    FOR v_dropped IN
      SELECT b.id AS booking_row_id, b.course_id
      FROM weekend_course_bookings b
      JOIN weekend_courses c ON c.id = b.course_id
      WHERE b.event_id = p_event_id
        AND b.user_id = v_user
        AND b.status IN ('booked', 'waitlisted')
        AND (
          (c.day = 'friday' AND NOT COALESCE(p_friday, false)) OR
          (c.day = 'sunday' AND NOT COALESCE(p_sunday, false))
        )
    LOOP
      PERFORM 1 FROM weekend_courses WHERE id = v_dropped.course_id FOR UPDATE;

      UPDATE weekend_course_bookings
      SET status = 'cancelled', waitlist_position = NULL,
          cancelled_at = now(), updated_at = now()
      WHERE id = v_dropped.booking_row_id;

      v_cancelled := v_cancelled + 1;

      v_promoted := promote_weekend_waitlist(v_dropped.course_id);
      IF v_promoted IS NOT NULL THEN
        v_promotions := v_promotions || jsonb_build_array(v_promoted);
      END IF;
    END LOOP;

    v_fri_cleared := v_booking.room_friday_requested AND NOT v_room_fri;

    UPDATE event_bookings
    SET attends_friday          = COALESCE(p_friday, false),
        attends_saturday        = COALESCE(p_saturday, false),
        attends_sunday          = COALESCE(p_sunday, false),
        saturday_mode           = v_mode,
        room_friday_requested   = v_room_fri,
        room_saturday_requested = v_room_sat,
        status                  = CASE WHEN v_booking.status = 'cancelled'
                                       THEN CASE WHEN v_event.auto_approve THEN 'approved' ELSE 'pending' END
                                       ELSE v_booking.status END,
        cancelled_at            = NULL
    WHERE id = v_booking.id
    RETURNING * INTO v_booking;
  ELSE
    INSERT INTO event_bookings (
      event_id, user_id, status,
      applicant_name, applicant_email, applicant_training_level,
      applicant_hospital, applicant_deanery,
      attends_friday, attends_saturday, attends_sunday, saturday_mode,
      room_friday_requested, room_saturday_requested
    ) VALUES (
      p_event_id, v_user,
      CASE WHEN v_event.auto_approve THEN 'approved' ELSE 'pending' END,
      COALESCE(v_profile.full_name, ''), COALESCE(v_profile.email, ''),
      COALESCE(v_profile.training_stage, ''), '', COALESCE(v_profile.region, ''),
      COALESCE(p_friday, false), COALESCE(p_saturday, false), COALESCE(p_sunday, false), v_mode,
      v_room_fri, v_room_sat
    )
    RETURNING * INTO v_booking;
  END IF;

  RETURN jsonb_build_object(
    'booking_id',           v_booking.id,
    'status',               v_booking.status,
    'deposit_pence',        COALESCE(v_event.weekend_deposit_pence, 0),
    'courses_cancelled',    v_cancelled,
    'friday_room_cleared',  v_fri_cleared,
    'promotions',           v_promotions
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ───────────────────────────────────────────────────────────────────
-- 5. book_weekend_course
-- ───────────────────────────────────────────────────────────────────
-- Enforces validation rules 4 and 5. The FOR UPDATE on the course row is the
-- whole point: two members racing for the last place serialise behind it, so
-- exactly one is booked and the other is told the course is full (or joins
-- the waitlist).

CREATE OR REPLACE FUNCTION book_weekend_course(
  p_course_id      UUID,
  p_allow_waitlist BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_course   weekend_courses%ROWTYPE;
  v_event    events%ROWTYPE;
  v_booking  event_bookings%ROWTYPE;
  v_existing weekend_course_bookings%ROWTYPE;
  v_booked   INTEGER;
  v_clash    TEXT;
  v_status   TEXT;
  v_position INTEGER;
  v_row_id   UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- The lock that makes the capacity count below trustworthy.
  SELECT * INTO v_course FROM weekend_courses WHERE id = p_course_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = v_course.event_id;

  IF v_event.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'EVENT_NOT_PUBLISHED';
  END IF;

  IF NOT is_full_member() THEN
    RAISE EXCEPTION 'NOT_A_MEMBER';
  END IF;

  IF v_event.application_deadline IS NOT NULL AND v_event.application_deadline < now() THEN
    RAISE EXCEPTION 'BOOKING_CLOSED';
  END IF;

  -- A course place only makes sense on top of a weekend booking that covers
  -- that day.
  SELECT * INTO v_booking
  FROM event_bookings
  WHERE event_id = v_course.event_id AND user_id = v_user AND status <> 'cancelled';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_WEEKEND_BOOKING';
  END IF;

  IF v_course.day = 'friday' AND NOT v_booking.attends_friday THEN
    RAISE EXCEPTION 'NOT_ATTENDING_FRIDAY';
  END IF;

  IF v_course.day = 'sunday' AND NOT v_booking.attends_sunday THEN
    RAISE EXCEPTION 'NOT_ATTENDING_SUNDAY';
  END IF;

  SELECT * INTO v_existing
  FROM weekend_course_bookings
  WHERE course_id = p_course_id AND user_id = v_user;

  IF FOUND AND v_existing.status IN ('booked', 'waitlisted') THEN
    RAISE EXCEPTION 'ALREADY_BOOKED';
  END IF;

  SELECT COUNT(*) INTO v_booked
  FROM weekend_course_bookings
  WHERE course_id = p_course_id AND status = 'booked';

  IF v_booked < v_course.capacity THEN
    -- Validation rule 4 — one course per overlapping slot. Two courses
    -- overlap when start_a < end_b AND start_b < end_a. Only confirmed
    -- places clash; sitting on a waitlist for a clashing course is allowed,
    -- and promote_weekend_waitlist() re-checks before promoting.
    SELECT c.title INTO v_clash
    FROM weekend_course_bookings b
    JOIN weekend_courses c ON c.id = b.course_id
    WHERE b.user_id = v_user
      AND b.event_id = v_course.event_id
      AND b.status = 'booked'
      AND b.course_id <> p_course_id
      AND v_course.starts_at < c.ends_at
      AND c.starts_at < v_course.ends_at
    LIMIT 1;

    IF v_clash IS NOT NULL THEN
      RAISE EXCEPTION 'COURSE_OVERLAP:%', v_clash;
    END IF;

    v_status   := 'booked';
    v_position := NULL;
  ELSIF COALESCE(p_allow_waitlist, true) AND v_course.waitlist_enabled THEN
    v_status := 'waitlisted';
    SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO v_position
    FROM weekend_course_bookings
    WHERE course_id = p_course_id AND status = 'waitlisted';
  ELSE
    RAISE EXCEPTION 'COURSE_FULL';
  END IF;

  -- Reuse the member's existing row rather than inserting a second one, the
  -- same way registerForEvent() does in lib/events.ts — the UNIQUE constraint
  -- on (course_id, user_id) depends on it.
  INSERT INTO weekend_course_bookings (
    booking_id, course_id, event_id, user_id, status, waitlist_position
  ) VALUES (
    v_booking.id, p_course_id, v_course.event_id, v_user, v_status, v_position
  )
  ON CONFLICT (course_id, user_id) DO UPDATE
  SET booking_id        = EXCLUDED.booking_id,
      status            = EXCLUDED.status,
      waitlist_position = EXCLUDED.waitlist_position,
      cancelled_at      = NULL,
      updated_at        = now()
  RETURNING id INTO v_row_id;

  RETURN jsonb_build_object(
    'course_booking_id', v_row_id,
    'course_id',         p_course_id,
    'course_title',      v_course.title,
    'status',            v_status,
    'waitlist_position', v_position,
    'places_left',       GREATEST(v_course.capacity - v_booked - CASE WHEN v_status = 'booked' THEN 1 ELSE 0 END, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ───────────────────────────────────────────────────────────────────
-- 6. cancel_weekend_course_booking
-- ───────────────────────────────────────────────────────────────────
-- Dropping a course is also how a member switches courses: drop, then book
-- the other one. Both halves are open until the booking-close date.
--
-- Two knock-on effects are handled here rather than left to tidy up later:
-- the freed place goes to the waitlist, and if this was the member's last
-- Friday course their Friday room request is invalidated — an orphaned room
-- request would otherwise sit in the admin list looking legitimate.

CREATE OR REPLACE FUNCTION cancel_weekend_course_booking(p_course_booking_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user        UUID := auth.uid();
  v_row         weekend_course_bookings%ROWTYPE;
  v_course      weekend_courses%ROWTYPE;
  v_event       events%ROWTYPE;
  v_promoted    JSONB;
  v_was_booked  BOOLEAN;
  v_remaining   INTEGER;
  v_fri_cleared BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_row FROM weekend_course_bookings WHERE id = p_course_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_BOOKING_NOT_FOUND';
  END IF;

  -- Admins can cancel on a member's behalf; members only their own.
  IF v_row.user_id <> v_user AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_YOUR_BOOKING';
  END IF;

  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('already_cancelled', true);
  END IF;

  SELECT * INTO v_course FROM weekend_courses WHERE id = v_row.course_id FOR UPDATE;
  SELECT * INTO v_event  FROM events WHERE id = v_course.event_id;

  IF v_row.user_id = v_user
     AND NOT is_admin()
     AND v_event.application_deadline IS NOT NULL
     AND v_event.application_deadline < now() THEN
    RAISE EXCEPTION 'BOOKING_CLOSED';
  END IF;

  v_was_booked := v_row.status = 'booked';

  UPDATE weekend_course_bookings
  SET status = 'cancelled', waitlist_position = NULL,
      cancelled_at = now(), updated_at = now()
  WHERE id = p_course_booking_id;

  IF v_was_booked THEN
    v_promoted := promote_weekend_waitlist(v_row.course_id);
  ELSE
    -- Leaving a waitlist just closes the gap behind you.
    PERFORM promote_weekend_waitlist(v_row.course_id);
  END IF;

  -- Validation rule 6, kept true after the fact.
  IF v_course.day = 'friday' THEN
    SELECT COUNT(*) INTO v_remaining
    FROM weekend_course_bookings b
    JOIN weekend_courses c ON c.id = b.course_id
    WHERE b.user_id = v_row.user_id
      AND b.event_id = v_row.event_id
      AND b.status = 'booked'
      AND c.day = 'friday';

    IF v_remaining = 0 THEN
      UPDATE event_bookings
      SET room_friday_requested = false
      WHERE id = v_row.booking_id AND room_friday_requested
      RETURNING true INTO v_fri_cleared;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'cancelled',           true,
    'course_id',           v_row.course_id,
    'course_title',        v_course.title,
    'user_id',             v_row.user_id,
    'friday_room_cleared', COALESCE(v_fri_cleared, false),
    'promoted',            v_promoted
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ───────────────────────────────────────────────────────────────────
-- 7. transition_event_payments — admin deposit actions
-- ───────────────────────────────────────────────────────────────────
-- Marking deposits paid and refunding them, one at a time or in bulk, in a
-- single transaction with an audit row written for every transition.
--
-- Refunds are admin-triggered after the event, based on attendance, and a
-- deposit is never forfeited — cancelling at any point leaves it refundable.
-- (Open question 3, answered: no forfeit policy in v1.)

CREATE OR REPLACE FUNCTION transition_event_payments(
  p_payment_ids UUID[],
  p_to_status   TEXT,
  p_note        TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_actor   UUID := auth.uid();
  v_payment event_payments%ROWTYPE;
  v_changed INTEGER := 0;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AN_ADMIN';
  END IF;

  IF p_to_status NOT IN ('pending', 'held', 'paid', 'refunded', 'failed') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS';
  END IF;

  FOR v_payment IN
    SELECT * FROM event_payments WHERE id = ANY(p_payment_ids) FOR UPDATE
  LOOP
    CONTINUE WHEN v_payment.status = p_to_status;

    UPDATE event_payments
    SET status      = p_to_status,
        paid_at     = CASE WHEN p_to_status = 'paid'     THEN now() ELSE paid_at END,
        refunded_at = CASE WHEN p_to_status = 'refunded' THEN now() ELSE refunded_at END,
        updated_at  = now()
    WHERE id = v_payment.id;

    INSERT INTO event_payment_events (payment_id, from_status, to_status, actor_id, note)
    VALUES (v_payment.id, v_payment.status, p_to_status, v_actor, p_note);

    v_changed := v_changed + 1;
  END LOOP;

  RETURN jsonb_build_object('changed', v_changed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ───────────────────────────────────────────────────────────────────
-- 8. Availability — aggregate counts for the booking UI
-- ───────────────────────────────────────────────────────────────────
-- weekend_course_bookings is readable only by its owner and by admins, which
-- is right — one member has no business reading another's schedule. But the
-- booking page still has to show "3 places left" and grey out full courses.
--
-- These return counts and nothing else: no user ids, no names, nothing that
-- identifies who holds a place. SECURITY DEFINER so the aggregate is visible
-- without opening up the rows behind it.

CREATE OR REPLACE FUNCTION weekend_course_availability(p_event_id UUID)
RETURNS TABLE (
  course_id   UUID,
  capacity    INTEGER,
  booked      BIGINT,
  waitlisted  BIGINT,
  places_left INTEGER
) AS $$
  SELECT
    c.id,
    c.capacity,
    COUNT(b.id) FILTER (WHERE b.status = 'booked'),
    COUNT(b.id) FILTER (WHERE b.status = 'waitlisted'),
    GREATEST(c.capacity - COUNT(b.id) FILTER (WHERE b.status = 'booked'), 0)::INTEGER
  FROM weekend_courses c
  LEFT JOIN weekend_course_bookings b ON b.course_id = c.id
  WHERE c.event_id = p_event_id
  GROUP BY c.id, c.capacity;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION weekend_room_availability(p_event_id UUID)
RETURNS TABLE (
  friday_capacity   INTEGER,
  friday_used       BIGINT,
  saturday_capacity INTEGER,
  saturday_used     BIGINT
) AS $$
  SELECT
    e.weekend_friday_room_capacity,
    (SELECT COUNT(*) FROM event_bookings b
      WHERE b.event_id = e.id AND b.room_friday_requested AND b.status <> 'cancelled'),
    e.weekend_saturday_room_capacity,
    (SELECT COUNT(*) FROM event_bookings b
      WHERE b.event_id = e.id AND b.room_saturday_requested AND b.status <> 'cancelled')
  FROM events e
  WHERE e.id = p_event_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ───────────────────────────────────────────────────────────────────
-- 9. Lock down execution
-- ───────────────────────────────────────────────────────────────────
-- promote_weekend_waitlist() assumes its caller holds the course row lock, so
-- it is not safe to invoke on its own — keep it off the PostgREST surface.

REVOKE ALL ON FUNCTION promote_weekend_waitlist(UUID) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION save_weekend_booking(UUID, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION book_weekend_course(UUID, BOOLEAN)        TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_weekend_course_booking(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION transition_event_payments(UUID[], TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_full_member()                          TO authenticated;

-- Availability is aggregate-only, so it is safe for logged-out visitors too —
-- the event page shows how full a course is before anyone signs in.
GRANT EXECUTE ON FUNCTION weekend_course_availability(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION weekend_room_availability(UUID)   TO anon, authenticated;

-- ───────────────────────────────────────────────────────────────────
-- 10. Verify
-- ───────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✓ is_full_member() — trainees excluded, matching canBookEvent()';
  RAISE NOTICE '✓ weekend_booking_guard trigger — Friday-course and room-cap rules on every write path';
  RAISE NOTICE '✓ save_weekend_booking() — day combination, streaming mode, room requests, drop cascade';
  RAISE NOTICE '✓ book_weekend_course() — row-locked capacity, overlap rule, waitlist';
  RAISE NOTICE '✓ cancel_weekend_course_booking() — waitlist promotion, room invalidation';
  RAISE NOTICE '✓ transition_event_payments() — admin deposit actions with audit trail';
END $$;
