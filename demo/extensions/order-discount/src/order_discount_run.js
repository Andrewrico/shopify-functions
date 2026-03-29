import {
  applyTieredDiscount,
  metafieldJsonArray,
  parseAmount,
  percentageValue,
  safeJsonParse,
} from '../../lib/discount-engine.js';

/**
 * @typedef {import("../generated/api").OrderDiscountInput} RunInput
 * @typedef {import("../generated/api").OrderDiscountsGenerateRunResult} FunctionResult
 */

/**
 * Default tier configuration used when no metafield is set.
 * Spend $100 → 10%, Spend $200 → 20%.
 *
 * @type {Array<{threshold: number, percentage: number}>}
 */
const DEFAULT_TIERS = [
  { threshold: 100, percentage: 10 },
  { threshold: 200, percentage: 20 },
];

/**
 * Shopify Function: Order Discount — Tiered Spend
 *
 * Business Rules:
 * 1. Reads tier configuration from `configuration.tiers` metafield (JSON array).
 * 2. Calculates cart subtotal.
 * 3. Finds the highest applicable tier (highest threshold that the subtotal meets).
 * 4. Applies a percentage discount to the entire order.
 *
 * Configuration metafields:
 *   configuration.tiers            — JSON, e.g. [{"threshold":100,"percentage":10},{"threshold":200,"percentage":20}]
 *   configuration.message_template — string, e.g. "You saved {{percentage}}% on your order!"
 *
 * @param {RunInput} input
 * @returns {FunctionResult}
 */
export function orderDiscountRun(input) {
  const { cart, discount } = input;

  const hasOrderClass = discount.discountClasses.includes('ORDER');
  if (!hasOrderClass) return { operations: [] };

  const subtotal = parseAmount(cart.cost.subtotalAmount.amount);
  if (subtotal <= 0) return { operations: [] };

  // --- Tier configuration ---
  const tiers = metafieldJsonArray(discount.tiers, DEFAULT_TIERS);
  const applicablePercentage = applyTieredDiscount(subtotal, tiers);

  if (applicablePercentage === null || applicablePercentage <= 0) {
    return { operations: [] };
  }

  // --- Build message ---
  const messageTemplate = discount.messageTemplate?.value ?? 'Save {{percentage}}% on your order!';
  const message = messageTemplate
    .replace('{{percentage}}', String(applicablePercentage))
    .replace('{{subtotal}}', subtotal.toFixed(2));

  return {
    operations: [
      {
        orderDiscountsAdd: {
          candidates: [
            {
              message,
              targets: [{ orderSubtotal: { excludedVariantIds: [] } }],
              value: percentageValue(applicablePercentage),
            },
          ],
          selectionStrategy: 'FIRST',
        },
      },
    ],
  };
}
