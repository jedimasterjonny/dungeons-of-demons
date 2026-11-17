import { AVATARS, DEFAULT_AVATAR, avatarName, isAvatarId } from './avatars';
import { CRATES, CURRENCY, KEYS, PLANET, PLAYER, SCREECH } from './config';

export type UpgradeId =
  | 'vitality'
  | 'edge'
  | 'swiftness'
  | 'frenzy'
  | 'armour'
  | 'crates'
  | 'earmuffs'
  | 'avatar'
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

/**
 * Damage taken off per level of Armour. maxLevel keeps the total at 40%, and
 * damageMultiplier floors it regardless, so no amount of it can make you immune.
 */
const ARMOUR_PER_LEVEL = 0.08;

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
    name: 'LESS',
    tier: 'coin',
    maxLevel: 6,
    cost: (l) => 260 + l * 210,
    describe: () => '-7% swing cooldown',
  },
  {
    id: 'armour',
    name: 'Armour',
    tier: 'coin',
    maxLevel: 5,
    cost: (l) => 280 + l * 240,
    describe: (l) =>
      `Every hit hurts ${ARMOUR_PER_LEVEL * 100}% less  (${Math.round(l * ARMOUR_PER_LEVEL * 100)}% -> ${Math.round((l + 1) * ARMOUR_PER_LEVEL * 100)}% off)`,
  },
  {
    id: 'crates',
    name: 'Crate',
    tier: 'coin',
    maxLevel: 3,
    cost: () => 4000,
    describe: (l) =>
      `Carry one more crate per floor  (${CRATES.startingCount + l} -> ${CRATES.startingCount + l + 1})`,
  },
  {
    id: 'earmuffs',
    name: 'Cute Fluffy Earmuffs',
    tier: 'coin',
    maxLevel: 1,
    cost: () => 6000,
    describe: () => 'Demon screeches cannot weaken your swing at all',
  },
  {
    id: 'avatar',
    name: 'Avatar',
    tier: 'coin',
    maxLevel: 1,
    cost: () => 9000,
    describe: () => `Be anything you like — unlocks all ${AVATARS.length} looks`,
  },
  {
    id: 'greed',
    name: 'MORE!',
    tier: 'galaxy',
    maxLevel: 3,
    cost: (l) => 1 + l,
    describe: () => '+25% coins from every kill',
  },
  {
    id: 'harvest',
    name: 'TAKE THAT!',
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
  avatar: string;
  /** Whether the theme tune is switched off. Remembered between sessions. */
  musicOff: boolean;
}

const SAVE_KEY = 'dungeons-of-demons/save/v1';
/** The game was briefly called "Dungeons and Demons" — adopt saves left under that name. */
const LEGACY_SAVE_KEYS = ['dungeons-and-demons/save/v1'];

function emptySave(): SaveData {
  return {
    coins: 0,
    galaxyCoins: 0,
    floor: 1,
    deepestFloor: 1,
    upgrades: {},
    avatar: DEFAULT_AVATAR,
    musicOff: false,
  };
}

/**
 * Everything that belongs to one person: their health, their gear, their look.
 *
 * Split out of GameState because co-op needs two of them, and shaped for where this
 * is going: in a networked game each player arrives from a different computer
 * carrying their own upgrades, so nothing on this class is shared by design. What
 * the party shares — coins, keys, which floor you are on — lives on GameState.
 */
export class PlayerState {
  /** Carried between floors so the shop can heal you and the HUD stays honest. */
  hp = PLAYER.baseMaxHp;
  upgrades: Partial<Record<UpgradeId, number>> = {};
  /** What you look like. Cosmetic only — every avatar has the same hitbox. */
  avatar = DEFAULT_AVATAR;
  revenantUsed = false;
  /** Seconds left on a demon's screech. Run-scoped, and never saved. */
  screechTimer = 0;
  /** Crates in hand. Restocked at the start of every floor, never saved. */
  crates = 0;
  /** Holding the Star Sword. Planet-only: dropped the moment you leave that floor. */
  hasStarSword = false;
  /**
   * Out of health and lying on the floor, waiting to be picked up. Only ever true
   * in co-op: a lone player has nobody to rescue them, so they simply die.
   */
  downed = false;
  /** Seconds of rescuing done so far. Resets the moment nobody is standing over you. */
  rescueProgress = 0;

  /** 0 is the player this computer belongs to; 1 is whoever joined them. */
  constructor(readonly index: number) {}

  level(id: UpgradeId): number {
    return this.upgrades[id] ?? 0;
  }

  get maxHp(): number {
    return PLAYER.baseMaxHp + this.level('vitality') * 15;
  }

  /** Down or dead, either way you are not fighting. */
  get isPlaying(): boolean {
    return !this.downed && this.hp > 0;
  }

  /**
   * What a swing hits for. The Star Sword replaces your damage outright rather than
   * adding to it, so it is worth exactly the same to a new player as to a maxed one.
   * A screech still takes its cut — earmuffs matter even holding a star.
   */
  get damage(): number {
    const base = this.hasStarSword
      ? PLANET.swordDamage
      : PLAYER.baseDamage + this.level('edge') * 5;
    return Math.round(base * this.screechDamageMultiplier);
  }

  /** Earmuffs are all-or-nothing: one pair and screeches stop mattering. */
  get blocksScreech(): boolean {
    return this.level('earmuffs') > 0;
  }

  get isScreeched(): boolean {
    return this.screechTimer > 0 && !this.blocksScreech;
  }

  get screechDamageMultiplier(): number {
    return this.isScreeched ? 1 - SCREECH.attackReduction : 1;
  }

  /**
   * What is left of a hit after armour. Clamped at 0.2 so that raising Armour's
   * maxLevel later can never reach zero — or go negative and heal you.
   */
  get damageMultiplier(): number {
    return Math.max(0.2, 1 - this.level('armour') * ARMOUR_PER_LEVEL);
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

  /** How many crates you walk onto each new floor with. */
  get cratesPerFloor(): number {
    return CRATES.startingCount + this.level('crates');
  }

  /** The wardrobe is one purchase; after that every look is free to switch to. */
  get canChangeAvatar(): boolean {
    return this.level('avatar') > 0;
  }

  get avatarName(): string {
    return avatarName(this.avatar);
  }

  get hasRevenant(): boolean {
    return this.level('revenant') > 0;
  }

  /** Everything a new floor resets, whoever you are. */
  refreshForFloor(): void {
    this.revenantUsed = false;
    this.screechTimer = 0;
    this.crates = this.cratesPerFloor;
    this.hasStarSword = false;
    this.downed = false;
    this.rescueProgress = 0;
  }
}

/**
 * Everything that survives between floors, plus who is playing. Run-scoped things
 * (monsters left alive, where the doors are) live on the dungeon scene, not here.
 */
export class GameState {
  coins = 0;
  galaxyCoins = 0;
  floor = 1;
  deepestFloor = 1;
  /** Fragments left over after the last whole key was assembled. Shared by the party. */
  fragments = 0;
  /** Whole keys in hand. Run-scoped: spent on locked doors, never saved. */
  keys = 0;
  /** Theme tune off. A setting rather than progress, so a save wipe leaves it alone. */
  musicOff = false;

  /** One entry per person playing. Index 0 owns the save on this computer. */
  players: PlayerState[] = [new PlayerState(0)];

  constructor() {
    this.load();
    this.me.hp = this.me.maxHp;
  }

  /** The player this computer belongs to — the one whose save is on disk. */
  get me(): PlayerState {
    return this.players[0];
  }

  get isCoop(): boolean {
    return this.players.length > 1;
  }

  /** Everyone still on their feet. Empty means the run is over. */
  get living(): PlayerState[] {
    return this.players.filter((p) => p.isPlaying);
  }

  /**
   * Sets how many people are playing.
   *
   * Player two inherits a copy of player one's upgrades. There is only one save on
   * this computer, so there is nothing else for them to inherit — and a second
   * player who swung for 20 while you swung for 70 would be a liability rather than
   * a help. Once the game is networked each player brings their own save instead,
   * which is why upgrades live on PlayerState and not here.
   */
  setPlayerCount(n: number): void {
    const count = Math.max(1, Math.min(2, Math.floor(n)));
    while (this.players.length > count) this.players.pop();
    while (this.players.length < count) {
      const joiner = new PlayerState(this.players.length);
      joiner.upgrades = { ...this.me.upgrades };
      joiner.avatar = this.me.avatar;
      joiner.hp = joiner.maxHp;
      this.players.push(joiner);
    }
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

  costOf(u: Upgrade, who: PlayerState = this.me): number {
    return u.cost(who.level(u.id));
  }

  canAfford(u: Upgrade, who: PlayerState = this.me): boolean {
    if (who.level(u.id) >= u.maxLevel) return false;
    const cost = this.costOf(u, who);
    return u.tier === 'coin' ? this.coins >= cost : this.galaxyCoins >= cost;
  }

  /** The party pays; the player standing at the pad is the one who gets the upgrade. */
  buy(u: Upgrade, who: PlayerState = this.me): boolean {
    if (!this.canAfford(u, who)) return false;
    const cost = this.costOf(u, who);
    if (u.tier === 'coin') this.coins -= cost;
    else this.galaxyCoins -= cost;
    who.upgrades[u.id] = who.level(u.id) + 1;
    if (u.id === 'vitality') who.hp = who.maxHp;
    this.save();
    return true;
  }

  /** Refuses unknown looks, and refuses everything until the wardrobe is bought. */
  setAvatar(id: string, who: PlayerState = this.me): boolean {
    if (!who.canChangeAvatar || !isAvatarId(id)) return false;
    who.avatar = id;
    this.save();
    return true;
  }

  /** Loot is shared, but it is the killer's own MORE! that decides how much drops. */
  addCoins(n: number, by: PlayerState = this.me): void {
    this.coins += Math.round(n * by.coinMultiplier);
  }

  /** Adds fragments, rolling every full set over into a whole key. */
  addFragments(n: number): { keysGained: number } {
    this.fragments += n;
    const keysGained = Math.floor(this.fragments / KEYS.fragmentsPerKey);
    this.fragments -= keysGained * KEYS.fragmentsPerKey;
    return { keysGained };
  }

  save(): void {
    // Only player one is written down: this is their computer and their save. A
    // second player on the same keyboard is a guest for the length of the run.
    const data: SaveData = {
      coins: this.coins,
      galaxyCoins: this.galaxyCoins,
      floor: this.floor,
      deepestFloor: this.deepestFloor,
      upgrades: this.me.upgrades,
      avatar: this.me.avatar,
      musicOff: this.musicOff,
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
    this.me.upgrades = data.upgrades ?? {};
    // A look from an older save that no longer exists falls back to the delver.
    this.me.avatar = isAvatarId(data.avatar) ? data.avatar : DEFAULT_AVATAR;
    this.musicOff = data.musicOff === true;
  }

  reset(): void {
    const fresh = emptySave();
    // Deliberately not reset: whether you want the tune on is a preference, not
    // progress, and wiping a save to start again should not start it blaring.
    this.coins = fresh.coins;
    this.galaxyCoins = fresh.galaxyCoins;
    this.floor = fresh.floor;
    this.deepestFloor = fresh.deepestFloor;
    this.fragments = 0;
    this.keys = 0;
    // A wipe drops back to one player: co-op is chosen fresh from the title screen.
    this.players = [new PlayerState(0)];
    this.me.upgrades = {};
    this.me.avatar = DEFAULT_AVATAR;
    this.me.refreshForFloor();
    this.me.hp = this.me.maxHp;
    this.save();
  }
}

/** Single shared instance — scenes read and mutate this directly. */
export const gameState = new GameState();
