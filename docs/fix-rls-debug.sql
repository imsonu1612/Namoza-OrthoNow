-- DEBUG: Check actual table privileges and schema grants
-- Run this in Supabase SQL Editor

-- 1. Check what privileges anon has on the leads table
SELECT grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_name = 'leads' AND table_schema = 'public'
ORDER BY grantee, privilege_type;
