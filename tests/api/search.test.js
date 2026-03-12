const handler = require("../../api/search");
const { mockReq, mockRes } = require("../helpers/mock");

describe("GET /api/search", () => {
  test("returns 400 when ?q is missing", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._status).toBe(400);
    expect(res._body).toHaveProperty("error");
  });

  test("returns 400 when ?q is empty string", async () => {
    const res = mockRes();
    await handler(mockReq({ q: "   " }), res);
    expect(res._status).toBe(400);
    expect(res._body).toHaveProperty("error");
  });

  test("returns 200 with application/json header for valid query", async () => {
    const res = mockRes();
    await handler(mockReq({ q: "chandrayaan" }), res);
    expect(res._status).toBe(200);
    expect(res._headers["Content-Type"]).toBe("application/json");
  });

  test("response has query, count, and results array", async () => {
    const res = mockRes();
    await handler(mockReq({ q: "chandrayaan" }), res);
    expect(res._body).toHaveProperty("query", "chandrayaan");
    expect(res._body).toHaveProperty("count");
    expect(res._body).toHaveProperty("results");
    expect(Array.isArray(res._body.results)).toBe(true);
    expect(res._body.count).toBe(res._body.results.length);
  });

  test("search for 'chandrayaan' returns results from multiple collections", async () => {
    const res = mockRes();
    await handler(mockReq({ q: "chandrayaan" }), res);
    expect(res._body.count).toBeGreaterThan(0);
    const collections = new Set(res._body.results.map((r) => r.collection));
    // Should appear in at least spacecrafts and spacecraft_missions
    expect(collections.has("spacecrafts")).toBe(true);
  });

  test("each result has collection, id, name, and match_field", async () => {
    const res = mockRes();
    await handler(mockReq({ q: "PSLV" }), res);
    for (const r of res._body.results) {
      expect(r).toHaveProperty("collection");
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("name");
      expect(r).toHaveProperty("match_field");
    }
  });

  test("search is case-insensitive (PSLV == pslv)", async () => {
    const res1 = mockRes();
    const res2 = mockRes();
    await handler(mockReq({ q: "PSLV" }), res1);
    await handler(mockReq({ q: "pslv" }), res2);
    expect(res1._body.count).toBe(res2._body.count);
  });

  test("?collection=spacecrafts limits results to spacecrafts only", async () => {
    const res = mockRes();
    await handler(mockReq({ q: "chandrayaan", collection: "spacecrafts" }), res);
    expect(res._body.count).toBeGreaterThan(0);
    for (const r of res._body.results) {
      expect(r.collection).toBe("spacecrafts");
    }
  });

  test("?collection=spacecraft_missions limits results to missions", async () => {
    const res = mockRes();
    await handler(mockReq({ q: "remote sensing", collection: "spacecraft_missions" }), res);
    for (const r of res._body.results) {
      expect(r.collection).toBe("spacecraft_missions");
    }
  });

  test("?collection=unknown_collection returns 400", async () => {
    const res = mockRes();
    await handler(mockReq({ q: "test", collection: "foobar" }), res);
    expect(res._status).toBe(400);
    expect(res._body).toHaveProperty("error");
  });

  test("?collection=centres finds centres by state", async () => {
    const res = mockRes();
    await handler(mockReq({ q: "karnataka", collection: "centres" }), res);
    expect(res._body.count).toBeGreaterThan(0);
    for (const r of res._body.results) {
      expect(r.collection).toBe("centres");
    }
  });

  test("search for a term with no matches returns empty results", async () => {
    const res = mockRes();
    await handler(mockReq({ q: "xyzzy_no_match_12345" }), res);
    expect(res._status).toBe(200);
    expect(res._body.count).toBe(0);
    expect(res._body.results).toHaveLength(0);
  });

  test("?collection=launchers finds launchers by vehicle_family", async () => {
    const res = mockRes();
    await handler(mockReq({ q: "PSLV", collection: "launchers" }), res);
    expect(res._body.count).toBeGreaterThan(0);
  });
});
