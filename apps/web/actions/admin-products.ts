"use server";

import { serverFetch } from "@/lib/api/client";
import type { AdminProduct } from "@/types/product";

/**
 * Admin catalogue rows (published + drafts). The backend returns the joined
 * brand/model names, slugs and spec groups directly — no adapter needed beyond
 * typing.
 */
export async function getAdminProducts(): Promise<AdminProduct[]> {
  const { data } = await serverFetch<AdminProduct[]>("/admin/products");
  return data;
}
