const stringify = require('csv-stringify');
const fs = require('fs');

module.exports = {
  improve: '@apostrophecms/piece-type',
  utilityOperations: {
    add: {
      import: {
        route: '/import',
        label: 'apostrophe:importPieces'
      }
    }
  },
  init (self) {
    self.exportFormats = {
      csv: {
        label: 'CSV (comma-separated values)',
        output: function (filename) {
          const out = stringify({ header: true });
          out.pipe(fs.createWriteStream(filename));
          return out;
        }
      },
      tsv: {
        label: 'TSV (tab-separated values)',
        output: function (filename) {
          const out = stringify({
            header: true,
            delimiter: '\t'
          });
          out.pipe(fs.createWriteStream(filename));
          return out;
        }
      },
      xlsx: require('./lib/excel.js')(self),
      ...(self.options.exportFormats || {})
    };
  },
  methods (self) {
    return {
      ...require('./lib/import')(self)
    };
  },
  apiRoutes (self) {
    return {
      post: {
        import (req) {

        }
      }
    };
  }
};
