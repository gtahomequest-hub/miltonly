// Test-scope no-op shim for the `server-only` package. Production bundles via
// Next's own compiled-in server-only. When running tsx scripts outside of
// Next, resolve server-only to this file via tsconfig paths in tsconfig.test.json.
export {};
