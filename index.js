module.exports = {
  improve: '@apostrophecms/piece-type',
  utilityOperations: {
    add: {
      import: {
        route: '/import',
        label: 'apostrophe:importPieces',
        modalOptions: {
          title: 'apostrophe:importPieces',
          description: 'apostrophe:importPiecesDescription',
          confirmationButton: 'apostrophe:import',
          modal: 'AposImportPieces'
        },
        requestOptions: {
          extension: 'csv'
        }
      }
    }
  },
  init (self) {
    self.importFormats = {
      csv: {
        label: 'CSV (comma-separated values)',
        input (filename) {
          // const out = stringify({ header: true });
          // out.pipe(fs.createWriteStream(filename));
          // return out;
        }
      },
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
        import: [
          // self.canUpload,
          require('connect-multiparty')(),
          async function (req) {
            try {

              const { file } = req.files || {};
              if (!file) {
                throw self.apos.error('invalid');
              }

              await self.importRun(req, file);
            } catch (err) {
            }
            // return self.apos.modules['@apostrophecms/job'].runNonBatch(
            //   req,
            //   function (req, reporting) {
            //     return self.importRun(file);
            //   },
            //   {}
            // );
          }
        ]
      }
    };
  }
};
