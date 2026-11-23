export const HALL_BAY = 20;

// Layout uses local exhibit coordinates; hall groups use a fitted scale.
export function exhibitBounds(item, scale = 1) {
  const parts = [...(item.wallDecor || []), item.headingPaint, ...item.works.flatMap(work => [work.frame, work.labelPaint])].filter(Boolean);
  const left = Math.min(...parts.map(part => part.position.x - part.scale.x / 2)) * scale;
  const right = Math.max(...parts.map(part => part.position.x + part.scale.x / 2)) * scale;
  return { left, right, width: right - left };
}

export function distributeWallGroups(items, start, end, scale = .8, minGap = 4) {
  const bounds = items.map(item => exhibitBounds(item, scale));
  const used = bounds.reduce((sum, box) => sum + box.width, 0);
  const gap = items.length > 1 ? Math.max(minGap, (end - start - used) / (items.length - 1)) : 0;
  let cursor = (start + end - used - gap * Math.max(0, items.length - 1)) / 2;
  const positions = new Map();
  items.forEach((item, index) => {
    positions.set(item, cursor - bounds[index].left);
    cursor += bounds[index].width + gap;
  });
  return positions;
}

export function fitWallGroupScale(items, start, end, preferredScale = .8, minGap = 4) {
  const used = items.reduce((sum, item) => sum + exhibitBounds(item, preferredScale).width, 0);
  if (!used) return preferredScale;
  const requiredGaps = Math.max(0, items.length - 1) * minGap;
  const availableForGroups = Math.max(0, end - start - requiredGaps);
  return Math.min(preferredScale, preferredScale * availableForGroups / used);
}

export function fitHallExhibitScale({ games, design, graphics, wallStart, wallEnd, halfWidth }, preferredScale = .8) {
  const split = Math.ceil(graphics.length / 2);
  return Math.min(
    fitWallGroupScale(games, -wallEnd, -wallStart, preferredScale),
    fitWallGroupScale(design, wallStart, wallEnd, preferredScale),
    fitWallGroupScale(graphics.slice(0, split), -halfWidth + 4, -4, preferredScale, 2.5),
    fitWallGroupScale(graphics.slice(split), 4, halfWidth - 4, preferredScale, 2.5)
  );
}

export function distributeEntranceGroups(items, halfWidth, scale = .8, minGap = 4) {
  const split = Math.ceil(items.length / 2);
  return new Map([
    ...distributeWallGroups(items.slice(0, split), -halfWidth + 4, -4, scale, minGap),
    ...distributeWallGroups(items.slice(split), 4, halfWidth - 4, scale, minGap)
  ]);
}

export function galleryFurnitureLayout(bay) {
  const media = { x: 1.2, z: -4.8 };
  const vitrine = { x: -bay * .45, z: -bay * .5 };
  return {
    media,
    vitrine,
    columns: [-1, 1].flatMap(z => [-1, 1].map(x => ({ x: x * bay * .7, z: z * bay * 1.2 })))
  };
}

export function hallWallTitleLayout(side, bay, rear, front) {
  if (side === -1 || side === 1) {
    return {
      x: side * (bay * 1.2 - .02),
      y: 8.05 / 2,
      z: (rear + front) / 2,
      rotationY: side * -Math.PI / 2,
      width: front - rear,
      height: 8.05
    };
  }
  if (side === 0 || side === 2) {
    return {
      x: 0,
      y: 9.3 / 2,
      z: side === 0 ? front - .07 : rear + .02,
      rotationY: side === 0 ? Math.PI : 0,
      width: bay * 2.4 + .6,
      height: 9.3
    };
  }
  throw new Error("Invalid hall wall side");
}

export function spaceExhibitColumns(works, gap = 1.5) {
  // Equal x positions identify a stack or a print-and-application pair.
  const columns = new Map();
  for (const work of works) {
    const key = work.frame.position.x.toFixed(6);
    if (!columns.has(key)) columns.set(key, []);
    columns.get(key).push(work);
  }
  const groups = [...columns.values()].sort((a, b) => a[0].frame.position.x - b[0].frame.position.x);
  const bounds = groups.map(column => {
    const left = Math.min(...column.map(work => work.frame.position.x - work.frame.scale.x / 2));
    // Reserve the full caption width before its text is painted.
    const right = Math.max(...column.map(work => work.frame.position.x - work.frame.scale.x / 2
      + Math.max(work.frame.scale.x, work.companion ? 0 : 3.6)));
    return { left, width: right - left };
  });
  let cursor = -(bounds.reduce((sum, box) => sum + box.width, 0) + gap * Math.max(0, groups.length - 1)) / 2;
  groups.forEach((column, index) => {
    const shift = cursor - bounds[index].left;
    for (const work of column) {
      for (const part of work.visual.children) part.position.x += shift;
      work.anchor.x += shift;
    }
    cursor += bounds[index].width + gap;
  });
}

export function photoWallLayout() {
  return [
    [-18.65, 5.2, 3, 7.1], [-15.039, 2.15, 1.65, 7.45],
    [-14.67, 2.15, 1.65, 5.48], [-4.34, 4.2, 2.8, 7.4],
    [-8.11, 2.7, 2.3, 6.1], [-11.535, 2.75, 2.4, 7.3],
    [-.545, 2.75, 2.3, 6.2], [2.905, 2.75, 2.5, 7.35],
    [5.95, 2.7, 2.7, 6.25], [9.02, 2.8, 2.4, 7.4],
    [11.85, 2.65, 3.5, 6.7], [14.679, 2.8, 2.5, 7.35],
    [17.891, 2.7, 3.5, 6.9], [20.434, 2.7, 3.5, 7.4]
  ].map(([x, w, h, top]) => ({ x, y: 0, w, h, top }));
}

// Keep the game lead and its supporting studies together in the upper wall zone.
export function gameWallStyle(theme, display, count = 3) {
  if (display === "research" && count === 4) {
    return { slots: [
      { x: -7.6, y: 5, w: 4.2, h: 2.8, top: 6.4 },
      { x: -1.6, y: 5.325, w: 4.2, h: 2.15, top: 6.4 },
      { x: 3, y: 5, w: 4.2, h: 2.8, top: 6.4 },
      { x: 7.6, y: 5.2, w: 4.2, h: 2.4, top: 6.4 }
    ] };
  }
  const slots = count === 2 ? [
    { x: -2, y: 5, w: 4.2, h: 2.8, top: 6.4 },
    { x: 2.4, y: 5.2, w: 3.4, h: 2.4, top: 6.4 }
  ] : [
    { x: 0, y: 5, w: 4.5, h: 2.8, top: 6.4 },
    { x: 4.15, y: 5.325, w: 3, h: 2.15, top: 6.4 },
    { x: -4.15, y: 5.325, w: 3, h: 2.15, top: 6.4 }
  ];
  return { slots };
}
