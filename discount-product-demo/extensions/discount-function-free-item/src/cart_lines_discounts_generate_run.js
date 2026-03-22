import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from '../generated/api';

/**
  * @typedef {import("../generated/api").CartInput} RunInput
  * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
  */

/**
  * @param {RunInput} input
  * @returns {CartLinesDiscountsGenerateRunResult}
  */

export function cartLinesDiscountsGenerateRun(input) {
  if (!input.cart.lines.length) {
    return {operations: []};
  }

  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasProductDiscountClass) {
    return {operations: []};
  }

  // FIX 1: Check the actual boolean value of hasAnyTag, not just its presence.
  // hasAnyTag(tags: ["Free Item"]) returns true only if the product has that tag.
  const freeItemLines = input.cart.lines.filter((line) => {
    return (
      line.merchandise &&
      line.merchandise.product &&
      line.merchandise.product.hasAnyTag === true
    );
  });

  // If no "Free Item" tagged products in cart, nothing to do.
  if (freeItemLines.length === 0) {
    return {operations: []};
  }

  // FIX 2: Calculate cart subtotal across all lines.
  const cartSubtotal = input.cart.lines.reduce((total, line) => {
    return total + parseFloat(line.cost.subtotalAmount.amount);
  }, 0);

  // Gate: cart must be $500 or more to qualify.
  if (cartSubtotal < 500) {
    return {operations: []};
  }

  // FIX 3: Find the cheapest "Free Item" line by UNIT PRICE (not subtotal),
  // so quantity doesn't skew which item is selected.
  const cheapestFreeItemLine = freeItemLines.reduce((cheapest, line) => {
    const lineUnitPrice = parseFloat(line.cost.amountPerQuantity.amount);
    const cheapestUnitPrice = parseFloat(cheapest.cost.amountPerQuantity.amount);
    return lineUnitPrice < cheapestUnitPrice ? line : cheapest;
  }, freeItemLines[0]);
  

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
                    quantity: 1,
                  },
                },
              ],
              value: {
                percentage: {
                  value: 100,
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
