import argparse
import copy
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path


# ============================================================
# Approved equipment.json schema
# Ordered deliberately so questions are always asked
# in a predictable order.
# ============================================================

APPROVED_TOP_LEVEL_FIELDS = (
    "item_id",
    "item_name",
    "source",
    "category",
    "type",
    "rarity",
    "details",
    "description",
    "cost_cp",
    "weight",
)


# Fields that should default to null when missing.
# "item_id" is intentionally excluded because it is required.
DEFAULT_MISSING_FIELDS = {
    "item_name": None,
    "source": None,
    "category": None,
    "type": None,
    "rarity": None,
    "description": None,
    "cost_cp": None,
    "weight": None,
}


# Change types that the user has chosen to auto-approve.
AUTO_APPROVE = set()


# ============================================================
# User approval
# ============================================================

def ask_approval(prompt, change_type):
    """
    Ask the user whether to approve a proposed change.

    y = approve this change
    n = reject this change
    a = approve this and all future changes of the same type
    q = quit
    """

    if change_type in AUTO_APPROVE:
        print(f"{prompt} [auto-approved]")
        return "y"

    while True:
        answer = input(f"{prompt} [y/n/a/q]: ").strip().lower()

        if answer in {"y", "yes"}:
            return "y"

        if answer in {"n", "no"}:
            return "n"

        if answer == "a":
            AUTO_APPROVE.add(change_type)
            print(f"✓ Approved. Future '{change_type}' changes will be auto-approved.")
            return "y"

        if answer in {"q", "quit"}:
            return "q"

        print("Please enter y, n, a, or q.")


# ============================================================
# JSON helpers
# ============================================================

def load_json(path):
    """Load JSON from a file."""

    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"ERROR: File not found: {path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in {path}")
        print(e)
        sys.exit(1)


def save_json(path, data):
    """Write JSON with readable formatting."""

    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def create_backup(path):
    """Create a timestamped backup of the existing equipment file."""

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = path.with_name(
        f"{path.stem}.backup_{timestamp}{path.suffix}"
    )

    shutil.copy2(path, backup_path)

    return backup_path


# ============================================================
# Data helpers
# ============================================================

def index_by_item_id(items):
    """Return {item_id: item} for a list of equipment records."""

    result = {}

    for item in items:
        item_id = item.get("item_id")

        if item_id is not None:
            result[item_id] = item

    return result


def ensure_details(item):
    """
    Ensure details is a dictionary.

    This function should only be called after the user has
    approved the relevant change, or when the field is already
    known to be a valid dictionary.
    """

    if "details" not in item:
        item["details"] = {}

    elif item["details"] is None:
        item["details"] = {}

    elif not isinstance(item["details"], dict):
        item["details"] = {}

    return item["details"]


def format_value(value):
    """Format a value for display in approval prompts."""

    return repr(value)


# ============================================================
# Phase 1
# Add missing approved top-level fields
# ============================================================

def add_missing_schema_fields(equipment):
    """
    Find records missing approved schema fields and ask whether
    those fields should be added.

    Missing standard fields become null.
    Missing details becomes {}.
    """

    changes_made = 0

    print("\n" + "=" * 60)
    print("PHASE 1: CHECKING FOR MISSING SCHEMA FIELDS")
    print("=" * 60)

    for item in equipment:
        item_id = item.get("item_id", "<missing item_id>")

        for field in APPROVED_TOP_LEVEL_FIELDS:

            if field in item:
                continue

            if field == "details":
                proposed_value = {}
                change_type = "missing_details"

                prompt = (
                    f'[{item_id}] Add missing "details": {{}}?'
                )

            else:
                proposed_value = DEFAULT_MISSING_FIELDS.get(field)
                change_type = "missing_field_null"

                prompt = (
                    f'[{item_id}] Add missing "{field}": '
                    f'{format_value(proposed_value)}?'
                )

            answer = ask_approval(prompt, change_type)

            if answer == "q":
                return changes_made, True

            if answer == "y":
                item[field] = copy.deepcopy(proposed_value)
                changes_made += 1

    return changes_made, False


# ============================================================
# Phase 2
# Move unassigned fields into details for existing items
# ============================================================

def find_unassigned_fields(item):
    """
    Return fields that are not part of the approved top-level
    schema.
    """

    return [
        field
        for field in item
        if field not in APPROVED_TOP_LEVEL_FIELDS
    ]


def process_unassigned_fields(existing_item, incoming_item):
    """
    For an item that already exists in equipment.json:

    Any incoming fields not belonging to the approved schema
    are proposed for placement inside details.
    """

    changes_made = 0

    item_id = incoming_item.get("item_id", "<missing item_id>")

    unassigned_fields = find_unassigned_fields(incoming_item)

    if not unassigned_fields:
        return changes_made, False

    # Make sure details exists before attempting to add values.
    if "details" not in existing_item:
        answer = ask_approval(
            f'[{item_id}] Add missing "details": {{}}?',
            "missing_details"
        )

        if answer == "q":
            return changes_made, True

        if answer == "n":
            # Do not attempt to place anything in details.
            return changes_made, False

        existing_item["details"] = {}
        changes_made += 1

    elif existing_item["details"] is None:
        answer = ask_approval(
            f'[{item_id}] Change "details": null to {{}}?',
            "replace_details_null"
        )

        if answer == "q":
            return changes_made, True

        if answer == "n":
            return changes_made, False

        existing_item["details"] = {}
        changes_made += 1

    elif not isinstance(existing_item["details"], dict):
        answer = ask_approval(
            f'[{item_id}] Replace invalid "details" value '
            f'{format_value(existing_item["details"])} with {{}}?',
            "replace_invalid_details"
        )

        if answer == "q":
            return changes_made, True

        if answer == "n":
            return changes_made, False

        existing_item["details"] = {}
        changes_made += 1

    details = existing_item["details"]

    for field in unassigned_fields:
        incoming_value = incoming_item[field]

        if field not in details:

            answer = ask_approval(
                f'[{item_id}] Add details["{field}"] = '
                f'{format_value(incoming_value)}?',
                "add_detail"
            )

            if answer == "q":
                return changes_made, True

            if answer == "y":
                details[field] = copy.deepcopy(incoming_value)
                changes_made += 1

        else:
            existing_value = details[field]

            if existing_value == incoming_value:
                print(
                    f'[{item_id}] details["{field}"] already matches '
                    f'incoming data.'
                )
                continue

            answer = ask_approval(
                f'[{item_id}] Replace details["{field}"] '
                f'{format_value(existing_value)} -> '
                f'{format_value(incoming_value)}?',
                "replace_detail"
            )

            if answer == "q":
                return changes_made, True

            if answer == "y":
                details[field] = copy.deepcopy(incoming_value)
                changes_made += 1

    return changes_made, False


# ============================================================
# Phase 3
# Add completely new items
# ============================================================

def build_new_item(incoming_item):
    """
    Build a new equipment record using the approved schema.

    All unknown incoming fields are placed under details.
    """

    new_item = {}

    # Add approved fields in deterministic schema order.
    for field in APPROVED_TOP_LEVEL_FIELDS:

        if field == "details":
            new_item[field] = {}

        elif field in incoming_item:
            new_item[field] = copy.deepcopy(incoming_item[field])

        else:
            new_item[field] = copy.deepcopy(
                DEFAULT_MISSING_FIELDS.get(field)
            )

    # Move all unapproved fields into details.
    for field, value in incoming_item.items():

        if field not in APPROVED_TOP_LEVEL_FIELDS:
            new_item["details"][field] = copy.deepcopy(value)

    return new_item


def add_new_items(equipment, incoming_data):
    """
    Add incoming items whose item_id does not already exist.
    """

    changes_made = 0
    quit_requested = False

    equipment_by_id = index_by_item_id(equipment)

    print("\n" + "=" * 60)
    print("PHASE 2: CHECKING FOR NEW ITEMS")
    print("=" * 60)

    for incoming_item in incoming_data:

        item_id = incoming_item.get("item_id")

        if not item_id:
            print(
                "WARNING: Incoming record has no item_id. "
                "Skipping it."
            )
            continue

        if item_id in equipment_by_id:
            continue

        new_item = build_new_item(incoming_item)

        answer = ask_approval(
            f'Add new item "{item_id}"?',
            "add_new_item"
        )

        if answer == "q":
            quit_requested = True
            break

        if answer == "y":
            equipment.append(new_item)
            equipment_by_id[item_id] = new_item
            changes_made += 1

            print(f'✓ Added "{item_id}".')

    return changes_made, quit_requested


# ============================================================
# Phase 4
# Compare matching items
# ============================================================

def process_matching_item(existing_item, incoming_item):
    """
    Compare an existing equipment record with incoming data.

    Approved top-level fields are compared first in schema order.
    Unassigned fields are compared against details.
    """

    changes_made = 0
    item_id = incoming_item.get("item_id", "<missing item_id>")

    # --------------------------------------------------------
    # Approved top-level fields
    # --------------------------------------------------------

    for field in APPROVED_TOP_LEVEL_FIELDS:

        # item_id identifies the record and should not be replaced.
        if field == "item_id":
            continue

        if field not in incoming_item:
            continue

        incoming_value = incoming_item[field]

        if field not in existing_item:

            answer = ask_approval(
                f'[{item_id}] Add missing "{field}" = '
                f'{format_value(incoming_value)}?',
                "add_top_level"
            )

            if answer == "q":
                return changes_made, True

            if answer == "y":
                existing_item[field] = copy.deepcopy(incoming_value)
                changes_made += 1

            continue

        existing_value = existing_item[field]

        if existing_value == incoming_value:
            continue

        # Handle details separately because it is a dictionary.
        if field == "details":

            if incoming_value is None:
                answer = ask_approval(
                    f'[{item_id}] Replace "details" '
                    f'{format_value(existing_value)} -> null?',
                    "replace_details"
                )

                if answer == "q":
                    return changes_made, True

                if answer == "y":
                    existing_item["details"] = None
                    changes_made += 1

                continue

            if not isinstance(incoming_value, dict):
                answer = ask_approval(
                    f'[{item_id}] Replace "details" '
                    f'{format_value(existing_value)} -> '
                    f'{format_value(incoming_value)}?',
                    "replace_details"
                )

                if answer == "q":
                    return changes_made, True

                if answer == "y":
                    existing_item["details"] = copy.deepcopy(
                        incoming_value
                    )
                    changes_made += 1

                continue

            # Both are dictionaries.
            if not isinstance(existing_value, dict):
                answer = ask_approval(
                    f'[{item_id}] Replace invalid "details" '
                    f'{format_value(existing_value)} with incoming '
                    f'details?',
                    "replace_invalid_details"
                )

                if answer == "q":
                    return changes_made, True

                if answer == "y":
                    existing_item["details"] = copy.deepcopy(
                        incoming_value
                    )
                    changes_made += 1

                continue

            # Merge individual details keys.
            for detail_key, detail_value in incoming_value.items():

                if detail_key not in existing_value:

                    answer = ask_approval(
                        f'[{item_id}] Add details["{detail_key}"] = '
                        f'{format_value(detail_value)}?',
                        "add_detail"
                    )

                    if answer == "q":
                        return changes_made, True

                    if answer == "y":
                        existing_value[detail_key] = copy.deepcopy(
                            detail_value
                        )
                        changes_made += 1

                elif existing_value[detail_key] != detail_value:

                    answer = ask_approval(
                        f'[{item_id}] Replace details["{detail_key}"] '
                        f'{format_value(existing_value[detail_key])} -> '
                        f'{format_value(detail_value)}?',
                        "replace_detail"
                    )

                    if answer == "q":
                        return changes_made, True

                    if answer == "y":
                        existing_value[detail_key] = copy.deepcopy(
                            detail_value
                        )
                        changes_made += 1

            continue

        # ----------------------------------------------------
        # Normal top-level field mismatch
        # ----------------------------------------------------

        answer = ask_approval(
            f'[{item_id}] Replace "{field}" '
            f'{format_value(existing_value)} -> '
            f'{format_value(incoming_value)}?',
            "replace_top_level"
        )

        if answer == "q":
            return changes_made, True

        if answer == "y":
            existing_item[field] = copy.deepcopy(incoming_value)
            changes_made += 1

    # --------------------------------------------------------
    # Incoming fields outside the approved schema
    # --------------------------------------------------------

    unassigned_fields = find_unassigned_fields(incoming_item)

    if unassigned_fields:

        detail_changes, quit_requested = process_unassigned_fields(
            existing_item,
            incoming_item
        )

        changes_made += detail_changes

        if quit_requested:
            return changes_made, True

    return changes_made, False


def process_mismatched_items(equipment, incoming_data):
    """
    Compare items that exist in both files.
    """

    changes_made = 0
    quit_requested = False

    equipment_by_id = index_by_item_id(equipment)

    print("\n" + "=" * 60)
    print("PHASE 3: CHECKING EXISTING ITEMS FOR DIFFERENCES")
    print("=" * 60)

    for incoming_item in incoming_data:

        item_id = incoming_item.get("item_id")

        if not item_id:
            continue

        if item_id not in equipment_by_id:
            continue

        existing_item = equipment_by_id[item_id]

        item_changes, quit_requested = process_matching_item(
            existing_item,
            incoming_item
        )

        changes_made += item_changes

        if quit_requested:
            break

    return changes_made, quit_requested


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Interactively merge a new equipment JSON file into "
            "equipment.json while preserving the approved schema."
        )
    )

    parser.add_argument(
        "input_file",
        help="JSON file containing the new/incoming equipment data."
    )

    parser.add_argument(
        "--equipment",
        default="equipment.json",
        help="Existing equipment JSON file (default: equipment.json)."
    )

    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent

    input_path = Path(args.input_file)

    if not input_path.is_absolute():
        input_path = script_dir / input_path

    equipment_path = Path(args.equipment)

    if not equipment_path.is_absolute():
        equipment_path = script_dir / equipment_path

    # --------------------------------------------------------
    # Load files
    # --------------------------------------------------------

    print(f"Loading incoming data: {input_path}")
    incoming_data = load_json(input_path)

    print(f"Loading equipment database: {equipment_path}")
    equipment_data = load_json(equipment_path)

    if not isinstance(incoming_data, list):
        print("ERROR: Incoming JSON must contain a list of items.")
        sys.exit(1)

    if not isinstance(equipment_data, list):
        print("ERROR: equipment.json must contain a list of items.")
        sys.exit(1)

    # --------------------------------------------------------
    # Work on a copy.
    #
    # The real equipment.json is not touched until the very
    # end, after all approvals and final confirmation.
    # --------------------------------------------------------

    equipment_working = copy.deepcopy(equipment_data)

    total_changes = 0
    quit_requested = False

    # --------------------------------------------------------
    # Phase 1
    # --------------------------------------------------------

    changes, quit_requested = add_missing_schema_fields(
        equipment_working
    )

    total_changes += changes

    if quit_requested:
        print("\nQuit requested. No changes written.")
        return

    # --------------------------------------------------------
    # Phase 2
    # --------------------------------------------------------

    changes, quit_requested = add_new_items(
        equipment_working,
        incoming_data
    )

    total_changes += changes

    if quit_requested:
        print("\nQuit requested. No changes written.")
        return

    # --------------------------------------------------------
    # Phase 3
    # --------------------------------------------------------

    changes, quit_requested = process_mismatched_items(
        equipment_working,
        incoming_data
    )

    total_changes += changes

    if quit_requested:
        print("\nQuit requested. No changes written.")
        return

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    print(f"Approved changes: {total_changes}")

    if AUTO_APPROVE:
        print("\nAuto-approved change types:")

        for change_type in sorted(AUTO_APPROVE):
            print(f"  - {change_type}")

    if total_changes == 0:
        print("\nNo changes approved. equipment.json was not modified.")
        return

    # --------------------------------------------------------
    # Final confirmation
    # --------------------------------------------------------

    print(
        f"\nThe script has {total_changes} approved changes "
        "ready to write."
    )

    answer = ask_approval(
        "Write approved changes to equipment.json?",
        "final_write"
    )

    if answer == "q":
        print("\nQuit requested. No changes written.")
        return

    if answer == "n":
        print("\nWrite cancelled. equipment.json was not modified.")
        return

    # --------------------------------------------------------
    # Backup
    # --------------------------------------------------------

    print("\nCreating backup...")

    backup_path = create_backup(equipment_path)

    print(f"Backup created: {backup_path}")

    # --------------------------------------------------------
    # Write
    # --------------------------------------------------------

    save_json(equipment_path, equipment_working)

    print(
        f"\n✓ Successfully wrote {total_changes} approved changes "
        f"to {equipment_path}"
    )


if __name__ == "__main__":
    main()