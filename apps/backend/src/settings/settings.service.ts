import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient, DbExecutor } from '../db/drizzle.provider';
import { appSettings } from '../db/schema/app-settings.schema';
import {
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  defaultFor,
  isSettingKey,
} from './settings.keys';
import type { SettingKey } from './settings.keys';

/** The contact channels a moderation notice offers, all optional. */
export interface SupportContacts {
  email?: string;
  telegram?: string;
  phone?: string;
}

export interface AdminSettingView {
  key: SettingKey;
  value: string | number;
  /** True when the stored row is absent or unreadable and the default won. */
  isDefault: boolean;
  updatedAt: Date | null;
  updatedById: string | null;
}

/**
 * Reads and writes `app_settings`.
 *
 * **Reads never throw.** A settings row must never be the reason a login
 * refusal or an approval fails, so a missing row, an unknown key or a value
 * that no longer parses all fall back to the code default and log. Only the
 * admin write path validates, because that is the boundary.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  /**
   * One key, one indexed primary-key read. There is deliberately no cache:
   * the table is tiny, and an in-process copy would reintroduce the
   * cross-instance staleness the background-work plan already had to fix
   * for the sweeps.
   */
  async get<T extends string | number>(
    key: SettingKey,
    executor: DbExecutor = this.db,
  ): Promise<T> {
    const [row] = await executor
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    return this.parse(key, row?.value) as T;
  }

  async reportAlertThreshold(executor: DbExecutor = this.db): Promise<number> {
    return this.get<number>('reports.alert_threshold', executor);
  }

  async postReportAlertThreshold(
    executor: DbExecutor = this.db,
  ): Promise<number> {
    return this.get<number>('reports.post_alert_threshold', executor);
  }

  /** Only the channels that are actually configured; empty strings are dropped. */
  async supportContacts(
    executor: DbExecutor = this.db,
  ): Promise<SupportContacts> {
    const [email, telegram, phone] = await Promise.all([
      this.get<string>('support.contact_email', executor),
      this.get<string>('support.contact_telegram', executor),
      this.get<string>('support.contact_phone', executor),
    ]);
    return {
      ...(email ? { email } : {}),
      ...(telegram ? { telegram } : {}),
      ...(phone ? { phone } : {}),
    };
  }

  /** Admin read: every allowlisted key, defaults merged in. */
  async list(): Promise<AdminSettingView[]> {
    const rows = await this.db
      .select()
      .from(appSettings)
      .where(inArray(appSettings.key, SETTING_KEYS as string[]));
    const byKey = new Map(rows.map((row) => [row.key, row]));

    return SETTING_KEYS.map((key) => {
      const row = byKey.get(key);
      const parsed = row ? this.parseOrNull(key, row.value) : null;
      return {
        key,
        value: parsed ?? defaultFor(key),
        isDefault: parsed === null,
        updatedAt: row?.updatedAt ?? null,
        updatedById: row?.updatedById ?? null,
      };
    });
  }

  /**
   * Admin write. Validates at the boundary with the key's own schema, so an
   * unknown key and a bad value are both 400 rather than a stored surprise.
   */
  async set(
    key: string,
    rawValue: unknown,
    updatedById: string,
  ): Promise<AdminSettingView> {
    if (!isSettingKey(key)) {
      throw new BadRequestException('UNKNOWN_SETTING_KEY');
    }
    const { schema } = SETTING_DEFINITIONS[key];
    const parsed = schema.safeParse(rawValue);
    if (!parsed.success) {
      throw new BadRequestException('INVALID_SETTING_VALUE');
    }

    const value = parsed.data;
    const [row] = await this.db
      .insert(appSettings)
      .values({ key, value, updatedById })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedById, updatedAt: new Date() },
      })
      .returning();

    return {
      key: key,
      value: row.value as string | number,
      isDefault: false,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
    };
  }

  /** Read path: never throws, always yields a usable value. */
  private parse(key: SettingKey, raw: unknown): string | number {
    const parsed = this.parseOrNull(key, raw);
    if (parsed === null) {
      if (raw !== undefined) {
        this.logger.warn(
          `Setting ${key} holds an unreadable value; using the default`,
        );
      }
      return defaultFor(key);
    }
    return parsed;
  }

  private parseOrNull(key: SettingKey, raw: unknown): string | number | null {
    if (raw === undefined || raw === null) return null;
    const parsed = SETTING_DEFINITIONS[key].schema.safeParse(raw);
    if (!parsed.success) return null;
    // An explicitly cleared contact channel ("") is a real stored value, not a
    // default, but it reads the same as unset — which is the point.
    return parsed.data;
  }
}
