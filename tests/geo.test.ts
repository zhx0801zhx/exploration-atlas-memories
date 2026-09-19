import { describe, expect, it } from "vitest";
import {
  bearingDegrees,
  haversineDistance,
  holdLastReliablePosition,
  isInsideCheckpoint,
  matchPositionToRoute,
  medianSample,
  projectHeadingToMap,
  projectLocationToBounds,
  projectPositionToMap,
  smoothPositionSample,
} from "../src/lib/geo";
import { gcj02ToWgs84Approx, wgs84ToGcj02 } from "../src/lib/coordinateTransform";
import { zones } from "../src/config/story";

const yuyuanZone = zones.find((zone) => zone.id === "yuyuan-past")!;
const shimaoZone = zones.find((zone) => zone.id === "shimao-present")!;
const castleZone = zones.find((zone) => zone.id === "castle-future")!;

describe("geographic matching", () => {
  const route = [
    { latitude: 31.23, longitude: 121.48 },
    { latitude: 31.23, longitude: 121.481 },
    { latitude: 31.23, longitude: 121.482 },
  ];

  it("computes useful meter distances", () => {
    const distance = haversineDistance(route[0], route[1]);
    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(100);
  });

  it("snaps a nearby position to route progress", () => {
    const match = matchPositionToRoute(
      { latitude: 31.23002, longitude: 121.481 },
      route,
      route[2],
    );
    expect(match.progress).toBeGreaterThan(0.45);
    expect(match.progress).toBeLessThan(0.55);
    expect(match.distanceFromRouteM).toBeLessThan(4);
  });

  it("uses median values to suppress a location spike", () => {
    const sample = medianSample([
      { latitude: 31.23, longitude: 121.48, accuracy: 20, timestamp: 1 },
      { latitude: 32.5, longitude: 122, accuracy: 900, timestamp: 2 },
      { latitude: 31.2301, longitude: 121.4801, accuracy: 22, timestamp: 3 },
    ]);
    expect(sample?.latitude).toBeCloseTo(31.2301);
    expect(sample?.accuracy).toBe(22);
  });

  it("keeps a geofence tight while allowing a small accuracy edge", () => {
    expect(isInsideCheckpoint(54, 80, 45)).toBe(true);
    expect(isInsideCheckpoint(56, 80, 45)).toBe(false);
    expect(isInsideCheckpoint(0, 500, 45, 160)).toBe(false);
    expect(isInsideCheckpoint(0, Number.NaN, 45, 160)).toBe(false);
  });

  it("derives a geographic walking direction when GPS has no compass heading", () => {
    expect(bearingDegrees(route[0], route[1])).toBeCloseTo(90, 1);
    expect(bearingDegrees(route[0], {
      latitude: route[0].latitude + 0.001,
      longitude: route[0].longitude,
    })).toBeCloseTo(0, 1);
  });

  it("freezes at the last reliable coordinate when a coarse sample arrives", () => {
    const previous = { latitude: 31.23, longitude: 121.48, accuracy: 24, timestamp: 1 };
    const held = holdLastReliablePosition(previous, {
      latitude: 31.1,
      longitude: 121.2,
      accuracy: 500,
      timestamp: 2,
    });
    expect(held?.latitude).toBe(previous.latitude);
    expect(held?.longitude).toBe(previous.longitude);
    expect(held?.accuracy).toBe(500);
    expect(held?.timestamp).toBe(2);
    expect(holdLastReliablePosition(null, { ...previous, accuracy: 500 })).toBeNull();
  });

  it("projects every paired WGS route anchor onto the illustrated route", () => {
    for (const zone of zones) {
      expect(zone.coordinateSystem).toBe("wgs84");
      expect(zone.mapRoutePoints).toHaveLength(zone.routeGeo.length);
      const checkpoint = zone.checkpoints[0];
      zone.routeGeo.forEach((point, index) => {
        const projected = projectPositionToMap(point, zone, checkpoint);
        expect(projected.x).toBeCloseTo(zone.mapRoutePoints![index].x, 0);
        expect(projected.y).toBeCloseTo(zone.mapRoutePoints![index].y, 0);
      });
    }
  });

  it("contains a far sample inside the visible map", () => {
    const point = projectPositionToMap(
      { latitude: 31.2, longitude: 121.42 },
      yuyuanZone,
      yuyuanZone.checkpoints[0],
    );
    expect(point.x).toBeGreaterThanOrEqual(10);
    expect(point.x).toBeLessThanOrEqual(790);
    expect(point.y).toBeGreaterThanOrEqual(10);
    expect(point.y).toBeLessThanOrEqual(490);
  });

  it("keeps nearby movement visible instead of pinning it", () => {
    const checkpoint = yuyuanZone.checkpoints[0];
    const first = projectPositionToMap(
      { latitude: 31.23132, longitude: 121.48235 },
      yuyuanZone,
      checkpoint,
    );
    const second = projectPositionToMap(
      { latitude: 31.23127, longitude: 121.48245 },
      yuyuanZone,
      checkpoint,
    );
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThan(20);
  });

  it("keeps compass bearings literal on every north-up formal map", () => {
    for (const zone of zones) {
      const checkpoint = zone.checkpoints[0];
      expect(projectHeadingToMap(zone.routeGeo[0], 0, zone, checkpoint)).toBe(0);
      expect(projectHeadingToMap(zone.routeGeo[0], 90, zone, checkpoint)).toBe(90);
      expect(projectHeadingToMap(zone.routeGeo[0], 180, zone, checkpoint)).toBe(180);
      expect(projectHeadingToMap(zone.routeGeo[0], 270, zone, checkpoint)).toBe(270);
    }
  });

  it("keeps every formal checkpoint aligned to its geographic bounds", () => {
    for (const zone of zones) {
      for (const checkpoint of zone.checkpoints) {
        const point = projectLocationToBounds(checkpoint.location, zone.mapBounds!);
        expect(point.x).toBeCloseTo(checkpoint.mapPoint.x, 0);
        expect(point.y).toBeCloseTo(checkpoint.mapPoint.y, 0);
      }
    }
  });

  it("responds immediately to meaningful movement without a five-sample freeze", () => {
    const previous = { latitude: 31.23, longitude: 121.48, accuracy: 35, timestamp: 1, heading: 180 };
    const next = { latitude: 31.2302, longitude: 121.48, accuracy: 35, timestamp: 2 };
    const smoothed = smoothPositionSample(previous, next);
    expect(smoothed.latitude).toBe(next.latitude);
    expect(smoothed.timestamp).toBe(2);
    expect(smoothed.heading).toBe(180);
  });
});

describe("offline coordinate preparation", () => {
  it("round-trips the Yuyuan Exit 1 provider coordinate", () => {
    const provider = { latitude: 31.228604, longitude: 121.487516 };
    const converted = gcj02ToWgs84Approx(provider);
    expect(haversineDistance(converted, yuyuanZone.checkpoints[0].location)).toBeLessThan(3);
    expect(haversineDistance(wgs84ToGcj02(converted), provider)).toBeLessThan(1);
  });

  it("keeps the adjacent Shanghai Shimao storefronts distinct", () => {
    const [popmart, lego] = shimaoZone.checkpoints;
    const distance = haversineDistance(popmart.location, lego.location);
    expect(distance).toBeGreaterThan(15);
    expect(distance).toBeLessThan(30);
    expect(lego.arrivalMode).toBe("manual");
  });

  it("round-trips the Yifeng Bund Source provider coordinate", () => {
    const provider = { latitude: 31.240436, longitude: 121.488895 };
    const converted = gcj02ToWgs84Approx(provider);
    expect(haversineDistance(converted, castleZone.checkpoints[0].location)).toBeLessThan(3);
    expect(haversineDistance(wgs84ToGcj02(converted), provider)).toBeLessThan(1);
  });
});
