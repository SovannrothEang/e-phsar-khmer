"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { Category, Subcategory } from "@/types/post-form";
import {
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Building2,
  User,
  DollarSign,
  Truck,
} from "lucide-react";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import ImageUpload from "@/components/post/ImageUpload";
import ListingPostForm from "@/components/post/ListingPostForm";
import { CategorySelector } from "@/components/post/CategorySelector";
import { REAL_FORM_SUBCATEGORIES } from "@/lib/post-form-subcategories";
import { toast } from "@/components/ui/sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type FormData = Record<string, string | number | boolean | string[]>;

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 }) {
  const t = useTranslations("PostAd");
  return (
    <div className="flex items-center gap-2 ">
      {[
        { n: 1, label: t("stepChooseCategory") },
        { n: 2, label: t("stepFillInfo") },
      ].map(({ n, label }, i) => (
        <div key={n} className="flex items-center gap-2 py-2">
          {i > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
          <div className="flex items-center gap-2">
            <span
              className={`w-4 h-4 rounded-full type-button-sm flex items-center justify-center
                  ${step === n ? "bg-[#00a0e9] text-white" : step > n ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}
            >
              {n}
            </span>
            <span
              className={`type-body  ${step === n ? "text-foreground" : "text-gray-400"}`}
            >
              {label}
            </span>
          </div>
        </div>
      ))}
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
      <label className="block type-nav text-card-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-sm px-3 py-2.5 type-body text-card-foreground bg-card focus:outline-none focus:ring-2 focus:ring-[#00a0e9] focus:border-transparent appearance-none cursor-pointer"
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
      <label className="block type-nav text-card-foreground mb-1.5">
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
          className={`w-full border border-gray-200 rounded-sm py-2.5 type-body text-card-foreground focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent ${icon ? "pl-9 pr-3" : "px-3"}`}
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
      <label className="block type-nav text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 type-body text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
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
        <label className="block type-nav text-card-foreground mb-1.5">
          Brand <span className="text-red-500">*</span>
        </label>
        <select
          value={(form.brand as string) || ""}
          onChange={(e) =>
            setForm({ ...form, brand: e.target.value, model: "" })
          }
          className="w-full border border-gray-200 rounded-sm px-3 py-2.5 type-body text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-[#00a0e9] focus:border-transparent"
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
          <label className="block type-nav text-card-foreground mb-1.5">
            Model
          </label>
          <select
            value={(form.model as string) || ""}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="w-full border border-gray-200 rounded-sm px-3 py-2.5 type-body text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-[#00a0e9] focus:border-transparent"
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
      <label className="block type-nav text-card-foreground mb-2">
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
            <span className="type-button-sm text-gray-600">{t.name}</span>
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
      <label className="block type-nav text-gray-700 mb-2">Color</label>
      <div className="flex flex-wrap gap-2">
        {sub.colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setForm({ ...form, color: c })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 type-button-sm transition-all
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
          <label className="block type-nav text-gray-700 mb-1.5">
            Price <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 type-body">
              $
            </span>
            <input
              type="number"
              value={(form.price as string) || ""}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="0"
              className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2.5 type-body text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
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
          className="type-nav text-[#00a0e9] hover:underline"
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
        <h2 className="type-section-title">Post Details</h2>
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
          <label className="block type-nav text-card-foreground mb-1.5">
            Choose a category <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-3 border border-gray-200 rounded-sm px-3 py-2.5 flex-wrap">
            <span className="type-body text-foreground">{category.name}</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="type-body  text-foreground">{sub.name}</span>
            <button
              onClick={onBack}
              className="type-nav bg-[#00a0e9] text-card px-3 py-1.5 rounded-sm hover:bg-[#00a0e9]/80 transition-colors"
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
            <label className="block type-nav text-foreground">
              Tax Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 w-full">
              {sub.tax_types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, taxType: t })}
                  className={`py-2.5 type-nav transition-all border rounded-sm
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
            <label className="block type-nav text-foreground">
              Condition <span className="text-red-500">*</span>
            </label>
            {/* Using grid-cols-2 for perfect 50/50 split and gap-2 for the middle space */}
            <div className="grid grid-cols-2 gap-2 w-full">
              {sub.condition.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, condition: c })}
                  className={`py-2.5 type-nav transition-all border rounded-sm
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
            <label className="block type-nav text-foreground">
              Transmission
            </label>
            <div className="grid grid-cols-2 gap-2 w-full">
              {sub.transmission.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, transmission: t })}
                  className={`py-2.5 type-nav transition-all border rounded-sm
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
            <label className="block type-nav text-gray-700">
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
                  <span className="type-nav">{net.name}</span>
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
            <label className="block type-nav text-gray-700 mb-1.5">
              Salary <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                value={(form.salary as string) || ""}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                placeholder="Monthly salary"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 type-body text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
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
            <label className="block type-nav text-gray-700 mb-2">
              Delivery Available
            </label>
            <div className="flex gap-2">
              {["Yes", "No"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm({ ...form, delivery: v === "Yes" })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 type-nav transition-all
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
        <h2 className="type-card-heading text-gray-800 border-b border-gray-100 pb-3">
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
          className="px-6 py-2.5 rounded-lg border border-gray-200 type-nav text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-8 py-2.5 rounded-lg bg-orange-500 text-white type-body hover:bg-orange-600 transition-colors shadow-sm shadow-orange-200"
        >
          Post Ad
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PostPage() {
  const t = useTranslations("PostAd");
  const tSearch = useTranslations("Search");
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
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-10">
        <Breadcrumbs
          className="mb-6"
          items={[
            { label: tSearch("home"), href: "/" },
            { label: t("breadcrumb") },
          ]}
        />

        <div className="bg-card border rounded-sm p-6 shadow-sm">
          <h1 className="type-page-title mb-1">{t("title")}</h1>
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
