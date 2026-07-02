-- ============================================================
-- Development seed: one household + 2 demo people + 5 categories
-- PIN for both users: 1234  (bcrypt hash of '1234')
-- Run manually in dev/local only — NOT in production
-- ============================================================

DO $$
DECLARE
    hh_id UUID := gen_random_uuid();
    p1_id UUID := gen_random_uuid();
    p2_id UUID := gen_random_uuid();
    c1_id UUID := gen_random_uuid();
    c2_id UUID := gen_random_uuid();
    c3_id UUID := gen_random_uuid();
    c4_id UUID := gen_random_uuid();
    c5_id UUID := gen_random_uuid();
BEGIN
    -- Household
    INSERT INTO households (id, name) VALUES (hh_id, 'Mi Hogar');

    -- People (PIN 1234 → bcrypt hash — regenerate with backend if changing PIN)
    -- The hash below is a valid bcrypt hash of '1234'. Replace at first login if desired.
    INSERT INTO people (id, household_id, name, color, pin_hash) VALUES
        (p1_id, hh_id, 'Juan',      'oklch(0.58 0.14 250)', '$2b$12$jkb2UdTJ5eVqFPj4q6g7.OJRr4Iq0k0CL.iyNkpfF0DIXhg5S5jBO'),
        (p2_id, hh_id, 'Valentina', 'oklch(0.62 0.15 40)',  '$2b$12$jkb2UdTJ5eVqFPj4q6g7.OJRr4Iq0k0CL.iyNkpfF0DIXhg5S5jBO');

    -- Default categories
    INSERT INTO categories (id, household_id, name, sort_order) VALUES
        (c1_id, hh_id, 'Luz',      0),
        (c2_id, hh_id, 'Agua',     1),
        (c3_id, hh_id, 'Internet', 2),
        (c4_id, hh_id, 'Comida',   3),
        (c5_id, hh_id, 'Gas',      4);

    -- Sample bills for current month (adjust date if needed)
    INSERT INTO bills (household_id, month_key, category_id, name, amount, date) VALUES
        (hh_id, to_char(now(), 'YYYY-MM'), c1_id, '', 45000, date_trunc('month', now()) + interval '4 days'),
        (hh_id, to_char(now(), 'YYYY-MM'), c3_id, '', 25000, date_trunc('month', now()) + interval '7 days'),
        (hh_id, to_char(now(), 'YYYY-MM'), c4_id, '', 80000, date_trunc('month', now()) + interval '11 days');

    -- Sample stays for current month
    INSERT INTO month_stays (household_id, month_key, person_id, days) VALUES
        (hh_id, to_char(now(), 'YYYY-MM'), p1_id, 18),
        (hh_id, to_char(now(), 'YYYY-MM'), p2_id, 30);

    RAISE NOTICE 'Seed complete. Household ID: %', hh_id;
    RAISE NOTICE 'Set HOUSEHOLD_ID=% in your .env', hh_id;
END $$;
