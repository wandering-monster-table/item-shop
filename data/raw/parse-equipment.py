#!/usr/bin/env python3

"""
Parse 5.2 SRD Item.json into equipment.json.

Input schema:
{
    "fields": {
        "category": "weapon",
        "cost": "2.00",
        "desc": "A dagger.",
        "document": "srd-2024",
        "name": "Dagger",
        "weapon": "srd-2024_dagger",
        "weight": "1.000"
    },
    "model": "api_v2.item",
    "pk": "srd-2024_dagger"
}

Output schema:
{
    "item_id": "dagger",
    "item_name": "Dagger",
    "source": "5.2 SRD",
    "category": "Weapon",
    "type": "Simple Melee",
    "rarity": null,
    "description": "A dagger.",
    "cost_cp": 200,
    "weight": 1
}
"""

import json
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path


SOURCE = "5.2 SRD"


# ---------------------------------------------------------------------------
# Category normalization
# ---------------------------------------------------------------------------

CATEGORY_MAP = {
    "weapon": "Weapon",
    "weapons": "Weapon",

    "armor": "Armor",
    "armors": "Armor",

    "adventuring-gear": "Adventuring Gear",
    "adventuring gear": "Adventuring Gear",

    "tools": "Tools",
    "tool": "Tools",

    "mount": "Mount",
    "mounts": "Mount",

    "vehicle": "Vehicle",
    "vehicles": "Vehicle",

    "wondrous-item": "Wondrous Item",
    "wondrous item": "Wondrous Item",
}


def normalize_category(category):
    """Convert the source category to the target category name."""

    if not category:
        return None

    normalized = category.strip().lower()

    if normalized in CATEGORY_MAP:
        return CATEGORY_MAP[normalized]

    # Safe fallback for previously unseen categories.
    return category.replace("-", " ").title()


# ---------------------------------------------------------------------------
# Weapon classification
#
# The Item records only identify an item as "weapon". The actual
# Simple/Martial and Melee/Ranged classification is therefore maintained
# here using the standard 5.2 SRD weapon list.
# ---------------------------------------------------------------------------

SIMPLE_MELEE_WEAPONS = {
    "club",
    "dagger",
    "greatclub",
    "handaxe",
    "javelin",
    "light hammer",
    "mace",
    "quarterstaff",
    "sickle",
    "spear",
}

SIMPLE_RANGED_WEAPONS = {
    "dart",
    "light crossbow",
    "shortbow",
    "sling",
}

MARTIAL_MELEE_WEAPONS = {
    "battleaxe",
    "flail",
    "glaive",
    "greataxe",
    "greatsword",
    "halberd",
    "lance",
    "longsword",
    "maul",
    "morningstar",
    "pike",
    "rapier",
    "scimitar",
    "shortsword",
    "trident",
    "war pick",
    "warhammer",
    "whip",
}

MARTIAL_RANGED_WEAPONS = {
    "blowgun",
    "hand crossbow",
    "heavy crossbow",
    "longbow",
    "musket",
    "pistol",
}


def normalize_item_name(name):
    """Normalize an item name for classification."""

    if not name:
        return ""

    return " ".join(name.lower().strip().split())


def get_weapon_type(name):
    """
    Return the weapon type:

        Simple Melee
        Simple Ranged
        Martial Melee
        Martial Ranged

    Return None if the weapon is not recognized.
    """

    normalized = normalize_item_name(name)

    if normalized in SIMPLE_MELEE_WEAPONS:
        return "Simple Melee"

    if normalized in SIMPLE_RANGED_WEAPONS:
        return "Simple Ranged"

    if normalized in MARTIAL_MELEE_WEAPONS:
        return "Martial Melee"

    if normalized in MARTIAL_RANGED_WEAPONS:
        return "Martial Ranged"

    return None


# ---------------------------------------------------------------------------
# Armor classification
# ---------------------------------------------------------------------------

LIGHT_ARMOR = {
    "padded armor",
    "leather armor",
    "studded leather armor",
}

MEDIUM_ARMOR = {
    "hide armor",
    "chain shirt",
    "scale mail",
    "breastplate",
    "half plate",
}

HEAVY_ARMOR = {
    "ring mail",
    "chain mail",
    "splint",
    "plate",
}


def get_armor_type(name):
    """
    Return the armor type:

        Light
        Medium
        Heavy
        Shield

    Return None if the armor is not recognized.
    """

    normalized = normalize_item_name(name)

    if normalized in LIGHT_ARMOR:
        return "Light"

    if normalized in MEDIUM_ARMOR:
        return "Medium"

    if normalized in HEAVY_ARMOR:
        return "Heavy"

    if normalized == "shield":
        return "Shield"

    return None


# ---------------------------------------------------------------------------
# Type classification
# ---------------------------------------------------------------------------

def get_item_type(fields):
    """
    Determine the item's type.

    Type information isn't present directly in Item.json, so weapons and
    armor are classified using the standard SRD item lists above.

    Other categories currently have no subtype and return None.
    """

    category = fields.get("category", "").lower()
    name = fields.get("name", "")

    if category == "weapon":
        return get_weapon_type(name)

    if category == "armor":
        return get_armor_type(name)

    return None


# ---------------------------------------------------------------------------
# Cost / weight normalization
# ---------------------------------------------------------------------------

def cost_to_cp(cost):
    """
    Convert source cost from GP to copper pieces.

    1 GP = 100 CP.

    Decimal is used instead of float to avoid floating-point errors.
    """

    if cost is None or cost == "":
        return None

    try:
        gold = Decimal(str(cost))
    except InvalidOperation:
        raise ValueError(f"Invalid cost value: {cost!r}")

    copper = gold * Decimal("100")

    if copper != copper.to_integral_value():
        raise ValueError(
            f"Cost does not convert to whole copper pieces: {cost!r}"
        )

    return int(copper)


def normalize_weight(weight):
    """
    Convert source weight to an integer when possible, otherwise a float.
    """

    if weight is None or weight == "":
        return None

    try:
        value = Decimal(str(weight))
    except InvalidOperation:
        raise ValueError(f"Invalid weight value: {weight!r}")

    if value == value.to_integral_value():
        return int(value)

    return float(value)


# ---------------------------------------------------------------------------
# ID handling
# ---------------------------------------------------------------------------

def get_item_id(item):
    """
    Convert:

        srd-2024_dagger

    into:

        dagger
    """

    pk = item.get("pk", "")

    if "_" in pk:
        return pk.split("_", 1)[1]

    return pk


# ---------------------------------------------------------------------------
# Item parsing
# ---------------------------------------------------------------------------

def parse_item(item):
    """Convert one source item into the target equipment schema."""

    fields = item.get("fields", {})

    category = normalize_category(fields.get("category"))

    parsed = {
        "item_id": get_item_id(item),
        "item_name": fields.get("name"),
        "source": SOURCE,
        "category": category,
        "type": get_item_type(fields),
        "rarity": None,
        "description": fields.get("desc", ""),
        "cost_cp": cost_to_cp(fields.get("cost")),
        "weight": normalize_weight(fields.get("weight")),
    }

    return parsed


# ---------------------------------------------------------------------------
# Input loading
# ---------------------------------------------------------------------------

def load_items(path):
    """
    Load Item.json.

    Supports both:

        [ {...}, {...} ]

    and:

        {
        "items": [ {...}, {...} ]
        }
    """

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        return data

    if isinstance(data, dict) and "items" in data:
        return data["items"]

    raise ValueError(
        "Expected Item.json to contain either a JSON array "
        "or an object containing an 'items' array."
    )


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_item(item):
    """Check for fields that should normally be present."""

    warnings = []

    if not item["item_id"]:
        warnings.append("missing item_id")

    if not item["item_name"]:
        warnings.append("missing item_name")

    if not item["category"]:
        warnings.append("missing category")

    if item["category"] == "Weapon" and item["type"] is None:
        warnings.append(
            f"unrecognized weapon type: {item['item_name']!r}"
        )

    if item["category"] == "Armor" and item["type"] is None:
        warnings.append(
            f"unrecognized armor type: {item['item_name']!r}"
        )

    return warnings


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Make the script work regardless of the directory from which it is run.
    script_dir = Path(__file__).resolve().parent

    input_path = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else script_dir / "Item.json"
    )

    output_path = (
        Path(sys.argv[2])
        if len(sys.argv) > 2
        else script_dir / "equipment.json"
    )

    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")

    items = load_items(input_path)

    equipment = []
    warnings = []

    for item in items:
        parsed = parse_item(item)
        equipment.append(parsed)

        item_warnings = validate_item(parsed)

        for warning in item_warnings:
            warnings.append(
                f"{parsed.get('item_id', '<unknown>')}: {warning}"
            )

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(
            equipment,
            f,
            indent=2,
            ensure_ascii=False,
        )
        f.write("\n")

    print()
    print(f"Parsed {len(equipment)} items.")

    if warnings:
        print()
        print(f"Warnings: {len(warnings)}")

        for warning in warnings:
            print(f"  - {warning}")

    print()
    print(f"Created: {output_path}")


if __name__ == "__main__":
    main()
