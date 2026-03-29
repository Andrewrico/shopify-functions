import { isCountryBlocked } from '../../lib/rule-engine.js';
import { metafieldJsonArray, metafieldNumber } from '../../lib/discount-engine.js';

/**
 * @typedef {import("../generated/api").CheckoutValidationInput} RunInput
 * @typedef {import("../generated/api").CheckoutValidationRunResult} FunctionResult
 */

/**
 * Shopify Function: Cart & Checkout Validation
 *
 * Validation rules (all checked in order; multiple errors can be returned):
 * 1. Restricted-tag check: any product with a configured restricted tag blocks checkout.
 * 2. Quantity limit: any line item exceeding max_quantity_per_line is rejected.
 * 3. Incompatible-pair check: if both tags in a pair exist in the cart, block checkout.
 * 4. Age-restricted check: products tagged "age-restricted" block checkout for specific countries.
 *
 * Configuration metafields:
 *   configuration.restricted_tags           — JSON array, e.g. ["discontinued", "restricted"]
 *   configuration.max_quantity_per_line      — number,     e.g. "10"
 *   configuration.incompatible_tag_pairs     — JSON array, e.g. [["alcohol","fragile"]]
 *   configuration.age_restricted_countries   — JSON array, e.g. ["NG", "PK"]
 *
 * @param {RunInput} input
 * @returns {FunctionResult}
 */
export function checkoutValidationRun(input) {
  const { cart, validation } = input;
  const errors = [];

  if (!cart.lines.length) return { errors };

  const restrictedTags       = metafieldJsonArray(validation.restrictedTags, []);
  const maxQty               = metafieldNumber(validation.maxQuantityPerLine, 0); // 0 = no limit
  const incompatiblePairs    = metafieldJsonArray(validation.incompatibleTagPairs, []);
  const ageRestrictedCountries = metafieldJsonArray(validation.ageRestrictedCountries, []);
  const buyerCountry         = cart.buyerIdentity?.countryCode ?? null;

  // Collect all tags present in the cart (flattened)
  const cartTagSet = new Set();
  for (const line of cart.lines) {
    const tags = line.merchandise?.product?.tags ?? [];
    tags.forEach((t) => cartTagSet.add(t));
  }

  for (const line of cart.lines) {
    const product  = line.merchandise?.product;
    const tags     = product?.tags ?? [];
    const varTitle = line.merchandise?.title ?? 'item';
    const prodTitle = product?.title ?? 'product';

    // --- Rule 1: Restricted tag ---
    const blockedTag = tags.find((t) => restrictedTags.includes(t));
    if (blockedTag) {
      errors.push({
        localizedMessage: `"${prodTitle}" cannot be purchased. It is marked as restricted.`,
        target: 'cart',
      });
    }

    // --- Rule 2: Quantity limit ---
    if (maxQty > 0 && line.quantity > maxQty) {
      errors.push({
        localizedMessage: `You can only add up to ${maxQty} of "${prodTitle}" per order. Please reduce the quantity.`,
        target: 'cart.lines',
      });
    }

    // --- Rule 4: Age-restricted country ---
    if (tags.includes('age-restricted') && isCountryBlocked(buyerCountry, ageRestrictedCountries)) {
      errors.push({
        localizedMessage: `"${prodTitle}" is not available for delivery to your country.`,
        target: 'cart',
      });
    }
  }

  // --- Rule 3: Incompatible tag pairs (cart-level) ---
  for (const [tagA, tagB] of incompatiblePairs) {
    if (cartTagSet.has(tagA) && cartTagSet.has(tagB)) {
      errors.push({
        localizedMessage: `Products tagged "${tagA}" and "${tagB}" cannot be purchased together. Please remove one.`,
        target: 'cart',
      });
    }
  }

  // Deduplicate errors by message
  const seen = new Set();
  const uniqueErrors = errors.filter((e) => {
    if (seen.has(e.localizedMessage)) return false;
    seen.add(e.localizedMessage);
    return true;
  });

  return { errors: uniqueErrors };
}
