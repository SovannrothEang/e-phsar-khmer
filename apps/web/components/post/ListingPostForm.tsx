"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { ChevronDown, ChevronRight, Loader2, Minus, Plus } from "lucide-react";

import ImageUpload from "@/components/post/ImageUpload";
import LocationMapPicker from "@/components/post/LocationMapPicker";
import { FieldLabel } from "@/components/post/FieldLabel";
import LocationPicker, {
  EMPTY_PLACE,
  placeLabel,
  type PlaceSelection,
} from "@/components/post/LocationPicker";
import type { MapCoords } from "@/components/post/LocationMapCanvas";
import { signUploadUser } from "@/actions/files";
import {
  createListing,
  getBrandModels,
  getListingFormConfig,
  type CreateListingPayload,
  type ListingFormConfig,
} from "@/actions/listings";
import type { BackendModel } from "@/lib/api/categories";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import DbImage from "@/components/common/DbImage";

/** Spec-fixed pickers with no backend source (spec-detail-one.md:210-228). */
const TAX_TYPES = ["Tax Paper", "Plate Number"] as const;
const ENGINE_TYPES = ["Diesel", "Electric", "Hybrid", "LPG", "Petrol"] as const;
const TRANSMISSIONS = ["Auto", "Manual"] as const;

/**
 * Where the Condition block sits in a subcategory's Post Details section.
 *
 * The design puts Condition in a different place on almost every form and the
 * `field_schema` cannot arbitrate: Cars For Sale's own schema lists Condition
 * before Body Type while its approved layout puts it after (tasks/redesign.md
 * rows 11/15). So the slot is declared here, per subcategory:
 *
 *  - `lead` — directly under the identity pickers and above the spec cluster
 *    (Screen Size/Storage/RAM/CPU/VGA). The computers forms, where Condition is
 *    the second field after Brand.
 *  - `afterScreenSize` — All-in-One and Monitors put Screen Size first and
 *    Condition directly beneath it.
 *  - `beforeBodyType` — Lorries, Vans & Tractors follows its own mock and its
 *    schema order, condition → bodyType (captain, 2026-09-21). Only applies
 *    when the subcategory also declares bodyType; otherwise it falls back to
 *    the normal slot.
 *  - anything unlisted — the normal slot, after Tax Type (cars, motorcycles,
 *    Phones & Tablets).
 */
const CONDITION_SLOT: Record<
  string,
  "lead" | "afterScreenSize" | "beforeBodyType"
> = {
  laptops: "lead",
  desktops: "lead",
  "printers-and-scanners": "lead",
  "computers-parts-and-accessories": "lead",
  "all-in-one": "afterScreenSize",
  monitors: "afterScreenSize",
  "lorries-vans-and-tractors": "beforeBodyType",
};

/**
 * Subcategories that star Storage. Every computers form stars it; Phones &
 * Tablets' mock approved it unstarred, and required-ness is hardcoded per block
 * because `field_schema.required` is not consumed (tasks/todo.md) — so this is
 * the one field whose star has to differ between families.
 */
const STORAGE_REQUIRED = ["laptops", "desktops", "all-in-one"];

/**
 * Subcategories whose Type picker is NOT starred (captain's Home & Land mocks,
 * 2026-09-22 and 2026-09-23). `type` is required on every other form that
 * declares it — Computers Parts & Accessories and the electronics family — so
 * this is the short exception list rather than a positive `TYPE_REQUIRED` one,
 * the mirror of `STORAGE_REQUIRED` above. Required-ness is hardcoded per block
 * because `field_schema.required` is not consumed.
 */
const TYPE_OPTIONAL = new Set([
  "house-for-sale",
  "house-for-rent",
  // The commercial forms declare `type` too (Building/Factory/Hotel/Offices/
  // Restaurant/Shop/Warehouse, ticked in the `types` set) and their mock also
  // leaves it unstarred (2026-09-23).
  "commercial-properties-for-sale",
  "commercial-properties-for-rent",
]);

// ─── Shared field bits (styled to match the page's inline fields) ─────────────
function TextInput({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
  maxLength,
  min,
  prefix,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  min?: number;
  /** Glyph shown inside the field's left edge (e.g. the price's "$"). */
  prefix?: string;
  /** Control pinned inside the field's right edge (e.g. the row's remove). */
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          maxLength={maxLength}
          min={min}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border border-gray-200 rounded-lg py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent ${
            prefix ? "pl-7" : "pl-3"
          } ${trailing ? "pr-11" : "pr-3"}`}
        />
        {trailing && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {trailing}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Searchable picker for long option lists (91+ brands, a brand's models):
 * the trigger opens a panel with a Search field over a scrolling list. Images
 * go through DbImage, so only Storage-backed icons render; the logo slot is
 * kept only when the option set actually carries images.
 */
function SearchPicker({
  label,
  options,
  value,
  onChange,
  required,
  disabled,
  placeholder = "Choose…",
  emptyLabel = "No match found.",
}: {
  label: string;
  options: { id: string; name: string; image?: string | null }[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  /** Inert until its parent choice is made (a disabled button fires no click,
   *  so the popover can never open); renders empty rather than a placeholder. */
  disabled?: boolean;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const withIcons = options.some((o) => !!o.image);

  return (
    <div>
      <FieldLabel label={label} required={required} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={`flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm focus:outline-none ${
              disabled
                ? "cursor-not-allowed bg-gray-100 text-gray-400"
                : "cursor-pointer text-gray-700 focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            }`}
          >
            <span className={selected ? "" : "text-gray-400"}>
              {selected?.name ?? (disabled ? "" : placeholder)}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  {withIcons && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                      <DbImage
                        src={option.image ?? ""}
                        alt=""
                        width={24}
                        height={24}
                        className="object-contain"
                      />
                    </span>
                  )}
                  <span>{option.name}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ToggleGroup({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`h-11 cursor-pointer rounded-sm border text-sm transition-colors ${
              value === o
                ? "border-gray-300 bg-gray-100 font-medium text-gray-800"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Listing form ─────────────────────────────────────────────────────────────
/**
 * The real listing-creation form for a subcategory.
 *
 * Every block is gated on the subcategory's own backend `field_schema`: a field
 * renders iff its key is in `config.fields`. That is what makes Cars For Sale
 * (brand/model/year/tax/body type/engine/transmission/colour) and Bicycles
 * (title/condition/price/discount/description/location/contact) the same
 * component with different declared fields — the schema is the single source of
 * truth for which fields a category has, so a newly seeded subcategory needs no
 * new form code, only an entry in the post page's real-form list.
 */
export default function ListingPostForm({
  categorySlug,
  subcategorySlug,
  categoryName,
  subName,
  onBack,
}: {
  categorySlug: string;
  subcategorySlug: string;
  categoryName: string;
  subName: string;
  onBack: () => void;
}) {
  const locale = useLocale();
  const router = useRouter();

  const [config, setConfig] = useState<ListingFormConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);

  const [files, setFiles] = useState<File[]>([]);
  const [photos, setPhotos] = useState<{ url: string; path: string }[]>([]);

  const [brandId, setBrandId] = useState("");
  const [models, setModels] = useState<BackendModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [condition, setCondition] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [engineType, setEngineType] = useState("");
  const [transmission, setTransmission] = useState("");
  const [taxType, setTaxType] = useState("");
  const [color, setColor] = useState("");
  const [typeValue, setTypeValue] = useState("");
  const [screenSize, setScreenSize] = useState("");
  const [storage, setStorage] = useState("");
  const [ram, setRam] = useState("");
  const [cpu, setCpu] = useState("");
  const [vga, setVga] = useState("");
  const [accessory, setAccessory] = useState("");
  const [network, setNetwork] = useState("");
  // Jobs family — Job Type and Experience are pickers (see PICKER_ATTR_TYPES
  // for where each list comes from), Company a plain text field.
  const [jobType, setJobType] = useState("");
  const [experience, setExperience] = useState("");
  const [company, setCompany] = useState("");
  // Home & Land property cluster — `size` is the only free-text one; Bedroom,
  // Bathroom, Facing and Type are all pickers.
  const [bedroom, setBedroom] = useState("");
  const [bathroom, setBathroom] = useState("");
  const [facing, setFacing] = useState("");
  const [size, setSize] = useState("");

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">(
    "percent",
  );
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState<PlaceSelection>(EMPTY_PLACE);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<MapCoords | null>(null);
  const [deliveryFree, setDeliveryFree] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhones, setContactPhones] = useState(["", "", ""]);
  // Visible phone rows (1-3) — the "+" adds one, a row's ⊖ removes it.
  const [phoneRows, setPhoneRows] = useState(1);
  const [contactEmail, setContactEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);

  /** Does this subcategory's field schema declare `key`? */
  const has = (key: string) => !!config?.fields.includes(key);

  // Runs once per mount: the page unmounts this form on "Change"/"Reset"
  // (step goes back to 1), so a different subcategory always gets a fresh
  // instance and `configLoading` never needs resetting mid-life.
  useEffect(() => {
    let cancelled = false;
    getListingFormConfig(categorySlug, subcategorySlug, locale).then((cfg) => {
      if (cancelled) return;
      if (!cfg) {
        setConfigError(true);
        toast.error("Could not load the listing form");
      } else {
        setConfig(cfg);
        // Prefill the contact section from the logged-in user's profile.
        if (cfg.contact.name) setContactName(cfg.contact.name);
        const prefilled = [
          cfg.contact.phones[0] ?? "",
          cfg.contact.phones[1] ?? "",
          cfg.contact.phones[2] ?? "",
        ];
        setContactPhones(prefilled);
        setPhoneRows(
          Math.min(3, Math.max(1, prefilled.filter((x) => x.trim()).length)),
        );
        setContactEmail(cfg.contact.email ?? "");
      }
      setConfigLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [categorySlug, subcategorySlug, locale]);

  const onBrandChange = async (id: string) => {
    setBrandId(id);
    setModel("");
    setModels([]);
    if (!id) return;
    setModelsLoading(true);
    try {
      // Scoped to this subcategory — a tablet form must not offer iPhones.
      setModels(await getBrandModels(id, subcategorySlug));
    } catch {
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const submit = async () => {
    if (!config) {
      toast.error("Form data is not loaded yet");
      return;
    }
    if (has("title") && !title.trim()) {
      toast.error("Title is required");
      return;
    }
    const priceNum = Number(price);
    if (
      has("price") &&
      (price === "" || !Number.isFinite(priceNum) || priceNum < 0)
    ) {
      toast.error("Enter a valid price");
      return;
    }
    if (
      has("type") &&
      typeValue === "" &&
      !TYPE_OPTIONAL.has(subcategorySlug)
    ) {
      toast.error("Choose a type");
      return;
    }
    // Jobs' two pickers are starred in the design (2026-09-23 mock), so an
    // empty one is a star that lies — enforce both here.
    if (has("jobType") && jobType === "") {
      toast.error("Choose a job type");
      return;
    }
    if (has("experience") && experience === "") {
      toast.error("Choose experience");
      return;
    }
    if (has("accessory") && accessory === "") {
      toast.error("Choose an accessory");
      return;
    }
    if (has("network") && network === "") {
      toast.error("Choose a network");
      return;
    }
    if (has("brand") && brandId === "") {
      toast.error("Choose a brand");
      return;
    }
    // The computers spec cluster — all starred on every form that declares them.
    if (has("screenSize") && screenSize === "") {
      toast.error("Choose a screen size");
      return;
    }
    if (
      has("storage") &&
      STORAGE_REQUIRED.includes(subcategorySlug) &&
      storage === ""
    ) {
      toast.error("Choose storage");
      return;
    }
    if (has("ram") && ram === "") {
      toast.error("Choose a RAM size");
      return;
    }
    if (has("cpu") && cpu === "") {
      toast.error("Choose a CPU");
      return;
    }
    if (has("vga") && vga === "") {
      toast.error("Choose a VGA");
      return;
    }
    if (has("year") && year === "") {
      toast.error("Choose a year");
      return;
    }
    if (has("vehicleType") && vehicleType === "") {
      toast.error("Choose a vehicle type");
      return;
    }
    if (has("taxType") && taxType === "") {
      toast.error("Choose a tax type");
      return;
    }
    if (has("condition") && condition === "") {
      toast.error("Choose a condition");
      return;
    }
    if (has("color") && color === "") {
      toast.error("Choose a color");
      return;
    }
    // These three carry a red `*` on screen, so they must be enforced here or
    // the star is a lie. It matters more than it looks: the create DTO marks
    // all three optional, so an empty Location does not 400 — it publishes a
    // listing with no `location`, which then matches no province/district
    // filter and is invisible to location search (the silent drop migration
    // 0018 was written to prevent).
    if (has("description") && !description.trim()) {
      toast.error("Description is required");
      return;
    }
    if (has("location") && !placeLabel(place)) {
      toast.error("Choose a location");
      return;
    }
    if (has("address") && !address.trim()) {
      toast.error("Address is required");
      return;
    }
    if (has("contactName") && !contactName.trim()) {
      toast.error("Contact name is required");
      return;
    }
    if (has("contactPhones") && !(contactPhones[0] ?? "").trim()) {
      toast.error("Phone number is required");
      return;
    }

    const attributes: Record<string, unknown> = {};
    if (has("brand"))
      attributes.brand =
        config.brands.find((b) => b.id === brandId)?.name ?? brandId;
    if (has("year") && year) attributes.year = year;
    if (has("model") && model) attributes.model = model;
    if (has("vehicleType") && vehicleType) attributes.vehicleType = vehicleType;
    if (has("bodyType") && bodyType) attributes.bodyType = bodyType;
    if (has("engineType") && engineType) attributes.engineType = engineType;
    if (has("transmission") && transmission)
      attributes.transmission = transmission;
    if (has("taxType") && taxType) attributes.taxType = taxType;
    if (has("color") && color) attributes.color = color;
    if (has("type") && typeValue) attributes.type = typeValue;
    if (has("jobType") && jobType) attributes.jobType = jobType;
    if (has("experience") && experience) attributes.experience = experience;
    if (has("company") && company.trim()) attributes.company = company.trim();
    // Keys are the schema's own — singular `bedroom`/`bathroom`, which is what
    // the seeded `field_schema` declares and what `ListingSpecs` reads back.
    if (has("bedroom") && bedroom) attributes.bedroom = bedroom;
    if (has("bathroom") && bathroom) attributes.bathroom = bathroom;
    if (has("facing") && facing) attributes.facing = facing;
    if (has("size") && size) attributes.size = size;
    if (has("screenSize") && screenSize) attributes.screenSize = screenSize;
    if (has("storage") && storage) attributes.storage = storage;
    if (has("ram") && ram) attributes.ram = ram;
    if (has("cpu") && cpu) attributes.cpu = cpu;
    if (has("vga") && vga) attributes.vga = vga;
    if (has("accessory") && accessory) attributes.accessory = accessory;
    if (has("network") && network) attributes.network = network;

    const payload: CreateListingPayload = {
      categoryId: config.categoryId,
      subcategoryId: config.subcategoryId,
      title: title.trim(),
      attributes,
      location: placeLabel(place) || undefined,
      address: address.trim() || undefined,
      provinceId: place.province?.id,
      districtId: place.district?.id,
      communeId: place.commune?.id,
      latitude: coords?.lat,
      longitude: coords?.lng,
      deliveryFree,
      contactName: contactName.trim(),
      contactPhones: contactPhones
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
      contactEmail: contactEmail.trim() || undefined,
      description: description.trim() || undefined,
    };
    if (has("price")) payload.price = priceNum;
    if (has("condition")) {
      payload.condition = condition === "New" ? "new" : "used";
    }
    if (has("discount") && discountValue !== "") {
      payload.discountValue = Number(discountValue);
      payload.discountType = discountType;
    }
    if (photos.length > 0) {
      payload.photos = photos.map((p, sort) => ({ ...p, sort }));
    }

    setSubmitting(true);
    const result = await createListing(payload);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Your ad was published");
    if (result.warning) toast.warning(result.warning);
    router.push({
      pathname: "/post/[slug]",
      params: { slug: result.listingId },
    });
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (configError || !config) {
    return (
      <div className="py-16 text-center text-gray-500">
        <p className="mb-4">Could not load the listing form.</p>
        <button
          onClick={onBack}
          className="text-sm text-[#00a0e9] font-semibold hover:underline"
        >
          Back
        </button>
      </div>
    );
  }

  const removePhoneRow = (index: number) => {
    setContactPhones((prev) => {
      const next = [...prev];
      next.splice(index, 1); // drop this row and shift the rest up
      next.push("");
      return next;
    });
    setPhoneRows((n) => Math.max(1, n - 1));
  };

  // Condition has four possible slots (see CONDITION_SLOT), so it is built once
  // here and rendered at whichever one this subcategory uses.
  const declaredSlot = CONDITION_SLOT[subcategorySlug];
  const conditionSlot =
    declaredSlot === "beforeBodyType" && !has("bodyType")
      ? undefined
      : declaredSlot;
  const conditionBlock = has("condition") ? (
    <ToggleGroup
      label="Condition"
      required
      options={["Used", "New"]}
      value={condition}
      onChange={setCondition}
    />
  ) : null;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div />
        <button
          onClick={onBack}
          className="text-sm text-[#00a0e9] font-semibold hover:underline cursor-pointer"
        >
          Reset
        </button>
      </div>

      {/* ── Photos ─────────────────────────────────────────────────────────── */}
      <ImageUpload
        images={files}
        onChange={setFiles}
        signFn={signUploadUser}
        onSigned={(p) => setPhotos((prev) => [...prev, p])}
        title={config.labels.photos ?? "Photos"}
        max={config.photoMax}
      />

      {/* ── Post Details ───────────────────────────────────────────────────── */}
      <div className="space-y-5">
        <h2 className="text-lg font-bold text-foreground">Post Details</h2>

        {has("title") && (
          <TextInput
            label={config.labels.title ?? "Title"}
            required
            maxLength={200}
            value={title}
            onChange={setTitle}
          />
        )}

        {/* Category breadcrumb */}
        <div>
          <FieldLabel label="Choose a category" required />
          <div className="flex flex-wrap items-center gap-3 rounded-sm border border-dashed border-gray-300 px-3 py-2.5">
            <span className="text-sm text-foreground">{categoryName}</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-foreground">{subName}</span>
            <button
              onClick={onBack}
              className="rounded-sm bg-[#00a0e9] px-4 py-1.5 text-sm font-semibold text-card transition-colors hover:bg-[#00a0e9]/80 cursor-pointer"
            >
              Change
            </button>
          </div>
        </div>

        {/* ── Home & Land property cluster ────────────────────────────────────
            Bedroom, Bathroom, Facing and Size sit ABOVE the identity cluster
            because the captain's mock reads Bedroom → Bathroom → Facing → Size
            → Type, and `type` renders in the identity cluster below. No other
            family declares these keys, so the position is inert elsewhere.
            Every one is an ordinary `SearchPicker`/input: redesign.md's rule is
            that no native `<select>` remains, not that the mock's chevron
            renders as one. All four are unstarred in that mock. */}
        {has("bedroom") && (
          <SearchPicker
            label={config.labels.bedroom ?? "Bedroom"}
            options={(config.pickLists.bedroom ?? []).map((o) => ({
              id: o.name,
              name: o.name,
            }))}
            value={bedroom}
            onChange={setBedroom}
            placeholder="Choose a bedroom"
          />
        )}
        {has("bathroom") && (
          <SearchPicker
            label={config.labels.bathroom ?? "Bathroom"}
            options={(config.pickLists.bathroom ?? []).map((o) => ({
              id: o.name,
              name: o.name,
            }))}
            value={bathroom}
            onChange={setBathroom}
            placeholder="Choose a bathroom"
          />
        )}
        {has("facing") && (
          <SearchPicker
            label={config.labels.facing ?? "Facing"}
            options={(config.pickLists.facing ?? []).map((o) => ({
              id: o.name,
              name: o.name,
            }))}
            value={facing}
            onChange={setFacing}
            placeholder="Choose facing"
          />
        )}
        {has("size") && (
          <TextInput
            label={config.labels.size ?? "Size"}
            type="number"
            min={0}
            value={size}
            onChange={setSize}
          />
        )}

        {/* Fields the subcategory's field schema declares — one per row */}
        {/* Accessory, Network and Type hold Brand's slot on the subcategories
            that declare them (Phone Accessories, Phone Numbers, Computers
            Parts & Accessories) — the only "what kind of thing is this" picker
            those forms have, and required. Type reads the admin-managed `types`
            set, so its ticks control which values the form offers. */}
        {has("accessory") && (
          <SearchPicker
            label={config.labels.accessory ?? "Accessory"}
            options={(config.pickLists.accessory ?? []).map((o) => ({
              id: o.name,
              name: o.name,
              image: o.image,
            }))}
            value={accessory}
            onChange={setAccessory}
            placeholder="Choose an accessory"
            required
          />
        )}
        {has("network") && (
          <SearchPicker
            label={config.labels.network ?? "Network"}
            options={(config.pickLists.network ?? []).map((o) => ({
              id: o.name,
              name: o.name,
              image: o.image,
            }))}
            value={network}
            onChange={setNetwork}
            placeholder="Choose a network"
            required
          />
        )}
        {has("type") && (
          <SearchPicker
            label={config.labels.type ?? "Type"}
            options={(config.pickLists.type ?? []).map((o) => ({
              id: o.name,
              name: o.name,
              image: o.image,
            }))}
            value={typeValue}
            onChange={setTypeValue}
            placeholder="Choose a type"
            required={!TYPE_OPTIONAL.has(subcategorySlug)}
          />
        )}
        {/* Jobs' Job Type and Experience hold the identity slot their form
            needs (the mock reads Job Type → Experience → Minimum salary, all
            above Price). Job Type renders the `jobtypes` icons when the admin
            has uploaded them and the plain row text until then. */}
        {has("jobType") && (
          <SearchPicker
            label={config.labels.jobType ?? "Job Type"}
            options={(config.pickLists.jobType ?? []).map((o) => ({
              id: o.name,
              name: o.name,
              image: o.image,
            }))}
            value={jobType}
            onChange={setJobType}
            placeholder="Choose a job type"
            required
          />
        )}
        {has("experience") && (
          <SearchPicker
            label={config.labels.experience ?? "Experience"}
            options={(config.pickLists.experience ?? []).map((o) => ({
              id: o.name,
              name: o.name,
            }))}
            value={experience}
            onChange={setExperience}
            placeholder="Choose experience"
            required
          />
        )}
        {has("brand") && (
          <SearchPicker
            label="Brand"
            options={config.brands.map((b) => ({
              id: b.id,
              name: b.name,
              image: b.icon,
            }))}
            value={brandId}
            onChange={onBrandChange}
            placeholder="Choose a brand"
            required
          />
        )}
        {has("model") && (
          <SearchPicker
            label="Model"
            options={models.map((m) => ({ id: m.name, name: m.name }))}
            value={model}
            onChange={setModel}
            disabled={has("brand") && brandId === ""}
            placeholder={modelsLoading ? "Loading..." : "Choose a model"}
            emptyLabel="No model found."
          />
        )}
        {conditionSlot === "lead" && conditionBlock}

        {has("screenSize") && (
          <SearchPicker
            label={config.labels.screenSize ?? "Screen Size"}
            options={(config.pickLists.screenSize ?? []).map((o) => ({
              id: o.name,
              name: o.name,
            }))}
            value={screenSize}
            onChange={setScreenSize}
            placeholder="Choose a screen size"
            required
          />
        )}

        {conditionSlot === "afterScreenSize" && conditionBlock}

        {has("storage") && (
          <SearchPicker
            label={config.labels.storage ?? "Storage"}
            options={(config.pickLists.storage ?? []).map((o) => ({
              id: o.name,
              name: o.name,
            }))}
            value={storage}
            onChange={setStorage}
            placeholder="Choose storage"
            required={STORAGE_REQUIRED.includes(subcategorySlug)}
          />
        )}

        {has("ram") && (
          <SearchPicker
            label={config.labels.ram ?? "RAM"}
            options={(config.pickLists.ram ?? []).map((o) => ({
              id: o.name,
              name: o.name,
            }))}
            value={ram}
            onChange={setRam}
            placeholder="Choose a RAM size"
            required
          />
        )}

        {has("cpu") && (
          <SearchPicker
            label={config.labels.cpu ?? "CPU"}
            options={(config.pickLists.cpu ?? []).map((o) => ({
              id: o.name,
              name: o.name,
            }))}
            value={cpu}
            onChange={setCpu}
            placeholder="Choose a CPU"
            required
          />
        )}

        {has("vga") && (
          <SearchPicker
            label={config.labels.vga ?? "VGA"}
            options={(config.pickLists.vga ?? []).map((o) => ({
              id: o.name,
              name: o.name,
            }))}
            value={vga}
            onChange={setVga}
            placeholder="Choose a VGA"
            required
          />
        )}
        {has("year") && (
          <SearchPicker
            label="Year"
            options={config.years.map((y) => ({ id: y, name: y }))}
            value={year}
            onChange={setYear}
            placeholder="Choose a year"
            required
          />
        )}
        {has("vehicleType") && (
          <SearchPicker
            label={config.labels.vehicleType ?? "Vehicle Type"}
            options={config.vehicleKinds.map((v) => ({
              id: v.name,
              name: v.name,
              image: v.image,
            }))}
            value={vehicleType}
            onChange={setVehicleType}
            placeholder="Choose a vehicle type"
            required
          />
        )}

        {has("engineType") && (
          <SearchPicker
            label="Engine Type"
            options={ENGINE_TYPES.map((t) => ({ id: t, name: t }))}
            value={engineType}
            onChange={setEngineType}
            placeholder="Choose engine type"
          />
        )}

        {conditionSlot === "beforeBodyType" && conditionBlock}

        {has("bodyType") && (
          <SearchPicker
            label={config.labels.bodyType ?? "Body Type"}
            options={config.vehicleKinds.map((bt) => ({
              id: bt.name,
              name: bt.name,
              image: bt.image,
            }))}
            value={bodyType}
            onChange={setBodyType}
            placeholder="Choose a body type"
          />
        )}

        {has("transmission") && (
          <ToggleGroup
            label="Transmission"
            options={[...TRANSMISSIONS]}
            value={transmission}
            onChange={setTransmission}
          />
        )}

        {has("taxType") && (
          <ToggleGroup
            label="Tax Type"
            required
            options={[...TAX_TYPES]}
            value={taxType}
            onChange={setTaxType}
          />
        )}

        {!conditionSlot && conditionBlock}

        {has("color") && (
          <SearchPicker
            label="Color"
            options={config.colors.map((c) => ({ id: c.name, name: c.name }))}
            value={color}
            onChange={setColor}
            placeholder="Choose a color"
            required
          />
        )}

        {has("price") && (
          <TextInput
            label={config.labels.price ?? "Price"}
            required
            type="number"
            min={0}
            prefix="$"
            value={price}
            onChange={setPrice}
          />
        )}

        {has("discount") && (
          <div>
            <FieldLabel label="Discount" />
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-full border border-gray-200 rounded-lg py-2.5 pl-3 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
              <div className="flex shrink-0 overflow-hidden rounded-sm border border-gray-200">
                {(
                  [
                    ["percent", "%"],
                    ["amount", "$"],
                  ] as const
                ).map(([kind, glyph]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setDiscountType(kind)}
                    aria-pressed={discountType === kind}
                    className={`w-12 cursor-pointer text-sm transition-colors ${
                      discountType === kind
                        ? "bg-gray-100 font-medium text-gray-800"
                        : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {glyph}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {has("deliveryFree") && (
          <div>
            <FieldLabel label="Free Delivery" />
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
              <span className="text-sm text-gray-700">
                {deliveryFree ? "Yes" : "No"}
              </span>
              <Switch
                checked={deliveryFree}
                onCheckedChange={setDeliveryFree}
                className="cursor-pointer data-checked:bg-[#00a0e9]"
              />
            </div>
          </div>
        )}

        {has("description") && (
          <div>
            <FieldLabel label="Description" required />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              className="w-full resize-y border border-gray-200 rounded-lg pl-3 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>
        )}

        {has("location") && (
          <LocationPicker
            provinces={config.provinces}
            value={place}
            onChange={setPlace}
            required
          />
        )}

        {has("address") && (
          <div>
            <FieldLabel label="Address" required />
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full resize-y border border-gray-200 rounded-lg pl-3 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>
        )}

        {/* Map: the seller drops a pin that rides with the post */}
        <LocationMapPicker value={coords} onChange={setCoords} />
      </div>

      {/* ── Contact ────────────────────────────────────────────────────────── */}
      <div className="space-y-5">
        <h2 className="text-lg font-bold text-foreground">Contact</h2>

        {/* The jobs form's Company sits at the top of Contact — its own spec
            lists it directly after Address, ahead of Name. Unstarred. */}
        {has("company") && (
          <TextInput
            label={config.labels.company ?? "Company"}
            placeholder="Your company"
            value={company}
            onChange={setCompany}
          />
        )}

        {has("contactName") && (
          <TextInput
            label="Name"
            required
            placeholder="Your name"
            value={contactName}
            onChange={setContactName}
          />
        )}

        {has("contactPhones") &&
          contactPhones.slice(0, phoneRows).map((p, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <TextInput
                  label={i === 0 ? "Phone Number" : `Phone Number ${i + 1}`}
                  required={i === 0}
                  placeholder="012 345 678"
                  value={p}
                  onChange={(v) =>
                    setContactPhones((prev) =>
                      prev.map((x, idx) => (idx === i ? v : x)),
                    )
                  }
                  trailing={
                    i > 0 ? (
                      <button
                        type="button"
                        onClick={() => removePhoneRow(i)}
                        aria-label={`Remove phone number ${i + 1}`}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-red-500 text-red-500 transition-colors hover:bg-red-50"
                      >
                        <Minus className="h-4 w-4" strokeWidth={3} />
                      </button>
                    ) : undefined
                  }
                />
              </div>
              {i === phoneRows - 1 && phoneRows < 3 && (
                <button
                  type="button"
                  onClick={() => setPhoneRows((n) => Math.min(3, n + 1))}
                  aria-label="Add phone number"
                  className="mb-0.5 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#00a0e9] text-card transition-colors hover:bg-[#00a0e9]/80"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}

        {has("contactEmail") && (
          <TextInput
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={contactEmail}
            onChange={setContactEmail}
          />
        )}

        <p className="text-sm text-gray-600">
          By continuing, you agree to our{" "}
          <Link href="/posting-rule" className="text-[#00a0e9] hover:underline">
            Posting Rule
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy-policy"
            className="text-[#00a0e9] hover:underline"
          >
            Privacy Policy
          </Link>{" "}
          Terms of Use
        </p>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full rounded-sm bg-[#f68b1e] py-3 text-base font-semibold text-card transition-colors hover:bg-[#e07d15] disabled:opacity-50 cursor-pointer"
        >
          {submitting ? "Publishing..." : "Submit"}
        </button>
      </div>
    </div>
  );
}
