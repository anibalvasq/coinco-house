-- ============================================================
-- Hogar Compartido — Initial Schema
-- Run via: supabase db push  OR paste into Supabase SQL editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Households ──────────────────────────────────────────────
CREATE TABLE households (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL DEFAULT 'Mi Hogar',
    accent_color    TEXT NOT NULL DEFAULT 'oklch(0.58 0.14 250)',
    split_rounding  TEXT NOT NULL DEFAULT 'exact'
                    CHECK (split_rounding IN ('exact', 'round100', 'round1000')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── People ──────────────────────────────────────────────────
CREATE TABLE people (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    color           TEXT NOT NULL DEFAULT 'oklch(0.58 0.14 250)',
    pin_hash        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_people_household ON people(household_id);

-- ── Categories ──────────────────────────────────────────────
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_household ON categories(household_id);

-- ── Bills ───────────────────────────────────────────────────
CREATE TABLE bills (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    month_key       TEXT NOT NULL,  -- 'YYYY-MM'
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
    name            TEXT NOT NULL DEFAULT '',
    amount          NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    date            DATE NOT NULL,
    note            TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bills_household_month ON bills(household_id, month_key);

-- ── Month Stays ─────────────────────────────────────────────
CREATE TABLE month_stays (
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    month_key       TEXT NOT NULL,  -- 'YYYY-MM'
    person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    days            INT NOT NULL DEFAULT 0 CHECK (days >= 0 AND days <= 31),
    PRIMARY KEY (household_id, month_key, person_id)
);

CREATE INDEX idx_stays_household_month ON month_stays(household_id, month_key);
