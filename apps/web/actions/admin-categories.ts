"use server";

import { serverFetch } from "@/lib/api/client";

export interface AdminCategory {
  cateId: string;
  name: string;
  nameKm: string;
  slug: string;
  cateIcon: string;
  isActive: boolean;
  sortOrder: number;
  subcategories: never[];
  createdAt: string;
  updatedAt: string;
}

interface BackendCategory {
  id: string;
  slug: string;
  icon: string | null;
  name: string;
  nameKm: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function iconToSrc(icon: string | null): string {
  // Backend `icon` is a short identifier (often null); only pass through real
  // image paths/URLs, otherwise fall back to a placeholder so next/image is safe.
  if (icon && (icon.startsWith("/") || icon.startsWith("http"))) return icon;
  return "/placeholder.svg";
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const { data } = await serverFetch<BackendCategory[]>("/admin/categories");
  return data.map((c) => ({
    cateId: c.id,
    name: c.name,
    nameKm: c.nameKm ?? "",
    slug: c.slug,
    cateIcon: iconToSrc(c.icon),
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    subcategories: [],
    createdAt: c.createdAt.slice(0, 10),
    updatedAt: c.updatedAt.slice(0, 10),
  }));
}
