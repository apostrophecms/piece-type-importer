module.exports = {
  improve: '@apostrophecms/piece-type',
  utilityOperations (self) {
    return self.options.import
      ? {
        add: {
          import: {
            label: 'Import {{ type }}',
            modalOptions: {
              title: 'Import {{ type }}',
              description: 'Importing pieces requires a csv file with matching properties.',
              confirmationButton: 'Import',
              modal: 'AposImportPieces'
            },
            messages: {
              progress: 'Importing {{ type }}...'
            },
            requestOptions: {
              extension: 'csv'
            }
          }
        }
      } : {};

  },
  init (self) {
    self.importFormats = {
      csv: {
        label: 'CSV (comma-separated values)'
      },
      ...(self.options.importFormats || {})
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
          require('connect-multiparty')(),
          async function (req) {
            const { file } = req.files || {};
            if (!file) {
              throw self.apos.error('invalid');
            }

            const extension = file.name.split('.').pop();

            if (!self.importFormats[extension]) {
              throw self.apos.error('invalid');
            }

            const [ pieces, parsingErr ] = await self.parseCsvFile(file.path);

            if (parsingErr) {
              await self.stopProcess(req, {
                message: parsingErr.message,
                filePath: file.path,
                dismiss: false
              });

              throw self.apos.error('invalid');
            }

            req.body = { messages: req.body };

            return self.apos.modules['@apostrophecms/job'].run(
              req,
              (req, reporting) => self.importRun(req, reporting, {
                file,
                pieces
              }),
              {}
            );
          }
        ]
      }
    };
  }
};
