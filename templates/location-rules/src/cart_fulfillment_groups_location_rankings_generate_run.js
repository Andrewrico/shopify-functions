// @ts-check

/**
 * @typedef {import("../generated/api").CartFulfillmentGroupsLocationRankingsGenerateRunInput} CartFulfillmentGroupsLocationRankingsGenerateRunInput
 * @typedef {import("../generated/api").CartFulfillmentGroupsLocationRankingsGenerateRunResult} CartFulfillmentGroupsLocationRankingsGenerateRunResult
 */

/**
 * @param {CartFulfillmentGroupsLocationRankingsGenerateRunInput} input
 * @returns {CartFulfillmentGroupsLocationRankingsGenerateRunResult}
 */
export function cartFulfillmentGroupsLocationRankingsGenerateRun(input) {
  const operations = input.fulfillmentGroups.map((group) => {
    const rankings = group.inventoryLocationHandles?.map((inventoryLocationHandle) => ({
      locationHandle: inventoryLocationHandle,
      rank: 0,
    })) || [];

    return {
      fulfillmentGroupLocationRankingAdd: {
        fulfillmentGroupHandle: group.handle,
        rankings,
      },
    };
  });

  return {operations};
};