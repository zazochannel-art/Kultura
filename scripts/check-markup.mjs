/**
 * Structural markup guard for the shipped HTML pages.
 *
 * Why: removing the VIP-guests module left an orphan `</section>` behind. The
 * HTML parser drops an unmatched closing tag without a word, so the page still
 * rendered, the console stayed clean, and all 182 smoke checks passed. Nothing
 * we had could see it. Deletions like that will happen again — this catches the
 * leftovers.
 *
 * Deliberately narrow: it only balances the container tags we actually nest by
 * hand. It is not an HTML validator and must not grow into one.
 *
 * Run: node scripts/check-markup.mjs
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const TAGS = ['section', 'form', 'dialog', 'main', 'nav', 'table'];

const files = execSync("git ls-files '*.html'", { encoding: 'utf8' }).trim().split('\n');

let bad = 0;
for (const file of files) {
  // Comments and <script>/<style> bodies can hold tag-shaped text that is not
  // markup — the stray tag we are hunting for is never in there.
  const html = readFileSync(file, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');

  for (const tag of TAGS) {
    const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (open !== close) {
      console.error(`${file}: <${tag}> opened ${open}× but closed ${close}×`);
      bad++;
    }
  }
}

if (bad) {
  console.error(`\n${bad} unbalanced tag${bad === 1 ? '' : 's'}. An orphan closing tag is invisible at runtime — fix it here.`);
  process.exit(1);
}
console.log(`markup OK — ${files.length} pages, balanced on: ${TAGS.join(', ')}`);
