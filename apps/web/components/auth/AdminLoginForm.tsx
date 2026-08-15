"use client";

import { loginSchema } from "@/schemas/login";
import { useAppForm } from "@/components/form/hooks";
import { adminLogin } from "@/actions/admin-login";
import { toast } from "@/components/ui/sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FieldDescription,
  FieldGroup,
  FieldSeparator,
} from "@/components/ui/field";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook, FaApple, FaTelegramPlane } from "react-icons/fa";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

type FormData = z.infer<typeof loginSchema>;

/**
 * Admin login form for the /wanderer/login page. Mirrors the public LoginForm
 * visual treatment (Card, fields, social buttons, forgot-password) but is
 * single-column full-width (no right-side image), drops the sign-up CTA, and
 * is gated to admin + super_admin roles via the `adminLogin` server action.
 * Navigates to /wanderer/dashboard on success.
 */
export function AdminLoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const locale = useLocale();

  const form = useAppForm({
    defaultValues: {
      login: "",
      password: "",
    } satisfies FormData as FormData,
    validators: {
      onSubmit: loginSchema,
      onChange: loginSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await adminLogin(value);

      if (result.success) {
        form.reset();
        toast.success("Login successfully!", { position: "top-right" });
        router.push("/wanderer/dashboard");
      } else {
        toast.error(result.error || "Login failed.");
      }
    },
  });

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 bg-card rounded-sm">
        <CardContent className="p-0">
          <form
            className="p-6 md:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-xl font-medium">
                  Login to manage ads or post free ad
                </h1>
              </div>

              <form.AppField name="login">
                {(field) => (
                  <field.Input
                    label="Phone Number, Username or Email"
                    required={true}
                  />
                )}
              </form.AppField>

              <form.AppField name="password">
                {(field) => (
                  <field.Input
                    label="Password"
                    type="password"
                    required={true}
                  />
                )}
              </form.AppField>

              <Link
                href={`/${locale}/forgot-password`}
                className="inline-block text-right text-sm underline-offset-2 hover:underline"
              >
                Forgot Password / Account
              </Link>

              <Button
                type="submit"
                className="h-10 w-full rounded-sm bg-orange-500 hover:bg-orange-600 text-white cursor-pointer"
              >
                Login
              </Button>

              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>

              <Button
                type="button"
                className="h-10 w-full rounded-sm bg-sky-500 hover:bg-sky-600 text-white cursor-pointer"
              >
                <div className="flex items-center justify-center rounded-full bg-sky-400 w-6 h-6">
                  <FaTelegramPlane className="text-white" />
                </div>
                Sign In or register with Telegram
              </Button>

              <div className="grid grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  type="button"
                  className="h-10 !w-full rounded-lg cursor-pointer"
                >
                  <FaFacebook className="text-blue-500 scale-150" />
                  <span className="sr-only">Login with Meta</span>
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  className="h-10 !w-full rounded-lg cursor-pointer"
                >
                  <FcGoogle className="h-5 w-5 scale-150" />
                  <span className="sr-only">Login with Google</span>
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  className="h-10 !w-full rounded-lg cursor-pointer"
                >
                  <FaApple className="h-5 w-5 scale-150" />
                  <span className="sr-only">Login with Apple</span>
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
