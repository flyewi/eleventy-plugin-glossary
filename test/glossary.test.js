const test = require("node:test");
const assert = require("node:assert/strict");
const glossaryPlugin = require("../lib/glossary");

function makeFakeEleventyConfig() {
  const shortcodes = {};
  const filters = {};
  const transforms = {};
  const collections = {};
  return {
    addShortcode(name, fn) {
      shortcodes[name] = fn;
    },
    addFilter(name, fn) {
      filters[name] = fn;
    },
    addTransform(name, fn) {
      transforms[name] = fn;
    },
    addCollection(name, fn) {
      collections[name] = fn;
    },
    shortcodes,
    filters,
    transforms,
    collections,
  };
}

test("glossary shortcode renders a dfn with title", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, {
    terms: { Eleventy: "A simpler static site generator." },
  });

  const html = config.shortcodes.glossary("Eleventy");
  assert.match(html, /<dfn id="glossary-eleventy"/);
  assert.match(html, /title="A simpler static site generator\."/);
  assert.match(html, />Eleventy<\/dfn>/);
});

test("glossary shortcode throws for unknown term", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {} });
  assert.throws(() => config.shortcodes.glossary("Unknown"));
});

test("glossaryDefinition filter returns the definition", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: { SSG: "Static Site Generator" } });
  assert.equal(config.filters.glossaryDefinition("SSG"), "Static Site Generator");
});

test("glossaryAutoLink filter links first occurrence only", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, {
    terms: { Eleventy: "A simpler static site generator." },
  });

  const input = "<p>Eleventy is great. Eleventy rocks.</p>";
  const output = config.filters.glossaryAutoLink(input);
  const occurrences = output.match(/<a href="#glossary-eleventy"/g) || [];
  assert.equal(occurrences.length, 1);
});

test("autoLink transform is only registered when option is enabled", () => {
  const configOff = makeFakeEleventyConfig();
  glossaryPlugin(configOff, { terms: {} });
  assert.equal(configOff.transforms.glossaryAutoLink, undefined);

  const configOn = makeFakeEleventyConfig();
  glossaryPlugin(configOn, { terms: {}, autoLink: true });
  assert.equal(typeof configOn.transforms.glossaryAutoLink, "function");
});

test("glossaryTerms collection filters by tag and sorts by title", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {} });

  const fakeCollectionApi = {
    getFilteredByTag(tag) {
      assert.equal(tag, "glossaryTerm");
      return [
        { data: { title: "SSG" } },
        { data: { title: "Eleventy" } },
      ];
    },
  };
  const sorted = config.collections.glossaryTerms(fakeCollectionApi);
  assert.deepEqual(sorted.map((item) => item.data.title), ["Eleventy", "SSG"]);
});

test("glossaryTerms collection tag is configurable", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {}, collectionTag: "term" });

  const fakeCollectionApi = {
    getFilteredByTag(tag) {
      assert.equal(tag, "term");
      return [];
    },
  };
  config.collections.glossaryTerms(fakeCollectionApi);
});

test("glossaryJsonLd shortcode renders a DefinedTerm script tag", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {} });

  const html = config.shortcodes.glossaryJsonLd(
    "SEO",
    "Search Engine Optimization",
    ["Suchmaschinenoptimierung"],
    "https://example.com/glossar/seo/"
  );
  const json = JSON.parse(html.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
  assert.equal(json["@context"], "https://schema.org");
  assert.equal(json["@type"], "DefinedTerm");
  assert.equal(json.name, "SEO");
  assert.equal(json.description, "Search Engine Optimization");
  assert.deepEqual(json.alternateName, ["Suchmaschinenoptimierung"]);
  assert.equal(json.url, "https://example.com/glossar/seo/");
});

test("glossaryByLocale filter selects items matching the requested language", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {}, defaultLanguage: "de" });

  const items = [
    { page: { lang: "de" }, data: { title: "SEO" } },
    { page: { lang: "en" }, data: { title: "SEO" } },
  ];
  const result = config.filters.glossaryByLocale(items, "en");
  assert.deepEqual(result.map((i) => i.page.lang), ["en"]);
});

test("glossaryByLocale filter falls back to defaultLanguage when no match", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {}, defaultLanguage: "de" });

  const items = [
    { page: { lang: "de" }, data: { title: "SEO" } },
  ];
  const result = config.filters.glossaryByLocale(items, "fr");
  assert.deepEqual(result.map((i) => i.page.lang), ["de"]);
});

test("glossaryByLocale filter passes items through when i18n isn't used", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {} });

  const items = [{ page: {}, data: { title: "SEO" } }];
  const result = config.filters.glossaryByLocale(items, "en");
  assert.equal(result, items);
});

test("glossaryGroupByLetter filter groups and sorts items alphabetically", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {} });

  const items = [
    { data: { title: "SSG" } },
    { data: { title: "Eleventy" } },
    { data: { title: "Encoding" } },
  ];
  const groups = config.filters.glossaryGroupByLetter(items);
  assert.deepEqual(groups.map((g) => g.letter), ["E", "S"]);
  assert.equal(groups[0].terms.length, 2);
  assert.equal(groups[1].terms.length, 1);
});

test("glossaryGroupByLetter filter folds diacritics into the base letter", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {} });

  const items = [{ data: { title: "Ähre" } }, { data: { title: "Apfel" } }];
  const groups = config.filters.glossaryGroupByLetter(items);
  assert.deepEqual(groups.map((g) => g.letter), ["A"]);
  assert.equal(groups[0].terms.length, 2);
});

test("autoLinkPages transform links first mention to the term's page with a data-tooltip", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {}, autoLinkPages: true });

  config.collections.glossaryTerms({
    getFilteredByTag: () => [
      {
        url: "/glossar/seo/",
        data: { title: "SEO", description: "Search Engine Optimization" },
      },
    ],
  });

  const html = config.transforms.glossaryAutoLinkPages.call(
    { page: { url: "/some-other-page/" } },
    "<p>SEO is important. SEO helps.</p>",
    "/some-other-page/index.html"
  );

  assert.match(html, /<a href="\/glossar\/seo\/" class="glossary-term-link" data-tooltip="Search Engine Optimization">SEO<\/a>/);
  const occurrences = html.match(/<a href="\/glossar\/seo\/"/g) || [];
  assert.equal(occurrences.length, 1);
});

test("autoLinkPages transform matches text inside tags starting with '<a' that are not anchors (e.g. <article>)", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {}, autoLinkPages: true });

  config.collections.glossaryTerms({
    getFilteredByTag: () => [
      {
        url: "/glossar/seo/",
        data: { title: "SEO", description: "Search Engine Optimization" },
      },
    ],
  });

  const html = config.transforms.glossaryAutoLinkPages.call(
    { page: { url: "/some-other-page/" } },
    "<article><p>SEO is important.</p></article>",
    "/some-other-page/index.html"
  );

  assert.match(html, /<a href="\/glossar\/seo\/"[^>]*>SEO<\/a>/);
});

test("autoLinkPages transform does not self-link a term's own page", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {}, autoLinkPages: true });

  config.collections.glossaryTerms({
    getFilteredByTag: () => [
      {
        url: "/glossar/seo/",
        data: { title: "SEO", description: "Search Engine Optimization" },
      },
    ],
  });

  const html = config.transforms.glossaryAutoLinkPages.call(
    { page: { url: "/glossar/seo/" } },
    "<h1>SEO</h1>",
    "/glossar/seo/index.html"
  );

  assert.doesNotMatch(html, /<a /);
});

test("autoLinkPages transform is only registered when the option is enabled", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {} });
  assert.equal(config.transforms.glossaryAutoLinkPages, undefined);
});

test("autoLinkPages transform also matches synonyms and links to the same page", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {}, autoLinkPages: true });

  config.collections.glossaryTerms({
    getFilteredByTag: () => [
      {
        url: "/glossar/seo/",
        data: {
          title: "SEO",
          synonyms: ["Suchmaschinenoptimierung"],
          description: "Search Engine Optimization",
        },
      },
    ],
  });

  const html = config.transforms.glossaryAutoLinkPages.call(
    { page: { url: "/some-other-page/" } },
    "<p>Suchmaschinenoptimierung ist wichtig. SEO auch.</p>",
    "/some-other-page/index.html"
  );

  assert.match(html, /<a href="\/glossar\/seo\/"[^>]*>Suchmaschinenoptimierung<\/a>/);
  const occurrences = html.match(/<a href="\/glossar\/seo\/"/g) || [];
  assert.equal(occurrences.length, 1);
});

test("autoLinkPages transform never rewrites text outside <body> (e.g. <title>)", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {}, autoLinkPages: true });

  config.collections.glossaryTerms({
    getFilteredByTag: () => [
      {
        url: "/glossar/seo/",
        data: { title: "SEO", description: "Search Engine Optimization" },
      },
    ],
  });

  const html = config.transforms.glossaryAutoLinkPages.call(
    { page: { url: "/some-other-page/" } },
    "<html><head><title>SEO Guide</title></head><body><p>SEO is important.</p></body></html>",
    "/some-other-page/index.html"
  );

  assert.match(html, /<title>SEO Guide<\/title>/);
  assert.match(html, /<a href="\/glossar\/seo\/"[^>]*>SEO<\/a> is important/);
});

test("autoLinkPages transform never nests <a> tags when two pages share the same label", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {}, autoLinkPages: true });

  config.collections.glossaryTerms({
    getFilteredByTag: () => [
      { url: "/glossar/seo/", data: { title: "SEO", description: "Deutsch" } },
      { url: "/glossar/en/seo/", data: { title: "SEO", description: "English" } },
    ],
  });

  const html = config.transforms.glossaryAutoLinkPages.call(
    { page: { url: "/some-other-page/" } },
    "<p>SEO is important.</p>",
    "/some-other-page/index.html"
  );

  assert.doesNotMatch(html, /<a[^>]*>\s*<a/);
  const occurrences = html.match(/<a href="[^"]*"/g) || [];
  assert.equal(occurrences.length, 1);
});

test("autoLinkPages transform only links pages matching the current page's language", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {}, autoLinkPages: true });

  config.collections.glossaryTerms({
    getFilteredByTag: () => [
      { url: "/glossar/seo/", page: { lang: "de" }, data: { title: "SEO", description: "Deutsch" } },
      { url: "/glossar/en/seo/", page: { lang: "en" }, data: { title: "SEO", description: "English" } },
    ],
  });

  const html = config.transforms.glossaryAutoLinkPages.call(
    { page: { url: "/artikel/", lang: "de" } },
    "<p>SEO is important.</p>",
    "/artikel/index.html"
  );

  assert.match(html, /<a href="\/glossar\/seo\/"/);
  assert.doesNotMatch(html, /<a href="\/glossar\/en\/seo\/"/);
});

test("autoLinkPages transform links nothing when no glossary page matches the current language (no cross-language fallback)", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {}, autoLinkPages: true });

  config.collections.glossaryTerms({
    getFilteredByTag: () => [
      { url: "/glossar/seo/", page: { lang: "de" }, data: { title: "SEO", description: "Deutsch" } },
    ],
  });

  const html = config.transforms.glossaryAutoLinkPages.call(
    { page: { url: "/en/artikel/", lang: "en" } },
    "<p>SEO is important.</p>",
    "/en/artikel/index.html"
  );

  assert.doesNotMatch(html, /<a /);
});

test("autoLinkPages transform does not re-wrap text already inside an <a> tag", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {}, autoLinkPages: true });

  config.collections.glossaryTerms({
    getFilteredByTag: () => [
      { url: "/glossar/ssg/", data: { title: "SSG", description: "Static Site Generator" } },
    ],
  });

  const html = config.transforms.glossaryAutoLinkPages.call(
    { page: { url: "/glossar/s/" } },
    '<ul><li><a href="/glossar/ssg/">SSG</a></li></ul>',
    "/glossar/s/index.html"
  );

  assert.doesNotMatch(html, /<a[^>]*>\s*<a/);
  const occurrences = html.match(/<a href="\/glossar\/ssg\/"/g) || [];
  assert.equal(occurrences.length, 1);
});

test("glossaryRelated filter resolves related slugs to their glossary pages", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {} });

  const allTerms = [
    { fileSlug: "seo", url: "/glossar/seo/", data: { title: "SEO" } },
    { fileSlug: "ssg", url: "/glossar/ssg/", data: { title: "SSG" } },
  ];
  const result = config.filters.glossaryRelated(["ssg"], allTerms);
  assert.deepEqual(result.map((t) => t.data.title), ["SSG"]);
});

test("glossaryRelated filter ignores unknown slugs", () => {
  const config = makeFakeEleventyConfig();
  glossaryPlugin(config, { terms: {} });

  const allTerms = [{ fileSlug: "seo", url: "/glossar/seo/", data: { title: "SEO" } }];
  const result = config.filters.glossaryRelated(["unknown"], allTerms);
  assert.deepEqual(result, []);
});
