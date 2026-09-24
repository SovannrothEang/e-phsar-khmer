-- One-time data fix: free the slugs held by the "+" model variants.
--
-- `seedModels` slugified "Galaxy S25+" to `galaxy-s25` — identical to plain
-- "Galaxy S25" — and because the seed lists the "+" entry first, IT won the
-- slug and the PLAIN model was silently dropped by onConflictDoNothing. So the
-- database holds a row named "Galaxy S25+" at slug `galaxy-s25`, and Galaxy
-- S21/S22/S23/S24/S25 (no plus) are missing entirely.
--
-- The seed's slugify now spells "+" as `-plus`. This renames the rows that
-- already claimed the bare slugs so the seed's next run can insert the base
-- models. Same reasoning for `realme-12-pro` ("Realme 12 Pro+"), which would
-- otherwise collide the moment a plain "Realme 12 Pro" is added.
--
-- No-op on a fresh database (the table is empty when migrations run, and the
-- fixed slugify creates the right slugs from the start).
UPDATE "models" m
SET "slug" = m."slug" || '-plus'
FROM "brands" b
WHERE m."brand_id" = b."id"
  AND m."name" LIKE '%+'
  AND m."slug" NOT LIKE '%-plus';
