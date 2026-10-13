/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness loads TS without adding a runtime dependency. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { test } = require("node:test");
const { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } = require("@supabase/supabase-js");
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const cache = new Map();
let getClaimsError = null;
let workspaceUser = null;
let workspaceAuthError = null;
function load(relative) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = (specifier) => {
    if (specifier === "server-only") return {};
    if (filename.endsWith(path.join("src", "app", "(workspace)", "layout.tsx"))) {
      if (specifier === "next/navigation") {
        return { redirect: (location) => { throw Object.assign(new Error("redirect"), { location }); } };
      }
      if (specifier === "@/components/app-shell") {
        return { AppShell: ({ children }) => createElement("div", { "data-workspace": true }, children) };
      }
      if (specifier === "@/lib/auth") {
        return {
          getCurrentUser: async () => {
            if (workspaceAuthError) throw workspaceAuthError;
            return workspaceUser;
          },
          getOnboardingStatus: async () => ({ complete: true, profile: null }),
          getUserDisplayName: () => "Tester",
          getUserInitials: () => "T",
        };
      }
      if (specifier === "@/lib/supabase/server") {
        return { createClient: async () => ({}) };
      }
    }
    if (specifier === "@supabase/ssr") {
      return {
        createServerClient: () => ({
          auth: { getClaims: async () => ({ data: null, error: getClaimsError }) },
        }),
      };
    }
    if (specifier.startsWith("@/")) {
      const base = `src/${specifier.slice(2)}`;
      return load(fs.existsSync(path.resolve(__dirname, "..", `${base}.ts`)) ? `${base}.ts` : `${base}.tsx`);
    }
    return originalRequire(specifier);
  };
  cache.set(filename, mod);
  mod._compile(compiled, filename);
  return mod.exports;
}

const { getCurrentUser } = load("src/lib/auth.ts");
const { AuthServiceUnavailableError } = load("src/lib/supabase/auth-errors.ts");
const { updateSession } = load("src/lib/supabase/update-session.ts");
const { TranslationProvider, translations } = load("src/lib/i18n.tsx");
const { ServiceUnavailable } = load("src/components/service-unavailable.tsx");
const { default: WorkspaceLayout } = load("src/app/(workspace)/layout.tsx");
const { NextRequest } = require("next/server");

function authClient(results) {
  let index = 0;
  return {
    auth: {
      getUser: async () => results[Math.min(index++, results.length - 1)],
    },
  };
}

test("a valid Supabase user remains authenticated", async () => {
  const user = { id: "user-1" };
  const result = await getCurrentUser(authClient([{ data: { user }, error: null }]));
  assert.equal(result, user);
});

test("missing or rejected credentials remain an unauthenticated result", async () => {
  const missing = await getCurrentUser(authClient([
    { data: { user: null }, error: new AuthSessionMissingError() },
  ]));
  const rejected = await getCurrentUser(authClient([
    { data: { user: null }, error: new AuthApiError("invalid token", 401, "invalid_token") },
  ]));
  assert.equal(missing, null);
  assert.equal(rejected, null);
});

test("a transient Auth outage becomes a safe, distinct error", async () => {
  const retryable = new AuthRetryableFetchError("internal service detail", 503);
  await assert.rejects(
    getCurrentUser(authClient([{ data: { user: null }, error: retryable }])),
    (error) => {
      assert.ok(error instanceof AuthServiceUnavailableError);
      assert.equal(error.message, "Authentication service is temporarily unavailable.");
      assert.equal(error.message.includes("internal service detail"), false);
      return true;
    },
  );
});

test("the outage screen gives a localized retry action without exposing service details", () => {
  const markup = renderToStaticMarkup(createElement(
    TranslationProvider,
    null,
    createElement(ServiceUnavailable),
  ));
  assert.match(markup, /No pudimos conectar con el servicio\. Intenta de nuevo en unos momentos\./);
  assert.match(markup, />Reintentar</);
  assert.equal(
    translations.en["common.serviceUnavailable"],
    "We couldn't connect to the service. Please try again in a few moments.",
  );
  assert.equal(translations.en["common.retry"], "Try again");
  assert.doesNotMatch(markup, /SQL|AuthRetryableFetchError|internal service detail/);
});

test("retry after recovery reuses the session and returns the verified user", async () => {
  const user = { id: "recovered-user" };
  const client = authClient([
    { data: { user: null }, error: new AuthRetryableFetchError("offline", 0) },
    { data: { user }, error: null },
  ]);
  await assert.rejects(getCurrentUser(client), AuthServiceUnavailableError);
  assert.equal(await getCurrentUser(client), user);
});

test("the workspace loads for a valid user and preserves the login redirect without one", async () => {
  workspaceAuthError = null;
  workspaceUser = { id: "user-1", email: "tester@example.test" };
  const workspace = await WorkspaceLayout({ children: "Workspace content" });
  assert.match(renderToStaticMarkup(workspace), /data-workspace/);
  assert.match(renderToStaticMarkup(workspace), /Workspace content/);

  workspaceUser = null;
  await assert.rejects(WorkspaceLayout({ children: "unused" }), (error) => {
    assert.equal(error.location, "/login");
    return true;
  });
});

test("the workspace shows the outage fallback then loads after retry recovery", async () => {
  workspaceUser = { id: "recovered-user", email: "tester@example.test" };
  workspaceAuthError = new AuthServiceUnavailableError();
  const fallback = await WorkspaceLayout({ children: "Workspace content" });
  const fallbackMarkup = renderToStaticMarkup(createElement(
    TranslationProvider,
    null,
    fallback,
  ));
  assert.match(fallbackMarkup, /No pudimos conectar con el servicio/);
  assert.match(fallbackMarkup, />Reintentar</);
  assert.doesNotMatch(fallbackMarkup, /Workspace content|AuthServiceUnavailableError/);

  workspaceAuthError = null;
  const recovered = await WorkspaceLayout({ children: "Workspace content" });
  assert.match(renderToStaticMarkup(recovered), /data-workspace/);
});

test("the proxy lets temporary and invalid-session errors reach the route auth guard", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-test-key";
  const request = new NextRequest("http://localhost/dashboard", {
    headers: { cookie: "sb-local-auth-token=keep" },
  });

  for (const error of [
    new AuthRetryableFetchError("offline", 503),
    new AuthApiError("invalid token", 401, "invalid_token"),
  ]) {
    getClaimsError = error;
    const response = await updateSession(request);
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(request.cookies.get("sb-local-auth-token")?.value, "keep");
    assert.equal(response.cookies.getAll().length, 0);
  }
});

test("unexpected proxy auth errors are still thrown", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-test-key";
  const error = new AuthApiError("unexpected response", 400, "unexpected");
  getClaimsError = error;
  await assert.rejects(
    updateSession(new NextRequest("http://localhost/dashboard")),
    (caught) => caught === error,
  );
});
