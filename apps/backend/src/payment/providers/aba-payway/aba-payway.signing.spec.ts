import { createHmac } from 'node:crypto';
import {
  signAbaPayway,
  signAbaPaywayCallback,
  verifyAbaPaywayCallbackSignature,
} from './aba-payway.signing';

describe('signAbaPayway', () => {
  it('matches a manually computed HMAC-SHA512 base64 digest', () => {
    const expected = createHmac('sha512', 'my-api-key')
      .update('123merchant-1tran-99', 'utf-8')
      .digest('base64');

    expect(signAbaPayway(['123', 'merchant-1', 'tran-99'], 'my-api-key')).toBe(
      expected,
    );
  });

  it('is deterministic for the same inputs', () => {
    const a = signAbaPayway(['1', 'm', 't', 10, 'USD'], 'key');
    const b = signAbaPayway(['1', 'm', 't', 10, 'USD'], 'key');
    expect(a).toBe(b);
  });

  it('changes when any value changes', () => {
    const a = signAbaPayway(['1', 'm', 't', 10, 'USD'], 'key');
    const b = signAbaPayway(['1', 'm', 't', 11, 'USD'], 'key');
    expect(a).not.toBe(b);
  });

  it('changes when the key changes', () => {
    const a = signAbaPayway(['1', 'm', 't'], 'key-a');
    const b = signAbaPayway(['1', 'm', 't'], 'key-b');
    expect(a).not.toBe(b);
  });

  it('skips null/undefined values rather than stringifying them', () => {
    const withNulls = signAbaPayway(['1', null, 'm', undefined, 't'], 'key');
    const withoutNulls = signAbaPayway(['1', 'm', 't'], 'key');
    expect(withNulls).toBe(withoutNulls);
  });
});

describe('signAbaPaywayCallback', () => {
  // ABA's documented "Sample Pushback Data" from the callback guide.
  const samplePayload = {
    tran_id: '9e55c7c4b4d9488a96db',
    apv: '832865',
    status: '0',
    return_params: '{"order_id":"123","amount":100,"client_id":"1234567890"}',
    merchant_ref: '',
  };

  it('matches a manually computed sort-keys + concat + HMAC-SHA512 digest', () => {
    // Key order ascending: apv, merchant_ref, return_params, status, tran_id.
    // return_params is already a JSON *string* in the sample (not a
    // nested object), so it concatenates as-is.
    const expectedData =
      samplePayload.apv +
      samplePayload.merchant_ref +
      samplePayload.return_params +
      samplePayload.status +
      samplePayload.tran_id;
    const expected = createHmac('sha512', 'my-api-key')
      .update(expectedData, 'utf-8')
      .digest('base64');

    expect(signAbaPaywayCallback(samplePayload, 'my-api-key')).toBe(expected);
  });

  it('is independent of key order in the source object', () => {
    const reordered = {
      status: samplePayload.status,
      tran_id: samplePayload.tran_id,
      apv: samplePayload.apv,
      return_params: samplePayload.return_params,
      merchant_ref: samplePayload.merchant_ref,
    };
    expect(signAbaPaywayCallback(reordered, 'my-api-key')).toBe(
      signAbaPaywayCallback(samplePayload, 'my-api-key'),
    );
  });

  it('JSON-encodes a genuinely nested object value before concatenating', () => {
    const withNested = signAbaPaywayCallback({ a: { x: 1 }, b: 'c' }, 'key');
    const expectedData = JSON.stringify({ x: 1 }) + 'c';
    const expected = createHmac('sha512', 'key')
      .update(expectedData, 'utf-8')
      .digest('base64');
    expect(withNested).toBe(expected);
  });

  it('changes when any value changes', () => {
    const a = signAbaPaywayCallback(samplePayload, 'key');
    const b = signAbaPaywayCallback({ ...samplePayload, status: '1' }, 'key');
    expect(a).not.toBe(b);
  });
});

describe('verifyAbaPaywayCallbackSignature', () => {
  const payload = { tran_id: 'abc', status: '0' };

  it('accepts the correctly computed signature', () => {
    const signature = signAbaPaywayCallback(payload, 'secret');
    expect(verifyAbaPaywayCallbackSignature(payload, 'secret', signature)).toBe(
      true,
    );
  });

  it('rejects a wrong signature of the same length', () => {
    const signature = signAbaPaywayCallback(payload, 'secret');
    const lastChar = signature.charAt(signature.length - 1);
    const tampered = signature.slice(0, -1) + (lastChar === 'A' ? 'B' : 'A');
    expect(verifyAbaPaywayCallbackSignature(payload, 'secret', tampered)).toBe(
      false,
    );
  });

  it('rejects a signature computed with the wrong key', () => {
    const signature = signAbaPaywayCallback(payload, 'secret');
    expect(
      verifyAbaPaywayCallbackSignature(payload, 'wrong-secret', signature),
    ).toBe(false);
  });

  it('rejects a mismatched-length signature without throwing', () => {
    expect(
      verifyAbaPaywayCallbackSignature(payload, 'secret', 'too-short'),
    ).toBe(false);
  });

  it('rejects when the payload was tampered with after signing', () => {
    const signature = signAbaPaywayCallback(payload, 'secret');
    expect(
      verifyAbaPaywayCallbackSignature(
        { ...payload, status: '1' },
        'secret',
        signature,
      ),
    ).toBe(false);
  });
});
