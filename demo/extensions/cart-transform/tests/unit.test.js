import { describe, test, expect } from 'vitest';
import { cartTransformRun } from '../src/cart_transform_run.js';

const GIFT_VARIANT = 'gid://shopify/ProductVariant/GIFT';
const COMP_A = 'gid://shopify/ProductVariant/A';
const COMP_B = 'gid://shopify/ProductVariant/B';

function makeLine(variantId, quantity, amount, tags = []) {
  return {
    id: `line-${variantId}`,
    quantity,
    cost: {
      subtotalAmount: { amount: String(parseFloat(amount) * quantity) },
      amountPerQuantity: { amount: String(amount) },
    },
    merchandise: {
      id: variantId,
      title: 'Test Variant',
      product: {
        id: 'gid://shopify/Product/1',
        title: 'Test Product',
        tags,
        collections: { nodes: [] },
      },
    },
  };
}

function makeInput({
  lines,
  giftThreshold = 100,
  giftVariantId = null,
  bundleTag = 'bundle',
  bundleComponents = [],
}) {
  return {
    cart: { lines },
    cartTransform: {
      giftThreshold: { value: String(giftThreshold) },
      giftVariantId: giftVariantId ? { value: giftVariantId } : null,
      bundleTag: { value: bundleTag },
      bundleComponents: bundleComponents.length
        ? { value: JSON.stringify(bundleComponents) }
        : null,
    },
  };
}

describe('cartTransformRun', () => {
  test('returns no operations for empty cart', () => {
    const result = cartTransformRun(makeInput({ lines: [] }));
    expect(result.operations).toEqual([]);
  });

  test('adds free gift when subtotal meets threshold', () => {
    const lines = [makeLine('gid://shopify/ProductVariant/PROD1', 2, '60.00')];
    const result = cartTransformRun(
      makeInput({ lines, giftThreshold: 100, giftVariantId: GIFT_VARIANT }),
    );
    const add = result.operations.find((op) => op.add);
    expect(add).toBeDefined();
    expect(add.add.merchandiseId).toBe(GIFT_VARIANT);
    expect(add.add.quantity).toBe(1);
    expect(add.add.price.adjustment.fixedPricePerUnit.amount).toBe('0.00');
  });

  test('does NOT add gift when subtotal is below threshold', () => {
    const lines = [makeLine('gid://shopify/ProductVariant/PROD1', 1, '50.00')];
    const result = cartTransformRun(
      makeInput({ lines, giftThreshold: 100, giftVariantId: GIFT_VARIANT }),
    );
    const add = result.operations.find((op) => op.add);
    expect(add).toBeUndefined();
  });

  test('does NOT add gift when it is already in cart', () => {
    const lines = [
      makeLine('gid://shopify/ProductVariant/PROD1', 2, '60.00'),
      makeLine(GIFT_VARIANT, 1, '0.00'), // already present
    ];
    const result = cartTransformRun(
      makeInput({ lines, giftThreshold: 100, giftVariantId: GIFT_VARIANT }),
    );
    const addOps = result.operations.filter((op) => op.add);
    expect(addOps).toHaveLength(0);
  });

  test('does NOT add gift when no giftVariantId is configured', () => {
    const lines = [makeLine('gid://shopify/ProductVariant/PROD1', 2, '60.00')];
    const result = cartTransformRun(
      makeInput({ lines, giftThreshold: 100, giftVariantId: null }),
    );
    expect(result.operations).toEqual([]);
  });

  test('expands bundle product into components', () => {
    const lines = [makeLine('gid://shopify/ProductVariant/BUNDLE', 1, '100.00', ['bundle'])];
    const result = cartTransformRun(
      makeInput({
        lines,
        bundleComponents: [COMP_A, COMP_B],
        bundleTag: 'bundle',
        giftThreshold: 999, // ensure no gift is added
      }),
    );
    const expand = result.operations.find((op) => op.expand);
    expect(expand).toBeDefined();
    expect(expand.expand.cartLineId).toBe(`line-gid://shopify/ProductVariant/BUNDLE`);
    expect(expand.expand.expandedCartItems).toHaveLength(2);
    expect(expand.expand.expandedCartItems[0].merchandiseId).toBe(COMP_A);
    expect(expand.expand.expandedCartItems[1].merchandiseId).toBe(COMP_B);
  });

  test('distributes bundle price across components', () => {
    const lines = [makeLine('gid://shopify/ProductVariant/BUNDLE', 1, '100.00', ['bundle'])];
    const result = cartTransformRun(
      makeInput({ lines, bundleComponents: [COMP_A, COMP_B], giftThreshold: 999 }),
    );
    const expand = result.operations.find((op) => op.expand);
    // $100 / 2 components = $50 each
    expect(expand.expand.expandedCartItems[0].price.adjustment.fixedPricePerUnit.amount).toBe('50.00');
  });

  test('does NOT expand non-bundle products', () => {
    const lines = [makeLine('gid://shopify/ProductVariant/PROD1', 1, '50.00', ['sale'])];
    const result = cartTransformRun(
      makeInput({ lines, bundleComponents: [COMP_A, COMP_B], giftThreshold: 999 }),
    );
    const expand = result.operations.find((op) => op.expand);
    expect(expand).toBeUndefined();
  });
});
