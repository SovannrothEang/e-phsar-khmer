"use client";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import SettingSidebar from "./SettingSidebar";
export default function EditProfile() {
  return (
    <div className="min-h-screen bg-muted pb-10 pt-4">
      <div className="max-w-6xl mx-auto  ">
        <div className="flex gap-5 ">
          <SettingSidebar />
          <main className="flex-1">
            <div className="bg-card border border-border rounded-sm ">
              <h1 className="text-2xl font-medium text-foreground  mb-4 mt-12 text-center ">
                Edit Username
              </h1>
              <p className="text-center mb-6">
                You&apos;ll use this username to access your account.
              </p>

              <Field className="w-full max-w-md mx-auto mt-6">
                <FieldLabel className="text-sm text-foreground tracking-tight">
                  Username <span className="text-destructive">*</span>
                </FieldLabel>
                <Input id="input-required" placeholder="Username" required />
              </Field>
              <div className="mx-auto w-full max-w-md mt-6 pb-10">
                <Button
                  disabled
                  className="w-full bg-orange-500  py-4 hover:bg-orange-600 text-card rounded-sm"
                >
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
