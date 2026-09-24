"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { Separator } from "@/components/ui/separator";
import { Category, Subcategory } from "@/types/post-form";
import {
  ChevronRight,
  House,
  MapPin,
  Phone,
  Mail,
  Building2,
  User,
  DollarSign,
  Truck,
} from "lucide-react";
import ImageUpload from "@/components/post/ImageUpload";
import ListingPostForm from "@/components/post/ListingPostForm";
import DbImage from "@/components/common/DbImage";
import { getPostCategories } from "@/actions/post-categories";
import { toast } from "@/components/ui/sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type FormData = Record<string, string | number | boolean | string[]>;

/**
 * Subcategories on the real listing form (`ListingPostForm`), which renders
 * exactly the fields the subcategory's own `field_schema` declares. Everything
 * else still falls through to the mock `DynamicForm` below, whose submit is
 * deliberately unwired — so this list is an explicit opt-in, not a guess.
 */
const REAL_FORM_SUBCATEGORIES = [
  "cars-for-sale",
  "bicycles",
  "motorcycles-for-sale",
  "vehicles-for-rent",
  "maintenance-and-repair",
  "lorries-vans-and-tractors",
  "financing-and-insurance",
  "tuk-tuk-and-remork",
  "parts-and-accessories",
  "vehicles-others",
  // Phones & Tablets — opted in 2026-09-22 once the `storage`, `accessory`
  // and `network` blocks existed (they were the family's only unrenderable
  // keys; a key with no block vanishes silently).
  "phones",
  "tablets",
  "smart-watches",
  "phone-accessories",
  "phone-numbers",
  // Computers & Accessories — opted in 2026-09-22 once the `screenSize`,
  // `ram`, `cpu`, `vga` and `type` blocks existed (the family's only
  // unrenderable keys; a key with no block vanishes silently). Note the parts
  // subcategory's slug is `computers-parts-and-accessories` — the cars family
  // already owns the bare `parts-and-accessories`.
  "laptops",
  "desktops",
  "all-in-one",
  "monitors",
  "printers-and-scanners",
  "computers-parts-and-accessories",
  "softwares",
  // Electronics & Appliances — opted in 2026-09-22. No new block was needed:
  // the family's 13 keys (photos/title/type/condition/price/discount/
  // description/location/address/deliveryFree/contact trio) are all already
  // renderable, `type` by the same block the computers parts form uses.
  // All 12 declare Condition (captain, 2026-09-22) — spec-detail-four.md
  // omits it on machinery/security-cameras/lighting, but the captain's mock
  // groups those with the Fridges & Freezers form, so the seed and the
  // ListingSpecs condition list both carry it.
  "washing-machines-and-dryers",
  "fridges-and-freezers",
  "air-conditioning-and-heating",
  "tools",
  "machinery",
  "consumer-electronics",
  "security-cameras",
  "lighting",
  "cameras-and-camcorders",
  "tvs-videos-and-audio",
  "home-appliances",
  "video-games-consoles-toys",
  // Home & Land — opted in 2026-09-22 once the `bedroom`, `bathroom`, `facing`
  // and `size` blocks existed (the family's only unrenderable keys; a key with
  // no block vanishes silently). The property cluster renders above the
  // identity cluster so Type lands after Size, per the captain's mock. Note
  // `facing` was dropped from apartment-for-rent in the seed the same day
  // (mock wins over spec-detail-five.md, which listed it) — the block simply
  // does not render for a subcategory that does not declare it.
  "house-for-sale",
  "house-for-rent",
  "condo-for-sale",
  "apartment-for-rent",
  // The rest of Home & Land — opted in 2026-09-23. **No new block was needed
  // this time**: every key these eight declare (`size`, `type`, `price`,
  // `description`, `location`, `address`, the contact trio) already had a
  // render block, because the property cluster added for the four above
  // (2026-09-22) covered `size` and the `type` block already existed for the
  // computers/electronics forms. Three of them — properties-wanted,
  // agent-services and home-and-land-others — declare **no `size` and no
  // `price`**, which the schema gating handles on its own: the Price block is
  // skipped at render, at validation and in the payload, and `listings.price`
  // is nullable.
  "land-for-sale",
  "land-for-rent",
  "commercial-properties-for-sale",
  "commercial-properties-for-rent",
  "room-for-rent",
  "properties-wanted",
  "agent-services",
  "home-and-land-others",
  // Jobs — all 36 subcategories, opted in 2026-09-23. They share one form
  // (spec-detail-six.md: "they have the same form"), which needed three new
  // blocks: `jobType`, `experience` and `company`. The first two are pickers
  // whose lists come from the admin-managed `jobtypes` set and the (global)
  // `experiences` set; `company` is a plain text field. The job-type key was
  // ALSO renamed from `type` to `jobType` in the seed the same day — `type`
  // maps to the `types` set, whose rows are ticked for computers/property and
  // for no jobs subcategory at all, so the picker resolved to an empty list on
  // a starred field; `jobType` is what `SET_FIELD_KEYS`, `ListingSpecs` and
  // the `jobtypes` admin page already expected.
  "accounting-jobs",
  "administration",
  "architecture-engineering",
  "assistant-secretary",
  "audit-taxation",
  "banking-insurance",
  "cashier-receptionist",
  "catering-restaurant",
  "cleaner-maid",
  "consultancy",
  "customer-service",
  "design",
  "education-training",
  "finance",
  "freight-shipping-delivery-warehouse",
  "hotel-hospitality",
  "human-resources",
  "information-technology",
  "lawyer-legal-services",
  "management",
  "manufacturing",
  "marketing",
  "media-advertising",
  "medical-health-nursing",
  "merchandising-purchasing",
  "operations",
  "project-management",
  "quality-control",
  "resort-casino",
  "sales",
  "security-driver",
  "technicians",
  "telecommunications",
  "translations-interpretation",
  "travel-agents-ticket-sales",
  "jobs-others",
];

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 ">
      {[
        { n: 1, label: "Choose a category" },
        { n: 2, label: "Fill Information" },
      ].map(({ n, label }, i) => (
        <div key={n} className="flex items-center gap-2 py-2">
          {i > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
          <div className="flex items-center gap-2">
            <span
              className={`w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center
                  ${step === n ? "bg-[#00a0e9] text-white" : step > n ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}
            >
              {n}
            </span>
            <span
              className={`text-sm  ${step === n ? "text-foreground" : "text-gray-400"}`}
            >
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Category Selector (Step 1) ───────────────────────────────────────────────
function CategorySelector({
  onSelect,
}: {
  onSelect: (cat: Category, sub: Subcategory) => void;
}) {
  const [hoveredCat, setHoveredCat] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPostCategories("en")
      .then((rows) => {
        if (!cancelled) setCategories(rows);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCatEnter = (cat: Category) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHoveredCat(cat);
  };

  const handlePanelLeave = () => {
    leaveTimer.current = setTimeout(() => setHoveredCat(null), 150);
  };

  const handlePanelEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };

  return (
    <div className="flex">
      <div className="w-64 flex-shrink-0 flex flex-col">
        <div className="px- py-3 flex-shrink-0">
          <span className="flex items-center gap-2 text-sm  text-foreground">
            <span className="w-4 h-4 rounded-full bg-[#00a0e9] text-muted text-xs flex items-center justify-center">
              1
            </span>
            Choose a category
          </span>
        </div>
        <ul>
          {(categories ?? []).map((cat) => (
            <li
              key={cat.slug}
              onMouseEnter={() => handleCatEnter(cat)}
              onMouseLeave={handlePanelLeave}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all border-l-2
                ${
                  hoveredCat?.slug === cat.slug
                    ? "bg-[#00a0e9]/10 border-l-[#00a0e9]"
                    : "border-l-transparent hover:bg-gray-50"
                }`}
            >
              <div className="w-8 h-8 relative flex-shrink-0">
                <DbImage
                  src={cat.cateIcon}
                  alt={cat.name}
                  width={32}
                  height={32}
                  className="object-contain"
                  fallback={
                    <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-muted text-xs font-medium text-muted-foreground">
                      {cat.name.charAt(0)}
                    </span>
                  }
                />
              </div>
              <span
                className={`text-sm flex-1 ${hoveredCat?.slug === cat.slug ? "font-semibold text-[#00a0e9]" : "font-medium text-foreground"}`}
              >
                {cat.name}
              </span>
              <ChevronRight
                className={`w-4 h-4 flex-shrink-0 transition-colors ${hoveredCat?.slug === cat.slug ? "text-[#00a0e9]" : "text-gray-500"}`}
              />
            </li>
          ))}
        </ul>
      </div>

      {/* Vertical Separator */}
      <div className="w-px bg-gray-200 flex-shrink-0" />

      {/* Right: Subcategories - scroll only when > 15 items */}
      <div
        className="flex-1  flex flex-col"
        onMouseEnter={handlePanelEnter}
        onMouseLeave={handlePanelLeave}
      >
        <div className="px-6 py-3 flex-shrink-0">
          <span className="flex items-center gap-2 text-sm text-gray-500">
            <span
              className={`w-4 h-4 rounded-full text-xs flex items-center justify-center ${hoveredCat ? "bg-[#00a0e9]  text-foreground" : "bg-gray-300 text-white"}`}
            >
              2
            </span>
            Select a subcategory
          </span>
        </div>

        {hoveredCat ? (
          <ul
            className={
              hoveredCat.subcategories.length > 15 ? "overflow-y-auto" : ""
            }
            style={
              hoveredCat.subcategories.length > 15
                ? { maxHeight: "620px" }
                : undefined
            }
          >
            {hoveredCat.subcategories.map((sub) => (
              <li key={sub.slug}>
                <button
                  onClick={() => onSelect(hoveredCat, sub)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-100 transition-colors group text-left"
                >
                  <div className="w-8 h-8 relative flex-shrink-0">
                    <DbImage
                      src={sub.subcate}
                      alt={sub.name}
                      width={32}
                      height={32}
                      className="object-contain"
                      fallback={
                        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-muted text-xs font-medium text-muted-foreground">
                          {sub.name.charAt(0)}
                        </span>
                      }
                    />
                  </div>
                  <span className="text-sm text-foreground group-hover:text-[#00a0e9] flex-1 transition-colors">
                    {sub.name}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#00a0e9] flex-shrink-0 transition-colors" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-400 py-24">
            <ChevronRight className="w-8 h-8 text-gray-200 mb-2" />
            <p className="text-sm">Hover a category to see options</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Field Components ─────────────────────────────────────────────────────────
function SelectField({
  label,
  required,
  options,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-card-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-card-foreground bg-card focus:outline-none focus:ring-2 focus:ring-[#00a0e9] focus:border-transparent appearance-none cursor-pointer"
      >
        <option value="">Select {label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputField({
  label,
  required,
  placeholder,
  value,
  onChange,
  type = "text",
  icon,
}: {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-card-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border border-gray-200 rounded-sm py-2.5 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent ${icon ? "pl-9 pr-3" : "px-3"}`}
        />
      </div>
    </div>
  );
}

function TextareaField({
  label,
  required,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
      />
    </div>
  );
}

function BrandModelField({
  sub,
  form,
  setForm,
}: {
  sub: Subcategory;
  form: FormData;
  setForm: (f: FormData) => void;
}) {
  if (!sub.brands) return null;
  const selectedBrand = sub.brands.find((b) => b.name === form.brand);
  return (
    <>
      <div>
        <label className="block text-sm font-semibold text-card-foreground mb-1.5">
          Brand <span className="text-red-500">*</span>
        </label>
        <select
          value={(form.brand as string) || ""}
          onChange={(e) =>
            setForm({ ...form, brand: e.target.value, model: "" })
          }
          className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-[#00a0e9] focus:border-transparent"
        >
          <option value="">Select Brand</option>
          {sub.brands.map((b) => (
            <option key={b.slug} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      {selectedBrand?.Model && (
        <div>
          <label className="block text-sm font-semibold text-card-foreground mb-1.5">
            Model
          </label>
          <select
            value={(form.model as string) || ""}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-[#00a0e9] focus:border-transparent"
          >
            <option value="">{selectedBrand.Model?.[0].name} </option>
            {selectedBrand.Model.map((m) => (
              <option key={m.slug} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

function TypesField({
  sub,
  form,
  setForm,
}: {
  sub: Subcategory;
  form: FormData;
  setForm: (f: FormData) => void;
}) {
  if (!sub.Types) return null;
  return (
    <div>
      <label className="block text-sm font-semibold text-card-foreground mb-2">
        Type <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {sub.Types.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => setForm({ ...form, type: t.name })}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all text-center
              ${form.type === t.name ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-orange-300 hover:bg-orange-50"}`}
          >
            <div className="w-10 h-10 relative">
              <Image
                src={t.image}
                alt={t.name}
                width={200}
                height={200}
                className="object-contain"
                //onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <span className="text-xs font-medium text-gray-600 leading-tight">
              {t.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorsField({
  sub,
  form,
  setForm,
}: {
  sub: Subcategory;
  form: FormData;
  setForm: (f: FormData) => void;
}) {
  if (!sub.colors) return null;
  const colorMap: Record<string, string> = {
    Red: "#ef4444",
    Blue: "#3b82f6",
    Green: "#22c55e",
    Yellow: "#eab308",
    Black: "#111827",
    White: "#f9fafb",
  };
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Color
      </label>
      <div className="flex flex-wrap gap-2">
        {sub.colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setForm({ ...form, color: c })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-xs font-medium transition-all
              ${form.color === c ? "border-orange-500" : "border-gray-200 hover:border-gray-300"}`}
          >
            <span
              className="w-4 h-4 rounded-full border border-gray-200"
              style={{ background: colorMap[c] ?? c }}
            />
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function DiscountPriceField({
  sub,
  form,
  setForm,
}: {
  sub: Subcategory;
  form: FormData;
  setForm: (f: FormData) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {sub.discount && (
        <SelectField
          label="Discount Type"
          options={sub.discount}
          value={(form.discountType as string) || ""}
          onChange={(v) => setForm({ ...form, discountType: v })}
        />
      )}
      {sub.price !== undefined && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Price <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">
              $
            </span>
            <input
              type="number"
              value={(form.price as string) || ""}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="0"
              className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dynamic Form (Step 2) ────────────────────────────────────────────────────
function DynamicForm({
  category,
  sub,
  onBack,
}: {
  category: Category;
  sub: Subcategory;
  onBack: () => void;
}) {
  const [images, setImages] = useState<File[]>([]);
  // Parallel store of Supabase public URLs as photos finish uploading. Consumed
  // by the listing submit (still TODO); kept here so the upload mechanism is
  // fully wired today.
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [form, setForm] = useState<FormData>({});

  const isJob = !!sub.salary;

  // Listing submit is a tracked follow-up (dynamic field_schema form → POST
  // /listings). Photos are already uploaded to Supabase; stage their public
  // URLs here so the wiring is ready when the submit lands.
  const handleSubmit = () => {
    const photos = imageUrls.map((url, sort) => ({ url, path: url, sort }));
    if (photos.length === 0) {
      toast.error("Add at least one photo");
      return;
    }
    // TODO: POST /listings with `form` + `photos`.
    toast.success("Photos staged — listing submit is not wired yet");
  };

  return (
    <div className="space-y-6">
      {/* Reset / breadcrumb */}
      <div className="flex justify-between items-center">
        <div />
        <button
          onClick={onBack}
          className="text-sm text-[#00a0e9] font-semibold hover:underline"
        >
          Reset
        </button>
      </div>

      {/* Photos */}

      <ImageUpload
        images={images}
        onChange={setImages}
        onUploaded={(url) => setImageUrls((prev) => [...prev, url])}
      />

      {/* Post Details */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Post Details</h2>
        <Separator />

        <InputField
          label="Title"
          required
          placeholder=""
          value={(form.title as string) || ""}
          onChange={(v) => setForm({ ...form, title: v })}
        />
        {/* Category breadcrumb */}
        <div>
          <label className="block text-sm font-semibold text-card-foreground mb-1.5">
            Choose a category <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-3 border border-gray-200 rounded-sm px-3 py-2.5 flex-wrap">
            <span className="text-sm text-foreground">{category.name}</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-sm  text-foreground">{sub.name}</span>
            <button
              onClick={onBack}
              className="text-sm bg-[#00a0e9] text-card px-3 py-1.5 rounded-sm font-semibold hover:bg-[#00a0e9]/80 transition-colors"
            >
              Change
            </button>
          </div>
        </div>
        {/* Brand + Model */}
        <BrandModelField sub={sub} form={form} setForm={setForm} />
        {/* Years */}
        {sub.years && (
          <SelectField
            label="Year"
            required
            options={sub.years.map(String)}
            value={(form.year as string) || ""}
            onChange={(v) => setForm({ ...form, year: v })}
          />
        )}
        {/* Tax Types */}
        {sub.tax_types && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Tax Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 w-full">
              {sub.tax_types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, taxType: t })}
                  className={`py-2.5 text-sm font-medium transition-all border rounded-sm
                    ${
                      form.taxType === t
                        ? "bg-[#e1f5fe] text-[#00a0e9] border-[#00a0e9]"
                        : "bg-card text-foreground border-gray-300 hover:border-[#00a0e9] hover:text-[#00a0e9]"
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Condition */}
        {sub?.condition && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Condition <span className="text-red-500">*</span>
            </label>
            {/* Using grid-cols-2 for perfect 50/50 split and gap-2 for the middle space */}
            <div className="grid grid-cols-2 gap-2 w-full">
              {sub.condition.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, condition: c })}
                  className={`py-2.5 text-sm font-medium transition-all border rounded-sm
                   ${
                     form.condition === c
                       ? "bg-[#e1f5fe] text-[#00a0e9] border-[#00a0e9]"
                       : "bg-card text-foreground border-gray-300 hover:border-[#00a0e9] hover:text-[#00a0e9]"
                   }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Types */}
        <TypesField sub={sub} form={form} setForm={setForm} />

        {/* Engine Types */}
        {sub.engine_types && (
          <SelectField
            label="Engine Type"
            options={sub.engine_types}
            value={(form.engineType as string) || ""}
            onChange={(v) => setForm({ ...form, engineType: v })}
          />
        )}

        {/* Transmission */}
        {sub.transmission && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Transmission
            </label>
            <div className="grid grid-cols-2 gap-2 w-full">
              {sub.transmission.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, transmission: t })}
                  className={`py-2.5 text-sm font-medium transition-all border rounded-sm
                    ${
                      form.transmission === t
                        ? "bg-[#e1f5fe] text-[#00a0e9] border-[#00a0e9]"
                        : "bg-card text-foreground border-gray-300 hover:border-[#00a0e9] hover:text-[#00a0e9]"
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Colors */}
        <ColorsField sub={sub} form={form} setForm={setForm} />

        {/* Storages */}
        {sub.storages && (
          <SelectField
            label="Storage"
            options={sub.storages}
            value={(form.storage as string) || ""}
            onChange={(v) => setForm({ ...form, storage: v })}
          />
        )}

        {/* Screen Size */}
        {sub.screen_size && (
          <SelectField
            label="Screen Size (inch)"
            options={sub.screen_size}
            value={(form.screenSize as string) || ""}
            onChange={(v) => setForm({ ...form, screenSize: v })}
          />
        )}

        {/* RAM */}
        {sub.ram && (
          <SelectField
            label="RAM"
            options={sub.ram}
            value={(form.ram as string) || ""}
            onChange={(v) => setForm({ ...form, ram: v })}
          />
        )}

        {/* CPU */}
        {sub.cpus && (
          <SelectField
            label="CPU"
            options={sub.cpus}
            value={(form.cpu as string) || ""}
            onChange={(v) => setForm({ ...form, cpu: v })}
          />
        )}

        {/* VGA */}
        {sub.vgas && (
          <SelectField
            label="VGA"
            options={sub.vgas}
            value={(form.vga as string) || ""}
            onChange={(v) => setForm({ ...form, vga: v })}
          />
        )}

        {/* Network */}
        {sub.network && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Network
              <span className="text-red-500">*</span>
            </label>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {sub.network.map((net) => (
                <button
                  key={net.slug}
                  type="button"
                  onClick={() => setForm({ ...form, network: net.slug })}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all
            ${
              form.network === net.slug
                ? "border-orange-500 bg-orange-50 text-orange-600"
                : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"
            }`}
                >
                  <Image
                    src={net.image}
                    width={20}
                    height={20}
                    alt={net.name}
                    className="object-contain"
                  />
                  <span className="text-sm font-medium">{net.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Accessories */}
        {sub.accessories && (
          <SelectField
            label="Compatible With"
            options={sub.accessories}
            value={(form.accessory as string) || ""}
            onChange={(v) => setForm({ ...form, accessory: v })}
          />
        )}

        {/* Bedrooms / Bathrooms */}
        {sub.bedrooms && (
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Bedrooms"
              options={sub.bedrooms.map(String)}
              value={(form.bedrooms as string) || ""}
              onChange={(v) => setForm({ ...form, bedrooms: v })}
            />
            {sub.bathrooms && (
              <SelectField
                label="Bathrooms"
                options={sub.bathrooms.map(String)}
                value={(form.bathrooms as string) || ""}
                onChange={(v) => setForm({ ...form, bathrooms: v })}
              />
            )}
          </div>
        )}

        {/* Facing */}
        {sub.facing && (
          <SelectField
            label="Facing"
            options={sub.facing}
            value={(form.facing as string) || ""}
            onChange={(v) => setForm({ ...form, facing: v })}
          />
        )}

        {/* Size */}
        {sub.size !== undefined && (
          <InputField
            label="Size"
            placeholder="e.g. 200 sqft"
            value={(form.size as string) || ""}
            onChange={(v) => setForm({ ...form, size: v })}
          />
        )}

        {/* Experience (Jobs) */}
        {sub.experience && (
          <SelectField
            label="Experience Required"
            required
            options={sub.experience}
            value={(form.experience as string) || ""}
            onChange={(v) => setForm({ ...form, experience: v })}
          />
        )}

        {/* Salary (Jobs) */}
        {isJob && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Salary <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                value={(form.salary as string) || ""}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                placeholder="Monthly salary"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
        )}

        {/* Price + Discount */}
        {!isJob && (sub.price !== undefined || sub.discount) && (
          <DiscountPriceField sub={sub} form={form} setForm={setForm} />
        )}

        {/* Delivery */}
        {sub.delivery !== undefined && !isJob && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Delivery Available
            </label>
            <div className="flex gap-2">
              {["Yes", "No"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm({ ...form, delivery: v === "Yes" })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all
                    ${
                      (form.delivery === true && v === "Yes") ||
                      (form.delivery === false && v === "No")
                        ? "border-orange-500 bg-orange-50 text-orange-600"
                        : "border-gray-200 text-gray-600 hover:border-orange-300"
                    }`}
                >
                  <Truck className="w-4 h-4" />
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <TextareaField
          label="Description"
          required
          placeholder="Describe your listing in detail..."
          value={(form.description as string) || ""}
          onChange={(v) => setForm({ ...form, description: v })}
        />
      </div>

      {/* Location & Contact */}
      <div className="bg-white rounded-xl p-5 space-y-4">
        <h2 className="text-base font-bold text-gray-800 border-b border-gray-100 pb-3">
          Location & Contact
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Location"
            required
            placeholder="City / Province"
            value={(form.location as string) || ""}
            onChange={(v) => setForm({ ...form, location: v })}
            icon={<MapPin className="w-4 h-4" />}
          />
          <InputField
            label="Address"
            placeholder="Street address"
            value={(form.address as string) || ""}
            onChange={(v) => setForm({ ...form, address: v })}
            icon={<MapPin className="w-4 h-4" />}
          />
          <InputField
            label="Company Name"
            placeholder="Your company (optional)"
            value={(form.company_name as string) || ""}
            onChange={(v) => setForm({ ...form, company_name: v })}
            icon={<Building2 className="w-4 h-4" />}
          />
          <InputField
            label="Contact Name"
            required
            placeholder="Your name"
            value={(form.name_contact as string) || ""}
            onChange={(v) => setForm({ ...form, name_contact: v })}
            icon={<User className="w-4 h-4" />}
          />
          <InputField
            label="Phone"
            required
            placeholder="+855 ..."
            type="tel"
            value={(form.phone as string) || ""}
            onChange={(v) => setForm({ ...form, phone: v })}
            icon={<Phone className="w-4 h-4" />}
          />
          <InputField
            label="Email"
            placeholder="email@example.com"
            type="email"
            value={(form.email as string) || ""}
            onChange={(v) => setForm({ ...form, email: v })}
            icon={<Mail className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pb-8">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-8 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm shadow-orange-200"
        >
          Post Ad
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PostPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [selectedSub, setSelectedSub] = useState<Subcategory | null>(null);

  const handleSelect = (cat: Category, sub: Subcategory) => {
    setSelectedCategory(cat);
    setSelectedSub(sub);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setSelectedCategory(null);
    setSelectedSub(null);
  };

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
          <Link
            href="/"
            className="group flex items-center transition-colors duration-150 text-gray-500 dark:text-gray-400 hover:text-blue-300"
          >
            <House
              size={16}
              className="text-gray-500 dark:text-gray-400 group-hover:text-blue-300"
            />
            <span className="text-gray-500 dark:text-gray-400 group-hover:text-blue-300 pl-1.5">
              Home
            </span>
          </Link>
          <ChevronRight size={16} className="block text-gray-500" />
          <h1 className="text-gray-500 dark:text-gray-400">Post</h1>
        </nav>

        <div className="bg-card border rounded-sm p-6 shadow-sm">
          <h1 className="text-2xl font-bold  mb-1">Post an Ad</h1>
          <StepIndicator step={step} />

          {step === 1 ? (
            <>
              <Separator />
              <br />

              <CategorySelector onSelect={handleSelect} />
            </>
          ) : (
            selectedCategory &&
            selectedSub &&
            (REAL_FORM_SUBCATEGORIES.includes(selectedSub.slug) ? (
              <ListingPostForm
                categorySlug={selectedCategory.slug}
                subcategorySlug={selectedSub.slug}
                categoryName={selectedCategory.name}
                subName={selectedSub.name}
                onBack={handleBack}
              />
            ) : (
              <DynamicForm
                category={selectedCategory}
                sub={selectedSub}
                onBack={handleBack}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
