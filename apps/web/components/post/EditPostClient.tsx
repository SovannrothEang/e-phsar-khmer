"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import ListingPostForm from "@/components/post/ListingPostForm";
import { CategorySelector } from "@/components/post/CategorySelector";
import { REAL_FORM_SUBCATEGORIES } from "@/lib/post-form-subcategories";
import { toast } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Category, Subcategory } from "@/types/post-form";
import type { ListingInitialValues } from "@/actions/listings";

/**
 * The edit screen's shell. It owns the selected category/subcategory and the
 * category-change dialog; `ListingPostForm` stays mounted while those props
 * change, so the config effect reloads the new schema without discarding the
 * user's unsaved edits.
 */
export function EditPostClient({
  listingId,
  canViewPublic,
  categorySlug,
  subcategorySlug,
  categoryName,
  subName,
  initialValues,
}: {
  listingId: string;
  /** Stored `restricted` ads have no public page — send those back to /me. */
  canViewPublic: boolean;
  categorySlug: string;
  subcategorySlug: string;
  categoryName: string;
  subName: string;
  initialValues: ListingInitialValues;
}) {
  const t = useTranslations("EditAd");
  const router = useRouter();
  const [slug, setSlug] = useState(categorySlug);
  const [subSlug, setSubSlug] = useState(subcategorySlug);
  const [catName, setCatName] = useState(categoryName);
  const [subNameValue, setSubNameValue] = useState(subName);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelect = (cat: Category, sub: Subcategory) => {
    if (!REAL_FORM_SUBCATEGORIES.includes(sub.slug)) {
      toast.error(t("categoryUnsupported"));
      return;
    }
    setSlug(cat.slug);
    setCatName(cat.name);
    setSubSlug(sub.slug);
    setSubNameValue(sub.name);
    setDialogOpen(false);
  };

  return (
    <>
      <ListingPostForm
        categorySlug={slug}
        subcategorySlug={subSlug}
        categoryName={catName}
        subName={subNameValue}
        mode="edit"
        listingId={listingId}
        initialValues={initialValues}
        onBack={() => setDialogOpen(true)}
        onSaved={() => {
          if (canViewPublic) {
            router.push({
              pathname: "/post/[slug]",
              params: { slug: listingId },
            });
          } else {
            router.push({ pathname: "/me" });
          }
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("changeCategoryTitle")}</DialogTitle>
          </DialogHeader>
          <p className="type-body-sm text-muted-foreground">
            {t("changeCategoryHint")}
          </p>
          <CategorySelector onSelect={handleSelect} />
        </DialogContent>
      </Dialog>
    </>
  );
}
