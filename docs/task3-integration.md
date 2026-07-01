# Task 03 — Integration Architecture
## OrthoNow Landing Page → CRM + WhatsApp + Google Ads

---

## End-to-End Architecture

**Chosen approach: Direct HubSpot Contacts API (not Zapier, not Make, not native embed)**

**Reason:** Zapier and Make introduce 15–30 second webhook delays which would immediately break the 2-minute WhatsApp SLA under any load. Native HubSpot embed cannot be used because we're collecting phone + clinic preference only — no email — and the native form requires email as a mandatory field. A direct API call from a Supabase Edge Function keeps latency under 300ms and gives us full control over the deduplication logic.

---

## Integration Flow (in order)

```
1. Patient submits form on landing page (Name, Phone, Clinic Preference)
       ↓
2. Browser: client-side validation (Indian phone regex, name required)
       ↓
3. Browser: window.dataLayer.push({ event: 'consultation_form_submitted', ... })
   → GTM picks this up → fires Google Ads conversion tag
   → GA4 receives conversion event
       ↓
4. Browser: fetch() POST to Supabase Edge Function (/functions/v1/handle-lead)
       ↓
5. Supabase Edge Function:
   a. INSERT into leads table (persistent record, audit trail)
   b. POST to HubSpot Contacts API → upsert contact
   c. POST to Karix WhatsApp API → send confirmation message
       ↓
6. Browser: show thank-you state (no reload)
```

---

## HubSpot Contact Upsert — Phone Deduplication

**This is the critical data model issue in this integration.**

HubSpot's default deduplication key is **email** — not phone. Our form does not collect email. If we use a naive `POST /crm/v3/objects/contacts` call, two patients submitting with the same phone number but different names will create **two duplicate contacts**. This is a real problem in Indian healthcare lead gen where patients often share a phone number (family member booking on behalf of someone else).

**Solution:** Use HubSpot's `POST /crm/v3/objects/contacts/search` to check for an existing contact with the matching phone number **before** creating a new one.

```
Step 1: Search HubSpot for existing contact by phone
  → POST /crm/v3/objects/contacts/search
  → filter: { propertyName: "phone", operator: "EQ", value: "+91XXXXXXXXXX" }

Step 2a: If contact found → PATCH /crm/v3/objects/contacts/{id}
  → Update: clinic_preference, lead_status = "New Enquiry", last_enquiry_date

Step 2b: If not found → POST /crm/v3/objects/contacts
  → Create: name, phone, source, lead_status = "New Enquiry", clinic_preference
```

This search-then-upsert pattern costs one extra API call but prevents duplicate contact pollution in the CRM. The phone property must be set as a **unique identifier** in HubSpot's property settings — this is not the default and must be configured manually in HubSpot Admin → Properties.

---

## Single Biggest Failure Point

**The Supabase Edge Function becomes a single point of failure for all three downstream actions.**

If the Edge Function throws (timeout, memory limit, HubSpot API rate limit), the patient gets no WhatsApp confirmation, no CRM record is created, and the ops team has no lead.

**Fallback design:**

1. **Database-first:** The Supabase `INSERT` into the `leads` table runs first, before any external API calls. Even if HubSpot and Karix both fail, the lead record exists in PostgreSQL with `crm_synced = false` and `whatsapp_sent = false`.

2. **Retry queue:** A Supabase scheduled function (pg_cron) runs every 5 minutes, queries `leads WHERE crm_synced = false`, and retries the HubSpot API call. Same for `whatsapp_sent = false`.

3. **Browser fallback:** If the Edge Function returns an error, the browser falls back to `FormSubmit.co` — a static form endpoint that emails the lead details to the ops team. The patient still sees the thank-you state. No lead is lost.

---

## WhatsApp 2-Minute SLA — What Breaks It

**What can break the SLA:**

1. **Karix API rate limiting or downtime** — Karix has documented rate limits; a burst of simultaneous submissions can queue messages beyond 2 minutes
2. **Edge Function cold start** — Supabase Edge Functions on the free tier can have 1–3 second cold starts; under load this compounds
3. **HubSpot API blocking the Edge Function** — if HubSpot search takes 5+ seconds (possible during their maintenance windows), the WhatsApp call happens late
4. **Template approval delays** — WhatsApp Business API messages require pre-approved templates; if the template status is `PENDING` or `REJECTED`, no message sends at all

**How to monitor:**

- Log `whatsapp_dispatched_at` timestamp in the `leads` table at the moment the Karix API call is made
- A Supabase dashboard query alerts if `(whatsapp_dispatched_at - created_at) > interval '2 minutes'`
- Set up a Karix webhook to receive delivery receipts; store `delivered_at` — this catches cases where the message was dispatched on time but not delivered (patient's phone off, WhatsApp not installed)
- Monthly SLA report: `AVG(whatsapp_dispatched_at - created_at)` grouped by day, flagging any day where P95 exceeds 90 seconds

---

*Task 03 complete.*
