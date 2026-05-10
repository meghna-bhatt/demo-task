# Product Recommendation Section

This theme includes a Shopify product recommendation/filter section named **Dynamic Product Finder**. It helps shoppers choose products from a selected collection by filtering product cards with Shopify product metafields.

## What It Does

- Shows configurable filter dropdowns, such as Scenario, Resolution, Power Source, or AI Tracking.
- Reads dropdown options from product metafields in the `custom` namespace.
- Filters products only after the shopper clicks **Apply Filters**.
- Shows the matched product count and a no-match message when nothing is found.
- Renders responsive product cards with image, title, price, selected metafield details, and variant information.
- Supports grid or list result layouts.
- Supports interactive variant selectors when changing a variant changes price or image.
- Provides **Add to Cart** and **Buy Now** actions using Shopify cart APIs.
- Updates the cart count and shows loading/toast feedback during cart actions.

## Frontend Flow

The section is rendered by `sections/dynamic-finder.liquid`.

1. Shopify Liquid loads the selected collection and product limit.
2. Each filter block creates one dropdown.
3. Dropdown values are generated from matching product metafields.
4. Product, variant, price, image, URL, and metafield data are written into a JSON script tag.
5. `assets/dynamic-finder.js` reads that JSON when the page loads.
6. The JavaScript applies selected filters, renders result cards, manages variant changes, and handles cart actions.

The section also re-initializes in the Shopify theme editor after a section reload.

## Shopify Admin Setup

1. Create the product metafields in Shopify Admin:
   - Go to **Settings > Custom data > Products**.
   - Add metafields under the `custom` namespace.
   - Example keys: `scenario`, `resolution`, `power_source`, `ai_tracking`.

2. Add values to each product:
   - Open each product in Shopify Admin.
   - Fill the metafields used by the finder.
   - Multiple values can be stored as list metafields, or as comma/semicolon-separated text.

3. Create or choose a collection:
   - Add all products that should appear in the finder.
   - The section only filters products from this selected collection.

4. Add the section in the theme editor:
   - Go to **Online Store > Themes > Customize**.
   - Add **Dynamic Product Finder** to the desired template/page.
   - Select the collection.
   - Set the heading, product limit, result layout, grid columns, and button labels.

5. Add filter blocks:
   - Add one **Filter** block for each dropdown.
   - Set the label shown to shoppers.
   - Set the metafield key only, without the namespace.
   - Example: use `scenario`, not `custom.scenario`.

## Files

- `sections/dynamic-finder.liquid` - section markup, schema settings, filter blocks, and embedded product JSON.
- `assets/dynamic-finder.js` - frontend filtering, rendering, variants, cart, and buy-now logic.
- `assets/theme.css` - styling for finder layout, product cards, buttons, cart feedback, and responsive behavior.

## Notes

- Product limit is capped between 4 and 48 products to keep the page lightweight.
- Filters are matched case-insensitively.
- A product must match all selected filters to appear in the results.
- Products need valid variants for Add to Cart and Buy Now to work correctly.

