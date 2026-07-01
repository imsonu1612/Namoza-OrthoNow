# OrthoNow Integration Flow — Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PATIENT BROWSER                                  │
│                                                                          │
│  ┌──────────────────┐   submit    ┌──────────────────────────────────┐  │
│  │  Landing Page    │ ──────────► │         script.js                │  │
│  │  index.html      │             │                                  │  │
│  │                  │             │  1. Validate (phone regex)        │  │
│  │  Name            │             │  2. Disable submit button        │  │
│  │  Phone           │             │  3. POST → Supabase Edge Fn      │  │
│  │  Clinic Pref     │             │  4. dataLayer.push()             │  │
│  │                  │             │  5. Show thank-you state         │  │
│  └──────────────────┘             └──────────────────────────────────┘  │
│                                            │              │              │
└────────────────────────────────────────────┼──────────────┼──────────────┘
                                             │              │
                              POST /functions │              │ dataLayer.push
                              /v1/handle-lead │              │ {event: 'consultation
                                             │              │  _form_submitted'}
                                             ▼              ▼
┌────────────────────────┐         ┌─────────────────┐  ┌──────────────────────┐
│   SUPABASE             │         │   GTM           │  │   GOOGLE ADS         │
│                        │         │   Container     │  │                      │
│  Edge Function         │         │                 │  │  Conversion:         │
│  handle-lead           │         │  Custom Event   │  │  consultation_form   │
│                        │         │  Trigger fires  │  │  _submitted          │
│  ┌──────────────────┐  │         │       │         │  │                      │
│  │  PostgreSQL       │  │         └───────┼─────────┘  │  Smart Bidding       │
│  │  leads table      │  │                 │             │  trains toward real  │
│  │                   │  │                 ▼             │  form submitters     │
│  │  id               │  │         ┌─────────────────┐  └──────────────────────┘
│  │  name             │  │         │   GA4           │
│  │  phone            │  │         │                 │
│  │  clinic           │  │         │  Conversion     │
│  │  source           │  │         │  Event logged   │
│  │  lead_status      │  │         │                 │
│  │  crm_synced       │  │         │  Funnel         │
│  │  whatsapp_sent    │  │         │  Exploration    │
│  │  created_at       │  │         └─────────────────┘
│  └──────────────────┘  │
│           │             │
└───────────┼─────────────┘
            │
            │  Parallel API calls (Promise.allSettled)
            │
     ┌──────┴──────────────┐
     │                     │
     ▼                     ▼
┌──────────────┐   ┌───────────────────────────┐
│  HUBSPOT     │   │  KARIX (WhatsApp Business) │
│              │   │                            │
│  1. Search   │   │  POST /messages            │
│     contacts │   │  template: enquiry_confirm │
│     by phone │   │  to: +91XXXXXXXXXX         │
│              │   │                            │
│  2a. Found → │   │  Message fires within      │
│      PATCH   │   │  ~10 seconds of submit     │
│      contact │   │                            │
│              │   │  Delivery receipt webhook  │
│  2b. Not     │   │  → logs delivered_at       │
│      found → │   │    in Supabase             │
│      POST    │   └───────────────────────────┘
│      new     │
│      contact │
│              │
│  Properties: │
│  name        │
│  phone       │
│  clinic_pref │
│  source      │
│  lead_status │
└──────────────┘


FAILURE FALLBACK CHAIN
──────────────────────

Step 1: Edge Function fails entirely
  └► Browser falls back to FormSubmit.co POST
     └► Email delivered to ops team
     └► Lead not lost, CRM sync deferred

Step 2: HubSpot API fails / rate limited
  └► crm_synced = false in Supabase
  └► pg_cron job retries every 5 minutes
  └► Alert fires if unsynced > 30 minutes

Step 3: Karix API fails
  └► whatsapp_sent = false in Supabase
  └► pg_cron job retries every 5 minutes
  └► SLA monitor alerts if P95 dispatch > 90 seconds


WHATSAPP SLA MONITORING
───────────────────────

leads table timestamps:
  created_at             → form submitted
  whatsapp_dispatched_at → Karix API called
  whatsapp_delivered_at  → delivery receipt received

Alert query (runs every 15 min via pg_cron):
  SELECT COUNT(*) FROM leads
  WHERE whatsapp_sent = false
    AND created_at < NOW() - INTERVAL '3 minutes'
  → If count > 0: trigger Slack/email alert to ops
```
