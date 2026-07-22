'use client'

import { useState } from "react"
import { Plus, Pencil, Trash2, Search, MoreHorizontal, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { categories as importedCategories } from "@/lib/categories"
import { useAppForm } from "@/components/form/hooks"
import { z } from "zod"
import { subcategories } from "@/lib/subcategories"
import { vgas as importedVgas } from "@/lib/vgas"
import { createVga, deleteVga, updateVga } from "@/actions/vga"
import { toast } from "@/components/ui/sonner"
import { FieldGroup, FieldLabel, FieldSet, FieldContent, FieldLegend, FieldDescription } from "@/components/ui/field"
import { VGA as ImportedVgas } from "@/types/vga"
import { vgaSchema } from "@/schemas/vga"
import { ScreenSize } from "@/types/screensize"

type VgaFormData = z.infer<typeof vgaSchema>

function getSubcategoriesForCategory(categoryId: string) {
    return subcategories.filter((sub) => sub.categoryId === categoryId)
}

function SubcategoryCheckboxes({
    categoryId,
    selectedIds,
    onChange,
}: {
    categoryId: string
    selectedIds: string[]
    onChange: (ids: string[]) => void
}) {
    const filteredSubcategories = getSubcategoriesForCategory(categoryId)

    if (filteredSubcategories.length === 0) {
        return (
            <p className="text-sm text-muted-foreground border rounded-md px-3 py-2">
                No subcategories available for this category.
            </p>
        )
    }
    return (
        <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-2">
            {filteredSubcategories.map((sub) => (
                <label key={sub.subId} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                    <Checkbox
                        checked={selectedIds.includes(sub.subId)}
                        onCheckedChange={(checked) => {
                            if (checked) {
                                onChange([...selectedIds, sub.subId])
                            } else {
                                onChange(selectedIds.filter((id) => id !== sub.subId))
                            }
                        }}
                    />
                    <span>{sub.name}</span>
                </label>
            ))}
        </div>
    )
}

function AddVgaForm({
    onSuccess,
    onCancel,
}: {
    onSuccess: (data: VgaFormData) => void
    onCancel: () => void
}) {
    const [selectedCategoryId, setSelectedCategoryId] = useState("")

    const form = useAppForm({
        defaultValues: {
            name: "",
            slug: "",
            categoryId: "",
            subcategories: [] as string[],
        } satisfies VgaFormData as VgaFormData,
        validators: {
            onSubmit: vgaSchema,
        },
        onSubmit: async ({ value }) => {
            const res = await createVga(value)
            if (res.success) {
                onSuccess(value)
            } else {
                toast.error("Failed to add VGA")
            }
        },
    })

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                form.handleSubmit()
            }}
        >
            <FieldGroup className="py-4">
                <form.AppField name="name">
                    {(field) => <field.Input label="Name" required />}
                </form.AppField>

                <form.AppField name="slug">
                    {(field) => <field.Input label="Slug" required />}
                </form.AppField>

                <form.AppField name="categoryId">
                    {(field) => (
                        <field.Select
                            label="Category"
                            required
                            onValueChange={(value) => {
                                setSelectedCategoryId(value)
                                form.setFieldValue("subcategories", [])
                            }}
                        >
                            {importedCategories.map((category) => (
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
                            <FieldDescription>Select one or more subcategories.</FieldDescription>
                        </FieldContent>
                        <form.AppField name="subcategories">
                            {(field) => (
                                <SubcategoryCheckboxes
                                    categoryId={selectedCategoryId}
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
    )
}

function EditVgaForm({
    vga,
    onSuccess,
    onCancel,
}: {
    vga: ImportedVgas
    onSuccess: (data: VgaFormData) => void
    onCancel: () => void
}) {
    const [selectedCategoryId, setSelectedCategoryId] = useState(vga.categoryId)

    const form = useAppForm({
        defaultValues: {
            name: vga.name,
            slug: vga.slug,
            categoryId: vga.categoryId,
            subcategories: vga.subcategories,
        } satisfies VgaFormData as VgaFormData,
        validators: {
            onSubmit: vgaSchema,
        },
        onSubmit: async ({ value }) => {
            const res = await updateVga(value)
            if (res.success) {
                onSuccess(value)
            } else {
                toast.error("Failed to update CPU")
            }
        },
    })

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                form.handleSubmit()
            }}
        >
            <FieldGroup className="py-4">
                <form.AppField name="name">
                    {(field) => <field.Input label="Name" required />}
                </form.AppField>

                <form.AppField name="slug">
                    {(field) => <field.Input label="Slug" required />}
                </form.AppField>

                <form.AppField name="categoryId">
                    {(field) => (
                        <field.Select
                            label="Category"
                            required
                            onValueChange={(value) => {
                                setSelectedCategoryId(value)
                                form.setFieldValue("subcategories", [])
                            }}
                        >
                            {importedCategories.map((category) => (
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
                            <FieldDescription>Select the subcategories that belong to this brand.</FieldDescription>
                        </FieldContent>
                        <form.AppField name="subcategories">
                            {(field) => (
                                <SubcategoryCheckboxes
                                    categoryId={selectedCategoryId}
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
    )
}

function DeleteVgaForm({
    vga,
    onSuccess,
    onCancel,
}: {
    vga: ImportedVgas
    onSuccess: () => void
    onCancel: () => void
}) {
    const [isDeleting, setIsDeleting] = useState(false)

    async function handleDelete() {
        try {
            setIsDeleting(true)
            const res = await deleteVga({ vgaId: vga.vgaId })

            if (res.success) {
                onSuccess()
            } else {
                toast.error("error" in res ? res.error : "Failed to delete VGA")
            }
        } catch (error) {
            console.error("Delete Error:", error)
            toast.error("An unexpected error occurred")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            <DialogHeader>
                <DialogTitle>Delete VGA</DialogTitle>
                <DialogDescription>
                    Are you sure you want to delete &quot;{vga.name}&quot;? This action cannot be undone.
                </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer" onClick={onCancel} disabled={isDeleting}>
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
    )
}


export default function VGAsPage() {
    const [vgaList, setVgaList] = useState<ImportedVgas[]>(importedVgas)
    const [searchQuery, setSearchQuery] = useState("")
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [selectedVGA, setSelectedVGA] = useState<ImportedVgas | null>(null)

    const allSubcategories = subcategories

    const filteredVgas = vgaList.filter(
        (vga) =>
            vga.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            vga.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const totalPages = Math.max(1, Math.ceil(filteredVgas.length / rowsPerPage))
    const paginatedVgas = filteredVgas.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    )

    const handleAddSuccess = (data: VgaFormData) => {
        const newVga: ImportedVgas = {
            vgaId: crypto.randomUUID(),
            name: data.name,
            slug: data.slug,
            categoryId: data.categoryId,
            subcategories: data.subcategories,
            createdAt: new Date().toISOString().split("T")[0],
            updatedAt: new Date().toISOString().split("T")[0],
        }
        setVgaList((prev) => [...prev, newVga])
        setIsAddDialogOpen(false)
        toast.success(`VGA "${data.name}" created successfully!`)
    }

    const handleEditSuccess = (data: VgaFormData) => {
        if (!selectedVGA) return
        setVgaList((prev) =>
            prev.map((vga) =>
                vga.vgaId === selectedVGA.vgaId
                    ? {
                        ...vga,
                        name: data.name,
                        slug: data.slug,
                        categoryId: data.categoryId,
                        subcategories: data.subcategories,
                        updatedAt: new Date().toISOString().split("T")[0],
                    }
                    : vga
            )
        )
        setSelectedVGA(null)
        setIsEditDialogOpen(false)
        toast.success(`VGA "${data.name}" updated successfully!`)
    }

    const handleDeleteSuccess = () => {
        if (!selectedVGA) return
        const name = selectedVGA.name
        setVgaList((prev) => prev.filter((f) => f.vgaId !== selectedVGA.vgaId))
        setSelectedVGA(null)
        setIsDeleteDialogOpen(false)
        toast.success(`VGA "${name}" deleted successfully!`)
    }

    const openEditDialog = (vga: ImportedVgas) => {
        setSelectedVGA(vga)
        setIsEditDialogOpen(true)
    }

    const openDeleteDialog = (vga: ImportedVgas) => {
        setSelectedVGA(vga)
        setIsDeleteDialogOpen(true)
    }
    // ... UI JSX goes here
    return (
        <>
            <main className="flex-1 overflow-auto p-6 min-w-0">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-[#00a0e9] text-2xl font-semibold tracking-tight">VGAs</h1>
                            <p className="text-sm text-muted-foreground mt-2">
                                Manage product VGAs Here.
                            </p>
                        </div>

                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer">
                                    <Plus className="mr-2 size-4" />
                                    Add VGA
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add New VGA</DialogTitle>
                                    <DialogDescription>
                                        Create a new VGA for your products.
                                    </DialogDescription>
                                </DialogHeader>
                                {isAddDialogOpen && (
                                    <AddVgaForm
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
                                    <TableHead>Category</TableHead>
                                    <TableHead>Sub Category</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Updated</TableHead>
                                    <TableHead className="text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedVgas.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <Search className="size-8" />
                                                <p>No VGA found</p>
                                                {searchQuery && (
                                                    <p className="text-sm">
                                                        No results for &quot;{searchQuery}&quot;
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedVgas.map((vga) => (
                                        <TableRow key={vga.vgaId}>
                                            <TableCell className="text-center font-medium">{vga.vgaId}</TableCell>
                                            <TableCell>{vga.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{vga.slug}</TableCell>
                                            <TableCell>
                                                {importedCategories.find((c) => c.cateId === vga.categoryId) && (
                                                    <span className="rounded bg-sky-200 px-2 py-1 text-sm text-black">
                                                        {importedCategories.find((c) => c.cateId === vga.categoryId)?.name}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {vga.subcategories.map((id) => {
                                                        const sub = subcategories.find((s) => s.subId === id)
                                                        return (
                                                            <span
                                                                key={id}
                                                                className="rounded bg-sky-100 px-2 py-1 text-sm text-black"
                                                            >
                                                                {sub?.name ?? id}
                                                            </span>
                                                        )
                                                    })}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{vga.createdAt}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{vga.updatedAt}</TableCell>
                                            <TableCell className="text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="icon" className="rounded-full cursor-pointer">
                                                            <MoreHorizontal className="size-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="center">
                                                        {/* Changed from category to brand here */}
                                                        <DropdownMenuItem className="text-orange-500 cursor-pointer" onClick={() => openEditDialog(vga)}>
                                                            <Pencil className="mr-2 size-4" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => openDeleteDialog(vga)}>
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
                        {/* Pagination */}
                        <div className="flex items-center justify-between border-t px-4 py-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                Rows per page
                                <Select
                                    value={rowsPerPage.toString()}
                                    onValueChange={(value) => {
                                        setRowsPerPage(Number(value))
                                        setCurrentPage(1)
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
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
                        <DialogTitle>Edit VGA</DialogTitle>
                        <DialogDescription>
                            Make changes to the VGA details.
                        </DialogDescription>
                    </DialogHeader>
                    {isEditDialogOpen && selectedVGA && (
                        <EditVgaForm
                            key={selectedVGA.vgaId}
                            vga={selectedVGA}
                            onSuccess={handleEditSuccess}
                            onCancel={() => setIsEditDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
            {/* Delete Dialog Block */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    {isDeleteDialogOpen && selectedVGA && (
                        <DeleteVgaForm
                            key={selectedVGA.vgaId}
                            vga={selectedVGA}
                            onSuccess={handleDeleteSuccess}
                            onCancel={() => setIsDeleteDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
