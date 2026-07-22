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
import { categories, categories as importedCategories } from "@/lib/categories"
import { useAppForm } from "@/components/form/hooks"
import { z } from "zod"
import { subcategories } from "@/lib/subcategories"
import Image from "next/image"
import { JobTypes as importedJobtypes } from "@/lib/jobtypes"
import { jobtypeSchema } from "@/schemas/jobtype"
import type { JobType } from "@/types/jobtype"
import { createJobtype, deleteJobtype, updateJobtype } from "@/actions/jobtype"
import { toast } from "@/components/ui/sonner"
import { FieldGroup, FieldLabel, FieldSet, FieldContent, FieldLegend, FieldDescription } from "@/components/ui/field"

type JobtypeFormData = z.infer<typeof jobtypeSchema>

function getSubcategoriesForCategory(categoryId: string) {
    return subcategories.filter((sub) => sub.categoryId === categoryId)
}

function AddJobtypeForm({
    onSuccess,
    onCancel,
}: {
    onSuccess: (data: JobtypeFormData) => void
    onCancel: () => void
}) {
    const [selectedCategoryId, setSelectedCategoryId] = useState("")

    const form = useAppForm({
        defaultValues: {
            name: "",
            slug: "",
            image: "",
            categoryId: "",
        } satisfies JobtypeFormData as JobtypeFormData,
        validators: {
            onSubmit: jobtypeSchema,
        },
        onSubmit: async ({ value }) => {
            const res = await createJobtype(value)
            if (res.success) {
                onSuccess(value)
            } else {
                toast.error("Failed to add jobtype")
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

                <form.AppField name="image">
                    {(field) => (
                        <>
                            <FieldLabel htmlFor="image">Logo</FieldLabel>
                            <Input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                        form.setFieldValue("image", URL.createObjectURL(file))
                                    }
                                }}
                            />
                            {field.state.value && (
                                <Image
                                    src={field.state.value}
                                    alt="Preview"
                                    width={120}
                                    height={120}
                                    className="w-32 h-32 object-cover rounded border border-border"
                                    unoptimized
                                />
                            )}
                        </>
                    )}
                </form.AppField>

                <form.AppField name="categoryId">
                    {(field) => (
                        <field.Select
                            label="Category"
                            required
                            onValueChange={(value) => {
                                setSelectedCategoryId(value)
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

function EditJobtypeForm({
    jobtype,
    onSuccess,
    onCancel,
}: {
    jobtype: JobType
    onSuccess: (data: JobtypeFormData) => void
    onCancel: () => void
}) {
    const [selectedCategoryId, setSelectedCategoryId] = useState(jobtype.categoryId)

    const form = useAppForm({
        defaultValues: {
            name: jobtype.name,
            slug: jobtype.slug,
            image: jobtype.image || "",
            categoryId: jobtype.categoryId,
        } satisfies JobtypeFormData as JobtypeFormData,
        validators: {
            onSubmit: jobtypeSchema,
        },
        onSubmit: async ({ value }) => {
            const res = await updateJobtype(value)
            if (res.success) {
                onSuccess(value)
            } else {
                toast.error("Failed to update jobtype")
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

                <form.AppField name="image">
                    {(field) => (
                        <>
                            <FieldLabel htmlFor="image">Logo</FieldLabel>
                            <Input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                        form.setFieldValue("image", URL.createObjectURL(file))
                                    }
                                }}
                            />
                            {field.state.value && (
                                <Image
                                    src={field.state.value}
                                    alt="Current brand logo"
                                    width={120}
                                    height={120}
                                    className="w-32 h-32 object-cover rounded border border-border"
                                    unoptimized
                                />
                            )}
                        </>
                    )}
                </form.AppField>

                <form.AppField name="categoryId">
                    {(field) => (
                        <field.Select
                            label="Category"
                            required
                            onValueChange={(value) => {
                                setSelectedCategoryId(value)
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

function DeleteJobtypeForm({
    jobtype,
    onSuccess,
    onCancel,
}: {
    jobtype: JobType
    onSuccess: () => void
    onCancel: () => void
}) {
    const [isDeleting, setIsDeleting] = useState(false)

    async function handleDelete() {
        try {
            setIsDeleting(true)
            const res = await deleteJobtype({ jobtypeId: jobtype.jobTypeId })

            if (res.success) {
                onSuccess()
            } else {
                toast.error("error" in res ? res.error : "Failed to delete jobtype")
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
                <DialogTitle>Delete Jobtype</DialogTitle>
                <DialogDescription>
                    Are you sure you want to delete &quot;{jobtype.name}&quot;? This action cannot be undone.
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


export default function JobtypesPage() {
    const [jobtypeList, setJobList] = useState<JobType[]>(importedJobtypes)
    const [searchQuery, setSearchQuery] = useState("")
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [selectedJobtype, setSelectedJobtype] = useState<JobType | null>(null)

    const allSubcategories = subcategories

    const filteredJobtypes = jobtypeList.filter(
        (jobtype) =>
            jobtype.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            jobtype.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const totalPages = Math.max(1, Math.ceil(filteredJobtypes.length / rowsPerPage))
    const paginatedJobtypes = filteredJobtypes.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    )

    const handleAddSuccess = (data: JobtypeFormData) => {
        const newJobtype: JobType = {
            jobTypeId: crypto.randomUUID(),
            name: data.name,
            slug: data.slug,
            image: data.image,
            categoryId: data.categoryId,
            createdAt: new Date().toISOString().split("T")[0],
            updatedAt: new Date().toISOString().split("T")[0],
        }
        setJobList((prev) => [...prev, newJobtype])
        setIsAddDialogOpen(false)
        toast.success(`Jobtype "${data.name}" created successfully!`)
    }

    const handleEditSuccess = (data: JobtypeFormData) => {
        if (!selectedJobtype) return
        setJobList((prev) =>
            prev.map((jobtype) =>
                jobtype.jobTypeId === selectedJobtype.jobTypeId
                    ? {
                        ...jobtype,
                        name: data.name,
                        slug: data.slug,
                        image: data.image,
                        categoryId: data.categoryId,
                        updatedAt: new Date().toISOString().split("T")[0],
                    }
                    : jobtype
            )
        )
        setSelectedJobtype(null)
        setIsEditDialogOpen(false)
        toast.success(`Jobtype "${data.name}" updated successfully!`)
    }

    const handleDeleteSuccess = () => {
        if (!selectedJobtype) return
        const name = selectedJobtype.name
        setJobList((prev) => prev.filter((jobtype) => jobtype.jobTypeId !== selectedJobtype.jobTypeId))
        setSelectedJobtype(null)
        setIsDeleteDialogOpen(false)
        toast.success(`Jobtype "${name}" deleted successfully!`)
    }

    const openEditDialog = (jobtype: JobType) => {
        setSelectedJobtype(jobtype)
        setIsEditDialogOpen(true)
    }

    const openDeleteDialog = (jobtype: JobType) => {
        setSelectedJobtype(jobtype)
        setIsDeleteDialogOpen(true)
    }
    // ... UI JSX goes here
    return (
        <>
            <main className="flex-1 overflow-auto p-6 min-w-0">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-[#00a0e9] text-2xl font-semibold tracking-tight">Jobtypes</h1>
                            <p className="text-sm text-muted-foreground mt-2">
                                Manage Jobtypes Here.
                            </p>
                        </div>

                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer">
                                    <Plus className="mr-2 size-4" />
                                    Add Jobtype
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add New Jobtype</DialogTitle>
                                    <DialogDescription>
                                        Create a new Jobtype for your products.
                                    </DialogDescription>
                                </DialogHeader>
                                {isAddDialogOpen && (
                                    <AddJobtypeForm
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
                                    <TableHead className="text-start">Logo</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Sub Category</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Updated</TableHead>
                                    <TableHead className="text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedJobtypes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <Search className="size-8" />
                                                <p>No jobtype found</p>
                                                {searchQuery && (
                                                    <p className="text-sm">
                                                        No results for &quot;{searchQuery}&quot;
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedJobtypes.map((jobtype) => (
                                        <TableRow key={jobtype.jobTypeId}>
                                            <TableCell className="text-center font-medium">{jobtype.jobTypeId}</TableCell>
                                            <TableCell>{jobtype.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{jobtype.slug}</TableCell>
                                            <TableCell>
                                                {jobtype.image ? (
                                                    <Image
                                                        src={jobtype.image}
                                                        alt={jobtype.name || "Image"}
                                                        width={40}
                                                        height={40}
                                                        className="w-10 h-10 object-contain rounded border bg-muted/30 p-0.5"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    // Optional: Render a fallback box or placeholder icon when there is no image
                                                    <div className="w-10 h-10 rounded border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                                                        No Img
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {importedCategories.find((c) => c.cateId === jobtype.categoryId) && (
                                                    <span className="rounded bg-sky-200 px-2 py-1 text-sm text-black">
                                                        {importedCategories.find((c) => c.cateId === jobtype.categoryId)?.name}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{jobtype.createdAt}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{jobtype.updatedAt}</TableCell>
                                            <TableCell className="text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="icon" className="rounded-full cursor-pointer">
                                                            <MoreHorizontal className="size-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="center">
                                                        {/* Changed from category to brand here */}
                                                        <DropdownMenuItem className="text-orange-500 cursor-pointer" onClick={() => openEditDialog(jobtype)}>
                                                            <Pencil className="mr-2 size-4" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => openDeleteDialog(jobtype)}>
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
                        <DialogTitle>Edit Jobtype</DialogTitle>
                        <DialogDescription>
                            Make changes to the Jobtype details.
                        </DialogDescription>
                    </DialogHeader>
                    {isEditDialogOpen && selectedJobtype && (
                        <EditJobtypeForm
                            key={selectedJobtype.jobTypeId}
                            jobtype={selectedJobtype}
                            onSuccess={handleEditSuccess}
                            onCancel={() => setIsEditDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
            {/* Delete Dialog Block */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    {isDeleteDialogOpen && selectedJobtype && (
                        <DeleteJobtypeForm
                            key={selectedJobtype.jobTypeId}
                            jobtype={selectedJobtype}
                            onSuccess={handleDeleteSuccess}
                            onCancel={() => setIsDeleteDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
