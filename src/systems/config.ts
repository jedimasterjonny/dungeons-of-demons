/** All tunable numbers live here so balancing never means hunting through scenes. */

export const TILE = 32;

export const WORLD = {
  /** Dungeon grid size in tiles. */
  cols: 60,
  rows: 44,
  viewWidth: 960,
  viewHeight: 540,
};

export const KEYS = {
  /** Monsters you must kill for one full key. Fragments below this are partial. */
  fragmentsPerKey: 3,
};

export const CURRENCY = {
  /** Coins that convert into a single galaxy coin. */
  coinsPerGalaxyCoin: 3000,
};

export const PLAYER = {
  baseMaxHp: 100,
  baseSpeed: 190,
  baseDamage: 20,
  /** Seconds between swings. */
  baseAttackCooldown: 0.38,
  attackRange: 58,
  /** Half-angle of the swing arc, in degrees. */
  attackArc: 70,
  knockback: 260,
  /** Invulnerability after taking a hit, in seconds. */
  invulnTime: 0.7,
  radius: 11,
};

/**
 * The boss that guards the portal on every tenth floor. Its health is a flat 100 —
 * deliberately NOT scaled by floor like every other demon — so a deep boss is a glass
 * cannon: it dies in five clean swings but hits harder every ten floors.
 */
export const BOSS = {
  /** Floors that hold a boss: 10, 20, 30 and so on. */
  everyNFloors: 10,
  maxHp: 100,
  name: 'Demon Lord',
};

/**
 * Past the hundredth floor you step out of the castle and land somewhere else. The
 * planet is one floor: an arena with no vaults, a handful of demons, and Thanos.
 */
export const PLANET = {
  floor: 101,
  name: 'The Weird Planet',
  /** Thanos aside, the planet is not crowded. */
  monsters: 8,
  ground: 0xd98a5c,
  walls: 0x8a6bd6,
  sky: 0x0d0620,
  /**
   * The Star Sword, lying in the room you land in. It sets your swing to a flat 500,
   * which turns 40,000 health from 571 swings into 80 — a fight rather than a wall.
   * It belongs to the planet: you lose it the moment you leave.
   */
  swordName: 'Star Sword',
  swordDamage: 500,
};

/**
 * The ????? Shard. Every Demon Lord on every tenth floor gives you one when it falls.
 * Each is a tiny power-up on its own; all ten together make a massive one, and it is
 * aimed at exactly one enemy: Thanos.
 */
export const SHARDS = {
  name: '????? Shard',
  /** Floors whose boss gives a shard: 10, 20, 30 and so on. */
  everyNFloors: BOSS.everyNFloors,
  /** The tiny power-up: added to your own swing, per shard. */
  damagePerShard: 2,
  /** Shards that make the massive power-up. One from each Demon Lord, 10 to 100. */
  forMassive: 10,
  /** The massive power-up: every hit on Thanos counts this many times over. */
  thanosMultiplier: 4,
};

export type MonsterKind = 'imp' | 'brute' | 'wraith' | 'boss' | 'thanos';

export interface MonsterStats {
  kind: MonsterKind;
  maxHp: number;
  speed: number;
  damage: number;
  aggroRange: number;
  radius: number;
  coinDrop: [number, number];
  tint: number;
  /** Whether this demon can scream to weaken your swing. See SCREECH. */
  screecher: boolean;
  /** A boss. Its health AND damage are flat numbers that never scale with the floor. */
  boss: boolean;
  /** Shown on the boss health bar. */
  label: string;
}

export const MONSTERS: Record<MonsterKind, MonsterStats> = {
  imp: {
    kind: 'imp',
    maxHp: 30,
    speed: 130,
    damage: 8,
    aggroRange: 260,
    radius: 10,
    coinDrop: [40, 90],
    tint: 0xff6b4a,
    screecher: false,
    boss: false,
    label: 'Imp',
  },
  brute: {
    kind: 'brute',
    maxHp: 85,
    speed: 78,
    damage: 18,
    aggroRange: 220,
    radius: 15,
    coinDrop: [110, 190],
    tint: 0x9b5de5,
    screecher: false,
    boss: false,
    label: 'Brute',
  },
  wraith: {
    kind: 'wraith',
    maxHp: 45,
    speed: 175,
    damage: 12,
    aggroRange: 340,
    radius: 11,
    coinDrop: [80, 140],
    tint: 0x4ad9ff,
    screecher: true,
    boss: false,
    label: 'Wraith',
  },
  boss: {
    kind: 'boss',
    maxHp: BOSS.maxHp,
    speed: 96,
    // Flat, like its health. A boss that scaled damage would one-shot you by floor 90.
    damage: 44,
    aggroRange: 460,
    radius: 20,
    coinDrop: [600, 950],
    tint: 0xff3b5c,
    screecher: true,
    boss: true,
    label: BOSS.name,
  },
  thanos: {
    kind: 'thanos',
    maxHp: 40000,
    speed: 76,
    damage: 70,
    /** He sees you the moment you land. */
    aggroRange: 2000,
    radius: 22,
    coinDrop: [20000, 30000],
    /** Drawn in full colour rather than white, so it is not tinted at all. */
    tint: 0xffffff,
    screecher: true,
    boss: true,
    label: 'Thanos',
  },
};

/**
 * The wraith's scream. It does no damage — it makes your swing feeble for a few
 * seconds, which is worse. Cute Fluffy Earmuffs (a shop upgrade) muffle it, then
 * block it outright.
 */
export const SCREECH = {
  /** Fraction of your damage a screech takes away, before earmuffs. */
  attackReduction: 0.4,
  /** Seconds the weakness lasts, before earmuffs. */
  duration: 5,
  /** Seconds one demon waits between screams. */
  cooldown: 7,
  /** It only screams if you are this close. */
  range: 250,
  /** It plants its feet for this long to scream, which is your window to hit it. */
  windUp: 0.45,
};

/**
 * Crates. You carry a few onto every floor and drop them to make your own walls —
 * a demon has to chew through one to reach you, and so do you to get back out.
 */
export const CRATES = {
  /** Crates you start every floor with, before the shop adds more. */
  startingCount: 3,
  /** How much punishment one takes before it splinters. */
  maxHp: 100,
  /** A demon gnawing a crate deals its own damage, once per second. */
  chewRate: 1,
};

/**
 * Every twentieth floor the lights go out. The floor is pitch black except for what
 * your own light reaches, and the ground you have already walked stays dimly lit
 * behind you — so a dark floor is mapped by walking it, not by looking at it.
 */
export const DARKNESS = {
  /** Floors that go dark: 20, 40, 60 and so on. */
  everyNFloors: 20,
  /** How far your light reaches right now, in pixels. Eight tiles. */
  lightRadius: 8 * TILE,
  /**
   * How much of that you keep. Smaller than lightRadius on purpose: the far edge of
   * what you can see is not remembered, so ground has to be walked to stay lit.
   */
  memoryRadius: 6 * TILE,
  /** How black remembered ground stays. 0 is full daylight, 1 is unvisited black. */
  memoryDarkness: 0.66,
  /** Pixels the player must move before the trail is stamped again. */
  stampDistance: 6,
};

/**
 * Two players on one keyboard. Running out of health puts you on the floor rather
 * than ending the run, and the other player can pick you up — so a bad moment costs
 * the party time instead of the floor.
 */
export const COOP = {
  /** Seconds the rescuer must stand over you. Long enough to be a real decision. */
  rescueTime: 3,
  /** How close they have to be, in pixels. */
  rescueRange: 46,
  /** Health you get back, as a share of your own maximum. */
  reviveHealth: 0.5,
  /**
   * The camera pulls back to hold both players. Below 1 the world is drawn smaller,
   * and this is the furthest it will go before they are simply left to separate.
   */
  minZoom: 0.62,
  /** Ring colours under each player's feet, so two identical avatars stay apart. */
  playerOneTint: 0xffd15c,
  playerTwoTint: 0x8affc9,
};

export const FLOOR = {
  /** Monster count on floor n = base + perFloor * (n - 1), capped. */
  baseMonsters: 9,
  monstersPerFloor: 3,
  maxMonsters: 28,
  /** Monster stats scale by this much per floor beyond the first. */
  hpScalePerFloor: 0.18,
  damageScalePerFloor: 0.12,
  /** Coin rewards scale more gently than threat. */
  coinScalePerFloor: 0.1,
};
