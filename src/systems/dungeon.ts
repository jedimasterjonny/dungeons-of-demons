import { BOSS, DARKNESS, FLOOR, KEYS, PLANET, TILE, WORLD, type MonsterKind } from './config';

export const TileType = {
  Wall: 0,
  Floor: 1,
  /** Locked — costs one full key to open, then becomes Floor. */
  Door: 2,
  Exit: 3,
  Shop: 4,
} as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Spawn {
  x: number;
  y: number;
}

export interface MonsterSpawn extends Spawn {
  kind: MonsterKind;
}

export interface DungeonData {
  grid: TileType[][];
  rooms: Rect[];
  vaults: Rect[];
  doors: Spawn[];
  playerStart: Spawn;
  exit: Spawn;
  shop: Spawn;
  monsters: MonsterSpawn[];
  chests: Spawn[];
  /** The Star Sword, on the planet floor only. */
  sword?: Spawn;
}

/** Small deterministic RNG so a floor number always builds the same dungeon. */
class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    // xorshift32
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 0xffffffff;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

function centerOf(r: Rect): Spawn {
  return { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) };
}

function overlaps(a: Rect, b: Rect, margin: number): boolean {
  return (
    a.x - margin < b.x + b.w &&
    a.x + a.w + margin > b.x &&
    a.y - margin < b.y + b.h &&
    a.y + a.h + margin > b.y
  );
}

export function tileToWorld(t: number): number {
  return t * TILE + TILE / 2;
}

export function worldToTile(v: number): number {
  return Math.floor(v / TILE);
}

/**
 * A crate only goes on plain floor — never inside rock, a locked doorway, the shop
 * pad or the exit portal, since blocking those could strand you.
 */
export function isCrateTile(grid: TileType[][], tx: number, ty: number): boolean {
  return grid[ty]?.[tx] === TileType.Floor;
}

/** The one floor that is not in the castle at all: where Thanos waits. */
export function isPlanetFloor(floor: number): boolean {
  return floor === PLANET.floor;
}

/** Bosses stand on every tenth floor: 10, 20, 30, 40 and on down. */
export function isBossFloor(floor: number): boolean {
  return floor >= BOSS.everyNFloors && floor % BOSS.everyNFloors === 0;
}

/**
 * The lights are out on every twentieth floor: 20, 40, 60 and on down. Every one of
 * these is also a boss floor, since 20 is a multiple of 10 — a dark floor always has
 * a Demon Lord somewhere in it.
 */
export function isDarkFloor(floor: number): boolean {
  return floor >= DARKNESS.everyNFloors && floor % DARKNESS.everyNFloors === 0;
}

/** How many monsters live on a given floor. */
export function monsterCountFor(floor: number): number {
  // The planet is an arena, not a dungeon: Thanos and a few stragglers.
  if (isPlanetFloor(floor)) return PLANET.monsters;
  return Math.min(
    FLOOR.maxMonsters,
    FLOOR.baseMonsters + FLOOR.monstersPerFloor * (floor - 1)
  );
}

function kindsFor(floor: number): MonsterKind[] {
  const pool: MonsterKind[] = ['imp', 'imp', 'imp'];
  if (floor >= 2) pool.push('brute', 'brute');
  if (floor >= 3) pool.push('wraith', 'wraith');
  if (floor >= 5) pool.push('brute', 'wraith');
  return pool;
}

export function generateDungeon(floor: number): DungeonData {
  const rng = new Rng(floor * 2654435761 + 12345);
  const { cols, rows } = WORLD;

  const grid: TileType[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => TileType.Wall as TileType)
  );

  const carve = (r: Rect) => {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (y > 0 && y < rows - 1 && x > 0 && x < cols - 1) grid[y][x] = TileType.Floor;
      }
    }
  };

  // --- main rooms: placed at random, then chained together so every one is reachable
  const rooms: Rect[] = [];
  const targetRooms = 7 + Math.min(4, Math.floor(floor / 2));
  for (let attempt = 0; attempt < 400 && rooms.length < targetRooms; attempt++) {
    const w = rng.int(7, 13);
    const h = rng.int(6, 10);
    const candidate: Rect = {
      x: rng.int(2, cols - w - 3),
      y: rng.int(2, rows - h - 3),
      w,
      h,
    };
    if (rooms.some((r) => overlaps(candidate, r, 3))) continue;
    rooms.push(candidate);
  }

  // Order rooms left-to-right so the chain of corridors reads as a journey
  // rather than doubling back across the whole map.
  rooms.sort((a, b) => a.x + a.y - (b.x + b.y));
  rooms.forEach(carve);

  const carveCorridor = (a: Spawn, b: Spawn) => {
    // L-shaped: horizontal leg, then vertical. Two tiles wide so combat has room.
    const xs = a.x < b.x ? [a.x, b.x] : [b.x, a.x];
    const ys = a.y < b.y ? [a.y, b.y] : [b.y, a.y];
    for (let x = xs[0]; x <= xs[1]; x++) {
      for (let d = 0; d < 2; d++) {
        const y = a.y + d;
        if (y > 0 && y < rows - 1) grid[y][x] = TileType.Floor;
      }
    }
    for (let y = ys[0]; y <= ys[1]; y++) {
      for (let d = 0; d < 2; d++) {
        const x = b.x + d;
        if (x > 0 && x < cols - 1) grid[y][x] = TileType.Floor;
      }
    }
  };

  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(centerOf(rooms[i - 1]), centerOf(rooms[i]));
  }

  // --- vaults: side rooms hung off a main room, sealed behind one locked door.
  // They are carved *adjacent* to their host (never reached by a corridor), so the
  // single door tile is provably the only way in and locking it can't block the exit.
  const vaults: Rect[] = [];
  const doors: Spawn[] = [];
  // No locked vaults on the planet — there is nothing out there to lock.
  const wantVaults = isPlanetFloor(floor) ? 0 : 1 + Math.min(2, Math.floor(floor / 3));

  const tryVault = (): boolean => {
    const host = rng.pick(rooms.slice(1, Math.max(2, rooms.length - 1)));
    const side = rng.pick(['n', 's', 'e', 'w']);
    const vw = 6;
    const vh = 5;

    // Slide the vault along the shared wall instead of always aligning its corner
    // to the host's — a fixed alignment fails on most crowded maps.
    let v: Rect;
    if (side === 'e') {
      v = { x: host.x + host.w + 1, y: host.y + rng.int(-2, host.h - vh + 2), w: vw, h: vh };
    } else if (side === 'w') {
      v = { x: host.x - vw - 1, y: host.y + rng.int(-2, host.h - vh + 2), w: vw, h: vh };
    } else if (side === 's') {
      v = { x: host.x + rng.int(-2, host.w - vw + 2), y: host.y + host.h + 1, w: vw, h: vh };
    } else {
      v = { x: host.x + rng.int(-2, host.w - vw + 2), y: host.y - vh - 1, w: vw, h: vh };
    }

    if (v.x < 2 || v.y < 2 || v.x + v.w > cols - 3 || v.y + v.h > rows - 3) return false;
    if (rooms.some((r) => overlaps(v, r, 1))) return false;
    if (vaults.some((r) => overlaps(v, r, 2))) return false;

    // Reject if anything already carved sits in or against the space — that would
    // give the vault a second entrance and make the lock meaningless.
    for (let y = v.y - 1; y < v.y + v.h + 1; y++) {
      for (let x = v.x - 1; x < v.x + v.w + 1; x++) {
        if (grid[y]?.[x] === TileType.Floor) return false;
      }
    }

    // The door goes in the single wall line between host and vault, somewhere both
    // rooms actually span. No overlap means no legal door, so no vault.
    let door: Spawn;
    if (side === 'e' || side === 'w') {
      const lo = Math.max(host.y, v.y);
      const hi = Math.min(host.y + host.h, v.y + v.h) - 1;
      if (hi < lo) return false;
      door = { x: side === 'e' ? host.x + host.w : host.x - 1, y: rng.int(lo, hi) };
    } else {
      const lo = Math.max(host.x, v.x);
      const hi = Math.min(host.x + host.w, v.x + v.w) - 1;
      if (hi < lo) return false;
      door = { x: rng.int(lo, hi), y: side === 's' ? host.y + host.h : host.y - 1 };
    }

    carve(v);
    grid[door.y][door.x] = TileType.Door;
    vaults.push(v);
    doors.push(door);
    return true;
  };

  for (let attempt = 0; attempt < 800 && vaults.length < wantVaults; attempt++) {
    tryVault();
  }

  // --- landmarks
  const startRoom = rooms[0];
  const exitRoom = rooms[rooms.length - 1];
  const playerStart = centerOf(startRoom);
  const shop = { x: startRoom.x + 1, y: startRoom.y + 1 };
  const exit = centerOf(exitRoom);
  grid[shop.y][shop.x] = TileType.Shop;
  grid[exit.y][exit.x] = TileType.Exit;

  // --- monsters
  const total = monsterCountFor(floor);
  const kinds = kindsFor(floor);

  // A vault can only hold monsters if the ones outside it still yield enough keys
  // to open every door. Outside kills must cover: 3 fragments per key, one key per door.
  const maxVaultMonsters = Math.max(
    0,
    total - vaults.length * KEYS.fragmentsPerKey - 2
  );
  const perVault = Math.min(2, Math.floor(maxVaultMonsters / Math.max(1, vaults.length)));

  const monsters: MonsterSpawn[] = [];
  const spotIn = (r: Rect): Spawn => ({
    x: rng.int(r.x + 1, r.x + r.w - 2),
    y: rng.int(r.y + 1, r.y + r.h - 2),
  });

  for (const v of vaults) {
    for (let i = 0; i < perVault; i++) {
      monsters.push({ ...spotIn(v), kind: rng.pick(kinds) });
    }
  }

  // The rest go in the main rooms, never the one you spawn in.
  const spawnRooms = rooms.slice(1);
  while (monsters.length < total && spawnRooms.length > 0) {
    const r = spawnRooms[monsters.length % spawnRooms.length];
    monsters.push({ ...spotIn(r), kind: rng.pick(kinds) });
  }

  // --- the boss, posted in the room with the portal so it guards the way out
  if (isBossFloor(floor)) {
    monsters.push({ ...spotIn(exitRoom), kind: 'boss' });
  }
  if (isPlanetFloor(floor)) {
    monsters.push({ ...spotIn(exitRoom), kind: 'thanos' });
  }

  // --- the Star Sword, lying two tiles from where you land so it cannot be missed
  const sword = isPlanetFloor(floor)
    ? { x: playerStart.x + 2, y: playerStart.y }
    : undefined;

  // --- chests: the reward for spending a key
  const chests: Spawn[] = vaults.map((v) => centerOf(v));
  for (const r of rng.shuffle(rooms.slice(1)).slice(0, 2)) {
    chests.push(spotIn(r));
  }

  return { grid, rooms, vaults, doors, playerStart, exit, shop, monsters, chests, sword };
}
