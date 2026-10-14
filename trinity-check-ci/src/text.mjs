// Untrusted text (file names, server messages) is reduced to printable ASCII before it reaches
// stdout, the job summary or the report, so it cannot forge workflow commands or Markdown.
export const safeText = (value, max = 200) => String(value).replace(/[^\x20-\x7e]/g, '?').slice(0, max);

export const markdownText = value => safeText(value).replace(/[\\`*_{}[\]<>()#+!|~&]/g, '\\$&');
