import type { DbClient } from '../drizzle.provider';
import { communes, districts, provinces } from '../schema/users.schema';
import dataset from './data/cambodia-geography.json';

/**
 * Cambodian administrative geography — provinces → districts → communes.
 *
 * Source of truth: `data/cambodia-geography.json`, generated from the
 * NCDD-derived gazetteer (https://github.com/NorakGithub/cambodia-gazetteer,
 * MIT — itself derived from db.ncdd.gov.kh), cross-checked against the MEF open
 * data "Cambodia District List 2025" (data.mef.gov.kh). Villages are not
 * included; the file carries official administrative codes for provenance only
 * (the tables store name + name_km + slug).
 *
 * Conventions (see the file's own `slug`/`name` fields — they are pre-computed):
 *  - province slugs follow the DB's existing scheme (`tbong-khmum`, not
 *    `tboung-khmum`; `siem-reap`; `mondulkiri`), because live listings reference
 *    them;
 *  - district slugs are bare names (`battambang`, not `krong-battambang`),
 *    matching the rows that were seeded before this change;
 *  - commune slugs are unique within their district.
 *
 * Idempotent: every level upserts on its natural key (province slug;
 * (province_id, slug) for districts — (district_id, slug) for communes), so
 * re-running updates names in place and never duplicates. Rows that cannot be
 * mapped are logged as warnings, never dropped silently.
 */

interface SeedCommune {
  name: string;
  nameKm: string;
  code: string;
  slug: string;
}

interface SeedDistrict {
  name: string;
  nameKm: string;
  code: string;
  slug: string;
  communes: SeedCommune[];
}

interface SeedProvince {
  key: string;
  slug: string;
  name: string;
  nameKm: string;
  code: string;
  districts: SeedDistrict[];
}

const DATA = dataset as {
  meta: { source: string; retrieved: string };
  provinces: SeedProvince[];
};

export async function seedGeography(db: DbClient): Promise<void> {
  const warnings: string[] = [];

  const expected = {
    provinces: DATA.provinces.length,
    districts: DATA.provinces.reduce((n, p) => n + p.districts.length, 0),
    communes: DATA.provinces.reduce(
      (n, p) => n + p.districts.reduce((m, d) => m + d.communes.length, 0),
      0,
    ),
  };

  for (const province of DATA.provinces) {
    if (!province.slug || !province.name) {
      warnings.push(
        `province "${province.key}": missing slug or name — skipped`,
      );
      continue;
    }

    const [provinceRow] = await db
      .insert(provinces)
      .values({
        name: province.name,
        nameKm: province.nameKm || null,
        slug: province.slug,
      })
      .onConflictDoUpdate({
        target: provinces.slug,
        set: { name: province.name, nameKm: province.nameKm || null },
      })
      .returning({ id: provinces.id });

    if (!provinceRow) {
      warnings.push(`province "${province.slug}": upsert returned no row`);
      continue;
    }

    for (const district of province.districts) {
      if (!district.slug || !district.name) {
        warnings.push(
          `district "${district.code}" in ${province.slug}: missing slug or name — skipped`,
        );
        continue;
      }

      const [districtRow] = await db
        .insert(districts)
        .values({
          provinceId: provinceRow.id,
          name: district.name,
          nameKm: district.nameKm || null,
          slug: district.slug,
        })
        .onConflictDoUpdate({
          target: [districts.provinceId, districts.slug],
          set: { name: district.name, nameKm: district.nameKm || null },
        })
        .returning({ id: districts.id });

      if (!districtRow) {
        warnings.push(
          `district "${district.slug}" (${province.slug}): upsert returned no row`,
        );
        continue;
      }

      for (const commune of district.communes) {
        if (!commune.slug || !commune.name) {
          warnings.push(
            `commune "${commune.code}" in ${province.slug}/${district.slug}: missing slug or name — skipped`,
          );
          continue;
        }

        await db
          .insert(communes)
          .values({
            districtId: districtRow.id,
            name: commune.name,
            nameKm: commune.nameKm || null,
            slug: commune.slug,
          })
          .onConflictDoUpdate({
            target: [communes.districtId, communes.slug],
            set: { name: commune.name, nameKm: commune.nameKm || null },
          });
      }
    }
  }

  // Verify against the source tallies rather than trusting the loop.
  const [provinceRows, districtRows, communeRows] = await Promise.all([
    db.select({ id: provinces.id }).from(provinces),
    db.select({ id: districts.id }).from(districts),
    db.select({ id: communes.id }).from(communes),
  ]);

  const actual = {
    provinces: provinceRows.length,
    districts: districtRows.length,
    communes: communeRows.length,
  };

  console.log(
    `  ✓ geography: ${actual.provinces} provinces (source ${expected.provinces}), ` +
      `${actual.districts} districts (source ${expected.districts}), ` +
      `${actual.communes} communes (source ${expected.communes})`,
  );

  const mismatches = (
    Object.keys(expected) as (keyof typeof expected)[]
  ).filter((level) => actual[level] !== expected[level]);
  if (mismatches.length > 0) {
    console.warn(
      `  ⚠ geography count mismatch in: ${mismatches.join(', ')} — ` +
        'the DB has rows the source file does not (left in place, nothing deleted)',
    );
  }

  if (warnings.length > 0) {
    console.warn(`  ⚠ ${warnings.length} geography row(s) not mapped:`);
    for (const warning of warnings.slice(0, 20))
      console.warn(`      ${warning}`);
    if (warnings.length > 20) {
      console.warn(`      … and ${warnings.length - 20} more`);
    }
  } else {
    console.log('  ✓ geography: every source row mapped, no warnings');
  }
}
