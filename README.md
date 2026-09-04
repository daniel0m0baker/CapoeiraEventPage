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
| Languages | Add `data-lang="xx"` spans + add the code to the `LANGS` map (label + flag) |
| Belt levels | `ws-level-years` content in each level row |
| Rank transition | `updateContactName()` threshold date |
| Brand colors | CSS variables: `--red`, `--black`, `--text`, `--surface` |



## Publishing from a private copy

The public `index_opensource.html` is generated from a private `index.html` (not in this repo) that holds real S3 keys, the PayPal button ID and a Twemoji CDN call. Do not hand-edit the public file; mark the private parts and let `tools/strip.js` produce it.

1. **Mark private blocks** in the private file. Whole lines are removed, markers included, and a block may span many lines:

   ```html
   <!-- OSS-STRIP-START -->
   <script src="https://cdn.jsdelivr.net/npm/@twemoji/api@15/dist/twemoji.min.js"></script>
   <!-- OSS-STRIP-END -->
   ```

   ```js
   /* OSS-STRIP-START */
   twemoji.parse(document.body, { folder: 'svg', ext: '.svg' });
   /* OSS-STRIP-END */
   ```

2. **List token replacements** in `tools/strip.config.json` (`"replace": { "real value": "YOUR_PLACEHOLDER" }`). Strings in `"mustNotContain"` fail the run if they survive in the output.

3. **Generate the public file:**

   ```bash
   node tools/strip.js index.html index_opensource.html
   ```

   The script removes every marked block, applies the replacements, then runs `node --check` on each `<script>` block of the output and exits non-zero on a parse error, an unbalanced marker, or a leaked string.

4. **Run the self-test** (also useful after editing the script):

   ```bash
   node tools/strip.js --test
   ```

5. **Commit `index_opensource.html`.** The `check` workflow (`.github/workflows/check.yml`) repeats the `node --check` pass on every push and PR, warns about remaining `YOUR_` placeholders on branches, and fails on them for tags.

## Security & Roadmap

See **[SECURITY.md](SECURITY.md)** for a full breakdown of known limitations and how to harden the app.

### Feature Roadmap

Contributions welcome — pick an item and open a PR:

- [ ] **Cloudflare Worker proxy** — hide S3 credentials server-side (~50 LOC)
- [ ] **Server-side admin auth** — JWT-based login via Worker (~80 LOC)
- [ ] **PayPal webhook verification** — confirm payments server-side (~100 LOC)
- [ ] **Upload validation** — file type/size checks client + server (~30 LOC)
- [ ] **PWA support** — service worker for offline schedule access
- [ ] **Image compression** — resize photos client-side before upload
- [ ] **QR code check-in** — generate per-pass QR codes, scan at door
- [ ] **Multi-event support** — config file per event, same codebase
- [ ] **Dark mode** — respect `prefers-color-scheme`
- [ ] **Accessibility** — ARIA labels, keyboard navigation, screen reader support

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
