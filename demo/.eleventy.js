const { EleventyI18nPlugin } = require("@11ty/eleventy");
const glossaryPlugin = require("../lib/glossary");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyI18nPlugin, {
    defaultLanguage: "de",
  });

  eleventyConfig.addPlugin(glossaryPlugin, {
    collectionTag: "glossaryTerm",
    defaultLanguage: "de",
    autoLinkPages: true,
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
    },
  };
};
