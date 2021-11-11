const fs = require('fs');
const csvParse = require('csv-parse');

module.exports = (self) => {
  return {
    async importRun (req, reporting, { file, pieces }) {
      if (typeof reporting.setTotal === 'function') {
        reporting.setTotal(pieces.length);
      }

      const piecesToImport = [];
      const convertErrors = [];

      for (const [ i, piece ] of pieces.entries()) {
        const csvLine = i + 2;
        try {

          const converted = {};
          await self.apos.schema.convert(req, self.schema, piece, converted);

          piecesToImport.push(converted);
        } catch (errors) {
          if (convertErrors.length < 10) {
            errors.forEach((err) => {
              convertErrors.push(`On line ${csvLine}, field ${err.path} is ${err.message}`);
            });
          }
        }
      }

      if (convertErrors.length) {
        return await self.stopProcess(req, {
          message: convertErrors.join('. '),
          filePath: file.path
        });
      }

      const importedCount = await importPieces(req, piecesToImport, reporting);

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
    }
  };

  async function importPieces(req, pieces, reporting) {
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
