"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  MoreHorizontal,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
import { useAppForm } from "@/components/form/hooks";
import { z } from "zod";
import { toast } from "@/components/ui/sonner";
import {
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import DbImage, { NoImageCell } from "@/components/common/DbImage";
import { ImageUpload } from "@/components/dashboard/image-upload";
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
import { brandSchema } from "@/schemas/brand";
import type { Brand } from "@/types/brand";
import { createBrand, deleteBrand, updateBrand } from "@/actions/brand";
import { SubcategoryCheckboxes } from "@/components/dashboard/subcategory-checkboxes";

type BrandFormData = z.infer<typeof brandSchema>;

function AddBrandForm({
  categories,
  subcategories,
  onSuccess,
  onCancel,
}: {
  categories: AdminCategory[];
  subcategories: AdminSubcategory[];
  onSuccess: (data: BrandFormData) => void;
  onCancel: () => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const form = useAppForm({
    defaultValues: {
      name: "",
      slug: "",
      image: "",
      categoryId: "",
      subcategories: [] as string[],
    } satisfies BrandFormData as BrandFormData,
    validators: {
      onSubmit: brandSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await createBrand(value);
      if (res.success) {
        onSuccess(value);
      } else {
        toast.error("Failed to add brand");
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

        <form.AppField name="image">
          {(field) => (
            <ImageUpload
              scope="brand"
              value={field.state.value}
              onChange={(url) => form.setFieldValue("image", url)}
              label="Logo"
            />
          )}
        </form.AppField>

        <form.AppField name="categoryId">
          {(field) => (
            <field.Select
              label="Category"
              required
              onValueChange={(value) => {
                setSelectedCategoryId(value);
                form.setFieldValue("subcategories", []);
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

        {selectedCategoryId ? (
          <FieldSet>
            <FieldContent>
              <FieldLegend>Sub Categories</FieldLegend>
              <FieldDescription>
                Select one or more subcategories.
              </FieldDescription>
            </FieldContent>
            <form.AppField name="subcategories">
              {(field) => (
                <SubcategoryCheckboxes
                  categoryId={selectedCategoryId}
                  subcategories={subcategories}
                  selectedIds={field.state.value}
                  onChange={field.handleChange}
                />
              )}
            </form.AppField>
          </FieldSet>
        ) : (
          <p className="text-sm text-muted-foreground border rounded-md px-3 py-2">
            Choose a category to see subcategories.
          </p>
        )}
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

function EditBrandForm({
  brand,
  categories,
  subcategories,
  onSuccess,
  onCancel,
}: {
  brand: Brand;
  categories: AdminCategory[];
  subcategories: AdminSubcategory[];
  onSuccess: (data: BrandFormData) => void;
  onCancel: () => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    brand.categoryId,
  );

  const form = useAppForm({
    defaultValues: {
      name: brand.name,
      slug: brand.slug,
      image: brand.image,
      categoryId: brand.categoryId,
      subcategories: brand.subcategories,
    } satisfies BrandFormData as BrandFormData,
    validators: {
      onSubmit: brandSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await updateBrand(brand.brandId, value);
      if (res.success) {
        onSuccess(value);
      } else {
        toast.error(res.error ?? "Failed to update brand");
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

        <form.AppField name="image">
          {(field) => (
            <ImageUpload
              scope="brand"
              value={field.state.value}
              onChange={(url) => form.setFieldValue("image", url)}
              label="Logo"
            />
          )}
        </form.AppField>

        <form.AppField name="categoryId">
          {(field) => (
            <field.Select
              label="Category"
              required
              onValueChange={(value) => {
                setSelectedCategoryId(value);
                form.setFieldValue("subcategories", []);
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

        {selectedCategoryId ? (
          <FieldSet>
            <FieldContent>
              <FieldLegend>Sub Categories</FieldLegend>
              <FieldDescription>
                Select the subcategories that belong to this brand.
              </FieldDescription>
            </FieldContent>
            <form.AppField name="subcategories">
              {(field) => (
                <SubcategoryCheckboxes
                  categoryId={selectedCategoryId}
                  subcategories={subcategories}
                  selectedIds={field.state.value}
                  onChange={field.handleChange}
                />
              )}
            </form.AppField>
          </FieldSet>
        ) : (
          <p className="text-sm text-muted-foreground border rounded-md px-3 py-2">
            Choose a category to see subcategories.
          </p>
        )}
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

function DeleteBrandForm({
  brand,
  onSuccess,
  onCancel,
}: {
  brand: Brand;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    try {
      setIsDeleting(true);
      const res = await deleteBrand({ brandId: brand.brandId });

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
          Are you sure you want to delete &quot;{brand.name}&quot;? This action
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

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const { data: brandList = [] } = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: getAdminBrands,
  });
  const { data: categoryList = [] } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: getAdminCategories,
  });
  const { data: allSubcategories = [] } = useQuery({
    queryKey: ["admin", "subcategories"],
    queryFn: getAdminSubcategories,
  });
  const refreshBrands = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  const filteredBrands = brandList.filter(
    (brand) =>
      brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brand.slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredBrands.length / rowsPerPage),
  );
  const paginatedBrands = filteredBrands.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const handleAddSuccess = (data: BrandFormData) => {
    refreshBrands();
    setIsAddDialogOpen(false);
    toast.success(`Brand "${data.name}" created successfully!`);
  };

  const handleEditSuccess = (data: BrandFormData) => {
    if (!selectedBrand) return;
    refreshBrands();
    setSelectedBrand(null);
    setIsEditDialogOpen(false);
    toast.success(`Brand "${data.name}" updated successfully!`);
  };

  const handleDeleteSuccess = () => {
    if (!selectedBrand) return;
    const name = selectedBrand.name;
    refreshBrands();
    setSelectedBrand(null);
    setIsDeleteDialogOpen(false);
    toast.success(`Brand "${name}" deleted successfully!`);
  };

  const openEditDialog = (brand: Brand) => {
    setSelectedBrand(brand);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (brand: Brand) => {
    setSelectedBrand(brand);
    setIsDeleteDialogOpen(true);
  };

  return (
    <>
      <main className="flex-1 overflow-auto p-6 min-w-0">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[#00a0e9] text-2xl font-semibold tracking-tight">
                Brands
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Manage product brands here.
              </p>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer">
                  <Plus className="mr-2 size-4" />
                  Add Brand
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Brand</DialogTitle>
                  <DialogDescription>
                    Create a new brand for your products.
                  </DialogDescription>
                </DialogHeader>
                {isAddDialogOpen && (
                  <AddBrandForm
                    categories={categoryList}
                    subcategories={allSubcategories}
                    onSuccess={handleAddSuccess}
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
              className="h-9 pl-9 border-border bg-card text-foreground focus-visible:ring-1 focus-visible:ring-[#00a0e9] focus-visible:border-[#00a0e9] transition-all"
            />
          </div>

          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-start">Logo</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Sub Category</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedBrands.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="size-8" />
                        <p>No brand found</p>
                        {searchQuery && (
                          <p className="text-sm">
                            No results for &quot;{searchQuery}&quot;
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedBrands.map((brand) => (
                    <TableRow key={brand.brandId}>
                      <TableCell className="text-center font-medium">
                        {brand.brandId}
                      </TableCell>
                      <TableCell>{brand.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {brand.slug}
                      </TableCell>
                      <TableCell>
                        <DbImage
                          src={brand.image}
                          alt={brand.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 object-contain rounded border bg-muted/30 p-0.5"
                          fallback={<NoImageCell />}
                        />
                      </TableCell>
                      <TableCell>
                        {categoryList.find(
                          (c) => c.cateId === brand.categoryId,
                        ) && (
                          <span className="rounded bg-sky-200 px-2 py-1 text-sm text-black">
                            {
                              categoryList.find(
                                (c) => c.cateId === brand.categoryId,
                              )?.name
                            }
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {brand.subcategories.map((id) => {
                            const sub = allSubcategories.find(
                              (s) => s.subId === id,
                            );
                            return (
                              <span
                                key={id}
                                className="rounded bg-sky-100 px-2 py-1 text-sm text-black"
                              >
                                {sub?.name ?? id}
                              </span>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {brand.createdAt}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {brand.updatedAt}
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
                            <DropdownMenuItem
                              className="text-orange-500 cursor-pointer"
                              onClick={() => openEditDialog(brand)}
                            >
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive cursor-pointer"
                              onClick={() => openDeleteDialog(brand)}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Rows per page
                <Select
                  value={rowsPerPage.toString()}
                  onValueChange={(value) => {
                    setRowsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Brand</DialogTitle>
            <DialogDescription>
              Make changes to the brand details.
            </DialogDescription>
          </DialogHeader>
          {isEditDialogOpen && selectedBrand && (
            <EditBrandForm
              key={selectedBrand.brandId}
              brand={selectedBrand}
              categories={categoryList}
              subcategories={allSubcategories}
              onSuccess={handleEditSuccess}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          {isDeleteDialogOpen && selectedBrand && (
            <DeleteBrandForm
              key={selectedBrand.brandId}
              brand={selectedBrand}
              onSuccess={handleDeleteSuccess}
              onCancel={() => setIsDeleteDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
