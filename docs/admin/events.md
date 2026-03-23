# Events Management

## Overview

The Events section (`/admin/events`) lets you create and manage courses, webinars, conferences, and workshops. Each event can have its own application process, feedback forms, and certificates.

## Creating an Event

Click **Add Event** to open the event form. Fill in the following sections:

### Basic Information
- **Title** — The event name displayed on the site.
- **Slug** — Auto-generated from the title; used in the event URL.
- **Start / End Date** — When the event runs.
- **Location** — Venue name (e.g. "Royal College of Surgeons").
- **Address** — Full address for in-person events.
- **Description** — Plain-text summary shown on the event listing.
- **Status** — Draft, Published, or Archived.
- **Featured** — Toggle to highlight the event on the homepage.

### Event Types

| Type | Description |
|------|-------------|
| Webinar | Online-only, streamed live |
| Online Lecture | Online-only, may be pre-recorded |
| Practical Workshop | In-person, hands-on (applications enabled) |
| Conference | Large-scale event |
| In Person Course | In-person teaching (applications enabled) |
| Hybrid | Combined online and in-person |

### Access Levels
- **Public** — Visible to everyone.
- **Registered** — Visible to logged-in users.
- **Members Only** — Restricted to approved members.
- **Invite Only** — Only accessible via direct invitation.

### Pricing
- **Regular Price** — Standard ticket price.
- **Member Price** — Discounted price for Dukes' Club members.
- **Capacity** — Maximum number of attendees.

### Featured Image
Choose from the **stock image library** (surgical theatre, conference room, laparoscopic setup, etc.) or upload a custom image.

### Streaming Configuration
Available for Webinar, Online Lecture, and Hybrid events:
- **Stream Type** — Zoom, Vimeo Live, or Hybrid.
- **Zoom** — URL, Meeting ID, and Passcode.
- **Vimeo Live** — Vimeo Live ID and embed URL.

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
3. Faculty must already exist in the Faculty database — use the "Create Faculty" dialog if they do not.

## Applications and Registration

For **Practical Workshop** and **In Person Course** events, you can enable an application process:

- **Applications Enabled** — Toggle on to accept applications.
- **Eligibility Criteria** — Free-text description of who can apply.
- **Training Level Requirements** — Checkboxes for eligible training levels.
- **Application Deadline** — Cut-off date for submissions.
- **Custom Questions** — Add bespoke application questions (e.g. "Why do you want to attend?").
- **Places Available** — Number of places to offer.
- **Auto-approve** — Automatically approve all applications (skip manual review).
- **Confirmation Message** — Text shown to applicants after submission.

## Managing Applicants

Navigate to an event's **Applicants** page (`/admin/events/[eventId]/applicants`).

### Applicant Statuses

| Status | Meaning |
|--------|---------|
| Pending | Application received, awaiting review |
| Approved | Accepted — email sent to applicant |
| Confirmed | Applicant has confirmed attendance |
| Rejected | Not accepted — email sent to applicant |
| Waitlisted | On the waiting list — email sent |
| Cancelled | Applicant or admin cancelled |

### Workflow
1. Review pending applications (name, email, hospital, answers to custom questions).
2. Change status individually or in batch.
3. The system sends an automatic email notification when you approve, reject, waitlist, or cancel an applicant.
4. Track capacity: the page shows places used vs. places available.

### Filtering
- Search by name, email, or hospital.
- Filter by status using the dropdown.

## Feedback and Certificates

Navigate to an event's **Feedback** page (`/admin/events/[eventId]/feedback`). This has three tabs:

### Builder Tab
Design a feedback survey:
1. Set a **title** and **description** for the form.
2. Set **opens at** and **closes at** dates to control when feedback can be submitted.
3. Add questions using the question builder. Four question types are available:
   - **Star Rating** (1-5 stars)
   - **Free Text** (open-ended response)
   - **Multiple Choice** (custom options)
   - **Yes/No**
4. Mark questions as required or optional.
5. Reorder questions by dragging.
6. A set of **default questions** is provided (overall rating, content quality, faculty quality, relevance, recommendation, best aspect, improvements).

### Responses Tab
- View all submitted feedback with respondent details.
- See aggregate rating statistics.
- Search and filter responses.
- **Export** responses for external analysis.

### Certificates Tab
- **Enable certificates** for the event.
- Set a **certificate title** (e.g. "Certificate of Attendance").
- Specify **CPD points** awarded.
- Certificates are generated and available for download by attendees who completed the feedback form.
