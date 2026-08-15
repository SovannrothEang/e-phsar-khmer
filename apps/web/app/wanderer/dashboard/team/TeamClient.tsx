"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MoreVertical,
  Plus,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  XIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminUsers, type AdminUsersResult } from "@/actions/admin-users";
import { User } from "@/types/user";
import { z } from "zod";
import Image from "next/image";
import { USER_ROLES, usersSchema, editUserSchema } from "@/schemas/user";
import { toast } from "@/components/ui/sonner";
import {
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldContent,
  FieldLegend,
  FieldDescription,
  Field,
  FieldError,
} from "@/components/ui/field";
import { useAppForm } from "@/components/form/hooks";
import { createUser, updateUser, deleteUser } from "@/actions/user";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
type AddUserFormData = z.infer<typeof usersSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;

// ─── Add User Form ─────────────────────────────────────────────────────────────

function AddUserForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (data: AddUserFormData) => void;
  onCancel: () => void;
}) {
  const form = useAppForm({
    defaultValues: {
      name: "",
      username: "",
      email: "",
      profile: "",
      password: "",
      phones: [{ phone: "" }],
      role: "admin" as (typeof USER_ROLES)[number],
    },
    validators: {
      onChange: usersSchema,
      onSubmit: usersSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await createUser(value);

      if (res.success) {
        form.reset();
        onSuccess(value);
      } else {
        toast.error(res.error ?? "Failed to add user");
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex flex-col h-full max-h-[85vh]"
    >
      <div className="flex-1 overflow-y-auto px-1 pr-3 max-h-[80vh] scrollbar-thin">
        <FieldGroup className="py-4">
          <form.AppField name="name">
            {(field) => <field.Input label="Name" required />}
          </form.AppField>

          <form.AppField name="username">
            {(field) => <field.Input label="Username" required />}
          </form.AppField>

          <form.AppField name="email">
            {(field) => <field.Input label="Email" required />}
          </form.AppField>

          <form.AppField name="password">
            {(field) => (
              <field.Input label="Password" type="password" required />
            )}
          </form.AppField>

          {/* Phone Numbers (array field) */}
          <form.Field name="phones" mode="array">
            {(field) => (
              <FieldSet>
                <div className="flex justify-between gap-2 items-center">
                  <FieldContent>
                    <FieldLegend variant="label" className="mb-0">
                      Phone Numbers
                    </FieldLegend>
                    <FieldDescription>
                      Add up to 3 phone numbers for this user.
                    </FieldDescription>
                    {field.state.meta.errors && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </FieldContent>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => field.pushValue({ phone: "" })}
                    disabled={field.state.value.length >= 3}
                    className="bg-green-500 text-white hover:bg-green-600 hover:text-white cursor-pointer"
                  >
                    Add Phone
                  </Button>
                </div>
                <FieldGroup>
                  {field.state.value.map((_, index) => (
                    <form.Field key={index} name={`phones[${index}].phone`}>
                      {(innerField) => {
                        const isInvalid =
                          innerField.state.meta.isTouched &&
                          !innerField.state.meta.isValid;
                        return (
                          <Field
                            orientation="horizontal"
                            data-invalid={isInvalid}
                          >
                            <FieldContent>
                              <InputGroup>
                                <InputGroupInput
                                  id={innerField.name}
                                  aria-invalid={isInvalid}
                                  aria-label={`Phone number ${index + 1}`}
                                  type="tel"
                                  placeholder={`Phone ${index + 1}`}
                                  onBlur={innerField.handleBlur}
                                  onChange={(e) =>
                                    innerField.handleChange(e.target.value)
                                  }
                                  value={innerField.state.value}
                                />
                                {field.state.value.length > 1 && (
                                  <InputGroupAddon align="inline-end">
                                    <InputGroupButton
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => field.removeValue(index)}
                                      aria-label={`Remove phone ${index + 1}`}
                                    >
                                      <XIcon />
                                    </InputGroupButton>
                                  </InputGroupAddon>
                                )}
                              </InputGroup>
                              {isInvalid && (
                                <FieldError
                                  errors={innerField.state.meta.errors}
                                />
                              )}
                            </FieldContent>
                          </Field>
                        );
                      }}
                    </form.Field>
                  ))}
                </FieldGroup>
              </FieldSet>
            )}
          </form.Field>

          {/* Profile Image */}
          <form.AppField name="profile">
            {(field) => (
              <>
                <FieldLabel htmlFor="add-profile">Profile Image</FieldLabel>
                {field.state.value && (
                  <div className="flex justify-center w-full pt-2">
                    <Image
                      src={field.state.value}
                      alt="Profile preview"
                      width={120}
                      height={120}
                      className="w-32 h-32 object-cover rounded-full border border-border"
                      unoptimized
                    />
                  </div>
                )}
                <Input
                  id="add-profile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      form.setFieldValue("profile", URL.createObjectURL(file));
                    }
                  }}
                />
              </>
            )}
          </form.AppField>

          {/* Role */}
          <form.AppField name="role">
            {(field) => (
              <field.Select label="Role" required>
                {USER_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>
        </FieldGroup>
      </div>

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

// ─── Edit User Form ────────────────────────────────────────────────────────────

function EditUserForm({
  user,
  onSuccess,
  onCancel,
}: {
  user: User;
  onSuccess: (data: EditUserFormData) => void;
  onCancel: () => void;
}) {
  const form = useAppForm({
    defaultValues: {
      name: user.name,
      username: user.username,
      email: user.email,
      profile: user.profileImage ?? "",
      password: "",
      phones:
        user.networks.length > 0
          ? user.networks.map((n) => ({ phone: n }))
          : [{ phone: "" }],
      role: (USER_ROLES.includes(user.role as (typeof USER_ROLES)[number])
        ? user.role
        : "user") as (typeof USER_ROLES)[number],
    } satisfies EditUserFormData,
    validators: {
      onChange: editUserSchema,
      onSubmit: editUserSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await updateUser(user.userId, value);
      if (res.success) {
        onSuccess(value);
        toast.success("User updated successfully");
      } else {
        toast.error(res.error ?? "Failed to update user");
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex flex-col h-full max-h-[85vh]"
    >
      <div className="flex-1 overflow-y-auto px-1 pr-3 max-h-[80vh] scrollbar-thin">
        <FieldGroup className="py-4">
          <form.AppField name="name">
            {(field) => <field.Input label="Name" required />}
          </form.AppField>

          <form.AppField name="username">
            {(field) => <field.Input label="Username" required />}
          </form.AppField>

          <form.AppField name="email">
            {(field) => <field.Input label="Email" required />}
          </form.AppField>

          <form.AppField name="password">
            {(field) => (
              <field.Input
                label="Password"
                type="password"
                description="Leave empty to keep current password"
              />
            )}
          </form.AppField>

          {/* Phone Numbers (array field) */}
          <form.Field name="phones" mode="array">
            {(field) => (
              <FieldSet>
                <div className="flex justify-between gap-2 items-center">
                  <FieldContent>
                    <FieldLegend variant="label" className="mb-0">
                      Phone Numbers
                    </FieldLegend>
                    <FieldDescription>
                      Add up to 3 phone numbers for this user.
                    </FieldDescription>
                    {field.state.meta.errors && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </FieldContent>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => field.pushValue({ phone: "" })}
                    disabled={field.state.value.length >= 3}
                    className="bg-green-500 text-white hover:bg-green-600 hover:text-white cursor-pointer"
                  >
                    Add Phone
                  </Button>
                </div>
                <FieldGroup>
                  {field.state.value.map((_, index) => (
                    <form.Field key={index} name={`phones[${index}].phone`}>
                      {(innerField) => {
                        const isInvalid =
                          innerField.state.meta.isTouched &&
                          !innerField.state.meta.isValid;
                        return (
                          <Field
                            orientation="horizontal"
                            data-invalid={isInvalid}
                          >
                            <FieldContent>
                              <InputGroup>
                                <InputGroupInput
                                  id={innerField.name}
                                  aria-invalid={isInvalid}
                                  aria-label={`Phone number ${index + 1}`}
                                  type="tel"
                                  placeholder={`Phone ${index + 1}`}
                                  onBlur={innerField.handleBlur}
                                  onChange={(e) =>
                                    innerField.handleChange(e.target.value)
                                  }
                                  value={innerField.state.value}
                                />
                                {field.state.value.length > 1 && (
                                  <InputGroupAddon align="inline-end">
                                    <InputGroupButton
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => field.removeValue(index)}
                                      aria-label={`Remove phone ${index + 1}`}
                                    >
                                      <XIcon />
                                    </InputGroupButton>
                                  </InputGroupAddon>
                                )}
                              </InputGroup>
                              {isInvalid && (
                                <FieldError
                                  errors={innerField.state.meta.errors}
                                />
                              )}
                            </FieldContent>
                          </Field>
                        );
                      }}
                    </form.Field>
                  ))}
                </FieldGroup>
              </FieldSet>
            )}
          </form.Field>

          {/* Profile Image */}
          <form.AppField name="profile">
            {(field) => (
              <>
                <FieldLabel htmlFor="edit-profile">Profile Image</FieldLabel>
                {field.state.value && (
                  <div className="flex justify-center w-full pt-2">
                    <Image
                      src={field.state.value}
                      alt="Profile preview"
                      width={120}
                      height={120}
                      className="w-32 h-32 object-cover rounded-full border border-border"
                      unoptimized
                    />
                  </div>
                )}
                <Input
                  id="edit-profile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      form.setFieldValue("profile", URL.createObjectURL(file));
                    }
                  }}
                />
              </>
            )}
          </form.AppField>

          {/* Role */}
          <form.AppField name="role">
            {(field) => (
              <field.Select label="Role" required>
                {USER_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>
        </FieldGroup>
      </div>

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

// ─── Delete User Form ──────────────────────────────────────────────────────────

function DeleteUserForm({
  user,
  onSuccess,
  onCancel,
}: {
  user: User;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    try {
      setIsDeleting(true);
      const res = await deleteUser({ userId: user.userId });

      if (res.success) {
        onSuccess();
        toast.success("User deleted successfully");
      } else {
        toast.error("Failed to delete user");
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
        <DialogTitle>Delete User</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete{" "}
          <strong className="font-semibold text-red-500">
            &quot;{user.name}&quot;
          </strong>
          ? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          className="h-9 bg-sky-500 text-white rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer"
          onClick={onCancel}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          className="h-9 bg-red-500 text-white rounded-sm hover:bg-red-600 hover:text-white cursor-pointer"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Main TeamPage ─────────────────────────────────────────────────────────────

export default function TeamPage({
  initialData,
}: {
  initialData?: AdminUsersResult;
}) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "team"],
    queryFn: () => getAdminUsers({ role: "admin" }),
    initialData,
  });
  const users = data?.users ?? [];

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState("all");

  // Filter: hide plain "user" role — this page shows team members (admins etc.)
  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();

    if (user.role.toLowerCase() === "user") return false;

    const matchesSearch =
      user.userId.toLowerCase().includes(query) ||
      user.name.toLowerCase().includes(query) ||
      user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.networks.join(",").toLowerCase().includes(query) ||
      user.status.toLowerCase().includes(query);

    const matchesTab =
      tab === "all" ||
      (tab === "online" && user.status === "Online") ||
      (tab === "offline" && user.status === "Offline");

    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedUsers = filteredUsers.slice(
    startIndex,
    startIndex + rowsPerPage,
  );

  const getStatusBadge = (status: User["status"]) => {
    switch (status) {
      case "Online":
        return (
          <Badge variant="outline">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Online
          </Badge>
        );
      case "Offline":
        return (
          <Badge variant="outline">
            <span className="size-1.5 rounded-full bg-rose-500" />
            Offline
          </Badge>
        );
    }
  };

  const refreshTeam = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "team"] });

  // ── Add handler ──────────────────────────────────────────────────────────────
  const handleAddSuccess = () => {
    refreshTeam();
    setIsAddDialogOpen(false);
    toast.success("User added successfully");
  };

  // ── Edit handler ─────────────────────────────────────────────────────────────
  const handleEditSuccess = () => {
    refreshTeam();
    setIsEditDialogOpen(false);
    setSelectedUser(null);
  };

  // ── Delete handler ────────────────────────────────────────────────────────────
  const handleDeleteSuccess = () => {
    refreshTeam();
    setIsDeleteDialogOpen(false);
    setSelectedUser(null);
  };

  return (
    <>
      <main className="flex-1 overflow-auto p-6 min-w-0">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[#00a0e9] text-2xl font-semibold tracking-tight">
                Team
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Manage your team and roles
              </p>
            </div>
            <Button
              className="h-9 bg-sky-500 text-white rounded-sm hover:bg-sky-600 hover:text-white cursor-pointer"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="mr-2 size-4" />
              Add User
            </Button>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>

          {/* Tabs */}
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value);
              setCurrentPage(1);
            }}
          >
            <TabsList>
              <TabsTrigger value="all" className="cursor-pointer">
                All Users
              </TabsTrigger>
              <TabsTrigger value="online" className="cursor-pointer">
                Online
                <Badge className="bg-green-500 hover:bg-green-600 text-white ml-1.5 px-1.5 py-0.5 text-xs">
                  {
                    users.filter(
                      (u) =>
                        u.status === "Online" &&
                        u.role.toLowerCase() !== "user",
                    ).length
                  }
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="offline" className="cursor-pointer">
                Offline
                <Badge className="bg-red-500 hover:bg-red-600 text-white ml-1.5 px-1.5 py-0.5 text-xs">
                  {
                    users.filter(
                      (u) =>
                        u.status === "Offline" &&
                        u.role.toLowerCase() !== "user",
                    ).length
                  }
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
                  <TableHead>Profile</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Updated At</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="size-8" />
                        <p>Not found</p>
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
                    {/* ID */}
                    <TableCell className="text-sm text-center text-foreground">
                      {user.userId}
                    </TableCell>
                    {/* Avatar */}
                    <TableCell>
                      <Avatar className="size-8">
                        <AvatarImage src={user.profileImage} alt={user.name} />
                        <AvatarFallback className="text-xs">
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    {/* Name + Email */}
                    <TableCell>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </TableCell>
                    {/* Username */}
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {user.username}
                      </div>
                    </TableCell>
                    {/* Phone */}
                    <TableCell>
                      <div className="grid grid-rows-2 grid-flow-col gap-x-4 gap-y-1 text-sm">
                        {user.networks
                          .filter((n) => n !== "")
                          .map((network, index) => (
                            <span key={index}>+{network}</span>
                          ))}
                      </div>
                    </TableCell>
                    {/* Role */}
                    <TableCell>
                      <span className="rounded-lg bg-sky-200 text-sm text-muted-foreground px-2 py-1">
                        {user.role}
                      </span>
                    </TableCell>
                    {/* Status */}
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    {/* Created */}
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    {/* Updated */}
                    <TableCell className="text-muted-foreground text-sm">
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
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full cursor-pointer"
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center">
                          <DropdownMenuItem
                            className="text-blue-500 cursor-pointer"
                            onClick={() => setViewUser(user)}
                          >
                            <Eye className="mr-2 size-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-yellow-500 cursor-pointer"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsDeleteDialogOpen(true);
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
                  Page {currentPage} of {totalPages || 1}
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
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronsRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── View User Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>View user information</DialogDescription>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage
                    src={viewUser.profileImage}
                    alt={viewUser.name}
                  />
                  <AvatarFallback className="text-lg">
                    {viewUser.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{viewUser.name}</h3>
                  <div className="text-sm text-muted-foreground">
                    {viewUser.username}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {viewUser.email}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">User ID</p>
                  <p className="font-mono text-sm">{viewUser.userId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <div className="mt-1">{viewUser.role}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(viewUser.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone(s)</p>
                  <div className="text-sm mt-1">
                    {viewUser.networks.filter(Boolean).join(", ") || "—"}
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-20">
                  <div>
                    <p className="text-sm text-muted-foreground">Created At:</p>
                    <p>
                      {new Date(viewUser.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground">Updated At:</p>
                    <p>
                      {new Date(viewUser.updatedAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add User Dialog ───────────────────────────────────────────────── */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sky-500">Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account for team management.
            </DialogDescription>
          </DialogHeader>
          <AddUserForm
            onSuccess={handleAddSuccess}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sky-500">Edit User</DialogTitle>
            <DialogDescription>Update user information.</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <EditUserForm
              key={selectedUser.userId}
              user={selectedUser}
              onSuccess={handleEditSuccess}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setSelectedUser(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete User Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent>
          {selectedUser && (
            <DeleteUserForm
              user={selectedUser}
              onSuccess={handleDeleteSuccess}
              onCancel={() => {
                setIsDeleteDialogOpen(false);
                setSelectedUser(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
