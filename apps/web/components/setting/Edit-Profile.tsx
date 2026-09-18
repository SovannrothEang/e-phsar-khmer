"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldSet, FieldGroup, FieldContent } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import SettingSidebar from "./SettingSidebar";
export default function EditProfile() {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(undefined);
  return (
    <div className="min-h-screen bg-muted pb-30 pt-4">
      <div className="max-w-6xl mx-auto  ">
        <div className="flex gap-5 ">
          <SettingSidebar />
          <main className="flex-1">
            <div className="bg-card border border-border rounded-sm">
              <h1 className="text-2xl font-medium text-foreground mb-4 mt-4 px-4">
                Edit Profile
              </h1>
              <div className="mt-2 px-4 space-y-4">
                <Field>
                  <FieldLabel htmlFor="input-required">
                    First Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="input-required"
                    placeholder="First Name"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="input-required">
                    Last Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input id="input-required" placeholder="Last Name" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="input-required">Gender</FieldLabel>
                  <div className="flex gap-2">
                    <button className="flex-1 border border-sky-400 bg-sky-100 text-sky-600 py-1.5 rounded-sm">
                      Male
                    </button>
                    <button className="flex-1 border border-border py-1.5 rounded-sm">
                      Female
                    </button>
                  </div>
                </Field>
                <Field className="mx-auto ">
                  <FieldLabel htmlFor="date">Date of birth</FieldLabel>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        id="date"
                        className="justify-start font-normal h-10"
                      >
                        {date
                          ? date.toLocaleDateString()
                          : "Select Date of Birth"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto overflow-hidden p-0"
                      align="center"
                    >
                      <Calendar
                        mode="single"
                        selected={date}
                        defaultMonth={date}
                        captionLayout="dropdown"
                        onSelect={(date) => {
                          setDate(date);
                          setOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </Field>
                <Field>
                  <FieldLabel htmlFor="input-required">Email</FieldLabel>
                  <Input
                    id="input-required"
                    placeholder="[EMAIL_ADDRESS]"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="input-required">Company</FieldLabel>
                  <Input
                    id="input-required"
                    placeholder="Company Name"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="input-required">
                    Phone Number <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="input-required"
                    placeholder="+855........."
                    required
                  />
                </Field>
                <Field className="w-full">
                  <FieldLabel>Location</FieldLabel>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="engineering">Engineering</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="support">
                          Customer Support
                        </SelectItem>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="engineering">Engineering</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="support">
                          Customer Support
                        </SelectItem>
                        <SelectItem value="hr">Human Resources</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="operations">Operations</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    id="terms-checkbox-2"
                    name="terms-checkbox-2"
                    defaultChecked
                  />
                  <FieldContent>
                    <FieldLabel htmlFor="terms-checkbox-2">
                      Update this contact to your ads
                    </FieldLabel>
                  </FieldContent>
                </Field>
                <Button className="bg-orange-500 text-card rounded-sm w-full h-8 mb-4">
                  Submit
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
