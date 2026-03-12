/**
 * GET /api/health
 *
 * Health check endpoint. Returns record counts for all collections
 * so callers can verify the data layer is intact.
 *
 * Response:
 * {
 *   "status": "ok",
 *   "timestamp": "2026-03-12T10:00:00.000Z",
 *   "records": {
 *     "spacecrafts": 113,
 *     "spacecraft_missions": 64,
 *     "customer_satellites": 75,
 *     "launchers": 81,
 *     "centres": 44
 *   }
 * }
 */

const spacecraftsData = require("../data/spacecrafts.json");
const missionsData = require("../data/spacecraft_missions.json");
const customerSatellitesData = require("../data/customer_satellites.json");
const launchersData = require("../data/launchers.json");
const centresData = require("../data/centres.json");

module.exports = async (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json");
    res.send({
      status: "ok",
      timestamp: new Date().toISOString(),
      records: {
        spacecrafts: spacecraftsData.spacecrafts.length,
        spacecraft_missions: missionsData.spacecraft_missions.length,
        customer_satellites: customerSatellitesData.customer_satellites.length,
        launchers: launchersData.launchers.length,
        centres: centresData.centres.length,
      },
    });
  } catch (error) {
    res.status(500);
    res.send({ status: "error", error: error.message });
  }
};
