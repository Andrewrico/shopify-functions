# Shopify Functions App — Production Ecosystem

A production-grade Shopify app implementing a full ecosystem of **Shopify Functions** (backend logic) and **UI Extensions** (frontend in checkout/cart/post-purchase).

---

## Architecture Overview

```
discount-product-demo/
├── shopify.app.toml                    # App config, scopes, OAuth
├── package.json                        # Root workspace (all extensions are workspaces)
│
├── extensions/
│   ├── lib/                            # Shared utilities (imported by all functions)
│   │   ├── discount-engine.js          # Monetary math, tiered discounts, filtering
│   │   └── rule-engine.js             # Condition evaluation, country/qty rules
│   │
│   ├── discount-function-free-item/    # Free item at $500+ spend (original)
│   │
│   ├── product-discount/               # Quantity + collection percentage discount
│   ├── order-discount/                 # Tiered order discounts ($100→10%, $200→20%)
│   ├── shipping-customization/         # Free shipping + hide express by country
│   ├── payment-customization/          # Hide COD + risky payment methods
│   ├── cart-checkout-validation/       # Block restricted products / tag combos
│   ├── cart-transform/                 # Bundle expand + auto free gift
│   │
│   ├── checkout-ui/                    # Checkout block: progress bar + toggles
│   ├── cart-ui/                        # Cart upsells + bundle suggestions
│   └── post-purchase/                  # Post-checkout one-click upsell
```

---

## Shopify Functions

### 1. `product-discount` — Quantity & Collection Discount
**Target:** `cart.lines.discounts.generate.run`

Applies a configurable percentage discount to cart lines when:
- Line quantity ≥ configured threshold (default: 2)
- Line belongs to the configured collection (optional — all products if unset)

**Metafields (on the discount record):**
| key | example | default |
|-----|---------|---------|
| `configuration.quantity_threshold` | `"2"` | `2` |
| `configuration.percentage` | `"20"` | `20` |
| `configuration.collection_id` | `"gid://shopify/Collection/123"` | all |
| `configuration.message` | `"Buy 2+, save 20%!"` | auto |

---

### 2. `order-discount` — Tiered Spend Discount
**Target:** `order.discounts.generate.run`

Applies tiered discounts to the entire order. Highest met tier wins.

**Metafields:**
| key | example | default |
|-----|---------|---------|
| `configuration.tiers` | `[{"threshold":100,"percentage":10},{"threshold":200,"percentage":20}]` | built-in |
| `configuration.message_template` | `"Save {{percentage}}%!"` | built-in |

---

### 3. `shipping-customization` — Free Shipping & Rate Rules
**Target:** `purchase.delivery-customization.run`

- Renames cheapest option to "Free Shipping" at $0 when cart total ≥ threshold
- Moves free shipping to position #1
- Hides express options for configured countries

**Metafields:**
| key | example | default |
|-----|---------|---------|
| `configuration.free_shipping_threshold` | `"75"` | `75` |
| `configuration.free_shipping_title` | `"Free Shipping 🎉"` | `"Free Shipping"` |
| `configuration.hidden_express_countries` | `["US","CA"]` | `[]` |
| `configuration.express_keyword` | `"Express"` | `"Express"` |

---

### 4. `payment-customization` — Payment Method Rules
**Target:** `purchase.payment-customization.run`

Hides payment methods when:
- Cart total exceeds `max_cod_amount`, OR
- Buyer country is in `cod_blocked_countries`
- Method name is in `hidden_methods` always-hide list

**Metafields:**
| key | example | default |
|-----|---------|---------|
| `configuration.hidden_methods` | `["Bank Transfer"]` | `[]` |
| `configuration.max_cod_amount` | `"500"` | `500` |
| `configuration.cod_blocked_countries` | `["US","CA"]` | `[]` |
| `configuration.cod_keyword` | `"Cash on Delivery"` | `"Cash on Delivery"` |

---

### 5. `cart-checkout-validation` — Checkout Block Rules
**Target:** `purchase.checkout.validation.run`

Returns user-facing errors blocking checkout when:
1. Products with restricted tags are in the cart
2. Any line quantity exceeds the configured maximum
3. Incompatible product tag pairs coexist in the cart
4. Age-restricted products are present for blocked countries

**Metafields:**
| key | example | default |
|-----|---------|---------|
| `configuration.restricted_tags` | `["discontinued"]` | `[]` |
| `configuration.max_quantity_per_line` | `"10"` | 0 (no limit) |
| `configuration.incompatible_tag_pairs` | `[["alcohol","fragile"]]` | `[]` |
| `configuration.age_restricted_countries` | `["NG","PK"]` | `[]` |

---

### 6. `cart-transform` — Bundle Expand & Free Gift
**Target:** `cart.transform.run`

Two transforms:
1. **Bundle expand**: Items tagged `bundle` are split into component variants with proportional pricing
2. **Free gift**: Adds a $0 gift variant when cart subtotal ≥ threshold (skips if already in cart)

**Metafields:**
| key | example | default |
|-----|---------|---------|
| `configuration.gift_threshold` | `"100"` | `100` |
| `configuration.gift_variant_id` | `"gid://shopify/ProductVariant/123"` | none |
| `configuration.bundle_tag` | `"bundle"` | `"bundle"` |
| `configuration.bundle_components` | `["gid://shopify/ProductVariant/A","gid://shopify/ProductVariant/B"]` | `[]` |

---

## UI Extensions

### 7. `checkout-ui` — Dynamic Checkout Block
**Target:** `purchase.checkout.block.render`

Renders a configurable block in checkout:
- Free shipping progress bar
- Active discount banner (when codes are applied)
- Shipping protection opt-in checkbox
- Delivery preference toggle (writes cart attribute)
- Order notes field (writes cart attribute)

---

### 8. `cart-ui` — Cart Upsells
**Target:** `purchase.cart.render-after`

Renders after the cart page:
- Free shipping progress bar
- Upsell product card (Add to Cart)
- Bundle suggestion card (shown above configured subtotal)

---

### 9. `post-purchase` — Post-Checkout Upsell
**Target:** `purchase.post.checkout.render`

Renders on the order confirmation page:
- One-click upsell (only shown when order total ≥ threshold)
- Configurable discount percentage
- Accept / Decline CTA

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Generate GraphQL schemas for each function
Each function extension needs its `schema.graphql` and `generated/api.ts` generated by the CLI:
```bash
for ext in product-discount order-discount shipping-customization payment-customization cart-checkout-validation cart-transform; do
  echo "Generating types for $ext..."
  (cd extensions/$ext && npm run typegen)
done
```

### 3. Run in dev mode (connects to your dev store)
```bash
npm run dev
```

### 4. Run unit tests
```bash
# All function extensions
for dir in extensions/*/; do
  [ -f "$dir/tests/unit.test.js" ] && (cd "$dir" && npm test -- --run)
done
```

### 5. Deploy
```bash
npm run deploy
```

---

## Activating Functions via Admin API

After deploying, create automatic discounts that use your functions:

```graphql
# 1. Create the discount
mutation {
  discountAutomaticAppCreate(automaticAppDiscount: {
    title: "Buy 2+, Save 20%",
    functionId: "<product-discount-function-id>",
    startsAt: "2026-01-01T00:00:00Z"
  }) {
    automaticAppDiscount { discountId }
  }
}

# 2. Set metafield configuration
mutation {
  metafieldsSet(metafields: [
    { ownerId: "<discountId>", namespace: "configuration", key: "quantity_threshold",
      type: "single_line_text_field", value: "2" },
    { ownerId: "<discountId>", namespace: "configuration", key: "percentage",
      type: "single_line_text_field", value: "20" }
  ]) {
    metafields { id }
  }
}
```

---

## Shared Libraries

### `extensions/lib/discount-engine.js`
- `sumCartSubtotal(lines)` — total all line subtotals
- `applyTieredDiscount(subtotal, tiers)` — highest-met-tier logic
- `filterByCollection(lines, collectionId)` — filter by GID
- `filterByTags(lines, tags)` — filter by product tags
- `findCheapestLine(lines)` / `findMostExpensiveLine(lines)`
- `percentageValue(pct)` / `fixedAmountValue(amount)` — output objects
- `metafieldNumber(field, default)` / `metafieldJsonArray(field, default)`
- `safeJsonParse(str, fallback)`

### `extensions/lib/rule-engine.js`
- `meetsMinThreshold(value, threshold)` / `belowMaxThreshold(value, max)`
- `isCountryBlocked(code, list)` / `isCountryAllowed(code, list)`
- `allConditionsMet(conditions)` / `anyConditionMet(conditions)`
- `evaluateRule(rule, context)` / `evaluateRules(rules, context)` — declarative rules
- `buildValidationError(message)` — Shopify error shape

---

## SaaS / Multi-Tenant Architecture

### Configuration isolation
All business rules live in **metafields on the discount/delivery/payment customization record** — not hardcoded. Each merchant configures their own records. One codebase, infinite configurations.

### Merchant admin UI (next step)
Build an embedded Remix app that:
1. Lists active functions and their configurations
2. Exposes forms for setting thresholds, collections, countries
3. Writes metafields via Admin GraphQL API on save
4. No redeploys needed for rule changes — metafields update in real time

### Scaling the rule engine
`rule-engine.js` accepts declarative rule arrays (`evaluateRules(rules, context)`). Store merchant rules as JSON in your database, serialize to metafields on save, and the function evaluates them at runtime. This patterns lets you build a no-code rule builder on top.

### Performance guarantees
All functions here complete in well under Shopify's 5ms budget:
- O(n) on cart lines — no nested heavy loops
- Metafields are read once into local variables
- Early exits on empty carts and wrong discount classes
- No external API calls (sandbox restriction — by design)
- No dynamic imports in hot paths

---

## Developer Resources
- [Shopify Functions API](https://shopify.dev/docs/api/functions)
- [Checkout UI Extensions](https://shopify.dev/docs/api/checkout-ui-extensions)
- [Cart Transform](https://shopify.dev/docs/api/functions/reference/cart-transform)
- [Payment Customization](https://shopify.dev/docs/api/functions/reference/payment-customization)
- [Delivery Customization](https://shopify.dev/docs/api/functions/reference/delivery-customization)
- [Checkout Validation](https://shopify.dev/docs/api/functions/reference/checkout-validation)
