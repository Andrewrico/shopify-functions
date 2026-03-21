import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
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

  const hasOrderDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Order,
  );
  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasOrderDiscountClass && !hasProductDiscountClass) {
    return {operations: []};
  }

  // Calculate total cart subtotal
  const cartSubtotal = input.cart.lines.reduce((total, line) => {
    return total + parseFloat(line.cost.subtotalAmount.amount);
  }, 0);

  const operations = [];

  if (hasProductDiscountClass) {
    // Filter products with "Free Item" tag
    const freeItemLines = input.cart.lines.filter(line => {
      if (line.merchandise && line.merchandise.product && line.merchandise.product.hasAnyTag) {
        return line.merchandise.product.hasAnyTag;
      }
      return false;
    });

    // Check if any Free Item already has a discount applied
    const hasExistingDiscount = freeItemLines.some(line => {
      // Check if the line has any discount allocations
      return line.cost.discountAllocations && line.cost.discountAllocations.length > 0;
    });

    // If there are existing discounts, remove them first
    if (hasExistingDiscount) {
      freeItemLines.forEach(line => {
        if (line.cost.discountAllocations && line.cost.discountAllocations.length > 0) {
          operations.push({
            productDiscountsRemove: {
              targets: [
                {
                  cartLine: {
                    id: line.id,
                  },
                },
              ],
            },
          });
        }
      });
    }

    // Only apply product discount if cart subtotal is $500 or more AND no Free Item is currently discounted
    if (cartSubtotal >= 500 && !hasExistingDiscount) {
      // If there are products with "Free Item" tag, find the cheapest one
      if (freeItemLines.length > 0) {
        const cheapestFreeItemLine = freeItemLines.reduce((cheapest, line) => {
          const lineAmount = parseFloat(line.cost.subtotalAmount.amount);
          const cheapestAmount = parseFloat(cheapest.cost.subtotalAmount.amount);
          return lineAmount < cheapestAmount ? line : cheapest;
        }, freeItemLines[0]);

        operations.push({
          productDiscountsAdd: {
            candidates: [
              {
                message: '100% OFF FREE ITEM',
                targets: [
                  {
                    cartLine: {
                      id: cheapestFreeItemLine.id,
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
        });
      }
    }
    // If cart subtotal is below $500, don't apply any discount
    // This effectively removes the discount when conditions are no longer met
  }

  return {
    operations,
  };
}