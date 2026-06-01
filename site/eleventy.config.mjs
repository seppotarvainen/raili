import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import markdownIt from "markdown-it";
import fs from "fs";
import path from "path";

const md = markdownIt({ html: true, linkify: true, typographer: true });

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);

  // Filter to render markdown strings to HTML
  eleventyConfig.addFilter("renderMarkdown", (content) => {
    return md.render(content || "");
  });

  // Copy static assets
  eleventyConfig.addPassthroughCopy("src/assets");

  // Extract title: first # heading that appears before any code fence
  function extractTitle(content, fallback) {
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.startsWith("```")) break;
      const match = line.match(/^# (.+)$/);
      if (match) return match[1];
    }
    return fallback;
  }

  // Pull in documentation files from ../documentation (excluding architecture/ and lsp/)
  const docsDir = path.resolve(import.meta.dirname, "../documentation");

  eleventyConfig.addCollection("docs", () => {
    const files = fs.readdirSync(docsDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith(".")
    );
    return files.map((file) => {
      const slug = file.replace(".md", "");
      const content = fs.readFileSync(path.join(docsDir, file), "utf-8");
      const title = extractTitle(content, slug.charAt(0).toUpperCase() + slug.slice(1));
      return { slug, title, content, inputPath: path.join(docsDir, file) };
    });
  });

  // Pull in usage docs
  const usageDir = path.join(docsDir, "usage");
  eleventyConfig.addCollection("usage", () => {
    if (!fs.existsSync(usageDir)) return [];
    const files = fs.readdirSync(usageDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith(".")
    );
    return files.map((file) => {
      const slug = file.replace(".md", "");
      const content = fs.readFileSync(path.join(usageDir, file), "utf-8");
      const title = extractTitle(content, slug.charAt(0).toUpperCase() + slug.slice(1));
      return { slug, title, content, inputPath: path.join(usageDir, file) };
    });
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}

