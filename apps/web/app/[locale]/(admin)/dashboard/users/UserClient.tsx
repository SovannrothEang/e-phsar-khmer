'use client'

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MoreVertical, Eye, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, BadgeCheck, UserRound } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useRouter } from "@/i18n/routing"
import { Users } from "@/lib/users"
import { User } from "@/types/user"



export default function UserPage() {
    const [users, setUsers] = useState<User[]>(Users)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [searchQuery, setSearchQuery] = useState("")

    // Filter users based on search query
    const [tab, setTab] = useState("all")

    const router = useRouter()

    const filteredUsers = users.filter((user) => {
        const query = searchQuery.toLowerCase()
        if (user.role.toLowerCase() === "admin") {
            return false
        }
        const matchesSearch =
            user.userId.toLowerCase().includes(query) ||
            user.name.toLowerCase().includes(query) ||
            user.username.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query) ||
            user.accountType.toLowerCase().includes(query) ||
            user.role.toLowerCase().includes(query) ||
            user.status.toLowerCase().includes(query)

        const matchesTab =
            tab === "all" ||
            (tab === "premium" && user.accountType === "Premium") ||
            (tab === "normal" && user.accountType === "Normal")

        return matchesSearch && matchesTab
    })
    const totalPages = Math.ceil(filteredUsers.length / rowsPerPage)
    const startIndex = (currentPage - 1) * rowsPerPage
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + rowsPerPage)

    const handleDelete = () => {
        if (!selectedUser) return

        setUsers((prev) => prev.filter((u) => u.userId !== selectedUser.userId))

        setIsDeleteDialogOpen(false)
        setSelectedUser(null)
    }


    const getAccountTypeBadge = (type: User["accountType"]) => {
        switch (type) {
            case "Premium":
                return (
                    <Badge variant="outline" >
                        <BadgeCheck className="text-blue-500" />
                        Premium
                    </Badge>
                )
            case "Normal":
                return (
                    <Badge variant="outline">
                        <UserRound className="text-slate-500" />
                        <p className="text-slate-500">Normal</p>
                    </Badge>
                )
        }
    }


    return (
        <>
            <main className="flex-1 overflow-auto p-6 min-w-0">
                <div className="space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl text-sky-500 font-semibold tracking-tight">Users</h1>
                            <p className="text-sm text-muted-foreground">
                                Manage your users and accounts
                            </p>
                        </div>
                    </div>
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, email, ID..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setCurrentPage(1) // Reset to first page on search
                            }}
                            className="pl-9"
                        />
                    </div>
                    {/* Tabs */}
                    <Tabs
                        value={tab}
                        onValueChange={(value) => {
                            setTab(value)
                            setCurrentPage(1)
                        }}
                    >
                        <TabsList>
                            <TabsTrigger value="all" className="cursor-pointer">All Users</TabsTrigger>
                            <TabsTrigger value="premium" className="cursor-pointer">
                                Premium
                                <Badge className="bg-blue-500 ml-1.5 text-xs text-white">
                                    {users.filter((u) => u.accountType === "Premium").length}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="normal" className="cursor-pointer">
                                Normal
                                <Badge className="bg-slate-500 ml-1.5 text-xs text-white">
                                    {users.filter((u) => u.accountType === "Normal").length}
                                </Badge>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Table */}
                    <div className="rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-center">ID</TableHead>
                                    <TableHead className="px-10">Profile+Email</TableHead>
                                    <TableHead >Username</TableHead>
                                    <TableHead className="text-start">Phone</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Verified</TableHead>
                                    <TableHead>AccountType</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead>Updated At</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <Search className="size-8" />
                                                <p>No users found</p>
                                                {searchQuery && (
                                                    <p className="text-sm">
                                                        No results for &quot;{searchQuery}&quot;
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {paginatedUsers.map((user) => (
                                    <TableRow key={user.userId}>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {user.userId}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="size-8">
                                                    <AvatarImage src={user.profileImage} />
                                                    <AvatarFallback>
                                                        {user.name[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="text-start">
                                                    <div className="font-medium">{user.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {user.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-start">{user.username}</TableCell>
                                        <TableCell>
                                            <div className="grid grid-rows-3 grid-flow-col gap-x-4 gap-y-1 text-sm ">
                                                {user.networks
                                                    .filter((network) => network !== "")
                                                    .map((network, index) => (
                                                        <span key={index}>+{network}</span>
                                                    ))}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="text-card-500 border-yellow-500/30 bg-yellow-500/30">{user.role}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {user.isVerified ? (
                                                <Badge variant="outline">
                                                    <span className="size-1.5 rounded-full bg-emerald-500" />
                                                    Yes
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">
                                                    <span className="size-1.5 rounded-full bg-rose-500" />
                                                    No
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>{getAccountTypeBadge(user.accountType)}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {new Date(user.createdAt).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {new Date(user.updatedAt).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </TableCell>
                                        {/* Actions */}
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button size="icon" variant="outline" className="rounded-full cursor-pointer">
                                                        <MoreVertical className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="center">
                                                    <DropdownMenuItem className="text-sky-500 cursor-pointer" onClick={() => {
                                                        router.push({
                                                            pathname: `/[slug]`,
                                                            params: {
                                                                slug: `${user?.username}${user?.userId}`,
                                                            },
                                                        })
                                                    }}>
                                                        <Eye className="mr-2 size-4" />
                                                        View
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-rose-500 cursor-pointer"
                                                        onClick={() => {
                                                            setSelectedUser(user)
                                                            setIsDeleteDialogOpen(true)
                                                        }}
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
            {/* Delete User */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete User</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete User{" "}
                            <span className="font-semibold text-red-500">{selectedUser?.name}</span>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex justify-end gap-2">
                        <Button className="h-9 text-white bg-sky-500 rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer" onClick={() => setIsDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button className="h-9 text-white bg-red-500 rounded-sm hover:bg-red-600 hover:text-white cursor-pointer" onClick={handleDelete}>
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
