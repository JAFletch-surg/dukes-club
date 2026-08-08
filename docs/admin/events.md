---
title: Events
parent: Admin Guide
nav_order: 2
---

# Events

## Overview

The Events section lets you create and manage courses, webinars, conferences, and workshops. Each event can have its own application process, feedback forms, and certificates.

## Creating an Event

Click **Add Event** to open the event form. Fill in the following sections:

### Basic Information

* **Title** — The event name displayed on the site.
* **Slug** — Auto-generated from the title; used in the event URL.
* **Start / End Date** — When the event runs.
* **Location** — Venue name (e.g. "Royal College of Surgeons").
* **Address** — Full address for in-person events.
* **Description** — The event write-up shown on the event page. See [Formatting free text](#formatting-free-text).
* **Status** — Draft, Published, or Archived.
* **Featured** — Toggle to highlight the event on the homepage.

### Formatting free text

**Description**, **Eligibility Criteria** and **Confirmation Message** each have two modes, switched with the **Visual** and **HTML** buttons above the box. Both edit the same text, so one person can lay a page out visually and another can drop an embed into it afterwards.

**Visual** — the default, and the one to use if you would rather not see any markup. Select some text and click a button:

* **B** / *I* / <u>U</u> for bold, italic and underline
* **H1 H2 H3** for headings
* Bulleted and numbered lists, and a **link** button that asks for the address
* A quote, a **highlighted box** (the cream callout), a **table**, and a divider
* Undo and redo on the right

Buttons light up when the cursor is inside text they apply to, so you can always see what is bold and what is a heading.

**HTML** — the raw markup, with the **INSERT** bar and a **Preview** button. Use it to paste a YouTube or Google Maps embed, an image, or anything else the visual buttons do not cover. Here a blank line starts a new paragraph and a single line break stays a line break, and INSERT snippets drop in at the cursor, wrapping any text you have selected.

> Switching **HTML → Visual** asks first if the field contains something the visual editor cannot show, such as an `<iframe>` or an `<img>`, and names it. Say no and you stay in HTML with the markup intact. Say yes and that markup is removed — the field tells you afterwards what went. Switching the other way, Visual → HTML, never loses anything.

Markup is scrubbed against an allow-list on save: headings, lists, tables, links, images, dividers and YouTube/Vimeo/Google Maps embeds are kept; `<script>`, forms, event handlers such as `onclick`, `javascript:` links and other embeds are removed. Unclosed tags are closed for you.

A tag-free copy of the description is stored separately and is what the event cards, the webinar list and search use — so the listing previews stay clean however the description is formatted.

> **Setup:** Descriptions need the `description_html` column. Run `supabase/add-event-description-html.sql` once against the database; it also backfills existing descriptions. Until it is run, events still save but formatting is dropped and the admin warns you.

### Event Types

| Type               | Description                                   |
| ------------------ | --------------------------------------------- |
| Webinar            | Online-only, streamed live                    |
| Online Lecture     | Online-only, may be pre-recorded              |
| Practical Workshop | In-person, hands-on (applications enabled)    |
| Conference         | Large-scale event                             |
| In Person Course   | In-person teaching (applications enabled)     |
| Hybrid             | Combined online and in-person                 |
| Dukes Weekend      | Three-day members-only weekend — see [Dukes Weekend](#dukes-weekend) |

### Access Levels

* **Public** — Visible to everyone.
* **Registered** — Visible to logged-in users.
* **Members Only** — Restricted to approved members.
* **Invite Only** — Only accessible via direct invitation.

### Pricing

* **Regular Price** — Standard ticket price.
* **Member Price** — Discounted price for Dukes' Club members.
* **Capacity** — Maximum number of attendees.

### Featured Image

Choose from the **stock image library** (surgical theatre, conference room, laparoscopic setup, etc.) or upload a custom image.

### Streaming Configuration

> **Note:** Streaming settings are only available for **Webinar**, **Online Lecture**, and **Hybrid** event types.

* **Stream Type** — Zoom, Vimeo Live, or Hybrid.
* **Zoom** — URL, Meeting ID, and Passcode.
* **Vimeo Live** — Vimeo Live ID and embed URL.

### Specialties

Select one or more colorectal surgery subspecialties (Cancer, IBD, Robotic, Laparoscopic, Pelvic Floor, etc.) to help members find relevant events.

### Timetable

Build a multi-day timetable for the event:

1. Add days as needed.
2. Enter sessions in CSV format: `time, title` (one per line).
3. The timetable is parsed and stored automatically.

### Faculty

Assign faculty members as speakers or facilitators:

1. Use the faculty picker to search by name.
2. Select a role for each faculty member (e.g. "Speaker", "Faculty").
3. Faculty must already exist in the [Faculty database](people.md#faculty) — use the "Create Faculty" dialog if they do not.

## Applications and Registration

> **Note:** Application settings are only available for **Practical Workshop** and **In Person Course** event types.

* **Applications Enabled** — Toggle on to accept applications.
* **Eligibility Criteria** — Free-text description of who can apply.
* **Training Level Requirements** — Checkboxes for eligible training levels.
* **Application Deadline** — Cut-off date for submissions.
* **Custom Questions** — Add bespoke application questions (e.g. "Why do you want to attend?").
* **Places Available** — Number of places to offer.
* **Auto-approve** — Automatically approve all applications (skip manual review).
* **Confirmation Message** — Text shown to applicants after submission.

## Managing Applicants

Navigate to an event's **Applicants** page to review and manage applications.

### Applicant Statuses

| Status     | Meaning                                    |
| ---------- | ------------------------------------------ |
| Pending    | Application received, awaiting review      |
| Approved   | Accepted — email sent to applicant         |
| Confirmed  | Applicant has confirmed attendance         |
| Rejected   | Not accepted — email sent to applicant     |
| Waitlisted | On the waiting list — email sent           |
| Cancelled  | Applicant or admin cancelled               |

### Workflow

1. Review pending applications (name, email, hospital, answers to custom questions).
2. Change status individually or in batch.
3. The system sends an automatic email notification when you approve, reject, waitlist, or cancel an applicant.
4. Track capacity: the page shows places used vs. places available.

### Filtering

* Search by name, email, or hospital.
* Filter by status using the dropdown.

## Feedback and Certificates

Navigate to an event's **Feedback** page. This has three tabs:

### Builder

Design a feedback survey:

1. Set a **title** and **description** for the form.
2. Set **opens at** and **closes at** dates to control when feedback can be submitted.
3. Add questions using the question builder. Four question types are available:
   * **Star Rating** (1–5 stars)
   * **Free Text** (open-ended response)
   * **Multiple Choice** (custom options)
   * **Yes/No**
4. Mark questions as required or optional.
5. Reorder questions by dragging.

A set of **default questions** is provided (overall rating, content quality, faculty quality, relevance, recommendation, best aspect, improvements).

### Responses

* View all submitted feedback with respondent details.
* See aggregate rating statistics.
* Search and filter responses.
* **Export** responses for external analysis.

### Certificates

* **Enable certificates** for the event.
* Set a **certificate title** (e.g. "Certificate of Attendance").
* Specify **CPD points** awarded.
* Certificates are generated and available for download by attendees who completed the feedback form.

## Dukes Weekend

A **Dukes Weekend** is an event type like any other, but it books differently: one event spanning three days, with its own courses, accommodation and deposit.

| Day | Contents | Bookable alone? |
| --- | --- | --- |
| Friday | Any number of in-person courses | Yes |
| Saturday | The main programme | Yes |
| Sunday | Courses, including the revision course | **No** — requires Saturday |

Members may book Friday only, Saturday only, Friday + Saturday, Saturday + Sunday, or all three. Sunday never stands alone.

> **Setup:** Run these three files once against the database, **in this order**. All three are required — a weekend cannot be booked until every one has been applied.
>
> 1. `supabase/add-dukes-weekend-event-type.sql` — adds `Dukes Weekend` to the `event_type` enum. Without it, saving a weekend fails with *invalid input value for enum event_type*.
> 2. `supabase/create-dukes-weekend.sql` — the tables and columns. It refuses to run if step 1 has not been applied.
> 3. `supabase/dukes-weekend-functions.sql` — the booking rules and the place-counting used on the event page. **Without this, members get *"Something went wrong"* when they try to book**, and courses show their full capacity rather than real numbers.
>
> Step 1 must be its own run: Postgres will not let a new enum value be used in the same transaction that adds it.
>
> **If anything misbehaves, run `supabase/dukes-weekend-healthcheck.sql` first.** It is read-only and safe on the live database. It returns a table of one row per check — read the top: anything marked `MISSING` names the file to run in the **fix** column, and the rows are ordered so running them top to bottom is the right order. `TYPE` rows at the bottom are information rather than a problem. Most weekend problems are a migration that has not been applied rather than a bug, and this tells the two apart in one go.
>
> Admins and editors also see the underlying database error on the booking page itself when something fails; members only ever see the plain-English message.

> **Separately:** if event descriptions lose their formatting when you save, `supabase/add-event-description-html.sql` has not been run. That is unrelated to the weekend and affects all events.

### Creating one

Choose **Dukes Weekend** as the event type. The core details are the same as any event (title, dates, venue, description, imagery), plus a **Dukes Weekend Settings** section:

* **Refundable Deposit** — in pence. One deposit per member for the whole weekend, however many days or courses they book. Leave blank for no deposit.
* **Booking Closes** — the cut-off for booking, for changing days, and for switching courses.
* **Stream the Saturday programme** — off by default. When on, members choose in person or stream as they book Saturday. The stream is free, has no capacity limit, and stream attendees cannot request a room.
* **Friday / Saturday Night Rooms** — how many rooms the venue has each night. Leave blank for no limit; once full, further requests are refused.

A Dukes Weekend is **members only** — that is built into the event type, not a setting. Non-members still see the event page, but the booking controls are replaced by a members-only notice.

### Courses

Courses run on **Friday** and **Sunday**. Saturday is the main programme and uses the event's own timetable instead.

Saving a new Dukes Weekend takes you straight to the **Courses** screen. You can return to it at any time from the **Courses** button on the event's row in the events list, or the link in the event's Dukes Weekend Settings. For each course set:

* Title, description, and start/end times — the times decide which courses clash
* **Capacity** — a hard limit; bookings are refused once it is reached
* **Learning objectives** — an ordered list
* **Course timetable** — time, title, optional description and optional faculty per item
* **Faculty** — the same picker used elsewhere on the site
* **Revision course** — a label for the Sunday revision course. It books exactly like any other course; the flag is only for labelling and reporting
* **Waitlist** — on by default. Members join a queue when a course is full and are promoted automatically, and emailed, when a place frees up

A member may hold only **one course per overlapping time slot**. Overlapping courses are greyed out for them with an explanation. Two courses on the same day at the same time is perfectly normal — it is how a choice is offered.

### Accommodation

Members state whether they need a room for **Friday night** and/or **Saturday night**. They are stating a need, not choosing a room — Dukes allocates the rooms.

* A **Friday** room requires a confirmed place on a Friday course. If a member later drops their last Friday course, the request is cancelled automatically and they are emailed.
* A **Saturday** room requires attending Saturday **in person**. Stream attendees cannot request one.

Open **Rooms** from the events list to see every request, filter by night or by what is still unallocated, record the allocated room against each member, and export the list as CSV.

### Deposits

The deposit is recorded against the member's booking when they book. Nothing is charged online yet — deposits are collected offline and an admin records them.

Open **Attendees** from the events list to see each member's days, courses, rooms and deposit. From there you can **Mark paid** and **Refund**, one at a time or with **Refund All** once the weekend is over. Every change is written to an audit trail, and members are emailed when their deposit is refunded.

> **Payments:** Stripe is not connected. The site ships with a manual provider, and a Stripe implementation is stubbed behind the `PAYMENT_PROVIDER` environment variable so it can be switched on later without rebuilding the booking flow.

### Sponsors

Add sponsors to a Dukes Weekend from the event form. Sponsors are shared across the site — create and edit the records themselves under **Admin → Sponsors** — and each one can be given a tier just for this event and a sort order. They appear in a dedicated section on the event page, grouped by tier.

### Feedback

A Dukes Weekend has feedback at two levels:

* **Each course** has its own form, reached from the **Feedback** button beside it on the Courses screen.
* **The weekend overall**, including the Saturday programme, uses the event's own feedback form as normal.

Responses are viewed per course or for the event, in the same builder and response views used everywhere else.
