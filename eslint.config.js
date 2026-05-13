"use strict";

const jestPlugin = require("eslint-plugin-jest");

module.exports = [
  {
    files: [
      "**/*.js"
    ],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: "commonjs",
      globals: {
        Atomics: "readonly",
        SharedArrayBuffer: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        global: "readonly",
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly"
      }
    },
    plugins: {
      jest: jestPlugin
    }
  },
  {
    ignores: [
      "dist/",
      "node_modules/"
    ]
  }
];
