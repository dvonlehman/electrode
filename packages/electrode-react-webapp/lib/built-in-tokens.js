"use strict";

const Promise = require("bluebird");
const _ = require("lodash");
const groupScripts = require("./group-scripts");
const utils = require("./utils");

const tokens = {
  SSR_CONTENT: "SSR_CONTENT",
  CSS_BUNDLES: "CSS_BUNDLES",
  JS_BUNDLES: "JS_BUNDLES",
  PAGE_TITLE: "PAGE_TITLE",
  CRITICAL_CSS: "CRITICAL_CSS",
  HEAD_SCRIPTS: "HEAD_SCRIPTS",
  HEAD_LINKS: "HEAD_LINKS",
  META_TAGS: "META_TAGS",
  PREFETCH: "PREFETCH",
  MANIFEST: "MANIFEST"
};

const makeCssBundles = context => {
  const routeOptions = context.routeOptions;
  const assets = routeOptions.__internals.assets;
  const chunkNames = routeOptions.__internals.chunkSelector(context.request);
  const cssChunk = _.find(assets.css, asset => _.includes(asset.chunkNames, chunkNames.css));

  let bundleUrl;
  if (routeOptions.webpackDev) {
    const devBundleBase = routeOptions.__internals.devBundleBase;
    bundleUrl = chunkNames.css
      ? `${devBundleBase}${chunkNames.css}.style.css`
      : `${devBundleBase}style.css`;
  } else {
    bundleUrl = (cssChunk && `${routeOptions.prodBundleBase}${cssChunk.name}`) || "";
  }

  return Promise.resolve(bundleUrl ? utils.makeCssLink(bundleUrl) : "");
};

const makeJsBundles = context => {
  // Using options.renderJs rather than routeOptions.renderJs since this can
  // be overidden on an individual request.
  if (!context.options.renderJS) {
    return Promise.resolve("");
  }

  const routeOptions = context.routeOptions;
  const assets = routeOptions.__internals.assets;
  const chunkNames = routeOptions.__internals.chunkSelector(context.request);
  const jsChunk = _.find(assets.js, asset => _.includes(asset.chunkNames, chunkNames.js));

  let bundleUrl;
  if (routeOptions.webpackDev) {
    const devBundleBase = routeOptions.__internals.devBundleBase;
    bundleUrl = chunkNames.js
      ? `${devBundleBase}${chunkNames.js}.bundle.dev.js`
      : `${devBundleBase}bundle.dev.js`;
  } else {
    bundleUrl = (jsChunk && `${routeOptions.prodBundleBase}${jsChunk.name}`) || "";
  }

  const ins = routeOptions.unbundledJS.preBundle
    .concat([bundleUrl ? { src: bundleUrl } : ""])
    .concat(routeOptions.unbundledJS.postBundle);

  const htmlScripts = utils.htmlifyScripts(groupScripts(ins).scripts);

  return Promise.resolve(htmlScripts);
};

const makeCriticalCss = context => {
  const routeOptions = context.routeOptions;
  return utils.getCriticalCSS(routeOptions.criticalCSS).then(criticalCSS => {
    return criticalCSS ? `<style>${criticalCSS}</style>` : "";
  });
};

const makeManifestLink = context => {
  const routeOptions = context.routeOptions;
  const assets = routeOptions.__internals.assets;
  if (!assets.manifest) {
    return Promise.resolve("");
  }

  let manifest;
  if (routeOptions.webpackDev) {
    const devBundleBase = routeOptions.__internals.devBundleBase;
    manifest = `${devBundleBase}${assets.manifest}`;
  } else {
    const prodBundleBase = routeOptions.prodBundleBase;
    manifest = `${prodBundleBase}${assets.manifest}`;
  }

  return Promise.resolve(`<link rel="manifest" href="${manifest}" />\n`);
};

const makeHeadScripts = context => {
  const routeOptions = context.routeOptions;
  return Promise.resolve(
    utils.htmlifyScripts(groupScripts(routeOptions.unbundledJS.enterHead).scripts)
  );
};

const makeMetaTags = context => {
  const routeOptions = context.routeOptions;
  return utils.getIconStats(routeOptions.iconStats);
};

const makePageTitle = context => {
  return Promise.resolve(`<title>${context.routeOptions.pageTitle}</title>`);
};

const makePrefetchTags = context => {
  return Promise.resolve(context.content.prefetch || "");
};

module.exports = tokens;

module.exports.replacers = {
  [tokens.SSR_CONTENT]: context => Promise.resolve(context.content.html),
  [tokens.CRITICAL_CSS]: makeCriticalCss,
  [tokens.MANIFEST]: makeManifestLink,
  [tokens.CSS_BUNDLES]: makeCssBundles,
  [tokens.JS_BUNDLES]: makeJsBundles,
  [tokens.HEAD_SCRIPTS]: makeHeadScripts,
  [tokens.META_TAGS]: makeMetaTags,
  [tokens.PAGE_TITLE]: makePageTitle,
  [tokens.PREFETCH]: makePrefetchTags
};
