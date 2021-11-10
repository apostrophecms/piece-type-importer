[![CircleCI](https://circleci.com/gh/apostrophecms/piece-type-importer/tree/main.svg?style=svg)](https://circleci.com/gh/apostrophecms/piece-type-importer/tree/main)
[![Chat on Discord](https://img.shields.io/discord/517772094482677790.svg)](https://chat.apostrophecms.org)

# Apostrophe Pieces Importer

This module adds an optional export feature to all piece type modules in an [Apostrophe](https://apostrophecms.com) project. This feature enables exporting *published* pieces of piece types where it is configured. Requires Apostrophe 3.

## Installation

```bash
npm install @apostrophecms/piece-type-importer
```

## Use

### Initialization

Configure `@apostrophecms/piece-type-importer` and the form widgets in `app.js`.

```javascript
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    // The Importer module
    '@apostrophecms/piece-type-importer': {},
    // A piece type that allows imports
    'article': {
      options: {
        import: true
      }
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
