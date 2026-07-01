-- FINAL FIX — Run this in Supabase SQL Editor

-- Drop the current policy
DROP POLICY IF EXISTS "allow_anon_insert" ON leads;

-- Grant INSERT permission to the anon role explicitly
GRANT INSERT ON leads TO anon;

-- Grant INSERT permission to authenticated role too (future-proofing)
GRANT INSERT ON leads TO authenticated;

-- Recreate policy explicitly targeting the anon role
CREATE POLICY "allow_anon_insert"
  ON leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Also allow authenticated users to insert (logged-in users)
CREATE POLICY "allow_authenticated_insert"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify
SELECT policyname, cmd, roles FROM pg_policies
WHERE tablename = 'leads' AND schemaname = 'public';
