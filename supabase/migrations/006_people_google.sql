-- Migration: Google Sign-In support
-- Links a Google account (sub) to a household person; email match is used on first login.

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_people_google_sub
  ON people (google_sub)
  WHERE google_sub IS NOT NULL;

-- One email per household so Google login can resolve a single person
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_household_email
  ON people (household_id, lower(email))
  WHERE email IS NOT NULL;
