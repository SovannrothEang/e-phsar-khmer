import { MONTH_LABELS } from "@/lib/locale-labels";

/** The template's date format — "12, Aug 2026". */
export function formatNotificationDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Phnom_Penh",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const month =
    (MONTH_LABELS[locale] ?? MONTH_LABELS.en)[Number(part("month")) - 1] ?? "";
  return `${part("day")}, ${month} ${part("year")}`;
}
