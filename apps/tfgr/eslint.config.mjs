export default [
  {
    ignores: ["node_modules/"],
  },
  {
    files: ["cmd/tfgr/web/**/*.js"],
    languageOptions: {
      globals: {
        SVGElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLTextAreaElement: "readonly",
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "error",
    },
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      globals: {
        URL: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "error",
    },
  },
];
