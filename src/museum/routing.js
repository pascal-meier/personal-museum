import { CurvePath, LineCurve3, QuadraticBezierCurve3, Vector3 } from "../../vendor/three/three.module.min.js";

const columnRadius = 2.8;

export function isWalkBlocked(x, z, width, columns, obstacles) {
  if (Math.abs(x) > width * 1.2 - .55 || z < -width * 2 - 1.1 || z > width * 2.1 - .55) return true;
  if (columns.some(center => Math.hypot(x - center.x, z - center.z) < columnRadius)) return true;
  for (const obstacle of obstacles) {
    if (obstacle.radius <= 0) continue;
    const dx = x - obstacle.center.x, dz = z - obstacle.center.z;
    if (obstacle.halfWidth !== undefined) {
      if (Math.abs(dx) < obstacle.halfWidth + .35 && Math.abs(dz) < obstacle.halfDepth + .35) return true;
    } else if (Math.hypot(dx, dz) < obstacle.radius + .35) return true;
  }
  return Math.hypot(x + width * 1.2 - 1.3, z + width * 2 + .38) < 1.1
    || Math.hypot(x - width * 1.2 + 1, z + width * 2 - .7) < 1.25;
}

// Guided views use a conservative circle around furniture, including rectangular displays.
export function findGuidedRoute(start, end, width, columns, obstacles) {
  const circles = [
    ...columns.map(center => ({ center, radius: columnRadius })),
    ...obstacles.filter(obstacle => obstacle.radius > 0)
  ];
  const insideHall = ({ x, z }) => Math.abs(x) <= width * 1.2 - .3 && z >= -width * 2 - 1.4 && z <= width * 2.1;
  const clearPoint = point => insideHall(point) && circles.every(({ center, radius }) =>
    (point.x - center.x) ** 2 + (point.z - center.z) ** 2 >= radius ** 2);

  // All graph nodes are inside the rectangular hall. Only obstacles can cut their connecting segment.
  function clearSegment(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared === 0) return true;
    return circles.every(({ center, radius }) => {
      const t = Math.max(0, Math.min(1, ((center.x - a.x) * dx + (center.z - a.z) * dz) / lengthSquared));
      return (a.x + t * dx - center.x) ** 2 + (a.z + t * dz - center.z) ** 2 >= radius ** 2;
    });
  }

  if (!clearPoint(start) || !clearPoint(end)) return null;
  if (clearSegment(start, end)) return new LineCurve3(start, end);
  const dx = end.x - start.x, dz = end.z - start.z, distance = Math.hypot(dx, dz);
  const sample = new Vector3();
  for (const offset of [6, 10, 14, 20, 28]) {
    for (const side of [-1, 1]) {
      const control = start.clone().lerp(end, .5);
      control.x -= side * dz / distance * offset;
      control.z += side * dx / distance * offset;
      const curve = new QuadraticBezierCurve3(start, control, end);
      let clear = true;
      for (let step = 1; step < 100 && clear; step++) clear = clearPoint(curve.getPoint(step / 100, sample));
      if (clear) return curve;
    }
  }

  // Some routes require multiple turns. Find the shortest visible sequence of points around obstacles.
  const nodes = [start, end];
  for (const { center, radius } of circles) {
    for (let index = 0; index < 12; index++) {
      const angle = index * Math.PI / 6;
      const point = new Vector3(center.x + Math.cos(angle) * (radius + .4), start.y, center.z + Math.sin(angle) * (radius + .4));
      if (clearPoint(point)) nodes.push(point);
    }
  }
  const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set();
  costs[0] = 0;
  while (true) {
    let nearest = -1, lowestCost = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      if (!visited.has(i) && costs[i] < lowestCost) {
        nearest = i;
        lowestCost = costs[i];
      }
    }
    if (nearest === -1) return null;
    if (nearest === 1) break;
    visited.add(nearest);
    for (let i = 0; i < nodes.length; i++) {
      if (visited.has(i)) continue;
      const cost = lowestCost + nodes[nearest].distanceTo(nodes[i]);
      if (cost < costs[i] && clearSegment(nodes[nearest], nodes[i])) {
        costs[i] = cost;
        previous[i] = nearest;
      }
    }
  }
  const path = new CurvePath();
  const points = [];
  for (let i = 1; i >= 0; i = previous[i]) points.push(nodes[i]);
  for (let i = points.length - 1; i > 0; i--) path.add(new LineCurve3(points[i], points[i - 1]));
  return path;
}
