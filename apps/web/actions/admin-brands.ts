"use server";

import { serverFetch } from "@/lib/api/client";
import type { Brand } from "@/types/brand";

interface BackendBrand {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  subcategoryIds: string[];
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

function iconToSrc(icon: string | null): string {
  if (icon && (icon.startsWith("/") || icon.startsWith("http"))) return icon;
  return "/placeholder.svg";
}

export async function getAdminBrands(): Promise<Brand[]> {
  const { data } = await serverFetch<BackendBrand[]>("/admin/brands");
  return data.map((b) => ({
    brandId: b.id,
    name: b.name,
    slug: b.slug,
    image: iconToSrc(b.icon),
    categoryId: b.categoryId ?? "",
    subcategories: b.subcategoryIds,
    createdAt: b.createdAt.slice(0, 10),
    updatedAt: b.updatedAt.slice(0, 10),
  }));
}
