import {
  metafieldJsonArray,
  metafieldNumber,
  parseAmount,
  sumCartSubtotal,
} from '../../lib/discount-engine.js';

/**
 * @typedef {import("../generated/api").CartTransformInput} RunInput
 * @typedef {import("../generated/api").CartTransformRunResult} FunctionResult
 */

/**
 * Shopify Function: Cart Transform — Bundle & Gift Logic
 *
 * Transforms:
 *
 * 1. BUNDLE EXPAND
 *    When a cart line has the bundle tag, expand it into its component variants.
 *    Each component inherits proportional pricing from the bundle price.
 *    Example: "Starter Kit" ($100) → "Widget A" + "Widget B" + "Widget C"
 *
 * 2. FREE GIFT
 *    When the cart subtotal reaches the configured threshold, add a free gift
 *    variant at 100% discount. If the gift is already in the cart, skip.
 *    Example: Spend $100+ → receive Sample Pack for free
 *
 * Configuration metafields:
 *   configuration.gift_threshold      — number,     e.g. "100"
 *   configuration.gift_variant_id     — GID string, e.g. "gid://shopify/ProductVariant/123"
 *   configuration.bundle_tag          — string,     e.g. "bundle"
 *   configuration.bundle_components   — JSON array, e.g. ["gid://shopify/ProductVariant/A","..."]
 *
 * @param {RunInput} input
 * @returns {FunctionResult}
 */
export function cartTransformRun(input) {
  const { cart, cartTransform } = input;
  const operations = [];

  if (!cart.lines.length) return { operations };

  const giftThreshold    = metafieldNumber(cartTransform.giftThreshold, 100);
  const giftVariantId    = cartTransform.giftVariantId?.value ?? null;
  const bundleTag        = cartTransform.bundleTag?.value ?? 'bundle';
  const bundleComponents = metafieldJsonArray(cartTransform.bundleComponents, []);

  const subtotal = sumCartSubtotal(cart.lines);

  // --- Transform 1: Bundle expand ---
  if (bundleComponents.length > 0) {
    for (const line of cart.lines) {
      const tags = line.merchandise?.product?.tags ?? [];
      if (!tags.includes(bundleTag)) continue;

      // Distribute bundle price evenly across components
      const unitCost = parseAmount(line.cost.amountPerQuantity.amount);
      const pricePerComponent = (unitCost / bundleComponents.length).toFixed(2);

      operations.push({
        expand: {
          cartLineId: line.id,
          expandedCartItems: bundleComponents.map((variantId) => ({
            merchandiseId: variantId,
            quantity: line.quantity,
            price: { adjustment: { fixedPricePerUnit: { amount: pricePerComponent, currencyCode: 'USD' } } },
          })),
        },
      });
    }
  }

  // --- Transform 2: Free gift ---
  if (giftVariantId && subtotal >= giftThreshold) {
    const giftAlreadyInCart = cart.lines.some(
      (line) => line.merchandise?.id === giftVariantId,
    );

    if (!giftAlreadyInCart) {
      operations.push({
        add: {
          merchandiseId: giftVariantId,
          quantity: 1,
          price: {
            adjustment: {
              fixedPricePerUnit: { amount: '0.00', currencyCode: 'USD' },
            },
          },
        },
      });
    }
  }

  return { operations };
}
