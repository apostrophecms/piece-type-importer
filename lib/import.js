const fs = require('fs');
const csvParse = require('csv-parse');

module.exports = (self) => {
  return {
    // My Import Method
    async importRun (req, file) {
      const [ _header, ...pieces ] = await parseCsvFile(file.path);

      for (const piece of pieces) {

        const converted = {};
        await self.apos.schema.convert(req, self.schema, piece, converted);
      }
    }
  };
};

function parseCsvFile (filePath) {
  // eslint-disable-next-line
  return new Promise(async (resolve, reject) => {
    const records = [];
    const parser = fs
      .createReadStream(filePath)
      .on('error', ({ message }) => reject(message))
      .pipe(csvParse({
        columns: true
        // skipEmptyLines: true
      }))
      .on('error', ({ message }) => reject(message));

    for await (const record of parser) {
      // Work with each record
      records.push(record);
    }

    resolve(records);
  });
}
