import { describe, test, expect } from 'vitest';
import { checkoutValidationRun } from '../src/checkout_validation_run.js';

function makeLine(id, quantity, tags = []) {
  return {
    id,
    quantity,
    merchandise: {
      id: `gid://shopify/ProductVariant/${id}`,
      title: `Variant ${id}`,
      product: {
        id: `gid://shopify/Product/${id}`,
        title: `Product ${id}`,
        tags,
        vendor: 'Test Vendor',
      },
    },
  };
}

function makeInput({
  lines,
  restrictedTags = [],
  maxQty = 0,
  incompatiblePairs = [],
  ageRestrictedCountries = [],
  country = null,
}) {
  return {
    cart: {
      lines,
      buyerIdentity: country ? { countryCode: country } : null,
    },
    validation: {
      restrictedTags: restrictedTags.length ? { value: JSON.stringify(restrictedTags) } : null,
      maxQuantityPerLine: maxQty > 0 ? { value: String(maxQty) } : null,
      incompatibleTagPairs: incompatiblePairs.length
        ? { value: JSON.stringify(incompatiblePairs) }
        : null,
      ageRestrictedCountries: ageRestrictedCountries.length
        ? { value: JSON.stringify(ageRestrictedCountries) }
        : null,
    },
  };
}

describe('checkoutValidationRun', () => {
  test('returns no errors for clean cart', () => {
    const result = checkoutValidationRun(makeInput({ lines: [makeLine('1', 1, [])] }));
    expect(result.errors).toEqual([]);
  });

  test('returns no errors for empty cart', () => {
    const result = checkoutValidationRun(makeInput({ lines: [] }));
    expect(result.errors).toEqual([]);
  });

  test('blocks restricted product by tag', () => {
    const lines = [makeLine('1', 1, ['restricted'])];
    const result = checkoutValidationRun(makeInput({ lines, restrictedTags: ['restricted'] }));
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].localizedMessage).toContain('restricted');
  });

  test('does not block non-restricted products', () => {
    const lines = [makeLine('1', 1, ['sale', 'new-arrival'])];
    const result = checkoutValidationRun(makeInput({ lines, restrictedTags: ['restricted'] }));
    expect(result.errors).toEqual([]);
  });

  test('blocks when quantity exceeds max', () => {
    const lines = [makeLine('1', 15, [])];
    const result = checkoutValidationRun(makeInput({ lines, maxQty: 10 }));
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].localizedMessage).toContain('10');
  });

  test('allows quantity exactly at max', () => {
    const lines = [makeLine('1', 10, [])];
    const result = checkoutValidationRun(makeInput({ lines, maxQty: 10 }));
    expect(result.errors).toEqual([]);
  });

  test('does not enforce max when maxQty is 0', () => {
    const lines = [makeLine('1', 999, [])];
    const result = checkoutValidationRun(makeInput({ lines, maxQty: 0 }));
    expect(result.errors).toEqual([]);
  });

  test('blocks incompatible tag pairs', () => {
    const lines = [
      makeLine('1', 1, ['alcohol']),
      makeLine('2', 1, ['fragile']),
    ];
    const result = checkoutValidationRun(
      makeInput({ lines, incompatiblePairs: [['alcohol', 'fragile']] }),
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].localizedMessage).toContain('alcohol');
  });

  test('does not block compatible products', () => {
    const lines = [makeLine('1', 1, ['electronics']), makeLine('2', 1, ['clothing'])];
    const result = checkoutValidationRun(
      makeInput({ lines, incompatiblePairs: [['alcohol', 'fragile']] }),
    );
    expect(result.errors).toEqual([]);
  });

  test('blocks age-restricted products for blocked countries', () => {
    const lines = [makeLine('1', 1, ['age-restricted'])];
    const result = checkoutValidationRun(
      makeInput({ lines, ageRestrictedCountries: ['NG'], country: 'NG' }),
    );
    expect(result.errors).toHaveLength(1);
  });

  test('allows age-restricted products for allowed countries', () => {
    const lines = [makeLine('1', 1, ['age-restricted'])];
    const result = checkoutValidationRun(
      makeInput({ lines, ageRestrictedCountries: ['NG'], country: 'US' }),
    );
    expect(result.errors).toEqual([]);
  });

  test('deduplicates identical errors', () => {
    // Same product ID repeated as two lines produces the same error message — dedup removes the duplicate.
    const sameLine = makeLine('99', 1, ['restricted']);
    const result = checkoutValidationRun(
      makeInput({ lines: [sameLine, { ...sameLine, id: 'line-99b' }], restrictedTags: ['restricted'] }),
    );
    // Both lines reference the same product title → identical message → deduplicated to 1
    expect(result.errors).toHaveLength(1);
  });

  test('returns separate errors for different restricted products', () => {
    const lines = [makeLine('1', 1, ['restricted']), makeLine('2', 1, ['restricted'])];
    const result = checkoutValidationRun(makeInput({ lines, restrictedTags: ['restricted'] }));
    // Different product titles → different messages → 2 errors
    expect(result.errors).toHaveLength(2);
  });
});
