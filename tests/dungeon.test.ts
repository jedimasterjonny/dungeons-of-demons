import { generateDungeon, TileType, isBossFloor, isPlanetFloor, monsterCountFor } from '../src/systems/dungeon';
import { KEYS, WORLD } from '../src/systems/config';

let failures = 0;
const fail = (floor: number, msg: string) => {
  failures++;
  console.log(`  FAIL floor ${floor}: ${msg}`);
};

/** Flood fill from the player start. `throughDoors` decides if locked doors block. */
function reachable(grid: number[][], start: { x: number; y: number }, throughDoors: boolean) {
  const seen = new Set<string>();
  const stack = [start];
  const ok = (t: number) =>
    t === TileType.Floor || t === TileType.Exit || t === TileType.Shop || (throughDoors && t === TileType.Door);
  while (stack.length) {
    const p = stack.pop()!;
    const k = `${p.x},${p.y}`;
    if (seen.has(k)) continue;
    if (grid[p.y]?.[p.x] === undefined || !ok(grid[p.y][p.x])) continue;
    seen.add(k);
    stack.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
  }
  return seen;
}

console.log('Validating floors 1-25, plus 100 and the planet\n');

const FLOORS = [...Array(25).keys()].map((i) => i + 1).concat([100, 101]);

for (const floor of FLOORS) {
  const d = generateDungeon(floor);
  const walkable = reachable(d.grid, d.playerStart, false);
  const withKeys = reachable(d.grid, d.playerStart, true);

  const at = (p: { x: number; y: number }) => d.grid[p.y][p.x];
  const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;

  // Landmarks must be standable and reachable with no keys at all.
  if (at(d.playerStart) !== TileType.Floor) fail(floor, 'player start is not floor');
  if (at(d.shop) !== TileType.Shop) fail(floor, 'shop tile wrong type');
  if (at(d.exit) !== TileType.Exit) fail(floor, 'exit tile wrong type');
  if (!walkable.has(key(d.shop))) fail(floor, 'shop unreachable without keys');
  if (!walkable.has(key(d.exit))) fail(floor, 'EXIT UNREACHABLE without keys — softlock');

  // Every vault must be sealed (not in the keyless fill) but openable (in the with-keys fill).
  for (const v of d.vaults) {
    const inside = { x: v.x + 1, y: v.y + 1 };
    if (walkable.has(key(inside))) fail(floor, `vault at ${v.x},${v.y} has a second entrance — lock is pointless`);
    if (!withKeys.has(key(inside))) fail(floor, `vault at ${v.x},${v.y} unreachable even with keys`);
  }

  // Every monster must stand on walkable ground, and be reachable once keys are spent.
  let vaultMonsters = 0;
  for (const m of d.monsters) {
    const t = at(m);
    if (t === TileType.Wall) fail(floor, `monster spawned inside a wall at ${m.x},${m.y}`);
    if (!withKeys.has(key(m))) fail(floor, `monster at ${m.x},${m.y} can never be reached — cannot clear floor`);
    if (!walkable.has(key(m))) vaultMonsters++;
  }

  // The key economy must close: monsters outside vaults have to fund every door.
  const outside = d.monsters.length - vaultMonsters;
  const keysEarnable = Math.floor(outside / KEYS.fragmentsPerKey);
  if (keysEarnable < d.doors.length) {
    fail(floor, `only ${keysEarnable} keys earnable outside vaults but ${d.doors.length} doors to open`);
  }

  for (const c of d.chests) {
    if (at(c) === TileType.Wall) fail(floor, `chest inside a wall at ${c.x},${c.y}`);
  }

  // Boss floors carry one extra monster: the boss itself, in the portal room.
  const bosses = d.monsters.filter((m) => m.kind === 'boss');
  if (isBossFloor(floor) && bosses.length !== 1) fail(floor, `expected 1 boss, found ${bosses.length}`);
  if (!isBossFloor(floor) && bosses.length !== 0) fail(floor, `boss on a non-boss floor`);
  for (const b of bosses) {
    if (!walkable.has(key(b))) fail(floor, `BOSS at ${b.x},${b.y} unreachable without keys — cannot clear floor`);
  }

  const titans = d.monsters.filter((m) => m.kind === 'thanos');
  if (isPlanetFloor(floor) && titans.length !== 1) fail(floor, `expected Thanos, found ${titans.length}`);
  if (!isPlanetFloor(floor) && titans.length !== 0) fail(floor, 'Thanos is loose in the castle');
  for (const t of titans) {
    if (!walkable.has(key(t))) fail(floor, `THANOS at ${t.x},${t.y} unreachable — cannot clear the planet`);
  }

  const expected = monsterCountFor(floor) + (isBossFloor(floor) || isPlanetFloor(floor) ? 1 : 0);
  const pad = String(floor).padStart(2);
  console.log(
    `  floor ${pad}: ${d.rooms.length} rooms, ${d.vaults.length} vault(s), ${d.doors.length} door(s), ` +
      `${d.monsters.length}/${expected} monsters (${vaultMonsters} vaulted)` +
      `${bosses.length ? ' +BOSS' : ''}${titans.length ? ' +THANOS' : ''}, ` +
      `${keysEarnable} keys earnable, ${d.chests.length} chests`
  );
}

console.log(`\ngrid ${WORLD.cols}x${WORLD.rows}`);
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
