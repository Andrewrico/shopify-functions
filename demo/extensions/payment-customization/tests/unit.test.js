import { describe, test, expect } from 'vitest';
import { paymentCustomizationRun } from '../src/payment_customization_run.js';

function makePaymentMethod(id, name) {
  return { id, name };
}

function makeInput({
  total,
  country = null,
  methods = [],
  hiddenMethods = [],
  maxCodAmount = 500,
  codBlockedCountries = [],
  codKeyword = 'Cash on Delivery',
}) {
  return {
    cart: {
      cost: { totalAmount: { amount: String(total), currencyCode: 'USD' } },
      buyerIdentity: country ? { countryCode: country } : null,
    },
    paymentCustomization: {
      hiddenMethods: hiddenMethods.length ? { value: JSON.stringify(hiddenMethods) } : null,
      maxCodAmount: { value: String(maxCodAmount) },
      codBlockedCountries: codBlockedCountries.length
        ? { value: JSON.stringify(codBlockedCountries) }
        : null,
      codKeyword: { value: codKeyword },
    },
    paymentMethods: methods,
  };
}

describe('paymentCustomizationRun', () => {
  test('returns empty operations for no payment methods', () => {
    const result = paymentCustomizationRun(makeInput({ total: 100, methods: [] }));
    expect(result.operations).toEqual([]);
  });

  test('does not hide methods when no rules apply', () => {
    const methods = [makePaymentMethod('pm1', 'Credit Card')];
    const result = paymentCustomizationRun(makeInput({ total: 50, methods }));
    expect(result.operations).toEqual([]);
  });

  test('hides method in always-hidden list', () => {
    const methods = [
      makePaymentMethod('pm1', 'Credit Card'),
      makePaymentMethod('pm2', 'Bank Transfer'),
    ];
    const result = paymentCustomizationRun(
      makeInput({ total: 50, methods, hiddenMethods: ['Bank Transfer'] }),
    );
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].hide.paymentMethodId).toBe('pm2');
  });

  test('hides COD when cart total exceeds max', () => {
    const methods = [
      makePaymentMethod('pm1', 'Credit Card'),
      makePaymentMethod('pm2', 'Cash on Delivery'),
    ];
    const result = paymentCustomizationRun(
      makeInput({ total: 600, methods, maxCodAmount: 500 }),
    );
    const hidden = result.operations.map((op) => op.hide.paymentMethodId);
    expect(hidden).toContain('pm2');
    expect(hidden).not.toContain('pm1');
  });

  test('does NOT hide COD when cart total is below max', () => {
    const methods = [makePaymentMethod('pm2', 'Cash on Delivery')];
    const result = paymentCustomizationRun(
      makeInput({ total: 100, methods, maxCodAmount: 500 }),
    );
    expect(result.operations).toEqual([]);
  });

  test('hides COD for blocked country regardless of total', () => {
    const methods = [makePaymentMethod('pm2', 'Cash on Delivery')];
    const result = paymentCustomizationRun(
      makeInput({ total: 10, methods, country: 'US', codBlockedCountries: ['US'], maxCodAmount: 9999 }),
    );
    expect(result.operations).toHaveLength(1);
  });

  test('case-insensitive matching for COD keyword', () => {
    const methods = [makePaymentMethod('pm2', 'cash on delivery')];
    const result = paymentCustomizationRun(
      makeInput({ total: 600, methods, maxCodAmount: 500, codKeyword: 'Cash on Delivery' }),
    );
    expect(result.operations).toHaveLength(1);
  });
});
