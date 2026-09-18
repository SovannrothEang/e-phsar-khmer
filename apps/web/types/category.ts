export type Category = {
  cateId: string;
  name: string;
  slug: string;
  cateIcon: string;
  subcategories: Subcategory[];
};
export type Subcategory = {
  subId: string;
  name: string;
  slug: string;
  subcate: string;
  images?: string[];
  title?: string;
  brands?: BrandOption[];
  types?: TypeOption[];
  vehicletypes?: VehicleTypeOption[];
  cartypes?: CarTypeOption[];
  bodyTypes?: BodyTypeOption[];
  jobTypes?: JobTypeOption[];
  years?: YearOption[];
  accessories?: AccessoryOption[];
  networks?: NetworkOption[];
  storages?: StorageOption[];
  screen_size?: ScreenSizeOption[];
  ram?: RamOption[];
  cpus?: CpuOption[];
  vgas?: VgaOption[];
  bedrooms?: BedRoomOption[];
  bathrooms?: BathRoomOption[];
  facing?: FacingOption[];
  size?: number;
  experience?: ExperienceOption[];
  salary?: number;
  tax_types?: TaxTypeOption[];
  condition?: ConditionOption[];
  engine_types?: EngineOption[];
  transmission?: TransmissionOption[];
  colors?: ColorOption[];
  discount?: DiscountOption[];
  price?: number;
  delivery?: boolean;
  description?: string;
  proId?: string;
  disId?: string;
  comId?: string;
  address?: string;
  company_name?: string;
  name_contact?: string;
  phone?: string;
  email?: string;
};
export type BrandOption = {
  brandId: string;
  name: string;
  slug: string;
  image: string;
  model?: ModelOption[];
};
export type ModelOption = {
  modelId: string;
  name: string;
  slug: string;
};
export type VehicleTypeOption = {
  vehicleTypeId: string;
  name: string;
  slug: string;
  image: string;
};

export type TypeOption = {
  typeId: string;
  name: string;
  slug: string;
  image?: string;
};

export type BodyTypeOption = {
  bodyTypeId: string;
  name: string;
  slug: string;
  image: string;
};
export type CarTypeOption = {
  cartypeId: string;
  name: string;
  slug: string;
};

export type JobTypeOption = {
  jobTypeId: string;
  name: string;
  slug: string;
  image: string;
};
export type YearOption = {
  yearId: string;
  name: string;
};
export type EngineOption = {
  engineId: string;
  name: string;
};
export type TransmissionOption = {
  transmissionId: string;
  name: string;
};
export type ColorOption = {
  colorId: string;
  name: string;
};
export type ConditionOption = {
  conditionId: string;
  name: string;
};
export type TaxTypeOption = {
  taxTypeId: string;
  name: string;
};
export type FacingOption = {
  facingId: string;
  name: string;
};
export type NetworkOption = {
  networkId: string;
  name: string;
  slug: string;
  image: string;
};
export type StorageOption = {
  storageId: string;
  name: string;
};
export type ScreenSizeOption = {
  screenSizeId: string;
  name: string;
};
export type RamOption = {
  ramId: string;
  name: string;
};
export type CpuOption = {
  cpuId: string;
  name: string;
};
export type VgaOption = {
  vgaId: string;
  name: string;
};
export type AccessoryOption = {
  accessoryId: string;
  name: string;
  slug: string;
  image?: string;
};
export type BedRoomOption = {
  bedRoomId: string;
  name: string;
};
export type BathRoomOption = {
  bathRoomId: string;
  name: string;
};
export type ExperienceOption = {
  experienceId: string;
  name: string;
};
export type DiscountOption = {
  discountId: string;
  name: string;
};
