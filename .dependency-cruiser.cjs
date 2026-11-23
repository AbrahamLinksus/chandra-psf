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
      to: { path: "^src/(data/remote|server|features|components|app)" },
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
      name: "server-hidden",
      severity: "error",
      comment: "LLD-phase2 15.3: only src/app/api and src/server reach src/server.",
      from: { path: "^src/(features|components|hooks|data)|^src/app/(?!api/)" },
      to: { path: "^src/server" },
    },
    {
      name: "server-no-ui",
      severity: "error",
      comment: "LLD-phase2 15.3: src/server may not import UI layers or react.",
      from: { path: "^src/server" },
      to: { path: "^src/(features|components|hooks|app)|node_modules/(react|react-dom)/" },
    },
    {
      name: "remote-hidden",
      severity: "error",
      comment: "LLD-phase2 15.3: only src/app/providers.tsx imports src/data/remote.",
      from: { path: "^src/(features|components|hooks)|^src/app/(?!providers)" },
      to: { path: "^src/data/remote" },
    },
    {
      name: "repos-via-root",
      severity: "error",
      comment: "LLD-phase2 15.3: only createServerDataAccess.ts imports src/server/repos.",
      from: { path: "^src/(?!server/createServerDataAccess|server/repos/)" },
      to: { path: "^src/server/repos" },
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
