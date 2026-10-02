import { loadDatasetIndex, loadDataset } from "./data.js";
import {
    loadCart,
    getCart,
    addToCart,
    decreaseCartQuantity,
    setCartQuantity,
    clearCart,
    getCartItemCount,
    getCartTotal,
    getCartWeight
} from "./cart.js";

const DATASET_STORAGE_KEY = "dnd-equipment-shop-dataset";
const SETTINGS_STORAGE_KEY = "dnd-equipment-shop-settings";
const MAGIC_ITEM_PRICES_STORAGE_KEY =
    "dnd-equipment-shop-magic-item-prices";
const TRANSACTIONS_STORAGE_KEY =
    "dnd-equipment-shop-transactions";

const MAGIC_ITEM_PRICE_RANGES = {
    Common:      [25,50,90],
    Uncommon:    [150,500,900],
    Rare:        [1500,5000,9000],
    "Very Rare": [15000,50000,90000],
    Legendary:   [150000,500000,900000],
    Artifact: null
};



const state = {
    datasets: [],
    currentDataset: null,
    items: [],
    expandedItems: new Set(),

    settings: {
        magicItems: false,
        magicItemPricing: "disabled"
    },

    magicItemPrices: {},
    transactions: [],

    sort: {
        field: "name",
        direction: "asc"
    },

    filters: {
        search: "",
        categories: new Set(),
        rarities: new Set(),
        costMin: null,
        costMax: null,
        weightMin: null,
        weightMax: null
    }
};

function getItemPrice(item) {
    if (item.rarity === null) {
        return item.cost_cp;
    }

    switch (state.settings.magicItemPricing) {
        case "disabled":
            return null;

        case "average":
            return getRarityPrice(item.rarity);

        case "random":
            return getMagicItemPrice(item);

        default:
            return null;
    }
}

function getRarityPrice(rarity) {
    const range =
        MAGIC_ITEM_PRICE_RANGES[rarity];

    if (!range) {
        return null;
    }

    return range[1] * 100;
}

function loadMagicItemPrices() {
    const saved =
        getStorage(MAGIC_ITEM_PRICES_STORAGE_KEY);

    if (!saved) return;

    try {
        const parsed = JSON.parse(saved);

        if (!parsed || typeof parsed !== "object") {
            return;
        }

        for (const [itemId, price] of Object.entries(parsed)) {
            if (
                typeof itemId === "string" &&
                typeof price === "number" &&
                Number.isInteger(price) &&
                price >= 0
            ) {
                state.magicItemPrices[itemId] = price;
            }
        }
    } catch {
        // Ignore invalid saved prices.
    }
}

function getMagicItemPrice(item) {
    const existingPrice =
        state.magicItemPrices[item.item_id];

    if (typeof existingPrice === "number") {
        return existingPrice;
    }

    const range =
        MAGIC_ITEM_PRICE_RANGES[item.rarity];

    if (!range) {
        return null;
    }

    const [minimum, , maximum] = range;

    const priceGP =
        Math.floor(
            Math.random() * (maximum - minimum + 1)
        ) + minimum;

    let priceCP = 0;
    if (priceGP < 1000) {
        priceCP = priceGP * 100;
    } else if (priceGP < 10000) {
        priceCP = Math.round(priceGP / 10) * 1000;
    } else if (priceGP < 100000) {
        priceCP = Math.round(priceGP / 100) * 10000;
    } else {
        priceCP = Math.round(priceGP / 1000) * 100000;
    }
        
    state.magicItemPrices[item.item_id] =
        priceCP;

    saveMagicItemPrices();

    return priceCP;
}

function saveMagicItemPrices() {
    setStorage(
        MAGIC_ITEM_PRICES_STORAGE_KEY,
        JSON.stringify(state.magicItemPrices)
    );
}

function saveTransactions() {
    setStorage(
        TRANSACTIONS_STORAGE_KEY,
        JSON.stringify(state.transactions)
    );
}

function loadTransactions() {
    const saved =
        getStorage(TRANSACTIONS_STORAGE_KEY);

    if (!saved) return;

    try {
        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed)) {
            return;
        }

        state.transactions = parsed.filter(
            transaction =>
                transaction &&
                typeof transaction === "object" &&
                typeof transaction.id === "string" &&
                typeof transaction.datetime === "string" &&
                typeof transaction.markdown === "string"
        );
    } catch {
        // Ignore invalid saved transactions.
    }
}

// =========================================================
// DOM
// =========================================================

const $ = selector => document.querySelector(selector);

const searchInput = $("#search-input");

const categoryButton = $("#category-button");
const categoryLabel = $("#category-label");
const categoryMenu = $("#category-menu");
const categoryOptions = $("#category-options");

const costMinInput = $("#cost-min");
const costMaxInput = $("#cost-max");

const weightMinInput = $("#weight-min");
const weightMaxInput = $("#weight-max");

const rarityOptions = $("#rarity-options");
const rarityFilter = $("#rarity-filter");

const resetFiltersButton = $("#reset-filters");

const moreFiltersButton = $("#more-filters-button");
const moreFilters = $("#more-filters");

const datasetSelect = $("#dataset-select");
const magicItemsToggle = $("#magic-items-toggle");
const magicItemPricing = $("#magic-item-pricing");

const equipmentList = $("#equipment-list");
const status = $("#status");

const settingsButton = $("#settings-button");
const settingsMenu = $("#settings-menu");

const sortButtons = document.querySelectorAll(".table-sort-button");

const cartBackdrop = $("#cart-backdrop");
const cartButton = $("#cart-button");
const cartCounter = $("#cart-counter");
const cartClose = $("#cart-close");
const cartElement = $(".cart");
const cartItems = $("#cart-items");
const cartCount = $("#cart-count");
const cartCost = $("#cart-cost");
const cartWeight = $("#cart-weight");

const emptyCartButton = $("#empty-cart");
const emptyCartModal = $("#empty-cart-modal");
const emptyCartModalMessage = $("#empty-cart-modal-message");
const emptyCartModalClose = $("#empty-cart-modal-close");
const emptyCartCancel = $("#empty-cart-cancel");
const emptyCartConfirm = $("#empty-cart-confirm");

const purchaseButton = $("#purchase-button");
const purchaseModal = $("#purchase-modal");
const purchaseSummary = $("#purchase-summary");
const purchaseModalClose = $("#purchase-modal-close");
const purchaseCancel = $("#purchase-cancel");
const purchaseConfirm = $("#purchase-confirm");


// =========================================================
// Initialization
// =========================================================

async function init() {
    loadSettings();
    updateSettingsControls();
    loadMagicItemPrices();
    loadTransactions();
    loadCart();

    setupSettings();
    setupFilters();
    setupSorting();
    setupMoreFilters();
    setupCartActions();

    try {
        state.datasets = await loadDatasetIndex();
        populateDatasetSelect();

        const savedId = getStorage(DATASET_STORAGE_KEY);

        const dataset =
            state.datasets.find(item => item.id === savedId) ||
            state.datasets[0];

        if (!dataset) {
            throw new Error("No enabled datasets were found.");
        }

        datasetSelect.value = dataset.id;

        await selectDataset(dataset.id);

        renderCart();
    } catch (error) {
        showError(error);
    }
}


// =========================================================
// Settings
// =========================================================
function loadSettings() {
    const saved = getStorage(SETTINGS_STORAGE_KEY);

    if (!saved) {
        return;
    }

    try {
        const parsed = JSON.parse(saved);

        if (
            parsed &&
            typeof parsed === "object"
        ) {
            if (typeof parsed.magicItems === "boolean") {
                state.settings.magicItems =
                    parsed.magicItems;
            }

            if (
                parsed.magicItemPricing === "disabled" ||
                parsed.magicItemPricing === "average" ||
                parsed.magicItemPricing === "random"
            ) {
                state.settings.magicItemPricing =
                    parsed.magicItemPricing;
            }
        }
    } catch {
        // Ignore invalid settings.
    }
}

function updateSettingsControls() {
    magicItemsToggle.checked =
        state.settings.magicItems;

    magicItemPricing.value =
        state.settings.magicItemPricing;
}

function setupSettings() {
    settingsButton.addEventListener("click", event => {
        event.stopPropagation();

        togglePopover(
            settingsMenu,
            settingsButton
        );
    });

    settingsMenu.addEventListener("click", event => {
        event.stopPropagation();
    });

    datasetSelect.addEventListener("change", () => {
        selectDataset(datasetSelect.value);
    });

    document.addEventListener("click", closePopovers);

    //  Setting controls //
    magicItemsToggle.addEventListener("change", () => {
        state.settings.magicItems =
            magicItemsToggle.checked;
        saveSettings();
        buildRarityFilter();
        renderEquipment();
    });

    magicItemPricing.addEventListener("change", () => {
        state.settings.magicItemPricing =
            magicItemPricing.value;
        saveSettings();
        renderEquipment();
        renderCart();
    });
}

function closePopovers() {
    closePopover(settingsMenu, settingsButton);
    closePopover(categoryMenu, categoryButton);
    closePopover(moreFilters, moreFiltersButton);
}

function togglePopover(menu, button) {
    const open = !menu.hidden;

    closePopovers();

    if (!open) {
        menu.hidden = false;
        button.setAttribute("aria-expanded", "true");
    }
}

function closePopover(menu, button) {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
}

function saveSettings() {
    setStorage(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(state.settings)
    );
}


// =========================================================
// Cart Actions
// =========================================================

function setupCartActions() {
    cartButton.addEventListener("click", () => {
        openCart();
    });

    cartClose.addEventListener("click", () => {
        closeCart();
    });
    
    cartBackdrop.addEventListener("click", () => {
        closeCart();
        renderCart();
    });

    emptyCartButton.addEventListener("click", () => {
        openEmptyCartModal();
    });

    emptyCartModalClose.addEventListener("click", () => {
        closeEmptyCartModal();
    });

    emptyCartCancel.addEventListener("click", () => {
        closeEmptyCartModal();
    });

    emptyCartModal
        .querySelector(".modal-backdrop")
        .addEventListener("click", () => {
            closeEmptyCartModal();
        });

    emptyCartConfirm.addEventListener("click", () => {
        clearCart();
        renderCart();
        closeEmptyCartModal();
    });

    purchaseButton.addEventListener("click", () => {
        openPurchaseModal();
    });

    purchaseModalClose.addEventListener("click", () => {
        closePurchaseModal();
    });

    purchaseCancel.addEventListener("click", () => {
        closePurchaseModal();
    });

    purchaseModal
        .querySelector(".modal-backdrop")
        .addEventListener("click", () => {
            closePurchaseModal();
        });

    purchaseConfirm.addEventListener("click", () => {
        confirmPurchase();
    });

    emptyCartButton.addEventListener("click", () => {
        openEmptyCartModal();
    });

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") {
            return;
        }

        closeCart();
        closePurchaseModal();
        closeEmptyCartModal();
        closePopovers();
    });
}

function openCart() {
    cartElement.classList.remove("cart-closed");
    cartBackdrop.classList.add("cart-backdrop-open")
}

function closeCart() {
    cartElement.classList.add("cart-closed");
    cartBackdrop.classList.remove("cart-backdrop-open");
}


// =========================================================
// Empty cart
// =========================================================
function openEmptyCartModal() {
    const itemCount = getCartItemCount();

    if (itemCount === 0) {
        return;
    }

    emptyCartModalMessage.textContent =
        `Remove all ${itemCount} ${
            itemCount === 1 ? "item" : "items"
        } from your cart?`;

    emptyCartModal.hidden = false;
}

function closeEmptyCartModal() {
    emptyCartModal.hidden = true;
}


// =========================================================
// Purchase
// =========================================================

function openPurchaseModal() {
    const cart = getCart();

    if (cart.size === 0) {
        return;
    }

    purchaseSummary.innerHTML = "";

    for (const [itemId, quantity] of cart) {
        const item = findItem(itemId);

        if (!item) {
            continue;
        }

        const row = document.createElement("div");
        row.className = "purchase-item";

        const name = document.createElement("span");
        name.className = "purchase-item-name";
        name.textContent =
            `${quantity} × ${item.item_name}`;

        const cost = document.createElement("span");
        cost.className = "purchase-item-cost";
        cost.textContent =
            formatCost(getItemPrice(item) * quantity);

        row.append(name, cost);
        purchaseSummary.appendChild(row);
    }

    const divider = document.createElement("div");
    divider.className = "purchase-divider";

    const totalRow = document.createElement("div");
    totalRow.className = "purchase-total";

    const totalLabel = document.createElement("span");
    totalLabel.textContent = "Total";

    const totalCost = document.createElement("strong");
    totalCost.textContent =
        formatCost(getCartTotal(state.items, getItemPrice));

    totalRow.append(totalLabel, totalCost);

    const weightRow = document.createElement("div");
    weightRow.className = "purchase-weight";

    const weightLabel = document.createElement("span");
    weightLabel.textContent = "Weight";

    const weight = document.createElement("span");
    weight.textContent =
        `${formatNumber(getCartWeight(state.items))} lb`;

    weightRow.append(weightLabel, weight);

    purchaseSummary.append(
        divider,
        totalRow,
        weightRow
    );

    purchaseModal.hidden = false;
}

function closePurchaseModal() {
    purchaseModal.hidden = true;
}

async function confirmPurchase() {
    const markdown = createPurchaseMarkdown();

    try {
        await navigator.clipboard.writeText(markdown);
        const transaction = {
            id: generateTransactionId(),
            datetime: new Date().toISOString(),
            markdown
        };

        console.log("Transaction completed:", transaction.id);


        state.transactions.unshift(transaction);

        saveTransactions();
        clearCart();
        renderCart();

        closePurchaseModal();
    } catch {
        alert(
            "Could not copy the purchase list to the clipboard."
        );
    }
}

function createPurchaseMarkdown() {
    const cart = getCart();

    const lines = [
        "### Equipment Purchase",
        ""
    ];

    for (const [itemId, quantity] of cart) {
        const item = findItem(itemId);

        if (!item) {
            continue;
        }

        const totalItemCost =
            getItemPrice(item) * quantity;

        lines.push(
            `- ${quantity}× ${item.item_name} (${formatCost(totalItemCost)})`
        );
    }

    lines.push(
        "",
        `**Total:** ${formatCost(getCartTotal(state.items, getItemPrice))}`,
        `**Weight:** ${formatNumber(getCartWeight(state.items))} lb`
    );

    return lines.join("\n");
}


// =========================================================
// Filters
// =========================================================

function setupFilters() {
    searchInput.addEventListener("input", () => {
        state.filters.search =
            searchInput.value.trim();

        renderEquipment();
    });

    costMinInput.addEventListener("input", () => {
        state.filters.costMin =
            gpToCp(
                parseNumberOrNull(costMinInput.value)
            );

        renderEquipment();
    });

    costMaxInput.addEventListener("input", () => {
        state.filters.costMax =
            gpToCp(
                parseNumberOrNull(costMaxInput.value)
            );

        renderEquipment();
    });

    categoryButton.addEventListener("click", event => {
        event.stopPropagation();

        togglePopover(
            categoryMenu,
            categoryButton
        );
    });

    categoryMenu.addEventListener("click", event => {
        event.stopPropagation();
    });

    resetFiltersButton.addEventListener(
        "click",
        resetFilters
    );
}

function setupMoreFilters() {
    moreFiltersButton.addEventListener("click", event => {
        event.stopPropagation();

        togglePopover(
            moreFilters,
            moreFiltersButton
        );
    });

    moreFilters.addEventListener("click", event => {
        event.stopPropagation();
    });

    weightMinInput.addEventListener("input", () => {
        state.filters.weightMin =
            parseNumberOrNull(
                weightMinInput.value
            );

        renderEquipment();
    });

    weightMaxInput.addEventListener("input", () => {
        state.filters.weightMax =
            parseNumberOrNull(
                weightMaxInput.value
            );

        renderEquipment();
    });
}


// =========================================================
// Sorting
// =========================================================

function setupSorting() {
    for (const button of sortButtons) {
        button.addEventListener("click", () => {
            const field = button.dataset.sort;

            if (state.sort.field === field) {
                state.sort.direction =
                    state.sort.direction === "asc"
                        ? "desc"
                        : "asc";
            } else {
                state.sort.field = field;
                state.sort.direction = "asc";
            }

            updateSortIndicators();
            renderEquipment();
        });
    }

    updateSortIndicators();
}

function updateSortIndicators() {
    for (const button of sortButtons) {
        const active =
            button.dataset.sort === state.sort.field;

        const indicator =
            button.querySelector(".sort-indicator");

        button.classList.toggle("active", active);

        indicator.textContent = active
            ? state.sort.direction === "asc"
                ? " ↑"
                : " ↓"
            : "";
    }
}


// =========================================================
// Dataset
// =========================================================

function populateDatasetSelect() {
    datasetSelect.innerHTML = "";

    for (const dataset of state.datasets) {
        const option =
            document.createElement("option");

        option.value = dataset.id;
        option.textContent = dataset.name;

        datasetSelect.appendChild(option);
    }
}

async function selectDataset(datasetId) {
    const dataset =
        state.datasets.find(
            item => item.id === datasetId
        );

    if (!dataset) {
        return;
    }

    try {
        status.textContent = "Loading...";

        state.currentDataset = dataset;
        state.expandedItems.clear();
        state.items = await loadDataset(dataset);

        setStorage(
            DATASET_STORAGE_KEY,
            dataset.id
        );

        buildCategoryFilter();
        buildRarityFilter();

        resetFilters();
    } catch (error) {
        showError(error);
    }
}


// =========================================================
// Category Filter
// =========================================================

function buildCategoryFilter() {
    categoryOptions.innerHTML = "";

    const categories = [
        ...new Set(
            state.items
                .map(item => item.category)
                .filter(hasValue)
        )
    ].sort(compareStrings);

    for (const category of categories) {
        const label =
            document.createElement("label");

        label.className = "category-option";

        const checkbox =
            document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.value = category;
        checkbox.checked =
            state.filters.categories.has(category);

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                state.filters.categories.add(category);
            } else {
                state.filters.categories.delete(category);
            }

            updateCategoryLabel();
            renderEquipment();
        });

        const text =
            document.createElement("span");

        text.textContent = category;

        label.append(checkbox, text);
        categoryOptions.appendChild(label);
    }

    updateCategoryLabel();
}


// =========================================================
// Rarity Filter
// =========================================================

function buildRarityFilter() {
    rarityOptions.innerHTML = "";

    rarityFilter.hidden=
        !state.settings.magicItems;

    if(!state.settings.magicItems) {
        return;
    }

    const rarityOrder = [
        { value: null, label: "Mundane" },
        { value: "Common", label: "Common" },
        { value: "Uncommon", label: "Uncommon" },
        { value: "Rare", label: "Rare" },
        { value: "Very Rare", label: "Very Rare" },
        { value: "Legendary", label: "Legendary" },
        { value: "Artifact", label: "Artifact" }
    ];

    const availableRarities = new Set(
        state.items.map(item => item.rarity)
    );

    for (const rarity of rarityOrder) {
        if (!availableRarities.has(rarity.value)) {
            continue;
        }

        const label =
            document.createElement("label");

        label.className = "category-option";

        const checkbox =
            document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.value = rarity.value ?? "";
        checkbox.checked =
            state.filters.rarities.has(rarity.value);

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                state.filters.rarities.add(rarity.value);
            } else {
                state.filters.rarities.delete(rarity.value);
            }

            renderEquipment();
        });

        const text =
            document.createElement("span");

        text.textContent = rarity.label;

        label.append(checkbox, text);
        rarityOptions.appendChild(label);
    }
}

function updateCategoryLabel() {
    const selected =
        [...state.filters.categories];

    categoryLabel.textContent =
        selected.length === 0
            ? "All"
            : selected.length === 1
                ? selected[0]
                : `${selected.length} Categories`;
}


// =========================================================
// Reset / Filtering
// =========================================================

function resetFilters() {
    state.filters.search = "";
    state.filters.categories.clear();
    state.filters.rarities.clear();

    state.filters.costMin = null;
    state.filters.costMax = null;

    state.filters.weightMin = null;
    state.filters.weightMax = null;

    searchInput.value = "";
    costMinInput.value = "";
    costMaxInput.value = "";
    weightMinInput.value = "";
    weightMaxInput.value = "";

    resetCheckboxes(categoryOptions);
    resetCheckboxes(rarityOptions);

    updateCategoryLabel();
    renderEquipment();
}

function resetCheckboxes(container) {
    container
        .querySelectorAll('input[type="checkbox"]')
        .forEach(checkbox => {
            checkbox.checked = false;
        });
}

function getFilteredItems() {
    const filters = state.filters;

    return state.items.filter(item => {
        // Magic item toggle
        if (
            !state.settings.magicItems &&
            item.rarity !== null
        ) {
            return false;
        }

        // Search filter
        if (
            filters.search &&
            !matchesSearch(item, filters.search)
        ) {
            return false;
        }

        if (
            filters.search &&
            !matchesSearch(item, filters.search)
        ) {
            return false;
        }

        // Category filter
        if (!matchesCategories(item)) {
            return false;
        }

        if (
            filters.rarities.size &&
            !filters.rarities.has(item.rarity)
        ) {
            return false;
        }

        // Cost filter
        if (
            filters.costMin !== null &&
            (
                typeof getItemPrice(item) !== "number" ||
                getItemPrice(item) < filters.costMin
            )
        ) {
            return false;
        }

        if (
            filters.costMax !== null &&
            (
                typeof getItemPrice(item) !== "number" ||
                getItemPrice(item) > filters.costMax
            )
        ) {
            return false;
        }

        // Weight filter
        if (
            filters.weightMin !== null &&
            (
                typeof item.weight !== "number" ||
                item.weight < filters.weightMin
            )
        ) {
            return false;
        }

        if (
            filters.weightMax !== null &&
            (
                typeof item.weight !== "number" ||
                item.weight > filters.weightMax
            )
        ) {
            return false;
        }

        return true;
    });
}

function matchesSearch(item, search) {
    const text = [
        item.item_name,
        item.category,
        item.type,
        item.rarity
    ]
        .filter(value => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

    const groups = parseSearch(search);

    return groups.some(group =>
        group.every(term =>
            text.includes(term.toLowerCase())
        )
    );
}

function parseSearch(search) {
    return search
        .split(" OR ")
        .map(group =>
            group
                .trim()
                .match(/"[^"]*"|\S+/g)
                ?.map(term =>
                    term.replace(/^"|"$/g, "")
                ) || []
        )
        .filter(group => group.length);
}

function matchesCategories(item) {
    const selected = state.filters.categories;

    if (selected.size === 0) {
        return true;
    }

    const isMagic = item.rarity !== null;
    const wantsMagic = selected.has("Magic Item");

    const otherCategories = [...selected].filter(
        category => category !== "Magic Item"
    );

    // Magic Item selected: restrict to magic items.
    if (wantsMagic && !isMagic) {
        return false;
    }

    // Only Magic Item selected.
    if (otherCategories.length === 0) {
        return true;
    }

    // For magic items, use type as the category.
    // For mundane items, use the category array.
    const categories = isMagic
        ? [item.type]
        : item.category;

    // Non-magic category selections are OR.
    return otherCategories.some(category =>
        categories.includes(category)
    );
}


// =========================================================
// Equipment Rendering
// =========================================================

function sortItems(items) {
    const {
        field,
        direction
    } = state.sort;

    return [...items].sort((a, b) => {
        const result =
            {
                name: compareStrings(
                    a.item_name,
                    b.item_name
                ),

                category: compareStrings(
                    a.category,
                    b.category
                ),

                type: compareStrings(
                    a.type,
                    b.type
                ),

                cost: compareNumbers(
                    getItemPrice(a),
                    getItemPrice(b)
                )
            }[field] ??
            compareStrings(
                a.item_name,
                b.item_name
            );

        return direction === "asc"
            ? result
            : -result;
    });
}

function renderEquipment() {
    const sorted =
        sortItems(getFilteredItems());

    equipmentList.innerHTML = "";

    if (!sorted.length) {
        const empty =
            document.createElement("div");

        empty.className = "empty-results";
        empty.textContent =
            "No equipment matches your filters.";

        equipmentList.appendChild(empty);

        updateStatus(0);

        return;
    }

    for (const item of sorted) {
        equipmentList.appendChild(
            createEquipmentRow(item)
        );
    }

    updateStatus(sorted.length);
}

function createEquipmentRow(item) {
    const row =
        document.createElement("div");

    row.className = "equipment-row";

    const summary =
        document.createElement("div");

    summary.className =
        "equipment-row-summary";

    const fields = [
        ["item-name", item.item_name],
        ["item-category", item.category || "—"],
        ["item-type", item.type || "—"],
        ["item-cost", formatCost(getItemPrice(item))]
    ];

    for (const [className, value] of fields) {
        const element =
            document.createElement("div");

        element.className = className;
        element.textContent = value;

        summary.appendChild(element);
    }

    if (!state.expandedItems.has(item.item_id)) {
        const addButton =
            document.createElement("button");

        addButton.type = "button";
        addButton.className =
            "add-to-cart-button";
        addButton.textContent = "+";

        addButton.setAttribute(
            "aria-label",
            `Add ${item.item_name} to cart`
        );

        addButton.addEventListener("click", event => {
            event.stopPropagation();

            addToCart(item.item_id);
            renderCart();
        });

        summary.appendChild(addButton);
    }

    row.appendChild(summary);

    if (state.expandedItems.has(item.item_id)) {
        row.appendChild(
            createDetails(item)
        );
    }

    row.addEventListener("click", () => {
        if (state.expandedItems.has(item.item_id)) {
            state.expandedItems.delete(item.item_id);
        } else {
            state.expandedItems.add(item.item_id);
        }

        renderEquipment();
    });

    return row;
}


// =========================================================
// Cart Rendering
// =========================================================

function renderCart() {
    const cart = getCart();
    const itemCount = getCartItemCount();

    cartItems.innerHTML = "";
    cartCounter.textContent = itemCount;
    cartCounter.hidden = itemCount === 0;

    if (cart.size === 0) {
        const empty =
            document.createElement("p");

        empty.className =
            "cart-item empty-state";

        empty.textContent =
            "Your cart is empty.";

        cartItems.appendChild(empty);
    } else {
        for (const [itemId, quantity] of cart) {
            const item = findItem(itemId);

            if (!item) {
                continue;
            }

            cartItems.appendChild(
                createCartItem(
                    item,
                    quantity
                )
            );
        }
    }

    cartCount.textContent =
        `${itemCount} ${itemCount === 1 ? "item" : "items"}`;

    cartCost.textContent =
        formatCost(
            getCartTotal(state.items, getItemPrice)
        );

    cartWeight.textContent =
        `${formatNumber(
            getCartWeight(state.items)
        )} lb`;

        emptyCartButton.hidden = itemCount === 0;
}

function createCartItem(item, quantity) {
    const element =
        document.createElement("div");

    element.className = "cart-item";

    const name =
        document.createElement("span");

    name.className =
        "cart-item-name";

    name.textContent =
        item.item_name;

    const cost =
        document.createElement("span");

    cost.className =
        "cart-item-cost";

    cost.textContent =
        formatCost(getItemPrice(item));

    const controls =
        document.createElement("div");

    controls.className =
        "cart-item-controls";

    const decreaseButton =
        document.createElement("button");

    decreaseButton.type = "button";
    decreaseButton.className =
        "cart-quantity-button";

    decreaseButton.textContent = "−";

    decreaseButton.setAttribute(
        "aria-label",
        `Decrease ${item.item_name} quantity`
    );

    decreaseButton.addEventListener("click", event => {
        event.stopPropagation();

        decreaseCartQuantity(
            item.item_id
        );

        renderCart();
    });

    const quantityInput =
        document.createElement("input");

    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.step = "1";
    quantityInput.value = quantity;

    quantityInput.className =
        "cart-quantity-input";

    quantityInput.setAttribute(
        "aria-label",
        `${item.item_name} quantity`
    );

    quantityInput.addEventListener(
        "change",
        event => {
            event.stopPropagation();

            setCartQuantity(
                item.item_id,
                quantityInput.value
            );

            renderCart();
        }
    );

    const increaseButton =
        document.createElement("button");

    increaseButton.type = "button";
    increaseButton.className =
        "cart-quantity-button";

    increaseButton.textContent = "+";

    increaseButton.setAttribute(
        "aria-label",
        `Increase ${item.item_name} quantity`
    );

    increaseButton.addEventListener("click", event => {
        event.stopPropagation();

        addToCart(item.item_id);
        renderCart();
    });

    controls.append(
        decreaseButton,
        quantityInput,
        increaseButton
    );

    element.append(
        name,
        cost,
        controls
    );

    return element;
}


// =========================================================
// Item Details
// =========================================================

function createDetails(item) {
    const details =
        document.createElement("div");

    details.className =
        "equipment-details";

    addDetailField(
        details,
        "Weight",
        formatWeight(item.weight)
    );

    addDetailField(
        details,
        "Properties",
        formatProperties(item.properties)
    );

    addDetailField(
        details,
        "Weapon mastery",
        formatProperties(item.weapon_mastery)
    );

    addDetailField(
        details,
        "Rarity",
        item.rarity
    );

    if (
        item.details &&
        Object.keys(item.details).length
    ) {
        for (
            const [key, value]
            of Object.entries(item.details)
        ) {
            if (!hasValue(value)) {
                continue;
            }

            addDetailField(
                details,
                formatDetailLabel(key),
                formatDetailValue(value)
            );
        }
    }

    if (hasValue(item.description)) {
        const description =
            document.createElement("div");

        description.className =
            "item-description";

        description.textContent =
            item.description;

        details.appendChild(description);
    }

    const addButton =
        document.createElement("button");

    addButton.type = "button";
    addButton.className =
        "details-add-to-cart";

    addButton.textContent =
        "Add to Cart";

    addButton.addEventListener("click", event => {
        event.stopPropagation();

        addToCart(item.item_id);
        renderCart();
    });

    details.appendChild(addButton);

    return details;
}

function formatDetailLabel(key) {
    return key
        .replace(/_/g, " ")
        .replace(
            /\b\w/g,
            char => char.toUpperCase()
        );
}

function formatDetailValue(value) {
    if (Array.isArray(value)) {
        return value.join(", ");
    }

    return String(value);
}

function addDetailField(
    container,
    label,
    value
) {
    if (!hasValue(value)) {
        return;
    }

    const field =
        document.createElement("div");

    field.className =
        "detail-field";

    const labelElement =
        document.createElement("strong");

    labelElement.textContent =
        `${label}:`;

    const valueElement =
        document.createElement("span");

    valueElement.textContent =
        ` ${value}`;

    field.append(
        labelElement,
        valueElement
    );

    container.appendChild(field);
}


// =========================================================
// Formatting / Utilities
// =========================================================

function findItem(itemId) {
    return state.items.find(
        item => item.item_id === itemId
    );
}

function hasValue(value) {
    return (
        value !== null &&
        value !== undefined &&
        value !== ""
    );
}

function formatProperties(properties) {
    if (!hasValue(properties)) {
        return null;
    }

    if (Array.isArray(properties)) {
        return properties.join(", ");
    }

    if (typeof properties === "object") {
        return Object.entries(properties)
            .map(([key, value]) =>
                value === true
                    ? key
                    : `${key}: ${value}`
            )
            .join(", ");
    }

    return String(properties);
}

function formatWeight(weight) {
    return hasValue(weight)
        ? `${formatNumber(weight)} lb.`
        : null;
}

function formatNumber(value) {
    if (typeof value !== "number") {
        return value;
    }

    return Number.isInteger(value)
        ? String(value)
        : String(
            Number(value.toFixed(2))
        );
}

function parseNumberOrNull(value) {
    if (!value) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}

function gpToCp(gp) {
    return gp === null
        ? null
        : Math.round(gp * 100);
}

function compareStrings(a, b) {
    return String(a || "").localeCompare(
        String(b || ""),
        undefined,
        {
            sensitivity: "base"
        }
    );
}

function compareNumbers(a, b) {
    const aNumber =
        typeof a === "number"
            ? a
            : Number.POSITIVE_INFINITY;

    const bNumber =
        typeof b === "number"
            ? b
            : Number.POSITIVE_INFINITY;

    return aNumber - bNumber;
}

function formatCost(costCp) {
    if (
        typeof costCp !== "number" ||
        !Number.isFinite(costCp)
    ) {
        return "—";
    }

    const gp = Math.floor(costCp / 100);
    const sp = Math.floor(
        (costCp % 100) / 10
    );
    const cp = costCp % 10;

    const parts = [];

    if (gp > 0) {
        parts.push(`${gp} gp`);
    }

    if (sp > 0) {
        parts.push(`${sp} sp`);
    }

    if (cp > 0) {
        parts.push(`${cp} cp`);
    }

    return parts.length
        ? parts.join(", ")
        : "0 cp";
}

function updateStatus(count) {
    status.textContent =
        `${count} of ${state.items.length} items`;
}

// Transaction helper function

const TRANSACTION_ID_CHARS =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateTransactionId() {
    let id;

    do {
        id = "";

        for (let i = 0; i < 6; i++) {
            id += TRANSACTION_ID_CHARS[
                Math.floor(
                    Math.random() *
                    TRANSACTION_ID_CHARS.length
                )
            ];
        }
    } while (
        state.transactions.some(
            transaction => transaction.id === id
        )
    );

    return id;
}

// =========================================================
// Local Storage
// =========================================================

function getStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function setStorage(key, value) {
    try {
        localStorage.setItem(
            key,
            value
        );
    } catch {
        // Ignore storage errors.
    }
}

function clearStore() {
    localStorage.removeItem(DATASET_STORAGE_KEY);
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    localStorage.removeItem(MAGIC_ITEM_PRICES_STORAGE_KEY);

    location.reload();
}


// =========================================================
// Errors and Dev Tools
// =========================================================

function showError(error) {
    console.error(error);

    status.textContent =
        "Unable to load equipment.";

    equipmentList.innerHTML = "";

    const message =
        document.createElement("div");

    message.className =
        "empty-results";

    message.textContent =
        error.message ||
        "An unexpected error occurred.";

    equipmentList.appendChild(message);
}
window.clearStore = clearStore;

// =========================================================
// Start
// =========================================================

init();