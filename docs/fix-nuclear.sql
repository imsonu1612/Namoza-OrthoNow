-- NUCLEAR RESET — Run this entire block in Supabase SQL Editor

-- Step 1: Disable RLS completely
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop every policy by name (all we've created across attempts)
DROP POLICY IF EXISTS "anon_insert_leads"            ON leads;
DROP POLICY IF EXISTS "service_role_all"             ON leads;
DROP POLICY IF EXISTS "service_role_read"            ON leads;
DROP POLICY IF EXISTS "service_role_update"          ON leads;
DROP POLICY IF EXISTS "allow_insert_leads"           ON leads;
DROP POLICY IF EXISTS "allow_anon_insert"            ON leads;
DROP POLICY IF EXISTS "allow_authenticated_insert"   ON leads;

-- Step 3: Confirm zero policies remain
SELECT COUNT(*) AS remaining_policies
FROM pg_policies
WHERE tablename = 'leads' AND schemaname = 'public';

-- Step 4: Re-enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Step 5: Create ONE clean policy — USING and WITH CHECK both true
CREATE POLICY "leads_insert_open"
  ON leads
  AS PERMISSIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Step 6: Final verification
SELECT policyname, cmd, permissive, roles
FROM pg_policies
WHERE tablename = 'leads' AND schemaname = 'public';
