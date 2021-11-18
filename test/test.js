const assert = require('assert');
const path = require('path');
const testUtil = require('apostrophe/test-lib/test');

describe('Pieces Importer', function () {
  const goodCsvPath = path.join(process.cwd(), 'test/data/csv/articles.csv');
  const badCsvPath = path.join(process.cwd(), 'test/data/csv/articlesBad.csv');
  const missingFieldsCsvPath = path.join(process.cwd(), 'test/data/csv/articlesMissingFields.csv');
  const updateCsvPath = path.join(process.cwd(), 'test/data/csv/updateArticles.csv');
  const updateMultipleKeysPath = path.join(process.cwd(), 'test/data/csv/updateMultipleKeysArtices.csv');

  let apos;

  after(async () => {
    testUtil.destroy(apos);
  });

  this.timeout(10000);

  it('Should improve piece types on the apos object', async () => {
    apos = await testUtil.create({
      shortname: 'test-importer',
      testModule: true,
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 4242,
            trustProxy: true,
            apiKeys: {
              testKey: {
                role: 'admin'
              }
            },
            csrf: {
              exceptions: [
                '/api/v1/@apostrophecms/article/import'
              ]
            },
            session: { secret: 'test-the-importer' }
          }
        },
        '@apostrophecms/piece-type-importer': {},
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            import: true
          },
          fields: {
            add: {
              category: {
                type: 'string'
              }
            }
          }
        }
      }
    });

    const articleModule = apos.modules.article;

    assert(articleModule.__meta.name === 'article');
    assert(articleModule.options.import === true);
  });

  let piecesFromCsv;
  it('Should get pieces from a csv file', async () => {
    const [ pieces, parsingErr ] = await apos.modules.article.parseCsvFile(goodCsvPath);

    assert(pieces.length === 3);

    piecesFromCsv = pieces;

    const [ article1, article2, article3 ] = pieces;

    assert(!parsingErr);

    assert(article1.title === 'Article 1');
    assert(article1.category === 'book');

    assert(article2.title === 'Article 2');
    assert(article2.category === 'film');

    assert(article3.title === 'Article 3');
    assert(article3.category === 'toy');
  });

  it('Should return an error if the csv file is badly formatted', async () => {
    const [ pieces, parsingErr ] = await apos.modules.article.parseCsvFile(badCsvPath);

    assert(!pieces);
    assert(parsingErr);
    assert(parsingErr.message === 'Invalid Record Length: columns length is 2, got 5 on line 2');
  });

  it('Should convert and insert pieces from the read file', async () => {
    const req = apos.task.getReq();
    const self = apos.modules.article;

    let success = 0;
    let failures = 0;

    const reporting = {
      success: function () {
        success++;
      },
      failure: function () {
        failures++;
      }
    };

    const [ piecesToImport, convertErr ] = await self.convertPieces(req, { pieces: piecesFromCsv });

    assert(!convertErr.length);

    const { imported, updated } = await self.importOrUpdatePieces(req, {
      pieces: piecesToImport,
      reporting
    });

    assert(imported === 3);
    assert(updated === 0);
    assert(success === 3);
    assert(failures === 0);
  });

  it('Should fail to insert pieces if some cannot be converted', async () => {
    const req = apos.task.getReq();
    const self = apos.modules.article;

    const [ pieces, parsingErr ] = await self.parseCsvFile(missingFieldsCsvPath);

    assert(!parsingErr);
    assert(pieces.length === 3);

    const [ piecesToImport, convertErr ] = await self.convertPieces(req, { pieces });

    assert(piecesToImport.length === 2);
    assert(convertErr.length === 1);
    assert(convertErr[0] === 'On line 3, field title is required');
  });

  it('Should update existing pieces if a :key suffix is added to a field', async () => {
    const req = apos.task.getReq();
    const self = apos.modules.article;

    let success = 0;
    let failures = 0;

    const reporting = {
      success: function () {
        success++;
      },
      failure: function () {
        failures++;
      }
    };

    const [ pieces, parsingErr ] = await self.parseCsvFile(updateCsvPath);

    assert(!parsingErr);
    assert(pieces.length === 3);

    const {
      updateKey, updateField, updateKeyErr
    } = self
      .checkIfUpdateKey(pieces[0], '');

    assert(!updateKeyErr);
    assert(updateKey);
    assert(updateField);

    const [ piecesToImport, convertErr ] = await self.convertPieces(req, {
      pieces,
      updateField,
      updateKey
    });

    assert(!convertErr.length);
    assert(piecesToImport.length === 3);

    const { imported, updated } = await self.importOrUpdatePieces(req, {
      pieces: piecesToImport,
      reporting,
      updateField,
      existingFields: Object.keys(pieces[0])
    });

    assert(imported === 0);
    assert(updated === 3);
    assert(success === 3);
    assert(failures === 0);

    const articles = await apos.doc.db.find({ _id: /:draft/ }).toArray();

    articles.forEach((article) => {
      switch (article.title) {
        case 'Article 1':
          assert(article.category === 'clothes');
          break;

        case 'Article 2':
          assert(article.category === 'makeup');
          break;

        case 'Article 3':
          assert(article.category === 'toy');
          break;
      }
    });
  });

  it('It should stop the update process if must than one field contains a :key suffix.', async () => {
    const self = apos.modules.article;

    const [ pieces, parsingErr ] = await self.parseCsvFile(updateMultipleKeysPath);

    assert(!parsingErr);
    assert(pieces.length === 3);

    const {
      updateKeyErr
    } = self
      .checkIfUpdateKey(pieces[0], '');

    assert(updateKeyErr);
  });
});
