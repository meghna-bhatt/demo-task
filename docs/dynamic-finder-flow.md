# Dynamic Finder Flow Document

This document explains how `sections/dynamic-finder.liquid` works in easy, step-by-step language.

## File Purpose

`dynamic-finder.liquid` prepares the Product Finder section by:

- building the filter UI (dropdowns + buttons),
- collecting product data and metafields from a selected collection,
- sending that data to JavaScript (`assets/dynamic-finder.js`) in JSON format,
- exposing editor settings via Shopify schema.

---

## End-to-End Flow

## 1) Show or Hide the Section

The file starts with:

`{% if section.settings.show_filters %}`

- If enabled: the full finder renders.
- If disabled: nothing in this section is rendered.

---

## 2) Compute Responsive Grid Columns

It reads desktop columns from setting `grid_columns_desktop` and creates:

- `gd` -> desktop columns
- `g480` -> small-screen columns (max 2)
- `g768` -> tablet columns (max 3)

These values are passed as CSS variables on the root finder container.

---

## 3) Build the Main Finder Wrapper

The section renders:

- a root `.finder` element with section id and layout class,
- heading text from `section.settings.heading`,
- data attributes like `data-dynamic-finder` for JS initialization.

Layout class changes based on:

- `results_layout == 'list'` -> list style class
- otherwise -> grid style class

---

## 4) Load Collection and Clamp Product Limit

It fetches the configured collection:

`{% assign collection = collections[section.settings.collection] %}`

Then reads `product_limit` and clamps it:

- minimum: 4
- maximum: 48

This keeps payload size controlled.

---

## 5) Generate Filter Dropdowns from Blocks

For each block in `section.blocks`:

1. Skip if `enable_filter == false`.
2. Render a `<select>` with default option = block label.
3. Loop through collection products (up to limit).
4. Read metafield using block key:
   - `product.metafields.custom[block.settings.key]`
5. Normalize value type:
   - boolean -> converted to plain text
   - list type -> joined values
   - other -> raw/default value
6. Split values by comma/semicolon, trim spaces.
7. Deduplicate values using token checks.
8. Sort values and print `<option>` tags.

Result: each filter dropdown is auto-populated from real metafield values found in products.

---

## 6) Render Filter Action Buttons

It renders two buttons:

- Apply button (`apply_button_label`)
- Clear button (`clear_button_label`)

Labels are configurable in section settings.

---

## 7) Render Result Placeholders

It renders UI placeholders that JS will update:

- result count paragraph
- empty-state paragraph (`Select filters and click Apply`)
- empty result grid container
- toast container for feedback

---

## 8) Build JSON Data for JavaScript

Inside:

`<script type="application/json" id="dynamic-finder-data-{{ section.id }}">`

the file outputs a full JSON payload with:

- `sectionId`, `showFilters`
- default/empty messages
- labels (`addToCart`, `buyNow`)
- `cardMetaFields` (all block keys + labels)
- `filters` (enabled filters only)
- `products` array

Each product entry includes:

- basic product info (`id`, `title`, `url`, `image`, `price`)
- option metadata (`option_names`)
- full variant list (ids, options, availability, price, image)
- mapped `metafields` object for each configured block key

This is the main bridge between Liquid and frontend JS logic.

---

## 9) Include JavaScript Asset Once

At the bottom:

`{% unless dynamic_finder_js_included %}`

it includes `dynamic-finder.js` only once, even if section appears multiple times.

---

## 10) Define Theme Editor Schema

`{% schema %}` defines all merchant-configurable options:

- collection picker
- heading
- product limit
- show/hide section
- result layout (grid/list)
- desktop grid columns
- button labels

Block schema (`type: filter`) defines:

- show/hide per dropdown
- filter label
- metafield key (`custom` namespace)

---

## “Functions” in This File

This Liquid file does not define JavaScript functions directly.
Its logic is built with Liquid control structures:

- `assign` -> variable creation
- `if / elsif / unless` -> conditional flow
- `for` -> iteration over blocks/products/variants

Interactive behavior is handled by `assets/dynamic-finder.js`, which reads the JSON created here.

---

## Quick Mental Model

`dynamic-finder.liquid` is a data-preparation and UI-shell file:

1. Build filter controls and placeholders in HTML.
2. Collect product + metafield data from Shopify objects.
3. Pass all data to JS as JSON.
4. Let `dynamic-finder.js` handle filtering, rendering, cart actions, and user interaction.
