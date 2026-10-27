/** One label/value row inside a product spec section. */
export interface ProductSpecItem {
  label: string;
  value: string;
}

/** A named section ("Display", "Camera", …); array order is display order. */
export interface ProductSpecGroup {
  title: string;
  rows: ProductSpecItem[];
}

/** Search / post-form picker row. */
export interface ProductSummary {
  /** The product-spec row id. */
  id: string;
  /** The `models` id — what a listing stores in `productModelId`. */
  modelId: string;
  brandId: string;
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
  image: string | null;
}

/** Full public spec page. */
export interface ProductDetail extends ProductSummary {
  specGroups: ProductSpecGroup[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Admin rows share the public shape; drafts are simply included. */
export type AdminProduct = ProductDetail;
