const fs = require('fs');
const csvParse = require('csv-parse');

module.exports = (self) => {
  return {
    async importRun (req, reporting, { file, pieces }) {
      if (typeof reporting.setTotal === 'function') {
        reporting.setTotal(pieces.length);
      }

      const [ piecesToImport, convertErr ] = await self.convertPieces(req, pieces);

      if (convertErr.length) {
        return await self.stopProcess(req, {
          message: convertErr.join('. '),
          filePath: file.path
        });
      }

      const importedCount = await self.importPieces(req, piecesToImport, reporting);

      return await self.stopProcess(req, {
        message: 'Imported {{ count }} {{ type }}.',
        interpolate: {
          count: importedCount,
          type: req.t(importedCount <= 1 ? self.label : self.pluralLabel)
        },
        filePath: file.path,
        type: 'success'
      });
    },

    async parseCsvFile (filePath) {
      try {
        const records = [];
        const parser = fs
          .createReadStream(filePath)
          .pipe(csvParse({
            columns: true
          }));

        for await (const record of parser) {
          records.push(record);
        }

        return [ records, null ];
      } catch (err) {
        return [ null, err ];
      }
    },

    async convertPieces (req, pieces) {
      const piecesToImport = [];
      const convertErr = [];

      for (const [ i, piece ] of pieces.entries()) {
        const csvLine = i + 2;
        try {

          const converted = {};
          await self.apos.schema.convert(req, self.schema, piece, converted);

          piecesToImport.push(converted);
        } catch (errors) {
          if (convertErr.length < 10) {
            errors.forEach((err) => {
              convertErr.push(`On line ${csvLine}, field ${err.path} is ${err.message}`);
            });
          }
        }
      }

      return [ piecesToImport, convertErr ];
    },

    async stopProcess (req, {
      type = 'error', message, interpolate = {}, filePath
    }) {
      await self.apos.notification.trigger(req, message, {
        interpolate,
        dismiss: true,
        icon: 'database-export-icon',
        type
      });

      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        self.apos.util.warn(`Uploaded temporary file ${filePath
        } was already removed, this should have been the responsibility of the import route`);
      }
    },

    async importPieces (req, pieces, reporting) {
      let importedCount = 0;

      for (const piece of pieces) {
        try {
          await self.insert(req, piece);

          reporting.success();
          importedCount++;
        } catch (err) {
          reporting.failure();
        }
      }

      return importedCount;
    }
  };
};
