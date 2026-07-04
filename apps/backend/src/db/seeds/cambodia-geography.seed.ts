import { and, eq } from 'drizzle-orm';
import type { DbClient } from '../drizzle.provider';
import { provinces, districts } from '../schema/users.schema';

export const PROVINCES: { name: string; slug: string }[] = [
  { name: 'Banteay Meanchey', slug: 'banteay-meanchey' },
  { name: 'Battambang', slug: 'battambang' },
  { name: 'Kampong Cham', slug: 'kampong-cham' },
  { name: 'Kampong Chhnang', slug: 'kampong-chhnang' },
  { name: 'Kampong Speu', slug: 'kampong-speu' },
  { name: 'Kampong Thom', slug: 'kampong-thom' },
  { name: 'Kampot', slug: 'kampot' },
  { name: 'Kandal', slug: 'kandal' },
  { name: 'Kep', slug: 'kep' },
  { name: 'Koh Kong', slug: 'koh-kong' },
  { name: 'Kratié', slug: 'kratie' },
  { name: 'Mondulkiri', slug: 'mondulkiri' },
  { name: 'Oddar Meanchey', slug: 'oddar-meanchey' },
  { name: 'Pailin', slug: 'pailin' },
  { name: 'Phnom Penh', slug: 'phnom-penh' },
  { name: 'Preah Vihear', slug: 'preah-vihear' },
  { name: 'Prey Veng', slug: 'prey-veng' },
  { name: 'Pursat', slug: 'pursat' },
  { name: 'Ratanakiri', slug: 'ratanakiri' },
  { name: 'Siem Reap', slug: 'siem-reap' },
  { name: 'Preah Sihanouk', slug: 'preah-sihanouk' },
  { name: 'Stung Treng', slug: 'stung-treng' },
  { name: 'Svay Rieng', slug: 'svay-rieng' },
  { name: 'Takéo', slug: 'takeo' },
  { name: 'Tbong Khmum', slug: 'tbong-khmum' },
];

export const DISTRICTS: { provinceSlug: string; name: string; slug: string }[] =
  [
    {
      provinceSlug: 'banteay-meanchey',
      name: 'Serei Saophoan',
      slug: 'serei-saophoan',
    },
    { provinceSlug: 'battambang', name: 'Battambang', slug: 'battambang' },
    {
      provinceSlug: 'kampong-cham',
      name: 'Kampong Cham',
      slug: 'kampong-cham',
    },
    {
      provinceSlug: 'kampong-chhnang',
      name: 'Kampong Chhnang',
      slug: 'kampong-chhnang',
    },
    { provinceSlug: 'kampong-speu', name: 'Chbar Mon', slug: 'chbar-mon' },
    {
      provinceSlug: 'kampong-thom',
      name: 'Stueng Saen',
      slug: 'stueng-saen',
    },
    { provinceSlug: 'kampot', name: 'Kampot', slug: 'kampot' },
    { provinceSlug: 'kandal', name: 'Ta Khmau', slug: 'ta-khmau' },
    { provinceSlug: 'kep', name: 'Kep', slug: 'kep' },
    {
      provinceSlug: 'koh-kong',
      name: 'Khemarak Phoumin',
      slug: 'khemarak-phoumin',
    },
    { provinceSlug: 'kratie', name: 'Kratié', slug: 'kratie' },
    {
      provinceSlug: 'mondulkiri',
      name: 'Saen Monourom',
      slug: 'saen-monourom',
    },
    { provinceSlug: 'oddar-meanchey', name: 'Samraong', slug: 'samraong' },
    { provinceSlug: 'pailin', name: 'Pailin', slug: 'pailin' },
    {
      provinceSlug: 'phnom-penh',
      name: 'Chamkar Mon',
      slug: 'chamkar-mon',
    },
    {
      provinceSlug: 'preah-vihear',
      name: 'Tbeng Meanchey',
      slug: 'tbeng-meanchey',
    },
    { provinceSlug: 'prey-veng', name: 'Prey Veng', slug: 'prey-veng' },
    { provinceSlug: 'pursat', name: 'Pursat', slug: 'pursat' },
    { provinceSlug: 'ratanakiri', name: 'Banlung', slug: 'banlung' },
    { provinceSlug: 'siem-reap', name: 'Siem Reap', slug: 'siem-reap' },
    {
      provinceSlug: 'preah-sihanouk',
      name: 'Sihanoukville',
      slug: 'sihanoukville',
    },
    {
      provinceSlug: 'stung-treng',
      name: 'Stung Treng',
      slug: 'stung-treng',
    },
    { provinceSlug: 'svay-rieng', name: 'Svay Rieng', slug: 'svay-rieng' },
    { provinceSlug: 'takeo', name: 'Doun Kaev', slug: 'doun-kaev' },
    { provinceSlug: 'tbong-khmum', name: 'Suong', slug: 'suong' },
  ];

export const COMMUNES: { districtSlug: string; name: string; slug: string }[] =
  [];

export async function seedGeography(db: DbClient): Promise<void> {
  const slugToId = new Map<string, string>();
  for (const p of PROVINCES) {
    const [row] = await db
      .insert(provinces)
      .values({ name: p.name, slug: p.slug })
      .onConflictDoUpdate({ target: provinces.slug, set: { name: p.name } })
      .returning({ id: provinces.id, slug: provinces.slug });
    slugToId.set(row.slug, row.id);
  }
  for (const d of DISTRICTS) {
    const provinceId = slugToId.get(d.provinceSlug);
    if (!provinceId) continue;
    const [existing] = await db
      .select({ id: districts.id })
      .from(districts)
      .where(
        and(eq(districts.provinceId, provinceId), eq(districts.slug, d.slug)),
      )
      .limit(1);
    if (existing) continue;
    await db
      .insert(districts)
      .values({ provinceId, name: d.name, slug: d.slug });
  }
}
