// Stable adapter — do not edit.
// Documentation content lives in documentation/*.md and is compiled into
// generatedDocs.json at build time (npm run build:docs). Edit the .md files.
import data from './generatedDocs.json';
export const HELP_TOPICS: Record<string, string>   = data.helpTopics;
export const USAGE_HELP: Record<string, string>    = data.usageHelp;
export const DOCS_SECTIONS: Record<string, string> = data.docsSections;
export const USAGE_DOCS: Record<string, string>    = data.usageDocs;
export const AVAILABLE_TOPICS: string[]            = data.availableTopics;
export const AVAILABLE_SECTIONS: string[]          = data.availableSections;
export const AVAILABLE_USAGE: string[]             = data.availableUsage;
