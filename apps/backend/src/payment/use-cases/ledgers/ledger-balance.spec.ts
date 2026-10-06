import { checkEntriesBalance, type LedgerEntryLike } from './ledger-balance';

function entries(
  ...amounts: Array<[LedgerEntryLike['entryType'], string]>
): LedgerEntryLike[] {
  return amounts.map(([entryType, amount]) => ({ entryType, amount }));
}

describe('checkEntriesBalance', () => {
  it('accepts a balanced pair', () => {
    expect(
      checkEntriesBalance(
        entries(['debit', '10.00'], ['credit', '10.00']),
        'USD',
      ),
    ).toEqual({ ok: true });
  });

  it('accepts equal amounts written with different decimal scales', () => {
    expect(
      checkEntriesBalance(entries(['debit', '1.5'], ['credit', '1.50']), 'USD'),
    ).toEqual({ ok: true });
  });

  it('rejects fewer than two entries', () => {
    expect(checkEntriesBalance(entries(['debit', '10.00']), 'USD')).toEqual({
      ok: false,
      detail: 'A ledger_transaction needs at least two entries',
    });
  });

  it('rejects unbalanced entries with both sums in the detail', () => {
    expect(
      checkEntriesBalance(
        entries(['debit', '10.00'], ['credit', '9.99']),
        'USD',
      ),
    ).toEqual({
      ok: false,
      detail: 'Unbalanced entries for USD: debit=10.00 credit=9.99',
    });
  });

  it('catches an imbalance float precision would hide at the column maximum', () => {
    // Number() maps both to 123456789012345680 � a float check calls this balanced.
    expect(
      checkEntriesBalance(
        entries(
          ['debit', '123456789012345678.01'],
          ['credit', '123456789012345678.02'],
        ),
        'USD',
      ),
    ).toEqual({
      ok: false,
      detail:
        'Unbalanced entries for USD: debit=123456789012345678.01 credit=123456789012345678.02',
    });
  });

  it('rejects an amount with more whole digits than numeric(20,2) can store', () => {
    expect(
      checkEntriesBalance(
        entries(
          ['debit', '1234567890123456789.00'],
          ['credit', '1234567890123456789.00'],
        ),
        'USD',
      ),
    ).toEqual({
      ok: false,
      detail: `Amount "1234567890123456789.00" exceeds the ledger's numeric(20, 2) precision`,
    });
  });

  it('does not count leading zeros against precision', () => {
    expect(
      checkEntriesBalance(
        entries(['debit', '0000000000000000000001.00'], ['credit', '1.00']),
        'USD',
      ),
    ).toEqual({ ok: true });
  });

  it('rejects negative amounts even when they would balance', () => {
    expect(
      checkEntriesBalance(
        entries(['debit', '-5.00'], ['credit', '-5.00']),
        'USD',
      ),
    ).toEqual({ ok: false, detail: 'Invalid amount "-5.00" for USD' });
  });

  it('rejects a zero line, which balances anything while recording nothing', () => {
    expect(
      checkEntriesBalance(entries(['debit', '0.00'], ['credit', '0']), 'USD'),
    ).toEqual({
      ok: false,
      detail: 'Amount "0.00" must be greater than zero',
    });
  });

  it('rejects a malformed amount instead of treating NaN as balanced', () => {
    expect(
      checkEntriesBalance(
        entries(['debit', 'not-a-number'], ['credit', '10.00']),
        'USD',
      ),
    ).toEqual({
      ok: false,
      detail: 'Invalid amount "not-a-number" for USD',
    });
  });

  it('rejects scientific notation, which the numeric column cannot store', () => {
    expect(
      checkEntriesBalance(
        entries(['debit', '1e2'], ['credit', '100.00']),
        'USD',
      ),
    ).toEqual({
      ok: false,
      detail: 'Invalid amount "1e2" for USD',
    });
  });

  it('rejects amounts past numeric(20,2) scale that Postgres would round', () => {
    expect(
      checkEntriesBalance(
        entries(['debit', '1.005'], ['debit', '1.005'], ['credit', '2.01']),
        'USD',
      ),
    ).toEqual({
      ok: false,
      detail: 'Amount "1.005" exceeds the ledger\'s 2-decimal scale',
    });
  });

  it('rejects an empty entry list', () => {
    expect(checkEntriesBalance([], 'USD')).toEqual({
      ok: false,
      detail: 'A ledger_transaction needs at least two entries',
    });
  });
});
