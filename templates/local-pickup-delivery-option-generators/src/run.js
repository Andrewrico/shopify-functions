// @ts-check

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const configuration = JSON.parse(
    input?.deliveryOptionGenerator?.metafield?.value ?? "{}"
  );

  return {
    operations: [
      {
        add: {
          title: "Main St.",
          cost: 1.99,
          pickupLocation: {
            locationHandle: "2578303",
            pickupInstruction: "Usually ready in 24 hours."
          }
        }
      }
    ],
  };
}