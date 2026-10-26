"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import DbImage, { NoImageCell } from "@/components/common/DbImage";
import { ImageUpload } from "@/components/dashboard/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import {
  createAdvertisement,
  deleteAdvertisement,
  getAdvertisements,
  updateAdvertisement,
} from "@/actions/advertisements";
import {
  ADVERTISEMENT_PLACEMENTS,
  type AdminAdvertisement,
  type AdvertisementPlacement,
} from "@/lib/advertisements";

interface FormState {
  placement: AdvertisementPlacement;
  imageUrl: string;
  imagePath: string;
  linkUrl: string;
  altText: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  placement: "home",
  imageUrl: "",
  imagePath: "",
  linkUrl: "",
  altText: "",
  sortOrder: "0",
  isActive: true,
};

const placementLabel = (value: string) =>
  ADVERTISEMENT_PLACEMENTS.find((p) => p.value === value)?.label ?? value;

export default function AdvertisementsPage() {
  const queryClient = useQueryClient();
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["admin", "advertisements"],
    queryFn: getAdvertisements,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAdvertisement | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<AdminAdvertisement | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (banner: AdminAdvertisement) => {
    setEditing(banner);
    setForm({
      placement: banner.placement,
      imageUrl: banner.imageUrl,
      imagePath: banner.imagePath,
      linkUrl: banner.linkUrl ?? "",
      altText: banner.altText,
      sortOrder: String(banner.sortOrder),
      isActive: banner.isActive,
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.imagePath) {
      toast.error("Upload a banner image first");
      return;
    }
    setSaving(true);
    const payload = {
      placement: form.placement,
      imagePath: form.imagePath,
      linkUrl: form.linkUrl.trim(),
      altText: form.altText.trim(),
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };
    const res = editing
      ? await updateAdvertisement(editing.id, payload)
      : await createAdvertisement(payload);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Banner updated" : "Banner added");
    await queryClient.invalidateQueries({
      queryKey: ["admin", "advertisements"],
    });
    setFormOpen(false);
  };

  const toggleActive = async (
    banner: AdminAdvertisement,
    isActive: boolean,
  ) => {
    const res = await updateAdvertisement(banner.id, { isActive });
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: ["admin", "advertisements"],
    });
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await deleteAdvertisement(toDelete.id);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Banner deleted");
    setToDelete(null);
    await queryClient.invalidateQueries({
      queryKey: ["admin", "advertisements"],
    });
  };

  return (
    <div className="p-6">
      <div className="flex flex-col gap-1 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="type-page-title">Advertisements</h1>
          <p className="type-meta text-muted-foreground">
            Banners shown on the storefront. A slot showing more than one banner
            rotates them in order.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add banner
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Preview</TableHead>
              <TableHead>Placement</TableHead>
              <TableHead>Link</TableHead>
              <TableHead className="w-[90px]">Order</TableHead>
              <TableHead className="w-[90px]">Active</TableHead>
              <TableHead className="w-[110px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  Loading…
                </TableCell>
              </TableRow>
            ) : banners.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  No banners yet. Storefront slots stay empty until one is
                  added.
                </TableCell>
              </TableRow>
            ) : (
              banners.map((banner) => (
                <TableRow key={banner.id}>
                  <TableCell>
                    <div className="relative h-12 w-44 overflow-hidden rounded border border-border bg-muted">
                      <DbImage
                        src={banner.imageUrl}
                        alt={banner.altText || "Banner"}
                        fill
                        className="object-cover"
                        fallback={<NoImageCell />}
                      />
                    </div>
                  </TableCell>
                  <TableCell>{placementLabel(banner.placement)}</TableCell>
                  <TableCell className="max-w-[280px] truncate type-meta text-muted-foreground">
                    {banner.linkUrl ?? "—"}
                  </TableCell>
                  <TableCell>{banner.sortOrder}</TableCell>
                  <TableCell>
                    <Switch
                      checked={banner.isActive}
                      onCheckedChange={(checked) =>
                        void toggleActive(banner, checked)
                      }
                      className="data-checked:bg-[#00a0e9]"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit banner"
                        onClick={() => openEdit(banner)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete banner"
                        onClick={() => setToDelete(banner)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit banner" : "Add banner"}</DialogTitle>
            <DialogDescription>
              Storefront banners are 4:1 — 1200 × 300 px renders crisply at
              every slot.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Placement</Label>
              <Select
                value={form.placement}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    placement: value as AdvertisementPlacement,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADVERTISEMENT_PLACEMENTS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Image</Label>
              <ImageUpload
                scope="advertisement"
                value={form.imageUrl}
                onChange={(url) =>
                  setForm((f) => ({
                    ...f,
                    imageUrl: url,
                    imagePath: url ? f.imagePath : "",
                  }))
                }
                onUpload={({ path }) =>
                  setForm((f) => ({
                    ...f,
                    imageUrl: f.imageUrl,
                    imagePath: path,
                  }))
                }
                label="Banner"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="banner-link">Link (optional)</Label>
              <Input
                id="banner-link"
                placeholder="https://… or /all-ads"
                value={form.linkUrl}
                maxLength={2048}
                onChange={(e) =>
                  setForm((f) => ({ ...f, linkUrl: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="banner-alt">Alt text</Label>
              <Input
                id="banner-alt"
                placeholder="Shown when the image cannot load, read by screen readers"
                value={form.altText}
                maxLength={200}
                onChange={(e) =>
                  setForm((f) => ({ ...f, altText: e.target.value }))
                }
              />
            </div>

            <div className="flex items-end gap-4">
              <div className="grid gap-2">
                <Label htmlFor="banner-order">Order</Label>
                <Input
                  id="banner-order"
                  type="number"
                  min={0}
                  max={9999}
                  className="w-28"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sortOrder: e.target.value }))
                  }
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  id="banner-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, isActive: checked }))
                  }
                  className="data-checked:bg-[#00a0e9]"
                />
                <Label htmlFor="banner-active">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add banner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this banner?</DialogTitle>
            <DialogDescription>
              The banner and its stored image are removed. Storefront slots
              showing nothing will collapse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
