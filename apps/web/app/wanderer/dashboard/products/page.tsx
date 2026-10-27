"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { getAdminBrands } from "@/actions/admin-brands";
import { getAdminModels } from "@/actions/admin-models";
import { getAdminProducts } from "@/actions/admin-products";
import { createProduct, deleteProduct, updateProduct } from "@/actions/product";
import { AdminPage } from "@/components/dashboard/admin-page";
import {
  AdminFilter,
  AdminSearch,
  AdminTable,
  ChipList,
  DateCell,
  PrimaryCell,
  RowActions,
  type AdminColumn,
} from "@/components/dashboard/admin-table";
import { productSchema, updateProductSchema } from "@/schemas/product";
import type { Brand } from "@/types/brand";
import type { Model } from "@/types/model";
import type {
  AdminProduct,
  ProductSpecGroup,
  ProductSpecItem,
} from "@/types/product";
import { cn } from "@/lib/utils";

const emptyGroup = (): ProductSpecGroup => ({
  title: "",
  rows: [{ label: "", value: "" }],
});

const rowCount = (product: AdminProduct) =>
  product.specGroups.reduce((total, group) => total + group.rows.length, 0);

/** Group/row editor shared by the create and edit dialogs. */
function SpecGroupEditor({
  groups,
  onChange,
}: {
  groups: ProductSpecGroup[];
  onChange: (groups: ProductSpecGroup[]) => void;
}) {
  const patchGroup = (gi: number, patch: Partial<ProductSpecGroup>) =>
    onChange(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));

  const patchRow = (gi: number, ri: number, patch: Partial<ProductSpecItem>) =>
    onChange(
      groups.map((g, i) =>
        i === gi
          ? {
              ...g,
              rows: g.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)),
            }
          : g,
      ),
    );

  return (
    <div className="space-y-3">
      {groups.map((group, gi) => (
        <div key={gi} className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center gap-2">
            <Input
              aria-label="Group title"
              value={group.title}
              maxLength={120}
              placeholder="Group title (e.g. Display)"
              onChange={(e) => patchGroup(gi, { title: e.target.value })}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Remove group"
              disabled={groups.length === 1}
              onClick={() => onChange(groups.filter((_, i) => i !== gi))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          {group.rows.map((row, ri) => (
            <div key={ri} className="flex items-center gap-2">
              <Input
                aria-label="Spec label"
                value={row.label}
                maxLength={100}
                placeholder="Label"
                onChange={(e) => patchRow(gi, ri, { label: e.target.value })}
              />
              <Input
                aria-label="Spec value"
                value={row.value}
                maxLength={500}
                placeholder="Value"
                onChange={(e) => patchRow(gi, ri, { value: e.target.value })}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Remove row"
                disabled={group.rows.length === 1}
                onClick={() =>
                  patchGroup(gi, {
                    rows: group.rows.filter((_, j) => j !== ri),
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              patchGroup(gi, {
                rows: [...group.rows, { label: "", value: "" }],
              })
            }
          >
            <Plus className="mr-1 size-3.5" />
            Add row
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...groups, emptyGroup()])}
      >
        <Plus className="mr-1 size-3.5" />
        Add group
      </Button>
    </div>
  );
}

function PublishedToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div>
        <p className="type-body-sm font-medium">Published</p>
        <p className="type-meta text-muted-foreground">
          Published pages appear in search and the phone post form.
        </p>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function CreateProductForm({
  brands,
  models,
  usedModelIds,
  onSuccess,
  onCancel,
}: {
  brands: Brand[];
  models: Model[];
  usedModelIds: Set<string>;
  onSuccess: (label: string) => void;
  onCancel: () => void;
}) {
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [groups, setGroups] = useState<ProductSpecGroup[]>([emptyGroup()]);
  const [saving, setSaving] = useState(false);

  const modelOptions = models.filter(
    (model) => model.brandId === brandId && !usedModelIds.has(model.modelId),
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = productSchema.safeParse({
      modelId,
      specGroups: groups,
      isPublished,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSaving(true);
    const res = await createProduct(parsed.data);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error ?? "Failed to create product spec");
      return;
    }
    const brand = brands.find((b) => b.brandId === brandId);
    const model = models.find((m) => m.modelId === modelId);
    onSuccess(`${brand?.name ?? ""} ${model?.name ?? ""}`.trim());
  };

  return (
    <form onSubmit={submit} className="space-y-4 py-2">
      <div className="grid gap-2">
        <label className="type-body-sm font-medium">Brand</label>
        <Select
          value={brandId}
          onValueChange={(value) => {
            setBrandId(value);
            setModelId("");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a brand" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((brand) => (
              <SelectItem key={brand.brandId} value={brand.brandId}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <label className="type-body-sm font-medium">Model</label>
        <Select value={modelId} onValueChange={setModelId} disabled={!brandId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a model" />
          </SelectTrigger>
          <SelectContent>
            {modelOptions.map((model) => (
              <SelectItem key={model.modelId} value={model.modelId}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="type-meta text-muted-foreground">
          Missing a model? Add it first under{" "}
          <Link
            href="/wanderer/dashboard/attributes/models"
            className="text-sky-600 hover:underline"
          >
            Attributes → Models
          </Link>
          .
        </p>
      </div>

      <PublishedToggle value={isPublished} onChange={setIsPublished} />

      <div className="space-y-2">
        <p className="type-body-sm font-medium">Specifications</p>
        <SpecGroupEditor groups={groups} onChange={setGroups} />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-sm cursor-pointer"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditProductForm({
  product,
  onSuccess,
  onCancel,
}: {
  product: AdminProduct;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isPublished, setIsPublished] = useState(product.isPublished);
  const [groups, setGroups] = useState<ProductSpecGroup[]>(product.specGroups);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = updateProductSchema.safeParse({
      specGroups: groups,
      isPublished,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSaving(true);
    const res = await updateProduct(product.id, parsed.data);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error ?? "Failed to update product spec");
      return;
    }
    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-4 py-2">
      <div className="rounded-md border border-border px-3 py-2">
        <p className="type-meta text-muted-foreground">Product</p>
        <p className="type-body-sm font-medium">
          {product.brandName} {product.modelName}
        </p>
        <p className="type-meta text-muted-foreground">
          {product.brandSlug}/{product.modelSlug}
        </p>
      </div>

      <PublishedToggle value={isPublished} onChange={setIsPublished} />

      <div className="space-y-2">
        <p className="type-body-sm font-medium">Specifications</p>
        <SpecGroupEditor groups={groups} onChange={setGroups} />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-sm cursor-pointer"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteProductForm({
  product,
  onSuccess,
  onCancel,
}: {
  product: AdminProduct;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    const res = await deleteProduct({ productId: product.id });
    setDeleting(false);
    if (!res.success) {
      toast.error(res.error ?? "Failed to delete product spec");
      return;
    }
    onSuccess();
  };

  return (
    <div className="space-y-4 py-2">
      <p className="type-body-sm text-muted-foreground">
        Delete the spec page for{" "}
        <span className="font-medium text-foreground">
          {product.brandName} {product.modelName}
        </span>
        ? Ads that link to it stop showing the specs link.
      </p>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-sm cursor-pointer"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={deleting}
          className="h-9 rounded-sm cursor-pointer"
          onClick={remove}
        >
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { data: productList = [], isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: getAdminProducts,
  });
  const { data: brandList = [] } = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: getAdminBrands,
  });
  const { data: modelList = [] } = useQuery({
    queryKey: ["admin", "models"],
    queryFn: getAdminModels,
  });

  const refreshProducts = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "products"] });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(
    null,
  );

  const usedModelIds = useMemo(
    () => new Set(productList.map((product) => product.modelId)),
    [productList],
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return productList.filter((product) => {
      if (statusFilter === "published" && !product.isPublished) return false;
      if (statusFilter === "draft" && product.isPublished) return false;
      if (!query) return true;
      return [
        product.brandName,
        product.brandSlug,
        product.modelName,
        product.modelSlug,
        ...product.specGroups.map((group) => group.title),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [productList, searchQuery, statusFilter]);

  const openEditDialog = (product: AdminProduct) => {
    setSelectedProduct(product);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (product: AdminProduct) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const columns: AdminColumn<AdminProduct>[] = [
    {
      key: "product",
      header: "Product",
      sortValue: (product) => `${product.brandName} ${product.modelName}`,
      cell: (product) => (
        <PrimaryCell
          image={product.image}
          alt={product.modelName}
          title={`${product.brandName} ${product.modelName}`}
          subtitle={`${product.brandSlug}/${product.modelSlug}`}
          imageClassName="object-contain p-0.5"
        />
      ),
    },
    {
      key: "groups",
      header: "Groups",
      cell: (product) => (
        <ChipList items={product.specGroups.map((group) => group.title)} />
      ),
    },
    {
      key: "rows",
      header: "Rows",
      align: "right",
      sortValue: rowCount,
      cell: (product) => (
        <span className="tabular-nums">{rowCount(product)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (product) => (product.isPublished ? 1 : 0),
      cell: (product) => (
        <span
          className={cn(
            "inline-flex items-center rounded px-2 py-0.5 type-body-sm",
            product.isPublished
              ? "bg-emerald-100 text-emerald-700"
              : "bg-muted text-muted-foreground",
          )}
        >
          {product.isPublished ? "Published" : "Draft"}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      sortValue: (product) => product.updatedAt,
      cell: (product) => <DateCell value={product.updatedAt} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (product) => (
        <RowActions
          id={product.id}
          actions={[
            {
              label: "Edit",
              icon: <Pencil className="mr-2 size-4" />,
              onSelect: () => openEditDialog(product),
            },
            {
              label: "Delete",
              icon: <Trash2 className="mr-2 size-4" />,
              tone: "danger",
              onSelect: () => openDeleteDialog(product),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <AdminPage
        title="Product Specs"
        description="Trusted product pages written by staff. Product search and the phone post form use only published pages."
        action={
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer">
                <Plus className="mr-2 size-4" />
                Add Product Spec
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Product Spec</DialogTitle>
                <DialogDescription>
                  Pick an existing brand and model, then enter its spec
                  sections.
                </DialogDescription>
              </DialogHeader>
              {isAddDialogOpen && (
                <CreateProductForm
                  brands={brandList}
                  models={modelList}
                  usedModelIds={usedModelIds}
                  onSuccess={(label) => {
                    refreshProducts();
                    setIsAddDialogOpen(false);
                    toast.success(
                      `Product spec "${label}" created successfully!`,
                    );
                  }}
                  onCancel={() => setIsAddDialogOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>
        }
        toolbar={
          <>
            <AdminSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search brand, model, group..."
            />
            <AdminFilter
              value={statusFilter}
              onChange={setStatusFilter}
              allLabel="All statuses"
              options={[
                { value: "published", label: "Published" },
                { value: "draft", label: "Draft" },
              ]}
            />
          </>
        }
      >
        <AdminTable
          columns={columns}
          rows={filteredProducts}
          rowKey={(product) => product.id}
          isLoading={isLoading}
          pageSize={20}
          resetKey={`${searchQuery}:${statusFilter}`}
          emptyTitle="No product spec found"
          emptyHint={
            searchQuery ? `No results for "${searchQuery}"` : undefined
          }
        />
      </AdminPage>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product Spec</DialogTitle>
            <DialogDescription>
              The model is fixed; edit the spec sections and publish state.
            </DialogDescription>
          </DialogHeader>
          {isEditDialogOpen && selectedProduct && (
            <EditProductForm
              key={selectedProduct.id}
              product={selectedProduct}
              onSuccess={() => {
                refreshProducts();
                setSelectedProduct(null);
                setIsEditDialogOpen(false);
                toast.success("Product spec updated successfully!");
              }}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product Spec</DialogTitle>
            <DialogDescription>
              This removes the public spec page.
            </DialogDescription>
          </DialogHeader>
          {isDeleteDialogOpen && selectedProduct && (
            <DeleteProductForm
              key={selectedProduct.id}
              product={selectedProduct}
              onSuccess={() => {
                refreshProducts();
                setSelectedProduct(null);
                setIsDeleteDialogOpen(false);
                toast.success("Product spec deleted successfully!");
              }}
              onCancel={() => setIsDeleteDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
