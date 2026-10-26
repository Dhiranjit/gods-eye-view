import * as Cesium from 'cesium';

/**
 * Camera presets for notable locations.
 * Phase 1 default: fly to Austin, TX on load.
 */
export const CAMERA_PRESETS = {
  austin: {
    destination: Cesium.Cartesian3.fromDegrees(-97.7431, 30.2672, 800),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0.0,
    },
  },
  sf: {
    destination: Cesium.Cartesian3.fromDegrees(-122.4194, 37.7749, 1000),
    orientation: {
      heading: Cesium.Math.toRadians(30),
      pitch: Cesium.Math.toRadians(-30),
      roll: 0.0,
    },
  },
  nyc: {
    destination: Cesium.Cartesian3.fromDegrees(-73.9857, 40.7484, 1200),
    orientation: {
      heading: Cesium.Math.toRadians(-20),
      pitch: Cesium.Math.toRadians(-30),
      roll: 0.0,
    },
  },
  indoPacific: {
    destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 3500000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-85),
      roll: 0.0,
    },
  },
  newDelhi: {
    destination: Cesium.Cartesian3.fromDegrees(77.209, 28.6139, 1200),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0.0,
    },
  },
  mumbai: {
    destination: Cesium.Cartesian3.fromDegrees(72.8777, 19.076, 1200),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0.0,
    },
  },
};

/**
 * Fly the camera to a preset location with a smooth animation.
 */
export function flyToPreset(viewer, presetName, duration = 3.0) {
  const preset = CAMERA_PRESETS[presetName];
  if (!preset) return;

  viewer.camera.flyTo({
    destination: preset.destination,
    orientation: preset.orientation,
    duration,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
  });
}

/**
 * Set camera to startup location on load with a cinematic fly-in.
 * Defaults to Austin, TX, or honors VITE_STARTUP_PRESET (e.g. 'indoPacific', 'newDelhi', 'mumbai').
 * @returns {Function} Cancels the pending or active startup flight.
 */
export function flyToStartupView(
  viewer,
  presetName = import.meta.env?.VITE_STARTUP_PRESET || 'austin',
) {
  const preset = CAMERA_PRESETS[presetName] || CAMERA_PRESETS.austin;
  const isHighAltitude = preset.destination.z > 1000000;
  const startAlt = isHighAltitude ? 12000000 : 25000;
  const carto = Cesium.Cartographic.fromCartesian(preset.destination);
  const lonDeg = Cesium.Math.toDegrees(carto.longitude);
  const latDeg = Cesium.Math.toDegrees(carto.latitude);

  // Start from a high altitude, then fly down
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(lonDeg, latDeg, startAlt),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0,
    },
  });

  // Cinematic fly-in after a brief pause
  const timer = setTimeout(() => {
    if (viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: preset.destination,
      orientation: preset.orientation,
      duration: 4.0,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }, 500);
  return () => {
    clearTimeout(timer);
    if (!viewer.isDestroyed()) viewer.camera.cancelFlight();
  };
}

/**
 * Set camera to Austin on load with a cinematic fly-in (backward-compatible).
 * @returns {Function} Cancels the pending or active startup flight.
 */
export function flyToAustin(viewer) {
  return flyToStartupView(viewer, 'austin');
}
