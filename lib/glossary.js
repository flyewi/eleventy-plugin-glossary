const slugify = require("./slugify");

const DEFAULTS = {
  terms: {},
  idPrefix: "glossary-",
  cssClass: "glossary-term",
  autoLink: false,
  autoLinkOnce: true,
  collectionTag: "glossaryTerm",
  defaultLanguage: undefined,
  autoLinkPages: false,
  autoLinkPagesOnce: true,
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

// Restricts a content transform to the <body> of a page, so auto-linking never
// rewrites text inside <title>, <head>, or other non-body markup.
function replaceInBody(content, transform) {
  const bodyOpenMatch = content.match(/<body[^>]*>/i);
  const bodyCloseIndex = content.lastIndexOf("</body>");
  if (!bodyOpenMatch || bodyCloseIndex === -1) return transform(content);

  const bodyStart = bodyOpenMatch.index + bodyOpenMatch[0].length;
  const before = content.slice(0, bodyStart);
  const body = content.slice(bodyStart, bodyCloseIndex);
  const after = content.slice(bodyCloseIndex);
  return before + transform(body) + after;
}

// True if `index` in `text` falls inside the text content of an already-open
// <a> element, i.e. the nearest preceding <a> open tag is closer than the
// nearest preceding </a>. Prevents auto-linking from wrapping text that is
// already a link's label in a second, nested <a>. Matches "<a>"/"<a href=…>"
// but not tags like "<article>" or "<abbr>" that merely start with "<a".
function isInsideAnchor(text, index) {
  const before = text.slice(0, index);

  let lastOpen = -1;
  for (const m of before.matchAll(/<a(?=[\s>])/gi)) lastOpen = m.index;

  let lastClose = -1;
  for (const m of before.matchAll(/<\/a\s*>/gi)) lastClose = m.index;

  return lastOpen > lastClose;
}

// Finds the first occurrence of `label` in `text` that both (a) isn't inside
// an HTML tag/attribute (the `(?![^<]*>)` lookahead) and (b) isn't already
// inside an <a>...</a>. Returns a RegExp match object, or null.
function findLinkableMatch(text, label) {
  const pattern = new RegExp(`\\b(${escapeRegExp(label)})\\b(?![^<]*>)`, "gi");
  let match;
  while ((match = pattern.exec(text))) {
    if (!isInsideAnchor(text, match.index)) return match;
  }
  return null;
}

// Groups a glossary collection by the first letter of each item's `title`
// (uppercased, diacritics folded so "Ä" groups under "A"). Returns an array of
// `{ letter, terms }` sorted alphabetically, one entry per letter present.
// Exported standalone so it can also be used from an Eleventy `pagination.before`
// hook (e.g. to build one page per letter) outside of the filter pipeline.
function groupByLetter(items) {
  if (!Array.isArray(items)) return [];

  const groups = new Map();
  for (const item of items) {
    const title = (item.data && item.data.title) || "";
    const letter =
      title
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .charAt(0)
        .toUpperCase() || "#";
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(item);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, terms]) => ({ letter, terms }));
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

  // Collection of individually-authored glossary pages (e.g. src/glossar/*.md),
  // each tagged with `options.collectionTag` in its frontmatter. This lets each
  // term live at its own SEO-friendly permalink instead of the shared `terms` map.
  // Captured in `glossaryPages` too, so the autoLinkPages transform below (which
  // runs after collections are built, but has no direct `collections.*` access)
  // can link mentions to these pages without the site author re-declaring terms.
  let glossaryPages = [];
  eleventyConfig.addCollection("glossaryTerms", (collectionApi) => {
    glossaryPages = collectionApi
      .getFilteredByTag(options.collectionTag)
      .sort((a, b) => (a.data.title || "").localeCompare(b.data.title || ""));
    return glossaryPages;
  });

  if (options.autoLinkPages) {
    eleventyConfig.addTransform("glossaryAutoLinkPages", function (content, outputPath) {
      if (!outputPath || !outputPath.endsWith(".html")) return content;
      const pageCtx = (this && this.page) || {};
      return autoLinkPages(content, pageCtx.url, pageCtx.lang);
    });
  }

  // Auto-links first mentions of each glossary page's `title` (or any of its
  // `synonyms`) to that page's own URL (rather than an in-page anchor), and
  // tags the link with a `data-tooltip` attribute holding its `description` —
  // pair with a CSS `[data-tooltip]:hover` rule to show the definition on
  // hover without any JS. When the current page has a `lang` (via Eleventy's
  // i18n plugin) and glossary pages are localized, only same-language pages
  // are linked. Only the first-matching label per page is linked, and a label
  // already turned into a link is never matched again — this also prevents
  // two different pages that happen to share an identical label (e.g. the
  // same English/German loanword "SEO") from producing nested <a> tags.
  function autoLinkPages(content, currentUrl, currentLang) {
    let candidatePages = glossaryPages.filter(
      (page) => page.data.title && page.url !== currentUrl
    );
    // Unlike `glossaryByLocale` (which falls back to another language so an
    // overview page still shows something), a mismatched fallback here would
    // silently link a page's own-language prose to a foreign-language
    // definition — so if localized pages exist, only ever link same-language
    // ones, even if that means linking nothing.
    if (currentLang && candidatePages.some((page) => page.page && page.page.lang)) {
      candidatePages = candidatePages.filter((page) => page.page.lang === currentLang);
    }

    const candidates = [];
    for (const page of candidatePages) {
      for (const label of [page.data.title, ...(page.data.synonyms || [])]) {
        candidates.push({ label, page });
      }
    }
    candidates.sort((a, b) => b.label.length - a.label.length);

    const linkedPages = new Set();
    const linkedLabels = new Set();

    return replaceInBody(content, (body) => {
      let result = body;
      for (const { label, page } of candidates) {
        const labelKey = label.toLowerCase();
        if (
          options.autoLinkPagesOnce &&
          (linkedPages.has(page.url) || linkedLabels.has(labelKey))
        ) {
          continue;
        }

        const match = findLinkableMatch(result, label);
        if (!match) continue;

        const tooltip = escapeAttr(page.data.description || "");
        const replacement = `<a href="${page.url}" class="${options.cssClass}-link" data-tooltip="${tooltip}">${match[0]}</a>`;
        result = result.slice(0, match.index) + replacement + result.slice(match.index + match[0].length);
        linkedPages.add(page.url);
        linkedLabels.add(labelKey);
      }
      return result;
    });
  }

  // Resolves a page's `related` frontmatter (an array of glossary term
  // filenames, e.g. `related: ["seo", "html"]`) to the matching entries in
  // `collections.glossaryTerms`, so a layout can render "related terms" links:
  //   {% for term in related | glossaryRelated(collections.glossaryTerms) %}
  eleventyConfig.addFilter("glossaryRelated", (related, allTerms) => {
    if (!Array.isArray(related) || !Array.isArray(allTerms)) return [];

    const bySlug = new Map();
    for (const page of allTerms) {
      bySlug.set(page.data.slug || page.fileSlug, page);
    }
    return related.map((slug) => bySlug.get(slug)).filter(Boolean);
  });

  // Filters a glossary collection down to one language, for use with Eleventy's
  // bundled i18n plugin (`EleventyI18nPlugin`), which derives `page.lang` from
  // the language code in a page's URL (e.g. `/en/...`) — the localized page's
  // permalink must start with its language code for this to work. Falls back
  // to `options.defaultLanguage` if no page matches the requested language,
  // and passes items through unchanged if i18n isn't in use (no `page.lang`).
  eleventyConfig.addFilter("glossaryByLocale", (items, lang) => {
    if (!lang || !Array.isArray(items)) return items;
    if (!items.some((item) => item.page && item.page.lang)) return items;

    const matches = items.filter((item) => item.page.lang === lang);
    if (matches.length) return matches;

    if (options.defaultLanguage) {
      return items.filter((item) => item.page.lang === options.defaultLanguage);
    }
    return matches;
  });

  // Groups a glossary collection by first letter, for building an A-Z overview
  // page with a jump-to-letter navigation bar (see `groupByLetter` above).
  eleventyConfig.addFilter("glossaryGroupByLetter", groupByLetter);

  // Renders a schema.org DefinedTerm JSON-LD <script> tag from page frontmatter,
  // for use in a glossary page layout, e.g.:
  //   {% glossaryJsonLd title, description, synonyms %}
  eleventyConfig.addShortcode(
    "glossaryJsonLd",
    (term, definition, synonyms, url) => {
      const data = {
        "@context": "https://schema.org",
        "@type": "DefinedTerm",
        name: term,
        description: definition,
      };
      if (synonyms) {
        data.alternateName = Array.isArray(synonyms) ? synonyms : [synonyms];
      }
      if (url) data.url = url;
      return `<script type="application/ld+json">${JSON.stringify(
        data
      )}</script>`;
    }
  );

  function autoLink(content) {
    const seen = new Set();

    // Sort longest-first so multi-word terms match before their substrings.
    const sortedTerms = [...terms.keys()].sort((a, b) => b.length - a.length);

    return replaceInBody(content, (body) => {
      let result = body;
      for (const term of sortedTerms) {
        if (options.autoLinkOnce && seen.has(term)) continue;

        const match = findLinkableMatch(result, term);
        if (!match) continue;

        const id = termId(term);
        const replacement = `<a href="#${id}" class="${options.cssClass}-link">${match[0]}</a>`;
        result = result.slice(0, match.index) + replacement + result.slice(match.index + match[0].length);
        seen.add(term);
      }
      return result;
    });
  }
};

module.exports.slugify = slugify;
module.exports.groupByLetter = groupByLetter;
