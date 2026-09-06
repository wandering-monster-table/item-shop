import { loadDatasetIndex, loadDataset } from "./data.js";

const DATASET_STORAGE_KEY = "dnd-equipment-shop-dataset";

const state = {
    datasets: [],
    currentDataset: null,
    items: [],
    expandedItems: new Set(),

    sort: {
        field: "name",
        direction: "asc"
    },

    filters: {
        search: "",
        categories: new Set(),
        costMin: null,
        costMax: null
    }
};


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
const resetFiltersButton = $("#reset-filters");
const moreFiltersButton = $("#more-filters-button");
const moreFilters = $("#more-filters");
const datasetSelect = $("#dataset-select");
const equipmentList = $("#equipment-list");
const status = $("#status");
const settingsButton = $("#settings-button");
const settingsMenu = $("#settings-menu");
const sortButtons = document.querySelectorAll(".table-sort-button");


// =========================================================
// Initialization
// =========================================================

async function init() {
    setupSettings();
    setupFilters();
    setupSorting();
    setupMoreFilters();

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
    } catch (error) {
        showError(error);
    }
}


// =========================================================
// Settings
// =========================================================

function setupSettings() {
    settingsButton.addEventListener("click", event => {
        event.stopPropagation();
        togglePopover(settingsMenu, settingsButton);
    });

    settingsMenu.addEventListener("click", event => {
        event.stopPropagation();
    });

    datasetSelect.addEventListener("change", () => {
        selectDataset(datasetSelect.value);
    });

    document.addEventListener("click", closePopovers);
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


// =========================================================
// Filters
// =========================================================

function setupFilters() {
    searchInput.addEventListener("input", () => {
        state.filters.search = searchInput.value.trim();
        renderEquipment();
    });

    costMinInput.addEventListener("input", () => {
        state.filters.costMin = gpToCp(
            parseNumberOrNull(costMinInput.value)
        );
        renderEquipment();
    });

    costMaxInput.addEventListener("input", () => {
        state.filters.costMax = gpToCp(
            parseNumberOrNull(costMaxInput.value)
        );
        renderEquipment();
    });

    categoryButton.addEventListener("click", event => {
        event.stopPropagation();
        togglePopover(categoryMenu, categoryButton);
    });

    categoryMenu.addEventListener("click", event => {
        event.stopPropagation();
    });

    resetFiltersButton.addEventListener("click", resetFilters);
}

function setupMoreFilters() {
    moreFiltersButton.addEventListener("click", event => {
        event.stopPropagation();
        togglePopover(moreFilters, moreFiltersButton);
    });

    moreFilters.addEventListener("click", event => {
        event.stopPropagation();
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
                    state.sort.direction === "asc" ? "desc" : "asc";
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
        const active = button.dataset.sort === state.sort.field;
        const indicator = button.querySelector(".sort-indicator");

        button.classList.toggle("active", active);
        indicator.textContent = active
            ? state.sort.direction === "asc" ? " ↑" : " ↓"
            : "";
    }
}


// =========================================================
// Dataset
// =========================================================

function populateDatasetSelect() {
    datasetSelect.innerHTML = "";

    for (const dataset of state.datasets) {
        const option = document.createElement("option");

        option.value = dataset.id;
        option.textContent = dataset.name;

        datasetSelect.appendChild(option);
    }
}

async function selectDataset(datasetId) {
    const dataset = state.datasets.find(item => item.id === datasetId);

    if (!dataset) {
        return;
    }

    try {
        status.textContent = "Loading...";

        state.currentDataset = dataset;
        state.expandedItems.clear();
        state.items = await loadDataset(dataset);

        setStorage(DATASET_STORAGE_KEY, dataset.id);

        buildCategoryFilter();
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
        const label = document.createElement("label");
        label.className = "category-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = category;
        checkbox.checked = state.filters.categories.has(category);

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                state.filters.categories.add(category);
            } else {
                state.filters.categories.delete(category);
            }

            updateCategoryLabel();
            renderEquipment();
        });

        const text = document.createElement("span");
        text.textContent = category;

        label.append(checkbox, text);
        categoryOptions.appendChild(label);
    }

    updateCategoryLabel();
}

function updateCategoryLabel() {
    const selected = [...state.filters.categories];

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
    state.filters.costMin = null;
    state.filters.costMax = null;

    searchInput.value = "";
    costMinInput.value = "";
    costMaxInput.value = "";

    categoryOptions
        .querySelectorAll('input[type="checkbox"]')
        .forEach(checkbox => {
            checkbox.checked = false;
        });

    updateCategoryLabel();
    renderEquipment();
}

function getFilteredItems() {
    return state.items.filter(item => {
        const filters = state.filters;

        if (
            filters.search &&
            !matchesSearch(item, filters.search)
        ) {
            return false;
        }

        if (
            filters.categories.size &&
            !filters.categories.has(item.category)
        ) {
            return false;
        }

        if (
            filters.costMin !== null &&
            (
                typeof item.cost_cp !== "number" ||
                item.cost_cp < filters.costMin
            )
        ) {
            return false;
        }

        if (
            filters.costMax !== null &&
            (
                typeof item.cost_cp !== "number" ||
                item.cost_cp > filters.costMax
            )
        ) {
            return false;
        }

        return true;
    });
}

function matchesSearch(item, search) {
    const query = search.toLowerCase();

    return [
        item.item_name,
        item.category,
        item.type,
        item.rarity,
        item.properties,
        item.weapon_mastery,
        item.description
    ].some(value =>
        String(value ?? "")
            .toLowerCase()
            .includes(query)
    );
}


// =========================================================
// Sorting / Rendering
// =========================================================

function sortItems(items) {
    const { field, direction } = state.sort;

    return [...items].sort((a, b) => {
        const result = {
            name: compareStrings(a.item_name, b.item_name),
            category: compareStrings(a.category, b.category),
            type: compareStrings(a.type, b.type),
            cost: compareNumbers(a.cost_cp, b.cost_cp)
        }[field] ?? compareStrings(a.item_name, b.item_name);

        return direction === "asc" ? result : -result;
    });
}

function renderEquipment() {
    const sorted = sortItems(getFilteredItems());

    equipmentList.innerHTML = "";

    if (!sorted.length) {
        const empty = document.createElement("div");

        empty.className = "empty-results";
        empty.textContent = "No equipment matches your filters.";

        equipmentList.appendChild(empty);
        updateStatus(0);

        return;
    }

    for (const item of sorted) {
        equipmentList.appendChild(createEquipmentRow(item));
    }

    updateStatus(sorted.length);
}

function createEquipmentRow(item) {
    const row = document.createElement("div");
    row.className = "equipment-row";

    const summary = document.createElement("div");
    summary.className = "equipment-row-summary";

    const fields = [
        ["item-name", item.item_name],
        ["item-category", item.category || "—"],
        ["item-type", item.type || "—"],
        ["item-cost", formatCost(item.cost_cp)]
    ];

    for (const [className, value] of fields) {
        const element = document.createElement("div");

        element.className = className;
        element.textContent = value;

        summary.appendChild(element);
    }

    row.appendChild(summary);

    if (state.expandedItems.has(item.item_id)) {
        row.appendChild(createDetails(item));
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
// Item Details
// =========================================================

function createDetails(item) {
    const details = document.createElement("div");
    details.className = "equipment-details";

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

    if (item.details && Object.keys(item.details).length) {
        for (const [key, value] of Object.entries(item.details)) {
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
        const description = document.createElement("div");

        description.className = "item-description";
        description.textContent = item.description;

        details.appendChild(description);
    }

    return details;
}

function createDetailsTable(values) {
    const table = document.createElement("table");
    table.className = "details-table";

    const body = document.createElement("tbody");

    for (const [key, value] of Object.entries(values)) {
        if (!hasValue(value)) {
            continue;
        }

        const row = document.createElement("tr");
        const label = document.createElement("th");
        const valueCell = document.createElement("td");

        label.textContent = formatDetailLabel(key);
        valueCell.textContent = formatDetailValue(value);

        row.append(label, valueCell);
        body.appendChild(row);
    }

    table.appendChild(body);

    return table;
}

function formatDetailLabel(key) {
    return key
        .replace(/_/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());
}

function formatDetailValue(value) {
    if (Array.isArray(value)) {
        return value.join(", ");
    }

    return String(value);
}

function addDetailField(container, label, value) {
    if (!hasValue(value)) {
        return;
    }

    const field = document.createElement("div");
    field.className = "detail-field";

    const labelElement = document.createElement("strong");
    labelElement.textContent = `${label}:`;

    const valueElement = document.createElement("span");
    valueElement.textContent = ` ${value}`;

    field.append(labelElement, valueElement);
    container.appendChild(field);
}


// =========================================================
// Formatting / Utilities
// =========================================================

function hasValue(value) {
    return value !== null && value !== undefined && value !== "";
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
        : String(Number(value.toFixed(2)));
}

function parseNumberOrNull(value) {
    if (!value) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}

function gpToCp(gp) {
    return gp === null ? null : Math.round(gp * 100);
}

function compareStrings(a, b) {
    return String(a || "").localeCompare(
        String(b || ""),
        undefined,
        { sensitivity: "base" }
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
    if (typeof costCp !== "number") {
        return "—";
    }

    if (costCp >= 100) {
        const gp = costCp / 100;
        return `${formatNumber(gp)} gp`;
    }

    if (costCp >= 10) {
        const sp = costCp / 10;
        return `${formatNumber(sp)} sp`;
    }

    return `${costCp} cp`;
}

function updateStatus(count) {
    status.textContent =
        `${count} of ${state.items.length} items`;
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
        localStorage.setItem(key, value);
    } catch {
        // Ignore storage errors.
    }
}


// =========================================================
// Errors
// =========================================================

function showError(error) {
    console.error(error);

    status.textContent = "Unable to load equipment.";
    equipmentList.innerHTML = "";

    const message = document.createElement("div");

    message.className = "empty-results";
    message.textContent =
        error.message || "An unexpected error occurred.";

    equipmentList.appendChild(message);
}


init();