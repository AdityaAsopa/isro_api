/**
 * GET /api/launches
 *
 * Unified launch manifest that merges spacecraft_missions, customer_satellites,
 * and launchers into one event per (vehicle, date) pair.
 *
 * Query params:
 *   ?year=2017           — launches in a specific year
 *   ?vehicle_family=PSLV — filter by vehicle family (PSLV, GSLV, LVM-3, …)
 *   ?outcome=success     — filter by outcome (success | failed | unknown)
 */

const missionsData = require("../data/spacecraft_missions.json");
const customerSatellitesData = require("../data/customer_satellites.json");
const launchersData = require("../data/launchers.json");

// Build a vehicle → vehicle_family lookup
const familyByVehicle = {};
for (const l of launchersData.launchers) {
  if (l.id) familyByVehicle[l.id.toLowerCase()] = l.vehicle_family;
}

function resolveFamily(vehicleName) {
  if (!vehicleName) return null;
  const key = vehicleName.toLowerCase();
  if (familyByVehicle[key]) return familyByVehicle[key];
  // Fallback: match by prefix (e.g. "PSLV-C37" → PSLV family)
  for (const [k, v] of Object.entries(familyByVehicle)) {
    if (key.startsWith(k.split("-")[0].toLowerCase())) {
      // crude prefix check — use exact match first
    }
  }
  // Simple prefix heuristics
  const upper = vehicleName.toUpperCase();
  if (upper.startsWith("PSLV")) return "PSLV";
  if (upper.startsWith("GSLV MK III") || upper.startsWith("LVM")) return "LVM-3";
  if (upper.startsWith("GSLV")) return "GSLV";
  if (upper.startsWith("ASLV")) return "ASLV";
  if (upper.startsWith("SLV")) return "SLV";
  if (upper.startsWith("RLV")) return "RLV";
  return null;
}

function buildLaunches() {
  // key: "vehicle||date"  →  launch event object
  const map = {};

  // 1. Seed from spacecraft missions (primary payloads)
  for (const m of missionsData.spacecraft_missions) {
    if (!m.launch_date || !m.launch_vehicle) continue;
    const key = m.launch_vehicle.toLowerCase() + "||" + m.launch_date;
    if (!map[key]) {
      map[key] = {
        launch_date: m.launch_date,
        vehicle: m.launch_vehicle,
        vehicle_family: resolveFamily(m.launch_vehicle),
        launch_site: m.launch_site || null,
        primary_payload: m.name,
        co_passengers: [],
        total_payloads: 1,
        total_mass_kg: m.mass_kg || null,
        outcome: m.status === "failed" ? "failed" : "success",
      };
    } else {
      // Two missions on the same rocket (unlikely but handle gracefully)
      map[key].co_passengers.push(m.name);
      map[key].total_payloads += 1;
      if (m.mass_kg) {
        map[key].total_mass_kg = (map[key].total_mass_kg || 0) + m.mass_kg;
      }
    }
  }

  // 2. Add customer satellites as co-passengers
  for (const c of customerSatellitesData.customer_satellites) {
    if (!c.launch_date || !c.launcher) continue;
    const key = c.launcher.toLowerCase() + "||" + c.launch_date;
    if (!map[key]) {
      // Launch with no known mission primary payload
      map[key] = {
        launch_date: c.launch_date,
        vehicle: c.launcher,
        vehicle_family: resolveFamily(c.launcher),
        launch_site: null,
        primary_payload: null,
        co_passengers: [c.id],
        total_payloads: 1,
        total_mass_kg: c.mass_kg || null,
        outcome: "success",
      };
    } else {
      map[key].co_passengers.push(c.id);
      map[key].total_payloads += 1;
      if (c.mass_kg) {
        map[key].total_mass_kg = (map[key].total_mass_kg || 0) + c.mass_kg;
      }
    }
  }

  const launches = Object.values(map);
  launches.sort((a, b) => a.launch_date.localeCompare(b.launch_date));
  return launches;
}

const ALL_LAUNCHES = buildLaunches();

module.exports = async (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json");
    const { year, vehicle_family, outcome } = req.query;
    let results = ALL_LAUNCHES;

    if (year) {
      results = results.filter((l) => l.launch_date.startsWith(year));
    }
    if (vehicle_family) {
      const vf = vehicle_family.toLowerCase();
      results = results.filter(
        (l) => l.vehicle_family && l.vehicle_family.toLowerCase() === vf
      );
    }
    if (outcome) {
      results = results.filter((l) => l.outcome === outcome.toLowerCase());
    }

    res.send({
      count: results.length,
      launches: results,
    });
  } catch (error) {
    res.status(500);
    res.send({ error: error.message });
  }
};
