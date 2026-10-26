"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { modelSchema } from "@/schemas/model";
import { useAppForm } from "@/components/form/hooks";
import {
  FieldGroup,
  FieldContent,
  FieldLegend,
  FieldDescription,
  FieldSet,
} from "@/components/ui/field";
import { toast } from "@/components/ui/sonner";
import { createModel, updateModel, deleteModel } from "@/actions/model";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminCategories,
  type AdminCategory,
} from "@/actions/admin-categories";
import {
  getAdminSubcategories,
  type AdminSubcategory,
} from "@/actions/admin-subcategories";
import { getAdminBrands } from "@/actions/admin-brands";
import { getAdminModels } from "@/actions/admin-models";
import { SubcategoryCheckboxes } from "@/components/dashboard/subcategory-checkboxes";
import type { Brand } from "@/types/brand";
import z from "zod";
import { Model } from "@/types/model";

type ModelFormData = z.infer<typeof modelSchema>;

/** Brands that can carry a model in any of the selected subcategories. */
function getBrandsForCategoryAndSubcategories(
  brands: Brand[],
  categoryId: string,
  subcategoryIds: string[],
) {
  if (subcategoryIds.length === 0) return [];
  return brands.filter((brand) => {
    if (brand.categoryId !== categoryId) return false;
    return subcategoryIds.some((id) => brand.subcategories.includes(id));
  });
}

function AddModelForm({
  categories,
  subcategories,
  brands,
  onSuccess,
  onCancel,
}: {
  categories: AdminCategory[];
  subcategories: AdminSubcategory[];
  brands: Brand[];
  onSuccess: (data: ModelFormData) => void;
  onCancel: () => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<
    string[]
  >([]);

  const filteredBrands =
    selectedCategoryId && selectedSubcategoryIds.length > 0
      ? getBrandsForCategoryAndSubcategories(
          brands,
          selectedCategoryId,
          selectedSubcategoryIds,
        )
      : [];

  const form = useAppForm({
    defaultValues: {
      name: "",
      slug: "",
      brandId: "",
      categoryId: "",
      subcategories: [] as string[],
    } satisfies ModelFormData as ModelFormData,
    validators: {
      onSubmit: modelSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await createModel(value);
      if (res.success) {
        onSuccess(value);
      } else {
        toast.error(res.error ?? "Failed to add model");
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup className="py-4">
        <form.AppField name="name">
          {(field) => <field.Input label="Name" required />}
        </form.AppField>

        <form.AppField name="slug">
          {(field) => <field.Input label="Slug" required />}
        </form.AppField>

        {/* Step 1: Select Category */}
        <form.AppField name="categoryId">
          {(field) => (
            <field.Select
              label="Category"
              required
              onValueChange={(value) => {
                setSelectedCategoryId(value);
                // Reset subcategory and brand when category changes
                setSelectedSubcategoryIds([]);
                form.setFieldValue("subcategories", []);
                form.setFieldValue("brandId", "");
              }}
            >
              {categories.map((category) => (
                <SelectItem key={category.cateId} value={category.cateId}>
                  {category.name}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>

        {/* Step 2: Select Subcategory (only shows after category is selected) */}
        {selectedCategoryId ? (
          <form.AppField name="subcategories">
            {(field) => (
              <FieldSet>
                <FieldContent>
                  <FieldLegend>
                    Subcategory <span className="text-red-500">*</span>
                  </FieldLegend>
                  <FieldDescription>
                    Which subcategories this model belongs to. Pick more than
                    one when it genuinely spans them (a 2-in-1 is a laptop and a
                    tablet) — this is what keeps a model out of the
                    subcategories it does not belong to.
                  </FieldDescription>
                </FieldContent>
                <SubcategoryCheckboxes
                  categoryId={selectedCategoryId}
                  subcategories={subcategories}
                  selectedIds={field.state.value}
                  onChange={(ids) => {
                    setSelectedSubcategoryIds(ids);
                    field.handleChange(ids);
                    // Reset brand when the subcategory set changes
                    form.setFieldValue("brandId", "");
                  }}
                />
              </FieldSet>
            )}
          </form.AppField>
        ) : (
          <FieldSet>
            <FieldContent>
              <FieldLegend>
                Subcategory <span className="text-red-500">*</span>
              </FieldLegend>
              <FieldDescription>
                Select the subcategory for this model.
              </FieldDescription>
            </FieldContent>
          </FieldSet>
        )}

        {/* Step 3: Select Brand (only shows once a subcategory is picked) */}
        {selectedSubcategoryIds.length > 0 ? (
          <form.AppField name="brandId">
            {(field) => (
              <field.Select label="Brand" required>
                {filteredBrands.length > 0 ? (
                  filteredBrands.map((brand) => (
                    <SelectItem key={brand.brandId} value={brand.brandId}>
                      {brand.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__none" disabled>
                    No brands available
                  </SelectItem>
                )}
              </field.Select>
            )}
          </form.AppField>
        ) : selectedCategoryId ? (
          <p className="type-body-sm text-muted-foreground border rounded-md px-3 py-2">
            Choose a subcategory to see brands.
          </p>
        ) : null}
      </FieldGroup>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-sm bg-red-500 text-white hover:bg-red-600 hover:text-white cursor-pointer"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer"
        >
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditModelForm({
  model,
  categories,
  subcategories,
  brands,
  onSuccess,
  onCancel,
}: {
  model: Model;
  categories: AdminCategory[];
  subcategories: AdminSubcategory[];
  brands: Brand[];
  onSuccess: (data: ModelFormData) => void;
  onCancel: () => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    model.categoryId,
  );
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<
    string[]
  >(model.subcategories);

  const filteredBrands =
    selectedCategoryId && selectedSubcategoryIds.length > 0
      ? getBrandsForCategoryAndSubcategories(
          brands,
          selectedCategoryId,
          selectedSubcategoryIds,
        )
      : [];

  const form = useAppForm({
    defaultValues: {
      name: model.name,
      slug: model.slug,
      brandId: model.brandId,
      categoryId: model.categoryId,
      subcategories: model.subcategories,
    } satisfies ModelFormData as ModelFormData,
    validators: {
      onSubmit: modelSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await updateModel(model.modelId, value);
      if (res.success) {
        onSuccess(value);
      } else {
        toast.error(res.error ?? "Failed to update model");
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup className="py-4">
        <form.AppField name="name">
          {(field) => <field.Input label="Name" required />}
        </form.AppField>

        <form.AppField name="slug">
          {(field) => <field.Input label="Slug" required />}
        </form.AppField>

        {/* Step 1: Select Category */}
        <form.AppField name="categoryId">
          {(field) => (
            <field.Select
              label="Category"
              required
              onValueChange={(value) => {
                setSelectedCategoryId(value);
                // Reset subcategory and brand when category changes
                setSelectedSubcategoryIds([]);
                form.setFieldValue("subcategories", []);
                form.setFieldValue("brandId", "");
              }}
            >
              {categories.map((category) => (
                <SelectItem key={category.cateId} value={category.cateId}>
                  {category.name}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>

        {/* Step 2: Select Subcategory */}
        {selectedCategoryId ? (
          <form.AppField name="subcategories">
            {(field) => (
              <FieldSet>
                <FieldContent>
                  <FieldLegend>
                    Subcategory <span className="text-red-500">*</span>
                  </FieldLegend>
                  <FieldDescription>
                    Which subcategories this model belongs to. Pick more than
                    one when it genuinely spans them (a 2-in-1 is a laptop and a
                    tablet) — this is what keeps a model out of the
                    subcategories it does not belong to.
                  </FieldDescription>
                </FieldContent>
                <SubcategoryCheckboxes
                  categoryId={selectedCategoryId}
                  subcategories={subcategories}
                  selectedIds={field.state.value}
                  onChange={(ids) => {
                    setSelectedSubcategoryIds(ids);
                    field.handleChange(ids);
                    // Reset brand when the subcategory set changes
                    form.setFieldValue("brandId", "");
                  }}
                />
              </FieldSet>
            )}
          </form.AppField>
        ) : (
          <p className="type-body-sm text-muted-foreground border rounded-md px-3 py-2">
            Choose a category to see subcategories.
          </p>
        )}

        {/* Step 3: Select Brand (filtered) */}
        {selectedSubcategoryIds.length > 0 ? (
          <form.AppField name="brandId">
            {(field) => (
              <field.Select label="Brand" required>
                {filteredBrands.length > 0 ? (
                  filteredBrands.map((brand) => (
                    <SelectItem key={brand.brandId} value={brand.brandId}>
                      {brand.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__none" disabled>
                    No brands available
                  </SelectItem>
                )}
              </field.Select>
            )}
          </form.AppField>
        ) : selectedCategoryId ? (
          <p className="type-body-sm text-muted-foreground border rounded-md px-3 py-2">
            Choose a subcategory to see brands.
          </p>
        ) : null}
      </FieldGroup>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-sm bg-red-500 text-white hover:bg-red-600 hover:text-white cursor-pointer"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer"
        >
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteModelForm({
  model,
  onSuccess,
  onCancel,
}: {
  model: Model;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    try {
      setIsDeleting(true);
      const res = await deleteModel({ modelId: model.modelId });

      if (res.success) {
        onSuccess();
      } else {
        toast.error("error" in res ? res.error : "Failed to delete brand");
      }
    } catch (error) {
      console.error("Delete Error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Delete Brand</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete &quot;{model.name}&quot;? This action
          cannot be undone.
        </DialogDescription>
      </DialogHeader>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer"
          onClick={onCancel}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-9 rounded-sm bg-red-500 text-white hover:bg-red-600 hover:text-white cursor-pointer"
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
        </Button>
      </DialogFooter>
    </>
  );
}

export default function ModelsPage() {
  const queryClient = useQueryClient();
  const { data: modelList = [] } = useQuery({
    queryKey: ["admin", "models"],
    queryFn: getAdminModels,
  });
  const { data: allBrands = [] } = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: getAdminBrands,
  });
  const { data: allCategories = [] } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: getAdminCategories,
  });
  const { data: allSubcategories = [] } = useQuery({
    queryKey: ["admin", "subcategories"],
    queryFn: getAdminSubcategories,
  });
  const refreshModels = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "models"] });

  const [searchQuery, setSearchQuery] = useState("");

  // Dialog States
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  const filteredModels = modelList.filter(
    (model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const totalPages = Math.ceil(filteredModels.length / rowsPerPage);
  const paginatedModels = filteredModels.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const handleAdd = (data: ModelFormData) => {
    refreshModels();
    setIsAddDialogOpen(false);
    toast.success(`Model "${data.name}" created successfully!`);
  };

  const handleEdit = (data: ModelFormData) => {
    if (!selectedModel) return;
    refreshModels();
    setSelectedModel(null);
    setIsEditDialogOpen(false);
    toast.success(`Model "${data.name}" updated successfully!`);
  };

  const handleDelete = () => {
    if (!selectedModel) return;
    const name = selectedModel.name;
    refreshModels();
    setSelectedModel(null);
    setIsDeleteDialogOpen(false);
    toast.success(`Model "${name}" deleted successfully!`);
  };

  const openEditDialog = (model: Model) => {
    setSelectedModel(model);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (model: Model) => {
    setSelectedModel(model);
    setIsDeleteDialogOpen(true);
  };
  // ... UI JSX goes here
  return (
    <>
      <main className="flex-1 overflow-auto p-6 min-w-0">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="type-page-title text-[#00a0e9] tracking-tight">
                Models
              </h1>
              <p className="type-body-sm text-muted-foreground mt-2">
                Manage product Models Here.
              </p>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer">
                  <Plus className="mr-2 size-4" />
                  Add Model
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Model</DialogTitle>
                  <DialogDescription>
                    Create a new Model for your products.
                  </DialogDescription>
                </DialogHeader>
                {isAddDialogOpen && (
                  <AddModelForm
                    categories={allCategories}
                    subcategories={allSubcategories}
                    brands={allBrands}
                    onSuccess={handleAdd}
                    onCancel={() => setIsAddDialogOpen(false)}
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Sub Category</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedModels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="size-8" />
                        <p>No model found</p>
                        {searchQuery && (
                          <p className="type-body-sm">
                            No results for &quot;{searchQuery}&quot;
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
                {paginatedModels.map((model) => (
                  <TableRow key={model.modelId}>
                    <TableCell className="text-center font-medium">
                      {model.modelId}
                    </TableCell>
                    <TableCell>{model.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {model.slug}
                    </TableCell>
                    <TableCell>
                      {allBrands.find((b) => b.brandId === model.brandId)?.name}
                    </TableCell>
                    <TableCell>
                      {allCategories.find(
                        (c) => c.cateId === model.categoryId,
                      ) ? (
                        <span className="rounded bg-sky-200 px-2 py-1 type-body-sm text-black">
                          {
                            allCategories.find(
                              (c) => c.cateId === model.categoryId,
                            )?.name
                          }
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {model.subcategories.map((id) => {
                          const sub = allSubcategories.find(
                            (s) => s.subId === id,
                          );

                          return (
                            <span
                              key={id}
                              className="rounded bg-sky-100 px-2 py-1 type-body-sm text-black"
                            >
                              {sub?.name}
                            </span>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="type-meta text-muted-foreground">
                      {model.createdAt}
                    </TableCell>
                    <TableCell className="type-meta text-muted-foreground">
                      {model.updatedAt}
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full cursor-pointer"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center">
                          {/* Changed from category to brand here */}
                          <DropdownMenuItem
                            className="text-orange-500 cursor-pointer"
                            onClick={() => openEditDialog(model)}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer"
                            onClick={() => openDeleteDialog(model)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Pagination */}
            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="flex items-center gap-2 type-body-sm text-muted-foreground">
                Rows per page
                <Select
                  value={rowsPerPage.toString()}
                  onValueChange={(value) => {
                    setRowsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="type-body-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* Edit Dialog Block */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Model</DialogTitle>
            <DialogDescription>
              Make changes to the Model details.
            </DialogDescription>
          </DialogHeader>
          {isEditDialogOpen && selectedModel && (
            <EditModelForm
              key={selectedModel.modelId}
              model={selectedModel}
              categories={allCategories}
              subcategories={allSubcategories}
              brands={allBrands}
              onSuccess={handleEdit}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Delete Dialog Block */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          {isDeleteDialogOpen && selectedModel && (
            <DeleteModelForm
              key={selectedModel.brandId}
              model={selectedModel}
              onSuccess={handleDelete}
              onCancel={() => setIsDeleteDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
