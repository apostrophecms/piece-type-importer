# Changelog

## 1.3.0 (2024-03-12)

### Changes

* Compatible with both Apostrophe 3.x and Apostrophe 4.x (both Vue 2 and Vue 3).

## 1.2.0 (2024-02-21)

* Import now requires the create and edit permissions.

## 1.1.2 (2024-01-25)

* Change label to "Import from CSV" to avoid confusion with the new [`@apostrophecms/import-export`](https://github.com/apostrophecms/import-export) module.

## 1.1.1 - 2023-08-03

* Strip the UTF-8 BOM from CSV files. Otherwise the name of the first column is not correctly parsed.

## 1.1.0 - 2023-03-16

* Add support for rich-text(HTML) import. Thanks to [justyna13](https://github.com/justyna13) and [justynalodzinska](justyna.lodzinska@smartive.app) for this contribution.

## 1.0.0 - 2022-01-21

* Performs streaming imports to avoid excessive RAM use.

## 1.0.0-beta.1 - 2021-12-08

* Gets the progress notification ID from the `run` method, uses it to dismiss the progress notification if needed (early errors).

## 1.0.0-beta

* Setup module, adds pieces import feature for CSV files, based on the `piece-type-exporter` module. It uses the A3 job system.
