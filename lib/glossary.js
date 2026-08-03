const slugify = require("./slugify");

const DEFAULTS = {
  terms: {},
  idPrefix: "glossary-",
  cssClass: "glossary-term",
  autoLink: false,
  autoLinkOnce: true,
};

function normalizeTerms(terms) {
  const map = new Map();
  for (const [term, value] of Object.entries(terms)) {
    const definition = typeof value === "string" ? value : value.definition;
    const id = (typeof value === "object" && value.id) || undefined;
    map.set(term, { definition, id });
  }
  return map;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = function glossaryPlugin(eleventyConfig, userOptions = {}) {
  const options = { ...DEFAULTS, ...userOptions };
  const terms = normalizeTerms(options.terms);

  function termId(term) {
    const entry = terms.get(term);
    return options.idPrefix + slugify(entry?.id || term);
  }

  function renderTerm(term, label) {
    const entry = terms.get(term);
    if (!entry) {
      throw new Error(`glossary: unknown term "${term}"`);
    }
    const id = termId(term);
    const text = label || term;
    return `<dfn id="${id}" class="${options.cssClass}" title="${escapeAttr(
      entry.definition
    )}">${text}</dfn>`;
  }

  eleventyConfig.addShortcode("glossary", (term, label) => renderTerm(term, label));

  eleventyConfig.addShortcode("glossaryLink", (term, label) => {
    const entry = terms.get(term);
    if (!entry) {
      throw new Error(`glossary: unknown term "${term}"`);
    }
    const id = termId(term);
    const text = label || term;
    return `<a href="#${id}" class="${options.cssClass}-link">${text}</a>`;
  });

  eleventyConfig.addFilter("glossaryDefinition", (term) => {
    const entry = terms.get(term);
    return entry ? entry.definition : undefined;
  });

  eleventyConfig.addFilter("glossaryAutoLink", (content) => autoLink(content));

  if (options.autoLink) {
    eleventyConfig.addTransform("glossaryAutoLink", (content, outputPath) => {
      if (!outputPath || !outputPath.endsWith(".html")) return content;
      return autoLink(content);
    });
  }

  function autoLink(content) {
    let result = content;
    const seen = new Set();

    // Sort longest-first so multi-word terms match before their substrings.
    const sortedTerms = [...terms.keys()].sort((a, b) => b.length - a.length);

    for (const term of sortedTerms) {
      if (options.autoLinkOnce && seen.has(term)) continue;

      const pattern = new RegExp(
        `\\b(${escapeRegExp(term)})\\b(?![^<]*>)`,
        "i"
      );
      const match = result.match(pattern);
      if (!match) continue;

      const id = termId(term);
      const replacement = `<a href="#${id}" class="${options.cssClass}-link">${match[0]}</a>`;
      result = result.slice(0, match.index) + replacement + result.slice(match.index + match[0].length);
      seen.add(term);
    }

    return result;
  }
};

module.exports.slugify = slugify;
