const fs = require('fs');
const csvParse = require('csv-parse');

module.exports = (self) => {
  return {
    async importRun (req, reporting, { file, pieces }) {
      if (typeof reporting.setTotal === 'function') {
        reporting.setTotal(pieces.length);
      }

      const {
        updateKey, updateField, updateKeyErr
      } = self
        .checkIfUpdateKey(pieces[0], file.path);

      if (updateKeyErr) {
        return await self.stopProcess(req, {
          message: updateKeyErr,
          filePath: file.path
        });
      }

      const [ piecesToImport, convertErr ] = await self.convertPieces(req, {
        pieces,
        updateField,
        updateKey
      });

      if (convertErr.length) {
        return await self.stopProcess(req, {
          message: convertErr.join('. '),
          filePath: file.path
        });
      }

      const {
        imported, updated
      } = await self.importOrUpdatePieces(req, {
        pieces: piecesToImport,
        reporting,
        updateField
      });
      const importMsg = 'Imported {{ importedCount }} {{ typeImported }}. ';
      const updateMsg = 'Updated {{ updatedCount }} {{ typeUpdated }}.';

      return await self.stopProcess(req, {
        message: `${imported ? importMsg : ''}${updated ? updateMsg : ''}`,
        interpolate: {
          importedCount: imported,
          updatedCount: updated,
          typeImported: req.t(imported <= 1 ? self.label : self.pluralLabel),
          typeUpdated: req.t(updated <= 1 ? self.label : self.pluralLabel)
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
      pieces, updateField, updateKey
    }) {
      const piecesToImport = [];
      const convertErr = [];

      for (const [ i, piece ] of pieces.entries()) {
        const csvLine = i + 2;
        try {
          if (updateKey) {
            piece[updateField] = piece[updateKey];
            delete piece[updateKey];
          }

          const converted = {};

          const hasUpdateKeyField = updateKey && piece[updateField];

          await self.convert(req, piece, converted, { presentFieldsOnly: hasUpdateKeyField });

          delete converted.copyOfId;

          if (hasUpdateKeyField) {
            converted.toUpdate = true;
          }

          piecesToImport.push(converted);
        } catch (errors) {
          if (Array.isArray(errors) && convertErr.length < 10) {
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
      pieces, reporting, updateField
    }) {
      const counter = {
        imported: 0,
        updated: 0
      };

      for (const piece of pieces) {
        try {
          if (piece.toUpdate) {
            delete piece.toUpdate;
            const searchValue = piece[updateField];

            await self.apos.doc.db.findOneAndUpdate({
              _id: /:draft$/,
              [updateField]: searchValue
            }, {
              $set: piece
            });
            counter.updated++;
          } else {
            await self.insert(req, piece);
            counter.imported++;
          }

          reporting.success();
        } catch (err) {
          reporting.failure();
        }
      }

      return counter;
    },

    checkIfUpdateKey (piece) {
      const [ updateKey, ...rest ] = Object.keys(piece)
        .filter((key) => key.match(/:key$/));

      return !rest.length
        ? {
          updateKey,
          updateField: updateKey && updateKey.replace(':key', '')
        }
        : { updateKeyErr: 'You can have only one :key column for updates.' };
    }
  };
};
