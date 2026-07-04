export type SupportedLocale = 'en' | 'km' | 'zh';

export function resolveLocale(header?: string): SupportedLocale {
  if (!header) return 'en';
  const first = header.split(',')[0]?.split(';')[0]?.trim().toLowerCase() ?? '';
  const primary = first.split('-')[0];
  if (primary === 'km') return 'km';
  if (primary === 'zh') return 'zh';
  return 'en';
}
