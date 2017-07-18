"use strict";

const _ = require("lodash");
const Promise = require("bluebird");
const fs = require("fs");
const Path = require("path");
const stringReplaceAsync = require("string-replace-async");
const processCustomToken = require("./custom-tokens");
const builtInTokens = require("./built-in-tokens");

const TOKEN_REGEX = /{{[A-Z_~\.\/-]*}}/gi;
const HTTP_ERROR_500 = 500;

const utils = require("./utils");

const resolveChunkSelector = utils.resolveChunkSelector;
const loadAssetsFromStats = utils.loadAssetsFromStats;
const getStatsPath = utils.getStatsPath;

const resolvePath = path => (!Path.isAbsolute(path) ? Path.resolve(path) : path);

function makeRouteHandler(routeOptions, userContent) {
  const html = fs.readFileSync(resolvePath(routeOptions.htmlFile)).toString();

  const tokenReplacers = _.assign({}, builtInTokens.replacers, routeOptions.tokenReplacers);

  /* Create a route handler */
  /* eslint max-statements: [2, 35] */
  return options => {
    options = options || {};
    const mode = options.mode;
    let renderSs = true;
    options.renderJS = routeOptions.renderJS && mode !== "nojs";
    if (routeOptions.serverSideRendering) {
      if (mode === "noss") {
        renderSs = false;
      } else if (mode === "datass" && options.request.app) {
        options.request.app.disableSSR = true;
      }
    }

    const renderPage = content => {
      const renderContext = {
        request: options.request,
        routeOptions,
        options,
        content
      };

      return stringReplaceAsync(html, TOKEN_REGEX, token => {
        if (token.startsWith("{{~")) {
          return processCustomToken(token, renderContext);
        }

        const bareToken = utils.stripTokenDelimiters(token);
        const tokenReplacer = tokenReplacers[bareToken];
        if (tokenReplacer) {
          return tokenReplacer(renderContext).then(value => value || "");
        }

        // If there is no tokenReplacer just replace with an empty string
        return Promise.resolve("");
      });
    };

    const resolveContent = content => {
      if (_.isObject(content) && content.module) {
        const module = content.module.startsWith(".")
          ? Path.join(process.cwd(), content.module)
          : content.module;
        content = require(module); // eslint-disable-line global-require
      }

      if (_.isFunction(content)) {
        const result = content(options.request);
        if (utils.isPromise(result)) return result;
        return Promise.resolve(result);
      }
      if (_.isObject(content) && content.html) {
        return Promise.resolve(content);
      }
      if (_.isString(content)) {
        return Promise.resolve({ html: content });
      }
      return Promise.resolve({ html: "" });
    };

    return resolveContent(renderSs ? userContent : "").then(renderPage).catch(err => {
      return Promise.reject({
        status: err.status || HTTP_ERROR_500,
        html: err.message || err.toString()
      });
    });
  };
}

const setupOptions = options => {
  const pluginOptionsDefaults = {
    pageTitle: "Untitled Electrode Web Application",
    webpackDev: process.env.WEBPACK_DEV === "true",
    renderJS: true,
    serverSideRendering: true,
    htmlFile: Path.join(__dirname, "index.html"),
    devServer: {
      host: process.env.WEBPACK_HOST || "127.0.0.1",
      port: process.env.WEBPACK_DEV_PORT || "2992",
      https: Boolean(process.env.WEBPACK_DEV_HTTPS)
    },
    unbundledJS: {
      enterHead: [],
      preBundle: [],
      postBundle: []
    },
    paths: {},
    stats: "dist/server/stats.json",
    iconStats: "dist/server/iconstats.json",
    criticalCSS: "dist/js/critical.css",
    buildArtifacts: ".build",
    prodBundleBase: "/js/",
    tokenReplacers: {}
  };

  const pluginOptions = _.defaultsDeep({}, options, pluginOptionsDefaults);
  const chunkSelector = resolveChunkSelector(pluginOptions);
  const devProtocol = process.env.WEBPACK_DEV_HTTPS ? "https://" : "http://";
  const devBundleBase = `${devProtocol}${pluginOptions.devServer.host}:${pluginOptions.devServer
    .port}/js/`;
  const statsPath = getStatsPath(pluginOptions.stats, pluginOptions.buildArtifacts);

  return Promise.try(() => loadAssetsFromStats(statsPath)).then(assets => {
    pluginOptions.__internals = {
      assets,
      chunkSelector,
      devBundleBase
    };

    return pluginOptions;
  });
};

module.exports = {
  setupOptions,
  makeRouteHandler
};
