import { CURRENCY, KEYS, PLAYER } from './config';

export type UpgradeId =
  | 'vitality'
  | 'edge'
  | 'swiftness'
  | 'frenzy'
  | 'greed'
  | 'harvest'
  | 'revenant';

export type Tier = 'coin' | 'galaxy';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  tier: Tier;
  maxLevel: number;
  /** Cost of the *next* level, given how many you already own. */
  cost: (level: number) => number;
  /** Shown in the shop, describing what buying the next level gets you. */
  describe: (level: number) => string;
}

export const UPGRADES: Upgrade[] = [
  {
    id: 'vitality',
    name: 'Vitality',
    tier: 'coin',
    maxLevel: 10,
    cost: (l) => 150 + l * 120,
    describe: (l) => `+15 max HP  (${PLAYER.baseMaxHp + l * 15} -> ${PLAYER.baseMaxHp + (l + 1) * 15})`,
  },
  {
    id: 'edge',
    name: 'Edge',
    tier: 'coin',
    maxLevel: 10,
    cost: (l) => 200 + l * 165,
    describe: (l) => `+5 damage  (${PLAYER.baseDamage + l * 5} -> ${PLAYER.baseDamage + (l + 1) * 5})`,
  },
  {
    id: 'swiftness',
    name: 'Swiftness',
    tier: 'coin',
    maxLevel: 6,
    cost: (l) => 220 + l * 190,
    describe: () => '+8% movement speed',
  },
  {
    id: 'frenzy',
    name: 'Frenzy',
    tier: 'coin',
    maxLevel: 6,
    cost: (l) => 260 + l * 210,
    describe: () => '-7% swing cooldown',
  },
  {
    id: 'greed',
    name: 'Greed',
    tier: 'galaxy',
    maxLevel: 3,
    cost: (l) => 1 + l,
    describe: () => '+25% coins from every kill',
  },
  {
    id: 'harvest',
    name: 'Soul Harvest',
    tier: 'galaxy',
    maxLevel: 2,
    cost: (l) => 2 + l * 2,
    describe: (l) => `Kills drop ${l + 2} key fragments instead of ${l + 1}`,
  },
  {
    id: 'revenant',
    name: 'Revenant',
    tier: 'galaxy',
    maxLevel: 1,
    cost: () => 3,
    describe: () => 'Survive one lethal hit per floor at 30% HP',
  },
];

export interface SaveData {
  coins: number;
  galaxyCoins: number;
  floor: number;
  deepestFloor: number;
  upgrades: Partial<Record<UpgradeId, number>>;
}

const SAVE_KEY = 'dungeons-of-demons/save/v1';
/** The game was briefly called "Dungeons and Demons" — adopt saves left under that name. */
const LEGACY_SAVE_KEYS = ['dungeons-and-demons/save/v1'];

function emptySave(): SaveData {
  return { coins: 0, galaxyCoins: 0, floor: 1, deepestFloor: 1, upgrades: {} };
}

/**
 * Everything that survives between floors. Run-scoped things (current HP, keys
 * held, monsters left alive) live on the dungeon scene, not here.
 */
export class GameState {
  coins = 0;
  galaxyCoins = 0;
  floor = 1;
  deepestFloor = 1;
  upgrades: Partial<Record<UpgradeId, number>> = {};

  /** Carried between floors so the shop can heal you and the HUD stays honest. */
  hp = PLAYER.baseMaxHp;
  /** Fragments left over after the last whole key was assembled. */
  fragments = 0;
  /** Whole keys in hand. Run-scoped: spent on locked doors, never saved. */
  keys = 0;
  revenantUsed = false;

  constructor() {
    this.load();
    this.hp = this.maxHp;
  }

  level(id: UpgradeId): number {
    return this.upgrades[id] ?? 0;
  }

  get maxHp(): number {
    return PLAYER.baseMaxHp + this.level('vitality') * 15;
  }

  get damage(): number {
    return PLAYER.baseDamage + this.level('edge') * 5;
  }

  get speed(): number {
    return PLAYER.baseSpeed * (1 + this.level('swiftness') * 0.08);
  }

  get attackCooldown(): number {
    return PLAYER.baseAttackCooldown * Math.pow(0.93, this.level('frenzy'));
  }

  get coinMultiplier(): number {
    return 1 + this.level('greed') * 0.25;
  }

  get fragmentsPerKill(): number {
    return 1 + this.level('harvest');
  }

  get hasRevenant(): boolean {
    return this.level('revenant') > 0;
  }

  /** Coins needed for the next galaxy coin, and how far along you are. */
  get galaxyProgress(): number {
    return (this.coins % CURRENCY.coinsPerGalaxyCoin) / CURRENCY.coinsPerGalaxyCoin;
  }

  canConvert(): boolean {
    return this.coins >= CURRENCY.coinsPerGalaxyCoin;
  }

  /** Trades coins for a single galaxy coin. Returns false if you can't afford it. */
  convertToGalaxyCoin(): boolean {
    if (!this.canConvert()) return false;
    this.coins -= CURRENCY.coinsPerGalaxyCoin;
    this.galaxyCoins += 1;
    this.save();
    return true;
  }

  costOf(u: Upgrade): number {
    return u.cost(this.level(u.id));
  }

  canAfford(u: Upgrade): boolean {
    if (this.level(u.id) >= u.maxLevel) return false;
    const cost = this.costOf(u);
    return u.tier === 'coin' ? this.coins >= cost : this.galaxyCoins >= cost;
  }

  buy(u: Upgrade): boolean {
    if (!this.canAfford(u)) return false;
    const cost = this.costOf(u);
    if (u.tier === 'coin') this.coins -= cost;
    else this.galaxyCoins -= cost;
    this.upgrades[u.id] = this.level(u.id) + 1;
    if (u.id === 'vitality') this.hp = this.maxHp;
    this.save();
    return true;
  }

  addCoins(n: number): void {
    this.coins += Math.round(n * this.coinMultiplier);
  }

  /** Adds fragments, rolling every full set over into a whole key. */
  addFragments(n: number): { keysGained: number } {
    this.fragments += n;
    const keysGained = Math.floor(this.fragments / KEYS.fragmentsPerKey);
    this.fragments -= keysGained * KEYS.fragmentsPerKey;
    return { keysGained };
  }

  save(): void {
    const data: SaveData = {
      coins: this.coins,
      galaxyCoins: this.galaxyCoins,
      floor: this.floor,
      deepestFloor: this.deepestFloor,
      upgrades: this.upgrades,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* private browsing, quota, etc. — the run still works, it just won't persist. */
    }
  }

  load(): void {
    let data = emptySave();
    try {
      let raw = localStorage.getItem(SAVE_KEY);

      // Nothing under the current name — adopt a save from an older one and move it
      // across, so a rename never costs anyone their progress.
      if (raw === null) {
        for (const legacy of LEGACY_SAVE_KEYS) {
          const old = localStorage.getItem(legacy);
          if (old !== null) {
            raw = old;
            localStorage.setItem(SAVE_KEY, old);
            localStorage.removeItem(legacy);
            break;
          }
        }
      }

      if (raw) data = { ...data, ...(JSON.parse(raw) as SaveData) };
    } catch {
      /* corrupt or unreadable save — start fresh rather than crash. */
    }
    this.coins = data.coins;
    this.galaxyCoins = data.galaxyCoins;
    this.floor = data.floor;
    this.deepestFloor = data.deepestFloor;
    this.upgrades = data.upgrades ?? {};
  }

  reset(): void {
    const fresh = emptySave();
    this.coins = fresh.coins;
    this.galaxyCoins = fresh.galaxyCoins;
    this.floor = fresh.floor;
    this.deepestFloor = fresh.deepestFloor;
    this.upgrades = {};
    this.fragments = 0;
    this.keys = 0;
    this.revenantUsed = false;
    this.hp = this.maxHp;
    this.save();
  }
}

/** Single shared instance — scenes read and mutate this directly. */
export const gameState = new GameState();
