const fs = require('fs');
const csvParse = require('csv-parse');

module.exports = (self) => {
  return {
    async importRun (req, reporting, { file, pieces }) {
      if (typeof reporting.setTotal === 'function') {
        reporting.setTotal(pieces.length);
      }

      const [ updateKey, updateKeyErr ] = self.checkIfUpdateKey(pieces[0], file.path);

      if (updateKeyErr) {
        return await self.stopProcess(req, {
          message: updateKeyErr,
          filePath: file.path
        });
      }

      const fieldUpdate = updateKey.replace(':key', '');

      const [ piecesToImport, convertErr ] = await self.convertPieces(req, {
        pieces,
        fieldUpdate,
        updateKey
      });

      // return await self.stopProcess(req, {
      //   message: 'ta mere',
      //   filePath: file.path
      // });

      if (convertErr.length) {
        return await self.stopProcess(req, {
          message: convertErr.join('. '),
          filePath: file.path
        });
      }

      const importedCount = await self.importOrUpdatePieces(req, {
        piecesToImport,
        reporting,
        fieldUpdate
      });

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

    async convertPieces (req, {
      pieces, fieldUpdate, updateKey
    }) {
      const piecesToImport = [];
      const convertErr = [];

      for (const [ i, piece ] of pieces.entries()) {
        const csvLine = i + 2;
        try {
          if (updateKey) {
            piece[fieldUpdate] = piece[updateKey];
            delete piece[updateKey];
          }

          const converted = {};
          await self.apos.schema.convert(req, self.schema, piece, converted);

          if (converted[fieldUpdate]) {
            converted.toUpdate = true;
          }

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
      type = 'error',
      message,
      interpolate = {},
      filePath,
      dismiss = true
    }) {
      await self.apos.notification.trigger(req, message, {
        interpolate,
        dismiss,
        icon: 'database-export-icon',
        type
      });

      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        self.apos.util.warn(`Uploaded temporary file ${filePath
        } was already removed, this should have been the responsibility of the import route function.`);
      }
    },

    async importOrUpdatePieces (req, {
      pieces, reporting, fieldUpdate
    }) {
      let importedCount = 0;

      for (const piece of pieces) {
        try {
          if (piece.toUpdate) {
            delete piece.toUpdate;
            await self.update(req, piece);
          } else {
            await self.insert(req, piece);
          }

          reporting.success();
          importedCount++;
        } catch (err) {
          reporting.failure();
        }
      }

      return importedCount;
    },

    checkIfUpdateKey (piece) {
      const [ key, ...rest ] = Object.keys(piece)
        .filter((key) => key.match(/:key$/));

      return !rest.length
        ? [ key, null ]
        : [ null, 'You can have only one :key column for updates.' ];
    }
  };
};
