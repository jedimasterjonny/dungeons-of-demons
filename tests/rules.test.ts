import { GameState, UPGRADES } from '../src/systems/state';
import { isInSwingArc, wrapAngle } from '../src/systems/combat';
import { CURRENCY, KEYS, PLAYER, MONSTERS, FLOOR } from '../src/systems/config';

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
    keys += s.addFragments(s.fragmentsPerKill).keysGained;
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
  const hpBefore = s.maxHp;
  s.buy(vitality);
  check('buying Vitality raises max HP', s.maxHp === hpBefore + 15, `${hpBefore} -> ${s.maxHp}`);

  const dmgBefore = s.damage;
  s.buy(edge);
  check('buying Edge raises damage', s.damage === dmgBefore + 5, `${dmgBefore} -> ${s.damage}`);

  const costL0 = vitality.cost(0);
  const costL1 = vitality.cost(1);
  check('upgrades get more expensive each level', costL1 > costL0, `${costL0} -> ${costL1}`);

  // Buy Vitality to the cap and confirm it stops.
  while (s.canAfford(vitality)) s.buy(vitality);
  check('upgrade stops at max level', s.level('vitality') === vitality.maxLevel, `level ${s.level('vitality')}`);
  check('maxed upgrade is unaffordable by definition', !s.canAfford(vitality));

  // Galaxy-tier upgrades must charge galaxy coins, not coins.
  const greed = UPGRADES.find((u) => u.id === 'greed')!;
  s.galaxyCoins = 0;
  check('galaxy upgrade unaffordable with coins alone', !s.canAfford(greed));
  s.galaxyCoins = 5;
  const coinsBefore = s.coins;
  s.buy(greed);
  check('galaxy upgrade spends galaxy coins only', s.galaxyCoins === 5 - greed.cost(0) && s.coins === coinsBefore, `galaxy=${s.galaxyCoins} coins=${s.coins}`);
  check('Greed raises the coin multiplier', s.coinMultiplier > 1, `${s.coinMultiplier}`);
}

console.log('\nRULE: progress persists between sessions');
{
  const s = new GameState();
  s.reset();
  s.coins = 4242;
  s.galaxyCoins = 7;
  s.floor = 5;
  s.deepestFloor = 9;
  s.upgrades.edge = 3;
  s.save();

  const reloaded = new GameState();
  check('coins survive a reload', reloaded.coins === 4242, `got ${reloaded.coins}`);
  check('galaxy coins survive a reload', reloaded.galaxyCoins === 7, `got ${reloaded.galaxyCoins}`);
  check('floor survives a reload', reloaded.floor === 5, `got ${reloaded.floor}`);
  check('upgrades survive a reload', reloaded.level('edge') === 3, `got ${reloaded.level('edge')}`);
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
  check('upgrades carried over', s.level('edge') === 2, `got ${s.level('edge')}`);
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

console.log('\nRULE: deeper floors are meaningfully harder');
{
  const impHp = (floor: number) => Math.round(MONSTERS.imp.maxHp * (1 + FLOOR.hpScalePerFloor * (floor - 1)));
  check('floor 1 uses base stats', impHp(1) === MONSTERS.imp.maxHp, `${impHp(1)}`);
  check('floor 5 imps are tougher', impHp(5) > impHp(1), `${impHp(1)} -> ${impHp(5)}`);
  check('threat outpaces reward', FLOOR.hpScalePerFloor > FLOOR.coinScalePerFloor);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
