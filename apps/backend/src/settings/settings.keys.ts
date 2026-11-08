import { z } from 'zod';

/**
 * The allowlist of runtime settings.
 *
 * Adding a knob means adding an entry here — the admin PATCH validates
 * against this map, so no request can create an unknown key. Keep each
 * schema strict: a value read back from `app_settings` is untrusted input
 * written by an older deploy, not a TypeScript literal.
 */
export const SETTING_DEFINITIONS = {
  'reports.account_suspension_threshold': {
    schema: z.coerce.number().int().min(1).max(100),
    default: 3,
  },
  'support.contact_email': {
    schema: z.string().trim().email().max(255),
    default: '',
  },
  'support.contact_telegram': {
    schema: z.string().trim().max(120),
    default: '',
  },
  'support.contact_phone': {
    schema: z.string().trim().max(32),
    default: '',
  },
} as const;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;

export const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  // `Object.keys(...).includes` rather than `Object.hasOwn` or `in`: four keys
  // make the scan free, and `in` would accept prototype names like `toString`.
  return SETTING_KEYS.includes(key as SettingKey);
}

/** The value a reader gets when the row is absent, unparsable, or cleared. */
export function defaultFor(key: SettingKey): string | number {
  // Each definition's `default` matches its own schema's output; the zod
  // parsers widen that to `any`, so this cast is the one place that restores
  // the read path's `string | number` contract.
  return SETTING_DEFINITIONS[key].default as string | number;
}
