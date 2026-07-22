'use client'

import { useState } from "react"
import { Plus, Pencil, Trash2, Search, MoreHorizontal } from "lucide-react"
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
import { categories } from "@/lib/categories"
import { years as importedYears } from "@/lib/years"

type Year = {
    yearId: string
    name: string
    categoryId: string
    subcategories: string[]
    createdAt: string
    updatedAt: string
}

export default function YearsPage() {
    // 1. Correctly flatten the array structure based on your exported Typescript schemas
    const initialYears: Year[] = importedYears
    const [yearList, setYearList] = useState<Year[]>(initialYears)
    const [searchQuery, setSearchQuery] = useState("")

    // Dialog States
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [selectedYear, setSelectedYear] = useState<Year | null>(null)

    // Form Data State (Kept unified so tracking and submitting stay simple)
    const [formData, setFormData] = useState({
        name: "",
        categoryId: "", // Stores selected Category ID
        subcategories: [] as string[], // Stores selected Subcategory IDs
    })

    const allCategories = categories
    const selectedCategory = categories.find(
        (c) => c.cateId === formData.categoryId
    )

    const availableSubcategories =
        selectedCategory?.subcategories || []

    // Flatten subcategories out of categories data safely
    const allSubcategories = categories.flatMap(
        (category) => category.subcategories || []
    )

    // Toggle a subcategory in the formData.subcategories array
    const toggleSubcategory = (subId: string) => {
        setFormData((prev) => ({
            ...prev,
            subcategories: prev.subcategories.includes(subId)
                ? prev.subcategories.filter((id) => id !== subId)
                : [...prev.subcategories, subId],
        }))
    }

    const filteredYears = yearList.filter(
        (year) =>
            year.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const totalPages = Math.ceil(filteredYears.length / rowsPerPage)
    const paginatedYears = filteredYears.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    )

    const handleAdd = () => {
        const newYear: Year = {
            yearId: crypto.randomUUID(),
            name: formData.name,
            categoryId: formData.categoryId,
            subcategories: formData.subcategories,
            createdAt: new Date().toISOString().split("T")[0],
            updatedAt: new Date().toISOString().split("T")[0],
        }

        setYearList((prev) => [...prev, newYear])
        setIsAddDialogOpen(false) // Close dialog on success
    }

    const handleEdit = () => {
        if (!selectedYear) return

        setYearList((prev) =>
            prev.map((year) =>
                year.yearId === selectedYear.yearId
                    ? {
                        ...year,
                        name: formData.name,
                        categoryId: formData.categoryId,
                        subcategories: formData.subcategories,
                        updatedAt: new Date().toISOString(),
                    }
                    : year
            )
        )
        setIsEditDialogOpen(false) // Close dialog on success
    }

    const handleDelete = () => {
        if (!selectedYear) return
        setYearList(yearList.filter((y) => y.yearId !== selectedYear.yearId))
        setSelectedYear(null)
        setIsDeleteDialogOpen(false)
    }

    const openEditDialog = (year: Year) => {
        setSelectedYear(year)
        setFormData({
            name: year.name,
            categoryId: year.categoryId,
            subcategories: year.subcategories,
        })
        setIsEditDialogOpen(true)
    }

    const openDeleteDialog = (year: Year) => {
        setSelectedYear(year)
        setIsDeleteDialogOpen(true)
    }
    // ... UI JSX goes here
    return (
        <>
            <main className="flex-1 overflow-auto p-6 min-w-0">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-[#00a0e9] text-2xl font-semibold tracking-tight">Years</h1>
                            <p className="text-sm text-muted-foreground mt-2">
                                Manage product Years Here.
                            </p>
                        </div>

                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer">
                                    <Plus className="mr-2 size-4" />
                                    Add Year
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add New Year</DialogTitle>
                                    <DialogDescription>
                                        Create a new Year for your products.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label>Name</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Select Categories</Label>
                                        <Select
                                            value={formData.categoryId}
                                            onValueChange={(value) => setFormData({ ...formData, categoryId: value, subcategories: [], })}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select Categories" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    {allCategories.map((cat) => (
                                                        <SelectItem key={cat.cateId} value={cat.cateId}>
                                                            {cat.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Select Subcategories</Label>
                                        {!formData.categoryId ? (
                                            <p className="text-sm text-muted-foreground border rounded-md px-3 py-2">Choose a category first</p>
                                        ) : availableSubcategories.length === 0 ? (
                                            <p className="text-sm text-muted-foreground border rounded-md px-3 py-2">No subcategories available</p>
                                        ) : (
                                            <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                                                {availableSubcategories.map((sub) => (
                                                    <label
                                                        key={sub.subId}
                                                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                                                    >
                                                        <Checkbox
                                                            checked={formData.subcategories.includes(sub.subId)}
                                                            onCheckedChange={() => toggleSubcategory(sub.subId)}
                                                        />
                                                        {sub.name}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" className="h-9 rounded-sm bg-red-500 text-white hover:bg-red-600 hover:text-white cursor-pointer" onClick={() => setIsAddDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer" onClick={handleAdd}>Saved</Button>
                                </DialogFooter>
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
                                    <TableHead>Category</TableHead>
                                    <TableHead>Sub Category</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Updated</TableHead>
                                    <TableHead className="text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedYears.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <Search className="size-8" />
                                                <p>No Year found</p>
                                                {searchQuery && (
                                                    <p className="text-sm">
                                                        No results for &quot;{searchQuery}&quot;
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {paginatedYears.map((year) => (
                                    <TableRow key={year.yearId}>
                                        <TableCell className="text-center font-medium">{year.yearId}</TableCell>
                                        <TableCell>{year.name}</TableCell>
                                        <TableCell>
                                            {
                                                allCategories.find(
                                                    (c) => c.cateId === year.categoryId
                                                ) ? (
                                                    <span className="rounded bg-sky-200 px-2 py-1 text-sm text-black">
                                                        {allCategories.find(
                                                            (c) => c.cateId === year.categoryId
                                                        )?.name}
                                                    </span>
                                                ) : null
                                            }
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {year.subcategories.map((id) => {
                                                    const sub = allSubcategories.find(
                                                        (s) => s.subId === id
                                                    )

                                                    return (
                                                        <span
                                                            key={id}
                                                            className="rounded bg-sky-100 px-2 py-1 text-sm text-black"
                                                        >
                                                            {sub?.name}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{year.createdAt}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{year.updatedAt}</TableCell>
                                        <TableCell className="text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="icon" className="rounded-full cursor-pointer">
                                                        <MoreHorizontal className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="center">
                                                    {/* Changed from category to brand here */}
                                                    <DropdownMenuItem className="text-orange-500 cursor-pointer" onClick={() => openEditDialog(year)}>
                                                        <Pencil className="mr-2 size-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => openDeleteDialog(year)}>
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
                        <DialogTitle>Edit Color</DialogTitle>
                        <DialogDescription>
                            Make changes to the Color details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">Name</Label>
                            <Input
                                id="edit-name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Select Categories</Label>
                            <Select
                                value={formData.categoryId}
                                onValueChange={(value) =>
                                    setFormData({
                                        ...formData,
                                        categoryId: value,
                                        subcategories: [],
                                    })
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.cateId} value={cat.cateId}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Select Subcategories</Label>
                            {!formData.categoryId ? (
                                <p className="text-sm text-muted-foreground border rounded-sm px-3 py-2">Choose a category first</p>
                            ) : availableSubcategories.length === 0 ? (
                                <p className="text-sm text-muted-foreground border rounded-sm px-3 py-2">No subcategories available</p>
                            ) : (
                                <div className="border rounded-sm p-2 max-h-40 overflow-y-scroll space-y-1">
                                    {availableSubcategories.map((sub) => (
                                        <label
                                            key={sub.subId}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                                        >
                                            <Checkbox
                                                checked={formData.subcategories.includes(sub.subId)}
                                                onCheckedChange={() => toggleSubcategory(sub.subId)}
                                            />
                                            {sub.name}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" className="h-9 rounded-sm bg-red-500 text-white hover:bg-red-600 hover:text-white cursor-pointer" onClick={() => setIsEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button className="h-9 rounded-sm bg-sky-500 text-white hover:bg-sky-600 hover:text-white cursor-pointer" onClick={handleEdit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Delete Dialog Block */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Year</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete &quot;{selectedYear?.name}&quot;? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" className="h-9 bg-sky-500 text-white rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer" onClick={() => setIsDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="outline" className="h-9 bg-red-500 text-white rounded-sm hover:bg-red-600 hover:text-white cursor-pointer" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
