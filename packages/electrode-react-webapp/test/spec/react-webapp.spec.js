"use strict";
/* eslint-disable quotes */

const _ = require("lodash");
const Path = require("path");
const builtInTokens = require("../../lib/built-in-tokens");
const reactWebapp = require("../../lib/react-webapp");

describe("react-webapp", function() {
  describe("resolveContent", function() {
    it("should require content module with relative path", () => {
      return reactWebapp
        .setupOptions()
        .then(registerOptions => {
          const routeOptions = _.defaults(
            { htmlFile: "./test/data/index-1.html" },
            registerOptions
          );
          const userContent = { module: "./test/data/foo" };
          const handler = reactWebapp.makeRouteHandler(routeOptions, userContent);
          return handler({});
        })
        .then(html => {
          expect(html).to.contain(`<div class="js-content">hello</div>`);
        });
    });

    it("should invoke content function", () => {
      return reactWebapp
        .setupOptions()
        .then(registerOptions => {
          const routeOptions = _.defaults({}, registerOptions);
          const userContent = () => Promise.resolve({ html: "Content from a promise" });
          const handler = reactWebapp.makeRouteHandler(routeOptions, userContent);
          return handler({});
        })
        .then(html => {
          expect(html).to.contain(`<div class="js-content">Content from a promise</div>`);
        });
    });

    it("should use literal content string", () => {
      return reactWebapp
        .setupOptions()
        .then(registerOptions => {
          const routeOptions = _.defaults({}, registerOptions);
          const userContent = "Static content";
          const handler = reactWebapp.makeRouteHandler(routeOptions, userContent);
          return handler({});
        })
        .then(html => {
          expect(html).to.contain(`<div class="js-content">Static content</div>`);
        });
    });
  });

  describe("setupOptions", function() {
    it("should enable https if ENV is set", () => {
      process.env.WEBPACK_DEV_HTTPS = "true";
      const x = reactWebapp.setupOptions({});
      return x.then(opt => expect(opt.__internals.devBundleBase).to.match(/^https:/));
    });
  });

  describe("built-in tokens", () => {
    it("replaces tokens", () => {
      return reactWebapp
        .setupOptions({
          pageTitle: "new page title",
          iconStats: "./test/data/icon-stats-test-pwa.json",
          criticalCSS: "./test/data/critical.css",
          stats: "./test/data/stats-test-one-bundle.json"
        })
        .then(registerOptions => {
          const routeOptions = _.defaults({}, registerOptions);
          const handler = reactWebapp.makeRouteHandler(routeOptions);
          return handler({});
        })
        .then(html => {
          expect(html).to.contain(`<style>body {color: green;}\n</style>`);
          expect(html).to.contain('<meta name="mobile-web-app-capable" content="yes">');
          expect(html).to.contain("<title>new page title</title>");
          expect(html).to.contain(
            '<link rel="stylesheet" href="/js/style.f07a873ce87fc904a6a5.css" />'
          );
          expect(html).to.contain('<script src="/js/bundle.f07a873ce87fc904a6a5.js"></script>');
        });
    });

    it("should allow overridding a built-in token", () => {
      const ssrContent = "hey this is the content";

      return reactWebapp
        .setupOptions({
          tokenReplacers: {
            [builtInTokens.SSR_CONTENT]: () => Promise.resolve(ssrContent)
          }
        })
        .then(registerOptions => {
          const routeOptions = _.defaults({}, registerOptions);
          const handler = reactWebapp.makeRouteHandler(routeOptions);
          return handler({});
        })
        .then(html => {
          expect(html).to.contain(`<div class="js-content">${ssrContent}</div>`);
        });
    });

    it("should replace a custom token", () => {
      return reactWebapp
        .setupOptions({
          htmlFile: Path.resolve("./test/data/custom-tokens.html"),
          tokenReplacers: {
            CUSTOM_TOKEN: () => {
              return Promise.resolve("custom token!");
            }
          }
        })
        .then(registerOptions => {
          const routeOptions = _.defaults({}, registerOptions);
          const handler = reactWebapp.makeRouteHandler(routeOptions);
          return handler({});
        })
        .then(html => {
          expect(html).to.contain("custom token!");
          expect(html).to.contain('<div class="custom-1">custom replacement string</div>');
          expect(html).to.contain('<div class="custom-2">custom replacement with promise</div>');
        });
    });
  });
});
