"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/routing";
import SettingSidebar from "./SettingSidebar";
import { changeUsername } from "@/actions/settings";
import type { SettingsUser } from "@/lib/auth/current-user";

/** Same charset the API accepts — letters, digits, dot, underscore, dash. */
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,50}$/;

export default function ChangeUsername({ me }: { me?: SettingsUser | null }) {
  const router = useRouter();
  const [username, setUsername] = useState(me?.username ?? "");
  const [saving, setSaving] = useState(false);

  const trimmed = username.trim();
  const isValid = USERNAME_RE.test(trimmed);
  const isChanged = trimmed !== (me?.username ?? "");
  const canSubmit = isValid && isChanged && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);

    const result = await changeUsername(trimmed);
    setSaving(false);

    if (!result.success) {
      toast.error(result.error ?? "Could not change the username");
      return;
    }

    toast.success("Username updated");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-muted pb-10 pt-4">
      <div className="max-w-6xl mx-auto  ">
        <div className="flex gap-5 ">
          <SettingSidebar me={me} />
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
                <Input
                  id="username"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={50}
                  required
                />
                <FieldDescription className="text-sm">
                  3–50 characters: letters, numbers, dot, underscore or dash.
                  {isValid && !isChanged && " This is your current username."}
                </FieldDescription>
              </Field>
              <div className="mx-auto w-full max-w-md mt-6 pb-10">
                <Button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!canSubmit}
                  className="w-full bg-orange-500  py-4 hover:bg-orange-600 text-card rounded-sm cursor-pointer"
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
