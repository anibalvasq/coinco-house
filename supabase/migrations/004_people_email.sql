-- Migration: add optional email column to people
-- Used to send weekly and monthly cost-split reports.

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS email TEXT;
