-- Migration: add split_mode column to bills
-- Each bill can be split "proportional" (by days stayed) or "equal" (50/50 regardless of days).
-- Existing bills default to "proportional" to preserve current behavior.

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS split_mode TEXT NOT NULL DEFAULT 'proportional'
    CHECK (split_mode IN ('proportional', 'equal'));
