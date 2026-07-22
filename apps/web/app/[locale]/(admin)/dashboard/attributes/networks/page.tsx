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
import { networks as importedNetworks } from "@/lib/networks"
import { networkSchema } from "@/schemas/network"
import type { Network } from "@/types/network"
import { createNetwork, deleteNetwork, updateNetwork } from "@/actions/network"
import { toast } from "@/components/ui/sonner"
import { updateBrand, deleteBrand } from "@/actions/brand"
import { FieldGroup, FieldLabel, FieldSet, FieldContent, FieldLegend, FieldDescription } from "@/components/ui/field"

type NetworkFormData = z.infer<typeof networkSchema>

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

function AddNetworkForm({
    onSuccess,
    onCancel,
}: {
    onSuccess: (data: NetworkFormData) => void
    onCancel: () => void
}) {
    const [selectedCategoryId, setSelectedCategoryId] = useState("")

    const form = useAppForm({
        defaultValues: {
            name: "",
            slug: "",
            image: "",
            categoryId: "",
            subcategories: [] as string[],
        } satisfies NetworkFormData as NetworkFormData,
        validators: {
            onSubmit: networkSchema,
        },
        onSubmit: async ({ value }) => {
            const res = await createNetwork(value)
            if (res.success) {
                onSuccess(value)
            } else {
                toast.error("Failed to add network")
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

function EditNetworkForm({
    network,
    onSuccess,
    onCancel,
}: {
    network: Network
    onSuccess: (data: NetworkFormData) => void
    onCancel: () => void
}) {
    const [selectedCategoryId, setSelectedCategoryId] = useState(network.categoryId)

    const form = useAppForm({
        defaultValues: {
            name: network.name,
            slug: network.slug,
            image: network.image,
            categoryId: network.categoryId,
            subcategories: network.subcategories,
        } satisfies NetworkFormData as NetworkFormData,
        validators: {
            onSubmit: networkSchema,
        },
        onSubmit: async ({ value }) => {
            const res = await updateNetwork(value)
            if (res.success) {
                onSuccess(value)
            } else {
                toast.error("Failed to update network")
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

function DeleteNetworkForm({
    network,
    onSuccess,
    onCancel,
}: {
    network: Network
    onSuccess: () => void
    onCancel: () => void
}) {
    const [isDeleting, setIsDeleting] = useState(false)

    async function handleDelete() {
        try {
            setIsDeleting(true)
            const res = await deleteNetwork({ networkId: network.networkId })

            if (res.success) {
                onSuccess()
            } else {
                toast.error("error" in res ? res.error : "Failed to delete network")
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
                <DialogTitle>Delete Network</DialogTitle>
                <DialogDescription>
                    Are you sure you want to delete &quot;{network.name}&quot;? This action cannot be undone.
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


export default function NetworksPage() {
    const [networkList, setNetworkList] = useState<Network[]>(importedNetworks)
    const [searchQuery, setSearchQuery] = useState("")
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null)

    const allSubcategories = subcategories

    const filteredNetworks = networkList.filter(
        (network) =>
            network.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            network.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const totalPages = Math.max(1, Math.ceil(filteredNetworks.length / rowsPerPage))
    const paginatedNetworks = filteredNetworks.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    )

    const handleAddSuccess = (data: NetworkFormData) => {
        const newNetwork: Network = {
            networkId: crypto.randomUUID(),
            name: data.name,
            slug: data.slug,
            image: data.image,
            categoryId: data.categoryId,
            subcategories: data.subcategories,
            createdAt: new Date().toISOString().split("T")[0],
            updatedAt: new Date().toISOString().split("T")[0],
        }
        setNetworkList((prev) => [...prev, newNetwork])
        setIsAddDialogOpen(false)
        toast.success(`Network "${data.name}" created successfully!`)
    }

    const handleEditSuccess = (data: NetworkFormData) => {
        if (!selectedNetwork) return
        setNetworkList((prev) =>
            prev.map((network) =>
                network.networkId === selectedNetwork.networkId
                    ? {
                        ...network,
                        name: data.name,
                        slug: data.slug,
                        image: data.image,
                        categoryId: data.categoryId,
                        subcategories: data.subcategories,
                        updatedAt: new Date().toISOString().split("T")[0],
                    }
                    : network
            )
        )
        setSelectedNetwork(null)
        setIsEditDialogOpen(false)
        toast.success(`Network "${data.name}" updated successfully!`)
    }

    const handleDeleteSuccess = () => {
        if (!selectedNetwork) return
        const name = selectedNetwork.name
        setNetworkList((prev) => prev.filter((b) => b.networkId !== selectedNetwork.networkId))
        setSelectedNetwork(null)
        setIsDeleteDialogOpen(false)
        toast.success(`Network "${name}" deleted successfully!`)
    }

    const openEditDialog = (network: Network) => {
        setSelectedNetwork(network)
        setIsEditDialogOpen(true)
    }

    const openDeleteDialog = (network: Network) => {
        setSelectedNetwork(network)
        setIsDeleteDialogOpen(true)
    }
    // ... UI JSX goes here
    return (
        <>
            <main className="flex-1 overflow-auto p-6 min-w-0">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-[#00a0e9] text-2xl font-semibold tracking-tight">Networks</h1>
                            <p className="text-sm text-muted-foreground mt-2">
                                Manage Networks Here.
                            </p>
                        </div>

                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer">
                                    <Plus className="mr-2 size-4" />
                                    Add Network
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add New Network</DialogTitle>
                                    <DialogDescription>
                                        Create a new Network for your products.
                                    </DialogDescription>
                                </DialogHeader>
                                {isAddDialogOpen && (
                                    <AddNetworkForm
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
                                {paginatedNetworks.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <Search className="size-8" />
                                                <p>No network found</p>
                                                {searchQuery && (
                                                    <p className="text-sm">
                                                        No results for &quot;{searchQuery}&quot;
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                               ) : (
                                paginatedNetworks.map((network) => (
                                    <TableRow key={network.networkId}>
                                        <TableCell className="text-center font-medium">{network.networkId}</TableCell>
                                        <TableCell>{network.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{network.slug}</TableCell>
                                        <TableCell>
                                            <Image
                                                src={network.image}
                                                alt={network.name}
                                                width={40}
                                                height={40}
                                                className="w-10 h-10 object-contain rounded border bg-muted/30 p-0.5"
                                                unoptimized
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {importedCategories.find((c) => c.cateId === network.categoryId) && (
                                                <span className="rounded bg-sky-200 px-2 py-1 text-sm text-black">
                                                    {importedCategories.find((c) => c.cateId === network.categoryId)?.name}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {network.subcategories.map((id) => {
                                                    const sub = allSubcategories.find((s) => s.subId === id)
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
                                        <TableCell className="text-sm text-muted-foreground">{network.createdAt}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{network.updatedAt}</TableCell>
                                        <TableCell className="text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="icon" className="rounded-full cursor-pointer">
                                                        <MoreHorizontal className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="center">
                                                    {/* Changed from category to brand here */}
                                                    <DropdownMenuItem className="text-orange-500 cursor-pointer" onClick={() => openEditDialog(network)}>
                                                        <Pencil className="mr-2 size-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => openDeleteDialog(network)}>
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
                        <DialogTitle>Edit Network</DialogTitle>
                        <DialogDescription>
                            Make changes to the Network details.
                        </DialogDescription>
                    </DialogHeader>
                    {isEditDialogOpen && selectedNetwork && (
                        <EditNetworkForm
                            key={selectedNetwork.networkId}
                            network={selectedNetwork}
                            onSuccess={handleEditSuccess}
                            onCancel={() => setIsEditDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
            {/* Delete Dialog Block */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                {isDeleteDialogOpen && selectedNetwork && (
                        <DeleteNetworkForm
                            key={selectedNetwork.networkId}
                            network={selectedNetwork}
                            onSuccess={handleDeleteSuccess}
                            onCancel={() => setIsDeleteDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
