-- OrthoNow — Supabase PostgreSQL Schema
-- Run this in the Supabase SQL Editor to set up the leads table

-- ============================================================
-- leads table
-- Stores every consultation form submission as a permanent record.
-- This is the source of truth — exists before any external API calls.
-- ============================================================

CREATE TABLE IF NOT EXISTS leads (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    TEXT NOT NULL,
  phone                   TEXT NOT NULL,
  clinic                  TEXT NOT NULL,
  source                  TEXT DEFAULT 'Google Ads - Consultation Landing Page',
  lead_status             TEXT DEFAULT 'New Enquiry',
  crm_synced              BOOLEAN DEFAULT FALSE,
  whatsapp_sent           BOOLEAN DEFAULT FALSE,
  whatsapp_dispatched_at  TIMESTAMPTZ,
  whatsapp_delivered_at   TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Index on phone for fast deduplication lookups from the Edge Function
CREATE INDEX IF NOT EXISTS leads_phone_idx ON leads (phone);

-- Index on crm_synced for the retry pg_cron job
CREATE INDEX IF NOT EXISTS leads_crm_synced_idx ON leads (crm_synced) WHERE crm_synced = FALSE;

-- Index on whatsapp_sent for the WhatsApp retry job
CREATE INDEX IF NOT EXISTS leads_wa_sent_idx ON leads (whatsapp_sent) WHERE whatsapp_sent = FALSE;

-- ============================================================
-- Row Level Security
-- Anonymous users (browser) can INSERT but cannot SELECT any rows.
-- Service role key (Edge Function) can do everything.
-- ============================================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running this script
DROP POLICY IF EXISTS "anon_insert_leads" ON leads;
DROP POLICY IF EXISTS "service_role_all" ON leads;

-- Allow the browser (anon key) to insert leads.
-- WITH CHECK (true) means any insert from anon role is permitted.
-- The anon role is what the Supabase JS SDK uses when only the anon key is provided.
CREATE POLICY "anon_insert_leads"
  ON leads
  FOR INSERT
  WITH CHECK (true);

-- Only service_role can read rows (phone numbers are PII)
CREATE POLICY "service_role_read"
  ON leads
  FOR SELECT
  TO service_role
  USING (true);

-- Service role can update (for retry queue / crm_synced flag)
CREATE POLICY "service_role_update"
  ON leads
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- WhatsApp SLA Monitoring Query
-- Run via pg_cron every 15 minutes:
--   SELECT COUNT(*) FROM leads
--   WHERE whatsapp_sent = FALSE
--     AND created_at < NOW() - INTERVAL '3 minutes'
-- If count > 0, trigger alert.
-- ============================================================

-- ============================================================
-- Retry Queue View (for ops dashboard)
-- ============================================================
CREATE OR REPLACE VIEW pending_sync AS
  SELECT id, name, phone, clinic, created_at,
         crm_synced, whatsapp_sent
  FROM leads
  WHERE crm_synced = FALSE OR whatsapp_sent = FALSE
  ORDER BY created_at ASC;
