import manifest from "../../sky_sailer/courses.json" with { type: "json" };

export const VIEW = { width: 720, height: 480 };
export type Channel = { x: number; y: number; width: number };
export type Theme = "sea" | "ice" | "desert" | "cloud";
export type Obstacle = { x: number; y: number; kind: "rock" | "iceberg" | "cactus" };
export type Cascade = { x: number; nextX: number; fromY: number; toY: number; ascent: boolean };
export type Course = { id: string; title: string; theme: Theme; world: string; goal_label: string; description: string; intro: string; channels: Channel[]; cascades: Cascade[]; crystals: {x:number;y:number;red:boolean}[]; hazards: Obstacle[]; icicles: {x:number;y:number}[]; goalX: number; goalY: number; minY: number };
export const GOAL_X = 8860;
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
// Kept for the existing scene harness; no ground/island art is used on this route.
export const ISLANDS = WATERWAYS;
export const CRYSTALS = WATERWAYS.flatMap((island, index) => [
  { x: island.x + 210, y: island.y - 76, red: index % 3 === 0 },
  { x: island.x + island.width - 125, y: island.y - 102, red: index % 3 === 2 },
]);
export const HAZARDS = [
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
  const channels = theme === "cloud" ? cloudSteps() : WATERWAYS.map((channel, i) => ({ ...channel, y: theme === "ice" ? 402 - i % 3 * 12 : theme === "desert" ? 403 - i % 4 * 7 : channel.y }));
  if (theme !== "cloud") {
    const levels = [0, 0, 0, 170, 170, 0, 0, -160, -160, 0, 0, 0];
    channels.forEach((channel, i) => { channel.y += levels[i]; });
  }
  const cascades = channels.slice(0,-1).flatMap((channel,i) => {
    const next = channels[i+1];
    return Math.abs(next.y-channel.y) > 100 ? [{x:channel.x+channel.width,nextX:next.x,fromY:channel.y,toY:next.y,ascent:next.y<channel.y}] : [];
  });
  const last = channels.at(-1)!;
  const crystals = channels.flatMap((channel, i) => [
    { x: channel.x + (i === 0 ? 360 : Math.min(190, channel.width * 0.4)), y: channel.y - (i % 2 === 0 ? 27 : 72), red: i % 3 === 0 },
    { x: channel.x + channel.width - 110, y: channel.y - 98, red: i % 3 === 2 },
  ]);
  const hazards: Obstacle[] = theme === "sea" ? HAZARDS.map(point => ({ ...point, y: channels.find(channel=>point.x>=channel.x && point.x<channel.x+channel.width)!.y, kind: "rock" })) : theme === "cloud" ? [] : channels.filter((_, i) => i > 0 && (theme === "desert" || i % 2 === 1)).map(channel => ({ x: channel.x + Math.min(335, channel.width * 0.55), y: channel.y, kind: theme === "ice" ? "iceberg" : "cactus" }));
  const icicles = theme === "ice" ? [{ x: 650, y: channels[0].y }, ...channels.filter((_, i) => i > 0 && i % 2 === 0).map(channel => ({ x: channel.x + 285, y: channel.y }))] : [];
  return { ...meta, theme, channels, cascades, crystals, hazards, icicles, goalX: theme === "sea" ? GOAL_X : last.x + last.width - 300, goalY: last.y, minY: Math.min(...channels.map(channel => channel.y)) - 650 };
}

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
export type Hud = { elapsedMs: number; hits: number; crystals: number; progress: number; boostReady: number; windMs: number; cue: string; weather: string; storm: number };
