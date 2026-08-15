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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminCategories,
  type AdminCategory,
} from "@/actions/admin-categories";
import { getAdminSubcategories } from "@/actions/admin-subcategories";
import {
  createsubcategories,
  updatesubcategories,
  deletesubcategories,
} from "@/actions/subcaetgory";
import { useAppForm } from "@/components/form/hooks";
import { subCategorySchema } from "@/schemas/subcategories";
import { subCategory } from "@/types/subcategory";
import { z } from "zod";
import { toast } from "@/components/ui/sonner";
import { FieldGroup } from "@/components/ui/field";
import Image from "next/image";
import { ImageUpload } from "@/components/dashboard/image-upload";

type SubCategoryFormData = z.infer<typeof subCategorySchema>;

type SubCategoryWithDates = subCategory & {
  createdAt: string;
  updatedAt: string;
};

type SubcategoryWithMeta = {
  subId: string;
  name: string;
  slug: string;
  subIcon: string;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
};
function AddSubCategoryForm({
  categories,
  onSuccess,
  onCancel,
}: {
  categories: AdminCategory[];
  onSuccess: (data: SubCategoryFormData) => void;
  onCancel: () => void;
}) {
  const form = useAppForm({
    defaultValues: {
      name: "",
      slug: "",
      subIcon: "",
      categoryId: "",
    } satisfies SubCategoryFormData as SubCategoryFormData,
    validators: {
      onSubmit: subCategorySchema,
      onChange: subCategorySchema,
    },
    onSubmit: async ({ value }) => {
      const res = await createsubcategories(value);
      if (res.success) {
        onSuccess(value);
      } else {
        toast.error("Failed to add category");
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
        <form.AppField name="subIcon">
          {(field) => (
            <ImageUpload
              scope="subcategory"
              value={field.state.value}
              onChange={(url) => form.setFieldValue("subIcon", url)}
              label="Icon"
            />
          )}
        </form.AppField>
        <form.AppField name="categoryId">
          {(field) => (
            <field.Select label="Category" required>
              {categories.map((category) => (
                <SelectItem key={category.cateId} value={category.cateId}>
                  {category.name}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>
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

function EditSubCategoryForm({
  category,
  categories,
  onSuccess,
  onCancel,
}: {
  category: SubCategoryWithDates;
  categories: AdminCategory[];
  onSuccess: (data: SubCategoryFormData) => void;
  onCancel: () => void;
}) {
  const form = useAppForm({
    defaultValues: {
      name: category.name,
      slug: category.slug,
      subIcon: category.subIcon,
      categoryId: category.categoryId,
    } satisfies SubCategoryFormData as SubCategoryFormData,
    validators: {
      onSubmit: subCategorySchema,
      onChange: subCategorySchema,
    },
    onSubmit: async ({ value }) => {
      const res = await updatesubcategories(category.subId, value);
      if (res.success) {
        onSuccess(value);
      } else {
        toast.error(res.error ?? "Failed to update subcategory");
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

        <form.AppField name="subIcon">
          {(field) => (
            <ImageUpload
              scope="subcategory"
              value={field.state.value}
              onChange={(url) => form.setFieldValue("subIcon", url)}
              label="Icon"
            />
          )}
        </form.AppField>
        <form.AppField name="categoryId">
          {(field) => (
            <field.Select label="Category" required>
              {categories.map((category) => (
                <SelectItem key={category.cateId} value={category.cateId}>
                  {category.name}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>
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
function DeleteSubCategoryForm({
  category,
  onSuccess,
  onCancel,
}: {
  category: SubCategoryWithDates;
  onSuccess: (data: SubcategoryWithMeta) => void;
  onCancel: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    try {
      setIsDeleting(true);

      const res = await deletesubcategories(category.subId);

      if (res?.success) {
        onSuccess(category);
      } else {
        toast.error("Failed to delete subcategory");
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
        <DialogTitle>Delete Category</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete &quot;{category?.name}&quot;? This
          action cannot be undone.
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
          className="h-9 rounded-sm bg-red-500 text-white hover:bg-red-600 hover:text-white cursor-pointer"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
        </Button>
      </DialogFooter>
    </>
  );
}
export default function SubCategoriesClient() {
  const queryClient = useQueryClient();
  const { data: subCategories = [] } = useQuery({
    queryKey: ["admin", "subcategories"],
    queryFn: getAdminSubcategories,
  });
  const { data: categoryList = [] } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: getAdminCategories,
  });
  const refreshSubcategories = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "subcategories"] });

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSubCategory, setSelectedSubCategory] =
    useState<SubcategoryWithMeta | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const filteredSubCategories = subCategories.filter(
    (subcategory) =>
      subcategory.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subcategory.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subcategory.categoryId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredSubCategories.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedSubCategories = filteredSubCategories.slice(
    startIndex,
    startIndex + rowsPerPage,
  );

  const handleAddSuccess = () => {
    refreshSubcategories();
    setIsAddDialogOpen(false);
    toast.success("Subcategory added successfully");
  };

  const handleEditSuccess = () => {
    if (!selectedSubCategory) return;
    refreshSubcategories();
    setSelectedSubCategory(null);
    setIsEditDialogOpen(false);
    toast.success("Subcategory updated successfully");
  };

  const handleDeleteSuccess = () => {
    if (!selectedSubCategory) return;
    const name = selectedSubCategory.name;
    refreshSubcategories();
    setSelectedSubCategory(null);
    setIsDeleteDialogOpen(false);
    toast.success(`Subcategory "${name}" deleted successfully`);
  };

  const openEditDialog = (subcategory: SubcategoryWithMeta) => {
    setSelectedSubCategory(subcategory);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (subcategory: SubcategoryWithMeta) => {
    setSelectedSubCategory(subcategory);
    setIsDeleteDialogOpen(true);
  };

  return (
    <>
      <main className="flex-1 overflow-auto p-6 min-w-0">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[#00a0e9] text-2xl font-semibold tracking-tight">
                Sub Categories
              </h1>
              <p className="text-sm mt-2 text-muted-foreground">
                Manage product subcategories
              </p>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer">
                  <Plus className="mr-2 size-4" />
                  Add Sub Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Sub Category</DialogTitle>
                  <DialogDescription>
                    Create a new sub category for your products.
                  </DialogDescription>
                </DialogHeader>
                {isAddDialogOpen && (
                  <AddSubCategoryForm
                    categories={categoryList}
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
                  <TableHead className="text-start">Image</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSubCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="size-8" />
                        <p>No sub category found</p>
                        {searchQuery && (
                          <p className="text-sm">
                            No results for &quot;{searchQuery}&quot;
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
                {paginatedSubCategories.map((subcategory) => (
                  <TableRow key={subcategory.subId}>
                    <TableCell className="text-center">
                      {subcategory.subId}
                    </TableCell>
                    <TableCell>{subcategory.name}</TableCell>
                    <TableCell>{subcategory.slug}</TableCell>
                    <TableCell className="flex justify-start">
                      <Image
                        src={subcategory?.subIcon}
                        alt={subcategory.name}
                        width={56}
                        height={56}
                        className="h-12 w-12 object-cover"
                        unoptimized
                      />
                    </TableCell>
                    <TableCell>
                      <span className="rounded-sm bg-sky-200 text-black px-2 py-1">
                        {categoryList.find(
                          (cat) => cat.cateId === subcategory.categoryId,
                        )?.name ?? "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {subcategory.createdAt}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {subcategory.updatedAt}
                    </TableCell>
                    <TableCell className="text-center align-middle">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full cursor-pointer"
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center">
                          <DropdownMenuItem
                            className="text-orange-500 cursor-pointer"
                            onClick={() => openEditDialog(subcategory)}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer"
                            onClick={() => openDeleteDialog(subcategory)}
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
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sub Category</DialogTitle>
            <DialogDescription>
              Make changes to the sub category details.
            </DialogDescription>
          </DialogHeader>
          {isEditDialogOpen && selectedSubCategory && (
            <EditSubCategoryForm
              key={selectedSubCategory.subId}
              category={selectedSubCategory}
              categories={categoryList}
              onSuccess={handleEditSuccess}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          {isDeleteDialogOpen && selectedSubCategory && (
            <DeleteSubCategoryForm
              key={selectedSubCategory.subId}
              category={selectedSubCategory}
              onSuccess={handleDeleteSuccess}
              onCancel={() => setIsDeleteDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
