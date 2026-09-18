"use client";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import SettingSidebar from "./SettingSidebar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { EyeOffIcon, EyeIcon } from "lucide-react";
import { useState } from "react";
export default function EditProfile() {
  // ===== STATE =====
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [touchedPassword, setTouchedPassword] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);

  // ===== VALIDATION =====
  const isPasswordInvalid = touchedPassword && password.length < 8;

  const isConfirmInvalid = touchedConfirm && confirmPassword !== password;

  return (
    <div className="min-h-screen bg-muted pb-10 pt-4">
      <div className="max-w-6xl mx-auto  ">
        <div className="flex gap-5 ">
          <SettingSidebar />
          <main className="flex-1">
            <div className="bg-card border border-border rounded-sm ">
              <h1 className="text-2xl font-medium text-foreground  mb-4 mt-12 text-center ">
                Change Password
              </h1>
              <p className="text-center mb-6">
                You&apos;ll use this password to access your account.
              </p>

              <Field className="w-full max-w-md mx-auto">
                <FieldLabel className="text-sm  text-foreground tracking-tight">
                  New password <span className="text-destructive">*</span>
                </FieldLabel>

                <InputGroup>
                  <InputGroupInput
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setTouchedPassword(true);
                    }}
                    className={`w-full rounded-md transition-all h-10
                                             ${isPasswordInvalid ? "border-destructive ring-1 ring-destructive/20" : ""}
                                        `}
                  />
                  <InputGroupAddon
                    align="inline-end"
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeIcon size={18} />
                    ) : (
                      <EyeOffIcon size={18} />
                    )}
                  </InputGroupAddon>
                </InputGroup>
                {isPasswordInvalid && (
                  <FieldDescription className="text-destructive text-sm">
                    The new password must be at least 8 characters long.
                  </FieldDescription>
                )}
              </Field>
              <Field className="w-full max-w-md mx-auto mt-6">
                <FieldLabel className="text-sm text-foreground tracking-tight">
                  Confirm new password{" "}
                  <span className="text-destructive">*</span>
                </FieldLabel>

                <InputGroup>
                  <InputGroupInput
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setTouchedConfirm(true);
                    }}
                    className={`h-full w-auto rounded-lg border-muted-foreground/30 transition-all ${
                      isConfirmInvalid
                        ? "border-destructive ring-1 ring-destructive/20"
                        : ""
                    }`}
                  />
                  <InputGroupAddon
                    align="inline-end"
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeIcon size={18} />
                    ) : (
                      <EyeOffIcon size={18} />
                    )}
                  </InputGroupAddon>
                </InputGroup>

                {isConfirmInvalid && (
                  <FieldDescription className="text-destructive text-sm">
                    Please enter the same password.
                  </FieldDescription>
                )}
              </Field>
              <div className="mx-auto w-full max-w-md mt-6 pb-10">
                <Button className="w-full bg-orange-500  py-4 hover:bg-orange-600 text-card rounded-sm">
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
