# DUET CSE Reunion Member Directory

A static, fast-loading member directory for DUET CSE Reunion 2025.

## Features

- Search by name, ID, organization, designation
- Filter by series, organization, and blood group
- Paginated card grid
- Modal ID card view
- Save member ID card as image
- Lazy-loaded member photos
- Cached profile data for faster repeat visits
- Vercel-ready routing and cache headers

## Project Structure

```text
reunion_output/
  profile.html
  vercel.json
  assests/
    profiles.json
    profiles.csv
    profiles.xlsx
    logo/
    photos/
  scripts/
    optimize_photos.py
    auto_compress_images.py
    requirements-optimize.txt
```

## Local Run

This is a static site. You can open `profile.html` directly, but using a local server is recommended.

### Option 1: Python server

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000/profile.html
```

## Image Optimization (Recommended Before Upload)

Install dependencies:

```bash
python -m pip install -r scripts/requirements-optimize.txt
```

Dry run:

```bash
python scripts/auto_compress_images.py --dry-run
```

Convert PNG to WebP (recommended):

```bash
python scripts/auto_compress_images.py
```

Convert and remove original PNG files:

```bash
python scripts/auto_compress_images.py --delete-original
```

Generate both WebP and AVIF:

```bash
python scripts/auto_compress_images.py --format both --prefer-format webp
```

## Deploy to GitHub and Vercel

### 1) Push to GitHub

```bash
git init
git add .
git commit -m "Initial DUET reunion directory"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 2) Import into Vercel

- Go to Vercel dashboard
- Add New Project
- Import your GitHub repository
- Framework Preset: Other
- Build Command: (leave empty)
- Output Directory: (leave empty)
- Deploy

`vercel.json` already rewrites `/` to `profile.html` and sets caching headers for assets.

## Custom Domain/Subdomain

Recommended subdomain:

```text
cse-alumni.yourdomain.com
```

After deployment, add this domain in Vercel Project Settings -> Domains and configure DNS as instructed by Vercel.

## Notes

- Keep `assests/profiles.json` in sync with image file extensions.
- If photo paths are changed to `.webp` or `.avif`, run the updater through the provided scripts.
- For best low-speed performance, prefer compressed WebP images and long cache lifetimes.
# cse-alumni
