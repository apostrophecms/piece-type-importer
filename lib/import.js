const fs = require('fs');
const csvParse = require('csv-parse');
const readline = require('readline');

const joinErrors = (errors) => errors
  .join(' ') + (errors.length === 10 ? '..' : '');

module.exports = (self) => {
  return {
    async importRun (req, {
      progressNotifId,
      filePath,
      reporting,
      totalPieces
    }) {

      if (typeof reporting.setTotal === 'function') {
        reporting.setTotal(totalPieces);
      }

      const {
        imported, updated, failed, errors, processedErr
      } = await self.importProcessStream(req, {
        filePath: filePath,
        reporting
      });

      if (processedErr) {
        return await self.importStopProcess(req, {
          message: processedErr,
          filePath: filePath,
          progressNotifId
        });
      }

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
        filePath: filePath,
        type: !failed ? 'success' : 'warning'
      });
    },

    async importCountFileLines (filePath) {
      return new Promise((resolve, reject) => {
        let linesCount = -1;
        const rl = readline.createInterface({
          input: fs.createReadStream(filePath),
          output: process.stdout,
          terminal: false
        });
        rl.on('line', (line) => {
          linesCount++;
        });
        rl.on('close', () => {
          resolve(linesCount);
        });
      });
    },

    async importProcessStream (req, { filePath, reporting }) {
      try {
        const parser = fs
          .createReadStream(filePath)
          .pipe(csvParse({
            columns: true
          }));

        const counter = {
          imported: 0,
          updated: 0,
          failed: 0
        };

        let processed = 0;
        let updateKey;
        let updateField;
        const errors = [];

        for await (const piece of parser) {
          const csvLine = processed + 2;

          if (!processed) {
            const { key, field } = self.importCheckIfUpdateKey(piece, filePath);

            updateKey = key;
            updateField = field;
          }

          try {
            const action = await self.importOrUpdatePiece(req, {
              piece,
              csvLine,
              updateKey,
              updateField
            });

            if (action === 'imported') {
              counter.imported++;
            }

            if (action === 'updated') {
              counter.updated++;
            }

            reporting.success();
          } catch (err) {
            if (errors.length < 10) {
              if (Array.isArray(err)) {
                err.forEach(({ path, message }) => {
                  errors.push(`On line ${csvLine}, field ${path} is ${message}.`);
                });
              } else {
                errors.push(err.message);
              }
            }
            counter.failed++;
            reporting.failure();
          }

          processed++;
        }

        return {
          ...counter,
          errors
        };
      } catch (processedErr) {
        return { processedErr: processedErr.message };
      }
    },

    async importStopProcess (req, {
      type = 'danger',
      message,
      interpolate = {},
      filePath,
      dismiss = true,
      progressNotifId
    }) {
      if (progressNotifId) {
        await self.apos.notification.dismiss(req, progressNotifId, 0);
      }

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

    async importOrUpdatePiece (req, {
      piece,
      csvLine,
      updateKey,
      updateField
    }) {
      const updateKeyValue = updateKey && piece[updateKey];

      if (!updateKeyValue) {
        const pieceToImport = {};

        await self.convert(req, piece, pieceToImport);
        await self.insert(req, pieceToImport);

        return 'imported';
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

      return 'updated';
    },

    importCheckIfUpdateKey (piece) {
      const [ key, ...rest ] = Object.keys(piece)
        .filter((key) => key.match(/:key$/));

      if (rest.length) {
        throw new Error('You can have only one key column for updates.');
      }

      return {
        key,
        field: key && key.replace(':key', '')
      };
    }
  };
};
