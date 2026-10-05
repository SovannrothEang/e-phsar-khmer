"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldSet,
  FieldGroup,
  FieldContent,
} from "@/components/ui/field";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import SettingSidebar from "./SettingSidebar";
import LocationPicker, {
  type PlaceSelection,
} from "@/components/post/LocationPicker";
import { updateMyProfile } from "@/actions/settings";
import { formatPhoneLocal } from "@/lib/phone";
import type { BackendPlace } from "@/lib/api/categories";
import type { SettingsUser } from "@/lib/auth/current-user";

const CURRENT_YEAR = new Date().getFullYear();
/** Newest first — the common case is near the top. */
const BIRTH_YEARS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) =>
  String(CURRENT_YEAR - i),
);

export default function EditProfile({
  me,
  provinces,
  savedPlace,
}: {
  me: SettingsUser;
  provinces: BackendPlace[];
  savedPlace: PlaceSelection;
}) {
  const router = useRouter();

  const [firstName, setFirstName] = React.useState(me.firstName ?? "");
  const [lastName, setLastName] = React.useState(me.lastName ?? "");
  const [gender, setGender] = React.useState<"male" | "female" | null>(
    me.gender,
  );
  const [yearOfBirth, setYearOfBirth] = React.useState(
    me.yearOfBirth === null ? "" : String(me.yearOfBirth),
  );
  const [email, setEmail] = React.useState(me.email ?? "");
  const [company, setCompany] = React.useState(me.company ?? "");
  const [place, setPlace] = React.useState<PlaceSelection>(savedPlace);
  const [address, setAddress] = React.useState(me.address ?? "");
  const [saving, setSaving] = React.useState(false);

  const canSubmit = firstName.trim().length > 0 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);

    const result = await updateMyProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender,
      // An empty picker clears the year rather than leaving the old one.
      yearOfBirth: yearOfBirth ? Number(yearOfBirth) : null,
      email: email.trim() || null,
      company: company.trim() || null,
      // The cascade is always sent in full, so clearing it clears the account.
      provinceId: place.province?.id ?? null,
      districtId: place.district?.id ?? null,
      communeId: place.commune?.id ?? null,
      address: address.trim() || null,
    });

    if (!result.success) {
      toast.error(result.error ?? "Could not save your profile");
      setSaving(false);
      return;
    }

    toast.success("Profile updated");
    setSaving(false);
    // Re-renders the rail, the hub and the navbar chip from the new row.
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-muted pb-30 pt-4">
      <div className="max-w-6xl mx-auto  ">
        <div className="flex gap-5 ">
          <SettingSidebar me={me} />
          <main className="flex-1">
            <div className="bg-card border border-border rounded-sm">
              <h1 className="text-2xl font-medium text-foreground mb-4 mt-4 px-4">
                Edit Profile
              </h1>
              <div className="mt-2 px-4 space-y-4">
                <Field>
                  <FieldLabel htmlFor="first-name">
                    First Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="first-name"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={100}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="last-name">
                    Last Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="last-name"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={100}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Gender</FieldLabel>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setGender("male")}
                      className={`flex-1 border py-1.5 rounded-sm cursor-pointer ${
                        gender === "male"
                          ? "border-sky-400 bg-sky-100 text-sky-600"
                          : "border-border"
                      }`}
                    >
                      Male
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender("female")}
                      className={`flex-1 border py-1.5 rounded-sm cursor-pointer ${
                        gender === "female"
                          ? "border-sky-400 bg-sky-100 text-sky-600"
                          : "border-border"
                      }`}
                    >
                      Female
                    </button>
                  </div>
                </Field>
                <Field className="mx-auto ">
                  {/* The account stores a birth YEAR, not a date — a calendar
                      that dropped the day and month would be lying. */}
                  <FieldLabel htmlFor="year-of-birth">Year of birth</FieldLabel>
                  <Select value={yearOfBirth} onValueChange={setYearOfBirth}>
                    <SelectTrigger id="year-of-birth" className="w-full h-10">
                      <SelectValue placeholder="Select Year of Birth" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[296px]">
                      <SelectGroup>
                        {BIRTH_YEARS.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="company">Company</FieldLabel>
                  <Input
                    id="company"
                    placeholder="Company Name"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    maxLength={150}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone-number">
                    Phone Number <span className="text-destructive">*</span>
                  </FieldLabel>
                  {/* Read-only: a phone only changes through the code sent to
                      it, which is what the Activate Phone page does. */}
                  <Input
                    id="phone-number"
                    value={
                      me.primaryPhone ? formatPhoneLocal(me.primaryPhone) : ""
                    }
                    placeholder="Not set"
                    disabled
                  />
                  <Link
                    href={{ pathname: "/settings/change-phone" }}
                    className="text-sm text-[#00a0e9] hover:underline"
                  >
                    Change your active phone number
                  </Link>
                </Field>
                <Field className="w-full">
                  <FieldLabel>Location</FieldLabel>
                  <LocationPicker
                    provinces={provinces}
                    value={place}
                    onChange={setPlace}
                  />
                </Field>
                <FieldSet className="w-full">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="address">Address</FieldLabel>
                      <Textarea
                        id="address"
                        placeholder="Enter your address..."
                        rows={4}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>
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
                <Button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!canSubmit}
                  className="bg-orange-500 text-card rounded-sm w-full h-8 mb-4 cursor-pointer"
                >
                  {saving ? "Saving…" : "Submit"}
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
