const spacecraftMissions = require("../data/spacecraft_missions.json");
const spacecrafts = require("../data/spacecrafts.json");
const customerSatellites = require("../data/customer_satellites.json");

function buildEvents() {
  const events = [];

  for (const m of spacecraftMissions.spacecraft_missions) {
    if (m.launch_date) {
      events.push({
        date: m.launch_date,
        name: m.name,
        type: "mission",
        collection: "spacecraft_missions",
        id: m.id,
        orbit_type: m.orbit_type || null,
        status: m.status,
      });
    }
  }

  // Add spacecrafts that don't have a mission entry (avoid duplicates)
  const missionNames = new Set(
    spacecraftMissions.spacecraft_missions.map((m) => m.name.toLowerCase())
  );
  for (const s of spacecrafts.spacecrafts) {
    if (s.launch_date && !missionNames.has(s.name.toLowerCase())) {
      events.push({
        date: s.launch_date,
        name: s.name,
        type: "spacecraft",
        collection: "spacecrafts",
        id: s.id,
        orbit_type: s.orbit_type || null,
        status: s.status || null,
      });
    }
  }

  for (const c of customerSatellites.customer_satellites) {
    if (c.launch_date) {
      events.push({
        date: c.launch_date,
        name: c.id + (c.country ? " (" + c.country + ")" : ""),
        type: "customer_satellite",
        collection: "customer_satellites",
        id: c.id,
        country: c.country || null,
        launcher: c.launcher || null,
      });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

const ALL_EVENTS = buildEvents();

module.exports = async (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json");
    const { date, month, year, range } = req.query;
    let results = ALL_EVENTS;

    if (date) {
      // date=04-19 or date=04-19 → match month-day across all years
      const parts = date.split("-");
      const mm = parts[0].padStart(2, "0");
      const dd = parts[1] ? parts[1].padStart(2, "0") : null;
      results = results.filter((e) => {
        if (dd) return e.date.slice(5) === mm + "-" + dd;
        return e.date.slice(5, 7) === mm;
      });
    } else if (month) {
      // month=2023-07 → all events in that month
      results = results.filter((e) => e.date.startsWith(month));
    } else if (year) {
      // year=1975 → all events in that year
      results = results.filter((e) => e.date.startsWith(year));
    } else if (range) {
      // range=1975,2000 → all events from 1975 to 2000 inclusive
      const [from, to] = range.split(",");
      results = results.filter((e) => {
        const y = e.date.slice(0, 4);
        return y >= from && y <= to;
      });
    }

    res.send({
      count: results.length,
      events: results,
    });
  } catch (error) {
    res.status(500);
    res.send({ error: error.message });
  }
};
