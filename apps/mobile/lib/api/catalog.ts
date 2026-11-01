import { apiFetch } from "@/lib/api/client";

export interface FieldDef {
  key: string;
  type: string;
  required?: boolean;
  max?: number;
  options?: string[] | null;
  label?: { en?: string; km?: string; zh?: string };
}

export interface SubcategorySummary {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  fieldSchema?: FieldDef[] | null;
}

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  subcategories: SubcategorySummary[];
}

export interface BrandSummary {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sortOrder?: number;
}

export interface ModelSummary {
  id: string;
  slug: string;
  name: string;
}

export interface PlaceSummary {
  id: string;
  name: string;
  nameKm?: string | null;
  slug: string;
}

export interface AttributeSummary {
  id: string;
  type: string;
  slug: string;
  name: string;
  nameKm?: string | null;
  image: string | null;
  sortOrder?: number;
}

const publicRead = { auth: false } as const;

export async function fetchCategory(slug: string): Promise<CategorySummary> {
  const { data } = await apiFetch<CategorySummary>(
    `/categories/${encodeURIComponent(slug)}`,
    publicRead,
  );
  return data;
}

export async function fetchSubcategory(
  categorySlug: string,
  subcategorySlug: string,
): Promise<SubcategorySummary> {
  const { data } = await apiFetch<SubcategorySummary>(
    `/categories/${encodeURIComponent(categorySlug)}/subcategories/${encodeURIComponent(subcategorySlug)}`,
    publicRead,
  );
  return data;
}

export async function fetchBrands(
  subcategorySlug: string,
): Promise<BrandSummary[]> {
  const { data } = await apiFetch<BrandSummary[]>(
    `/brands?subcategory=${encodeURIComponent(subcategorySlug)}`,
    publicRead,
  );
  return data ?? [];
}

export async function fetchModels(
  brandId: string,
  subcategorySlug: string,
): Promise<ModelSummary[]> {
  const { data } = await apiFetch<ModelSummary[]>(
    `/brands/${encodeURIComponent(brandId)}/models?subcategory=${encodeURIComponent(subcategorySlug)}`,
    publicRead,
  );
  return data ?? [];
}

export async function fetchLinkedAttributes(
  subcategoryId: string,
): Promise<AttributeSummary[]> {
  const { data } = await apiFetch<AttributeSummary[]>(
    `/attributes?subcategoryId=${encodeURIComponent(subcategoryId)}`,
    publicRead,
  );
  return data ?? [];
}

export async function fetchAttributeSet(
  type: string,
): Promise<AttributeSummary[]> {
  const { data } = await apiFetch<AttributeSummary[]>(
    `/attributes/${encodeURIComponent(type)}`,
    publicRead,
  );
  return data ?? [];
}

export async function fetchProvinces(): Promise<PlaceSummary[]> {
  const { data } = await apiFetch<PlaceSummary[]>(
    "/locations/provinces",
    publicRead,
  );
  return data ?? [];
}

export async function fetchDistricts(
  provinceSlug: string,
): Promise<PlaceSummary[]> {
  const { data } = await apiFetch<PlaceSummary[]>(
    `/locations/provinces/${encodeURIComponent(provinceSlug)}/districts`,
    publicRead,
  );
  return data ?? [];
}

export async function fetchCommunes(
  provinceSlug: string,
  districtSlug: string,
): Promise<PlaceSummary[]> {
  const { data } = await apiFetch<PlaceSummary[]>(
    `/locations/provinces/${encodeURIComponent(provinceSlug)}/districts/${encodeURIComponent(districtSlug)}/communes`,
    publicRead,
  );
  return data ?? [];
}
