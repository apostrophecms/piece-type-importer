const assert = require('assert');
const path = require('path');
const testUtil = require('apostrophe/test-lib/test');

describe('Pieces Importer', function () {
  let apos;

  after(async () => {
    testUtil.destroy(apos);
  });

  this.timeout(10000);

  it('should improve piece types on the apos object', async () => {
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
              richText: {
                type: 'area',
                widgets: {
                  '@apostrophecms/rich-text': {}
                }
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

  const goodCsvPath = path.join(process.cwd(), 'test/data/csv/articles.csv');
  const badCsvPath = path.join(process.cwd(), 'test/data/csv/articlesBad.csv');
  const missingFieldsCsvPath = path.join(process.cwd(), 'test/data/csv/articlesMissingFields.csv');

  let piecesFromCsv;
  it('should get pieces from a csv file', async () => {
    const [ pieces, parsingErr ] = await apos.modules.article.parseCsvFile(goodCsvPath);

    piecesFromCsv = pieces;

    const [ article1, article2, article3 ] = pieces;

    assert(!parsingErr);

    assert(article1.title === 'Article 1');
    assert(article1.seoTitle === 'first article');

    assert(article2.title === 'Article 2');
    assert(article2.seoTitle === 'second article');

    assert(article3.title === 'Article 3');
    assert(article3.seoTitle === 'third article');
  });

  it('should return an error if the csv file is badly formatted', async () => {
    const [ pieces, parsingErr ] = await apos.modules.article.parseCsvFile(badCsvPath);

    assert(!pieces);
    assert(parsingErr);
    assert(parsingErr.message === 'Invalid Record Length: columns length is 2, got 5 on line 2');
  });

  it('should insert pieces from the read file', async () => {
    const req = apos.task.getReq();

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

    const self = apos.modules.article;

    const importedCount = await self.importPieces(req, piecesFromCsv, reporting);

    assert(importedCount === 3);
    assert(success === 3);
    assert(failures === 0);
  });

  it('should fail to insert pieces if some cannot be converted', async () => {
    const req = apos.task.getReq();
    const self = apos.modules.article;

    const [ pieces, parsingErr ] = await self.parseCsvFile(missingFieldsCsvPath);

    assert(!parsingErr);
    assert(pieces.length === 3);

    const [ piecesToImport, convertErr ] = await self.convertPieces(req, pieces);

    assert(piecesToImport.length === 2);
    assert(convertErr.length === 1);
    assert(convertErr[0] === 'On line 3, field title is required');
  });
});
