import {
  filterByCollection,
  metafieldNumber,
  percentageValue,
  sumCartSubtotal,
} from '../../lib/discount-engine.js';

/**
 * @typedef {import("../generated/api").ProductDiscountInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} FunctionResult
 */

/**
 * Shopify Function: Product Discount — Quantity & Collection
 *
 * Business Rules:
 * 1. Reads discount configuration from metafields (quantity_threshold, percentage, collection_id).
 * 2. Filters cart lines to the target collection (all lines if no collection is set).
 * 3. Applies a percentage discount to any qualifying line where quantity >= threshold.
 * 4. Falls back to sane defaults: threshold=2, percentage=20, all collections.
 *
 * Configuration metafields (set on the discount via Admin API or UI):
 *   configuration.quantity_threshold  — integer, e.g. "2"
 *   configuration.percentage          — float,   e.g. "20"
 *   configuration.collection_id       — GID,     e.g. "gid://shopify/Collection/123"
 *   configuration.message             — string,  e.g. "Buy 2+, save 20%!"
 *
 * @param {RunInput} input
 * @returns {FunctionResult}
 */
export function productDiscountRun(input) {
  const { cart, discount } = input;

  if (!cart.lines.length) return { operations: [] };

  const hasProductClass = discount.discountClasses.includes('PRODUCT');
  if (!hasProductClass) return { operations: [] };

  // --- Configuration from metafields ---
  const quantityThreshold = metafieldNumber(discount.quantityThreshold, 2);
  const percentage        = metafieldNumber(discount.percentage, 20);
  const collectionId      = discount.collectionId?.value ?? null;
  const message           = discount.discountMessage?.value ?? `Buy ${quantityThreshold}+, save ${percentage}%!`;

  if (percentage <= 0 || percentage > 100) return { operations: [] };

  // --- Filter lines to target collection ---
  const eligibleLines = filterByCollection(cart.lines, collectionId);
  if (!eligibleLines.length) return { operations: [] };

  // --- Build discount candidates for qualifying lines ---
  const candidates = eligibleLines
    .filter((line) => line.quantity >= quantityThreshold)
    .map((line) => ({
      message,
      targets: [{ cartLine: { id: line.id } }],
      value: percentageValue(percentage),
    }));

  if (!candidates.length) return { operations: [] };

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: 'ALL',
        },
      },
    ],
  };
}
