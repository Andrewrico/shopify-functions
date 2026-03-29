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
 * @typedef {import("../generated/api").PaymentCustomizationInput} RunInput
 * @typedef {import("../generated/api").PaymentCustomizationRunResult} FunctionResult
 */

/**
 * Shopify Function: Payment Customization — Method Rules
 *
 * Business Rules:
 * 1. Always-hide list: hide any payment method whose name contains a configured keyword.
 * 2. COD rules: hide Cash-on-Delivery type methods if:
 *    a. Cart total exceeds maxCodAmount, OR
 *    b. Buyer country is in the codBlockedCountries list.
 * 3. Method matching is case-insensitive substring matching for flexibility.
 *
 * Configuration metafields:
 *   configuration.hidden_methods        — JSON array, e.g. ["Bank Transfer"]
 *   configuration.max_cod_amount        — number,     e.g. "500"
 *   configuration.cod_blocked_countries — JSON array, e.g. ["US", "CA"]
 *   configuration.cod_keyword           — string,     e.g. "Cash on Delivery"
 *
 * @param {RunInput} input
 * @returns {FunctionResult}
 */
export function paymentCustomizationRun(input) {
  const { cart, paymentCustomization, paymentMethods } = input;

  if (!paymentMethods?.length) return { operations: [] };

  const cartTotal          = parseAmount(cart.cost.totalAmount.amount);
  const buyerCountry       = cart.buyerIdentity?.countryCode ?? null;
  const alwaysHidden       = metafieldJsonArray(paymentCustomization.hiddenMethods, []);
  const maxCodAmount       = metafieldNumber(paymentCustomization.maxCodAmount, 500);
  const codBlockedCountries = metafieldJsonArray(paymentCustomization.codBlockedCountries, []);
  const codKeyword         = paymentCustomization.codKeyword?.value ?? 'Cash on Delivery';

  const codShouldBeHidden =
    meetsMinThreshold(cartTotal, maxCodAmount) ||
    isCountryBlocked(buyerCountry, codBlockedCountries);

  const toHide = paymentMethods.filter((method) => {
    const nameLower = method.name.toLowerCase();

    // Always-hide list (exact substring match)
    const inAlwaysHideList = alwaysHidden.some((keyword) =>
      nameLower.includes(keyword.toLowerCase()),
    );
    if (inAlwaysHideList) return true;

    // COD rule
    const isCodMethod = nameLower.includes(codKeyword.toLowerCase());
    if (isCodMethod && codShouldBeHidden) return true;

    return false;
  });

  if (!toHide.length) return { operations: [] };

  return {
    operations: toHide.map((method) => ({
      hide: { paymentMethodId: method.id },
    })),
  };
}
