import {
  reactExtension,
  Banner,
  BlockStack,
  Checkbox,
  Divider,
  InlineStack,
  Progress,
  Text,
  TextField,
  useApplyAttributeChange,
  useApplyCartLinesChange,
  useCartLines,
  useDiscountCodes,
  useSettings,
  useTranslate,
  useTotalAmount,
} from '@shopify/ui-extensions-react/checkout';
import { useState } from 'react';

/**
 * Checkout UI Extension — Dynamic Offers & Shipping Progress
 *
 * Renders a block in checkout that:
 * 1. Shows a free-shipping progress bar based on cart subtotal vs threshold.
 * 2. Displays an active-discount banner when discount codes are applied.
 * 3. Offers an opt-in shipping protection checkbox (writes a cart attribute).
 * 4. Captures an order note / delivery preference via a text field.
 *
 * All text is i18n-ready via locales/en.default.json.
 * Thresholds and messaging are configured via Extension Settings in the Shopify admin.
 *
 * Security note: This extension runs in the Shopify checkout sandbox.
 * No DOM access, no external network calls, only Shopify-provided APIs.
 */
export default reactExtension('purchase.checkout.block.render', () => <CheckoutBlock />);

function CheckoutBlock() {
  const translate = useTranslate();
  const settings = useSettings();
  const cartLines = useCartLines();
  const discountCodes = useDiscountCodes();
  const totalAmount = useTotalAmount();
  const applyAttribute = useApplyAttributeChange();
  const applyCartLines = useApplyCartLinesChange();

  const [shippingProtection, setShippingProtection] = useState(false);
  const [leaveAtDoor, setLeaveAtDoor] = useState(false);
  const [orderNote, setOrderNote] = useState('');

  // --- Free Shipping Progress ---
  const freeShippingThreshold = parseFloat(settings.free_shipping_threshold ?? '75');
  const cartSubtotal = cartLines.reduce((sum, line) => {
    return sum + parseFloat(line.cost?.subtotalAmount?.amount ?? '0');
  }, 0);
  const remaining = Math.max(0, freeShippingThreshold - cartSubtotal);
  const progressPercent = Math.min(100, (cartSubtotal / freeShippingThreshold) * 100);
  const qualifiesForFreeShipping = cartSubtotal >= freeShippingThreshold;

  // --- Active Discounts ---
  const activeDiscounts = discountCodes.filter((d) => d.applicable);
  const hasActiveDiscounts = activeDiscounts.length > 0;
  const bannerMessage = settings.banner_message ?? translate('discount.banner');

  // --- Shipping Protection variant GID ---
  // In production, set this to your real shipping protection product variant GID.
  const SHIPPING_PROTECTION_VARIANT = 'gid://shopify/ProductVariant/SHIPPING_PROTECTION';
  const SHIPPING_PROTECTION_PRICE = '4.99';

  async function handleShippingProtectionToggle(checked) {
    setShippingProtection(checked);

    if (checked) {
      await applyCartLines({
        type: 'addCartLine',
        merchandiseId: SHIPPING_PROTECTION_VARIANT,
        quantity: 1,
      });
    } else {
      const protectionLine = cartLines.find(
        (l) => l.merchandise?.id === SHIPPING_PROTECTION_VARIANT,
      );
      if (protectionLine) {
        await applyCartLines({
          type: 'removeCartLine',
          id: protectionLine.id,
          quantity: protectionLine.quantity,
        });
      }
    }

    await applyAttribute({
      key: 'shipping_protection',
      value: checked ? 'true' : 'false',
    });
  }

  async function handleLeaveAtDoorToggle(checked) {
    setLeaveAtDoor(checked);
    await applyAttribute({
      key: 'leave_at_door',
      value: checked ? 'true' : 'false',
    });
  }

  async function handleNoteChange(value) {
    setOrderNote(value);
    await applyAttribute({ key: 'order_note', value });
  }

  return (
    <BlockStack spacing="base">

      {/* --- Free Shipping Progress Bar --- */}
      {!qualifiesForFreeShipping && freeShippingThreshold > 0 && (
        <BlockStack spacing="tight">
          <Text size="small" emphasis="subdued">
            {translate('freeShipping.progress', {
              remaining: `$${remaining.toFixed(2)}`,
            })}
          </Text>
          <Progress value={progressPercent} />
        </BlockStack>
      )}

      {qualifiesForFreeShipping && (
        <Banner status="success">
          <Text>{translate('freeShipping.achieved')}</Text>
        </Banner>
      )}

      {/* --- Active Discount Banner --- */}
      {hasActiveDiscounts && (
        <Banner status="info">
          <Text>{bannerMessage}</Text>
        </Banner>
      )}

      <Divider />

      {/* --- Shipping Protection --- */}
      {settings.show_shipping_protection !== false && (
        <BlockStack spacing="tight">
          <Checkbox
            id="shipping-protection"
            name="shipping-protection"
            checked={shippingProtection}
            onChange={handleShippingProtectionToggle}
          >
            <InlineStack spacing="tight">
              <Text emphasis="bold">
                {translate('shippingProtection.label')}
              </Text>
              <Text size="small" appearance="subdued">
                {translate('shippingProtection.price', {
                  price: `$${SHIPPING_PROTECTION_PRICE}`,
                })}
              </Text>
            </InlineStack>
          </Checkbox>
          <Text size="small" appearance="subdued">
            {translate('shippingProtection.description')}
          </Text>
        </BlockStack>
      )}

      <Divider />

      {/* --- Delivery Preferences --- */}
      <Checkbox
        id="leave-at-door"
        name="leave-at-door"
        checked={leaveAtDoor}
        onChange={handleLeaveAtDoorToggle}
      >
        <Text>{translate('preferences.leaveAtDoor')}</Text>
      </Checkbox>

      {/* --- Order Note --- */}
      <TextField
        id="order-note"
        label={translate('notes.label')}
        placeholder={translate('notes.placeholder')}
        value={orderNote}
        onChange={handleNoteChange}
        multiline={3}
      />

    </BlockStack>
  );
}
