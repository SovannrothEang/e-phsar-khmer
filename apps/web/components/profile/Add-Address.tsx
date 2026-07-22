
"use client"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Field,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
    FieldSet,
    FieldGroup,
    FieldContent
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import SettingSidebar from "../setting/SettingSidebar"
import { useState } from "react"
export default function AddAddress() {
    const [open, setOpen] = React.useState(false)
    const [date, setDate] = React.useState<Date | undefined>(undefined)
    const [autoUpdate, setAutoUpdate] = useState(false);
    return (
        <div className="min-h-screen bg-muted pb-10 pt-4">
            <div className="max-w-6xl mx-auto  ">
                <div className="flex gap-5 ">
                    <SettingSidebar />
                    <main className="flex-1">
                        <div className="bg-card border border-border rounded-sm">
                            <h1 className="text-2xl font-medium text-foreground mb-4 mt-4 px-4">Add Address</h1>
                            <div className="mt-2 px-4 space-y-4">
                                <Field>
                                    <FieldLabel htmlFor="input-required">
                                        Name <span className="text-destructive">*</span>
                                    </FieldLabel>
                                    <Input
                                        id="input-required"
                                        placeholder="First Name"
                                        required
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="input-required">
                                        Company
                                    </FieldLabel>
                                    <Input
                                        id="input-required"
                                        placeholder="Company"
                                        required
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="input-required">
                                        Email
                                    </FieldLabel>
                                    <Input
                                        id="input-required"
                                        placeholder="[EMAIL_ADDRESS]"
                                        required
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="input-required">
                                        Phone Number <span className="text-destructive">*</span>
                                    </FieldLabel>
                                    <Input
                                        id="input-required"
                                        placeholder="+855 12 345 678"
                                        required
                                    />
                                </Field>
                                <Field className="w-full">
                                    <FieldLabel>Location</FieldLabel>
                                    <Select>
                                        <SelectTrigger >
                                            <SelectValue placeholder="Choose Location" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value="engineering">Engineering</SelectItem>
                                                <SelectItem value="design">Design</SelectItem>
                                                <SelectItem value="marketing">Marketing</SelectItem>
                                                <SelectItem value="sales">Sales</SelectItem>
                                                <SelectItem value="support">Customer Support</SelectItem>
                                                <SelectItem value="hr">Human Resources</SelectItem>
                                                <SelectItem value="finance">Finance</SelectItem>
                                                <SelectItem value="operations">Operations</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <FieldSet className="w-full">
                                    <FieldGroup>
                                        <Field>
                                            <FieldLabel htmlFor="address">Address</FieldLabel>
                                            <Textarea
                                                id="address"
                                                placeholder="Enter your address..."
                                                rows={4}
                                            />

                                        </Field>
                                    </FieldGroup>
                                </FieldSet>
                                <Field className="w-full">
                                    <FieldLabel>Select Location</FieldLabel>
                                    <Select>
                                        <SelectTrigger >
                                            <SelectValue placeholder="Select Location" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value="engineering">Engineering</SelectItem>
                                                <SelectItem value="design">Design</SelectItem>
                                                <SelectItem value="marketing">Marketing</SelectItem>
                                                <SelectItem value="sales">Sales</SelectItem>
                                                <SelectItem value="support">Customer Support</SelectItem>
                                                <SelectItem value="hr">Human Resources</SelectItem>
                                                <SelectItem value="finance">Finance</SelectItem>
                                                <SelectItem value="operations">Operations</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="input-required">
                                        Tax ID
                                    </FieldLabel>
                                    <Input
                                        id="input-required"
                                        placeholder="Tax ID"
                                        required
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="input-required">
                                        Gender
                                    </FieldLabel>
                                    <div className="flex gap-2">
                                        <button className="flex-1 border border-sky-400 bg-sky-100 text-sky-600 py-1.5 rounded-sm">
                                            Home
                                        </button>
                                        <button className="flex-1 border border-border py-1.5 rounded-sm">
                                            Work
                                        </button>
                                        <button className="flex-1 border border-border py-1.5 rounded-sm">
                                            Other
                                        </button>
                                    </div>
                                </Field>
                                <Field
                                    orientation="horizontal"
                                    onClick={() => {
                                        toast.promise<{ name: string }>(
                                            () => new Promise((resolve) => setTimeout(() => resolve({ name: "Your store" }), 2000)),
                                            {
                                                loading: "Loading...",
                                                success: (data) => `${data.name} setting has been saved successfully`,
                                                position: "top-right",
                                                error: "Error",
                                            }
                                        );
                                        setAutoUpdate(!autoUpdate);
                                    }}
                                    className="flex items-center justify-between p-3 bg-card border border-muted-foreground/20 rounded-sm cursor-pointer"
                                >
                                    <FieldLabel className="px-1 text-muted-foreground text-sm cursor-pointer">
                                       Set as Default
                                    </FieldLabel>

                                    <Switch
                                        checked={autoUpdate}
                                        onCheckedChange={setAutoUpdate}
                                        className="data-[state=checked]:bg-[#00a0e9] data-[state=unchecked]:bg-input scale-120 mr-2"
                                    />
                                </Field>
                                <div className="flex gap-2">
                                    <Button 
                                    className="bg-muted-foreground/40 text-card rounded-sm w-1/2 h-10 mb-4">
                                        Cancel
                                    </Button>
                                    <Button className="bg-orange-500 text-card rounded-sm w-1/2 h-10 mb-4">
                                        Submit
                                    </Button>
                                </div>
                            </div>
                        </div>

                    </main>
                </div>
            </div>
        </div>
    )
}