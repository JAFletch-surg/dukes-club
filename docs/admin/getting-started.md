# Admin Panel - Getting Started

## Accessing the Admin Panel

Navigate to `/admin` in your browser. You must be logged in with an **admin** or **super_admin** role to access the panel.

## Dashboard Overview

The dashboard (`/admin`) gives you a snapshot of your site content:

- **Stat Cards** — Quick counts for Events, Posts, Videos, Fellowships, Podcasts, Questions, Members, and Sponsors.
- **Recent Events** — The five most recent events with their type, date, and status.

## Navigation

The sidebar is organised into three sections:

### Content
| Link | Purpose |
|------|---------|
| Dashboard | Overview and statistics |
| Events | Create and manage events, applications, and feedback |
| News & Posts | Publish articles and announcements |
| Videos | Manage the video library (Vimeo integration) |
| Podcasts | Manage podcast episodes (Spotify integration) |
| Questions | Build the exam question bank |
| Fellowships | List fellowship opportunities |

### People
| Link | Purpose |
|------|---------|
| Executive Team | Manage committee member profiles |
| Faculty | Maintain the faculty/speaker database |
| Members | Approve and manage site members (admin-only) |

### Organisation
| Link | Purpose |
|------|---------|
| Institutions | Manage hospitals and medical institutions |
| Sponsors | Manage sponsors and partners |

The sidebar footer provides links to the **Members Portal**, **Back to Site**, and **Logout**.

## Common Patterns

### Status Workflow
Most content types follow a three-stage status workflow:
- **Draft** — Not visible to the public. Use this while preparing content.
- **Published** — Live and visible on the site.
- **Archived** — Hidden from the site but retained in the database.

### Image Uploads
Across the panel you can upload images (event banners, faculty photos, sponsor logos, etc.). General rules:
- Maximum file size: **5 MB** (2 MB for sponsor logos).
- Supported formats: JPEG, PNG, WebP.
- Images are stored in Supabase Storage and a public URL is generated automatically.

### Slugs
When you enter a title for events, posts, videos, or fellowships, a URL-friendly **slug** is generated automatically (e.g. "Annual Weekend 2026" becomes `annual-weekend-2026`). You can edit the slug manually if needed.

### Search and Filters
All list pages include a search bar and filter dropdowns. Search is real-time, and you can combine search text with status/category filters.

### Notifications
Actions like saving, deleting, or approving display a **toast notification** in the top-right corner. Green toasts indicate success; red toasts indicate an error.
