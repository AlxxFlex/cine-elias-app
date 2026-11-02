/* Run with: node --test tests/api-client.test.cjs. No server or native runtime needed. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../src/services/api.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

function client(fetcher, options = {}) {
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    require(name) {
      if (name === "expo-constants")
        return {
          default: {
            expoConfig: { hostUri: options.hostUri ?? "localhost:8081" },
          },
          __esModule: true,
        };
      if (name === "expo-device")
        return { isDevice: options.isDevice ?? false };
      if (name === "react-native")
        return { Platform: { OS: options.platform ?? "web" } };
      throw new Error(`Unexpected runtime dependency: ${name}`);
    },
    fetch: fetcher,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    process: { env: { EXPO_PUBLIC_API_URL: options.baseUrl } },
  };
  vm.runInNewContext(compiled, context, { filename: "api.js" });
  return module.exports;
}

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });
const movie = { id: 1, title: "A real catalog entry" };

test("loads every page and shares simultaneous GETs without caching later reads", async () => {
  let requests = 0;
  const { api } = client(async (url) => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const skip = Number(new URL(url).searchParams.get("skip"));
    return json(
      Array.from({ length: skip === 0 ? 100 : 7 }, (_, index) => ({
        id: skip + index + 1,
        name: `Category ${skip + index + 1}`,
      })),
    );
  });
  const [first, second] = await Promise.all([
    api.list("categories"),
    api.list("categories"),
  ]);
  assert.equal(first.length, 107);
  assert.equal(second.length, 107);
  assert.equal(requests, 2);
  await api.list("categories");
  assert.equal(
    requests,
    4,
    "availability must be refreshed instead of returning an old cached result",
  );
});

test("rejects a server that ignores skip rather than looping or reporting incomplete data", async () => {
  let requests = 0;
  const { api } = client(async () => {
    requests++;
    return json(
      Array.from({ length: 100 }, (_, index) => ({
        id: index + 1,
        name: "Category",
      })),
    );
  });
  await assert.rejects(() => api.list("categories"), /paginación/);
  assert.equal(requests, 2);
});

test("rejects malformed availability responses and invalid historical prices", async () => {
  const invalidRows = [
    ["seats", { id: 1, seat_number: "3", auditorium_id: 1 }],
    ["seats", { id: 1, seat_number: -1, auditorium_id: 1 }],
    [
      "movie-screenings",
      { id: 1, date: "not-a-date", movie_id: 1, auditorium_id: 1 },
    ],
    [
      "tickets",
      { id: 1, user_id: 1, seat_id: 1, movie_screening_id: 1, price: [80] },
    ],
    [
      "tickets",
      { id: 1, user_id: 1, seat_id: 1, movie_screening_id: 1, price: "-1.00" },
    ],
  ];
  for (const [resource, row] of invalidRows) {
    const { api, ApiError } = client(async () => json([row]));
    await assert.rejects(
      () => api.list(resource),
      (error) => error instanceof ApiError,
    );
  }
  const { api } = client(async () => json({ items: [] }));
  await assert.rejects(() => api.list("seats"), /lista/);
});

test("normalizes absent optional movie fields while retaining valid zero values", async () => {
  const { api } = client(async () => json({ ...movie, length: 0 }));
  const result = await api.get("movies", 1);
  assert.equal(result.length, 0);
  for (const field of ["director_id", "category_id", "movie_summary", "image"])
    assert.equal(result[field], null);
});

test("never exposes an unexpected server-returned password to persisted visitor identity", async () => {
  const { api } = client(async () =>
    json({
      id: 4,
      name: "Visitor",
      email: "visitor@example.test",
      password: "must-not-persist",
    }),
  );
  const user = await api.get("users", 4);
  assert.equal(user.id, 4);
  assert.equal("password" in user, false);
  assert.equal(JSON.stringify(user).includes("must-not-persist"), false);
});

test("creates tickets through the documented body without inventing a tariff", async () => {
  let sent;
  const { api } = client(async (url, init) => {
    sent = { url, ...init };
    return json({ id: 5, ...JSON.parse(init.body) }, 201);
  });
  const body = { user_id: 1, seat_id: 2, movie_screening_id: 3, price: null };
  const result = await api.create("tickets", body);
  assert.equal(sent.url, "http://localhost:8000/api/tickets");
  assert.equal(sent.method, "POST");
  assert.deepEqual(JSON.parse(sent.body), body);
  assert.equal(result.price, null);
});

test("preserves HTTP conflict status and server detail for concurrent seat sales", async () => {
  const { api, ApiError } = client(async () =>
    json({ detail: "El asiento ya está ocupado" }, 409),
  );
  await assert.rejects(
    () =>
      api.create("tickets", { user_id: 1, seat_id: 2, movie_screening_id: 3 }),
    (error) =>
      error instanceof ApiError &&
      error.status === 409 &&
      error.message === "El asiento ya está ocupado",
  );
});

test("turns FastAPI field validation, unavailable servers, and non-JSON responses into readable errors", async () => {
  const validation = client(async () =>
    json(
      {
        detail: [
          {
            loc: ["body", "title"],
            msg: "Field required",
            input: { password: "do-not-show" },
          },
        ],
      },
      422,
    ),
  );
  await assert.rejects(
    () => validation.api.create("movies", {}),
    (error) =>
      error.status === 422 &&
      /title/.test(error.message) &&
      !error.message.includes("do-not-show"),
  );
  const network = client(async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(() => network.api.list("movies"), /No se pudo conectar/);
  const badJson = client(
    async () => new Response("<html>Proxy error</html>", { status: 503 }),
  );
  await assert.rejects(
    () => badJson.api.list("movies"),
    (error) => error.status === 503 && /JSON/.test(error.message),
  );
});

test("validates configured base URLs and picks LAN/emulator hosts", async () => {
  const neverFetch = async () => {
    throw new Error("Fetch should not be called for invalid configuration");
  };
  const invalid = client(neverFetch, {
    baseUrl: "http://example.test:8000/#fragment",
  });
  await assert.rejects(() => invalid.api.list("movies"), /URL de la API/);
  assert.equal(
    client(neverFetch, { baseUrl: "http://example.test:8000/api/" })
      .API_BASE_URL,
    "http://example.test:8000",
  );
  assert.equal(
    client(neverFetch, { platform: "android", isDevice: false }).API_BASE_URL,
    "http://10.0.2.2:8000",
  );
  assert.equal(
    client(neverFetch, {
      platform: "android",
      isDevice: true,
      hostUri: "192.168.1.25:8081",
    }).API_BASE_URL,
    "http://192.168.1.25:8000",
  );
});

test("resolves backend images for phones and rejects unsafe or credential-bearing URLs", () => {
  const { imageUrl } = client(async () => json([]), {
    baseUrl: "http://192.168.1.25:8000",
  });
  assert.equal(
    imageUrl("/posters/a.jpg"),
    "http://192.168.1.25:8000/posters/a.jpg",
  );
  assert.equal(
    imageUrl("http://localhost:8000/posters/a.jpg"),
    "http://192.168.1.25:8000/posters/a.jpg",
  );
  assert.equal(
    imageUrl("https://images.example.test/a.jpg"),
    "https://images.example.test/a.jpg",
  );
  assert.equal(imageUrl("javascript:alert(1)"), undefined);
  assert.equal(imageUrl("https://user:password@example.test/a.jpg"), undefined);
  assert.equal(imageUrl(null), undefined);
  const remote = client(async () => json([]), {
    baseUrl: "https://cine.example.test",
  });
  assert.equal(
    remote.imageUrl("http://localhost:8000/posters/a.jpg"),
    "https://cine.example.test/posters/a.jpg",
  );
});
