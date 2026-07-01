-- ============================================================
-- COMPLETE RLS RESET FOR leads TABLE
-- Run this entire block in Supabase SQL Editor
-- ============================================================

-- Step 1: Disable RLS temporarily to see current state
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies (clean slate)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'leads' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON leads', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END;
$$;

-- Step 3: Re-enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Step 4: Create the correct INSERT policy
-- No TO clause = applies to ALL roles including anon
CREATE POLICY "allow_anon_insert"
  ON leads
  FOR INSERT
  WITH CHECK (true);

-- Step 5: Verify — should show 1 policy
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'leads' AND schemaname = 'public';
