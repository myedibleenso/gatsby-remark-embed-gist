import querystring from "querystring";

import cheerio from "cheerio";
import parse from "parse-numeric-range";
import fetch from "node-fetch";
import visit from "async-unist-util-visit";

// default base url
const baseUrl = "https://gist.github.com";

/**
 * @typedef {object} PluginOptions
 * @property {string} username the default gist user.
 * @property {string} secretToken the github secret access token.
 * @property {string} gistCssUrlAddress a string that represents the github default gist css url.
 * @property {boolean} truncate  reduce output size 15-35%
 * @property {boolean} includeDefaultCss flag indicating whether the github default gist css should be included
 * @property {boolean} gistDefaultCssInclude flag indicating whether the github default gist css should be included
 * @property {boolean} gistCssPreload flag indicating whether the github default gist css should be preloaded
 * @property {boolean} includeDefaultCss a flag indicating the default css should be included
 */

/**
 * @typedef {object} GistQuery
 * @property {string} file the file name.
 * @property {string|Array<number>} highlights the numbers to be highlighted.
 */

/**
 * Validates the query object is valid.
 * @param {GistQuery} query the query to be validated.
 * @returns {boolean} true if the query is valid; false otherwise.
 */
function isValid(query) {
  if (query == null) return false;
  if (query.file == null && query.highlights == null && query.lines == null) {
    return false;
  }

  // leaving this for future enhancements to the query object

  return true;
}

/**
 * Builds the query object.
 * This methods looks for anything that is after ? or # in the gist: directive.
 * ? is interpreted as a query string.
 * # is interpreted as a filename.
 * @param {string} value the value of the inlineCode block.
 * @returns {object} the query object.
 */
function getQuery(value) {
  const hash = value.includes("#");

  // this will give us
  // a) qs with length 0 - no file, no querystring
  // b) qs with length 1 - either a #file or a ?querystring
  // c) qs with length 2 - a #file and a ?querystring
  // d) qs with length > 2 - malformed
  const [, ...qs] = value.split(/[?#]/);

  // a) and d) are easy
  if (qs.length === 0) return { highlights: [], lines: [] };
  if (qs.length > 2) {
    throw new Error("Malformed query. Check your 'gist:' imports");
  }

  let query;

  // b) is tricky, could be a #file or a ?querystring
  if (qs.length === 1) {
    if (hash) {
      query = { file: qs[0] };
    } else if (qs[0].includes("=")) {
      query = querystring.parse(qs[0]);
    } else {
      throw new Error("Malformed query. Check your 'gist:' imports");
    }
  } else {
    query = { file: qs[0], ...querystring.parse(qs[1]) };
  }

  // at this point we have an object such as
  // {
  //   file?: string,
  //   highlights?: string || string[],
  //   lines?: string || string[]
  // }
  // so we validate
  if (!isValid(query)) {
    throw new Error("Malformed query. Check your 'gist:' imports");
  }

  // get the range of highlights to render
  let highlights = [];
  if (typeof query.highlights === "string") {
    highlights = parse(query.highlights);
  } else if (Array.isArray(query.highlights)) {
    highlights = query.highlights;
  }
  query.highlights = highlights;

  // get the range of lines to display
  let lines = [];
  if (typeof query.lines === "string") {
    lines = parse(query.lines);
  } else if (Array.isArray(query.lines)) {
    lines = query.lines;
  }
  query.lines = lines;

  return query;
}

/**
 * Builds the gist url.
 * @param {string} value the value of the inlineCode block.
 * @param {PluginOptions} options the options of the plugin.
 * @param {string} file the file to be loaded.
 * @returns {string} the gist url.
 */
function buildUrl(value, options, file) {
  const [gist] = value.split(/[?#]/);

  const [inlineUsername, id] =
    gist.indexOf("/") > 0 ? gist.split("/") : [null, gist];

  // username can come from inline code or options
  const username = inlineUsername || options.username;

  // checks for a valid username
  if (username == null || username.trim().length === 0) {
    throw new Error("Missing username information");
  }

  // checks for a valid id
  if (id == null || id.trim().length === 0) {
    throw new Error("Missing gist id information");
  }

  // builds the url and completes it with the file if any
  let url = `${baseUrl}/${username}/${id}.json`;
  if (file != null) {
    url += `?file=${file}`;
  }

  return url;
}

const handleError = (url) => (error) => {
  console.error(`Failed to load GitHub Gist: ${url}`, error);
  return null;
};

/**
 * Handles the markdown AST.
 * @param {{ markdownAST }} markdownAST the markdown abstract syntax tree.
 * @param {PluginOptions} options the options of the plugin.
 * @returns {*} the markdown ast.
 */
export default async ({ markdownAST }, options = {}) => {
  // this returns a promise that will fulfill immediately for everything
  // that is not an inlineCode that starts with `gist:`
  return await visit(markdownAST, "inlineCode", async (node) => {
    // validate pre-requisites.
    if (!node.value.startsWith("gist:")) return;

    // get the query string and build the url
    const query = getQuery(node.value.substring(5));
    const url = buildUrl(node.value.substring(5), options, query.file);

    // call the gist and update the node type and value
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        // "application/vnd.github.v3.html+json",
        Authorization: `Bearer ${options.secretToken}`
      }
    }).catch(handleError(url));
    const content = response ? await response.json() : {};

    let html = content.div;
    const truncate = Boolean(query.truncate) || Boolean(options.truncate);
    const hasLines = query.lines.length > 0;
    const hasHighlights = query.highlights.length > 0;

    if (hasHighlights || hasLines) {
      const $ = cheerio.load(html);
      const file = query.file
        ? query.file
            .replace(/^\./, "")
            .replace(/[^a-zA-Z0-9_]+/g, "-")
            .toLowerCase()
        : "";
      const selectorPrefix = truncate ? "#LC" : `#file-${file}-LC`;

      // highlight the specify lines, if any
      if (hasHighlights) {
        query.highlights.forEach((line) => {
          $(`${selectorPrefix}${line}`).addClass("highlighted");
        });
      }

      // remove the specific lines, if any
      if (hasLines) {
        const codeLines = parse(`1-${$("table tr").length}`);
        codeLines.forEach((line) => {
          if (query.lines.includes(line)) return;

          $(`${selectorPrefix}${line}`).parent().remove();
        });
      }

      html = $.html({ decodeEntities: false, normalizeWhitespace: true });
    }

    if (truncate) {
      html = truncateGist(html);
    }

    node = Object.assign(node, {
      type: "html",
      value: html.trim()
    });

    return markdownAST;
  });
};

// /**
//  * Shrinks size of HTML returned by the GitHub/Gist API.
//  * @param {string} html input HTML
//  * @param {boolean} [testing=false] only for tests, omits attribution comment.
//  * @returns {string} the mangled/truncated HTML.
//  */
// export function truncateGist(html, testing = false) {
//   // WARNING: This doesn't differentiate between gist's table markup and your content inside it!
//   html = html.replace(/\bfile-[^\s]*-L/gi, "L");
//   html = html.replace(/\bblob-code\b/g, "b-c");
//   html = html.replace(/\bblob-num\b/g, "b-n");
//   html = html.replace(/\bblob-/g, "b-");
//   html = html.replace(/\bmarkdown-body/g, "md-b");
//   html = html.replace(/ data-line-number="(\d*)"/g, " data-ln=$1");
//   html = html.replace(/([^\s]*)-line-number/g, "$1-ln");
//   html = html.replace(/([^\s]*)-file-line/g, "$1-fln");
//   html = html.replace(/^\s+</g, "<");
//   if (!testing)
//     html +=
//       "\n\n<!-- Gist HTML loaded by @justsml/gatsby-remark-embed-gist -->";
//   return html;
// }
/**
 * Shrinks size of HTML returned by the GitHub/Gist API.
 * @param {string} html input HTML
 * @param {boolean} [testing=false] only for tests, omits attribution comment.
 * @returns {string} the mangled/truncated HTML.
 */
export function truncateGist(html, testing = false) {
  // WARNING: This doesn't differentiate between gist's table markup and your content inside it!
  html = replaceAll(html, /\bfile-[^\s]*-L/gim, "L");
  html = replaceAll(html, /\bblob-code\b/gm, "b-c");
  html = replaceAll(html, /\bblob-num\b/gm, "b-n");
  html = replaceAll(html, /\bblob-/gm, "b-");
  html = replaceAll(html, /\bmarkdown-body/gm, "md-b");
  html = replaceAll(html, /\bdata-line-number=/gm, "data-ln=");
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
