"use client";

import { useTranslations } from "next-intl";

/**
 * Renders a listing condition. Real listings carry the raw backend enum
 * (`new` / `used`), which is translated here; mock/legacy values such as
 * `Rent` or `Used` pass through unchanged.
 */
export function ConditionLabel({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  const t = useTranslations("Common");
  const raw = value?.trim() ?? "";
  if (!raw) return null;

  const key = raw.toLowerCase();
  const label = key === "new" || key === "used" ? t(`condition.${key}`) : raw;

  return <span className={className}>{label}</span>;
}
