/**
 * Shrinks size of HTML returned by the GitHub/Gist API.
 * @param {string} html input HTML
 * @param {boolean} [testing=false] only for tests, omits attribution comment.
 * @returns {string} the mangled/truncated HTML.
 */
export default function truncateGist(html, testing = false) {
  // WARNING: This doesn't differentiate between gist's table markup and your content inside it!
  html = replaceAll(html, /\bfile-[^\s]*-L/gim, "L");
  html = replaceAll(html, /\bblob-code\b/gm, "b-c");
  html = replaceAll(html, /\bblob-num\b/gm, "b-n");
  html = replaceAll(html, /\bblob-/gm, "b-");
  html = replaceAll(html, /\bmarkdown-body/gm, "md-b");
  html = replaceAll(html, / data-line-number="(\d*)"/gm, " data-ln=$1");
  html = replaceAll(html, /([^\s]*)-line-number/gm, "$1-ln");
  html = replaceAll(html, /([^\s]*)-file-line/gm, "$1-fln");
  html = replaceAll(html, /^\s+</gm, "<");

  html = replaceAll(html, /^\s+$\n/gim, "\n");
  if (!testing)
    html +=
      "\n\n<!-- Gist HTML Mangled & Compressed by @justsml/gatsby-remark-embed-gist -->";
  return html;
}

const replaceAll = (str, pattern, replace) => {
  const result = str.replace(pattern, replace);
  if (result === str) return result;
  return replaceAll(result, pattern, replace);
};
