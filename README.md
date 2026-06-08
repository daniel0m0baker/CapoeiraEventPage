# Capoeira Event Web App

A mobile-first, single-file web application for managing Capoeira Batizado & Formatura events. Built for the community, by the community.

**Created by Daniel Baker (Mestre Soldado) · [Xará Capoeira Hamburg](https://xara-capoeira.com)**

![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)

## Features

- **6-language support** — EN 🇬🇧 / DE 🇩🇪 / PT 🇧🇷 / FR 🇫🇷 / NL 🇳🇱 / ES 🇲🇽
- **Full event schedule** with day labels, workshops, warmups, ceremony, and party
- **Workshop breakout grid** — 2×2 level cards (Beginner / Intermediate / Advanced / Professor+) with belt level indicators
- **Admin panel** — password-protected, editable teacher assignments, room allocations, and times
- **Real-time sync** — admin changes sync via S3 to all devices within 60 seconds
- **Party pass system** — email + apelido registration → PayPal checkout → S3-backed pass records
- **Door check-in page** — searchable guest list, tap-to-confirm check-in, manual cash-at-door add, auto-refresh
- **Photo upload** — direct browser-to-S3 upload with SigV4 signing (no server needed)
- **Photo gallery** — auto-rotating mosaic grid, pulls from S3, deduplicates across cells
- **Rank transition** — auto-updates displayed name at a configurable ceremony time (e.g. Contramestre → Mestre)
- **Zero server dependencies** — runs as static files on Cloudflare Workers (free tier)

## Architecture

```
index.html    — The complete event app (single file, ~540KB)
door.html     — Door staff check-in page (single file, ~23KB)
```

Both files are fully self-contained with embedded CSS and JS. No build step, no npm, no framework. Deploy by uploading to any static hosting.

### Storage

Uses any S3-compatible object storage (AWS S3, Cloudflare R2, Impossible Cloud, MinIO, etc.):

- `_state/ws_data.json` — Shared admin state (workshop assignments)
- `_state/passes/*.json` — Party pass records
- `{apelido}-{group}/*.jpg` — Uploaded event photos
- Gallery listing excludes `_state/` folder automatically

## Quick Start

1. **Clone this repo**
2. **Search for `YOUR_`** in both HTML files and fill in your values:
   - S3 access key + secret key
   - Admin password
   - Door staff password  
   - PayPal button ID
   - Contact email + phone
3. **Customize content**: event name, dates, locations, teachers, rooms, schedule
4. **Deploy**: upload both files to Cloudflare Workers, Cloudflare Pages, or any static host
5. **Set S3 CORS**: allow your domain for PUT/GET from the browser

## Customization Guide

| What | Where |
|------|-------|
| Event name & dates | Header section in HTML |
| Locations | `page-locations` section |
| Schedule | Language wrapper divs inside `s-schedule` |
| Teachers list | `<option>` tags in admin panel `<select>` elements |
| Rooms list | Room `<option>` tags in admin panel |
| Languages | Add `data-lang="xx"` spans + update `setLang()` labels/flags |
| Belt levels | `ws-level-years` content in each level row |
| Rank transition | `updateContactName()` threshold date |
| Brand colors | CSS variables: `--red`, `--black`, `--text`, `--surface` |

## Tech Stack

- Vanilla HTML / CSS / JS (no frameworks)
- AWS SigV4 signing in the browser (for S3 uploads and state sync)
- Cloudflare Workers (hosting)
- S3-compatible storage (state + photos)
- PayPal NCP (payment buttons)

## License

[CC BY-NC 4.0](LICENSE) — free to use, modify, and share for non-commercial purposes. Credit required.

---

*Built with axé for the global Capoeira community.* 🥋
