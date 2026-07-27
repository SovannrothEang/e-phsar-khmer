"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Search, MoreHorizontal } from "lucide-react";
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
import { Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminCategories } from "@/actions/admin-categories";
import Image from "next/image";
import { ImageUpload } from "@/components/dashboard/image-upload";
import type { Category } from "@/types/category";
import {
  createcategories,
  updatecategories,
  deletecategories,
} from "@/actions/category";
import { useAppForm } from "@/components/form/hooks";
import { categorySchema } from "@/schemas/category";
import { FieldGroup } from "@/components/ui/field";
import { toast } from "@/components/ui/sonner";
import { z } from "zod";

type CategoryFormData = z.infer<typeof categorySchema>;

type CategoryWithDates = Category & {
  createdAt: string;
  updatedAt: string;
};

function AddCategoryForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (data: CategoryFormData) => void;
  onCancel: () => void;
}) {
  const form = useAppForm({
    defaultValues: {
      name: "",
      slug: "",
      cateIcon: "",
    } satisfies CategoryFormData as CategoryFormData,
    validators: {
      onSubmit: categorySchema,
      onChange: categorySchema,
    },
    onSubmit: async ({ value }) => {
      const res = await createcategories(value);
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
        <form.AppField name="cateIcon">
          {(field) => (
            <ImageUpload
              scope="category"
              value={field.state.value}
              onChange={(url) => form.setFieldValue("cateIcon", url)}
              label="Icon"
            />
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

function EditCategoryForm({
  category,
  onSuccess,
  onCancel,
}: {
  category: CategoryWithDates;
  onSuccess: (data: CategoryFormData) => void;
  onCancel: () => void;
}) {
  const form = useAppForm({
    defaultValues: {
      name: category.name,
      slug: category.slug,
      cateIcon: category.cateIcon,
    } satisfies CategoryFormData as CategoryFormData,
    validators: {
      onSubmit: categorySchema,
      onChange: categorySchema,
    },
    onSubmit: async ({ value }) => {
      const res = await updatecategories(category.cateId, value);
      if (res.success) {
        onSuccess(value);
      } else {
        toast.error(res.error ?? "Failed to update category");
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

        <form.AppField name="cateIcon">
          {(field) => (
            <ImageUpload
              scope="category"
              value={field.state.value}
              onChange={(url) => form.setFieldValue("cateIcon", url)}
              label="Icon"
            />
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
function DeleteCategoryForm({
  category,
  onSuccess,
  onCancel,
}: {
  category: CategoryWithDates;
  onSuccess: (data: CategoryWithDates) => void;
  onCancel: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    try {
      setIsDeleting(true);

      const res = await deletecategories({
        cateId: category.cateId,
      });

      if (res?.success) {
        onSuccess(category);
      } else {
        toast.error("error" in res ? res.error : "Failed to delete category");
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

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data: categoryList = [] } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: getAdminCategories,
  });
  const refreshCategories = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryWithDates | null>(null);

  const filteredCategories = categoryList.filter(
    (category) =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleAddSuccess = (data: CategoryFormData) => {
    refreshCategories();
    setIsAddDialogOpen(false);
    toast.success(`Category "${data.name}" created successfully!`);
  };

  const handleEditSuccess = (data: CategoryFormData) => {
    if (!selectedCategory) return;
    refreshCategories();
    setSelectedCategory(null);
    setIsEditDialogOpen(false);
    toast.success(`Category "${data.name}" updated successfully!`);
  };

  const handleDeleteSuccess = () => {
    if (!selectedCategory) return;
    const name = selectedCategory.name;
    refreshCategories();
    setSelectedCategory(null);
    setIsDeleteDialogOpen(false);
    toast.success(`Category "${name}" deleted successfully!`);
  };

  const openEditDialog = (category: CategoryWithDates) => {
    setSelectedCategory(category);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (category: CategoryWithDates) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  return (
    <>
      <main className="flex-1 overflow-auto p-6 min-w-0">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[#00a0e9] text-2xl font-semibold tracking-tight">
                Categories
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Manage product categories
              </p>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer">
                  <Plus className="mr-2 size-4" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Category</DialogTitle>
                  <DialogDescription>
                    Create a new category for your products.
                  </DialogDescription>
                </DialogHeader>

                {isAddDialogOpen && (
                  <AddCategoryForm
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
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="size-8" />
                        <p>No category found</p>

                        {searchQuery && (
                          <p className="text-sm">
                            No results for &quot;{searchQuery}&quot;
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCategories.map((category) => (
                    <TableRow key={category.cateId}>
                      <TableCell className="text-center">
                        {category.cateId}
                      </TableCell>

                      <TableCell>{category.name}</TableCell>

                      <TableCell>{category.slug}</TableCell>

                      <TableCell className="flex justify-start">
                        <Image
                          src={category.cateIcon}
                          alt={category.name}
                          width={56}
                          height={56}
                          className="h-12 w-12 object-cover"
                          unoptimized
                        />
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {category.createdAt}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {category.updatedAt}
                      </TableCell>
                      <TableCell className="text-center">
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
                              className="cursor-pointer text-orange-500"
                              onClick={() => openEditDialog(category)}
                            >
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer text-destructive"
                              onClick={() => openDeleteDialog(category)}
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
          </div>
        </div>
      </main>
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Make changes to the category details.
            </DialogDescription>
          </DialogHeader>
          {isEditDialogOpen && selectedCategory && (
            <EditCategoryForm
              key={selectedCategory.cateId}
              category={selectedCategory}
              onSuccess={handleEditSuccess}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          {isDeleteDialogOpen && selectedCategory && (
            <DeleteCategoryForm
              key={selectedCategory.cateId}
              category={selectedCategory}
              onSuccess={handleDeleteSuccess}
              onCancel={() => setIsDeleteDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
