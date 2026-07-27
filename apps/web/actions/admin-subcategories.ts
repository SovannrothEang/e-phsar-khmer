"use server";

import { serverFetch } from "@/lib/api/client";

export interface AdminSubcategory {
  subId: string;
  name: string;
  slug: string;
  subIcon: string;
  categoryId: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface BackendSubcategory {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function iconToSrc(icon: string | null | undefined): string {
  // Only pass through real image paths/URLs; otherwise fall back to a
  // placeholder so next/image never gets a non-URL string.
  if (icon && (icon.startsWith("/") || icon.startsWith("http"))) return icon;
  return "/placeholder.svg";
}

export async function getAdminSubcategories(): Promise<AdminSubcategory[]> {
  const { data } = await serverFetch<BackendSubcategory[]>(
    "/admin/subcategories",
  );
  return data.map((s) => ({
    subId: s.id,
    name: s.name,
    slug: s.slug,
    subIcon: iconToSrc(s.icon),
    categoryId: s.categoryId,
    isActive: s.isActive,
    sortOrder: s.sortOrder,
    createdAt: s.createdAt.slice(0, 10),
    updatedAt: s.updatedAt.slice(0, 10),
  }));
}
