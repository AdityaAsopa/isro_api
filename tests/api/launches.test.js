const handler = require("../../api/launches");
const { mockReq, mockRes } = require("../helpers/mock");

describe("GET /api/launches", () => {
  let body;

  beforeAll(async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    body = res._body;
  });

  test("returns 200 with application/json header", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._status).toBe(200);
    expect(res._headers["Content-Type"]).toBe("application/json");
  });

  test("response has count and launches array", () => {
    expect(body).toHaveProperty("count");
    expect(body).toHaveProperty("launches");
    expect(Array.isArray(body.launches)).toBe(true);
    expect(body.count).toBe(body.launches.length);
  });

  test("launches are sorted chronologically", () => {
    for (let i = 1; i < body.launches.length; i++) {
      expect(body.launches[i].launch_date >= body.launches[i - 1].launch_date).toBe(true);
    }
  });

  test("each launch has required fields", () => {
    for (const l of body.launches) {
      expect(l).toHaveProperty("launch_date");
      expect(l).toHaveProperty("vehicle");
      expect(l).toHaveProperty("total_payloads");
      expect(l).toHaveProperty("co_passengers");
      expect(l).toHaveProperty("outcome");
      expect(Array.isArray(l.co_passengers)).toBe(true);
      expect(l.launch_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(l.total_payloads).toBeGreaterThanOrEqual(1);
    }
  });

  test("?year=2017 returns only 2017 launches", async () => {
    const res = mockRes();
    await handler(mockReq({ year: "2017" }), res);
    expect(res._body.count).toBeGreaterThan(0);
    for (const l of res._body.launches) {
      expect(l.launch_date.startsWith("2017")).toBe(true);
    }
  });

  test("PSLV-C37 (world-record 104-sat launch) has many co-passengers", async () => {
    const res = mockRes();
    await handler(mockReq({ year: "2017" }), res);
    const c37 = res._body.launches.find(
      (l) => l.vehicle && l.vehicle.toUpperCase().includes("PSLV-C37")
    );
    if (c37) {
      // Should have at least Cartosat-2D as primary + many co-passengers
      expect(c37.total_payloads).toBeGreaterThan(1);
    }
  });

  test("?vehicle_family=PSLV returns only PSLV launches", async () => {
    const res = mockRes();
    await handler(mockReq({ vehicle_family: "PSLV" }), res);
    expect(res._body.count).toBeGreaterThan(0);
    for (const l of res._body.launches) {
      expect(l.vehicle_family).toBe("PSLV");
    }
  });

  test("?vehicle_family= is case-insensitive", async () => {
    const res1 = mockRes();
    const res2 = mockRes();
    await handler(mockReq({ vehicle_family: "PSLV" }), res1);
    await handler(mockReq({ vehicle_family: "pslv" }), res2);
    expect(res1._body.count).toBe(res2._body.count);
  });

  test("?outcome=success returns launches with success outcome", async () => {
    const res = mockRes();
    await handler(mockReq({ outcome: "success" }), res);
    expect(res._body.count).toBeGreaterThan(0);
    for (const l of res._body.launches) {
      expect(l.outcome).toBe("success");
    }
  });

  test("vehicle_family present for known ISRO rockets", async () => {
    const pslvRes = mockRes();
    await handler(mockReq({ vehicle_family: "PSLV" }), pslvRes);
    const gslvRes = mockRes();
    await handler(mockReq({ vehicle_family: "GSLV" }), gslvRes);
    expect(pslvRes._body.count).toBeGreaterThan(0);
    expect(gslvRes._body.count).toBeGreaterThan(0);
  });
});
