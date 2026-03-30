# DUET Reunion 2025 Member Directory

A static web directory for DUET CSE reunion members.

This project loads member data from `assests/profiles.json`, shows searchable/filterable profile cards, and opens a modal ID card view that can be exported as PNG.

## Project Summary

- App type: Single-page static site (HTML + CSS + JavaScript)
- Main page: `profile.html`
- Data source: `assests/profiles.json`
- Deploy target: Vercel (configured with `vercel.json`)
- Image assets: `assests/photos/` and `assests/logo/`

## Current Workspace Analysis

Based on the current folder contents:

- Member records in JSON: **922**
- Member records in CSV: **922**
- Files in `assests/photos`: **1162**
- Files in `assests/logo`: **2**
- Lines in `profile.html`: **1236**

## Features

- Fast search by name, ID, organization, designation, etc.
- Filters:
  - Series filter chips (auto-generated from IDs)
  - Organization filter (datalist input)
  - Blood group chips
- Paginated card grid (20 members per page)
- Modal ID card view for each member
- PNG export of ID card using `dom-to-image`
- LocalStorage cache for profile data (12-hour TTL)
- Skeleton loading UI and empty-state handling

## Folder Structure

```text
reunion_output/
├─ profile.html
├─ vercel.json
├─ .gitignore
└─ assests/
   ├─ profiles.json
   ├─ profiles.csv
   ├─ profiles.xlsx
   ├─ logo/
   │  ├─ duet.png
   │  └─ cse.jpg
   └─ photos/
      └─ ... (member photos)
```

## Important Note About Path Name

The project uses the folder name `assests` (not `assets`) in:

- HTML preload/fetch
- Image URLs
- Vercel cache headers

Do not rename this folder unless you also update all references.

## Data Schema

The app expects member objects with fields like:

- `Name`
- `Email`
- `Mobile`
- `ID`
- `Blood`
- `Designation`
- `Organization`
- `photo`

Example:

```json
{
  "Name": "Member Name",
  "Email": "member@example.com",
  "Mobile": "017XXXXXXXX",
  "ID": "2201234",
  "Blood": "A+",
  "Designation": "Software Engineer",
  "Organization": "Example Corp",
  "photo": "assests/photos/p022_x363.png"
}
```

## Run Locally

Since this is a static project, you can run it with any local web server.

### Option 1: Python

```bash
python -m http.server 8000
```

Then open:

- http://localhost:8000/profile.html

### Option 2: VS Code Live Server

- Open the folder in VS Code
- Start Live Server from `profile.html`

## Deployment (Vercel)

`vercel.json` currently:

- Rewrites `/` to `/profile.html`
- Enables clean URLs
- Applies long cache headers to logos/photos
- Applies short revalidation cache for `profiles.json` and `profile.html`

Deploy steps:

1. Push this repository to GitHub (or import local folder).
2. Create/import project in Vercel.
3. Deploy with default static settings.

## Data Update Workflow

1. Update source data in `assests/profiles.xlsx` or `assests/profiles.csv`.
2. Export/update `assests/profiles.json` with matching fields.
3. Add/update photos inside `assests/photos/`.
4. Ensure each `photo` path in JSON is valid.
5. Redeploy.

## Troubleshooting

- If page shows `profiles.json not found`:
  - Confirm `assests/profiles.json` exists.
  - Serve through HTTP (not directly opening file with `file://`).
- If photos do not load:
  - Check `photo` values and file extensions.
  - Confirm files exist under `assests/photos/`.
- If filters look incomplete:
  - Verify `ID` values begin with two-digit series numbers.

## Credits

- Directory and ID card interface: Project author
- Footer credit in app: Mohatamim
