# Standardized Layer Architecture Specification

> **Purpose:**  
> This specification defines the standardized 5-part architecture for all domain visualization layers in God's Eye View. Follow this pattern whenever adding a new data feed (e.g., drone telemetry, naval vessels, radar stations, private vehicle fleet, border sensors).

---

## The 5-Part Standard Layer Structure

Every domain layer in `src/layers/<domain>/` must adhere strictly to these 5 modular files:

```
src/layers/<domain>/
├── source.js     # 1. Pure Portable Data Fetcher (Zero DOM, Zero Cesium)
├── model.js      # 2. In-Memory Store & Kinematic Calculations
├── rendering.js  # 3. 3D Cesium Graphics (Entities, Models, Billboards, Polylines)
├── controls.js   # 4. UI Metadata, Inspection Cards & Analyst Export
└── index.js      # 5. Master Factory & Lifecycle Coordinator
```

---

### 1. `source.js` (Pure Portable Fetcher)

- **Rule:** Must never import Cesium, `document`, `window`, or Node.js modules.
- **Role:** Calls the upstream or local proxy endpoint, decodes JSON/binary, and normalizes fields into standard coordinates.

```javascript
/**
 * Normalized entity shape:
 * @typedef {Object} NormalizedEntity
 * @property {string} id - Unique entity identifier
 * @property {number} lat - Latitude in decimal degrees (WGS84)
 * @property {number} lon - Longitude in decimal degrees (WGS84)
 * @property {number} alt - Altitude above mean sea level in meters
 * @property {number} [heading] - Heading in compass degrees (0-360)
 * @property {number} [speed] - Speed in meters/sec or knots
 * @property {string} [name] - Human-readable label or callsign
 */

export function createDomainSource({ endpoint = '/api/my-domain' } = {}) {
  return {
    async getSnapshot(signal) {
      const response = await fetch(endpoint, { signal });
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const data = await response.json();
      return Array.isArray(data) ? data.map(normalizeRecord) : [];
    },
  };
}
```

---

### 2. `model.js` (State & History)

- **Role:** Maintains in-memory active tracks, history breadcrumbs, expiration/pruning, and bounding-box queries.

```javascript
export function createDomainModel() {
  const records = new Map();

  return {
    update(newRecords) {
      const now = Date.now();
      for (const rec of newRecords) {
        records.set(rec.id, { ...rec, lastSeen: now });
      }
    },
    prune(staleThresholdMs = 60000) {
      const now = Date.now();
      for (const [id, rec] of records.entries()) {
        if (now - rec.lastSeen > staleThresholdMs) {
          records.delete(id);
        }
      }
    },
    getAll() {
      return Array.from(records.values());
    },
    getById(id) {
      return records.get(id);
    },
  };
}
```

---

### 3. `rendering.js` (Cesium 3D Graphics)

- **Rule:** Owns all Cesium entities, primitives, and billboard collections. Responsible for clamping entities to 3D terrain.

```javascript
import * as Cesium from 'cesium';

export function createDomainRenderer({ viewer, surface }) {
  const dataSource = new Cesium.CustomDataSource('my-domain-layer');
  viewer.dataSources.add(dataSource);

  return {
    sync(entities) {
      dataSource.entities.removeAll();
      for (const item of entities) {
        dataSource.entities.add({
          id: item.id,
          position: Cesium.Cartesian3.fromDegrees(item.lon, item.lat, item.alt),
          point: {
            pixelSize: 8,
            color: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
          },
        });
      }
    },
    setVisible(visible) {
      dataSource.show = visible;
    },
    destroy() {
      viewer.dataSources.remove(dataSource, true);
    },
  };
}
```

---

### 4. `controls.js` (UI Metadata & Analyst Records)

- **Role:** Declares layer name, icon, toggle panel drawer visibility, and analyst query exports.

```javascript
export function createDomainControls({ model }) {
  return {
    id: 'my-domain',
    name: 'Tactical Feed',
    icon: '🎯',
    showInTogglePanel: true, // set to false to hide from primary UI drawer

    getDetectableObjects() {
      return model.getAll().map((item) => ({
        id: item.id,
        type: 'tactical-target',
        position: item.position,
      }));
    },

    getAnalystRecords(maxCount = 100) {
      return model
        .getAll()
        .slice(0, maxCount)
        .map((item) => ({
          id: item.id,
          name: item.name,
          lat: item.lat,
          lon: item.lon,
          alt: item.alt,
        }));
    },
  };
}
```

---

### 5. `index.js` (Master Layer Factory)

- **Role:** Composes the parts into a cohesive layer object implementing the mandatory lifecycle:
  - `init(viewer)`
  - `enable(viewer)`
  - `disable(viewer)`
  - `update(viewer)`
  - `destroy(viewer)`

```javascript
import { createDomainModel } from './model.js';
import { createDomainRenderer } from './rendering.js';
import { createDomainControls } from './controls.js';

export function createMyDomainLayer({ source, surface }) {
  const model = createDomainModel();
  const controls = createDomainControls({ model });
  let renderer = null;
  let pollInterval = null;
  let enabled = false;

  return {
    ...controls,

    init(viewer) {
      renderer = createDomainRenderer({ viewer, surface });
      renderer.setVisible(false);
    },

    async enable() {
      enabled = true;
      renderer.setVisible(true);
      pollInterval = setInterval(async () => {
        if (!enabled) return;
        const records = await source.getSnapshot();
        model.update(records);
        model.prune();
        renderer.sync(model.getAll());
      }, 5000);
    },

    disable() {
      enabled = false;
      if (pollInterval) clearInterval(pollInterval);
      if (renderer) renderer.setVisible(false);
    },

    destroy() {
      this.disable();
      if (renderer) {
        renderer.destroy();
        renderer = null;
      }
    },
  };
}
```

---

## How to Register a New Standardized Layer in the App

1. **Add Contract in `src/app/sourceComposition.js`:**
   Declare the source name and expected methods in `CATALOG_SOURCE_CONTRACTS`.
2. **Assign Layer State Token:**
   Run `npm run layer-token:next` to get an unassigned 2-character share hash token. Add it to `src/data/layerState.js`.
3. **Instantiate in `src/app/constructCatalog.js`:**
   Add `createMyDomainLayer({ source: sources['my-domain'], surface })` to the catalog array.
4. **Wire Standalone Source in `src/standalone/layerSources.js`:**
   Add default endpoint mapping in `createStandaloneLayerSources()`.
5. **Verify Clean Boundaries:**
   Run `npm run check:boundaries` and `npm test`.
