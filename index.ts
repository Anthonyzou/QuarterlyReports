import { Command, InvalidArgumentError } from 'commander';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Company, type Filing, setIdentity } from 'sec-edgar-toolkit';
import { filingToMarkdown } from './utils.ts';
// https://www.npmjs.com/package/sec-edgar-toolkit?activeTab=readme

setIdentity('YourApp/1.0 (ou.anthony@pm.me)');

const REPORTS_DIR = join(import.meta.dirname, 'reports');
const REPORT_FORMS = ['10-K', '10-Q'];

async function reportsSince(ticker: string, since: string): Promise<Filing[]> {
  const company = await Company.lookup(ticker);
  // `since` only filters the recent-filings page; older pages fetched by
  // `deep` come back unfiltered, so filter by date here as well.
  const filings = await company.getFilings({
    form: REPORT_FORMS,
    since,
    deep: true,
  });
  return filings.filter((filing) => filing.filingDate >= since);
}

async function saveReport(ticker: string, filing: Filing): Promise<string> {
  const markdown = filingToMarkdown(await filing.text('html'));
  const year = filing.filingDate.slice(0, 4);
  const outDir = join(REPORTS_DIR, ticker, year);
  await mkdir(outDir, { recursive: true });
  const outFile = join(
    outDir,
    `${ticker}-${filing.formType}-${filing.filingDate}.md`,
  );
  await writeFile(outFile, markdown);
  return outFile;
}

function parseYears(value: string): number {
  const years = Number(value);
  if (!Number.isInteger(years) || years < 1) {
    throw new InvalidArgumentError('Must be a whole number of at least 1.');
  }
  return years;
}

await new Command()
  .name('reports')
  .description(`Download ${REPORT_FORMS.join(' and ')} filings as Markdown`)
  .argument('<ticker>', 'company ticker, e.g. AAPL', (value) =>
    value.trim().toUpperCase(),
  )
  .option(
    '-y, --years <n>',
    'calendar years of reports to download, counting this year',
    parseYears,
    1,
  )
  .action(async (ticker: string, { years }: { years: number }) => {
    const since = `${new Date().getFullYear() - years + 1}-01-01`;
    const filings = await reportsSince(ticker, since);
    if (filings.length === 0) {
      throw new Error(
        `No ${REPORT_FORMS.join('/')} filings for ${ticker} since ${since}`,
      );
    }
    for (const filing of filings) {
      console.log(`Saved ${await saveReport(ticker, filing)}`);
    }
  })
  .parseAsync();
