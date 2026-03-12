const handler = require("../../api/timeline");
const { mockReq, mockRes } = require("../helpers/mock");

describe("GET /api/timeline", () => {
  test("returns 200 with application/json header", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._status).toBe(200);
    expect(res._headers["Content-Type"]).toBe("application/json");
  });

  test("returns count and events array", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._body).toHaveProperty("count");
    expect(res._body).toHaveProperty("events");
    expect(Array.isArray(res._body.events)).toBe(true);
    expect(res._body.count).toBe(res._body.events.length);
  });

  test("events are sorted chronologically", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    const events = res._body.events;
    for (let i = 1; i < events.length; i++) {
      expect(events[i].date >= events[i - 1].date).toBe(true);
    }
  });

  test("each event has required fields", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    for (const e of res._body.events) {
      expect(e).toHaveProperty("date");
      expect(e).toHaveProperty("name");
      expect(e).toHaveProperty("type");
      expect(e).toHaveProperty("collection");
      expect(e).toHaveProperty("id");
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("?year=1975 returns only 1975 events", async () => {
    const res = mockRes();
    await handler(mockReq({ year: "1975" }), res);
    expect(res._body.count).toBeGreaterThan(0);
    for (const e of res._body.events) {
      expect(e.date.startsWith("1975")).toBe(true);
    }
  });

  test("?date=04-19 returns Aryabhata's April 19 launch", async () => {
    const res = mockRes();
    await handler(mockReq({ date: "04-19" }), res);
    expect(res._body.count).toBeGreaterThan(0);
    for (const e of res._body.events) {
      expect(e.date.slice(5)).toBe("04-19");
    }
    const names = res._body.events.map((e) => e.name);
    expect(names.some((n) => n.toLowerCase().includes("aryabhata"))).toBe(true);
  });

  test("?month=2023-07 returns events in July 2023", async () => {
    const res = mockRes();
    await handler(mockReq({ month: "2023-07" }), res);
    for (const e of res._body.events) {
      expect(e.date.startsWith("2023-07")).toBe(true);
    }
  });

  test("?range=1975,1980 returns events only in that range", async () => {
    const res = mockRes();
    await handler(mockReq({ range: "1975,1980" }), res);
    expect(res._body.count).toBeGreaterThan(0);
    for (const e of res._body.events) {
      const year = parseInt(e.date.slice(0, 4));
      expect(year).toBeGreaterThanOrEqual(1975);
      expect(year).toBeLessThanOrEqual(1980);
    }
  });

  test("events include records from spacecraft_missions, spacecrafts, and customer_satellites", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    const types = new Set(res._body.events.map((e) => e.type));
    expect(types.has("mission")).toBe(true);
    expect(types.has("customer_satellite")).toBe(true);
  });

  test("total events count is larger than spacecraft_missions alone", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    // spacecraft_missions has 64 records; combined timeline is larger
    expect(res._body.count).toBeGreaterThan(64);
  });
});
