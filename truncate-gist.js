"use strict";

module.exports = function truncateGist(html) {
  // WARNING: This doesn't differentiate between gist's table markup and your content inside it!
  html = html.replace(/\bfile-[^\s]*-L/gi, "L");
  html = html.replace(/\bblob-code\b/g, "b-c");
  html = html.replace(/\bblob-num\b/g, "b-n");
  html = html.replace(/\.blob-/g, ".b-");
  html = html.replace(/\.markdown-body/g, ".md-b");
  html = html.replace(/ data-line-number="(\d*)"/g, " data-ln=$1");
  html = html.replace(/([^\s]*)-line-number"/g, "$1-ln");
  html = html.replace(/([^\s]*)-file-line/g, "$1-fl");
  html = html.replace(/^\s+</g, "<");
  html +=
    "\n\n<!-- Gist HTML Mangled & Compressed by @justsml/gatsby-remark-embed-gist -->";
  return html;
};
