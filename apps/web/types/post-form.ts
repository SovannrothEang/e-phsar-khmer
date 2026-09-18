export type Category = {
  name: string;
  slug: string;
  cateIcon: string;
  subcategories: Subcategory[];
};

export type Subcategory = {
  name: string;
  slug: string;
  subcate: string;
  images?: string[];
  title?: string;
  brands?: BrandOption[];
  accessories?: string[];
  network?: TypeOption[];
  storages?: string[];
  screen_size?: string[];
  ram?: string[];
  cpus?: string[];
  vgas?: string[];
  years?: number[];
  bedrooms?: number[];
  bathrooms?: number[];
  facing?: string[];
  size?: string;
  experience?: string[];
  salary?: number;
  tax_types?: string[];
  condition?: string[];
  Types?: TypeOption[];
  engine_types?: string[];
  transmission?: string[];
  colors?: string[];
  discount?: string[];
  price?: number;
  delivery?: boolean;
  description?: string;
  location?: string;
  address?: string;
  company_name?: string;
  name_contact?: string;
  phone?: string;
  email?: string;
};

export type BrandOption = {
  name: string;
  slug: string;
  image: string;
  Model?: ModelOption[];
};
export type ModelOption = {
  name: string;
  slug: string;
};

export type TypeOption = {
  name: string;
  slug: string;
  image: string;
};
