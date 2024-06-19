[![CircleCI](https://circleci.com/gh/apostrophecms/piece-type-importer/tree/main.svg?style=svg)](https://circleci.com/gh/apostrophecms/piece-type-importer/tree/main)
[![Chat on Discord](https://img.shields.io/discord/517772094482677790.svg)](https://chat.apostrophecms.org)

# Apostrophe Pieces Importer

> ⚠️ **NOTE:** This module is deprecated, its functionality has been incorporated into [@apostrophecms/import-export](https://github.com/apostrophecms/import-export).

This module adds an optional import feature to all piece type modules in an [Apostrophe](https://apostrophecms.com) project. This feature enables importing pieces from CSV files where it is configured. Requires Apostrophe 3.

## Installation

```bash
npm install @apostrophecms/piece-type-importer
```

## Use

### Initialization

Enable `@apostrophecms/piece-type-importer` in `app.js`.

```javascript
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    // The Importer module
    '@apostrophecms/piece-type-importer': {},
    // A piece type that allows imports (see below)
    'article': {}
    }
  }
});
```

The Pieces Importer module improves all piece types in the site to add import functionality to them. To enable that functionality, **you must add the `import: true` option on the appropriate piece type(s)**. The example above demonstrates doing this in the `app.js` file. More often it will be preferable to set this option in the module's `index.js` file.

```javascript
// modules/article/index.js
module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Article',
    pluralLabel: 'Articles',
    import: true // 👈 Adding the import option.
  },
  // Other properties...
}
```

## Updating existing pieces

You can also update existing pieces via this module.

To do that, you will need one (and only one) **key column** in your file. This column's name **must be exactly the name of the existing field** that uniquely identifies each row as an update of a specific existing piece, **followed by `:key`**.

For instance, if you need to change the usernames of users in bulk, you might prepare a CSV file like this:

```
username:key,username
bobsmith,bob.smith
janedoe,jane.doe
```

The key column is the *old value*. You may optionally also present a *new value* for that same column in a separate column without `:key`. You may also include other columns, as you see fit. The important thing is that you must have one and only one `:key` column in order to carry out updates.

## Mixing inserts and updates

If a row has no value for your `:key` column, it is treated as an insert, rather than an update.

## Importing rich text (HTML) rather than plaintext

By default, if you create a column in your CSV file for a field of type `area`, it will be imported as plaintext. Any special characters like `<` and `>` will be escaped so the user can see them. HTML is not supported.

To import areas as rich text HTML markup, add the `importAsRichText: true` option to
the `area` field in your schema.

## Roadmap

|Feature |Status  |
--- | ---
|Create mixin to define standard props for modals used in the context of utility operations| TODO
