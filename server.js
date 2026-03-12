const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Collection handlers
const spacecrafts       = require('./api/spacecrafts.js');
const launchers         = require('./api/launchers.js');
const customerSatellites= require('./api/customer_satellites.js');
const centres           = require('./api/centres.js');
const spacecraftMissions= require('./api/spacecraft_missions.js');
const stats             = require('./api/stats.js');
const health            = require('./api/health.js');
const families          = require('./api/families.js');
const launches          = require('./api/launches.js');
const timeline          = require('./api/timeline.js');
const search            = require('./api/search.js');

// Individual-ID handlers (Vercel naming: api/<collection>/[id].js)
const spacecraftById      = require('./api/spacecrafts/[id].js');
const launcherById        = require('./api/launchers/[id].js');
const customerSatById     = require('./api/customer_satellites/[id].js');
const centreById          = require('./api/centres/[id].js');
const missionById         = require('./api/spacecraft_missions/[id].js');

/**
 * Wrap a Vercel-style async handler for Express.
 * Vercel route params (e.g. [id]) arrive in req.query — so we merge
 * Express req.params into req.query before calling the handler.
 */
function wrapHandler(handler) {
  return async (req, res) => {
    // Bridge Express route params → Vercel query params
    if (req.params && Object.keys(req.params).length) {
      req.query = { ...req.query, ...req.params };
    }
    try {
      let statusCode = 200;
      const mockRes = {
        setHeader: (key, value) => res.setHeader(key, value),
        status(code) { statusCode = code; return this; },
        send(data) {
          res.status(statusCode);
          typeof data === 'object' ? res.json(data) : res.send(data);
        },
        json(data) { res.status(statusCode).json(data); },
      };
      await handler(req, mockRes);
    } catch (error) {
      console.error('API Error:', error);
      res.status(500).json({ error: error.message });
    }
  };
}

// API Routes — collections first, then ID lookups
app.get('/api',                          wrapHandler(require('./api/index.js')));
app.get('/api/spacecrafts',              wrapHandler(spacecrafts));
app.get('/api/spacecrafts/:id',          wrapHandler(spacecraftById));
app.get('/api/launchers',                wrapHandler(launchers));
app.get('/api/launchers/:id',            wrapHandler(launcherById));
app.get('/api/customer_satellites',      wrapHandler(customerSatellites));
app.get('/api/customer_satellites/:id',  wrapHandler(customerSatById));
app.get('/api/centres',                  wrapHandler(centres));
app.get('/api/centres/:id',              wrapHandler(centreById));
app.get('/api/spacecraft_missions',      wrapHandler(spacecraftMissions));
app.get('/api/spacecraft_missions/:id',  wrapHandler(missionById));
app.get('/api/stats',                    wrapHandler(stats));
app.get('/api/health',                   wrapHandler(health));
app.get('/api/families',                 wrapHandler(families));
app.get('/api/launches',                 wrapHandler(launches));
app.get('/api/timeline',                 wrapHandler(timeline));
app.get('/api/search',                   wrapHandler(search));

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ISRO API Server running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 API Docs: http://localhost:${PORT}/api`);
});
