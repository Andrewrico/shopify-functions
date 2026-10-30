# shopify-functions

Starter code for every Shopify Function type, plus a working example, kept up to date automatically.

## What's here

| Folder | What |
|---|---|
| `templates/<type>/` | JavaScript starter for each Function type (discount, product/order/shipping discounts, discounts allocator, cart transform, cart & checkout validation, delivery customization, payment customization, fulfillment constraints, fulfillment option generators, local pickup / pickup point option generators, location rules). Each has `src/`, `schema.graphql`, `shopify.extension.toml` and fixture tests. |
| `discount-product-demo/` | A complete app: free-item discount at a $500 cart subtotal, with tests. |

## Use a template

Copy a folder into the `extensions/` directory of a Shopify app and run `shopify app function typegen`, then `npm test`.

```sh
cp -R templates/cart-transform my-app/extensions/cart-transform
```

## Auto-update

- **Weekly template sync** (`.github/workflows/sync-templates.yml`, Mondays 09:00 UTC): regenerates `templates/` from Shopify's CLI templates. If anything changed it opens a PR (or an issue with a compare link if Actions can't create PRs). Never pushes to `main`. The upstream commit is recorded in `templates/UPSTREAM`.
- **Dependabot**: npm dependencies (root, each template, the demo) and GitHub Actions, weekly.
- **CI**: every PR builds each template with the Shopify CLI and runs its fixture tests.

Run the sync yourself with `npm install && npm run sync`; test with `npm test` (or `bash scripts/test-templates.sh templates/discount`).

The sync is one-way: it reads Shopify's public repo and never writes to it. See [NOTICE.md](NOTICE.md) for attribution.
