const fs = require('fs');
const csvParse = require('csv-parse');
const readline = require('readline');

module.exports = (self) => {
  return {
    async importRun (req, reporting, { file, fileLinesCount }) {
      if (typeof reporting.setTotal === 'function') {
        reporting.setTotal(fileLinesCount);
      }
      const [ pieces, parsingErr ] = await parseCsvFile(file.path);

      if (parsingErr) {
        reporting.failure();
        unlinkFile(file.path);

        await self.apos.notification.trigger(req, parsingErr.message, {
          dismiss: true,
          icon: 'database-export-icon',
          type: 'error'
        });

        return;
      }

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
        await self.apos.notification.trigger(req, convertErrors.join('. '), {
          dismiss: true,
          icon: 'database-export-icon',
          type: 'error'
        });

        return;
      }

      for (const piece of piecesToImport) {
        try {
          self.insert(req, piece);

          reporting.success();
        } catch (err) {
          reporting.failure();
        }
      }

      await self.apos.notification.trigger(req, 'Imported {{ count }} {{ type }}.', {
        interpolate: {
          count: piecesToImport.length,
          type: req.t(self.pluralLabel)
        },
        dismiss: true,
        icon: 'database-export-icon',
        type: 'success'
      });

      unlinkFile(file.path);
    },
    async countFileLines (filePath) {
      return new Promise((resolve, reject) => {
        let linesCount = -1;
        const rl = readline.createInterface({
          input: fs.createReadStream(filePath),
          output: process.stdout,
          terminal: false
        });
        rl.on('line', function () {
          linesCount++;
        });
        rl.on('close', function () {
          resolve(linesCount);
        });
      });
    }
  };
};

function unlinkFile (path) {
  try {
    fs.unlinkSync(path);
  } catch (err) {
    self.apos.util.warn(`Uploaded temporary file ${path
    } was already removed, this should have been the responsibility of the upload route`);
  }
}

async function parseCsvFile (filePath) {
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
}
