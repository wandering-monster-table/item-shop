# D&D Equipment Shop — Development Plan

A local-first web application for browsing D&D equipment, building an equipment cart, and exporting purchases as Markdown.

## Project Goals

* [ ] Run entirely locally with no LLM, external API, or online query dependency.
* [ ] Use local JSON files as the equipment database.
* [ ] Support toggleable datasets from the beginning.
* [ ] Provide a fast, responsive, modern interface.
* [ ] Support desktop and mobile layouts.
* [ ] Maintain the project in a private GitHub repository.
* [ ] Include a lightweight Python web server for development/local hosting.
* [ ] Keep deployment possible on a normal static web server.

---

## Milestone 1 — Project & Development Environment

### GitHub

* [ ] Create private GitHub repository.
* [ ] Clone repository to Windows development machine.
* [ ] Establish initial Git workflow.
* [ ] Create `.gitignore`.
* [ ] Create initial `README.md`.

### VS Code / Python

* [ ] Install/configure VS Code.
* [ ] Install Python.
* [ ] Create development web server.
* [ ] Verify application can be served locally.
* [ ] Document local startup procedure.

### Initial structure

```text
dnd-equipment-shop/
├── index.html
├── README.md
├── DEVELOPMENT.md
├── .gitignore
├── server.py
├── css/
├── js/
├── data/
└── assets/
```

**Deliverable:** Empty application successfully running from `localhost`.

---

## Milestone 2 — SRD Data Pipeline

### Source inspection

* [ ] Obtain the 5.2 SRD Markdown source.
* [ ] Identify equipment-related sections.
* [ ] Examine tables and individual item entries.
* [ ] Identify unusual/exceptional entries.
* [ ] Determine how costs and weights are represented.

### Data schema

* [ ] Define universal item ID format.
* [ ] Define item name.
* [ ] Define dataset/source.
* [ ] Define category.
* [ ] Define type.
* [ ] Define rarity.
* [ ] Define description.
* [ ] Define `cost_cp`.
* [ ] Define `weight_lb`.
* [ ] Define optional item-specific properties.

### Conversion

* [ ] Create Markdown → JSON conversion script.
* [ ] Normalize prices to copper pieces.
* [ ] Normalize weights to numeric pounds.
* [ ] Generate `equipment.json`.
* [ ] Manually inspect converted records.
* [ ] Correct parser exceptions.
* [ ] Validate generated JSON.

**Deliverable:** Clean, normalized 5.2 SRD equipment dataset.

---

## Milestone 3 — Dataset System

* [ ] Create dataset configuration/index.
* [ ] Define dataset metadata schema.
* [ ] Load datasets dynamically.
* [ ] Associate each item with its dataset.
* [ ] Build dataset selector.
* [ ] Ensure application can support multiple datasets without application-code changes.

**Deliverable:** Application successfully loads the 5.2 SRD through the generic dataset system.

---

## Milestone 4 — Equipment Browser

### Interface

* [ ] Create main application layout.
* [ ] Create equipment list.
* [ ] Create expandable item details.
* [ ] Add search field.
* [ ] Add Add-to-Cart controls.

### Filtering

* [ ] Dataset filter.
* [ ] Category filter.
* [ ] Type filter.
* [ ] Rarity filter.
* [ ] Cost filter.
* [ ] Weight filter.
* [ ] Combine filters using AND logic.
* [ ] Handle empty results.

### Sorting

* [ ] Name A–Z.
* [ ] Name Z–A.
* [ ] Cost low–high.
* [ ] Cost high–low.
* [ ] Weight low–high.
* [ ] Weight high–low.

**Deliverable:** Fully functional equipment browser.

---

## Milestone 5 — Shopping Cart

* [ ] Add items to cart.
* [ ] Increase/decrease quantities.
* [ ] Direct quantity editing.
* [ ] Remove individual items.
* [ ] Clear cart.
* [ ] Calculate total cost from `cost_cp`.
* [ ] Calculate total weight.
* [ ] Persist cart with `localStorage`.

### Responsive cart

* [ ] Always-visible desktop cart.
* [ ] Mobile cart button.
* [ ] Mobile cart drawer/modal.
* [ ] Display item quantities.
* [ ] Display total cost.
* [ ] Display total weight.

**Deliverable:** Functional equipment shopping cart.

---

## Milestone 6 — Purchase & Markdown Export

* [ ] Add Purchase button.
* [ ] Create purchase confirmation modal.
* [ ] Generate Markdown equipment list.
* [ ] Include quantities.
* [ ] Include total GP/SP/CP cost.
* [ ] Include total weight.
* [ ] Copy generated Markdown to clipboard.
* [ ] Confirm successful clipboard operation.
* [ ] Clear cart after confirmed purchase.
* [ ] Close purchase modal.

**Deliverable:** Complete browse → cart → purchase → clipboard workflow.

---

## Milestone 7 — MVP Polish & Release

* [ ] Responsive layout testing.
* [ ] Mobile browser testing.
* [ ] Desktop browser testing.
* [ ] Keyboard navigation.
* [ ] Accessibility review.
* [ ] Empty/error states.
* [ ] Clipboard fallback/error handling.
* [ ] JSON/data validation.
* [ ] Performance testing with full equipment dataset.
* [ ] Clean up CSS/JavaScript.
* [ ] Update README.
* [ ] Document local development server.
* [ ] Commit and push final MVP.
* [ ] Tag MVP release as `v1.0`.

---

# Post-MVP Backlog

These features should **not** complicate the MVP implementation.

## Customization

* [ ] Custom item dataset.
* [ ] Add/edit/delete custom items.
* [ ] Item restrictions.
* [ ] Percentage-based shop markup.

## Magic Items

* [ ] Add magic-item dataset.
* [ ] Handle items without defined prices.
* [ ] Optional estimated prices.
* [ ] Manual price entry.
* [ ] Optional estimated-price toggle.

## Multiple SRDs

* [ ] Add additional SRD datasets.
* [ ] Dataset enable/disable controls.
* [ ] Dataset-specific metadata and attribution.
* [ ] Resolve duplicate item IDs across datasets.

## Merchant / Selling System

* [ ] Define merchant purchasing rules.
* [ ] Rarity restrictions.
* [ ] Maximum purchase price.
* [ ] Percentage of listed value.
* [ ] Generate sale offer.
* [ ] Export sale transaction as Markdown.

## Images

* [ ] Define image metadata in item schema.
* [ ] Identify public-domain/freely licensed sources.
* [ ] Add local image assets.
* [ ] Optional image display.

## Backend

Only if future requirements justify it:

* [ ] Evaluate need for server-side persistence.
* [ ] Evaluate database requirements.
* [ ] Evaluate custom-item management interface.
* [ ] Evaluate saved shops/campaigns/inventories.
