module.exports = {
  improve: '@apostrophecms/piece-type',
  utilityOperations (self) {
    return self.options.import
      ? {
        add: {
          import: {
            label: 'Import as {{ type }}',
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
            req.mode = 'draft';
            const { file } = req.files || {};

            if (!file) {
              throw self.apos.error('invalid');
            }

            const extension = file.name.split('.').pop();

            if (!self.importFormats[extension]) {
              throw self.apos.error('invalid');
            }

            const totalPieces = await self.importCountFileLines(file.path);

            req.body = { messages: req.body };

            return self.apos.modules['@apostrophecms/job'].run(
              req,
              (req, reporting, { notificationId }) => self.importRun(req, {
                progressNotifId: notificationId,
                filePath: file.path,
                reporting,
                totalPieces
              }),
              {}
            );
          }
        ]
      }
    };
  }
};
