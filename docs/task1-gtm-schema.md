# Task 01 — GTM Event Schema
## OrthoNow — Full Event Tracking Before Paid Campaigns Go Live

---

## 1. Complete Event Schema

| # | Event Name | Trigger Type | Key Parameters | GA4 Report / Audience |
|---|---|---|---|---|
| 1 | `page_view` | GTM — All Pages (Page View trigger) | `page_title`, `page_path`, `page_location` | Engagement → Pages & Screens. Baseline for all session analysis. |
| 2 | `booking_step_complete` | Custom Event — dataLayer push (front-end dev required) | `step_number`, `step_name`, `clinic_location`, `specialty` | Funnel Exploration (4-step). Audience: Booking Starters (step 1 reached, step 3 not). |
| 3 | `call_click` | Click trigger — CSS selector `a[href^="tel:"]` | `click_location`, `clinic_name`, `page_path` | Engagement → Events. Audience: High-Intent — called but didn't book online. |
| 4 | `whatsapp_click` | Click trigger — CSS selector `a[href*="wa.me"]` | `click_location`, `page_path`, `timestamp` | Engagement → Events. Audience: WhatsApp Engagers (RLSA). |
| 5 | `guide_download_start` | Custom Event — dataLayer push when gate form appears | `form_name`, `page_path`, `timestamp` | Engagement → Events. Measures interest before commitment. |
| 6 | `guide_download_complete` | Custom Event — dataLayer push on successful gate submit | `form_name`, `page_path`, `phone_hashed` | Conversions. Audience: Guide Downloaders — warm remarketing list. |
| 7 | `clinic_page_view` | Page View trigger — URL contains `/clinic/` | `clinic_name`, `clinic_city`, `page_path` | Engagement → Pages. Audience: Clinic Interest by City — for geo-targeted campaigns. |
| 8 | `scroll_depth` | Scroll Depth trigger — thresholds 25, 50, 75, 90 | `scroll_threshold`, `page_path`, `page_title` | Engagement → Events. Content quality signal. Used to qualify blog readers. |
| 9 | `blog_read_complete` | Scroll Depth trigger — 90% on URLs matching `/blog/*` | `article_title`, `article_category`, `page_path` | Engagement. Audience: Blog Readers — lower-funnel remarketing. |
| 10 | `cta_click` | Click trigger — CSS class `.cta-btn` | `cta_text`, `cta_location`, `page_path` | Engagement → Events. Intent signal; used to build mid-funnel audience. |
| 11 | `consultation_form_submitted` | Custom Event — dataLayer push on confirmed API success | `form_name`, `clinic_preference`, `page_path`, `timestamp` | **Primary conversion.** Marked as conversion in GA4. Imported to Google Ads for Smart Bidding. |
| 12 | `form_validation_error` | Custom Event — dataLayer push on client-side validation fail | `field_name`, `error_type`, `form_name` | Debugging view. Surfaces which fields cause friction — input for UX fixes. |

---

## 2. Booking Form Funnel — Step-Level Drop-Off Tracking

### The core problem GTM cannot solve on its own

GTM has no visibility into multi-step form state. When a user moves from Step 1 to Step 2, nothing in the DOM triggers automatically that GTM can detect reliably across browsers. GTM only knows what it's explicitly told.

The only correct solution is for the **front-end developer** to push an event to `window.dataLayer` at each step transition. GTM listens for that event name and fires the corresponding GA4 tag. Without those pushes, there is no funnel data.

---

### GTM setup — triggers and variables

**Data Layer Variables to create in GTM:**

| Variable Name | Variable Type | Data Layer Key |
|---|---|---|
| `DLV - step_number` | Data Layer Variable | `step_number` |
| `DLV - step_name` | Data Layer Variable | `step_name` |
| `DLV - clinic_location` | Data Layer Variable | `clinic_location` |
| `DLV - specialty` | Data Layer Variable | `specialty` |
| `DLV - preferred_date` | Data Layer Variable | `preferred_date` |
| `DLV - booking_id` | Data Layer Variable | `booking_id` |

**Trigger configuration per step:**

| Step | Trigger Type | Condition |
|---|---|---|
| Step 1 complete | Custom Event | Event name = `booking_step_complete` AND `{{DLV - step_number}}` = `1` |
| Step 2 complete | Custom Event | Event name = `booking_step_complete` AND `{{DLV - step_number}}` = `2` |
| Step 3 complete | Custom Event | Event name = `booking_step_complete` AND `{{DLV - step_number}}` = `3` |

Each trigger fires one GA4 event tag. All three tags send the same event name (`booking_step_complete`) — GA4 uses the `step_number` parameter to distinguish them in Funnel Exploration.

---

### dataLayer push — Step 1: Clinic location and specialty selected

**When the front-end dev calls this:** On click of the "Next" button, *after* client-side validation confirms both the clinic location dropdown and specialty dropdown have values. If either field is empty, validate first — do not push.

```json
{
  "event": "booking_step_complete",
  "step_number": 1,
  "step_name": "location_specialty_selected",
  "clinic_location": "Koramangala, Bengaluru",
  "specialty": "Knee Pain",
  "timestamp": "2025-07-01T10:30:00.000Z"
}
```

---

### dataLayer push — Step 2: Patient details entered

**When the front-end dev calls this:** On click of "Next", after name, phone, and preferred date pass validation. Do not push on button click — push only when all three fields are valid.

PII rule: name and phone number must **not** appear in the dataLayer. `preferred_date` is safe to include — it is not personally identifiable.

```json
{
  "event": "booking_step_complete",
  "step_number": 2,
  "step_name": "patient_details_entered",
  "clinic_location": "Koramangala, Bengaluru",
  "specialty": "Knee Pain",
  "preferred_date": "2025-07-05",
  "timestamp": "2025-07-01T10:31:45.000Z"
}
```

---

### dataLayer push — Step 3: Booking confirmed

**When the front-end dev calls this:** On confirmed API success response — not on button click. If the API returns an error, this push does not fire. A booking ID only exists once the backend has created the record.

```json
{
  "event": "booking_step_complete",
  "step_number": 3,
  "step_name": "booking_confirmed",
  "clinic_location": "Koramangala, Bengaluru",
  "specialty": "Knee Pain",
  "booking_id": "ORN-2025-00142",
  "timestamp": "2025-07-01T10:32:10.000Z"
}
```

---

### How to surface drop-off in GA4 Funnel Exploration

1. GA4 → Explore → Funnel Exploration → New report
2. Set funnel type to **Open** (patients can land directly on step 2 via deep link)
3. Add steps in this order:

| Funnel Step | Event | Filter Condition |
|---|---|---|
| Step 1 | `booking_step_complete` | `step_number` = `1` |
| Step 2 | `booking_step_complete` | `step_number` = `2` |
| Step 3 | `booking_step_complete` | `step_number` = `3` |
| Conversion | `consultation_form_submitted` | *(no filter)* |

4. Apply breakdown dimension: **`clinic_location`**
   - This shows which clinic has the highest drop-off at each step. A clinic with 60% step 1 → step 2 drop-off likely has a date availability problem, not a copy problem.

5. Apply breakdown dimension: **`specialty`**
   - If "Back Pain" drops off at step 2 more than "Knee Pain", the intake questions for that specialty may be too complex.

6. Set the date range to rolling 28 days. Shorter windows have too few bookings to be statistically meaningful for an orthopaedic clinic.

The funnel will show exactly three failure points: Step 1→2 (form friction or wrong clinic options), Step 2→3 (date unavailability or form length), Step 3→confirmation (intent drop or technical error).

---

## 3. Briefing the front-end developer

The dataLayer pushes in section 2 are not something GTM writes or injects. They are JavaScript calls that the front-end developer writes into the booking form component. Here is how I would brief the dev team for Step 2 specifically.

---

**Dev brief — Step 2 dataLayer push**

> **Context:** We need to track when a user successfully completes Step 2 of the booking form (name, phone, preferred date). This data feeds into GA4 Funnel Exploration so the marketing team can see where patients drop off.
>
> **What you need to add:**
>
> After the user clicks "Next" on Step 2 and all three fields pass your existing client-side validation, add this call before you transition the UI to Step 3:
>
> ```javascript
> window.dataLayer = window.dataLayer || [];
> window.dataLayer.push({
>   event:          'booking_step_complete',
>   step_number:    2,
>   step_name:      'patient_details_entered',
>   clinic_location: selectedClinic,   // string — carry forward from Step 1
>   specialty:       selectedSpecialty, // string — carry forward from Step 1
>   preferred_date:  preferredDateValue // string — 'YYYY-MM-DD' format
> });
> ```
>
> **Important:**
> - Do NOT include `name` or `phone` in this push. They are PII and must not enter the analytics pipeline.
> - Only push after validation passes. If the user hits Next with an empty field and you show an error, this push should not fire.
> - `clinic_location` and `specialty` come from Step 1. Hold them in component state so they're available here.
>
> **How to verify it's working:** Open DevTools → Console → type `window.dataLayer` after completing Step 2. You should see the object above as the most recent entry in the array.
>
> **GTM does the rest.** Once this push fires, GTM picks up the `booking_step_complete` event name and sends it to GA4 with the step parameters. You don't need to touch GTM.

---

## 4. Recommended Google Ads conversion action

**Import: `consultation_form_submitted`**

This is the only event in the schema that represents a completed, actionable lead — a patient who has provided their name, phone number, and clinic preference, and whose record has been created in the backend. It is the closest available proxy to booked revenue.

**Why not the alternatives:**

| Event | Why it's the wrong conversion signal |
|---|---|
| `cta_click` | A click is intent, not commitment. Optimising Smart Bidding on clicks trains Google to find users who click, not users who complete. |
| `call_click` | Valuable, but attribution is broken without call tracking software. A click does not mean a connected call. |
| `booking_step_complete` (step 1 or 2) | Mid-funnel signal. Training Smart Bidding on step 1 completion optimises for users who start forms, which is a much wider and less qualified pool. |
| `whatsapp_click` | Opens a chat thread. The patient may close it immediately. No confirmed intent. |
| `blog_read_complete` | Top-of-funnel content consumption. Zero commercial signal. |

**Import method:**
1. In GA4 → Admin → Events → find `consultation_form_submitted` → toggle "Mark as conversion"
2. In Google Ads → Tools → Conversions → New conversion action → Import from GA4
3. Select `consultation_form_submitted`
4. Set conversion window: **7 days** (orthopaedic appointments are typically decided within a week of first click — longer windows inflate reported conversions with low-intent users)
5. Set attribution model: **Data-driven** if the account has enough conversion volume; otherwise **Last click**

**Enhanced Conversions note:** Since OrthoNow collects phone but not email, pass `sha256(phone_number)` as `user_data.phone_number` in the `consultation_form_submitted` dataLayer push. This improves match rate on Google's side, which is meaningful in India where email collection rates on healthcare forms are low.

---

*Task 01 complete. The dataLayer pushes for the booking form are implemented in `script.js`. The `consultation_form_submitted` push in `script.js` matches the schema defined here.*
