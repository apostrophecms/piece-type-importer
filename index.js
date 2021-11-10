module.exports = {
  improve: '@apostrophecms/piece-type',
  utilityOperations: {
    add: {
      import: {
        route: '/import',
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
  },
  init (self) {
    self.importFormats = {
      csv: {
        label: 'CSV (comma-separated values)'
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
            const { file } = req.files || {};
            if (!file) {
              throw self.apos.error('invalid');
            }

            const extension = file.name.split('.').pop();

            if (!self.exportFormats[extension]) {
              throw self.apos.error('invalid');
            }

            const fileLinesCount = await self.countFileLines(file.path);

            req.body = { messages: req.body };

            return self.apos.modules['@apostrophecms/job'].run(
              req,
              (req, reporting) => self.importRun(req, reporting, {
                file,
                fileLinesCount
              }),
              {}
            );
          }
        ]
      }
    };
  }
};
