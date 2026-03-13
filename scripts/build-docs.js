#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'documentation');
const outputFile = path.join(__dirname, '..', 'src', 'cli', 'generated-docs.ts');

// Read all markdown files
const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));

const topics = {};

files.forEach(file => {
  const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
  const lines = content.split('\n');

  // Find title (first # heading)
  const titleLine = lines.find(l => l.startsWith('# '));
  const title = titleLine ? titleLine.replace(/^# /, '').trim() : file.replace('.md', '');

  // Extract blockquote (first consecutive > lines)
  let blockquoteEnd = -1;
  let blockquoteStart = -1;
  const helpLines = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('>')) {
      if (blockquoteStart === -1) blockquoteStart = i;
      helpLines.push(lines[i].replace(/^> ?/, ''));
    } else if (blockquoteStart !== -1 && !lines[i].startsWith('>')) {
      blockquoteEnd = i;
      break;
    }
  }

  const help = helpLines.join('\n').trim();

  // Everything after the blockquote is docs content
  const docsContent = lines
    .slice(blockquoteEnd === -1 ? lines.length : blockquoteEnd)
    .join('\n')
    .trim();

  const topicKey = file.replace('.md', '');
  topics[topicKey] = {
    help,
    docs: docsContent
  };
});

// Generate TypeScript file
const helpTopics = Object.entries(topics)
  .map(entry => {
    const key = entry[0];
    const help = entry[1].help;
    const escaped = help.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `  ${key}: "${escaped}"`;
  })
  .join(',\n');

const docsSections = Object.entries(topics)
  .map(entry => {
    const key = entry[0];
    const docs = entry[1].docs;
    const escaped = docs.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `  ${key}: "${escaped}"`;
  })
  .join(',\n');

const availableTopics = Object.keys(topics);
const availableSections = Object.keys(topics);

const output = `// AUTO-GENERATED FILE: Do not edit manually
// Generated from documentation/ markdown files at build time
// Run: npm run build:docs

export const HELP_TOPICS: Record<string, string> = {
${helpTopics}
};

export const DOCS_SECTIONS: Record<string, string> = {
${docsSections}
};

export const AVAILABLE_TOPICS = [${availableTopics.map(t => `'${t}'`).join(', ')}];
export const AVAILABLE_SECTIONS = [${availableSections.map(s => `'${s}'`).join(', ')}];
`;

fs.writeFileSync(outputFile, output, 'utf-8');
console.log(`✓ Generated documentation from ${files.length} markdown files`);
console.log(`✓ Output: ${outputFile}`);
console.log(`Topics: ${Object.keys(topics).join(', ')}`);

