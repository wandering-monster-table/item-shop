# Wandering Monster Table's 5e Equipment Shop

A local-first web tool for browsing D&D equipment, building an equipment cart, and exporting purchases as Markdown.

## Features

* Browse equipment from configurable datasets
* Search equipment by name and description
* Filter by category and cost
* Sort equipment by name, category, type, or cost
* Expand equipment entries for additional details
* Add equipment to a shopping cart
* Adjust quantities or remove items from the cart
* Calculate total cost and weight
* Persist the cart and selected dataset using browser local storage
* Generate a purchase summary and copy it to the clipboard as Markdown

## Installation

Requires Python 3 for the included local development server.

Clone the repository:

```text
git clone <repository-url>
cd dnd-equipment-shop
```

Start the local development server:

```text
python server.py
```

Open http://localhost:8000 in a web browser.

The application itself is a static web application and can also be served by any standard static web server. Python is not required for deployment if another web server is being used.

## Development

Developed with HTML, CSS, JavaScript, and Python.

AI tools used for development and debugging.

All data in this tool is stored and accessed locally.

### Data

Dataset configuration is defined in:

```text
data/datasets.json
```

Individual datasets are stored under:

```text
data/
```

## Licensing & Attribution

This project includes game content derived from the D&D 5.2 System Reference Document, available under the Creative Commons Attribution 4.0 International (CC BY 4.0) license.

Equipment data used in this project was obtained from the [Open5e](https://open5e.com/) API and Creative Commons-licensed material.
### SRD 5.2

This work includes material from the System Reference Document 5.2 (“SRD 5.2”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd.

The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
