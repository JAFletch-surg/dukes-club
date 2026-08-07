---
title: Content
parent: Admin Guide
nav_order: 3
---

# Content

## News & Posts

Manage articles and announcements from the Posts page.

### Creating a Post

1. Click **Add Post**.
2. Fill in:
   * **Title** — Headline for the article.
   * **Slug** — Auto-generated from the title.
   * **Excerpt** — Short summary shown on listing pages.
   * **Publication Date** — When the post should appear.
   * **Status** — Draft, Published, or Archived.

### Rich Text Editor

The content editor includes a toolbar with:

* **Formatting** — Bold, Italic, Heading 1, Heading 2.
* **Lists** — Bulleted and numbered lists.
* **Blockquote** — For pull quotes or references.
* **Media** — Embed images and videos inline.
* **Links** — Insert hyperlinks.
* **Alignment** — Left, centre, right text alignment.

> **Note:** Use the **preview** button (eye icon) to see how the post will look before publishing.

### Author

Search for an author from the [Executive Team](people.md#executive-team) or [Faculty](people.md#faculty) database. The author's photo, name, and role are displayed on the published post.

### Categorisation

* **Category** — Choose one: Announcement, Education, Careers, Research, Events, Policy, Member News, or General.
* **Subspecialties** — Tag with relevant surgical subspecialties (21 options).
* **Tags/Keywords** — Free-text tags for further classification.

---

## Videos

Manage the video library from the Videos page. Videos are hosted on Vimeo and catalogued in the admin panel.

### Synced Folders

The library is fed by a chosen set of folders on the Vimeo account — not the whole account. Manage them from **Manage Folders** on the Videos page:

* **Synced folders** lists the folders currently feeding the library, each with its video count and when it last synced.
* **Available on Vimeo** lists every other folder on the account. Click **Add** to start syncing one — you never need to look up a folder ID.
* **Pause** stops syncing a folder without forgetting it; **Remove** (bin icon) drops it entirely.

> **Important:** A video that is not in a synced folder gets **archived** on the next sync. Pausing or removing a folder therefore archives its videos. Archived videos are hidden from members but not deleted — re-adding the folder and syncing brings them back.

### Vimeo Sync

The quickest way to populate the library:

1. Click **Sync from Vimeo**.
2. The system reads every synced folder and:
   * **Creates** records for new videos not yet in the database.
   * **Updates** existing records with the latest metadata (duration, thumbnail, play count). Anything you have edited by hand — title, description, category, speakers — is preserved.
   * **Archives** records for videos no longer in any synced folder.
3. A summary banner shows: created, updated, skipped, archived, and the total across all folders.

If a folder can't be read (deleted on Vimeo, or a temporary Vimeo outage) the banner says so in amber and **archiving is skipped for that run**, so videos in the unreachable folder stay published rather than disappearing from the library.

> **Tip:** Run Vimeo Sync regularly to keep the library up to date. New uploads to a synced folder are pulled in automatically.

> **Note:** Categories are never set by sync. Assign them by hand when editing a video.

### Manual Video Entry

1. Click **Add Video**.
2. Enter the **Vimeo ID** (required) — the numeric ID from the Vimeo URL.
3. The system auto-populates the **duration** and **thumbnail** from Vimeo.
4. Fill in:
   * **Title** and **Slug**.
   * **Description**.
   * **Category** — Operative, Complications, Webinar, Education, Lecture, Endoscopy, or Conference.
   * **Tags** — Keyword tags.
   * **Status** — Draft, Published, or Archived.
   * **Members Only** — Toggle to restrict access to approved members.
   * **Published Date**.

### Faculty Speakers

Link [faculty members](people.md#faculty) to each video using the faculty picker. Multiple speakers can be assigned.

### Search and Filter

* Search by title, description, or speaker name.
* Filter by status (All / Draft / Published / Archived).
* Filter by category.

---

## Podcasts

Manage podcast episodes from the Podcasts page. Episodes are hosted on Spotify and embedded on the site.

### Creating an Episode

1. Click **Add Episode**.
2. Fill in:
   * **Episode Number** — Sequential episode number.
   * **Title** — Episode title.
   * **Description** — Episode summary.
   * **Spotify URL** — Paste the Spotify episode link. The system automatically extracts the embed URL.
   * **Duration** — Episode length.
   * **Status** — Draft, Published, or Archived.
   * **Published Date**.

### Guest Faculty

Link [faculty members](people.md#faculty) as guests using the faculty picker. When a faculty member is selected, the **Guest Name** field auto-populates from their profile. You can also set a custom **Guest Title**.

### Categorisation

* **Subspecialties** — Tag with relevant surgical subspecialties (21 options).
* **Tags** — Choose from 22 predefined tags: Cancer, Rectal Cancer, IBD, Pelvic Floor, Robotic, Laparoscopic, and more.
