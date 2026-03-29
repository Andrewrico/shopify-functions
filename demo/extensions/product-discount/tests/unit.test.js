import { describe, test, expect } from 'vitest';
import { productDiscountRun } from '../src/product_discount_run.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLine(id, quantity, amount, collectionIds = []) {
  return {
    id,
    quantity,
    cost: {
      subtotalAmount: { amount: String(parseFloat(amount) * quantity) },
      amountPerQuantity: { amount: String(amount) },
    },
    merchandise: {
      product: {
        id: `gid://shopify/Product/${id}`,
        tags: [],
        collections: {
          nodes: collectionIds.map((cid) => ({
            id: cid,
            title: 'Test Collection',
          })),
        },
      },
    },
  };
}

function makeInput({ lines, threshold = 2, percentage = 20, collectionId = null, discountClasses = ['PRODUCT'] }) {
  return {
    cart: { lines },
    discount: {
      discountClasses,
      quantityThreshold: threshold !== null ? { value: String(threshold) } : null,
      percentage: percentage !== null ? { value: String(percentage) } : null,
      collectionId: collectionId ? { value: collectionId } : null,
      discountMessage: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('productDiscountRun', () => {
  test('returns no operations for empty cart', () => {
    const result = productDiscountRun(makeInput({ lines: [] }));
    expect(result.operations).toEqual([]);
  });

  test('returns no operations when discount class is not PRODUCT', () => {
    const lines = [makeLine('1', 3, '50.00')];
    const result = productDiscountRun(makeInput({ lines, discountClasses: ['ORDER'] }));
    expect(result.operations).toEqual([]);
  });

  test('applies discount when quantity meets threshold', () => {
    const lines = [makeLine('1', 3, '50.00')];
    const result = productDiscountRun(makeInput({ lines, threshold: 2, percentage: 20 }));
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0].productDiscountsAdd;
    expect(op.candidates).toHaveLength(1);
    expect(op.candidates[0].value).toEqual({ percentage: { value: 20 } });
    expect(op.candidates[0].targets[0].cartLine.id).toBe('1');
  });

  test('does NOT apply discount when quantity is below threshold', () => {
    const lines = [makeLine('1', 1, '50.00')];
    const result = productDiscountRun(makeInput({ lines, threshold: 2, percentage: 20 }));
    expect(result.operations).toEqual([]);
  });

  test('applies discount to multiple qualifying lines', () => {
    const lines = [
      makeLine('1', 2, '30.00'),
      makeLine('2', 3, '20.00'),
      makeLine('3', 1, '50.00'), // below threshold — should be excluded
    ];
    const result = productDiscountRun(makeInput({ lines, threshold: 2, percentage: 15 }));
    const candidates = result.operations[0].productDiscountsAdd.candidates;
    expect(candidates).toHaveLength(2);
  });

  test('filters to target collection when collectionId is set', () => {
    const COLLECTION = 'gid://shopify/Collection/99';
    const lines = [
      makeLine('1', 3, '50.00', [COLLECTION]),      // in collection
      makeLine('2', 3, '50.00', ['other-collection']), // NOT in collection
    ];
    const result = productDiscountRun(makeInput({ lines, threshold: 2, collectionId: COLLECTION }));
    const candidates = result.operations[0].productDiscountsAdd.candidates;
    expect(candidates).toHaveLength(1);
    expect(candidates[0].targets[0].cartLine.id).toBe('1');
  });

  test('applies to all lines when no collectionId is set', () => {
    const lines = [
      makeLine('1', 2, '40.00', ['gid://shopify/Collection/1']),
      makeLine('2', 2, '40.00', ['gid://shopify/Collection/2']),
    ];
    const result = productDiscountRun(makeInput({ lines, threshold: 2, collectionId: null }));
    expect(result.operations[0].productDiscountsAdd.candidates).toHaveLength(2);
  });

  test('uses default percentage (20) when metafield is null', () => {
    const lines = [makeLine('1', 2, '50.00')];
    const result = productDiscountRun(makeInput({ lines, percentage: null }));
    expect(result.operations[0].productDiscountsAdd.candidates[0].value).toEqual({
      percentage: { value: 20 },
    });
  });

  test('returns no operations when percentage is 0', () => {
    const lines = [makeLine('1', 5, '50.00')];
    const result = productDiscountRun(makeInput({ lines, percentage: 0 }));
    expect(result.operations).toEqual([]);
  });
});
