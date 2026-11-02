import TurndownService from 'turndown';

const XBRL_HEADER = /<ix:header>[\s\S]*?<\/ix:header>/g;

function cellText(cell: Element): string {
  for (const br of Array.from(cell.querySelectorAll('br'))) br.replaceWith(' ');
  return (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
}

// SEC tables put "$", the number, and a closing ")" or "%" in separate cells.
// A blank first cell is the row-label column, kept so header rows line up with data rows.
function compactRow(cells: string[]): string[] {
  const out: string[] = cells[0] === '' && cells.some(Boolean) ? [''] : [];
  for (const cell of cells) {
    if (!cell) continue;
    const last = out.length - 1;
    const closesPrevious =
      /^[)%]+$/.test(cell) && last >= 0 && out[last] !== '';
    if (closesPrevious || out[last] === '$') {
      out[last] += cell;
    } else {
      out.push(cell);
    }
  }
  return out;
}

function tableToMarkdown(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll('tr'), (tr) =>
    compactRow(Array.from(tr.querySelectorAll('td, th'), cellText)),
  ).filter((row) => row.length > 0);
  if (rows.length === 0) return '';

  const width = Math.max(...rows.map((row) => row.length));
  if (width === 1) return `\n\n${rows.map((row) => row[0]).join('\n\n')}\n\n`;

  const line = (row: string[]) =>
    `| ${[...row, ...Array<string>(width - row.length).fill('')]
      .map((cell) => cell.replace(/\|/g, '\\|'))
      .join(' | ')} |`;
  const [header, ...body] = rows;
  return `\n\n${[line(header || []), `|${' --- |'.repeat(width)}`, ...body.map(line)].join('\n')}\n\n`;
}

export function filingToMarkdown(html: string): string {
  const turndown = new TurndownService({ headingStyle: 'atx' });
  turndown.remove(['hr', 'img']);
  turndown.remove((node) =>
    /display:\s*none/.test(node.getAttribute('style') ?? ''),
  );
  turndown.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => tableToMarkdown(node as HTMLElement),
  });
  turndown.addRule('styledBold', {
    filter: (node) =>
      node.nodeName === 'SPAN' &&
      /font-weight:\s*(700|bold)/.test(node.getAttribute('style') ?? ''),
    replacement: (content) => {
      const [, lead, text, trail] =
        content.match(/^(\s*)([\s\S]*?)(\s*)$/) ?? [];
      return text ? `${lead}**${text}**${trail}` : content;
    },
  });

  return turndown
    .turndown(html.replace(XBRL_HEADER, ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
