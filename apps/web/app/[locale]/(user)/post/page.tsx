"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { postad } from "@/lib/post-ad";
import { Link } from "@/i18n/routing";
import { Separator } from "@/components/ui/separator";
import { Category, Subcategory } from "@/types/post-form";
import {
  ChevronRight,
  House,
  Upload,
  X,
  MapPin,
  Phone,
  Mail,
  Building2,
  User,
  Tag,
  FileText,
  DollarSign,
  Truck,
} from "lucide-react";
import { signUpload } from "@/actions/files";
import { toast } from "@/components/ui/sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type FormData = Record<string, string | number | boolean | string[]>;

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
          {postad.map((cat) => (
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
                <Image
                  src={cat.cateIcon}
                  alt={cat.name}
                  width={200}
                  height={200}
                  className="object-contain"
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
                    <Image
                      src={sub.subcate}
                      alt={sub.name}
                      width={200}
                      height={200}
                      className="object-contain"
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

// ─── Image Upload ─────────────────────────────────────────────────────────────
function ImageUpload({
  images,
  onChange,
  onUploaded,
}: {
  images: File[];
  onChange: (files: File[]) => void;
  onUploaded?: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Upload a single new file via /files/sign (scope=listing) and surface the
  // resulting public URL. The parent collects URLs into `imageUrls` for the
  // eventual submit (still a tracked follow-up — removal reconciliation lives
  // there too).
  const uploadOne = async (file: File) => {
    const signed = await signUpload(file.name, "listing");
    if (!signed.success) {
      toast.error(signed.error);
      return;
    }
    const res = await fetch(signed.data.signedUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (res.ok) onUploaded?.(signed.data.publicUrl);
    else toast.error("Failed to upload a photo");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    const room = Math.max(0, 8 - images.length);
    const newFiles = files.slice(0, room);
    onChange([...images, ...newFiles].slice(0, 8));
    void Promise.all(newFiles.map(uploadOne));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const room = Math.max(0, 8 - images.length);
    const newFiles = files.slice(0, room);
    onChange([...images, ...newFiles].slice(0, 8));
    void Promise.all(newFiles.map(uploadOne));
  };

  const remove = (i: number) => onChange(images.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold text-foregorund">Photos</label>
        <span className="text-xs text-muted-foreground">
          Max: {images.length} / 8
        </span>
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {images.map((f, i) => (
            <div
              key={i}
              className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group"
            >
              <img
                src={URL.createObjectURL(f)}
                alt=""
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => remove(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-sm bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-[#00a0e9] text-white text-[9px] text-center py-0.5 font-medium">
                  COVER
                </span>
              )}
            </div>
          ))}
          {images.length < 8 && (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-20 h-20 rounded-sm border-2 border-dashed border-muted flex items-center justify-center text-gray-400 hover:border-[#00a0e9] hover:text-[#00a0e9] transition-colors"
            >
              +
            </button>
          )}
        </div>
      )}

      {images.length === 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-sm p-14 flex flex-col items-center gap-2 cursor-pointer hover:border-[#00a0e9] hover:bg-[#e1f3fb] transition-all"
        >
          <Upload className="w-10 h-10 text-[#00a0e9]" />
          <p className="text-sm text-gray-500">
            Drag & Drop your photo here, or{" "}
            <span className="text-[#00a0e9] font-semibold underline">
              Click to Browse
            </span>
          </p>
          <p className="text-xs text-gray-400">
            Supports: jpg, png, gif, jpeg, heic, heif, dng, webp
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
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
            selectedSub && (
              <DynamicForm
                category={selectedCategory}
                sub={selectedSub}
                onBack={handleBack}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
