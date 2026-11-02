import { SupabaseService } from './supabase.service';

function makeService(devOtpToken: string | null) {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'supabase.url') return 'https://example.supabase.co';
      if (key === 'supabase.serviceRoleKey') return 'service-key';
      if (key === 'supabase.anonKey') return 'anon-key';
      if (key === 'devOtpToken') return devOtpToken;
      return null;
    }),
  };
  const service = new SupabaseService(config as never);
  // Reach the private admin client to stub the provider calls.
  const auth = (
    service as unknown as {
      adminClient: {
        auth: {
          signInWithOtp: jest.Mock;
          verifyOtp: jest.Mock;
        };
      };
    }
  ).adminClient.auth;
  auth.signInWithOtp = jest.fn().mockResolvedValue({ data: {}, error: null });
  auth.verifyOtp = jest.fn().mockResolvedValue({
    data: { user: { id: 'real-user' } },
    error: null,
  });
  return { service, auth };
}

describe('SupabaseService OTP dev bypass', () => {
  it('honours DEV_OTP_TOKEN by default (register / OTP login)', async () => {
    const { service, auth } = makeService('000000');

    await expect(service.verifyOtp('+85512345678', '000000')).resolves.toEqual({
      data: { user: { id: 'dev', phone: '+85512345678' } },
      error: null,
    });
    await service.signInWithOtp('+85512345678');

    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('never honours the dev token when devBypass is false (password reset)', async () => {
    const { service, auth } = makeService('000000');

    await service.signInWithOtp('+85512345678', { devBypass: false });
    await service.verifyOtp('+85512345678', '000000', { devBypass: false });

    expect(auth.signInWithOtp).toHaveBeenCalledWith({ phone: '+85512345678' });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      phone: '+85512345678',
      token: '000000',
      type: 'sms',
    });
  });

  it('calls the real provider when no dev token is configured', async () => {
    const { service, auth } = makeService(null);

    await service.signInWithOtp('+85512345678');

    expect(auth.signInWithOtp).toHaveBeenCalledWith({ phone: '+85512345678' });
  });
});
