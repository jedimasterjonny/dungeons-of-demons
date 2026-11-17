import { GameState, PlayerState, UPGRADES } from '../src/systems/state';
import { damageFor, isInSwingArc, maxHpFor, wrapAngle } from '../src/systems/combat';
import { BOSS, COOP, CRATES, CURRENCY, DARKNESS, KEYS, PLAYER, MONSTERS, FLOOR, PLANET, SCREECH } from '../src/systems/config';
import { TileType, generateDungeon, isBossFloor, isCrateTile, isDarkFloor, isPlanetFloor } from '../src/systems/dungeon';
import { STORIES, storyAfterFloor, hasStoryAfter } from '../src/systems/stories';
import { AVATARS, DEFAULT_AVATAR, isAvatarId } from '../src/systems/avatars';
import { BEAT, THEME, themeLength } from '../src/systems/music';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

// localStorage stub so GameState can save/load outside a browser.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

console.log('\nRULE: three monsters killed forges one full key');
{
  const s = new GameState();
  s.reset();
  let keys = 0;
  const kill = () => {
    keys += s.addFragments(s.me.fragmentsPerKill).keysGained;
  };
  kill();
  check('1 kill = 0 keys', keys === 0, `got ${keys}`);
  kill();
  check('2 kills = 0 keys', keys === 0, `got ${keys}`);
  kill();
  check('3 kills = 1 key', keys === 1, `got ${keys}`);
  check('no fragments left over after a whole key', s.fragments === 0, `got ${s.fragments}`);
  for (let i = 0; i < 6; i++) kill();
  check('9 kills = 3 keys', keys === 3, `got ${keys}`);
  check('fragmentsPerKey is 3', KEYS.fragmentsPerKey === 3);
}

console.log('\nRULE: 3000 coins converts to 1 galaxy coin');
{
  const s = new GameState();
  s.reset();
  check('conversion rate is 3000', CURRENCY.coinsPerGalaxyCoin === 3000);
  s.coins = 2999;
  check('2999 coins cannot convert', !s.canConvert());
  check('convert() refuses and changes nothing', s.convertToGalaxyCoin() === false && s.coins === 2999 && s.galaxyCoins === 0);
  s.coins = 3000;
  check('3000 coins can convert', s.canConvert());
  s.convertToGalaxyCoin();
  check('after converting: 0 coins, 1 galaxy coin', s.coins === 0 && s.galaxyCoins === 1, `coins=${s.coins} galaxy=${s.galaxyCoins}`);
  s.coins = 7000;
  s.convertToGalaxyCoin();
  s.convertToGalaxyCoin();
  check('7000 coins -> 2 more galaxy coins, 1000 left', s.coins === 1000 && s.galaxyCoins === 3, `coins=${s.coins} galaxy=${s.galaxyCoins}`);
  check('progress bar reads 1000/3000', Math.abs(s.galaxyProgress - 1 / 3) < 1e-9, `got ${s.galaxyProgress}`);
}

console.log('\nRULE: the shop sells upgrades that actually change the character');
{
  const s = new GameState();
  s.reset();
  const vitality = UPGRADES.find((u) => u.id === 'vitality')!;
  const edge = UPGRADES.find((u) => u.id === 'edge')!;

  check('cannot buy with no coins', !s.canAfford(vitality) && !s.buy(vitality));
  s.coins = 100000;
  const hpBefore = s.me.maxHp;
  s.buy(vitality);
  check('buying Vitality raises max HP', s.me.maxHp === hpBefore + 15, `${hpBefore} -> ${s.me.maxHp}`);

  const dmgBefore = s.me.damage;
  s.buy(edge);
  check('buying Edge raises damage', s.me.damage === dmgBefore + 5, `${dmgBefore} -> ${s.me.damage}`);

  const costL0 = vitality.cost(0);
  const costL1 = vitality.cost(1);
  check('upgrades get more expensive each level', costL1 > costL0, `${costL0} -> ${costL1}`);

  // Buy Vitality to the cap and confirm it stops.
  while (s.canAfford(vitality)) s.buy(vitality);
  check('upgrade stops at max level', s.me.level('vitality') === vitality.maxLevel, `level ${s.me.level('vitality')}`);
  check('maxed upgrade is unaffordable by definition', !s.canAfford(vitality));

  // Galaxy-tier upgrades must charge galaxy coins, not coins.
  const greed = UPGRADES.find((u) => u.id === 'greed')!;
  s.galaxyCoins = 0;
  check('galaxy upgrade unaffordable with coins alone', !s.canAfford(greed));
  s.galaxyCoins = 5;
  const coinsBefore = s.coins;
  s.buy(greed);
  check('galaxy upgrade spends galaxy coins only', s.galaxyCoins === 5 - greed.cost(0) && s.coins === coinsBefore, `galaxy=${s.galaxyCoins} coins=${s.coins}`);
  check('MORE! raises the coin multiplier', s.me.coinMultiplier > 1, `${s.me.coinMultiplier}`);
}

console.log('\nRULE: armour makes every hit hurt less');
{
  const s = new GameState();
  s.reset();
  const armour = UPGRADES.find((u) => u.id === 'armour')!;

  check('with no armour a hit lands in full', s.me.damageMultiplier === 1, `${s.me.damageMultiplier}`);
  check('armour is bought with coins', armour.tier === 'coin');

  s.coins = 100000;
  s.buy(armour);
  check('one level takes 8% off', Math.abs(s.me.damageMultiplier - 0.92) < 1e-9, `${s.me.damageMultiplier}`);

  while (s.canAfford(armour) && s.me.level('armour') < armour.maxLevel) s.buy(armour);
  check('it stops at five levels', s.me.level('armour') === 5, `level ${s.me.level('armour')}`);
  check('fully armoured, hits land for 60%', Math.abs(s.me.damageMultiplier - 0.6) < 1e-9, `${s.me.damageMultiplier}`);

  // A 44-damage boss is the number worth pinning: it is flat at every depth.
  check('a Demon Lord hits 44 for 26 instead', Math.round(44 * s.me.damageMultiplier) === 26, `${44 * s.me.damageMultiplier}`);
  check('and Thanos hits 70 for 42', Math.round(70 * s.me.damageMultiplier) === 42, `${70 * s.me.damageMultiplier}`);

  // The guard that matters: no amount of armour may ever reach immunity.
  s.me.upgrades.armour = 999;
  check('armour can never make you immune', s.me.damageMultiplier >= 0.2, `${s.me.damageMultiplier}`);
  check('and can never heal you', s.me.damageMultiplier > 0);

  s.me.upgrades.armour = 3;
  s.save();
  const reloaded = new GameState();
  check('armour is permanent, like every upgrade', reloaded.me.level('armour') === 3, `${reloaded.me.level('armour')}`);
}

console.log('\nRULE: the shop calls things what he named them');
{
  const named = (id: string) => UPGRADES.find((u) => u.id === id)!.name;
  check('greed is MORE!', named('greed') === 'MORE!', named('greed'));
  check('soul harvest is TAKE THAT!', named('harvest') === 'TAKE THAT!', named('harvest'));
  check('frenzy is LESS', named('frenzy') === 'LESS', named('frenzy'));

  // Renaming is display-only on purpose: the id is the save key, so changing one
  // would silently drop everybody's levels for that upgrade the next time they load.
  const s = new GameState();
  s.reset();
  s.me.upgrades.greed = 2;
  s.me.upgrades.harvest = 1;
  s.me.upgrades.frenzy = 4;
  s.save();
  const reloaded = new GameState();
  check('and the levels survive the rename', reloaded.me.level('greed') === 2 && reloaded.me.level('harvest') === 1 && reloaded.me.level('frenzy') === 4);

  check('every upgrade still has a name', UPGRADES.every((u) => u.name.length > 0));
  check('and every id is unique', new Set(UPGRADES.map((u) => u.id)).size === UPGRADES.length);
}

console.log('\nRULE: you start every floor with three crates, and can buy more');
{
  const s = new GameState();
  s.reset();
  check('three crates to a floor', s.me.cratesPerFloor === 3, `got ${s.me.cratesPerFloor}`);
  check('the config agrees', CRATES.startingCount === 3);

  const crate = UPGRADES.find((u) => u.id === 'crates')!;
  check('a crate costs 4,000 coins', crate.cost(0) === 4000, `got ${crate.cost(0)}`);
  check('crates are bought with coins', crate.tier === 'coin');
  check('every crate costs the same 4,000', crate.cost(2) === 4000, `got ${crate.cost(2)}`);

  s.coins = 3999;
  check('3,999 coins is not enough', !s.canAfford(crate) && !s.buy(crate));
  s.coins = 12000;
  s.buy(crate);
  check('buying one means four to a floor', s.me.cratesPerFloor === 4, `got ${s.me.cratesPerFloor}`);
  s.buy(crate);
  s.buy(crate);
  check('stacked to the cap: six to a floor', s.me.cratesPerFloor === 6, `got ${s.me.cratesPerFloor}`);
  check('and that is as many as you can buy', !s.canAfford(crate) && s.me.level('crates') === crate.maxLevel);
  check('three crates cost 12,000 in total', s.coins === 0, `got ${s.coins}`);

  // Crates in hand are a floor's supply, not something you hoard between sessions.
  s.me.crates = 5;
  s.save();
  const reloaded = new GameState();
  check('the stack size survives a reload', reloaded.me.cratesPerFloor === 6, `got ${reloaded.me.cratesPerFloor}`);
  check('crates in hand do NOT survive a reload', reloaded.me.crates === 0, `got ${reloaded.me.crates}`);
}

console.log('\nRULE: a crate only goes on open floor');
{
  const grid = [
    [TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall],
    [TileType.Wall, TileType.Floor, TileType.Door, TileType.Exit, TileType.Wall],
    [TileType.Wall, TileType.Shop, TileType.Floor, TileType.Floor, TileType.Wall],
    [TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall],
  ];
  check('goes on plain floor', isCrateTile(grid, 1, 1));
  check('not inside a wall', !isCrateTile(grid, 0, 0));
  check('not in a locked doorway', !isCrateTile(grid, 2, 1));
  check('not on the exit portal', !isCrateTile(grid, 3, 1));
  check('not on the shop pad', !isCrateTile(grid, 1, 2));
  check('not off the edge of the map', !isCrateTile(grid, 99, 99) && !isCrateTile(grid, -1, 0));
}

console.log('\nRULE: a screech weakens your swing, and cute fluffy earmuffs block it');
{
  const s = new GameState();
  s.reset();
  const full = s.me.damage;

  check('you start un-screeched', !s.me.isScreeched && s.me.damage === full);
  s.me.screechTimer = SCREECH.duration;
  check('a screech makes your swing weaker', s.me.damage < full, `${full} -> ${s.me.damage}`);
  check(
    'it takes off exactly the configured slice',
    s.me.damage === Math.round(full * (1 - SCREECH.attackReduction)),
    `${s.me.damage} vs ${Math.round(full * (1 - SCREECH.attackReduction))}`
  );
  s.me.screechTimer = 0;
  check('your swing comes back when it wears off', s.me.damage === full, `got ${s.me.damage}`);

  const muffs = UPGRADES.find((u) => u.id === 'earmuffs')!;
  check('earmuffs cost 6,000 coins', muffs.cost(0) === 6000, `got ${muffs.cost(0)}`);
  check('earmuffs are bought with coins, not galaxy coins', muffs.tier === 'coin');
  s.coins = 5999;
  check('5,999 coins is not enough', !s.canAfford(muffs) && !s.buy(muffs));
  s.coins = 6000;
  check('6,000 coins buys them', s.buy(muffs) === true && s.coins === 0, `coins=${s.coins}`);
  check('there is only ever one pair to buy', !s.canAfford(muffs));

  s.me.screechTimer = SCREECH.duration;
  check('wearing them, a screech does nothing at all', !s.me.isScreeched && s.me.damage === full, `got ${s.me.damage}`);
  check('and the state says so', s.me.blocksScreech);

  // Only the muffs are permanent — the noise ringing in your ears is not.
  s.save();
  const reloaded = new GameState();
  check('earmuffs survive a reload', reloaded.me.level('earmuffs') === 1);
  check('a screech does NOT survive a reload', reloaded.me.screechTimer === 0);

  const bare = new GameState();
  bare.reset();
  check('and a wiped save is back to bare ears', !bare.blocksScreech);
}

console.log('\nRULE: only the wraith can scream');
{
  check('wraiths screech', MONSTERS.wraith.screecher);
  check('imps do not', !MONSTERS.imp.screecher);
  check('brutes do not', !MONSTERS.brute.screecher);
  check('a scream reaches further than a brute can see', SCREECH.range > MONSTERS.brute.aggroRange);
  check('the weakness wears off before it can scream again', SCREECH.duration < SCREECH.cooldown);
}

console.log('\nRULE: for 9,000 coins your avatar can be anything');
{
  const s = new GameState();
  s.reset();

  check('everyone starts as the delver', s.me.avatar === DEFAULT_AVATAR, `got ${s.me.avatar}`);
  check('there are plenty of looks to pick from', AVATARS.length >= 10, `got ${AVATARS.length}`);
  check('every look has a unique id', new Set(AVATARS.map((a) => a.id)).size === AVATARS.length);
  check('every look has a name', AVATARS.every((a) => a.name.length > 0));

  const wardrobe = UPGRADES.find((u) => u.id === 'avatar')!;
  check('the wardrobe costs 9,000 coins', wardrobe.cost(0) === 9000, `got ${wardrobe.cost(0)}`);
  check('it is bought with coins', wardrobe.tier === 'coin');
  check('it is a one-off purchase', wardrobe.maxLevel === 1);

  check('you cannot change your look before buying it', !s.me.canChangeAvatar && !s.setAvatar('dragon'));
  check('and you are still the delver', s.me.avatar === DEFAULT_AVATAR, `got ${s.me.avatar}`);

  s.coins = 8999;
  check('8,999 coins is not enough', !s.canAfford(wardrobe) && !s.buy(wardrobe));
  s.coins = 9000;
  check('9,000 coins buys the wardrobe', s.buy(wardrobe) === true && s.coins === 0, `coins=${s.coins}`);
  check('now you can change your look', s.me.canChangeAvatar);

  check('you can be a dragon', s.setAvatar('dragon') === true && s.me.avatar === 'dragon', `got ${s.me.avatar}`);
  check('you can be a slice of pizza', s.setAvatar('pizza') === true && s.me.avatar === 'pizza');
  check('every listed look can actually be worn', AVATARS.every((a) => s.setAvatar(a.id)));
  s.setAvatar('star');
  check('a look that does not exist is refused', !s.setAvatar('banana') && s.me.avatar === 'star', `got ${s.me.avatar}`);
  check('isAvatarId agrees', isAvatarId('star') && !isAvatarId('banana'));

  s.save();
  const reloaded = new GameState();
  check('your look survives a reload', reloaded.me.avatar === 'star', `got ${reloaded.me.avatar}`);
  check('so does the wardrobe itself', reloaded.me.canChangeAvatar);
  check('the name comes back too', reloaded.me.avatarName === 'Superstar', `got ${reloaded.me.avatarName}`);

  // A save written before avatars existed must not break, or strand you as nothing.
  store.clear();
  store.set(
    'dungeons-of-demons/save/v1',
    JSON.stringify({ coins: 10, galaxyCoins: 0, floor: 2, deepestFloor: 2, upgrades: { avatar: 1 } })
  );
  const old = new GameState();
  check('an older save with no avatar field defaults to the delver', old.me.avatar === DEFAULT_AVATAR, `got ${old.me.avatar}`);
  store.clear();

  const wiped = new GameState();
  wiped.reset();
  check('wiping the save puts the delver back on', wiped.me.avatar === DEFAULT_AVATAR && !wiped.me.canChangeAvatar);
}

console.log('\nRULE: progress persists between sessions');
{
  const s = new GameState();
  s.reset();
  s.coins = 4242;
  s.galaxyCoins = 7;
  s.floor = 5;
  s.deepestFloor = 9;
  s.me.upgrades.edge = 3;
  s.save();

  const reloaded = new GameState();
  check('coins survive a reload', reloaded.coins === 4242, `got ${reloaded.coins}`);
  check('galaxy coins survive a reload', reloaded.galaxyCoins === 7, `got ${reloaded.galaxyCoins}`);
  check('floor survives a reload', reloaded.floor === 5, `got ${reloaded.floor}`);
  check('upgrades survive a reload', reloaded.me.level('edge') === 3, `got ${reloaded.me.level('edge')}`);
  check('keys do NOT survive a reload (run-scoped)', reloaded.keys === 0);
}

console.log('\nRENAME: a save written under the old game name is adopted, not lost');
{
  store.clear();
  store.set(
    'dungeons-and-demons/save/v1',
    JSON.stringify({ coins: 5555, galaxyCoins: 4, floor: 6, deepestFloor: 8, upgrades: { edge: 2 } })
  );
  const s = new GameState();
  check('coins carried over from the old save key', s.coins === 5555, `got ${s.coins}`);
  check('galaxy coins carried over', s.galaxyCoins === 4, `got ${s.galaxyCoins}`);
  check('floor carried over', s.floor === 6, `got ${s.floor}`);
  check('upgrades carried over', s.me.level('edge') === 2, `got ${s.me.level('edge')}`);
  check('the save now lives under the new key', store.has('dungeons-of-demons/save/v1'));
  check('the old key is cleaned up', !store.has('dungeons-and-demons/save/v1'));

  // A current-name save must win outright rather than be clobbered by a stale one.
  store.set('dungeons-and-demons/save/v1', JSON.stringify({ coins: 1, galaxyCoins: 0, floor: 1, deepestFloor: 1, upgrades: {} }));
  const fresh = new GameState();
  check('a current save takes priority over a legacy one', fresh.coins === 5555, `got ${fresh.coins}`);
  store.clear();
}

console.log('\nRULE: a swing only hits what is in front of you');
{
  const at = (x: number, y: number) => ({ x, y });
  const me = at(0, 0);
  const arc = (PLAYER.attackArc * Math.PI) / 180;
  const R = PLAYER.attackRange;
  const hit = (t: { x: number; y: number }, radius = 10) => isInSwingArc(me, 0, t, radius, R, arc);

  check('hits straight ahead', hit(at(40, 0)));
  check('misses directly behind', !hit(at(-40, 0)));
  check('misses out of range', !hit(at(R + 40, 0)));
  check('hits at the very edge of range', hit(at(R + 9, 0)));
  check('hits inside the arc edge', hit(at(Math.cos(arc * 0.9) * 40, Math.sin(arc * 0.9) * 40)));
  check('misses just outside the arc', !hit(at(Math.cos(arc * 1.3) * 40, Math.sin(arc * 1.3) * 40), 0));
  check('bigger monsters are easier to clip', isInSwingArc(me, 0, at(R + 14, 0), 16, R, arc) && !isInSwingArc(me, 0, at(R + 14, 0), 2, R, arc));
  check('facing left hits things on the left', isInSwingArc(me, Math.PI, at(-40, 0), 10, R, arc));
  check('overlapping target always connects', isInSwingArc(me, 0, at(0, 0), 10, R, arc));
  check('wrapAngle normalises past PI', Math.abs(wrapAngle(Math.PI * 3) - Math.PI) < 1e-9, `${wrapAngle(Math.PI * 3)}`);
}

console.log('\nRULE: a boss stands on floors 10, 20, 30, 40 ... with 100 health');
{
  check('bosses come every 10 floors', BOSS.everyNFloors === 10);
  for (const f of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
    check(`floor ${f} has a boss`, isBossFloor(f));
  }
  for (const f of [0, 1, 5, 9, 11, 19, 25, 99, 101]) {
    check(`floor ${f} has no boss`, !isBossFloor(f));
  }

  check('a boss has 100 health', MONSTERS.boss.maxHp === 100, `got ${MONSTERS.boss.maxHp}`);
  check('exactly 100 on floor 10', maxHpFor(MONSTERS.boss, 10) === 100, `got ${maxHpFor(MONSTERS.boss, 10)}`);
  check('still exactly 100 on floor 100', maxHpFor(MONSTERS.boss, 100) === 100, `got ${maxHpFor(MONSTERS.boss, 100)}`);
  check(
    'ordinary demons still scale with depth',
    maxHpFor(MONSTERS.imp, 10) > maxHpFor(MONSTERS.imp, 1),
    `${maxHpFor(MONSTERS.imp, 1)} -> ${maxHpFor(MONSTERS.imp, 10)}`
  );

  const bossesOn = (floor: number) => generateDungeon(floor).monsters.filter((m) => m.kind === 'boss').length;
  check('floor 10 generates exactly one boss', bossesOn(10) === 1, `got ${bossesOn(10)}`);
  check('floor 20 generates exactly one boss', bossesOn(20) === 1, `got ${bossesOn(20)}`);
  check('floor 9 generates none', bossesOn(9) === 0, `got ${bossesOn(9)}`);
  check('floor 11 generates none', bossesOn(11) === 0, `got ${bossesOn(11)}`);

  // The boss must be part of the floor's kill count, or the exit would open early.
  const d = generateDungeon(10);
  const boss = d.monsters.find((m) => m.kind === 'boss')!;
  check('the boss counts toward clearing the floor', d.monsters.includes(boss));
  const exitRoom = d.rooms[d.rooms.length - 1];
  check(
    'and it waits in the room with the portal',
    boss.x >= exitRoom.x && boss.x < exitRoom.x + exitRoom.w &&
      boss.y >= exitRoom.y && boss.y < exitRoom.y + exitRoom.h,
    `boss at ${boss.x},${boss.y} vs room ${exitRoom.x},${exitRoom.y} ${exitRoom.w}x${exitRoom.h}`
  );
  check('a boss can scream like a wraith', MONSTERS.boss.screecher);
  check('a boss is bigger than a brute', MONSTERS.boss.radius > MONSTERS.brute.radius);
}

console.log('\nRULE: a story lands after every tenth floor');
{
  for (const f of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
    check(`there is a story after floor ${f}`, hasStoryAfter(f));
  }
  for (const f of [1, 5, 9, 11, 15, 55, 99, 102]) {
    check(`no story after floor ${f}`, !hasStoryAfter(f));
  }
  check('and one more after Thanos falls', hasStoryAfter(PLANET.floor));
  check('eleven chapters in all', STORIES.length === 11, `got ${STORIES.length}`);

  for (const story of STORIES) {
    check(`chapter after floor ${story.afterFloor} has a title`, story.title.length > 0);
    check(`chapter after floor ${story.afterFloor} has pages`, story.pages.length > 0);
    check(
      `chapter after floor ${story.afterFloor} has lines on every page`,
      story.pages.every((p) => p.length > 0)
    );
    // Lines are centred on a 960-wide screen at 15px; much past this and they clip.
    check(
      `chapter after floor ${story.afterFloor} has lines that fit on screen`,
      story.pages.every((p) => p.every((line) => line.length <= 66)),
      `longest ${Math.max(...story.pages.flat().map((l) => l.length))}`
    );
  }

  const ending = storyAfterFloor(100)!;
  const text = ending.pages.flat().join(' ');
  check('the floor 100 story steps out of the castle', text.includes('step out of the castle'));
  check('...lands on a weird planet', text.includes('weird planet'));
  check('...and finds Thanos there', text.includes('THANOS'));
}

console.log('\nRULE: past floor 100 you land on a weird planet, and Thanos is there');
{
  check('the planet is floor 101', PLANET.floor === 101);
  check('101 is the planet', isPlanetFloor(101));
  check('100 is not', !isPlanetFloor(100));
  check('102 is not', !isPlanetFloor(102));
  check('the planet is not a boss floor', !isBossFloor(PLANET.floor));

  check('Thanos has 40,000 health', MONSTERS.thanos.maxHp === 40000, `got ${MONSTERS.thanos.maxHp}`);
  check('and keeps all 40,000 whatever the floor', maxHpFor(MONSTERS.thanos, 101) === 40000);
  check('he counts as a boss', MONSTERS.thanos.boss);
  check('he is the biggest thing in the game', MONSTERS.thanos.radius >= MONSTERS.boss.radius);
  check('his bar says Thanos', MONSTERS.thanos.label === 'Thanos');

  // Bosses hit for a flat amount; ordinary demons hit harder the deeper you go.
  check('boss damage never scales', damageFor(MONSTERS.boss, 90) === damageFor(MONSTERS.boss, 10));
  check('Thanos damage never scales', damageFor(MONSTERS.thanos, 101) === MONSTERS.thanos.damage);
  check(
    'ordinary demons still hit harder deeper down',
    damageFor(MONSTERS.imp, 10) > damageFor(MONSTERS.imp, 1),
    `${damageFor(MONSTERS.imp, 1)} -> ${damageFor(MONSTERS.imp, 10)}`
  );

  const planet = generateDungeon(PLANET.floor);
  const thanos = planet.monsters.filter((m) => m.kind === 'thanos');
  check('exactly one Thanos on the planet', thanos.length === 1, `got ${thanos.length}`);
  check('no Demon Lord out there', planet.monsters.every((m) => m.kind !== 'boss'));
  check('the planet has no vaults to unlock', planet.vaults.length === 0 && planet.doors.length === 0);
  check(
    'and only a handful of demons besides him',
    planet.monsters.length === PLANET.monsters + 1,
    `got ${planet.monsters.length}`
  );

  const castle = generateDungeon(100);
  check('floor 100 still has its Demon Lord', castle.monsters.filter((m) => m.kind === 'boss').length === 1);
  check('and no Thanos in the castle', castle.monsters.every((m) => m.kind !== 'thanos'));
}

console.log('\nRULE: the Star Sword makes Thanos a fight instead of a wall');
{
  const s = new GameState();
  s.reset();

  check('you do not start with it', !s.me.hasStarSword);
  const plain = s.me.damage;
  s.me.hasStarSword = true;
  check('the Star Sword swings for 500', s.me.damage === PLANET.swordDamage, `got ${s.me.damage}`);
  check('which is far more than a maxed sword', s.me.damage > plain * 5, `${plain} -> ${s.me.damage}`);

  // It replaces your damage rather than adding to it, so it is worth the same to
  // everyone — a brand new player and a maxed one both swing for 500.
  const maxed = new GameState();
  maxed.reset();
  maxed.me.upgrades.edge = 10;
  maxed.me.hasStarSword = true;
  check('a maxed player swings for 500 too', maxed.me.damage === PLANET.swordDamage, `got ${maxed.me.damage}`);

  // Earmuffs still matter: a screech takes its cut off the star as well.
  s.me.screechTimer = SCREECH.duration;
  check(
    'a screech still weakens it',
    s.me.damage === Math.round(PLANET.swordDamage * (1 - SCREECH.attackReduction)),
    `got ${s.me.damage}`
  );
  s.me.screechTimer = 0;

  // 40,000 health at 500 a swing is 80 swings: a fight you can actually finish.
  const swings = Math.ceil(MONSTERS.thanos.maxHp / s.me.damage);
  check('Thanos falls in 80 swings with it', swings === 80, `got ${swings}`);
  const bare = Math.ceil(MONSTERS.thanos.maxHp / (PLAYER.baseDamage + 10 * 5));
  check('and would take 572 without it', bare === 572, `got ${bare}`);

  // It is the planet's sword, not yours: it must never follow you home.
  s.save();
  const reloaded = new GameState();
  check('it is not saved', !reloaded.me.hasStarSword);
  s.reset();
  check('and a wipe clears it', !s.me.hasStarSword);

  const planet = generateDungeon(PLANET.floor);
  check('the planet has one lying there', planet.sword !== undefined);
  check(
    'right beside where you land',
    planet.sword !== undefined &&
      Math.abs(planet.sword.x - planet.playerStart.x) <= 2 &&
      planet.sword.y === planet.playerStart.y,
    `sword ${planet.sword?.x},${planet.sword?.y} start ${planet.playerStart.x},${planet.playerStart.y}`
  );
  check(
    'on ground you can stand on',
    planet.sword !== undefined && planet.grid[planet.sword.y][planet.sword.x] === TileType.Floor
  );
  check('and no other floor has one', generateDungeon(100).sword === undefined && generateDungeon(7).sword === undefined);
}

console.log('\nRULE: every 20 floors the lights go out');
{
  check('floor 20 is dark', isDarkFloor(20));
  check('so is 40', isDarkFloor(40));
  check('so is 100', isDarkFloor(100));
  check('floor 19 is not', !isDarkFloor(19));
  check('floor 21 is not', !isDarkFloor(21));
  check('floor 10 has a boss but keeps its lights', isBossFloor(10) && !isDarkFloor(10));
  check('floor 1 is not dark', !isDarkFloor(1));
  check('and neither is floor 0', !isDarkFloor(0));
  check('the weird planet is lit by its own stars', !isDarkFloor(PLANET.floor));

  // Every multiple of 20 is also a multiple of 10, so a dark floor always has a
  // Demon Lord standing in it. That falls out of the two rules, so pin it down.
  const darkFloors = [20, 40, 60, 80, 100];
  check('every dark floor is also a boss floor', darkFloors.every(isDarkFloor) && darkFloors.every(isBossFloor));

  check('you keep less than you can see', DARKNESS.memoryRadius < DARKNESS.lightRadius);
  check('remembered ground is dimmer than lit ground', DARKNESS.memoryDarkness > 0);
  check('but not as black as ground you have never walked', DARKNESS.memoryDarkness < 1);
  check('the trail is stamped often enough to be continuous', DARKNESS.stampDistance < DARKNESS.memoryRadius);
  check('a dark floor is still a normal dungeon', generateDungeon(20).grid.length > 0 && generateDungeon(20).exit !== undefined);
}

console.log('\nRULE: two people can play, and can pick each other up');
{
  const s = new GameState();
  s.reset();
  check('you start on your own', !s.isCoop && s.players.length === 1);

  s.setPlayerCount(2);
  check('two makes it co-op', s.isCoop && s.players.length === 2);
  check('and they are two different people', s.players[0] !== s.players[1]);
  check('each knowing which one they are', s.players[0].index === 0 && s.players[1].index === 1);
  check('one player is still allowed', (s.setPlayerCount(1), s.players.length === 1));
  check('and three is not — there are two sets of keys', (s.setPlayerCount(3), s.players.length === 2));

  // Player two inherits player one's gear, because there is only one save on this
  // computer and a level-1 partner next to a maxed player is a liability.
  const geared = new GameState();
  geared.reset();
  geared.me.upgrades.edge = 6;
  geared.me.upgrades.vitality = 4;
  geared.setPlayerCount(2);
  const two = geared.players[1];
  check('player two arrives with the same sword', two.damage === geared.me.damage, `${two.damage} vs ${geared.me.damage}`);
  check('and the same health', two.maxHp === geared.me.maxHp && two.hp === two.maxHp);

  // But they are copies, not the same object: upgrading one must not upgrade both.
  two.upgrades.edge = 10;
  check('their gear is their own from then on', geared.me.level('edge') === 6, `${geared.me.level('edge')}`);

  // Only player one is written to disk — player two is a guest for the run.
  geared.save();
  const reloaded = new GameState();
  check('only player one is saved', reloaded.players.length === 1 && reloaded.me.level('edge') === 6);
}

console.log('\nRULE: going down is not dying, if someone can reach you');
{
  const s = new GameState();
  s.reset();
  s.setPlayerCount(2);
  const [one, two] = s.players;

  check('everybody starts up', s.living.length === 2);
  one.downed = true;
  check('a downed player is out of the fight', !one.isPlaying);
  check('but the run is not over', s.living.length === 1);
  two.hp = 0;
  check('with both of them out, it is', s.living.length === 0);

  // Rescue numbers he can hold: three seconds, standing close, half your health.
  check('a rescue takes three seconds', COOP.rescueTime === 3);
  check('you have to be right next to them', COOP.rescueRange < 64);
  check('and they get half their health back', COOP.reviveHealth === 0.5);

  const revived = new PlayerState(1);
  revived.upgrades.vitality = 4;
  revived.downed = true;
  revived.hp = 0;
  const expected = Math.ceil(revived.maxHp * COOP.reviveHealth);
  check('half of 160 is 80', expected === 80, `${revived.maxHp} -> ${expected}`);

  // Leaving the floor picks up anybody still down, so a rescue can never be the
  // thing that strands the party.
  const carried = new GameState();
  carried.reset();
  carried.setPlayerCount(2);
  carried.players[1].downed = true;
  carried.players[1].hp = 0;
  for (const p of carried.players) p.refreshForFloor();
  check('a new floor puts everyone back on their feet', carried.players.every((p) => !p.downed));
}

console.log('\nRULE: what the party shares, and what it does not');
{
  const s = new GameState();
  s.reset();
  s.setPlayerCount(2);
  const [one, two] = s.players;

  // Shared: the pot of coins and the keys. There is one shop and one set of doors.
  s.coins = 5000;
  check('coins belong to the party', s.coins === 5000);
  s.addFragments(KEYS.fragmentsPerKey);
  check('and so are keys', s.fragments === 0);

  // Not shared: health, crates, ears, and the Star Sword.
  one.hp = 30;
  check('health is your own', two.hp !== 30, `${two.hp}`);
  one.crates = 0;
  check('crates are your own', two.crates !== 0 || two.cratesPerFloor > 0);
  one.upgrades.earmuffs = 1;
  check('one pair of earmuffs covers one head', one.blocksScreech && !two.blocksScreech);
  one.screechTimer = SCREECH.duration;
  check('and a screech lands on one of you at a time', one.isScreeched === false || !two.isScreeched);
  two.hasStarSword = true;
  check('the Star Sword is carried by whoever picked it up', two.hasStarSword && !one.hasStarSword);
  check('so only they swing for 500', two.damage === PLANET.swordDamage && one.damage !== PLANET.swordDamage);

  // The shop charges the party but upgrades the person standing at the pad.
  const edge = UPGRADES.find((u) => u.id === 'edge')!;
  const before = two.level('edge');
  s.coins = 99999;
  s.buy(edge, two);
  check('buying for player two upgrades player two', two.level('edge') === before + 1);
  check('and leaves player one alone', one.level('edge') === before);
}

console.log('\nRULE: the theme tune goes dum dumdum dummmm dom dom dam');
{
  // The tune he sang, written out as syllables. Both halves of the theme use the
  // same rhythm, so the sung line has to come back exactly twice.
  const sung = THEME.filter((n) => n.name !== null).map((n) => n.say);
  const asked = ['dum', 'dum', 'dum', 'dummmm', 'dom', 'dom', 'dam'];
  check('it is his line, twice', JSON.stringify(sung) === JSON.stringify([...asked, ...asked]), sung.join(' '));

  const beats = THEME.filter((n) => n.name !== null).map((n) => n.beats);
  check('one dum to start', beats[0] === 2, `${beats[0]}`);
  check('then dumdum, two quick ones', beats[1] === 1 && beats[2] === 1, `${beats[1]},${beats[2]}`);
  check('then dummmm, the long one', beats[3] === 4, `${beats[3]}`);
  check('and dummmm is the longest of them', beats[3] >= Math.max(...beats.slice(0, 7)));
  check('dom dom are shorter again', beats[4] === 2 && beats[5] === 2);
  check('and dam is held at the end', beats[6] === 4);

  // The shape: the held note is the top of the tune and the tail walks back down.
  const first = THEME.slice(0, 7).map((n) => n.name);
  check('dummmm is the highest note', first[3] === 'A3', `${first[3]}`);
  check('and it comes home on the note it started on', first[0] === first[6], `${first[0]} vs ${first[6]}`);

  check('every note has a pitch or is a rest', THEME.every((n) => n.name === null || n.beats > 0));
  check('it breathes between the halves', THEME.some((n) => n.name === null));

  const secs = themeLength();
  check('one time round takes about 8 seconds', secs > 6 && secs < 10, `${secs.toFixed(1)}s`);
  check('and it is played slowly, not rushed', BEAT >= 0.18, `${BEAT}`);
}

console.log('\nRULE: you can turn the music off, and it stays off');
{
  const s = new GameState();
  s.reset();
  check('the tune is on to begin with', !s.musicOff);

  s.musicOff = true;
  s.save();
  check('turning it off is remembered', new GameState().musicOff === true);

  // Wiping the save is for starting the game again, not for undoing a preference —
  // it would be a nasty surprise to have the tune come blaring back.
  const wiped = new GameState();
  wiped.reset();
  check('and a save wipe leaves it off', wiped.musicOff === true);
  check('while actually wiping the progress', wiped.coins === 0 && wiped.floor === 1);

  wiped.musicOff = false;
  wiped.save();
  check('and it can be turned back on', new GameState().musicOff === false);
}

console.log('\nRULE: deeper floors are meaningfully harder');
{
  const impHp = (floor: number) => Math.round(MONSTERS.imp.maxHp * (1 + FLOOR.hpScalePerFloor * (floor - 1)));
  check('floor 1 uses base stats', impHp(1) === MONSTERS.imp.maxHp, `${impHp(1)}`);
  check('floor 5 imps are tougher', impHp(5) > impHp(1), `${impHp(1)} -> ${impHp(5)}`);
  check('threat outpaces reward', FLOOR.hpScalePerFloor > FLOOR.coinScalePerFloor);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
