import { createHmac } from 'node:crypto';
import {
  signAbaPayway,
  signAbaPaywayCallback,
  signAbaPaywayCallbackRaw,
  signAbaPaywayPurchase,
  splitTopLevelJsonObject,
  verifyAbaPaywayCallbackSignature,
  verifyAbaPaywayCallbackSignatureRaw,
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

describe('signAbaPaywayPurchase', () => {
  it('matches a manually computed digest over the full 23-field order', () => {
    // req_time, merchant_id, tran_id, amount, items, shipping, firstname,
    // lastname, email, phone, type, payment_option, return_url, cancel_url,
    // continue_success_url, return_deeplink, currency, custom_fields,
    // return_params, payout, lifetime, additional_params, google_pay_token,
    // skip_success_page — per ABA's own developer docs
    // (developer.payway.com.kh/purchase-14530820e0).
    const expectedData =
      '20260916090503' + // req_time
      'merchant-1' + // merchant_id
      'tran-99' + // tran_id
      '10' + // amount
      '' + // items
      '' + // shipping
      '' + // firstname
      '' + // lastname
      '' + // email
      '' + // phone
      '' + // type
      '' + // payment_option
      'cmV0dXJu' + // return_url
      'Y2FuY2Vs' + // cancel_url
      'Y29udGludWU='; // continue_success_url — deliberately no fields after
    // this one in the test input, all trailing positions stay ''.
    const expected = createHmac('sha512', 'my-api-key')
      .update(expectedData, 'utf-8')
      .digest('base64');

    expect(
      signAbaPaywayPurchase(
        {
          reqTime: '20260916090503',
          merchantId: 'merchant-1',
          tranId: 'tran-99',
          amount: 10,
          returnUrl: 'cmV0dXJu',
          cancelUrl: 'Y2FuY2Vs',
          continueSuccessUrl: 'Y29udGludWU=',
        },
        'my-api-key',
      ),
    ).toBe(expected);
  });

  it('leaves an unset optional field as an empty string at its position, not skipped', () => {
    // Omitting `currency` (position 17 of 23) must not shift `customFields`
    // (position 18) — or any later field — one slot earlier.
    const withCurrency = signAbaPaywayPurchase(
      {
        reqTime: '1',
        merchantId: 'm',
        tranId: 't',
        amount: 10,
        currency: 'USD',
        customFields: 'cf',
      },
      'key',
    );
    const withoutCurrency = signAbaPaywayPurchase(
      {
        reqTime: '1',
        merchantId: 'm',
        tranId: 't',
        amount: 10,
        customFields: 'cf',
      },
      'key',
    );
    expect(withCurrency).not.toBe(withoutCurrency);

    const manualWithout =
      '1' + // req_time
      'm' + // merchant_id
      't' + // tran_id
      '10' + // amount
      '' + // items
      '' + // shipping
      '' + // firstname
      '' + // lastname
      '' + // email
      '' + // phone
      '' + // type
      '' + // payment_option
      '' + // return_url
      '' + // cancel_url
      '' + // continue_success_url
      '' + // return_deeplink
      '' + // currency (omitted)
      'cf'; // custom_fields
    const expected = createHmac('sha512', 'key')
      .update(manualWithout, 'utf-8')
      .digest('base64');
    expect(withoutCurrency).toBe(expected);
  });

  it('is deterministic for the same inputs', () => {
    const fields = {
      reqTime: '1',
      merchantId: 'm',
      tranId: 't',
      amount: 10,
    };
    expect(signAbaPaywayPurchase(fields, 'key')).toBe(
      signAbaPaywayPurchase(fields, 'key'),
    );
  });

  it('changes when the key changes', () => {
    const fields = {
      reqTime: '1',
      merchantId: 'm',
      tranId: 't',
      amount: 10,
    };
    expect(signAbaPaywayPurchase(fields, 'key-a')).not.toBe(
      signAbaPaywayPurchase(fields, 'key-b'),
    );
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

describe('signAbaPaywayCallbackRaw', () => {
  const RAW =
    '{ "status": 0, "payment_amount": 1.50, "note": "caf\\u00e9", "apv": null, ' +
    '"nested": {"b": 2, "a": [1, 2]}, "tran_id": "T1" }';

  it('signs the values as ABA wrote them, not as a re-encode would', () => {
    // Same rule as the parsed form — sort keys, concatenate — but `1.50`
    // stays `1.50`, `\u00e9` becomes the character it encodes, `null` stays
    // `null`, and a nested object keeps its own source text.
    const expected = createHmac('sha512', 'secret')
      .update('null{"b": 2, "a": [1, 2]}caf\u00e91.500T1', 'utf-8')
      .digest('base64');

    expect(signAbaPaywayCallbackRaw(RAW, 'secret')).toBe(expected);
  });

  it('accepts the signature it produced, from a Buffer body too', () => {
    const signature = signAbaPaywayCallbackRaw(RAW, 'secret') as string;
    expect(signAbaPaywayCallbackRaw(RAW, 'secret')).not.toBeNull();
    expect(
      verifyAbaPaywayCallbackSignatureRaw(
        Buffer.from(RAW, 'utf-8').toString('utf-8'),
        'secret',
        signature,
      ),
    ).toBe(true);
  });

  it('rejects the parsed-form signature when the raw representation differs', () => {
    // The re-encoded payload has 1.5, so its signature is not the raw one.
    const parsedSignature = signAbaPaywayCallback(
      JSON.parse(RAW) as Record<string, unknown>,
      'secret',
    );
    expect(
      verifyAbaPaywayCallbackSignatureRaw(RAW, 'secret', parsedSignature),
    ).toBe(false);
  });

  it('rejects a tampered value and a wrong key', () => {
    const signature = signAbaPaywayCallbackRaw(RAW, 'secret') as string;
    const tampered = RAW.replace('1.50', '9.50');
    expect(
      verifyAbaPaywayCallbackSignatureRaw(tampered, 'secret', signature),
    ).toBe(false);
    expect(
      verifyAbaPaywayCallbackSignatureRaw(RAW, 'wrong-secret', signature),
    ).toBe(false);
  });

  it('answers null/false for a body that is not one JSON object', () => {
    for (const bad of ['', 'null', '[]', '{"a":1', '{"a":1} trailing']) {
      expect(signAbaPaywayCallbackRaw(bad, 'secret')).toBeNull();
      expect(
        verifyAbaPaywayCallbackSignatureRaw(bad, 'secret', 'anything'),
      ).toBe(false);
    }
  });
});

describe('splitTopLevelJsonObject', () => {
  it('keeps member order and exact value text', () => {
    expect(splitTopLevelJsonObject('{"b": 1e3, "a": "x\\"y"}')).toEqual([
      { key: 'b', raw: '1e3' },
      { key: 'a', raw: '"x\\"y"' },
    ]);
  });

  it('handles nested objects, arrays and trailing whitespace', () => {
    expect(
      splitTopLevelJsonObject(' {"a":{"b":[1,{"c":2}]}, "d":true} '),
    ).toEqual([
      { key: 'a', raw: '{"b":[1,{"c":2}]}' },
      { key: 'd', raw: 'true' },
    ]);
  });

  it('accepts an empty object and rejects an empty body', () => {
    expect(splitTopLevelJsonObject('{}')).toEqual([]);
    expect(splitTopLevelJsonObject('')).toBeNull();
  });
});
