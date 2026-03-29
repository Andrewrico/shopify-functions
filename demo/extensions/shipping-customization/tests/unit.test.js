import { describe, test, expect } from 'vitest';
import { shippingCustomizationRun } from '../src/shipping_customization_run.js';

function makeOption(handle, title, cost) {
  return { handle, title, cost: { amount: String(cost), currencyCode: 'USD' } };
}

function makeInput({ subtotal, options = [], country = null, threshold = 75, blockedCountries = [], expressKeyword = 'Express' }) {
  return {
    cart: {
      cost: { subtotalAmount: { amount: String(subtotal), currencyCode: 'USD' } },
      deliveryGroups: options.length
        ? [{ id: 'group1', deliveryOptions: options }]
        : [],
      buyerIdentity: country ? { countryCode: country } : null,
    },
    deliveryCustomization: {
      freeShippingThreshold: { value: String(threshold) },
      freeShippingTitle: { value: 'Free Shipping' },
      hiddenExpressCountries: blockedCountries.length
        ? { value: JSON.stringify(blockedCountries) }
        : null,
      expressKeyword: { value: expressKeyword },
    },
  };
}

describe('shippingCustomizationRun', () => {
  test('returns empty operations for no delivery groups', () => {
    const result = shippingCustomizationRun(makeInput({ subtotal: 100, options: [] }));
    expect(result.operations).toEqual([]);
  });

  test('renames cheapest option when subtotal meets threshold', () => {
    const options = [
      makeOption('standard', 'Standard', 5),
      makeOption('express', 'Express', 20),
    ];
    const result = shippingCustomizationRun(makeInput({ subtotal: 75, options, threshold: 75 }));
    const rename = result.operations.find((op) => op.rename);
    expect(rename.rename.deliveryOptionHandle).toBe('standard');
    expect(rename.rename.title).toBe('Free Shipping');
  });

  test('moves free shipping option to index 0', () => {
    const options = [makeOption('standard', 'Standard', 5)];
    const result = shippingCustomizationRun(makeInput({ subtotal: 100, options }));
    const move = result.operations.find((op) => op.move);
    expect(move.move.index).toBe(0);
  });

  test('does NOT rename when subtotal is below threshold', () => {
    const options = [makeOption('standard', 'Standard', 5)];
    const result = shippingCustomizationRun(makeInput({ subtotal: 50, options, threshold: 75 }));
    const rename = result.operations.find((op) => op.rename);
    expect(rename).toBeUndefined();
  });

  test('hides express shipping for blocked countries', () => {
    const options = [
      makeOption('standard', 'Standard', 5),
      makeOption('express', 'Express Delivery', 25),
    ];
    const result = shippingCustomizationRun(
      makeInput({ subtotal: 30, options, country: 'US', blockedCountries: ['US'], threshold: 999 }),
    );
    const hide = result.operations.find((op) => op.hide);
    expect(hide.hide.deliveryOptionHandle).toBe('express');
  });

  test('does NOT hide express for non-blocked countries', () => {
    const options = [
      makeOption('standard', 'Standard', 5),
      makeOption('express', 'Express Delivery', 25),
    ];
    const result = shippingCustomizationRun(
      makeInput({ subtotal: 30, options, country: 'GB', blockedCountries: ['US'], threshold: 999 }),
    );
    const hide = result.operations.find((op) => op.hide);
    expect(hide).toBeUndefined();
  });
});
