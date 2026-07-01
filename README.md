# OrthoNow — Namoza Developer Assignment

**Role:** Developer — Position 1 (Client Web + Martech)  
**Client:** OrthoNow — 9 orthopaedic clinics across Bengaluru, Hyderabad, and Chennai  
**Agency:** Namoza Healthcare Growth & Strategy

---

## Repo Structure

```
Namoza-OrthoNow/
├── index.html                  # Task 02 — Landing page (single self-contained file)
├── styles.css                  # Mobile-first CSS, no frameworks
├── script.js                   # Form logic, Supabase, Resend, dataLayer, GTM events
├── assets/
│   └── favicon.svg             # Lightweight inline SVG favicon
├── docs/
│   ├── task1-gtm-schema.md     # Task 01 — Full GTM event schema + dataLayer JSON
│   ├── task3-integration.md    # Task 03 — CRM integration architecture writeup
│   └── architecture/
│       └── integration-flow.md # End-to-end integration diagram
└── README.md                   # This file
```

---

## Task 01 — GTM Event Schema

**File:** [`docs/task1-gtm-schema.md`](docs/task1-gtm-schema.md)

- Complete event schema for all OrthoNow interactions (12 events)
- 3-step booking form funnel tracking with actual dataLayer JSON (not pseudocode)
- GA4 Funnel Exploration setup instructions
- Recommended Google Ads conversion action with justification

---

## Task 02 — Landing Page Build

**File:** [`index.html`](index.html)

### Architecture

```
Browser
  └── index.html (HTML + inline critical CSS hint)
       ├── styles.css          (mobile-first layout, no frameworks)
       └── script.js           (all behaviour — form, tracking, API calls)
            ├── Supabase JS SDK (CDN, pinned version)
            │    └── INSERT into leads table
            ├── Resend API      (via fetch to /api/send — proxied or direct)
            └── window.dataLayer.push() → GTM → GA4 / Google Ads
```

### Form Flow

```
User fills Name + Phone + Clinic Preference
  → Client-side validation (Indian phone regex: /^[6-9]\d{9}$/)
  → Submit button disabled + spinner shown
  → Supabase INSERT (leads table)
  → Resend email confirmation to ops team
  → window.dataLayer.push({ event: 'consultation_form_submitted', ... })
  → Thank-you state revealed (no page reload)
  → Submit button re-enabled
```

### GTM Events Fired From This Page

| Event | When |
|---|---|
| `page_view` | On load |
| `cta_click` | Any CTA button click |
| `call_click` | Click-to-call tap |
| `whatsapp_click` | WhatsApp float button |
| `form_start` | First field interaction |
| `consultation_form_submitted` | Successful form submit |
| `validation_fail` | Client-side validation error |
| `scroll_depth` | At 25%, 50%, 75%, 90% |

### Performance Strategy

- Zero JavaScript frameworks — no React, no jQuery
- Supabase SDK loaded from CDN with `defer`
- Google Fonts preconnected and loaded with `font-display: swap`
- No images — trust elements built with CSS and text
- Inline critical CSS for above-the-fold content
- All non-critical JS deferred
- Target: **90+ PageSpeed Mobile**

### Accessibility

- Semantic HTML5 (`<main>`, `<section>`, `<header>`, `<footer>`, `<form>`)
- All inputs have associated `<label>` elements
- ARIA live region for form status messages
- Keyboard navigable — no mouse-only interactions
- Colour contrast ratio meets WCAG AA (4.5:1 minimum)
- Focus states visible on all interactive elements

### SEO

- `<title>` and `<meta name="description">` set
- Open Graph tags for social sharing
- Canonical URL tag
- `schema.org/MedicalOrganization` JSON-LD structured data

---

## Task 03 — Integration Architecture

**File:** [`docs/task3-integration.md`](docs/task3-integration.md)

Covers:
- End-to-end integration: Landing Page → Supabase → HubSpot → Karix WhatsApp → Google Ads
- Tool selection rationale (HubSpot direct API over Zapier/Make — with reasoning)
- **HubSpot phone deduplication trap** — flagged and solved
- Single biggest failure point + fallback design
- WhatsApp 2-minute SLA — what breaks it and how to monitor

---

## Environment Variables

Create a `.env` file (never commit this):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
RESEND_API_KEY=re_your_key
```

For the static landing page, these are injected at build time or set as Vercel environment variables. The anon key is safe to expose client-side (Supabase RLS handles row-level security).

---

## Supabase Table Schema

```sql
CREATE TABLE leads (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  clinic      TEXT NOT NULL,
  source      TEXT DEFAULT 'Google Ads - Consultation Landing Page',
  lead_status TEXT DEFAULT 'New Enquiry',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security: allow inserts from anon, no reads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon insert" ON leads FOR INSERT TO anon WITH CHECK (true);
```

---

## Deployment

Deployed on **Vercel** (static export).

```bash
# No build step needed — pure static files
# Connect GitHub repo to Vercel
# Set environment variables in Vercel dashboard
```

---

## Why Each Decision Was Made

| Decision | Reason |
|---|---|
| Vanilla JS, no framework | PageSpeed requirement, no build step, simpler maintenance |
| Supabase over Firebase | PostgreSQL gives structured queries, RLS for security, free tier generous |
| Resend over SendGrid | Simpler API, better deliverability for transactional, generous free tier |
| Direct HubSpot API over Zapier | No Zapier latency (~30s), no per-task billing, full control over dedup logic |
| Phone-only form (no email) | Indian healthcare lead gen — patients give phones, not emails |
| CSS custom properties | Easy theming, readable variables, no preprocessor needed |

---

## Future Improvements

- [ ] Add Edge Function on Supabase to handle HubSpot API call server-side (hide API key)
- [ ] OTP verification on phone number before form submit
- [ ] A/B test headline variants using URL params + dataLayer
- [ ] Clinic-specific landing page variants (9 clinics × 3 cities)
- [ ] Add `form_abandon` event on `beforeunload` if form started but not submitted
- [ ] Google Ads Enhanced Conversions — pass hashed phone to improve match rate

---

*Namoza Private Limited · namoza.com · namoza.ai*
