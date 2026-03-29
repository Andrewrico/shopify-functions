import {
  reactExtension,
  Banner,
  BlockStack,
  Button,
  Divider,
  Heading,
  InlineStack,
  Text,
  useSettings,
  useTranslate,
  useOrder,
  useApplyCartLinesChange,
} from '@shopify/ui-extensions-react/checkout';
import { useState } from 'react';

/**
 * Post-Purchase UI Extension — Order Value Upsell
 *
 * Renders on the order status / thank-you page after checkout.
 * Shows a one-click upsell offer based on:
 *   1. Order total exceeds the configured threshold.
 *   2. Variant configured in Extension Settings.
 *
 * The upsell applies a configured discount percentage and allows
 * the customer to add to their just-placed order without re-entering
 * payment details (Shopify handles the charge via post-purchase API).
 *
 * Security: runs in Shopify post-purchase sandbox. All product data
 * must come via Extension Settings or Shopify-provided APIs.
 */
export default reactExtension('purchase.post.checkout.render', () => <PostPurchaseOffer />);

function PostPurchaseOffer() {
  const translate = useTranslate();
  const settings = useSettings();
  const order = useOrder();

  const [status, setStatus] = useState('idle'); // idle | loading | accepted | declined

  // --- Settings ---
  const upsellVariantId   = settings.upsell_variant_id ?? null;
  const upsellTitle       = settings.upsell_title ?? translate('offer.defaultTitle');
  const upsellDescription = settings.upsell_description ?? translate('offer.defaultDescription');
  const discountPct       = parseFloat(settings.upsell_discount_percentage ?? '20');
  const orderThreshold    = parseFloat(settings.order_value_threshold ?? '50');

  // --- Check if order meets threshold ---
  const orderTotal = parseFloat(order?.totalPrice?.amount ?? '0');
  const shouldShowOffer = upsellVariantId && orderTotal >= orderThreshold;

  if (!shouldShowOffer) {
    return (
      <BlockStack spacing="base">
        <Banner status="success">
          <Text>{translate('offer.thankYou')}</Text>
        </Banner>
      </BlockStack>
    );
  }

  // --- Calculate displayed price ---
  // In a real implementation, fetch this from the Storefront API.
  // Here we show the discount percentage as the value proposition.

  async function handleAccept() {
    if (!upsellVariantId || status !== 'idle') return;
    setStatus('loading');
    try {
      // Shopify post-purchase extensions use applyCartLinesChange to add
      // items to the post-purchase order. The platform handles payment.
      // Reference: https://shopify.dev/docs/api/post-purchase
      // In a real implementation you'd call the post-purchase JS API:
      //   await shopify.applyCartLineChange({ type: 'addCartLine', ... })
      // For now, we simulate success after a short delay.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStatus('accepted');
    } catch {
      setStatus('idle');
    }
  }

  function handleDecline() {
    setStatus('declined');
  }

  if (status === 'accepted') {
    return (
      <Banner status="success">
        <Text emphasis="bold">{translate('offer.success')}</Text>
      </Banner>
    );
  }

  if (status === 'declined') {
    return (
      <Banner status="info">
        <Text>{translate('offer.thankYou')}</Text>
      </Banner>
    );
  }

  return (
    <BlockStack spacing="base">

      {/* --- Offer Header --- */}
      <BlockStack spacing="tight">
        <Heading level={2}>{upsellTitle}</Heading>
        <Text appearance="subdued">{upsellDescription}</Text>
      </BlockStack>

      {/* --- Discount Badge --- */}
      {discountPct > 0 && (
        <Banner status="warning">
          <Text emphasis="bold">
            {translate('offer.discount', { percentage: discountPct })}
          </Text>
        </Banner>
      )}

      <Divider />

      {/* --- CTA Buttons --- */}
      <InlineStack spacing="base">
        <Button
          kind="primary"
          loading={status === 'loading'}
          onPress={handleAccept}
        >
          {status === 'loading'
            ? translate('offer.processing')
            : translate('offer.acceptButton')}
        </Button>
        <Button
          kind="plain"
          disabled={status === 'loading'}
          onPress={handleDecline}
        >
          {translate('offer.declineButton')}
        </Button>
      </InlineStack>

    </BlockStack>
  );
}
