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

export type MonsterKind = 'imp' | 'brute' | 'wraith';

export interface MonsterStats {
  kind: MonsterKind;
  maxHp: number;
  speed: number;
  damage: number;
  aggroRange: number;
  radius: number;
  coinDrop: [number, number];
  tint: number;
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
  },
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
