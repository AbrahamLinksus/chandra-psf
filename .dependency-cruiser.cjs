/** Layer rules from docs/LLD.md section 0.3. All severity: error. */
module.exports = {
  forbidden: [
    {
      name: "domain-pure",
      severity: "error",
      comment: "src/domain may not import anything in src/ outside src/domain.",
      from: { path: "^src/domain" },
      to: { path: "^src/(?!domain)" },
    },
    {
      name: "domain-pure-npm",
      severity: "error",
      comment: "src/domain may import no npm package except zod.",
      from: { path: "^src/domain" },
      to: {
        dependencyTypes: [
          "npm",
          "npm-dev",
          "npm-peer",
          "npm-optional",
          "npm-no-pkg",
          "npm-unknown",
        ],
        pathNot: "node_modules/zod/",
      },
    },
    {
      name: "access-pure",
      severity: "error",
      from: { path: "^src/data/access" },
      to: { path: "^src/(data/local|features|components|app)" },
    },
    {
      name: "local-hidden",
      severity: "error",
      from: { path: "^src/(features|components|hooks)|^src/app/(?!providers)" },
      to: { path: "^src/data/local" },
    },
    {
      name: "no-cross-feature",
      severity: "error",
      from: { path: "^src/features/([^/]+)/" },
      to: { path: "^src/features/", pathNot: "^src/features/$1/" },
    },
    {
      name: "shared-no-features",
      severity: "error",
      from: { path: "^src/(components|hooks)" },
      to: { path: "^src/(features|app)" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    exclude: { path: "\\.(test|spec)\\.tsx?$" },
  },
};
