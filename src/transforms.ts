import { Point } from "./types";

/**
 * Rotates a rectangular polygon around its center.
 * Longitude is scaled by cos(latitude) so rotation looks correct on maps.
 *
 * @param pts Array of 4 points (lat,lng)
 * @param deg Degrees: +clockwise, -counterclockwise
 */
export function rotateRectangle(pts: Point[], deg: number): Point[] {
  const rad = (-deg * Math.PI) / 180; // +deg = clockwise

  // center
  const centerLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const centerLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;

  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return pts.map((p) => {
    // scale lng to local x, lat to y
    const x = (p.lng - centerLng) * cosLat;
    const y = p.lat - centerLat;

    // rotate
    const xr = x * cos - y * sin;
    const yr = x * sin + y * cos;

    // unscale back to lat/lng
    return {
      lng: centerLng + xr / cosLat,
      lat: centerLat + yr,
    };
  });
}

/**
 * Returns true if point is inside polygon (or on its edge)
 * @param pt  Test point
 * @param poly Polygon vertices (lat,lng), size ≥ 3
 */
export function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;

  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.lng,
      yi = poly[i]!.lat;
    const xj = poly[j]!.lng,
      yj = poly[j]!.lat;

    const intersect =
      yi > pt.lat !== yj > pt.lat &&
      pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Creates a square centered at a point.
 * Default side ≈ large building (~100m).
 */
export function squareAtPoint(center: Point, sideMeters: number = 30): Point[] {
  const half = sideMeters / 2;

  // meters → degrees (local approx)
  const dLat = half / 111_320;
  const dLng = half / (111_320 * Math.cos((center.lat * Math.PI) / 180));

  return [
    { lat: center.lat - dLat, lng: center.lng - dLng },
    { lat: center.lat - dLat, lng: center.lng + dLng },
    { lat: center.lat + dLat, lng: center.lng + dLng },
    { lat: center.lat + dLat, lng: center.lng - dLng },
  ];
}

/**
 * Translates a polygon north/south/east/west.
 * +dLat = north, -dLat = south
 * +dLng = east,  -dLng = west
 */
/**
 * Translates a polygon using step units.
 * 1 unit = 10 meters
 * +north = up, +east = right
 */
export function translatePolygon(
  poly: Point[],
  northSteps: number,
  eastSteps: number,
  // metersPerStep?: number = 3
): Point[] {
  const metersPerStep = 1;
  const refLat = poly[0]!.lat;
  const metersToDegLat = metersPerStep / 111_320;
  const metersToDegLng =
    metersPerStep / (111_320 * Math.cos((refLat * Math.PI) / 180));

  return poly.map((p) => ({
    lat: p.lat + northSteps * metersToDegLat,
    lng: p.lng + eastSteps * metersToDegLng,
  }));
}

/**
 * Scales a rectangular polygon about its center.
 * scaleA and scaleB scale the two orthogonal side lengths.
 * 1.0 = no change, 1.1 = +10%, 0.9 = -10%
 */
/**
 * Grows a rectangular polygon by fixed meters along its two axes.
 * growA / growB are meters added to each half-side (default = 1m).
 */
export function growRectangle(
  rect: Point[],
  growA: number = 1,
  growB: number = 1,
): Point[] {
  const centerLat = rect.reduce((s, p) => s + p.lat, 0) / 4;
  const centerLng = rect.reduce((s, p) => s + p.lng, 0) / 4;

  const cosLat = Math.cos((centerLat * Math.PI) / 180);

  // local XY in meters-ish
  const ptsXY = rect.map((p) => ({
    x: (p.lng - centerLng) * cosLat * 111_320,
    y: (p.lat - centerLat) * 111_320,
  }));

  // axis from first edge
  const axisA = {
    x: ptsXY[1]!.x - ptsXY[0]!.x,
    y: ptsXY[1]!.y - ptsXY[0]!.y,
  };
  const lenA = Math.hypot(axisA.x, axisA.y);
  axisA.x /= lenA;
  axisA.y /= lenA;

  const axisB = {
    x: -axisA.y,
    y: axisA.x,
  };

  const grownXY = ptsXY.map((p) => {
    const a = p.x * axisA.x + p.y * axisA.y;
    const b = p.x * axisB.x + p.y * axisB.y;

    const signA = Math.sign(a);
    const signB = Math.sign(b);

    return {
      x: axisA.x * (a + signA * growA) + axisB.x * (b + signB * growB),
      y: axisA.y * (a + signA * growA) + axisB.y * (b + signB * growB),
    };
  });

  // back to lat/lng
  return grownXY.map((p) => ({
    lat: centerLat + p.y / 111_320,
    lng: centerLng + p.x / (111_320 * cosLat),
  }));
}
