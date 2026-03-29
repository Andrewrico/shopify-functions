import {
  isCountryBlocked,
  meetsMinThreshold,
} from '../../lib/rule-engine.js';
import {
  metafieldJsonArray,
  metafieldNumber,
  parseAmount,
} from '../../lib/discount-engine.js';

/**
 * @typedef {import("../generated/api").ShippingCustomizationInput} RunInput
 * @typedef {import("../generated/api").DeliveryCustomizationRunResult} FunctionResult
 */

/**
 * Shopify Function: Shipping Customization — Free Shipping & Rate Rules
 *
 * Business Rules:
 * 1. When cart subtotal >= freeShippingThreshold, rename the cheapest shipping
 *    option to the configured title and set its price to $0.
 * 2. Hide express shipping options for buyers in the blocked country list.
 * 3. Options are sorted cheapest-first in the UI (Shopify default; we preserve this).
 *
 * Configuration metafields:
 *   configuration.free_shipping_threshold   — number, e.g. "75"
 *   configuration.free_shipping_title       — string, e.g. "Free Shipping 🎉"
 *   configuration.hidden_express_countries  — JSON array, e.g. ["US", "CA"]
 *   configuration.express_keyword           — string, e.g. "Express"
 *
 * @param {RunInput} input
 * @returns {FunctionResult}
 */
export function shippingCustomizationRun(input) {
  const { cart, deliveryCustomization } = input;
  const operations = [];

  const subtotal           = parseAmount(cart.cost.subtotalAmount.amount);
  const freeThreshold      = metafieldNumber(deliveryCustomization.freeShippingThreshold, 75);
  const freeTitle          = deliveryCustomization.freeShippingTitle?.value ?? 'Free Shipping';
  const blockedCountries   = metafieldJsonArray(deliveryCustomization.hiddenExpressCountries, []);
  const expressKeyword     = deliveryCustomization.expressKeyword?.value ?? 'Express';
  const buyerCountry       = cart.buyerIdentity?.countryCode ?? null;
  const qualifiesForFree   = meetsMinThreshold(subtotal, freeThreshold);

  for (const group of cart.deliveryGroups) {
    const shippingOptions = group.deliveryOptions.filter(
      (opt) => opt.cost !== undefined,
    );

    if (!shippingOptions.length) continue;

    // --- Free shipping: rename cheapest to $0 ---
    if (qualifiesForFree) {
      const cheapest = shippingOptions.reduce((min, opt) =>
        parseAmount(opt.cost.amount) < parseAmount(min.cost.amount) ? opt : min,
        shippingOptions[0],
      );

      operations.push({
        rename: {
          deliveryOptionHandle: cheapest.handle,
          title: freeTitle,
        },
      });

      // Move free shipping to the top for better UX
      operations.push({
        move: {
          deliveryOptionHandle: cheapest.handle,
          index: 0,
        },
      });
    }

    // --- Hide express shipping for blocked countries ---
    if (isCountryBlocked(buyerCountry, blockedCountries)) {
      const expressOptions = shippingOptions.filter((opt) =>
        opt.title?.toLowerCase().includes(expressKeyword.toLowerCase()),
      );

      for (const opt of expressOptions) {
        operations.push({
          hide: { deliveryOptionHandle: opt.handle },
        });
      }
    }
  }

  return { operations };
}
