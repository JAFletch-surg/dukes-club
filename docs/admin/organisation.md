# Organisation: Institutions and Sponsors

## Institutions

Manage hospitals and medical institutions at `/admin/institutions`. Institutions are referenced by Fellowships (for location) and Events (for venue).

### Creating an Institution

1. Click **Add Institution**.
2. Fill in:
   - **Name** (required) — e.g. "St Mark's Hospital".
   - **Type** — Select one:
     - NHS Trust
     - NHS Foundation Trust
     - University Hospital
     - Private Hospital
     - Hospital
     - Medical School
     - Research Institute
     - Other
   - **Address** — Street address.
   - **City** — e.g. "London".
   - **Country** — Defaults to "United Kingdom".
   - **Website URL**.
   - **Logo** — Upload the institution's logo.
   - **Featured Image** — Upload a photo of the institution.
   - **Latitude / Longitude** — Geographic coordinates for map display.

### Where Institutions Appear
- **Fellowships** — Selected as locations for fellowship programmes.
- **Events** — Referenced as event venues.

---

## Sponsors

Manage sponsors and partners at `/admin/sponsors`.

### Creating a Sponsor

1. Click **Add Sponsor**.
2. Fill in:
   - **Name** (required) — Company or organisation name.
   - **Tier** — Select the sponsorship level:
     - Platinum
     - Gold
     - Silver
     - Bronze
     - Partner
   - **Website URL** — Link to the sponsor's site.
   - **Description** — Short description of the sponsor.
   - **Logo** — Upload the sponsor's logo (max 2 MB, stored in `sponsor-logos` bucket). A preview is shown after upload.
   - **Active** — Toggle to show/hide on the site.
   - **Sort Order** — Numeric value to control display ordering within tiers.
