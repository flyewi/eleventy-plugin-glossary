const glossaryPlugin = require("../../lib/glossary");

module.exports = {
  eleventyComputed: {
    // Front matter values aren't run through the template engine (only
    // `permalink` is), so the per-letter title has to be computed here.
    title: (data) => `Glossar – ${data.group.letter}`,
  },
  pagination: {
    data: "collections.glossaryTerms",
    size: 1,
    alias: "group",
    // Group the (German) glossary terms by first letter before paginating,
    // so Eleventy generates one page per letter instead of one page per term.
    before: (terms) =>
      glossaryPlugin.groupByLetter(terms.filter((term) => term.page.lang === "de")),
  },
};
