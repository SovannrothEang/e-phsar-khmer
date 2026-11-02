import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type AnySupabaseClient = SupabaseClient;

export interface OtpCallOptions {
  /**
   * Honour the DEV_OTP_TOKEN bypass. Defaults to `true` for the register /
   * OTP-login flows, which rely on it in development. The password-reset flow
   * passes `false` so it always talks to the real provider — that is what
   * makes it production-ready regardless of the environment.
   */
  devBypass?: boolean;
}

@Injectable()
export class SupabaseService {
  private readonly adminClient: AnySupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('supabase.url')!;
    const serviceRoleKey = this.configService.get<string>(
      'supabase.serviceRoleKey',
    )!;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.adminClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  getAdminClient(): AnySupabaseClient {
    return this.adminClient;
  }

  createClientForToken(accessToken: string): AnySupabaseClient {
    const url = this.configService.get<string>('supabase.url')!;
    const anonKey = this.configService.get<string>('supabase.anonKey')!;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const client: AnySupabaseClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    return client;
  }

  async signUp(email: string, password: string) {
    return this.adminClient.auth.signUp({ email, password });
  }

  async signInWithPassword(email: string, password: string) {
    return this.adminClient.auth.signInWithPassword({ email, password });
  }

  async signInWithOtp(phone: string, options: OtpCallOptions = {}) {
    const devToken =
      options.devBypass === false
        ? undefined
        : this.configService.get<string>('devOtpToken');
    if (devToken) return { data: {}, error: null };
    return this.adminClient.auth.signInWithOtp({ phone });
  }

  async verifyOtp(phone: string, token: string, options: OtpCallOptions = {}) {
    const devToken =
      options.devBypass === false
        ? undefined
        : this.configService.get<string>('devOtpToken');
    if (devToken) {
      if (token !== devToken)
        return { data: { user: null }, error: { message: 'Invalid OTP' } };
      return { data: { user: { id: 'dev', phone } }, error: null };
    }
    return this.adminClient.auth.verifyOtp({ phone, token, type: 'sms' });
  }

  async getUser(accessToken: string) {
    return this.adminClient.auth.getUser(accessToken);
  }

  async refreshSession(refreshToken: string) {
    return this.adminClient.auth.refreshSession({
      refresh_token: refreshToken,
    });
  }

  async signInWithOAuth(provider: 'google' | 'facebook', redirectTo?: string) {
    return this.adminClient.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
  }

  async uploadObject(
    bucket: string,
    path: string,
    file: Buffer,
    contentType: string,
  ): Promise<{ data: unknown; error: unknown }> {
    return this.adminClient.storage.from(bucket).upload(path, file, {
      contentType,
      upsert: true,
    }) as Promise<{ data: unknown; error: unknown }>;
  }

  async createSignedUploadUrl(
    bucket: string,
    path: string,
    options?: { upsert: boolean },
  ): Promise<{
    data: { signedUrl: string; path: string; token: string } | null;
    error: unknown;
  }> {
    return this.adminClient.storage
      .from(bucket)
      .createSignedUploadUrl(path, options) as Promise<{
      data: { signedUrl: string; path: string; token: string } | null;
      error: unknown;
    }>;
  }

  async createSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number,
  ): Promise<{ data: { signedUrl: string } | null; error: unknown }> {
    return this.adminClient.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn) as Promise<{
      data: { signedUrl: string } | null;
      error: unknown;
    }>;
  }

  /** One storage round trip for many signed download URLs. */
  async createSignedUrls(
    bucket: string,
    paths: string[],
    expiresIn: number,
  ): Promise<{
    data: { path: string | null; signedUrl: string | null }[] | null;
    error: unknown;
  }> {
    return this.adminClient.storage
      .from(bucket)
      .createSignedUrls(paths, expiresIn) as Promise<{
      data: { path: string | null; signedUrl: string | null }[] | null;
      error: unknown;
    }>;
  }

  getPublicUrl(bucket: string, path: string): { data: { publicUrl: string } } {
    return this.adminClient.storage.from(bucket).getPublicUrl(path) as {
      data: { publicUrl: string };
    };
  }

  /** Object metadata (size in bytes); `data: null` when the object is missing. */
  async objectInfo(
    bucket: string,
    path: string,
  ): Promise<{ data: { size?: number } | null; error: unknown }> {
    return this.adminClient.storage.from(bucket).info(path) as Promise<{
      data: { size?: number } | null;
      error: unknown;
    }>;
  }

  async removeObjects(
    bucket: string,
    paths: string[],
  ): Promise<{ data: unknown; error: unknown }> {
    return this.adminClient.storage.from(bucket).remove(paths) as Promise<{
      data: unknown;
      error: unknown;
    }>;
  }
}
