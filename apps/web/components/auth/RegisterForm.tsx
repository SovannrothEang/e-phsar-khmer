"use client";

import { useEffect, useRef } from "react";
import { register } from "@/actions/register";
import {
  clearRegisterDraft,
  readRegisterDraft,
  storeOtpRegistration,
  storeRegisterDraft,
} from "@/lib/otp-registration";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import { registerSchema } from "@/schemas/register";
import { toast } from "sonner";
import { z } from "zod";
import { useAppForm } from "@/components/form/hooks";
import { FaTelegramPlane } from "react-icons/fa";

type FormData = z.infer<typeof registerSchema>;

/**
 * #32: how long typing must settle before the draft snapshot is written. Long
 * enough not to hit sessionStorage on every keystroke, short enough that a
 * reload right after typing still restores it.
 */
const DRAFT_SAVE_DEBOUNCE_MS = 400;

export function RegisterForm() {
  const router = useRouter();
  // Set once the handoff is stored: a debounced save still in flight must not
  // resurrect the draft we just cleared.
  const handedOffRef = useRef(false);

  const form = useAppForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    } satisfies FormData as FormData,
    validators: {
      onSubmit: registerSchema,
      onChange: registerSchema,
    },
    listeners: {
      onChangeDebounceMs: DRAFT_SAVE_DEBOUNCE_MS,
      // Keep a snapshot while the user types so a reload or a back-navigation
      // does not lose the form. `confirmPassword` is left out on purpose.
      onChange: ({ formApi }) => {
        if (handedOffRef.current) return;
        const values = formApi.state.values;
        storeRegisterDraft({
          firstName: values.firstName,
          lastName: values.lastName,
          phoneNumber: values.phoneNumber,
          password: values.password,
        });
      },
    },
    onSubmit: async ({ value }) => {
      const res = await register(value);

      if (res.success) {
        handedOffRef.current = true;
        // The password/names reach the verify call via sessionStorage —
        // never through the URL. The draft has served its purpose now.
        storeOtpRegistration({
          mode: "register",
          phone: res.phone,
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          password: value.password,
          retryAfterSeconds: res.retryAfterSeconds,
        });
        clearRegisterDraft();
        form.reset();
        toast.success("Code sent to your phone.");
        router.push({ pathname: "/otp", query: { phone: res.phone } });
      } else {
        toast.error(res.error ?? "Failed to send code.");
      }
    },
  });

  // Restore after mount, not during render: sessionStorage does not exist on
  // the server, so reading it in the initial state would break hydration.
  // Fields are filled one by one and only when still empty, so a restore
  // never overwrites typing that happened between mount and this effect.
  useEffect(() => {
    const draft = readRegisterDraft();
    if (!draft) return;
    const restore = {
      dontRunListeners: true,
      dontValidate: true,
    } as const;
    if (!form.getFieldValue("firstName") && draft.firstName) {
      form.setFieldValue("firstName", draft.firstName, restore);
    }
    if (!form.getFieldValue("lastName") && draft.lastName) {
      form.setFieldValue("lastName", draft.lastName, restore);
    }
    if (!form.getFieldValue("phoneNumber") && draft.phoneNumber) {
      form.setFieldValue("phoneNumber", draft.phoneNumber, restore);
    }
    if (!form.getFieldValue("password") && draft.password) {
      form.setFieldValue("password", draft.password, restore);
    }
  }, [form]);

  return (
    <div className="container px-4 mx-auto my-6 pb-30">
      <div className="w-full max-w-[580px] mx-auto bg-card rounded-sm shadow-sm border border-border p-8">
        <div className="mb-6">
          <h1 className="type-page-title text-center mb-4 text-foreground">
            Register to post free ad
          </h1>
          <FieldSeparator />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.AppField name="firstName">
              {(field) => <field.Input label="First Name" required={true} />}
            </form.AppField>

            <form.AppField name="lastName">
              {(field) => <field.Input label="Last Name" required={true} />}
            </form.AppField>

            <form.AppField name="phoneNumber">
              {(field) => <field.Input label="Phone Number" type="tel" />}
            </form.AppField>

            <form.AppField name="password">
              {(field) => <field.Input label="Password" type="password" />}
            </form.AppField>

            <form.AppField name="confirmPassword">
              {(field) => (
                <field.Input label="Confirm Password" type="password" />
              )}
            </form.AppField>
            <Button
              type="submit"
              className="h-10 w-full rounded-sm bg-orange-500 text-white hover:bg-orange-600 hover:text-white cursor-pointer"
            >
              Submit
            </Button>

            <FieldSeparator>Or</FieldSeparator>
            <Button
              type="button"
              className="h-10 w-full rounded-sm bg-sky-600 text-white hover:bg-sky-600 hover:text-white cursor-pointer flex items-center gap-2"
            >
              <FaTelegramPlane className="text-white text-2xl" />
              Sign in or register with Telegram
            </Button>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}
