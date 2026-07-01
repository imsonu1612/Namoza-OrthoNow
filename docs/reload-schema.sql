-- Force PostgREST to reload its schema cache
-- Run this in Supabase SQL Editor

NOTIFY pgrst, 'reload schema';
