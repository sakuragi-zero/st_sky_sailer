import manifest from "../../sky_sailer/courses.json" with { type: "json" };

export const VIEW = { width: 720, height: 480 };
export type Channel = { x: number; y: number; width: number };
export type Theme = "sea" | "ice" | "desert" | "cloud";
export type Obstacle = { x: number; y: number; kind: "rock" | "iceberg" | "cactus" };
export type Cascade = { x: number; nextX: number; fromY: number; toY: number; ascent: boolean };
export type StarRing = { x: number; y: number; targetX: number; targetY: number; height: number };
export type Course = { id: string; title: string; theme: Theme; world: string; goal_label: string; description: string; intro: string; channels: Channel[]; cascades: Cascade[]; rings: StarRing[]; crystals: {x:number;y:number;red:boolean}[]; hazards: Obstacle[]; icicles: {x:number;y:number}[]; goalX: number; goalY: number; minY: number; timeLimitMs: number };
// Each supported stretch is flowing sky-water; the gaps spill into the clouds.
export const WATERWAYS = [
  { x: 0, y: 406, width: 860 },
  { x: 950, y: 394, width: 600 },
  { x: 1660, y: 381, width: 620 },
  { x: 2400, y: 407, width: 700 },
  { x: 3200, y: 387, width: 650 },
  { x: 3960, y: 403, width: 700 },
  { x: 4780, y: 379, width: 610 },
  { x: 5500, y: 406, width: 720 },
  { x: 6330, y: 391, width: 620 },
  { x: 7060, y: 379, width: 650 },
  { x: 7830, y: 407, width: 610 },
  { x: 8560, y: 394, width: 960 },
];
const ROCKS = [
  { x: 2900, y: 407 }, { x: 5180, y: 379 }, { x: 8260, y: 407 },
];

function cloudSteps(): Channel[] {
  let x = 0;
  return Array.from({ length: 22 }, (_, i) => {
    const width = i === 0 || i === 21 ? 700 : 340 + i % 3 * 20;
    const heights = [0, -32, -64, 96, 64, 32, 0, -32, 128, 96, 64, 32, -128, -160, -192, -32, -64, -96, -128, -160, -192, -224];
    const step = { x, y: 406 + heights[i % heights.length], width };
    x += width + 115 + i % 3 * 8;
    return step;
  });
}

export function getCourse(id = "1-1"): Course {
  const meta = manifest.find(course => course.id === id) ?? manifest[0];
  const theme = meta.theme as Theme;
  const base = theme === "cloud" ? cloudSteps() : WATERWAYS.map((channel, i) => ({ ...channel, y: theme === "ice" ? 402 - i % 3 * 12 : theme === "desert" ? 403 - i % 4 * 7 : channel.y }));
  if (theme !== "cloud") {
    const levels = [0, 0, 0, 170, 170, 0, 0, -160, -160, 0, 0, 0];
    base.forEach((channel, i) => { channel.y += levels[i]; });
  }
  // A second voyage region lies beyond a broad sky gap, reached by a star flight.
  const regionEnd = base.at(-1)!.x + base.at(-1)!.width;
  const regionOffset = regionEnd + 2800;
  const channels = [...base, ...base.map(channel => ({ ...channel, x: channel.x + regionOffset }))];
  const ringAt = (source: Channel, target: Channel, height = 540): StarRing => ({
    x: source.x + source.width - 190, y: source.y - 24,
    targetX: target.x + 160, targetY: target.y - 18, height,
  });
  const rings = [
    ringAt(base[2], base[5], 460),
    ringAt(base.at(-1)!, channels[base.length], 620),
    ringAt(channels[base.length + 5], channels[base.length + 8], 500),
  ];
  const cascades = channels.slice(0,-1).flatMap((channel,i) => {
    const next = channels[i+1];
    return next.x - channel.x - channel.width < 300 && Math.abs(next.y-channel.y) > 100 ? [{x:channel.x+channel.width,nextX:next.x,fromY:channel.y,toY:next.y,ascent:next.y<channel.y}] : [];
  });
  const last = channels.at(-1)!;
  const crystals = channels.flatMap((channel, i) => [
    { x: channel.x + (i === 0 ? 360 : Math.min(190, channel.width * 0.4)), y: channel.y - (i % 2 === 0 ? 27 : 72), red: i % 3 === 0 },
    { x: channel.x + channel.width - 110, y: channel.y - 98, red: i % 3 === 2 },
  ]);
  const candidates: Obstacle[] = theme === "sea" ? [0, regionOffset].flatMap(offset => ROCKS.map(point => ({ x: point.x + offset, y: channels.find(channel=>point.x+offset>=channel.x && point.x+offset<channel.x+channel.width)!.y, kind: "rock" as const }))) : theme === "cloud" ? [] : channels.filter((_, i) => i > 0 && (theme === "desert" ? i % 3 === 1 : i % 2 === 1)).map(channel => ({ x: channel.x + Math.min(theme === "desert" ? 430 : 335, channel.width * 0.7), y: channel.y, kind: theme === "ice" ? "iceberg" : "cactus" }));
  const hazards = candidates.filter(hazard => {
    const lane = channels.find(channel => hazard.x >= channel.x && hazard.x < channel.x + channel.width)!;
    return !rings.some(ring => ring.x >= lane.x && ring.x < lane.x + lane.width);
  });
  const icicles = theme === "ice" ? [{ x: 650, y: channels[0].y }, ...channels.filter((_, i) => i > 0 && i % 2 === 0).map(channel => ({ x: channel.x + 285, y: channel.y }))] : [];
  // Move skipped pickups onto the flight arc, keeping every crystal reachable.
  for (const ring of rings) {
    const airborne = crystals.filter(point => point.x > ring.x + 80 && point.x < ring.targetX - 80);
    airborne.forEach((point, i) => {
      const p = (i + 1) / (airborne.length + 1);
      point.x = ring.x + (ring.targetX - ring.x) * p;
      point.y = ring.y + (ring.targetY - ring.y) * p - 4 * ring.height * p * (1 - p);
    });
  }
  const bridge = rings[1];
  for (let i = 1; i <= 5; i++) {
    const p = i / 6;
    crystals.push({ x: bridge.x + (bridge.targetX - bridge.x) * p, y: bridge.y + (bridge.targetY - bridge.y) * p - 4 * bridge.height * p * (1-p), red: i === 3 });
  }
  return { ...meta, theme, channels, cascades, rings, crystals, hazards, icicles, goalX: last.x + last.width - 300, goalY: last.y, minY: Math.min(...channels.map(channel => channel.y)) - 850, timeLimitMs: 300000 };
}

// The browser harness uses the same route and pickups as the production scene.
const defaultCourse = getCourse();
export const GOAL_X = defaultCourse.goalX;
export const ISLANDS = defaultCourse.channels;
export const CRYSTALS = defaultCourse.crystals;
export const HAZARDS = defaultCourse.hazards;

export type GameData = { gravity: number; jump_power: number; run_id: string; course_id?: string };
export type Result = {
  run_id: string;
  attempt_id: string;
  course_id: string;
  status: "cleared" | "failed";
  elapsed_ms: number;
  hit_count: number;
  crystals: number;
  total_crystals: number;
};
export type Controls = { left: boolean; right: boolean; jump: boolean; boost: boolean; brake: boolean };
export type Phase = "loading" | "playing" | "paused" | "cleared" | "failed" | "error";
export type Hud = { elapsedMs: number; hits: number; crystals: number; progress: number; boostReady: number; windMs: number; windStacks: number; cue: string; weather: string; storm: number };
