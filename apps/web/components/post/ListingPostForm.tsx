"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { ChevronRight, Loader2 } from "lucide-react";

import ImageUpload from "@/components/post/ImageUpload";
import { signUploadUser } from "@/actions/files";
import {
  createListing,
  getCarModels,
  getCarsForSaleConfig,
  type CarsForSaleConfig,
  type CreateListingPayload,
} from "@/actions/listings";
import type { BackendModel } from "@/lib/api/categories";
import { toast } from "@/components/ui/sonner";

/** Spec-fixed pickers with no backend source (spec-detail-one.md:210-228). */
const TAX_TYPES = ["Tax Paper", "Plate Number"] as const;
const ENGINE_TYPES = ["Diesel", "Electric", "Hybrid", "LPG", "Petrol"] as const;
const TRANSMISSIONS = ["Auto", "Manual"] as const;

/** Name → hex for the seeded color attribute rows; unknown names get gray. */
const COLOR_HEX: Record<string, string> = {
  Black: "#111111",
  White: "#ffffff",
  Silver: "#c0c0c0",
  Gray: "#808080",
  Grey: "#808080",
  Red: "#dc2626",
  Blue: "#2563eb",
  Green: "#16a34a",
  Yellow: "#eab308",
  Orange: "#f97316",
  Brown: "#92400e",
  Purple: "#7c3aed",
  Gold: "#d4af37",
  Beige: "#d8c7a7",
  Pink: "#ec4899",
};

// ─── Shared field bits (styled to match the page's inline fields) ─────────────
function FieldLabel({
  label,
  required,
}: {
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-card-foreground mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
  maxLength,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  min?: number;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        min={min}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg pl-3 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg pl-3 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
      >
        <option value="">{placeholder ?? "Select..."}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
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
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              value === o
                ? "border-[#00a0e9] bg-[#00a0e9]/10 text-[#00a0e9]"
                : "border-gray-200 text-gray-600 hover:border-[#00a0e9]/50"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Cars form ────────────────────────────────────────────────────────────────
export default function CarsPostForm({
  categoryName,
  subName,
  onBack,
}: {
  categoryName: string;
  subName: string;
  onBack: () => void;
}) {
  const locale = useLocale();
  const router = useRouter();

  const [config, setConfig] = useState<CarsForSaleConfig | null>(null);
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
  const [bodyType, setBodyType] = useState("");
  const [engineType, setEngineType] = useState("");
  const [transmission, setTransmission] = useState("");
  const [taxType, setTaxType] = useState("");
  const [colors, setColors] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">(
    "percent",
  );
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryFree, setDeliveryFree] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhones, setContactPhones] = useState(["", "", ""]);
  const [contactEmail, setContactEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCarsForSaleConfig(locale).then((cfg) => {
      if (cancelled) return;
      if (!cfg) {
        setConfigError(true);
        toast.error("Could not load the Cars for Sale form");
      } else {
        setConfig(cfg);
        // Prefill the contact section from the logged-in user's profile.
        if (cfg.contact.name) setContactName(cfg.contact.name);
        setContactPhones([
          cfg.contact.phones[0] ?? "",
          cfg.contact.phones[1] ?? "",
          cfg.contact.phones[2] ?? "",
        ]);
        setContactEmail(cfg.contact.email ?? "");
      }
      setConfigLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const onBrandChange = async (id: string) => {
    setBrandId(id);
    setModel("");
    setModels([]);
    if (!id) return;
    setModelsLoading(true);
    try {
      setModels(await getCarModels(id));
    } catch {
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const toggleColor = (name: string) =>
    setColors((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    );

  const submit = async () => {
    if (!config) {
      toast.error("Form data is not loaded yet");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const priceNum = Number(price);
    if (price === "" || !Number.isFinite(priceNum) || priceNum < 0) {
      toast.error("Enter a valid price");
      return;
    }
    if (brandId === "") {
      toast.error("Choose a brand");
      return;
    }
    if (year === "") {
      toast.error("Choose a year");
      return;
    }
    if (condition === "") {
      toast.error("Choose a condition");
      return;
    }
    if (!contactName.trim()) {
      toast.error("Contact name is required");
      return;
    }

    const attributes: Record<string, unknown> = {
      brand: config.brands.find((b) => b.id === brandId)?.name ?? brandId,
      year,
    };
    if (model) attributes.model = model;
    if (bodyType) attributes.bodyType = bodyType;
    if (engineType) attributes.engineType = engineType;
    if (transmission) attributes.transmission = transmission;
    if (taxType) attributes.taxType = taxType;
    if (colors.length > 0) attributes.color = colors.join(", ");

    const hasDiscount = discountValue !== "" || discountType !== "percent";
    const payload: CreateListingPayload = {
      categoryId: config.categoryId,
      subcategoryId: config.subcategoryId,
      title: title.trim(),
      price: priceNum,
      condition: condition === "New" ? "new" : "used",
      attributes,
      location: location.trim() || undefined,
      address: address.trim() || undefined,
      deliveryFree,
      contactName: contactName.trim(),
      contactPhones: contactPhones
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
      contactEmail: contactEmail.trim() || undefined,
      description: description.trim() || undefined,
    };
    if (hasDiscount && discountValue !== "") {
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
        <p className="mb-4">Could not load the Cars for Sale form.</p>
        <button
          onClick={onBack}
          className="text-sm text-[#00a0e9] font-semibold hover:underline"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div />
        <button
          onClick={onBack}
          className="text-sm text-[#00a0e9] font-semibold hover:underline"
        >
          Reset
        </button>
      </div>

      <ImageUpload
        images={files}
        onChange={setFiles}
        signFn={signUploadUser}
        onSigned={(p) => setPhotos((prev) => [...prev, p])}
      />

      <div className="space-y-4">
        <h2 className="text-lg font-bold">Post Details</h2>

        <TextInput
          label="Title"
          required
          maxLength={200}
          value={title}
          onChange={setTitle}
        />

        {/* Category breadcrumb */}
        <div>
          <FieldLabel label="Choose a category" required />
          <div className="flex items-center gap-3 border border-gray-200 rounded-sm px-3 py-2.5 flex-wrap">
            <span className="text-sm text-foreground">{categoryName}</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-foreground">{subName}</span>
            <button
              onClick={onBack}
              className="text-sm bg-[#00a0e9] text-card px-3 py-1.5 rounded-sm font-semibold hover:bg-[#00a0e9]/80 transition-colors"
            >
              Change
            </button>
          </div>
        </div>

        {/* Make / Model / Year / Condition */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Brand"
            required
            value={config.brands.find((b) => b.id === brandId)?.name ?? ""}
            onChange={(name) =>
              onBrandChange(
                config.brands.find((b) => b.name === name)?.id ?? "",
              )
            }
            options={config.brands.map((b) => b.name)}
            placeholder="Choose a brand"
          />
          <SelectField
            label="Model"
            value={model}
            onChange={setModel}
            options={modelsLoading ? [] : models.map((m) => m.name)}
            placeholder={modelsLoading ? "Loading..." : "Choose a model"}
            required={false}
          />
          <SelectField
            label="Year"
            required
            value={year}
            onChange={setYear}
            options={config.years}
            placeholder="Choose a year"
          />
          <ToggleGroup
            label="Condition"
            required
            options={["New", "Used"]}
            value={condition}
            onChange={setCondition}
          />
        </div>

        {/* Body types */}
        {config.bodyTypes.length > 0 && (
          <div>
            <FieldLabel label="Body Type" />
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {config.bodyTypes.map((bt) => (
                <button
                  key={bt.slug}
                  type="button"
                  onClick={() =>
                    setBodyType((prev) => (prev === bt.name ? "" : bt.name))
                  }
                  className={`flex flex-col items-center gap-1.5 border rounded-lg p-2.5 transition-colors ${
                    bodyType === bt.name
                      ? "border-[#00a0e9] bg-[#00a0e9]/10"
                      : "border-gray-200 hover:border-[#00a0e9]/50"
                  }`}
                >
                  <div className="w-10 h-10 relative flex items-center justify-center">
                    {bt.image ? (
                      <Image
                        src={bt.image}
                        alt={bt.name}
                        width={40}
                        height={40}
                        unoptimized
                        className="object-contain"
                      />
                    ) : (
                      <span className="text-gray-300 text-lg">🚗</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 text-center leading-tight">
                    {bt.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Engine / Transmission / Tax */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SelectField
            label="Engine Type"
            value={engineType}
            onChange={setEngineType}
            options={[...ENGINE_TYPES]}
            placeholder="Choose engine type"
          />
          <ToggleGroup
            label="Transmission"
            options={[...TRANSMISSIONS]}
            value={transmission}
            onChange={setTransmission}
          />
          <ToggleGroup
            label="Tax Type"
            options={[...TAX_TYPES]}
            value={taxType}
            onChange={setTaxType}
          />
        </div>

        {/* Colors */}
        {config.colors.length > 0 && (
          <div>
            <FieldLabel label="Colors" />
            <div className="flex flex-wrap gap-2">
              {config.colors.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  title={c.name}
                  onClick={() => toggleColor(c.name)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    colors.includes(c.name)
                      ? "border-[#00a0e9] scale-110"
                      : "border-gray-200"
                  }`}
                  style={{
                    backgroundColor: COLOR_HEX[c.name] ?? "#d4d4d4",
                  }}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* Price + Discount */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TextInput
            label="Price ($)"
            required
            type="number"
            min={0}
            placeholder="0"
            value={price}
            onChange={setPrice}
          />
          <TextInput
            label="Discount Value ($)"
            type="number"
            min={0}
            placeholder="0"
            value={discountValue}
            onChange={setDiscountValue}
          />
          <div>
            <FieldLabel label="Discount Type" />
            <select
              value={discountType}
              onChange={(e) =>
                setDiscountType(e.target.value as "percent" | "amount")
              }
              className="w-full border border-gray-200 rounded-lg pl-3 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            >
              <option value="percent">Percentage (%)</option>
              <option value="amount">Amount ($)</option>
            </select>
          </div>
        </div>

        <div>
          <FieldLabel label="Description" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full border border-gray-200 rounded-lg pl-3 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>

        {/* Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput
            label="Location"
            placeholder="Province / city"
            value={location}
            onChange={setLocation}
          />
          <TextInput
            label="Address"
            placeholder="Street, village..."
            value={address}
            onChange={setAddress}
          />
        </div>

        <div>
          <FieldLabel label="Free Delivery" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeliveryFree(true)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                deliveryFree
                  ? "border-[#00a0e9] bg-[#00a0e9]/10 text-[#00a0e9]"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setDeliveryFree(false)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                !deliveryFree
                  ? "border-[#00a0e9] bg-[#00a0e9]/10 text-[#00a0e9]"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TextInput
            label="Name"
            required
            placeholder="Your name"
            value={contactName}
            onChange={setContactName}
          />
          {contactPhones.map((p, i) => (
            <TextInput
              key={i}
              label={`Phone Number ${i + 1}`}
              placeholder="012 345 678"
              value={p}
              onChange={(v) =>
                setContactPhones((prev) =>
                  prev.map((x, idx) => (idx === i ? v : x)),
                )
              }
            />
          ))}
          <TextInput
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={contactEmail}
            onChange={setContactEmail}
          />
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-[#00a0e9] text-card py-3 rounded-sm font-bold hover:bg-[#00a0e9]/80 transition-colors disabled:opacity-50"
        >
          {submitting ? "Publishing..." : "Post Ad"}
        </button>
      </div>
    </div>
  );
}
