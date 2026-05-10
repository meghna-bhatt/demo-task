# Dynamic Product Finder Developer Interview Notes

This document explains `sections/dynamic-finder.liquid` in detail so a developer can confidently explain the task in an interview, even if they did not build the feature from scratch.

The section is a custom Shopify product finder. It lets a merchant configure filters based on product metafields, then lets a customer select filter values and click **Apply Filters** to see matching products.

## What Was Built

We built a Shopify section named **Dynamic Product Finder**.

The section does these things:

- Lets the merchant select a product collection in the theme editor.
- Lets the merchant add multiple filter blocks.
- Each filter block maps to a product metafield key, for example `scenario`, `power_supply`, or `ai_tracking`.
- Reads product metafield values from the selected collection.
- Builds dropdown options dynamically from product metafield values.
- Shows no products by default.
- Shows products only after the customer clicks **Apply Filters**.
- Applies filters using AND logic.
- Lets the customer add a matched product to cart or buy it now.

Example user flow:

1. Merchant selects a collection in the section settings.
2. Merchant adds filter blocks:
   - Label: `Scenario`, key: `scenario`
   - Label: `Power Supply`, key: `power_supply`
3. Customer selects:
   - `scenario = indoor`
   - `power_supply = battery`
4. Customer clicks **Apply Filters**.
5. Only products where both metafields match are displayed.

## File Location

Main file:

```text
sections/dynamic-finder.liquid
```

Developer notes file:

```text
DYNAMIC_FINDER_DEVELOPER_NOTES.md
```

## Main Technologies Used

- **Shopify Liquid**: renders HTML, reads collections, products, variants, and metafields.
- **Shopify section schema**: makes the section configurable in the theme editor.
- **JavaScript**: handles filtering, rendering products, clearing filters, and cart actions.
- **Shopify AJAX Cart API**: uses `/cart/add.js` to add variants to cart.

## Important Shopify Concepts

### Section

A Shopify section is a reusable theme component. It can have settings and blocks.

In this file, the section is configurable through the `{% schema %}` block at the bottom.

### Section Settings

Settings are global to the section. This section has:

- `collection`: the collection used as product source.
- `heading`: heading text shown at the top.
- `product_limit`: maximum number of products to load from the collection.

### Blocks

Blocks are repeatable child settings. In this section, each block is one filter dropdown.

Each filter block has:

- `label`: what the customer sees as the dropdown placeholder.
- `key`: the custom product metafield key to filter by.

### Product Metafields

The code reads custom product metafields from:

```liquid
product.metafields.custom[block.settings.key]
```

This is dynamic because `block.settings.key` is entered by the merchant.

If the merchant enters `scenario`, Shopify reads:

```liquid
product.metafields.custom.scenario
```

If the merchant enters `power_supply`, Shopify reads:

```liquid
product.metafields.custom.power_supply
```

## Section Structure

The file has these main parts:

1. HTML wrapper and heading.
2. Collection assignment.
3. Filter dropdown rendering.
4. Apply/Clear buttons.
5. Results container.
6. Product data generated into JavaScript.
7. JavaScript functions for filtering and cart actions.
8. CSS styling.
9. Shopify section schema.

## Top-Level Wrapper

```liquid
<div class="finder finder-{{ section.id }}">
```

The `finder` class is used for shared styling.

The `finder-{{ section.id }}` class makes this section instance unique.

Why this matters:

- A merchant can add the same section multiple times.
- `section.id` prevents styles or JavaScript selectors from accidentally targeting the wrong section.

## Heading

```liquid
<h2>{{ section.settings.heading }}</h2>
```

The heading comes from the theme editor setting named `heading`.

If the merchant changes the heading in Shopify admin, this value updates automatically.

## Collection Assignment

```liquid
{% assign collection = collections[section.settings.collection] %}
```

This line gets the selected collection from Shopify.

`section.settings.collection` stores the collection handle selected in the theme editor.

`collections[...]` retrieves the actual collection object.

The collection is used for:

- building dropdown options
- building product data for JavaScript

## Filter Dropdown Loop

```liquid
{% for block in section.blocks %}
```

This loop creates one dropdown per filter block.

If the merchant adds three filter blocks, the section renders three dropdowns.

Each dropdown uses:

```liquid
<select id="filter-{{ section.id }}-{{ block.id }}">
```

Why both `section.id` and `block.id` are used:

- `section.id` identifies the section instance.
- `block.id` identifies the specific filter block.
- Together they create a unique HTML ID.

This helps JavaScript find the exact dropdown later.

## Dropdown Placeholder

```liquid
<option value="">{{ block.settings.label }}</option>
```

This first option is empty.

It acts like a placeholder such as:

- `Scenario`
- `Power Supply`
- `AI Tracking`

If this option is selected, that filter is not active.

## Collecting Unique Dropdown Options

The code starts with:

```liquid
{% assign option_values = '|' %}
```

This stores option values as a single string separated by pipe characters.

Example:

```text
|indoor|outdoor|battery|
```

The pipe delimiter helps check duplicates safely.

Without delimiters, checking if a string contains another string can create false matches. For example, `door` is inside `indoor`. With pipes, the code checks `|door|` versus `|indoor|`, so they are treated as different values.

## Looping Through Products For Dropdown Values

```liquid
{% for product in collection.products limit: section.settings.product_limit %}
```

This loops through products in the selected collection.

`product_limit` prevents loading too many products into the section.

Important interview point:

This approach is suitable for a controlled collection size. For very large catalogs, a more scalable approach would use Shopify Search & Discovery, collection filtering, tags, or an app/backend API.

## Reading Dynamic Metafield Values

```liquid
{% assign mf = product.metafields.custom[block.settings.key] %}
```

This reads a metafield dynamically based on the filter block key.

The benefit:

- The code does not hardcode `scenario`, `resolution`, `power_supply`, etc.
- The merchant can configure any custom metafield key in the theme editor.

## Why `mf != nil` Is Used

```liquid
{% if mf != nil %}
```

This is important.

Earlier versions used `mf != blank`, but that can drop boolean `false` values.

Example:

- Product A: `ai_tracking = true`
- Product B: `ai_tracking = false`

If we use `blank`, Liquid may treat `false` like an empty value and skip it.

Using `nil` means:

- skip only when the metafield does not exist
- keep real values like `false`

Interview explanation:

“We used `mf != nil` because boolean false is a valid filter value. We did not want Shopify Liquid to treat it as blank and remove it from dropdown options.”

## Handling Boolean Metafields

```liquid
{% if mf.type == 'boolean' %}
  {% assign raw_values = mf.value | json | replace: '"', '' %}
```

Boolean metafields need explicit handling.

`mf.value` can be true or false.

Using `json` converts it into a safe string representation.

Then `replace: '"', ''` removes quotes if needed.

The result becomes:

```text
true
```

or:

```text
false
```

This lets the dropdown show both `true` and `false`.

## Handling List Metafields

```liquid
{% elsif mf.type contains 'list.' %}
  {% assign raw_values = mf.value | join: ',' %}
```

Shopify metafields can be list types.

For example:

```text
["indoor", "home"]
```

The code joins list values into:

```text
indoor,home
```

Then the same splitting logic can handle it.

## Handling Normal Metafields

```liquid
{% assign raw_values = mf.value | default: mf %}
```

For normal text-like metafields, this uses `mf.value`.

The fallback `default: mf` exists because metafield behavior can vary depending on metafield type and Shopify Liquid object behavior.

## Splitting Multiple Values

```liquid
{% assign pieces = raw_values | replace: ';', ',' | split: ',' %}
```

This supports values separated by commas or semicolons.

Examples:

```text
indoor,home
```

```text
indoor;home
```

Both become:

```text
indoor
home
```

Why this is helpful:

- Some admins may enter comma-separated values manually.
- Some metafields may store list-like values.
- The UI can treat them as multiple filter options.

## Cleaning Each Option

```liquid
{% assign option_text = piece | strip %}
```

`strip` removes leading and trailing whitespace.

Example:

```text
" battery "
```

becomes:

```text
"battery"
```

This avoids duplicate-looking values like `battery` and ` battery`.

## Avoiding Duplicate Options

```liquid
{% assign option_token = '|' | append: option_text | append: '|' %}
{% unless option_values contains option_token %}
  {% assign option_values = option_values | append: option_text | append: '|' %}
{% endunless %}
```

This prevents the same dropdown option from appearing multiple times.

For example, if five products have `scenario = indoor`, the dropdown should show `indoor` only once.

## Rendering Dropdown Options

```liquid
{% assign options = option_values | split: '|' | sort %}
```

This splits the pipe-delimited string into an array and sorts it.

Then:

```liquid
<option value="{{ option | escape }}">{{ option | escape }}</option>
```

`escape` prevents HTML issues if a metafield value contains special characters.

## Apply And Clear Buttons

```liquid
<button class="btn" id="apply-{{ section.id }}" type="button">Apply Filters</button>
<button class="btn clear" id="clear-{{ section.id }}" type="button">Clear</button>
```

These buttons use IDs instead of inline JavaScript.

Why:

- Cleaner JavaScript.
- Easier to bind event listeners.
- Avoids problems with invalid function names generated from `section.id`.

The `type="button"` prevents accidental form submission if the section is ever placed inside a form.

## Result Count And Empty State

```liquid
<p id="result-count-{{ section.id }}"></p>
<p id="empty-state-{{ section.id }}">Use filters to find products</p>
```

The result count shows messages like:

```text
3 product(s) found
```

The empty state tells users what to do before products are shown.

## Results Grid

```liquid
<div id="results-{{ section.id }}" class="results-grid"></div>
```

Products are rendered here by JavaScript after the user applies filters.

By default, this grid is empty.

## Toast Container

```liquid
<div id="toast-{{ section.id }}" class="toast"></div>
```

This is used to show short messages like:

- `Added to cart`
- `Invalid variant`
- `Cannot add this product`

## Product Data Script

The file creates product data for JavaScript:

```liquid
window["productData_{{ section.id }}"] = [...]
```

Why bracket notation is used:

Shopify section IDs can look like:

```text
template--21718638690537__dynamic_finder_CTUheV
```

This is not safe as part of a JavaScript variable name.

Bad:

```js
window.productDatatemplate--21718638690537__dynamic_finder_CTUheV
```

This can create syntax errors because `--` is treated like a decrement operator and underscores can be interpreted oddly in numeric contexts.

Good:

```js
window["productData_template--21718638690537__dynamic_finder_CTUheV"]
```

Bracket notation treats the whole value as a string key.

## Product Object Structure

Each product is stored like this:

```js
{
  id: 123456789,
  title: "Product title",
  image: "image-url",
  price: "$99.00",
  metafields: {
    scenario: "indoor",
    power_supply: "battery"
  }
}
```

The exact metafield keys depend on the filter blocks configured in Shopify admin.

## Variant ID

```liquid
id: {{ product.selected_or_first_available_variant.id | default: product.variants.first.id | json }}
```

This line is critical for cart functionality.

Shopify AJAX cart requires a **variant ID**, not:

- product ID
- section ID
- handle
- SKU

If the wrong value is sent, Shopify returns:

```text
422 Cannot find variant
```

The code uses `selected_or_first_available_variant.id` and falls back to the first variant ID.

## Why `| json` Is Used

`| json` outputs safe JavaScript values.

Example:

```liquid
{{ product.title | json }}
```

would output:

```js
"Camera \"Pro\""
```

In this file, `json` is especially important for IDs and dynamic keys because it avoids broken JavaScript syntax.

## Dynamic Metafield Object

Inside each product object:

```liquid
metafields: {
  {% for block in section.blocks %}
    {{ block.settings.key | json }}: {{ meta_value | json }}
  {% endfor %}
}
```

This means JavaScript receives only the metafields needed for configured filters.

If the merchant configures filters for `scenario` and `power_supply`, the object contains:

```js
metafields: {
  "scenario": "indoor",
  "power_supply": "battery"
}
```

## Local Data Variable

```js
const data = window["productData_{{ section.id }}"] || [];
```

This reads the product data from the safe window key.

If no data exists, it falls back to an empty array.

## JavaScript IIFE

```js
(() => {
  // code
})();
```

IIFE means Immediately Invoked Function Expression.

Why it is used:

- Keeps variables local.
- Avoids polluting the global browser scope.
- Prevents conflicts if the section is added multiple times.

## Section ID In JavaScript

```js
const sectionId = {{ section.id | json }};
```

This gives JavaScript access to the section ID as a string.

It is used for:

- finding Apply button
- finding Clear button
- finding toast container

Using `| json` prevents syntax errors.

## `getMeta(p, key)`

Purpose:

Safely read one metafield value from a product object.

Logic:

```js
if (!p || !p.metafields) return "";
```

This prevents errors if product data is missing.

```js
const val = p.metafields[key];
```

Reads the dynamic metafield.

```js
if (val === false) return "false";
if (val === true) return "true";
```

This preserves boolean values.

```js
return val ? val.toString().trim() : "";
```

For normal values, convert to string and trim whitespace.

Interview answer:

“This helper normalizes metafield values so the filter logic can compare everything as strings.”

## `getMetaValues(p, key)`

Purpose:

Convert one metafield into an array of filter values.

Example:

```text
indoor,home
```

becomes:

```js
["indoor", "home"]
```

Code:

```js
return getMeta(p, key)
  .split(/[;,]/)
  .map(value => value.trim())
  .filter(Boolean);
```

This supports comma and semicolon-separated values.

## `getUniqueValues(key)`

Purpose:

Find all unique option values for one metafield key from product data.

Process:

1. Start with an empty array.
2. Loop through every product.
3. Get that product's values for the key.
4. Add valid values.
5. Return a unique array using `Set`.

Code concept:

```js
return [...new Set(values)];
```

This removes duplicates.

## `populateFilters()`

Purpose:

Add missing options to dropdowns using JavaScript product data.

Even though Liquid already renders options, this acts as an additional frontend population step.

Important detail:

Each block is wrapped in:

```js
{
  const select = ...
  const key = ...
}
```

Why:

Liquid expands the loop into repeated JavaScript code. Without block scoping, repeated `const key` declarations can cause:

```text
Identifier 'key' has already been declared
```

The `{ ... }` creates a new scope for each filter block.

## `applyFilters()`

Purpose:

Read selected dropdown values and show matching products.

Step 1: Create empty active filter list.

```js
const activeFilters = [];
```

Step 2: For each filter block, read selected dropdown value.

```js
document.getElementById("filter-{{ section.id }}-{{ block.id }}")?.value || ""
```

The optional chaining `?.` prevents errors if the dropdown is missing.

Step 3: Add selected filters only.

If the dropdown is empty, it is ignored.

Step 4: Filter products using AND logic.

```js
activeFilters.every(filter => getMetaValues(p, filter.key).includes(filter.value))
```

This means every selected filter must match.

Interview explanation:

“We used `every()` because the requirement was to show products that match all selected filters, such as `scenario = indoor` AND `power_supply = battery`.”

## AND Versus OR Filtering

Current behavior is AND.

Example product:

```js
{
  scenario: "indoor",
  power_supply: "battery"
}
```

Selected filters:

```text
scenario = indoor
power_supply = battery
```

This product matches.

If product has:

```text
scenario = indoor
power_supply = wired
```

It does not match because one selected filter is different.

If we wanted OR filtering, we would use `some()` instead of `every()`.

## `clearFilters()`

Purpose:

Reset dropdowns and remove displayed products.

It sets each dropdown value to:

```js
""
```

Then:

```js
render([]);
updateCount(0);
```

This is intentional because products should not show by default or after clearing.

## `updateCount(count)`

Purpose:

Update the result count text.

Example:

```text
2 product(s) found
```

If count is 0:

```text
0 product(s) found
```

## `render(products)`

Purpose:

Render product cards into the results grid.

If there are no products:

```js
container.innerHTML = "";
empty.style.display = "block";
return;
```

This clears results and shows the empty message.

If products exist:

```js
empty.style.display = "none";
```

Then product cards are created using `products.map(...)`.

Each card includes:

- image
- title
- price
- Add to Cart button
- Buy Now button

## Add To Cart Button

Rendered button:

```js
addToCart('${p.id}')
```

Only `p.id` is passed.

This was an important fix.

Earlier, the button passed both section ID and product ID. A bug caused the section ID to be sent as the cart item ID, resulting in:

```text
422 Cannot find variant
```

Now only the variant ID is passed.

## `addToCart(variantId)`

Purpose:

Add the selected product variant to the cart.

Current function:

```js
const ok = await addVariant(variantId);
if (!ok) return;
showToast(sectionId, "Added to cart");
```

It is intentionally short.

It delegates the shared cart request logic to `addVariant()`.

## `buyNow(variantId)`

Purpose:

Add variant to cart, then send user to checkout.

Current function:

```js
const ok = await addVariant(variantId);
if (!ok) return;
window.location.href = "/checkout";
```

It only redirects if the product was successfully added.

## `addVariant(variantId)`

Purpose:

Shared helper for both Add to Cart and Buy Now.

It does four things:

1. Converts variant ID to number.
2. Validates the ID.
3. Sends `/cart/add.js` request.
4. Returns success or failure.

Validation:

```js
const id = Number(variantId);
if (!Number.isFinite(id) || id <= 0) {
  showToast(sectionId, "Invalid variant");
  return false;
}
```

Why:

Shopify cart API requires a valid numeric variant ID.

Request:

```js
fetch('/cart/add.js', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ id, quantity: 1 })
});
```

If Shopify rejects the request:

```js
if (!res.ok) {
  showToast(sectionId, "Cannot add this product");
  return false;
}
```

This handles cases where:

- variant does not exist
- variant is unavailable
- product cannot be purchased

## `showToast(sectionId, msg)`

Purpose:

Show temporary feedback to the user.

It finds:

```js
document.getElementById("toast-" + sectionId)
```

Then updates text and opacity.

After 2 seconds:

```js
setTimeout(() => toast.style.opacity = 0, 2000);
```

## `initFinder()`

Purpose:

Initialize the section after page load.

It checks if product data exists.

Then:

```js
populateFilters();
render([]);
updateCount(0);
```

Products are intentionally not shown on initial page load.

Interview explanation:

“The requirement was that no product should show by default. So we initialize filters but render an empty result grid until the user applies filters.”

## `bindButtons()`

Purpose:

Attach click events to Apply and Clear buttons.

```js
const applyBtn = document.getElementById("apply-" + sectionId);
const clearBtn = document.getElementById("clear-" + sectionId);
```

Then:

```js
applyBtn.addEventListener("click", applyFilters);
clearBtn.addEventListener("click", clearFilters);
```

This avoids inline event handlers for Apply/Clear and keeps behavior section scoped.

## DOMContentLoaded Handling

```js
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bindButtons();
    initFinder();
  });
} else {
  bindButtons();
  initFinder();
}
```

This ensures the code works whether the script runs before or after the DOM is ready.

If DOM is still loading, wait.

If DOM is already loaded, initialize immediately.

## CSS Overview

Main styles:

- `.finder`: centers the section and controls max width.
- `.dropdowns`: lays dropdowns in a flexible row.
- `select`: controls dropdown spacing and minimum width.
- `.results-grid`: responsive product card grid.
- `.card`: simple bordered product card.
- `.btn`: shared button styles.
- `.btn.buy`: green buy-now button.
- `.toast`: fixed center-screen feedback message.

The CSS is intentionally simple and section-specific.

## Schema Details

The schema starts with:

```liquid
{% schema %}
```

The section name is:

```json
"name": "Dynamic Product Finder"
```

This is what appears in Shopify theme editor.

### Collection Setting

```json
{
  "type": "collection",
  "id": "collection",
  "label": "Select Collection"
}
```

This lets the merchant choose which products are used by the finder.

### Heading Setting

```json
{
  "type": "text",
  "id": "heading",
  "label": "Heading",
  "default": "Find Your Product"
}
```

This controls the title displayed above filters.

### Product Limit Setting

```json
{
  "type": "range",
  "id": "product_limit",
  "min": 4,
  "max": 100,
  "step": 4,
  "default": 24
}
```

This controls how many products are loaded from the collection.

Why this exists:

- Avoid loading too many products.
- Gives merchant control over performance.

### Filter Block

```json
{
  "type": "filter",
  "name": "Filter"
}
```

Each filter block creates one dropdown.

### Filter Label

```json
{
  "type": "text",
  "id": "label",
  "label": "Filter Label",
  "default": "Scenario"
}
```

This is displayed as the first dropdown option.

### Product Metafield Key

```json
{
  "type": "text",
  "id": "key",
  "label": "Product Metafield Key"
}
```

This is where the merchant enters the custom metafield key.

Important:

Only the key is entered, not the full namespace.

Correct:

```text
scenario
```

Incorrect:

```text
custom.scenario
```

because the code already reads from `product.metafields.custom`.

## Bugs Fixed During Development

### Empty Dropdown Options

Problem:

Dropdowns were rendering, but options like `indoor` and `battery` were missing.

Fix:

Liquid now loops through products and extracts metafield values for each configured filter key.

### Boolean `false` Missing

Problem:

`ai_tracking = false` was not appearing.

Cause:

`false` can be treated as blank.

Fix:

Use `mf != nil` and explicitly handle boolean metafields.

### Invalid JavaScript From Section IDs

Problem:

Browser errors happened because Shopify section IDs contain characters like `--` and `__`.

Cause:

Code tried to create variable names using `section.id`.

Fix:

Use bracket notation:

```js
window["productData_{{ section.id }}"]
```

### Duplicate `const key`

Problem:

Browser error:

```text
Identifier 'key' has already been declared
```

Cause:

Liquid expanded the same `const key` line multiple times in the same JS scope.

Fix:

Wrap each block's generated JS in `{ ... }`.

### Apply Filter Not Working

Problem:

Clicking Apply did not filter products.

Causes:

- invalid JS function names generated with `section.id`
- inline handler issues
- script parse errors

Fix:

- Use safe local function names.
- Bind Apply/Clear buttons with `addEventListener`.
- Keep filtering logic inside a scoped IIFE.

### Products Showing By Default

Problem:

Products were visible before applying filters.

Requirement:

Products should show only after Apply Filters.

Fix:

On init:

```js
render([]);
updateCount(0);
```

### Cart Error: Cannot Find Variant

Problem:

Shopify returned:

```text
422 Cannot find variant
```

Cause:

Wrong value was being sent to `/cart/add.js`, such as the section ID instead of variant ID.

Fix:

- Product data stores a real variant ID.
- Cart buttons pass only `p.id`.
- `addVariant()` validates and sends numeric variant ID.

## How To Explain The Whole Feature In An Interview

Short version:

“I built a Shopify dynamic product finder section. The merchant chooses a collection and configures filter blocks using product metafield keys. Liquid reads those metafield values and builds dropdown options. JavaScript stores product data, applies AND-based filtering when the user clicks Apply Filters, renders matching product cards, and uses Shopify AJAX cart API to add selected variants to cart.”

More detailed version:

“The main challenge was bridging Shopify Liquid and JavaScript safely. Product data and metafields are only available server-side in Liquid, so I serialized the needed product data into a JavaScript array. Then I used JavaScript for client-side filtering. I had to handle metafield edge cases like booleans, list values, duplicate dropdown options, and Shopify section IDs that are unsafe as JS variable names. I also ensured cart actions send numeric variant IDs because Shopify AJAX cart does not accept product IDs or section IDs.”

## Interview Questions And Suggested Answers

### Why did you use product metafields?

Metafields let merchants store custom product attributes like scenario, power supply, resolution, or AI tracking. They are more flexible than hardcoded product tags when the filtering requirements are custom.

### Why is the metafield key a text input?

Because the merchant may create any custom metafield in Shopify admin. A text input avoids hardcoding a fixed list of keys in the theme.

### Why use `product.metafields.custom[block.settings.key]`?

Because the key is dynamic. Dot notation works only for known keys, but bracket notation lets us read whatever key the merchant configured.

### Why check `mf != nil` instead of `mf != blank`?

Because `false` is a valid boolean metafield value. `blank` can exclude false-like values, but `nil` only checks whether the metafield exists.

### Why split by comma and semicolon?

Some metafields or admin-entered values may contain multiple values like `indoor,home` or `indoor;home`. Splitting lets one product match multiple filter options.

### Why use `every()` in filtering?

Because selected filters should all match. If a user selects scenario and power supply, a product must match both. `every()` implements AND logic.

### What would you use for OR logic?

I would use `some()` instead of `every()`.

### Why no products by default?

That was a UX requirement. The finder should show products only after the user chooses filters and clicks Apply.

### Why use `window["productData_{{ section.id }}"]`?

Shopify section IDs can contain characters that are invalid in JavaScript identifiers. Bracket notation safely stores data under a string key.

### Why wrap JavaScript in an IIFE?

To avoid leaking variables globally and to reduce conflicts if multiple instances of the section exist.

### Why not use inline `onclick` for Apply/Clear?

Apply and Clear are permanent section controls, so binding them with `addEventListener` is cleaner and safer. It also avoids invalid dynamic function names.

### Why do product card buttons still use inline onclick?

Those buttons are generated dynamically inside `innerHTML`. Inline calls are a simple approach here. A more scalable approach would be event delegation.

### Why send variant ID, not product ID?

Shopify AJAX cart requires variant IDs. Products can have multiple variants, and cart lines are variant-based.

### What does `422 Cannot find variant` mean?

It means Shopify could not find the variant ID sent to `/cart/add.js`. Usually the wrong ID type was sent, or the variant is unavailable/invalid.

### What does `addVariant()` return?

It returns `true` if Shopify accepts the cart request, otherwise `false`. This lets `addToCart` and `buyNow` stay simple.

### How would you improve this for a large catalog?

I would avoid loading many products into JavaScript. For larger catalogs, I would use Shopify native filters, Search & Discovery, collection filters, tags, predictive search, or a backend/search API.

### How would you avoid inline onclick in product cards?

I would add `data-variant-id` attributes to buttons and use event delegation on the results container.

### How would you make comparisons case-insensitive?

Normalize both selected value and product metafield values using `.toLowerCase()` before comparing.

### How would you update mini cart count instantly?

After a successful `/cart/add.js`, fetch `/cart.js` and update the cart count element, or dispatch the theme-specific cart refresh event if the theme supports one.

## Important Code Review Points

- `section.id` must not be used directly in JavaScript variable names.
- Cart payload must contain a valid numeric variant ID.
- Boolean metafields need special handling.
- Dynamic Liquid-generated JavaScript must avoid duplicate `const` declarations in the same scope.
- Initial render intentionally shows no products.
- Filtering uses AND logic through `every()`.

## Possible Limitations

- This is client-side filtering, so it works best with a limited number of loaded products.
- It only reads products available in `collection.products` up to `product_limit`.
- It assumes custom metafields are in the `custom` namespace.
- It renders product cards with simple HTML instead of using Shopify product card snippets.
- It does not currently normalize case during matching, so values should be consistent.

## Suggested Interview Closing Statement

“This task taught me how to combine Shopify Liquid and JavaScript carefully. Liquid prepares the data from Shopify, and JavaScript handles user interaction. The most important parts were safely serializing dynamic data, handling metafield edge cases, avoiding JavaScript errors from Shopify section IDs, and ensuring cart actions send real variant IDs.”

