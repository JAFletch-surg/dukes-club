---
title: People
parent: Admin Guide
nav_order: 5
---

# People

## Members

Approve and manage site members from the Members page.

> **Warning:** This page is restricted to **admin** and **super\_admin** roles only.

### Member Approval Workflow

1. A new user signs up on the site (status: **Pending**, role: **Pending**).
2. The application appears in the Members list under the **Pending** filter.
3. Review the applicant's details: name, email, region, and ACPGBI number.
4. **Approve** — Sets the status to "Approved" and the role to "Trainee". An approval email is sent automatically.
5. **Reject** — Sets the status to "Rejected".

> **Note:** Users with NHS (.nhs.net, .nhs.uk), doctors.org.uk, or .ac.uk email addresses are auto-approved at registration. They will not appear in the Pending list.

### Verification

Use the **Verify** filter to find trainees who have provided an ACPGBI number. Cross-reference their number to confirm eligibility.

### Roles

| Role        | Access Level                                    |
| ----------- | ----------------------------------------------- |
| Pending     | No access — awaiting approval                  |
| Trainee     | Standard member access                          |
| Member      | Standard member access                          |
| Editor      | Can manage content (posts, events, etc.)        |
| Admin       | Full admin panel access                         |
| Super Admin | Full access including member management         |

You can manually change a member's role and approval status via the edit modal.

### Search and Filter

* Search by name, email, region, role, or ACPGBI number.
* Filter by approval status: All, Pending, Approved, Rejected, Verify.

---

## Faculty

Maintain the faculty and speaker database from the Faculty page. Faculty records are referenced across [Events](events.md), [Videos](content.md#videos), and [Podcasts](content.md#podcasts).

### Creating a Faculty Profile

1. Click **Add Faculty**.
2. Fill in:
   * **Full Name** (required).
   * **Position / Title** (e.g. "Consultant Colorectal Surgeon").
   * **Hospital / Institution**.
   * **Email**.
   * **Bio** — Short biography.
   * **Photo** — Upload a headshot (max 5 MB).
   * **Active** — Toggle to show/hide on the site.
   * **Sort Order** — Numeric value to control display ordering.

### Where Faculty Appear

Faculty profiles are linked to:

* **Events** — As speakers or facilitators.
* **Videos** — As presenters.
* **Podcasts** — As guests.
* **Posts** — As authors.

> **Tip:** When you add a new faculty member here, they become immediately available in the faculty picker across all these sections.

---

## Executive Team

Manage committee member profiles from the Team page.

### Creating a Team Member Profile

1. Click **Add Member**.
2. Fill in:
   * **Full Name**.
   * **Role** — Select from 22 predefined committee roles:
     * Leadership: President, Vice-President, Past-President.
     * Officers: Secretary, Treasurer, Web Master.
     * Specialty Leads: IBD, Abdominal Wall, Pelvic Floor, etc.
     * Regional Representatives.
     * Coordinators: Communication, Events.
   * **Position Title** — Custom text for display.
   * **Hospital / Institution**.
   * **Bio** — Short biography.
   * **Region** — Select a UK region (16 options).
   * **Photo** — Upload a headshot (max 5 MB). Displayed as a circular avatar.

### Social Media Links

Add up to 6 social media profiles per team member:

* Twitter/X
* LinkedIn
* Instagram
* YouTube
* TikTok
* Website

For each, enter the platform URL and display handle. Use the add/remove buttons to manage links.
