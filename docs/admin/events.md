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
* **Card Summary** — One line, up to 160 characters, shown on the event tiles and under the title on the event page. Leave it blank and the tiles fall back to the opening of the description, so fill it in for anything with a long write-up.
* **Description** — The event write-up shown on the event page. See [Formatting free text](#formatting-free-text).
* **Status** — Draft, Published, or Archived.
* **Featured** — Toggle to highlight the event on the homepage.

### Formatting free text

**Description**, **Eligibility Criteria** and **Confirmation Message** all accept HTML segments, marked with an `HTML OK` badge.

* Write normally — a blank line starts a new paragraph, a single line break stays a line break.
* Drop HTML in wherever you want formatting, either by hand or from the **INSERT** bar (headings, bold, italic, links, bulleted and numbered lists, tables, callouts, dividers). Snippets drop in at the cursor and wrap any text you have selected.
* **Picture** uploads an image and drops it in at the cursor as a captioned figure — edit the caption text afterwards, or delete the `<figcaption>` line if you do not want one.
* **PDF** uploads a document (PDF, Word or PowerPoint) and drops in a link to it, which the event page renders as a file chip readers can click to open. Use it for programmes, faculty lists, consent forms and joining instructions.
* Uploads go to the shared media store, up to 10MB each, and the link keeps working once the event is published.
* **Preview** shows exactly how the field will render on the public page.

Markup is scrubbed against an allow-list on save: headings, lists, tables, links, images, dividers and YouTube/Vimeo/Google Maps embeds are kept; `<script>`, forms, event handlers such as `onclick`, `javascript:` links and other embeds are removed. Unclosed tags are closed for you.

A tag-free copy of the description is stored separately and is what the event cards, the webinar list and search use — so the listing previews stay clean however the description is formatted.

> **Setup:** Descriptions need the `description_html` column. Run `supabase/add-event-description-html.sql` once against the database; it also backfills existing descriptions. Until it is run, events still save but formatting is dropped and the admin warns you.
>
> **Card Summary** and the refundable-deposit tick box need `supabase/add-event-summary-and-deposit.sql`, which also seeds each existing event's summary from the opening of its description. Same behaviour until it is run: the event saves, those two fields are dropped, and the admin tells you which file to run.

### Event Types

| Type               | Description                                   |
| ------------------ | --------------------------------------------- |
| Webinar            | Online-only, streamed live                    |
| Online Lecture     | Online-only, may be pre-recorded              |
| Practical Workshop | In-person, hands-on (applications enabled)    |
| Conference         | Large-scale event                             |
| In Person Course   | In-person teaching (applications enabled)     |
| Hybrid             | Combined online and in-person                 |

### Access Levels

* **Public** — Visible to everyone.
* **Registered** — Visible to logged-in users.
* **Members Only** — Restricted to approved members.
* **Invite Only** — Only accessible via direct invitation.

### Pricing

* **Regular Price** — Standard ticket price.
* **Member Price** — Discounted price for Dukes' Club members.
* **Capacity** — Maximum number of attendees.
* **This price is a refundable deposit** — Tick when the fee is a deposit refunded on attendance rather than a charge. Cards, the calendar and the event page then read "£150 refundable deposit", and the event page's price box adds a *Fully refundable deposit* line.

### Sponsors

Attach the companies backing an event so the thanks do not have to be typed into the description.

* Search the **Sponsors** box by name or tier and pick one — the list comes from [Admin → Sponsors](organisation.md#sponsors), where the logo, website and tier are set up once and reused across events.
* Give each one a label: *Sponsor*, *Course Sponsor*, *Headline Sponsor*, *Supported by*, *Exhibitor* or *Prize Sponsor*.
* The event page lists them under **With thanks to** in the order you add them, each logo linking to the sponsor's website.
* Can't find a company? Add it on the sponsors page first, then come back to the event.
* Sponsors marked inactive stay on the event but are hidden from the public page until they are active again.

> **Setup:** Sponsors on events need the `event_sponsors` table. Run `supabase/add-event-sponsors.sql` once against the database. Until it is run the event still saves, and the admin tells you the sponsors did not.

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

## Streaming Settings

Shown for **Webinar**, **Online Lecture** and **Hybrid** event types.

* **Dukes' Live (on this site)** — the webinar runs natively on the site. Attendees watch,
  chat, ask questions and vote in polls without leaving Dukes' Club, and the recording is
  published to the video library afterwards. See [Live Webinars](live-webinars.md).
* **Zoom** — enter the join URL, meeting ID and passcode. Registered attendees see these on
  the webinars page.
* **Vimeo Live** — enter the Vimeo live event ID and embed URL.
* **Hybrid** — both Zoom and Vimeo details.

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
