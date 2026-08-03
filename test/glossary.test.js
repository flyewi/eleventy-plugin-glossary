const test = require("node:test");
const assert = require("node:assert/strict");
const glossaryPlugin = require("../lib/glossary");

function makeFakeEleventyConfig() {
  const shortcodes = {};
  const filters = {};
  const transforms = {};
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
    shortcodes,
    filters,
    transforms,
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
