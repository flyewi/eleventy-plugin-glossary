# eleventy-plugin-glossary

An [Eleventy](https://www.11ty.dev/) plugin for building a glossary of terms and referencing them
throughout your content. It supports two complementary ways of working:

- **A central `terms` map** — define terms in your Eleventy config and drop them into content with
  shortcodes, or auto-link first mentions across the whole site.
- **Individually-authored glossary pages** — one Markdown file per term, each with its own SEO-friendly
  URL, `DefinedTerm` JSON-LD, synonyms, related-terms links, and (optionally) automatic cross-site linking
  with hover tooltips.

Both modes can be used together or independently, and everything works with plain Eleventy — no build
step, no client-side JavaScript required for any of the core features.

## Features

- `{% glossary %}` / `{% glossaryLink %}` shortcodes and a `glossaryDefinition` filter for a small,
  config-driven glossary.
- Auto-linking of first mentions, either from the config `terms` map (`autoLink`) or from full
  individually-authored glossary pages (`autoLinkPages`) — both are transforms, so no template changes are
  required to enable them.
- One Markdown file per term with its own permalink, collected automatically into
  `collections.glossaryTerms`.
- `schema.org` [`DefinedTerm`](https://schema.org/DefinedTerm) JSON-LD via the `glossaryJsonLd` shortcode.
- Synonyms (`synonyms` front matter, searched by auto-linking too) and related terms (`related` front
  matter + `glossaryRelated` filter).
- A-Z grouping (`glossaryGroupByLetter`) for building an alphabet-navigation overview page, with an
  exported `groupByLetter` helper for paginating one page per letter.
- Works with Eleventy's bundled `EleventyI18nPlugin` (`glossaryByLocale` filter, language-aware
  auto-linking).
- Plays well with [Pagefind](https://pagefind.app/) for a glossary-only search index that doesn't touch a
  site-wide search (via Pagefind's own `data-pagefind-body` scoping — no special support needed from this
  plugin).
- Zero dependencies, defensive HTML handling (auto-linking never rewrites `<title>`/`<head>` content and
  never nests `<a>` tags around text that's already linked).

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Options](#options)
- [API reference](#api-reference)
  - [Shortcodes](#shortcodes)
  - [Filters](#filters)
  - [Transforms](#transforms)
  - [Collections](#collections)
  - [Module exports](#module-exports)
- [Guide: individual glossary pages](#individual-glossary-pages-own-url-json-ld-seo)
- [Guide: internationalization (i18n)](#internationalization-i18n)
- [Guide: A-Z navigation & overview page](#a-z-navigation--overview-page)
- [Guide: automatic linking with tooltips](#automatic-linking-with-tooltips)
- [Guide: synonyms & related terms](#synonyms--related-terms)
- [Guide: search with Pagefind](#search-with-pagefind-glossary-only)
- [Demo](#demo)
- [Development](#development)

## Installation

```bash
npm install eleventy-plugin-glossary
```

```js
// .eleventy.js
const glossaryPlugin = require("eleventy-plugin-glossary");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(glossaryPlugin, {
    terms: {
      Eleventy: "A simpler static site generator.",
      SSG: { definition: "Static Site Generator", id: "ssg" },
    },
    autoLink: true, // automatically link first mention of each term in HTML output
  });
};
```

This is the minimal, config-driven setup. For full glossary pages with their own URLs, see
[Individual glossary pages](#individual-glossary-pages-own-url-json-ld-seo) below — that mode needs no
`terms` option at all.

## Quick start

```njk
{% glossary "Eleventy" %}
{# <dfn id="glossary-eleventy" class="glossary-term" title="A simpler static site generator.">Eleventy</dfn> #}

{% glossaryLink "SSG" %}
{# <a href="#glossary-ssg" class="glossary-term-link">SSG</a> #}

{{ "Eleventy" | glossaryDefinition }}
{# A simpler static site generator. #}
```

## Options

Passed as the second argument to `eleventyConfig.addPlugin(glossaryPlugin, { ... })`.

| Option | Default | Description |
| --- | --- | --- |
| `terms` | `{}` | Map of term → definition string, or `{ definition, id }` object. Used by `glossary`, `glossaryLink`, `glossaryDefinition`, and `autoLink`. |
| `idPrefix` | `"glossary-"` | Prefix used for generated anchor IDs (from the `terms` map). |
| `cssClass` | `"glossary-term"` | CSS class applied to rendered terms/links (auto-linked page links get `${cssClass}-link`). |
| `autoLink` | `false` | When `true`, registers a transform that auto-links the first mention of each `terms`-map entry in `.html` output. |
| `autoLinkOnce` | `true` | Only link the first occurrence of each `terms`-map entry per page. |
| `collectionTag` | `"glossaryTerm"` | Front matter tag used to collect individually-authored glossary pages into the `glossaryTerms` collection. |
| `defaultLanguage` | `undefined` | Fallback language for `glossaryByLocale` when a term has no translation for the requested language. Should match the `defaultLanguage` passed to Eleventy's bundled `EleventyI18nPlugin`. |
| `autoLinkPages` | `false` | When `true`, registers a transform that auto-links the first mention of each glossary *page's* `title`/`synonyms` anywhere on the site to that page's own URL. |
| `autoLinkPagesOnce` | `true` | Only link the first occurrence of each glossary page (across all its labels) per page. |

## API reference

### Shortcodes

| Shortcode | Signature | Returns |
| --- | --- | --- |
| `glossary` | `(term, label?)` | `<dfn id="…" class="…" title="…">label or term</dfn>` for a `terms`-map entry. Throws if `term` is unknown. |
| `glossaryLink` | `(term, label?)` | `<a href="#…" class="…-link">label or term</a>` linking to the term's `{% glossary %}` anchor elsewhere on the same page. Throws if `term` is unknown. |
| `glossaryJsonLd` | `(term, definition, synonyms?, url?)` | A `<script type="application/ld+json">` tag with `schema.org` `DefinedTerm` data. `synonyms` (string or array) becomes `alternateName`; `url` becomes `url`. |

### Filters

| Filter | Signature | Returns |
| --- | --- | --- |
| `glossaryDefinition` | `term \| glossaryDefinition` | The definition string for a `terms`-map entry, or `undefined`. |
| `glossaryAutoLink` | `content \| glossaryAutoLink` | `content` with first mentions of each `terms`-map entry turned into `{% glossaryLink %}`-style anchors. This is the filter form of the `autoLink` transform — use it when you want to auto-link a specific chunk of content rather than the whole page. |
| `glossaryRelated` | `related \| glossaryRelated(allTerms)` | Resolves a `related` front-matter array (glossary page filenames, e.g. `"seo"` for `seo.md`) to the matching page objects in `allTerms` (pass `collections.glossaryTerms`). Unknown slugs are silently skipped. |
| `glossaryByLocale` | `items \| glossaryByLocale(lang)` | Filters a glossary collection to pages whose `page.lang` matches `lang`, falling back to `options.defaultLanguage`, or returning `items` unchanged if no page in the collection has a `page.lang` at all. |
| `glossaryGroupByLetter` | `items \| glossaryGroupByLetter` | Groups a glossary collection by the first letter of each item's `data.title` (diacritics folded). Returns `[{ letter, terms }, ...]` sorted alphabetically. |

### Transforms

Both are opt-in — nothing is registered unless the corresponding option is `true` — and both only ever
touch the `<body>` of `.html` output (never `<title>`/`<head>`), and never wrap text that's already inside
an `<a>` tag.

| Transform | Enabled by | Behavior |
| --- | --- | --- |
| `glossaryAutoLink` | `autoLink: true` | Auto-links first mentions of each `terms`-map entry to its `{% glossary %}` anchor (same logic as the `glossaryAutoLink` filter, applied automatically to every page). |
| `glossaryAutoLinkPages` | `autoLinkPages: true` | Auto-links first mentions of each glossary *page's* `title`/`synonyms` to that page's own URL, with a `data-tooltip` attribute holding its `description`. Never links a page to itself; when localized pages exist, only links to pages matching the current page's language (no cross-language fallback). See [Automatic linking with tooltips](#automatic-linking-with-tooltips). |

### Collections

| Collection | Contents |
| --- | --- |
| `glossaryTerms` | All pages tagged with `options.collectionTag` (default `"glossaryTerm"`), sorted by `data.title`. This is the collection every filter above (`glossaryRelated`, `glossaryByLocale`, `glossaryGroupByLetter`) and the `autoLinkPages` transform operate on. |

### Module exports

For use outside the Eleventy config function (e.g. in a `pagination.before` hook or a data file):

```js
const glossaryPlugin = require("eleventy-plugin-glossary");

glossaryPlugin.slugify("Ähre & Öl"); // "aehre-oel"
glossaryPlugin.groupByLetter(terms); // [{ letter: "A", terms: [...] }, ...] — same logic as glossaryGroupByLetter
```

## Individual glossary pages (own URL, JSON-LD, SEO)

For a glossary where each term is its own crawlable, SEO-friendly page, author one Markdown file per term
(e.g. under `src/glossar/`) instead of using the `terms` option. Tag each file so the plugin can collect
it, and set `permalink` for the URL:

```md
---
layout: glossar-layout.njk
tags: glossaryTerm
title: SEO
synonyms:
  - Suchmaschinenoptimierung
description: SEO bezeichnet Maßnahmen, die Sichtbarkeit einer Website in Suchmaschinen zu verbessern.
permalink: /glossar/seo/
---

**SEO** ...
```

The plugin exposes these pages as the `collections.glossaryTerms` collection (sorted by `title`), and a
`glossaryJsonLd` shortcode for rendering the term's [schema.org `DefinedTerm`](https://schema.org/DefinedTerm)
JSON-LD from the page's own frontmatter — put it in a shared layout (e.g. `glossar-layout.njk`):

```njk
{% glossaryJsonLd title, description, synonyms, "https://example.com" + page.url %}
```

A full working example (content, layout, and Eleventy config) lives in [`demo/`](demo/).

## Internationalization (i18n)

The plugin works with Eleventy's bundled `EleventyI18nPlugin`. That plugin derives `page.lang` **from the
language code at the start of a page's URL** (e.g. `/en/...`) — not from a `lang` frontmatter value or
filename — so each localized term's `permalink` must put its language code first:

```md
---
title: SEO
lang: en
permalink: /en/glossar/seo/
---
```

Pages without a language-prefixed permalink (e.g. `/glossar/seo/`) are treated as the `defaultLanguage`.
Register both plugins with a matching `defaultLanguage`:

```js
const { EleventyI18nPlugin } = require("@11ty/eleventy");
const glossaryPlugin = require("eleventy-plugin-glossary");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyI18nPlugin, { defaultLanguage: "de" });
  eleventyConfig.addPlugin(glossaryPlugin, { defaultLanguage: "de", autoLinkPages: true });
};
```

Use the `glossaryByLocale` filter to narrow the collection to the current page's language, falling back to
`defaultLanguage` if a translation is missing:

```njk
{% for term in collections.glossaryTerms | glossaryByLocale(page.lang) %}
  <li><a href="{{ term.url }}">{{ term.data.title }}</a></li>
{% endfor %}
```

## A-Z navigation & overview page

The `glossaryGroupByLetter` filter groups a glossary collection by the first letter of each term's `title`
(diacritics folded, so "Ähre" groups under "A"), producing `[{ letter, terms }, ...]` sorted alphabetically.
Combine it with `glossaryByLocale` to build a clickable alphabet bar and an A-Z overview page:

```njk
{% set groups = collections.glossaryTerms | glossaryByLocale(page.lang) | glossaryGroupByLetter %}

<nav aria-label="Alphabetische Navigation">
  {% for group in groups %}
    <a href="#letter-{{ group.letter }}">{{ group.letter }}</a>
  {% endfor %}
</nav>

{% for group in groups %}
  <h2 id="letter-{{ group.letter }}">{{ group.letter }}</h2>
  <ul>
    {% for term in group.terms %}
      <li><a href="{{ term.url }}">{{ term.data.title }}</a></li>
    {% endfor %}
  </ul>
{% endfor %}
```

See [`demo/src/glossar-index.njk`](demo/src/glossar-index.njk) for the full working example.

For larger glossaries, generate one page per letter with Eleventy's built-in pagination instead of one long
page, using `groupByLetter` (the standalone function backing the filter above) in a `pagination.before`
hook — see [`demo/src/glossar-buchstabe.11tydata.js`](demo/src/glossar-buchstabe.11tydata.js) and
[`demo/src/glossar-buchstabe.njk`](demo/src/glossar-buchstabe.njk):

```js
// glossar-buchstabe.11tydata.js
const glossaryPlugin = require("eleventy-plugin-glossary");

module.exports = {
  eleventyComputed: {
    title: (data) => `Glossar – ${data.group.letter}`,
  },
  pagination: {
    data: "collections.glossaryTerms",
    size: 1,
    alias: "group",
    before: (terms) => glossaryPlugin.groupByLetter(terms),
  },
};
```

```njk
{# glossar-buchstabe.njk #}
---
permalink: "/glossar/{{ group.letter | lower }}/"
---
<h1>{{ title }}</h1>
<ul>
  {% for term in group.terms %}<li><a href="{{ term.url }}">{{ term.data.title }}</a></li>{% endfor %}
</ul>
```

Note: front matter values (like `title` here) aren't run through the template engine — only `permalink`
is — so a per-page computed value like the letter heading needs `eleventyComputed`.

## Automatic linking with tooltips

With `autoLinkPages: true`, a transform scans every page's `<body>` and turns the first mention of each
glossary page's `title` (or any of its `synonyms`) into a link to that term's own page, tagged with a
`data-tooltip` attribute holding its `description`:

```html
<p>Wer eine Website plant, kommt am Thema
  <a href="/glossar/seo/" class="glossary-term-link" data-tooltip="SEO bezeichnet …">SEO</a>
  kaum vorbei.</p>
```

Style the tooltip with plain CSS — no JS required:

```css
[data-tooltip] { position: relative; text-decoration: underline dotted; }
[data-tooltip]:hover::after, [data-tooltip]:focus::after {
  content: attr(data-tooltip);
  position: absolute; left: 0; bottom: 100%;
  background: #1a1a1a; color: #fff; padding: .4rem .6rem; border-radius: 4px;
  width: max-content; max-width: 20rem; white-space: normal;
}
```

See [`demo/src/_includes/glossary-tooltip.css`](demo/src/_includes/glossary-tooltip.css) and
[`demo/src/artikel.md`](demo/src/artikel.md) for the full example. The transform never links a page to
itself, never wraps text that's already inside a link (so it's safe to run on your own glossary/nav
markup, even repeatedly, e.g. across an A-Z listing that already links to each term), and — when localized
glossary pages exist — only links to same-language pages (no silent cross-language fallback).

## Synonyms & related terms

Synonyms are just an array in front matter; `autoLinkPages` (above) automatically searches for them too:

```yaml
title: SEO
synonyms:
  - Suchmaschinenoptimierung
```

Related terms are resolved with the `glossaryRelated` filter from a `related` array of other glossary
pages' filenames (e.g. `seo.md` → `"seo"`):

```yaml
title: SSG
related:
  - seo
```

```njk
{% set relatedTerms = related | glossaryRelated(collections.glossaryTerms) %}
{% if relatedTerms.length %}
<h2>Verwandte Begriffe</h2>
<ul>
  {% for term in relatedTerms %}<li><a href="{{ term.url }}">{{ term.data.title }}</a></li>{% endfor %}
</ul>
{% endif %}
```

## Search with Pagefind (glossary-only)

To add search without touching (or being touched by) a site-wide search index, mark the indexable content
with [Pagefind](https://pagefind.app/)'s `data-pagefind-body` attribute on the glossary layout's `<article>`
(already done in [`demo/src/_includes/glossar-layout.njk`](demo/src/_includes/glossar-layout.njk)):

```njk
<article data-pagefind-body>
  ...
</article>
```

Once *any* page on the site has `data-pagefind-body`, Pagefind indexes **only** elements carrying that
attribute and skips every page that doesn't have it at all — so running Pagefind over the whole built site
still produces an index containing only your glossary content, regardless of URL structure or where a
general site search (if any) keeps its own index:

```bash
npx eleventy
npx pagefind --site _site --output-path _site/pagefind-glossary
```

Load the bundled search UI from that dedicated output path on your glossary overview page:

```html
<link href="/pagefind-glossary/pagefind-ui.css" rel="stylesheet">
<div id="glossary-search"></div>
<script src="/pagefind-glossary/pagefind-ui.js"></script>
<script>
  new PagefindUI({ element: "#glossary-search" });
</script>
```

If your site already runs Pagefind over the whole build for a general search (no `data-pagefind-body`
anywhere), just add `data-pagefind-body` to the glossary `<article>` only — pages without it fall back to
indexing their whole `<body>`, so the rest of the site's search is unaffected either way.

See `npm run demo` (builds the demo and indexes it this way) and
[`demo/src/glossar-index.njk`](demo/src/glossar-index.njk).

## Demo

[`demo/`](demo/) is a complete, runnable Eleventy site exercising every feature above: individual glossary
pages, i18n (German + English), A-Z pagination, automatic cross-linking with tooltips, synonyms, related
terms, and a Pagefind glossary-only search.

```bash
npm run demo        # builds demo/ and indexes it with Pagefind
cd demo && npx eleventy --serve
```

## Development

```bash
npm test
```

## License

MIT
