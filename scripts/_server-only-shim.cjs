// Stubs the `server-only` package so a Node-side test can import a server module.
//
// src/lib/street-data.ts opens with `import "server-only"`, whose whole job is to throw when a
// server module is pulled into a client bundle. Under tsx there is no bundler and no client, so it
// throws unconditionally and any test importing that module dies before its first assertion.
// Stubbing it here keeps the guard doing its real job in the Next build while letting the prebuild
// suite test the pure functions that live alongside it.
//
// Usage: tsx --require ./scripts/_server-only-shim.cjs scripts/<test>.ts
const Mod = require("module");
const load = Mod._load;
Mod._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return load.call(this, request, parent, isMain);
};
