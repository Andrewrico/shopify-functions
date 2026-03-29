import { describe, test, expect } from 'vitest';
import { orderDiscountRun } from '../src/order_discount_run.js';

function makeInput({ subtotal, tiers = null, discountClasses = ['ORDER'] }) {
  return {
    cart: { cost: { subtotalAmount: { amount: String(subtotal), currencyCode: 'USD' } } },
    discount: {
      discountClasses,
      tiers: tiers ? { value: JSON.stringify(tiers) } : null,
      messageTemplate: null,
    },
  };
}

const DEFAULT_TIERS = [
  { threshold: 100, percentage: 10 },
  { threshold: 200, percentage: 20 },
];

describe('orderDiscountRun', () => {
  test('returns no operations for zero subtotal', () => {
    const result = orderDiscountRun(makeInput({ subtotal: 0 }));
    expect(result.operations).toEqual([]);
  });

  test('returns no operations when discount class is not ORDER', () => {
    const result = orderDiscountRun(makeInput({ subtotal: 150, discountClasses: ['PRODUCT'] }));
    expect(result.operations).toEqual([]);
  });

  test('returns no operations when subtotal is below all tiers', () => {
    const result = orderDiscountRun(makeInput({ subtotal: 50, tiers: DEFAULT_TIERS }));
    expect(result.operations).toEqual([]);
  });

  test('applies 10% for $100 subtotal', () => {
    const result = orderDiscountRun(makeInput({ subtotal: 100, tiers: DEFAULT_TIERS }));
    expect(result.operations).toHaveLength(1);
    const candidate = result.operations[0].orderDiscountsAdd.candidates[0];
    expect(candidate.value).toEqual({ percentage: { value: 10 } });
  });

  test('applies 10% for $150 (between tiers)', () => {
    const result = orderDiscountRun(makeInput({ subtotal: 150, tiers: DEFAULT_TIERS }));
    const candidate = result.operations[0].orderDiscountsAdd.candidates[0];
    expect(candidate.value).toEqual({ percentage: { value: 10 } });
  });

  test('applies 20% for $200+ subtotal', () => {
    const result = orderDiscountRun(makeInput({ subtotal: 200, tiers: DEFAULT_TIERS }));
    const candidate = result.operations[0].orderDiscountsAdd.candidates[0];
    expect(candidate.value).toEqual({ percentage: { value: 20 } });
  });

  test('applies 20% for $999 (well above highest tier)', () => {
    const result = orderDiscountRun(makeInput({ subtotal: 999, tiers: DEFAULT_TIERS }));
    const candidate = result.operations[0].orderDiscountsAdd.candidates[0];
    expect(candidate.value).toEqual({ percentage: { value: 20 } });
  });

  test('uses default tiers when metafield is null', () => {
    // Default tiers: $100 = 10%, $200 = 20%
    const result = orderDiscountRun(makeInput({ subtotal: 250, tiers: null }));
    expect(result.operations).toHaveLength(1);
  });

  test('supports custom tier configuration', () => {
    const customTiers = [
      { threshold: 50, percentage: 5 },
      { threshold: 500, percentage: 30 },
    ];
    const result = orderDiscountRun(makeInput({ subtotal: 600, tiers: customTiers }));
    const candidate = result.operations[0].orderDiscountsAdd.candidates[0];
    expect(candidate.value).toEqual({ percentage: { value: 30 } });
  });
});
