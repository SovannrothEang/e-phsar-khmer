"use server";

import { serverFetch } from "@/lib/api/client";
import type { Model } from "@/types/model";

interface BackendModel {
  id: string;
  brandId: string;
  slug: string;
  name: string;
  image: string | null;
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

  // Models carry only brandId; derive category/subcategories from the brand
  // so the table columns render meaningfully.
  const brandMap = new Map(brands.map((b) => [b.id, b]));

  return models.map((m) => {
    const b = brandMap.get(m.brandId);
    return {
      modelId: m.id,
      name: m.name,
      slug: m.slug,
      brandId: m.brandId,
      categoryId: b?.categoryId ?? "",
      subcategories: b?.subcategoryIds ?? [],
      createdAt: m.createdAt.slice(0, 10),
      updatedAt: m.updatedAt.slice(0, 10),
    };
  });
}
