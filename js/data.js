const DATASET_INDEX_URL = "data/datasets.json";

/**
 * Load the dataset configuration.
 *
 * Returns only datasets that are enabled.
 */
export async function loadDatasetIndex() {
    const response = await fetch(DATASET_INDEX_URL);

    if (!response.ok) {
        throw new Error(
            `Could not load dataset index (${response.status}).`
        );
    }

    const datasets = await response.json();

    if (!Array.isArray(datasets)) {
        throw new Error("datasets.json must contain an array.");
    }

    for (const dataset of datasets) {
        validateDatasetMetadata(dataset);
    }

    return datasets.filter(dataset => dataset.enabled !== false);
}


/**
 * Load all item files belonging to a dataset.
 *
 * A dataset can contain one or multiple JSON files. The application
 * receives one flat array regardless of how many files are used.
 */
export async function loadDataset(dataset) {
    validateDatasetMetadata(dataset);

    const files = await Promise.all(
        dataset.files.map(async filePath => {
            const response = await fetch(`data/${filePath}`);

            if (!response.ok) {
                throw new Error(
                    `Could not load dataset file "${filePath}" ` +
                    `(${response.status}).`
                );
            }

            const items = await response.json();

            if (!Array.isArray(items)) {
                throw new Error(
                    `Dataset file "${filePath}" must contain an array.`
                );
            }

            return items;
        })
    );

    const items = files.flat();

    return items.map(item => normalizeItem(item, dataset));
}


/**
 * Validate the dataset metadata structure.
 */
function validateDatasetMetadata(dataset) {
    if (!dataset || typeof dataset !== "object") {
        throw new Error("Invalid dataset metadata.");
    }

    if (!dataset.id || typeof dataset.id !== "string") {
        throw new Error("Each dataset must have a string id.");
    }

    if (!dataset.name || typeof dataset.name !== "string") {
        throw new Error(
            `Dataset "${dataset.id}" must have a name.`
        );
    }

    if (!Array.isArray(dataset.files) || dataset.files.length === 0) {
        throw new Error(
            `Dataset "${dataset.id}" must contain at least one file.`
        );
    }
}


/**
 * Normalize an item after loading it.
 *
 * dataset_id and dataset_name are application-level metadata added
 * at runtime. They are not required to be stored in equipment.json.
 */
function normalizeItem(item, dataset) {
    if (!item || typeof item !== "object") {
        throw new Error(
            `Dataset "${dataset.id}" contains an invalid item.`
        );
    }

    if (!item.item_id || !item.item_name) {
        throw new Error(
            `Dataset "${dataset.id}" contains an item without ` +
            `item_id or item_name.`
        );
    }

    return {
        ...item,
        dataset_id: dataset.id,
        dataset_name: dataset.name
    };
}