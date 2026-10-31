/**
 * Explicit en/km labels. The web ships only these two locales, and Khmer ICU
 * data is not guaranteed in every runtime (some Chromium builds fall back to
 * English), so month/weekday names used by client components live here.
 */
export const MONTH_LABELS: Record<string, readonly string[]> = {
  en: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  km: [
    "មករា",
    "កុម្ភៈ",
    "មីនា",
    "មេសា",
    "ឧសភា",
    "មិថុនា",
    "កក្កដា",
    "សីហា",
    "កញ្ញា",
    "តុលា",
    "វិច្ឆិកា",
    "ធ្នូ",
  ],
};

/** Monday-first, matching the date picker's `weekStartsOn: 1`. */
export const WEEKDAY_LABELS: Record<string, readonly string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  km: ["ចន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍", "អាទិត្យ"],
};
