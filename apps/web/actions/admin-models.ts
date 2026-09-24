"use server";

import { serverFetch } from "@/lib/api/client";
import type { Model } from "@/types/model";

interface BackendModel {
  id: string;
  brandId: string;
  slug: string;
  name: string;
  image: string | null;
  /** The model's OWN subcategory links (added 2026-09-22). */
  subcategoryIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface BackendBrand {
  id: string;
  subcategoryIds: string[];
  categoryId: string | null;
}

export async function getAdminModels(): Promise<Model[]> {
  const [{ data: models }, { data: brands }] = await Promise.all([
    serverFetch<BackendModel[]>("/admin/models"),
    serverFetch<BackendBrand[]>("/admin/brands"),
  ]);

  // The model's own links drive the Sub Category column. Until 2026-09-22 this
  // fell back to the BRAND's links, which is why every Apple row (iPhone
  // included) showed all eight of Apple's subcategories — the display was
  // reporting a relationship the schema could not express.
  const subToCategory = new Map<string, string>();
  for (const b of brands) {
    if (!b.categoryId) continue;
    for (const sub of b.subcategoryIds) subToCategory.set(sub, b.categoryId);
  }

  return models.map((m) => {
    const subs = m.subcategoryIds ?? [];
    return {
      modelId: m.id,
      name: m.name,
      slug: m.slug,
      brandId: m.brandId,
      // A model's subcategories all sit in one category by construction; fall
      // back to the brand's when it has none.
      categoryId:
        subToCategory.get(subs[0] ?? "") ??
        brands.find((b) => b.id === m.brandId)?.categoryId ??
        "",
      subcategories: subs,
      createdAt: m.createdAt.slice(0, 10),
      updatedAt: m.updatedAt.slice(0, 10),
    };
  });
}
