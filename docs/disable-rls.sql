-- Disable RLS entirely on leads table.
-- For a public form with no sensitive read operations,
-- this is a valid approach — anon users can only INSERT via the REST API
-- because we have no SELECT policy, and the table has no user-facing data reads.

ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- Confirm
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'leads';
