const fs = require('fs');
const csvParse = require('csv-parse');

const joinErrors = (errors) => errors
  .join(' ') + (errors.length === 10 ? '..' : '');

module.exports = (self) => {
  return {
    async importRun (req, reporting, { file, pieces }) {
      if (typeof reporting.setTotal === 'function') {
        reporting.setTotal(pieces.length);
      }

      const {
        updateKey, updateField, updateKeyErr
      } = self.importCheckIfUpdateKey(pieces[0], file.path);

      if (updateKeyErr) {
        return await self.importStopProcess(req, {
          message: updateKeyErr,
          filePath: file.path
        });
      }

      const convertErr = await self.importCheckForConvertErrors(req, {
        pieces,
        updateKey,
        updateField
      });

      if (convertErr.length) {
        return await self.importStopProcess(req, {
          message: joinErrors(convertErr),
          filePath: file.path
        });
      }

      const {
        imported, updated, failed, errors
      } = await self.importOrUpdatePieces(req, {
        pieces,
        reporting,
        updateField,
        updateKey
      });
      const importMsg = 'Imported {{ importedCount }} {{ typeImported }}. ';
      const updateMsg = 'Updated {{ updatedCount }} {{ typeUpdated }}. ';
      const failMsg = '{{ failedCount }} failed.';

      if (errors.length) {
        await self.apos.notification.trigger(req, joinErrors(errors), {
          dismiss: false,
          icon: 'database-export-icon',
          type: 'warning'
        });
      }

      return await self.importStopProcess(req, {
        message: `${imported ? importMsg : ''}${updated ? updateMsg : ''}${failed ? failMsg : ''}`,
        interpolate: {
          importedCount: imported,
          updatedCount: updated,
          failedCount: failed,
          typeImported: req.t(imported <= 1 ? self.label : self.pluralLabel),
          typeUpdated: req.t(updated <= 1 ? self.label : self.pluralLabel)
        },
        filePath: file.path,
        type: !failed ? 'success' : 'warning'
      });
    },

    async importParseCsvFile (filePath) {
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

    async importCheckForConvertErrors (req, {
      pieces, updateKey, updateField
    }) {
      const convertErr = [];

      for (const [ i, piece ] of pieces.entries()) {
        const csvLine = i + 2;
        try {
          const inputPiece = updateField && !piece[updateField]
            ? {
              ...piece,
              [updateField]: piece[updateKey]
            }
            : piece;

          await self.convert(req, inputPiece, {});
        } catch (errors) {
          if (Array.isArray(errors) && convertErr.length < 10) {
            errors.forEach((err) => {
              convertErr.push(`On line ${csvLine}, field ${err.path} is ${err.message}.`);
            });
          }
        }
      }

      return convertErr;
    },

    async importStopProcess (req, {
      type = 'danger',
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
      pieces, reporting, updateKey, updateField
    }) {
      const counter = {
        imported: 0,
        updated: 0,
        failed: 0
      };
      const errors = [];

      for (const [ i, piece ] of pieces.entries()) {
        try {
          const csvLine = i + 2;
          const updateKeyValue = updateKey && piece[updateKey];

          if (!updateKeyValue) {
            const pieceToImport = {};

            await self.convert(req, piece, pieceToImport);
            await self.insert(req, pieceToImport);

            counter.imported++;
            reporting.success();
            continue;
          }

          const existingPiece = await self.findForEditing(req, {
            aposMode: 'draft',
            [updateField]: updateKeyValue
          }).toObject();

          if (!existingPiece) {
            throw new Error(`No ${self.label} found with ${
              updateField} set to ${updateKeyValue} on line ${csvLine}.`);
          }

          if (!piece[updateField]) {
            piece[updateField] = updateKeyValue;
          }

          await self.convert(req, piece, existingPiece);
          await self.update(req, existingPiece);

          counter.updated++;
          reporting.success();

        } catch (err) {
          if (errors.length < 10) {
            errors.push(err.message);
          }
          counter.failed++;
          reporting.failure();
        }
      }

      return {
        ...counter,
        errors
      };
    },

    importCheckIfUpdateKey (piece) {
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
