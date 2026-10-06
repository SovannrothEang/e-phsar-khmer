/**
 * The balance invariant for a `ledger_transaction`: at least two entries,
 * debits exactly equal credits, every amount a well-formed positive number
 * that fits the `numeric(20, 2)` column `ledger_entries.amount` stores.
 * Direction lives in `entryType`, never in the sign — a signed amount would
 * let a -5 debit "balance" a -5 credit, and a zero line balances anything
 * while recording nothing (the `ledger_entries_amount_positive` CHECK backs
 * this up in the database). Kept dependency-free
 * (no Effect, no Drizzle) so it can be unit-tested directly - the use-case
 * that enforces it wraps its result in `LedgerImbalanceError`.
 *
 * Exactness matters: sums are bigint-scaled, never float. `Number()` rounding
 * can false-pass an imbalance at 20+ digit amounts, a malformed amount used to
 * yield NaN (which `Math.abs(NaN) > 1e-9` treats as balanced!) and sail to the
 * DB, and a value with more than 2 decimal places would be rounded by Postgres
 * *after* a float-style check, which can unbalance the stored rows even when
 * the submitted ones balanced.
 */

const MAX_AMOUNT_SCALE = 2;
/** numeric(20, 2): 20 significant digits, 2 after the point. */
const MAX_WHOLE_DIGITS = 20 - MAX_AMOUNT_SCALE;

const AMOUNT_PATTERN = /^(\d+)(?:\.(\d+))?$/;

export type LedgerEntryLike = {
  entryType: 'debit' | 'credit';
  amount: string;
};

export type BalanceCheck = { ok: true } | { ok: false; detail: string };

interface ScaledAmount {
  units: bigint;
  scale: number;
  wholeDigits: number;
}

function parseAmount(amount: string): ScaledAmount | null {
  const match = AMOUNT_PATTERN.exec(amount);
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  return {
    units: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
    wholeDigits: whole.replace(/^0+(?=\d)/, '').length,
  };
}

function formatUnits(units: bigint, scale: number): string {
  const digits = units.toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale);
  const fraction = scale > 0 ? `.${digits.slice(digits.length - scale)}` : '';
  return `${whole}${fraction}`;
}

export function checkEntriesBalance(
  entries: LedgerEntryLike[],
  currency: string,
): BalanceCheck {
  if (entries.length < 2) {
    return {
      ok: false,
      detail: 'A ledger_transaction needs at least two entries',
    };
  }

  let maxScale = 0;
  const parsedAmounts: ScaledAmount[] = [];
  for (const entry of entries) {
    const parsed = parseAmount(entry.amount);
    if (!parsed) {
      return {
        ok: false,
        detail: `Invalid amount "${entry.amount}" for ${currency}`,
      };
    }
    if (parsed.scale > MAX_AMOUNT_SCALE) {
      return {
        ok: false,
        detail: `Amount "${entry.amount}" exceeds the ledger's ${MAX_AMOUNT_SCALE}-decimal scale`,
      };
    }
    if (parsed.wholeDigits > MAX_WHOLE_DIGITS) {
      return {
        ok: false,
        detail: `Amount "${entry.amount}" exceeds the ledger's numeric(20, ${MAX_AMOUNT_SCALE}) precision`,
      };
    }
    if (parsed.units === 0n) {
      return {
        ok: false,
        detail: `Amount "${entry.amount}" must be greater than zero`,
      };
    }
    parsedAmounts.push(parsed);
    if (parsed.scale > maxScale) maxScale = parsed.scale;
  }

  let debitUnits = 0n;
  let creditUnits = 0n;
  for (const [index, parsed] of parsedAmounts.entries()) {
    const scaled = parsed.units * 10n ** BigInt(maxScale - parsed.scale);
    if (entries[index].entryType === 'debit') debitUnits += scaled;
    else creditUnits += scaled;
  }
  if (debitUnits !== creditUnits) {
    return {
      ok: false,
      detail: `Unbalanced entries for ${currency}: debit=${formatUnits(debitUnits, maxScale)} credit=${formatUnits(creditUnits, maxScale)}`,
    };
  }
  return { ok: true };
}
