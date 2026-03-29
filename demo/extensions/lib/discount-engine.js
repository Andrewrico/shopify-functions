/**
 * Discount Engine — Reusable discount calculation utilities
 *
 * Used across all Shopify Function extensions that apply discounts.
 * All monetary values are treated as strings (Shopify's Money scalar)
 * and converted to floats for comparison.
 */

/**
 * Parse a Shopify Money amount string to a float.
 * @param {string | number} amount
 * @returns {number}
 */
export function parseAmount(amount) {
  return parseFloat(amount ?? '0');
}

/**
 * Sum the subtotal of all cart lines.
 * @param {Array<{cost: {subtotalAmount: {amount: string}}}>} lines
 * @returns {number}
 */
export function sumCartSubtotal(lines) {
  return lines.reduce((total, line) => {
    return total + parseAmount(line.cost?.subtotalAmount?.amount);
  }, 0);
}

/**
 * Sum the cost per quantity (unit price) of a line.
 * @param {{cost: {amountPerQuantity: {amount: string}}}} line
 * @returns {number}
 */
export function unitPrice(line) {
  return parseAmount(line.cost?.amountPerQuantity?.amount);
}

/**
 * Find the cheapest line by unit price.
 * @param {Array} lines
 * @returns {object | null}
 */
export function findCheapestLine(lines) {
  if (!lines.length) return null;
  return lines.reduce((cheapest, line) => {
    return unitPrice(line) < unitPrice(cheapest) ? line : cheapest;
  }, lines[0]);
}

/**
 * Find the most expensive line by unit price.
 * @param {Array} lines
 * @returns {object | null}
 */
export function findMostExpensiveLine(lines) {
  if (!lines.length) return null;
  return lines.reduce((most, line) => {
    return unitPrice(line) > unitPrice(most) ? line : most;
  }, lines[0]);
}

/**
 * Filter cart lines to those belonging to a specific collection.
 * @param {Array} lines
 * @param {string} collectionId - Shopify GID of the collection
 * @returns {Array}
 */
export function filterByCollection(lines, collectionId) {
  if (!collectionId) return lines;
  return lines.filter((line) => {
    const collections = line.merchandise?.product?.collections?.nodes ?? [];
    return collections.some((c) => c.id === collectionId);
  });
}

/**
 * Filter cart lines that have any of the given product tags.
 * @param {Array} lines
 * @param {string[]} tags
 * @returns {Array}
 */
export function filterByTags(lines, tags) {
  if (!tags?.length) return [];
  return lines.filter((line) => {
    const productTags = line.merchandise?.product?.tags ?? [];
    return tags.some((tag) => productTags.includes(tag));
  });
}

/**
 * Evaluate tiered discounts — highest met tier wins.
 * @param {number} subtotal
 * @param {Array<{threshold: number, percentage: number}>} tiers
 * @returns {number | null}
 */
export function applyTieredDiscount(subtotal, tiers) {
  if (!tiers?.length) return null;
  const sorted = [...tiers].sort((a, b) => b.threshold - a.threshold);
  for (const tier of sorted) {
    if (subtotal >= tier.threshold) return tier.percentage;
  }
  return null;
}

/**
 * Build a percentage discount value object for Shopify Functions output.
 * @param {number} percentage - 0-100
 */
export function percentageValue(percentage) {
  return { percentage: { value: percentage } };
}

/**
 * Build a fixed-amount discount value object.
 * @param {string | number} amount
 */
export function fixedAmountValue(amount) {
  return { fixedAmount: { amount: String(amount) } };
}

/**
 * Safe JSON parse with a fallback.
 * @param {string | null | undefined} str
 * @param {*} fallback
 */
export function safeJsonParse(str, fallback = null) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Read a metafield value as a number.
 * @param {{ value: string } | null | undefined} metafield
 * @param {number} defaultValue
 */
export function metafieldNumber(metafield, defaultValue = 0) {
  if (!metafield?.value) return defaultValue;
  const parsed = parseFloat(metafield.value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Read a metafield value as a JSON array.
 * @param {{ value: string } | null | undefined} metafield
 * @param {Array} defaultValue
 */
export function metafieldJsonArray(metafield, defaultValue = []) {
  return safeJsonParse(metafield?.value, defaultValue);
}
