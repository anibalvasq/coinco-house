-- Migration: add fixed flag to bills (fixed vs variable expense type)
-- Default false = variable.

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS fixed BOOLEAN NOT NULL DEFAULT false;
