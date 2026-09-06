#!/usr/bin/env python3

"""
Validate equipment.json for the WMT Equipment Shop.

This script is NON-DESTRUCTIVE.
It reads the JSON file and reports potential problems for manual review.

Usage:

    python validation.py

Or:

    python validation.py equipment.json
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path


EXPECTED_SOURCE = "5.2 SRD"


# ---------------------------------------------------------------------------
# Expected schema
# ---------------------------------------------------------------------------

EXPECTED_FIELDS = {
    "item_id",
    "item_name",
    "source",
    "category",
    "type",
    "rarity",
    "description",
    "cost_cp",
    "weight",
}


# ---------------------------------------------------------------------------
# Valid categories
# ---------------------------------------------------------------------------

VALID_CATEGORIES = {
    "Weapon",
    "Armor",
    "Adventuring Gear",
    "Tools",
    "Mount",
    "Vehicle",
    "Wondrous Item",
    "Potion",
    "Ammunition",
    "Equipment Pack",
    "Scroll",
    "Spellcasting Focus",
}


# ---------------------------------------------------------------------------
# Valid types by category
#
# A category not listed here has no predefined type values.
# ---------------------------------------------------------------------------

VALID_TYPES = {
    "Weapon": {
        "Simple Melee",
        "Simple Ranged",
        "Martial Melee",
        "Martial Ranged",
    },

    "Armor": {
        "Light",
        "Medium",
        "Heavy",
        "Shield",
    },

    "Vehicle": {
        "Waterborne",
        "Land",
    },
}


# ---------------------------------------------------------------------------
# Valid rarities
# ---------------------------------------------------------------------------

VALID_RARITIES = {
    None,
    "Common",
    "Uncommon",
    "Rare",
    "Very Rare",
    "Legendary",
    "Artifact",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_json(path):
    """Load the JSON file."""

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def add_issue(issues, item, severity, field, message):
    """Add a validation issue."""

    issues.append({
        "severity": severity,
        "item_id": item.get("item_id", "<missing>"),
        "item_name": item.get("item_name", "<missing>"),
        "field": field,
        "message": message,
    })


def is_integer(value):
    """Return True if value is an integer, excluding booleans."""

    return isinstance(value, int) and not isinstance(value, bool)


def is_number(value):
    """Return True if value is numeric, excluding booleans."""

    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
    )


# ---------------------------------------------------------------------------
# Individual field validation
# ---------------------------------------------------------------------------

def validate_item_id(item, issues):
    """Validate item_id."""

    item_id = item.get("item_id")

    if not isinstance(item_id, str):
        add_issue(
            issues,
            item,
            "ERROR",
            "item_id",
            "item_id must be a string."
        )
        return

    if not item_id:
        add_issue(
            issues,
            item,
            "ERROR",
            "item_id",
            "item_id is empty."
        )
        return

    if item_id != item_id.strip():
        add_issue(
            issues,
            item,
            "REVIEW",
            "item_id",
            "item_id contains leading or trailing whitespace."
        )

    # Expected SRD-style ID format.
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", item_id):
        add_issue(
            issues,
            item,
            "REVIEW",
            "item_id",
            f"Unexpected item_id format: {item_id!r}"
        )


def validate_item_name(item, issues):
    """Validate item_name."""

    name = item.get("item_name")

    if not isinstance(name, str):
        add_issue(
            issues,
            item,
            "ERROR",
            "item_name",
            "item_name must be a string."
        )
        return

    if not name.strip():
        add_issue(
            issues,
            item,
            "ERROR",
            "item_name",
            "item_name is empty."
        )

    if name != name.strip():
        add_issue(
            issues,
            item,
            "REVIEW",
            "item_name",
            "item_name contains leading or trailing whitespace."
        )

    # Common malformed-source-data checks.
    if name.endswith(")") and "(" not in name:
        add_issue(
            issues,
            item,
            "REVIEW",
            "item_name",
            "Name ends with ')' without a matching opening parenthesis."
        )

    if "  " in name:
        add_issue(
            issues,
            item,
            "REVIEW",
            "item_name",
            "Name contains consecutive spaces."
        )

    if name.endswith(","):
        add_issue(
            issues,
            item,
            "REVIEW",
            "item_name",
            "Name ends with a comma."
        )

    if name.endswith("("):
        add_issue(
            issues,
            item,
            "REVIEW",
            "item_name",
            "Name ends with an opening parenthesis."
        )


def validate_source(item, issues):
    """Validate source."""

    source = item.get("source")

    if source != EXPECTED_SOURCE:
        add_issue(
            issues,
            item,
            "ERROR",
            "source",
            f"Expected {EXPECTED_SOURCE!r}, found {source!r}."
        )


def validate_category(item, issues):
    """Validate category."""

    category = item.get("category")

    if category not in VALID_CATEGORIES:
        add_issue(
            issues,
            item,
            "ERROR",
            "category",
            f"Unknown category: {category!r}"
        )


def validate_type(item, issues):
    """
    Validate type.

    Rules:

    - Weapon must have a recognized weapon type.
    - Armor must have a recognized armor type.
    - Vehicle may have Waterbourne or Land.
    - Other categories may have null.
    - Any non-null type that is not recognized is flagged.
    """

    category = item.get("category")
    item_type = item.get("type")

    # Null is allowed for all categories.
    if item_type is None:
        return

    # Type should always be a string when non-null.
    if not isinstance(item_type, str):
        add_issue(
            issues,
            item,
            "ERROR",
            "type",
            f"type must be a string or null, found "
            f"{type(item_type).__name__}."
        )
        return

    # If the category has defined valid types, validate against them.
    if category in VALID_TYPES:

        valid_types = VALID_TYPES[category]

        if item_type not in valid_types:
            valid_display = ", ".join(
                sorted(valid_types)
            )

            add_issue(
                issues,
                item,
                "REVIEW",
                "type",
                f"Unrecognized type {item_type!r} for "
                f"category {category!r}. "
                f"Expected one of: {valid_display}."
            )

        return

    # Categories without defined type lists should not silently accept
    # arbitrary types. Flag them for manual review.
    add_issue(
        issues,
        item,
        "REVIEW",
        "type",
        f"Unrecognized type {item_type!r} for "
        f"category {category!r}."
    )


def validate_rarity(item, issues):
    """Validate rarity."""

    rarity = item.get("rarity")

    if rarity not in VALID_RARITIES:
        add_issue(
            issues,
            item,
            "ERROR",
            "rarity",
            f"Invalid rarity: {rarity!r}"
        )


def validate_description(item, issues):
    """Validate description."""

    description = item.get("description")

    if not isinstance(description, str):
        add_issue(
            issues,
            item,
            "ERROR",
            "description",
            "description must be a string."
        )
        return

    if not description.strip():
        add_issue(
            issues,
            item,
            "REVIEW",
            "description",
            "Description is empty."
        )

    if description != description.strip():
        add_issue(
            issues,
            item,
            "REVIEW",
            "description",
            "Description contains leading or trailing whitespace."
        )

    if len(description.strip()) < 3:
        add_issue(
            issues,
            item,
            "REVIEW",
            "description",
            "Description is unusually short."
        )


def validate_cost(item, issues):
    """Validate cost_cp."""

    cost = item.get("cost_cp")

    # Null costs are allowed for manual review.
    if cost is None:
        add_issue(
            issues,
            item,
            "REVIEW",
            "cost_cp",
            "Cost is null."
        )
        return

    if not is_integer(cost):
        add_issue(
            issues,
            item,
            "ERROR",
            "cost_cp",
            f"cost_cp must be an integer, found "
            f"{type(cost).__name__}."
        )
        return

    if cost < 0:
        add_issue(
            issues,
            item,
            "ERROR",
            "cost_cp",
            f"Negative cost: {cost} cp."
        )

    if cost == 0:
        add_issue(
            issues,
            item,
            "REVIEW",
            "cost_cp",
            "Item has a cost of 0 cp."
        )

    # Flag unusually large values.
    if cost > 10_000_000:
        add_issue(
            issues,
            item,
            "REVIEW",
            "cost_cp",
            f"Unusually high cost: {cost:,} cp."
        )


def validate_weight(item, issues):
    """
    Validate weight.

    Null weights are explicitly allowed.
    """

    weight = item.get("weight")

    # Null weight is valid.
    if weight is None:
        return

    if not is_number(weight):
        add_issue(
            issues,
            item,
            "ERROR",
            "weight",
            f"weight must be numeric or null, found "
            f"{type(weight).__name__}."
        )
        return

    if weight < 0:
        add_issue(
            issues,
            item,
            "ERROR",
            "weight",
            f"Negative weight: {weight} lb."
        )

    if weight == 0:
        add_issue(
            issues,
            item,
            "REVIEW",
            "weight",
            "Item has a weight of 0 lb."
        )

    if weight > 1_000:
        add_issue(
            issues,
            item,
            "REVIEW",
            "weight",
            f"Unusually high weight: {weight} lb."
        )


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

def validate_schema(item, issues):
    """Check that the item has the expected fields."""

    actual_fields = set(item.keys())

    missing = EXPECTED_FIELDS - actual_fields
    extra = actual_fields - EXPECTED_FIELDS

    for field in sorted(missing):
        add_issue(
            issues,
            item,
            "ERROR",
            field,
            "Required field is missing."
        )

    for field in sorted(extra):
        add_issue(
            issues,
            item,
            "REVIEW",
            field,
            "Unexpected field present in item."
        )


# ---------------------------------------------------------------------------
# Cross-item validation
# ---------------------------------------------------------------------------

def validate_duplicates(items, issues):
    """Check for duplicate item IDs and names."""

    id_counts = Counter(
        item.get("item_id")
        for item in items
        if item.get("item_id")
    )

    name_counts = Counter(
        item.get("item_name")
        for item in items
        if item.get("item_name")
    )

    # Duplicate IDs are an actual error.
    for item_id, count in id_counts.items():

        if count > 1:

            matching_items = [
                item
                for item in items
                if item.get("item_id") == item_id
            ]

            for item in matching_items:
                add_issue(
                    issues,
                    item,
                    "ERROR",
                    "item_id",
                    f"Duplicate item_id: {item_id!r} "
                    f"({count} occurrences)."
                )

    # Duplicate names can be legitimate, so flag for review.
    for name, count in name_counts.items():

        if count > 1:

            matching_items = [
                item
                for item in items
                if item.get("item_name") == name
            ]

            for item in matching_items:
                add_issue(
                    issues,
                    item,
                    "REVIEW",
                    "item_name",
                    f"Duplicate item name: {name!r} "
                    f"({count} occurrences)."
                )


# ---------------------------------------------------------------------------
# Individual item validation
# ---------------------------------------------------------------------------

def validate_item(item):
    """Run all validation checks against one item."""

    issues = []

    if not isinstance(item, dict):
        return [{
            "severity": "ERROR",
            "item_id": "<unknown>",
            "item_name": "<unknown>",
            "field": "<item>",
            "message": "Item is not a JSON object.",
        }]

    validate_schema(item, issues)
    validate_item_id(item, issues)
    validate_item_name(item, issues)
    validate_source(item, issues)
    validate_category(item, issues)
    validate_type(item, issues)
    validate_rarity(item, issues)
    validate_description(item, issues)
    validate_cost(item, issues)
    validate_weight(item, issues)

    return issues


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def print_report(items, issues):
    """Print a human-readable validation report."""

    errors = [
        issue
        for issue in issues
        if issue["severity"] == "ERROR"
    ]

    reviews = [
        issue
        for issue in issues
        if issue["severity"] == "REVIEW"
    ]

    print()
    print("=" * 72)
    print("EQUIPMENT JSON VALIDATION")
    print("=" * 72)

    print()
    print(f"Items checked: {len(items)}")
    print(f"Errors:        {len(errors)}")
    print(f"Manual review: {len(reviews)}")
    print(f"Total issues:  {len(issues)}")

    # ---------------------------------------------------------------
    # Clean result
    # ---------------------------------------------------------------

    if not issues:
        print()
        print("PASS: No validation issues found.")
        print()
        return

    # ---------------------------------------------------------------
    # Errors
    # ---------------------------------------------------------------

    if errors:

        print()
        print("-" * 72)
        print("ERRORS")
        print("-" * 72)

        for issue in errors:

            print(
                f"[ERROR] {issue['item_id']} "
                f"({issue['item_name']})"
            )

            print(
                f"        {issue['field']}: "
                f"{issue['message']}"
            )

    # ---------------------------------------------------------------
    # Manual review
    # ---------------------------------------------------------------

    if reviews:

        print()
        print("-" * 72)
        print("MANUAL REVIEW")
        print("-" * 72)

        for issue in reviews:

            print(
                f"[REVIEW] {issue['item_id']} "
                f"({issue['item_name']})"
            )

            print(
                f"         {issue['field']}: "
                f"{issue['message']}"
            )

    print()
    print("=" * 72)

    if errors:
        print("RESULT: FAIL")
    else:
        print("RESULT: PASS WITH REVIEW ITEMS")

    print("=" * 72)
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():

    # Resolve paths relative to this script when no argument is supplied.
    script_dir = Path(__file__).resolve().parent

    input_path = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else script_dir / "equipment.json"
    )

    print(f"Input: {input_path}")

    # ---------------------------------------------------------------
    # Load JSON
    # ---------------------------------------------------------------

    try:
        data = load_json(input_path)

    except FileNotFoundError:
        print()
        print(f"ERROR: File not found: {input_path}")
        sys.exit(1)

    except json.JSONDecodeError as e:
        print()
        print(f"ERROR: Invalid JSON: {e}")
        sys.exit(1)

    # ---------------------------------------------------------------
    # Top-level structure
    # ---------------------------------------------------------------

    if not isinstance(data, list):
        print()
        print("ERROR: equipment.json must contain a JSON array.")
        sys.exit(1)

    items = data

    # ---------------------------------------------------------------
    # Validate individual records
    # ---------------------------------------------------------------

    issues = []

    for item in items:
        issues.extend(validate_item(item))

    # ---------------------------------------------------------------
    # Validate relationships between records
    # ---------------------------------------------------------------

    validate_duplicates(items, issues)

    # ---------------------------------------------------------------
    # Report
    # ---------------------------------------------------------------

    print_report(items, issues)

    # ---------------------------------------------------------------
    # Exit codes
    #
    # 0 = completely clean
    # 1 = errors found
    # 2 = no errors, but manual-review items exist
    # ---------------------------------------------------------------

    if any(
        issue["severity"] == "ERROR"
        for issue in issues
    ):
        sys.exit(1)

    if issues:
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()