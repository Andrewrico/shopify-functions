/**
 * Rule Engine — Condition evaluation utilities for Shopify Functions
 *
 * Provides a composable way to evaluate business rules against cart/order
 * context. Used by discount, shipping, payment, and validation functions.
 */

/**
 * Check if a numeric value meets a minimum threshold.
 * @param {number} value
 * @param {number} threshold
 * @returns {boolean}
 */
export function meetsMinThreshold(value, threshold) {
  return value >= threshold;
}

/**
 * Check if a numeric value is below a maximum threshold.
 * @param {number} value
 * @param {number} max
 * @returns {boolean}
 */
export function belowMaxThreshold(value, max) {
  return value < max;
}

/**
 * Check if a country code is in the blocked list.
 * @param {string | null | undefined} countryCode
 * @param {string[]} blockedCountries
 * @returns {boolean}
 */
export function isCountryBlocked(countryCode, blockedCountries) {
  if (!countryCode || !blockedCountries?.length) return false;
  return blockedCountries.includes(countryCode.toUpperCase());
}

/**
 * Check if a country code is in the allowed list.
 * If allowedCountries is empty, all countries are allowed.
 * @param {string | null | undefined} countryCode
 * @param {string[]} allowedCountries
 * @returns {boolean}
 */
export function isCountryAllowed(countryCode, allowedCountries) {
  if (!allowedCountries?.length) return true;
  if (!countryCode) return false;
  return allowedCountries.includes(countryCode.toUpperCase());
}

/**
 * Evaluate an array of conditions with AND logic.
 * Each condition is a boolean. Returns true only if all conditions pass.
 * @param {boolean[]} conditions
 * @returns {boolean}
 */
export function allConditionsMet(conditions) {
  return conditions.every(Boolean);
}

/**
 * Evaluate an array of conditions with OR logic.
 * Returns true if any condition passes.
 * @param {boolean[]} conditions
 * @returns {boolean}
 */
export function anyConditionMet(conditions) {
  return conditions.some(Boolean);
}

/**
 * Build a structured rule object for declarative evaluation.
 * @param {string} field - e.g. 'cartSubtotal', 'country', 'quantity'
 * @param {'gte' | 'lte' | 'eq' | 'in' | 'notIn'} operator
 * @param {*} value - comparison value
 * @returns {{ field: string, operator: string, value: * }}
 */
export function rule(field, operator, value) {
  return { field, operator, value };
}

/**
 * Evaluate a single rule against a context object.
 * @param {{ field: string, operator: string, value: * }} r
 * @param {Record<string, *>} context - e.g. { cartSubtotal: 150, country: 'US' }
 * @returns {boolean}
 */
export function evaluateRule(r, context) {
  const actual = context[r.field];
  switch (r.operator) {
    case 'gte': return actual >= r.value;
    case 'lte': return actual <= r.value;
    case 'lt':  return actual < r.value;
    case 'gt':  return actual > r.value;
    case 'eq':  return actual === r.value;
    case 'neq': return actual !== r.value;
    case 'in':  return Array.isArray(r.value) && r.value.includes(actual);
    case 'notIn': return Array.isArray(r.value) && !r.value.includes(actual);
    default: return false;
  }
}

/**
 * Evaluate an array of rules (AND logic) against a context.
 * @param {Array<{ field: string, operator: string, value: * }>} rules
 * @param {Record<string, *>} context
 * @returns {boolean}
 */
export function evaluateRules(rules, context) {
  return rules.every((r) => evaluateRule(r, context));
}

/**
 * Build a Shopify checkout validation error object.
 * @param {string} message - User-facing error message
 * @param {string | null} [localizedMessage] - Localized fallback
 * @returns {{ localizedMessage: string }}
 */
export function buildValidationError(message, localizedMessage = null) {
  return { localizedMessage: localizedMessage ?? message };
}

/**
 * Deduplicate an array of strings (e.g. error messages).
 * @param {string[]} arr
 * @returns {string[]}
 */
export function deduplicateStrings(arr) {
  return [...new Set(arr)];
}
