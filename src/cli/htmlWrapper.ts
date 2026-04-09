export function wrapMermaidInHtml(mermaidSyntax: string): string {
  // Minimal HTML document embedding Mermaid via CDN and initializing it on load
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Raili Workflow Diagram</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>document.addEventListener('DOMContentLoaded', function(){ if(window.mermaid) mermaid.initialize({startOnLoad:true}); });</script>
  <style>body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding: 12px;}</style>
</head>
<body>
  <div class="mermaid">
${mermaidSyntax}
  </div>
</body>
</html>`;
}
