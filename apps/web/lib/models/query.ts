/** Filters accepted by `GET /admin/models` (see `ListModelsDto`). */
export interface AdminModelsQuery {
  q?: string;
  brandId?: string;
  categoryId?: string;
  subcategoryId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Stable query string for the paginated models endpoint. Empty/whitespace
 * values are omitted so the API's defaults apply; the order is fixed so the
 * same filter set always produces the same React Query key.
 */
export function buildAdminModelsQuery(params: AdminModelsQuery = {}): string {
  const sp = new URLSearchParams();
  const q = params.q?.trim();
  if (q) sp.set("q", q);
  if (params.brandId) sp.set("brandId", params.brandId);
  if (params.categoryId) sp.set("categoryId", params.categoryId);
  if (params.subcategoryId) sp.set("subcategoryId", params.subcategoryId);
  if (params.page !== undefined) sp.set("page", String(params.page));
  if (params.pageSize !== undefined) {
    sp.set("pageSize", String(params.pageSize));
  }
  return sp.toString();
}
