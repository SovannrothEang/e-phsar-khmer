"use client";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldTitle,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { useState } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import { categories } from "@/lib/categories";
import type { Category, Subcategory, BrandOption } from "@/types/category";
import clsx from "clsx";
import { Separator } from "@/components/ui/separator";

export function CategorySelecter({
  onSelectAction,
}: {
  onSelectAction: (cat: Category, sub: Subcategory) => void;
}) {
  const [activeCategory, setActiveCategory] = useState(categories[0]);

  return (
    <>
      <p className="text-base font-semibold pt-4 px-6">Category</p>
      <div className="grid grid-cols-2">
        <div className="border-r">
          <div className="py-4 px-6">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/40">
                1
              </div>
              Choose a category
            </div>
            <div className="max-h-[860px] pt-4 pb-4">
              {categories.map((category) => {
                const active = activeCategory.slug === category.slug;
                return (
                  <button
                    key={category.slug}
                    onMouseEnter={() => setActiveCategory(category)}
                    className={clsx(
                      "flex w-full items-center justify-between px-5 py-3 transition-colors duration-100 cursor-pointer",
                      active
                        ? "bg-sky-50 dark:bg-sky-950/30"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <Image
                        src={category.cateIcon}
                        alt={category.name}
                        width={42}
                        height={42}
                        className="object-contain shrink-0"
                        unoptimized
                      />
                      <span
                        className={clsx(
                          "text-sm",
                          active
                            ? "font-semibold text-sky-600 dark:text-sky-400"
                            : "text-foreground",
                        )}
                      >
                        {category.name}
                      </span>
                    </div>
                    <IconChevronRight
                      size={18}
                      className={clsx(
                        active ? "text-sky-500" : "text-muted-foreground",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {/* RIGHT SUBCATEGORY */}
        <div className="py-4">
          <div className="flex items-center gap-2 text-foreground text-sm px-4">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/40">
              2
            </div>
            Select a subcategory
          </div>
          <div className="max-h-[800px] overflow-y-auto pt-4 pb-4">
            {activeCategory.subcategories?.map((sub) => (
              <button
                onClick={() => onSelectAction(activeCategory, sub)}
                key={sub.slug}
                className="flex w-full items-center justify-between px-5 py-3 hover:bg-muted/60 transition-colors duration-100 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <Image
                    src={sub.subcate}
                    alt={sub.name}
                    width={38}
                    height={38}
                    className="object-contain shrink-0"
                    unoptimized
                  />
                  <span className="text-sm text-foreground">{sub.name}</span>
                </div>
                <IconChevronRight size={18} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function PostForm({
  category,
  subcategory,
  onBackAction,
}: {
  category: Category;
  subcategory: Subcategory;
  onBackAction: () => void;
}) {
  const [selectedBrand, setSelectedBrand] = useState<BrandOption | null>(null);
  const subcate = subcategory;

  // Then access:
  // etc.
  return (
    <div className="w-full max-w-4xl">
      <div className="p-6">
        <form>
          <FieldGroup>
            <FieldSet>
              <FieldLegend>Post Details</FieldLegend>
              <Separator />
              <FieldGroup>
                <Field>
                  <FieldLabel>
                    Title <span className="text-red-500">*</span>
                  </FieldLabel>
                  <Input
                    id="title"
                    className="h-10 w-auto rounded-sm"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>
                    Choose a category <span className="text-red-500">*</span>
                  </FieldLabel>
                  <div className="flex justify-start items-center border-2 border-dashed h-12 rounded-sm p-2 gap-2">
                    {category.name}{" "}
                    <IconChevronRight className="text-muted-foreground scale-60" />{" "}
                    {subcategory.name}
                    <button
                      type="button"
                      onClick={onBackAction}
                      className="bg-[#00a0e9] h-8 w-18 rounded-sm text-white text-sm cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                </Field>
                <Field>
                  {subcate?.brands && (
                    <>
                      <FieldLabel>
                        Brand <span className="text-red-500">*</span>
                      </FieldLabel>
                      <Select
                        onValueChange={(value) => {
                          const brand = subcate.brands?.find(
                            (b) => b.slug === value,
                          );
                          setSelectedBrand(brand || null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose Brand" />
                        </SelectTrigger>
                        <SelectContent
                          side="bottom"
                          align="start"
                          position="popper"
                          avoidCollisions={false}
                          className="max-h-[240px]"
                        >
                          <SelectGroup className="max-h-[240px] overflow-y-auto">
                            {subcate.brands.map((brand) => (
                              <SelectItem
                                key={brand.brandId}
                                value={brand.slug}
                              >
                                <div className="flex items-center gap-2">
                                  <Image
                                    src={brand.image}
                                    alt={brand.name}
                                    width={50}
                                    height={50}
                                    unoptimized
                                  />
                                  <span>{brand.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  {subcate?.brands && (
                    <>
                      <FieldLabel>
                        Model <span className="text-red-500">*</span>
                      </FieldLabel>

                      <Select disabled={!selectedBrand}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose Model" />
                        </SelectTrigger>
                        <SelectContent
                          side="bottom"
                          align="start"
                          position="popper"
                          avoidCollisions={false}
                          className="max-h-[240px]"
                        >
                          <SelectGroup className="max-h-[240px] overflow-y-auto">
                            {selectedBrand?.model?.map((model) => (
                              <SelectItem
                                key={model.modelId}
                                value={model.slug}
                              >
                                {model.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  {subcate?.years && (
                    <>
                      <FieldLabel>
                        Year<span className="text-red-500">*</span>
                      </FieldLabel>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose Years" />
                        </SelectTrigger>
                        <SelectContent
                          side="bottom"
                          align="start"
                          position="popper"
                          avoidCollisions={false}
                          className="max-h-[240px]"
                        >
                          <SelectGroup className="max-h-[240px] overflow-y-auto">
                            {subcate?.years?.map((year) => (
                              <SelectItem key={year.yearId} value={year.name}>
                                {year.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  <FieldLabel>
                    Tax Type <span className="text-red-500">*</span>
                  </FieldLabel>
                  <FieldLabel>
                    Condition <span className="text-red-500">*</span>
                  </FieldLabel>
                  {subcate.bodyTypes && (
                    <>
                      <FieldLabel>Body Type</FieldLabel>
                      <Select>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          side="bottom"
                          align="start"
                          position="popper"
                          avoidCollisions={false}
                          className="max-h-[240px]"
                        >
                          <SelectGroup className="max-h-[240px] overflow-y-auto">
                            {subcate?.bodyTypes?.map((bodytype) => (
                              <SelectItem
                                key={bodytype.bodyTypeId}
                                value={bodytype.slug}
                              >
                                <div className="flex items-center gap-2">
                                  <Image
                                    src={bodytype.image}
                                    alt={bodytype.name}
                                    width={50}
                                    height={50}
                                    unoptimized
                                  />
                                  <span>{bodytype.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  {subcate?.engine_types && (
                    <>
                      <FieldLabel>Engine Type</FieldLabel>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose EngineType" />
                        </SelectTrigger>
                        <SelectContent
                          side="bottom"
                          align="start"
                          position="popper"
                          avoidCollisions={false}
                          className="max-h-[240px]"
                        >
                          <SelectGroup className="max-h-[240px] overflow-y-auto">
                            {subcate?.engine_types?.map((engine) => (
                              <SelectItem
                                key={engine.engineId}
                                value={engine.name}
                              >
                                {engine.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  <FieldLabel>Transmission</FieldLabel>
                  {subcate?.colors && (
                    <>
                      <FieldLabel>
                        Color<span className="text-red-500">*</span>
                      </FieldLabel>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose Colors" />
                        </SelectTrigger>
                        <SelectContent
                          side="bottom"
                          align="start"
                          position="popper"
                          avoidCollisions={false}
                          className="max-h-[240px]"
                        >
                          <SelectGroup className="max-h-[240px] overflow-y-auto">
                            {subcate?.colors?.map((color) => (
                              <SelectItem
                                key={color.colorId}
                                value={color.name}
                              >
                                {color.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  <FieldLabel>Discount</FieldLabel>
                  <Input type="number" className="h-10 w-full rounded-sm" />
                  <FieldLabel>
                    Price<span className="text-red-500">*</span>
                  </FieldLabel>
                  <InputGroup className="max-w-auto h-10 rounded-sm">
                    <InputGroupInput type="number" />
                    <InputGroupAddon className="text-lg">$</InputGroupAddon>
                  </InputGroup>
                  <FieldLabel>Free Delivery</FieldLabel>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Yes || No</FieldTitle>
                    </FieldContent>
                    <Switch />
                  </Field>
                  <FieldLabel>
                    Description <span className="text-red-500">*</span>
                  </FieldLabel>
                  <Textarea className="h-[180px] overflow-y-auto resize-none rounded-sm" />
                  <FieldLabel>
                    Location <span className="text-red-500">*</span>
                  </FieldLabel>

                  <FieldLabel>
                    Address <span className="text-red-500">*</span>
                  </FieldLabel>
                  <Textarea className="h-[100px] overflow-y-auto resize-none rounded-sm" />
                </Field>
                <Field>
                  <FieldLegend>Contact</FieldLegend>
                  <Separator />
                </Field>
                <Field>
                  <FieldLabel>
                    Name <span className="text-red-500">*</span>
                  </FieldLabel>
                  <Input
                    id="username"
                    className="h-10 w-auto rounded-sm"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>
                    Phone Number <span className="text-red-500">*</span>
                  </FieldLabel>
                  <Input
                    id="phonenumber"
                    className="h-10 w-auto rounded-sm"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    id="email"
                    className="h-10 w-auto rounded-sm"
                    required
                  />
                </Field>
                <div>
                  By continuing, you agree to our Posting Rule and Privacy
                  Policy Terms of Use
                </div>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white h-12 rounded-sm cursor-pointer">
                  Submit
                </Button>
              </FieldGroup>
            </FieldSet>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}
