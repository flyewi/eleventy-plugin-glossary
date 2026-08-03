# eleventy-plugin-glossary

An [Eleventy](https://www.11ty.dev/) plugin for defining a glossary of terms and referencing them throughout your content — as inline definitions, links, or automatically linked first mentions.

## Installation

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

## Options

| Option | Default | Description |
| --- | --- | --- |
| `terms` | `{}` | Map of term → definition string, or `{ definition, id }` object. |
| `idPrefix` | `"glossary-"` | Prefix used for generated anchor IDs. |
| `cssClass` | `"glossary-term"` | CSS class applied to rendered terms. |
| `autoLink` | `false` | When `true`, registers a transform that auto-links the first mention of each term in `.html` output. |
| `autoLinkOnce` | `true` | Only link the first occurrence of each term per page. |

## Usage

### Shortcode: inline definition

```njk
{% glossary "Eleventy" %}
```

Renders:

```html
<dfn id="glossary-eleventy" class="glossary-term" title="A simpler static site generator.">Eleventy</dfn>
```

### Shortcode: link to a definition elsewhere on the page

```njk
{% glossaryLink "Eleventy" %}
```

### Filter: get just the definition text

```njk
{{ "Eleventy" | glossaryDefinition }}
```

### Filter/transform: auto-link mentions in content

```njk
{{ content | glossaryAutoLink | safe }}
```

Or enable `autoLink: true` in the plugin options to apply this to all HTML output automatically.

## Development

```bash
npm test
```
