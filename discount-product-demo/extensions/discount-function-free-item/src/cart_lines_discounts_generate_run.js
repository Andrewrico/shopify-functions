import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from '../generated/api';

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

/**
 * Shopify Function: Cart Lines Discounts Generate Run
 * 
 * This function implements a "Buy $500+ and get the cheapest 'Free Item' tagged product for free" discount logic.
 * 
 * Business Rules:
 * 1. Only applies to carts with products tagged with "Free Item"
 * 2. Cart subtotal must be $500 or more (before any discounts)
 * 3. Only the cheapest "Free Item" product (by unit price) gets 100% discount
 * 4. Only applies to product discounts (not order or shipping discounts)
 * 
 * @param {RunInput} input - The input object containing cart data and discount configuration
 * @returns {CartLinesDiscountsGenerateRunResult} - The result object containing discount operations
 * 
 * @example
 * // Input: Cart with $600 subtotal and 2 "Free Item" products ($20 and $30)
 * // Output: 100% discount applied to the $20 product (cheapest)
 * 
 * @author Shopify Functions Team
 * @version 1.0.0
 * @since 2024
 */
export function cartLinesDiscountsGenerateRun(input) {
  // Early exit if cart has no lines
  if (!input.cart.lines.length) {
    return {operations: []};
  }

  // Check if this discount function supports product discounts
  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  // Early exit if product discounts are not supported
  if (!hasProductDiscountClass) {
    return {operations: []};
  }

  // Filter cart lines to find products tagged with "Free Item"
  // FIX 1: Check the actual boolean value of hasAnyTag, not just its presence.
  // hasAnyTag(tags: ["Free Item"]) returns true only if the product has that tag.
  const freeItemLines = input.cart.lines.filter((line) => {
    return (
      line.merchandise &&
      line.merchandise.product &&
      line.merchandise.product.hasAnyTag === true
    );
  });

  // Early exit if no "Free Item" tagged products in cart
  if (freeItemLines.length === 0) {
    return {operations: []};
  }

  // Calculate cart subtotal across all lines
  // FIX 2: Calculate cart subtotal across all lines.
  const cartSubtotal = input.cart.lines.reduce((total, line) => {
    return total + parseFloat(line.cost.subtotalAmount.amount);
  }, 0);

  // Gate: cart must be $500 or more to qualify
  if (cartSubtotal < 500) {
    return {operations: []};
  }

  // Find the cheapest "Free Item" line by UNIT PRICE (not subtotal)
  // FIX 3: Find the cheapest "Free Item" line by UNIT PRICE (not subtotal),
  // so quantity doesn't skew which item is selected.
  const cheapestFreeItemLine = freeItemLines.reduce((cheapest, line) => {
    const lineUnitPrice = parseFloat(line.cost.amountPerQuantity.amount);
    const cheapestUnitPrice = parseFloat(cheapest.cost.amountPerQuantity.amount);
    return lineUnitPrice < cheapestUnitPrice ? line : cheapest;
  }, freeItemLines[0]);
  

  // Apply 100% discount to the cheapest "Free Item" product
  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: 'SAVE 100%',
              targets: [
                {
                  cartLine: {
                    id: cheapestFreeItemLine.id,
                    quantity: 1, // Only discount 1 unit of the cheapest item
                  },
                },
              ],
              value: {
                percentage: {
                  value: 100, // 100% discount
                },
              },
            },
          ],
          selectionStrategy: ProductDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}