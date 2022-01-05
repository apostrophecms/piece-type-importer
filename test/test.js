const assert = require('assert');
const path = require('path');
const testUtil = require('apostrophe/test-lib/test');

describe('Pieces Importer', function () {
  const goodCsvPath = path.join(process.cwd(), 'test/data/csv/articles.csv');
  const badCsvPath = path.join(process.cwd(), 'test/data/csv/articlesBad.csv');
  const missingFieldsCsvPath = path.join(process.cwd(), 'test/data/csv/articlesMissingFields.csv');
  const updateCsvPath = path.join(process.cwd(), 'test/data/csv/updateArticles.csv');
  const updateMultipleKeysPath = path.join(process.cwd(), 'test/data/csv/updateMultipleKeysArtices.csv');

  this.timeout(10000);

  let apos, self, req;

  let success, failures, reporting;
  beforeEach(async () => {
    success = 0;
    failures = 0;

    reporting = {
      success: () => {
        success++;
      },
      failure: () => {
        failures++;
      }
    };
  });

  after(() => {
    testUtil.destroy(apos);
  });

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

    self = apos.modules.article;
    req = apos.task.getReq();

    assert(self.__meta.name === 'article');
    assert(self.options.import === true);
  });

  it('Should count the items of a csv file', async () => {
    const totalPieces = await self.importCountFileLines(goodCsvPath);

    assert(totalPieces === 3);
  });

  it('Should return an error if the csv file is badly formatted', async () => {
    const {
      processedErr
    } = await self.importProcessStream(req, {
      filePath: badCsvPath,
      reporting
    });

    assert(processedErr === 'Invalid Record Length: columns length is 2, got 5 on line 2');
  });

  it('Should convert and insert pieces from the read file', async () => {
    const {
      imported, updated, failed, errors, processedErr
    } = await self.importProcessStream(req, {
      filePath: goodCsvPath,
      reporting
    });

    assert(!errors.length);
    assert(!processedErr);
    assert(imported === 3);
    assert(updated === 0);
    assert(failed === 0);
    assert(success === 3);
    assert(failures === 0);
  });

  it('Should fail to insert pieces if they cannot be converted', async () => {
    const {
      imported, updated, failed, errors, processedErr
    } = await self.importProcessStream(req, {
      filePath: missingFieldsCsvPath,
      reporting
    });

    assert(imported === 0);
    assert(updated === 0);
    assert(failed === 3);
    assert(!processedErr);
    assert(errors[0] === 'On line 2, field title is required.');
    assert(errors[1] === 'On line 3, field title is required.');
    assert(errors[2] === 'On line 4, field title is required.');
  });

  it('Should update existing pieces if a :key suffix is added to a field', async () => {
    req.mode = 'draft';

    const {
      imported, updated, failed, errors, processedErr
    } = await self.importProcessStream(req, {
      filePath: updateCsvPath,
      reporting
    });

    assert(!processedErr);
    assert(!errors.length);
    assert(imported === 0);
    assert(updated === 3);
    assert(failed === 0);
    assert(success === 3);
    assert(failures === 0);

    const articles = await self.find(req, {
      aposMode: 'draft'
    }).toArray();

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

    req.mode = 'published';
  });

  it('It should stop the update process if more than one field contains a :key suffix.', async () => {
    const {
      processedErr
    } = await self.importProcessStream(req, {
      filePath: updateMultipleKeysPath,
      reporting
    });

    assert(processedErr);
    assert(processedErr === 'You can have only one key column for updates.');
  });
});
