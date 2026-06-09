# Security Considerations

This app is designed as a lightweight, zero-server event tool for small Capoeira communities (50–200 participants). It makes deliberate trade-offs between simplicity and security. This document explains what's protected, what's not, and how to harden it if your event is larger or more exposed.

## Current Architecture

```
Browser ←→ Static HTML (Cloudflare Workers) ←→ S3-compatible storage
                                              ←→ PayPal (payment redirect)
```

There is **no backend server**. All logic runs in the browser. This means credentials embedded in the HTML are visible to anyone who views the page source.

---

## Known Security Limitations

### 🔴 Critical: S3 credentials are client-side

**What:** The S3 access key and secret key are embedded in the JavaScript. Anyone who opens DevTools can read them and write to your bucket.

**Impact:** A motivated person could overwrite admin state, delete photos, or upload junk files.

**Mitigation (recommended):**
- [ ] Put a Cloudflare Worker proxy in front of S3 writes. The Worker holds the secret key server-side and only allows:
  - PUT to `_state/` paths if the request includes the admin password
  - PUT to photo paths if the request includes a valid identity cookie
  - GET to any path (public read)
- Estimated effort: ~50 lines of Worker code, same Cloudflare free tier

**Mitigation (quick):**
- [ ] Use a separate S3 bucket with a write-only IAM policy for photo uploads, and a different bucket/credentials for admin state
- [ ] Enable S3 versioning so overwrites can be rolled back

---

### 🔴 Admin & door passwords are in plain text

**What:** `ADMIN_USER`, `ADMIN_PASS`, and `ADMIN_PASSWORD` (door) are visible in the HTML source.

**Impact:** Anyone who views source can log in to admin and change workshop assignments, or access the door check-in page.

**Mitigation (recommended):**
- [ ] Move admin authentication to a Cloudflare Worker that validates credentials server-side and returns a signed JWT or session cookie
- [ ] Serve the admin panel from a separate Worker route that requires authentication headers

**Mitigation (quick):**
- [ ] Change passwords right before the event and again after
- [ ] Use a long, random password — obscurity isn't security, but it raises the bar for casual snooping

---

### 🟡 PayPal payment is not server-verified

**What:** The app detects payment by checking if the return URL contains `?pass=confirmed`. PayPal redirects here after checkout, but anyone could manually visit this URL without paying.

**Impact:** Someone could register a party pass without paying.

**Mitigation (recommended):**
- [ ] Add PayPal IPN (Instant Payment Notification) or webhook verification via a Cloudflare Worker. On payment confirmation, the Worker writes the pass record to S3 — the client never writes payment status directly
- Estimated effort: ~100 lines of Worker code + PayPal developer account setup

**Mitigation (quick):**
- [ ] Cross-check the door list against your PayPal transaction history before the event
- [ ] The pre-registration step (email + apelido before redirect) creates a "pending" record, so you can spot entries that never went through PayPal

---

### 🟡 Email/identity is self-reported

**What:** The photo upload identity (apelido + group) and party pass registration (email + apelido) are entered by the user with no verification.

**Impact:** Someone could register under a fake name or someone else's email.

**Mitigation:**
- [ ] For party passes: send a confirmation email with a unique token (requires a backend/Worker)
- [ ] For photos: acceptable risk for a community event — the identity is for organization, not access control

---

### 🟡 No upload validation

**What:** The photo upload accepts any file the browser sends. There's no server-side check for file type, size, or content.

**Impact:** Someone could upload non-image files, very large files, or files with malicious names.

**Mitigation:**
- [ ] Add client-side file type and size validation (check MIME type + limit to ~10MB)
- [ ] Add a Cloudflare Worker that validates content-type before proxying the PUT to S3
- [ ] Set an S3 lifecycle policy to auto-delete objects over a certain size

---

### 🟢 Low risk: localStorage/cookie manipulation

**What:** Party pass status, admin state cache, and photo identity are stored in browser localStorage/cookies. A user could modify these locally.

**Impact:** They could fake a party pass badge on their own device, but the door page checks S3 (not their local state), so it doesn't bypass actual check-in.

**Mitigation:** No action needed — the S3 record is the source of truth for door staff.

---

## Hardening Roadmap (Priority Order)

| Priority | Task | Effort | Benefit |
|----------|------|--------|---------|
| 1 | Cloudflare Worker proxy for S3 writes | ~50 LOC | Hides S3 credentials from client |
| 2 | Server-side admin auth (JWT via Worker) | ~80 LOC | Passwords not in page source |
| 3 | PayPal webhook verification | ~100 LOC | Confirms real payments only |
| 4 | Upload file validation (client + Worker) | ~30 LOC | Prevents junk/oversized uploads |
| 5 | Email verification for passes | ~150 LOC | Prevents identity spoofing |

All mitigations use Cloudflare Workers (free tier, same account). No additional infrastructure needed.

---

## Reporting Issues

If you find a security vulnerability, please open a GitHub issue or contact the maintainer directly rather than exploiting it. This is a community tool built with good faith for Capoeira events.
