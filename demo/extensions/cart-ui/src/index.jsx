import {
  reactExtension,
  Banner,
  BlockStack,
  Button,
  Divider,
  InlineStack,
  Progress,
  Text,
  View,
  useApplyCartLinesChange,
  useCartLines,
  useSettings,
  useTranslate,
} from '@shopify/ui-extensions-react/checkout';
import { useState } from 'react';

/**
 * Cart UI Extension — Upsells & Bundle Suggestions
 *
 * Renders after the cart on the cart page.
 * Features:
 * 1. Upsell card: suggests a single configured product variant with Add to Cart.
 * 2. Bundle suggestion: shown when subtotal passes a threshold.
 * 3. Free shipping progress bar driven by cart subtotal.
 *
 * All product variant IDs and copy are configured via Extension Settings
 * in the Shopify admin, keeping the code store-agnostic.
 */
export default reactExtension('purchase.cart.render-after', () => <CartUpsells />);

function CartUpsells() {
  const translate = useTranslate();
  const settings = useSettings();
  const cartLines = useCartLines();
  const applyCartLines = useApplyCartLinesChange();

  const [upsellAdded, setUpsellAdded] = useState(false);
  const [upsellLoading, setUpsellLoading] = useState(false);

  // --- Cart subtotal ---
  const subtotal = cartLines.reduce((sum, line) => {
    return sum + parseFloat(line.cost?.subtotalAmount?.amount ?? '0');
  }, 0);

  // --- Settings ---
  const upsellVariantId   = settings.upsell_variant_id ?? null;
  const upsellTitle       = settings.upsell_title ?? 'You might also like';
  const upsellDescription = settings.upsell_description ?? '';
  const upsellPrice       = parseFloat(settings.upsell_price ?? '0');
  const bundleThreshold   = parseFloat(settings.bundle_threshold ?? '50');
  const freeShippingThreshold = 75; // Sync with checkout-ui and shipping function

  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const progressPercent = Math.min(100, (subtotal / freeShippingThreshold) * 100);
  const qualifiesForFreeShipping = subtotal >= freeShippingThreshold;
  const showBundleSuggestion = subtotal >= bundleThreshold;

  // Check if upsell is already in cart
  const upsellAlreadyInCart = upsellVariantId
    ? cartLines.some((l) => l.merchandise?.id === upsellVariantId)
    : false;

  async function handleAddUpsell() {
    if (!upsellVariantId || upsellAdded || upsellAlreadyInCart) return;
    setUpsellLoading(true);
    try {
      await applyCartLines({
        type: 'addCartLine',
        merchandiseId: upsellVariantId,
        quantity: 1,
      });
      setUpsellAdded(true);
    } finally {
      setUpsellLoading(false);
    }
  }

  return (
    <BlockStack spacing="base">

      {/* --- Free Shipping Progress --- */}
      {!qualifiesForFreeShipping && (
        <BlockStack spacing="tight">
          <Text size="small" appearance="subdued">
            {translate('freeShipping.progress', {
              remaining: `$${remaining.toFixed(2)}`,
            })}
          </Text>
          <Progress value={progressPercent} />
        </BlockStack>
      )}

      {qualifiesForFreeShipping && (
        <Banner status="success">
          <Text>{translate('freeShipping.unlocked')}</Text>
        </Banner>
      )}

      <Divider />

      {/* --- Upsell Card --- */}
      {upsellVariantId && !upsellAlreadyInCart && (
        <View border="base" padding="base" borderRadius="base">
          <BlockStack spacing="base">
            <Text size="medium" emphasis="bold">
              {translate('upsell.heading')}
            </Text>
            <InlineStack spacing="base" blockAlignment="center">
              <BlockStack spacing="extraTight" inlineSize="fill">
                <Text emphasis="bold">{upsellTitle}</Text>
                {upsellDescription ? (
                  <Text size="small" appearance="subdued">{upsellDescription}</Text>
                ) : null}
                {upsellPrice > 0 && (
                  <Text size="small">${upsellPrice.toFixed(2)}</Text>
                )}
              </BlockStack>
              <Button
                kind="secondary"
                loading={upsellLoading}
                disabled={upsellAdded}
                onPress={handleAddUpsell}
              >
                {upsellAdded
                  ? translate('upsell.added')
                  : translate('upsell.addButton')}
              </Button>
            </InlineStack>
          </BlockStack>
        </View>
      )}

      {/* --- Bundle Suggestion --- */}
      {showBundleSuggestion && (
        <View border="base" padding="base" borderRadius="base">
          <BlockStack spacing="tight">
            <Text size="medium" emphasis="bold">
              {translate('bundle.heading')}
            </Text>
            <Text size="small" appearance="subdued">
              {translate('bundle.description')}
            </Text>
          </BlockStack>
        </View>
      )}

    </BlockStack>
  );
}
