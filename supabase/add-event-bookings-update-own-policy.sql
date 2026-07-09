-- Allow a user to update their own event_bookings row (e.g. to cancel a
-- registration). rls-policies.sql defines select_own and insert_own but was
-- missing update_own, so the existing "Cancel registration" buttons on
-- app/members/webinars/page.tsx and app/(public)/events/[slug]/page.tsx
-- have no policy allowing the update to succeed.
DROP POLICY IF EXISTS "event_bookings_update_own" ON event_bookings;

CREATE POLICY "event_bookings_update_own"
  ON event_bookings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
