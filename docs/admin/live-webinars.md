---
title: Live Webinars
parent: Admin Guide
nav_order: 3
---

# Live Webinars

## Overview

Webinars can run **natively on the site** instead of linking out to Zoom. Attendees watch,
chat, ask questions and vote in polls without leaving Dukes' Club, guest speakers present
their slides from the browser, and the recording is published to the members' video library
afterwards — linked to the event that produced it.

The existing Zoom and Vimeo Live options are unchanged. A webinar only runs natively if you
choose to set up a live room for it.

## Before the first webinar

Live webinars need a one-off technical setup — a LiveKit account, a storage bucket, a Vimeo
folder with a write-scoped token, and Supabase realtime replication. The full runbook is in
the project `README.md` under **Live webinars**; ask whoever maintains the site to work
through it once.

If it hasn't been done, the **Go live** button reports that live webinars aren't configured
rather than failing silently.

## Setting up a webinar

1. **Create the event as normal** under [Events](events.md), with an event type of
   **Webinar**, **Online Lecture** or **Hybrid**.
2. In the event's *Streaming Settings*, set **Stream Type** to **Dukes' Live (on this site)**.
   You do not need to fill in any Zoom or Vimeo fields.
3. Go to **Admin → Live Webinars** and press **New live room**, then pick your event.
   (Creating the room also sets the event's stream type for you, so step 2 is optional.)

Each webinar has four switches you can change at any time, including mid-session:

| Setting | What it does |
| --- | --- |
| **Live chat** | Free-form chat alongside the video |
| **Q&A** | Attendees submit questions; you and the speakers answer them |
| **Polls** | Polls you write in advance or on the fly |
| **Record automatically** | Starts recording the moment you go live |

## Inviting guest speakers

Press **Speakers** on the webinar. Add each speaker's name and, optionally, their email.

* Speakers **do not need a Dukes' Club account**. They join by a personal link.
* If you enter an email address, the invite is sent automatically. Otherwise, copy the link
  shown and send it yourself.
* **The link is shown once and cannot be retrieved.** Only a hashed version is stored, so
  nobody — including admins — can read it back later. If a speaker loses theirs, press
  **New link**; the old one stops working immediately.
* **Revoke** kills a link without deleting the speaker.

Roles:

* **Speaker** — can present and share their screen.
* **Moderator** — as above, and can answer questions in the Q&A.
* **Co-host** — full control of the session.

### What the speaker sees

Their link opens a **green room**: a camera preview, microphone level meter, and a
pre-flight checklist. Nothing is broadcast until they press *Join*. There is a **Test your
slides** button so the first screen share isn't in front of the audience.

> Screen sharing needs a **laptop** running Chrome, Edge or Safari. Phones and tablets
> cannot share a screen. The invite email says so, and the green room warns them if their
> browser can't do it.

## Running the webinar

Press **Open studio** on the webinar. The studio opens in a new tab and shows exactly what
attendees will see, plus your controls.

1. Join early, check your camera and microphone, and wait for your speakers to appear.
2. Press **Go live**. You'll get a checklist to confirm first — attendees are taken into the
   room the moment you confirm.
3. Recording starts automatically if that switch is on; the **Record** button in the header
   lets you start and stop it by hand.
4. Press **End** when finished. This stops the recording, saves it, and disconnects everyone.

While live, the right-hand panel gives you:

* **Chat** — hover any message to hide it.
* **Q&A** — answer, pin a question to the top for everyone, or hide it. An answer can carry
  a typed reply, a link, or an uploaded PDF or image (up to 10MB).
* **Polls** — write a poll, press **Launch** to open it, then **Close** when done. Results
  appear as live bars, and attendees only see the tally once they've voted.
* **Files** — share a paper, guideline or set of slides with everyone watching. These stay
  available on the page after the webinar ends.

## Recordings

When you end the session the recording is saved, uploaded to Vimeo, and added to the
members' video library automatically. This normally takes between twenty minutes and a
couple of hours, mostly waiting on Vimeo to process the file.

You can watch progress in the status badge on the Live Webinars page:

| Status | Meaning |
| --- | --- |
| **Recording** | The session is being recorded now |
| **Saved — awaiting transfer** | Recording finished, waiting to be sent to Vimeo |
| **Uploading to Vimeo** | Vimeo is fetching and processing the file |
| **Published** | Done — the recording is in the video library |
| **Failed** | Something went wrong; the reason is shown on the card |

The Live Webinars page moves recordings along by itself, once a minute, for as long as you
leave it open — so the simplest thing after ending a webinar is to leave that tab open and
let it finish. If you closed it, or a recording looks stuck, press **Check recordings** at
the top of the page. There is also a nightly job at 3am as a backstop, so nothing is ever
lost by forgetting.

Once published, the recording appears under **Past Webinars** on the members' webinars page
and in the video library, tagged to its event. There is no need to match it up by hand —
the link is automatic.

## Troubleshooting

**"Live webinars are not configured"** — the LiveKit credentials are missing. See the
project README.

**A speaker can't join** — check their link hasn't been revoked or expired (links last until
a day after the event). Press **New link** to issue a fresh one.

**The recording failed** — the reason appears on the webinar card. The most common cause is
a Vimeo token without upload permission; the second is the Vimeo account's weekly upload
allowance being used up.

**Nobody can see the video** — check you actually pressed **Go live**. Until you do,
attendees see a countdown rather than the stage.
