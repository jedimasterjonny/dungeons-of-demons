import { BOSS, CAGES, DARKNESS, FLOOR, GIFTS, GRAVES, KEYS, PLANET, TILE, TRAPS, WORLD, type MonsterKind } from './config';

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

/**
 * A tile that does something when you step on it. A trap and a giving tile are exact
 * opposites, so they are the same thing with `good` flipped: a level up or down, or
 * coins up or down.
 */
export interface SpecialTile extends Spawn {
  /** A giving tile. Otherwise it is a trap. */
  good: boolean;
  effect: 'level' | 'coins';
  /** Has a tiny letter on it if you are looking: T for a trap, G for a giving tile. */
  marked: boolean;
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
  /** Plain floor as far as the grid is concerned; only some show a tiny T. */
  traps: SpecialTile[];
  /** The same, the other way round; only some show a tiny G. */
  gifts: SpecialTile[];
  /** Where wraiths come from. Always in a main room, never a vault. */
  graves: Spawn[];
  /** Lying about the floor, waiting to be found. */
  cagePieces: Spawn[];
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

/** No wraiths: they come from graves (see GRAVES), never placed on a floor up front. */
function kindsFor(floor: number): MonsterKind[] {
  const pool: MonsterKind[] = ['imp', 'imp', 'imp'];
  if (floor >= 2) pool.push('brute', 'brute');
  if (floor >= 5) pool.push('brute');
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

  // --- traps and giving tiles: plain floor anywhere but the room you land in, never
  // under a chest, and never on each other. Placed last, so adding them did not move a
  // single thing on any existing floor.
  const inStartRoom = (x: number, y: number) =>
    x >= startRoom.x && x < startRoom.x + startRoom.w && y >= startRoom.y && y < startRoom.y + startRoom.h;
  const spots: Spawn[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === TileType.Floor && !inStartRoom(x, y) && !chests.some((c) => c.x === x && c.y === y)) {
        spots.push({ x, y });
      }
    }
  }
  rng.shuffle(spots);
  // Floor 1 has nowhere to be sent back to, so its traps only take coins. And a giving
  // tile never skips a Demon Lord or Thanos, so on their floors it only gives coins.
  const canMove = (good: boolean) => (good ? !isBossFloor(floor) && !isPlanetFloor(floor) : floor > 1);
  const place = (spots: Spawn[], good: boolean, marked: number): SpecialTile[] =>
    spots.map((s, i) => ({
      ...s,
      good,
      effect: canMove(good) && rng.next() < 0.5 ? 'level' : 'coins',
      marked: i < marked,
    }));
  const traps = place(spots.slice(0, TRAPS.perFloor), false, TRAPS.marked);
  let left = spots.slice(TRAPS.perFloor);
  const gifts = place(left.splice(0, GIFTS.perFloor), true, GIFTS.marked);

  // --- graves, in the main rooms only: a grave behind a locked door would hold the
  // portal shut until you found a key. Cage pieces can be anywhere, vaults included.
  const inMainRoom = (s: Spawn) => rooms.slice(1).some((r) => s.x >= r.x && s.x < r.x + r.w && s.y >= r.y && s.y < r.y + r.h);
  const graves = floor >= GRAVES.fromFloor ? left.filter(inMainRoom).slice(0, GRAVES.perFloor) : [];
  left = left.filter((s) => !graves.includes(s));
  const cagePieces = left.slice(0, CAGES.piecesPerFloor);

  return { grid, rooms, vaults, doors, playerStart, exit, shop, monsters, chests, sword, traps, gifts, graves, cagePieces };
}
