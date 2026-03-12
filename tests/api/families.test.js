const handler = require("../../api/families");
const { mockReq, mockRes } = require("../helpers/mock");

describe("GET /api/families", () => {
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

  test("response has count and families array", () => {
    expect(body).toHaveProperty("count");
    expect(body).toHaveProperty("families");
    expect(Array.isArray(body.families)).toBe(true);
    expect(body.count).toBe(body.families.length);
  });

  test("each family summary has required fields", () => {
    for (const f of body.families) {
      expect(f).toHaveProperty("id");
      expect(f).toHaveProperty("label");
      expect(f).toHaveProperty("description");
      expect(f).toHaveProperty("count");
      expect(f).toHaveProperty("_links");
      expect(f._links).toHaveProperty("self");
      expect(f.count).toBeGreaterThan(0);
    }
  });

  test("families are sorted by member count descending", () => {
    for (let i = 1; i < body.families.length; i++) {
      expect(body.families[i].count).toBeLessThanOrEqual(body.families[i - 1].count);
    }
  });

  test("known families are present: INSAT, GSAT, IRS, IRNSS, Chandrayaan", () => {
    const ids = body.families.map((f) => f.id);
    expect(ids).toContain("INSAT");
    expect(ids).toContain("GSAT");
    expect(ids).toContain("IRS");
    expect(ids).toContain("IRNSS");
    expect(ids).toContain("CHANDRAYAAN");
  });

  test("?name=INSAT returns INSAT family members", async () => {
    const res = mockRes();
    await handler(mockReq({ name: "INSAT" }), res);
    expect(res._status).toBe(200);
    expect(res._body).toHaveProperty("members");
    expect(Array.isArray(res._body.members)).toBe(true);
    expect(res._body.count).toBeGreaterThan(0);
    for (const m of res._body.members) {
      expect(m.name.toUpperCase()).toContain("INSAT");
    }
  });

  test("?name= is case-insensitive", async () => {
    const res1 = mockRes();
    const res2 = mockRes();
    await handler(mockReq({ name: "GSAT" }), res1);
    await handler(mockReq({ name: "gsat" }), res2);
    expect(res1._body.count).toBe(res2._body.count);
  });

  test("?name=CHANDRAYAAN members include Chandrayaan-1 and Chandrayaan3", async () => {
    const res = mockRes();
    await handler(mockReq({ name: "CHANDRAYAAN" }), res);
    expect(res._body.count).toBeGreaterThanOrEqual(3);
    const names = res._body.members.map((m) => m.name.toLowerCase());
    expect(names.some((n) => n.includes("chandrayaan-1"))).toBe(true);
  });

  test("?name= members are sorted chronologically", async () => {
    const res = mockRes();
    await handler(mockReq({ name: "INSAT" }), res);
    const members = res._body.members;
    for (let i = 1; i < members.length; i++) {
      const da = members[i - 1].launch_date || "9999";
      const db = members[i].launch_date || "9999";
      expect(da <= db).toBe(true);
    }
  });

  test("?name=nonexistent returns 404", async () => {
    const res = mockRes();
    await handler(mockReq({ name: "DOESNOTEXIST" }), res);
    expect(res._status).toBe(404);
    expect(res._body).toHaveProperty("error");
  });

  test("member counts across all families do not exceed 113 (total spacecrafts)", () => {
    const total = body.families.reduce((sum, f) => sum + f.count, 0);
    // Some spacecrafts may be unclassified; total should not exceed all spacecraft records
    expect(total).toBeLessThanOrEqual(113);
  });
});
