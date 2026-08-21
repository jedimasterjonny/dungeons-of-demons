<h1 align="center">Dungeons of Demons</h1>

<p align="center">
  <strong>⚔️ VIBE CODED BY AN 8 YEAR OLD! ⚔️</strong>
</p>

---

A 2D top-down dungeon crawler. Kill demons, forge keys from their remains, loot the
vaults, and fight your way to the portal — floor after floor, getting stronger in the
shop between runs.

Built with **Phaser 3** + **TypeScript** + **Vite**. No art assets: every sprite is
drawn procedurally at boot, so the whole game is the source.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command          | What it does                                        |
| ---------------- | --------------------------------------------------- |
| `npm run dev`    | Dev server with hot reload                          |
| `npm run build`  | Typecheck, then production build into `dist/`       |
| `npm run test`   | Rule and dungeon-generation tests                   |
| `npm run typecheck` | Typecheck only                                   |

## Controls

- **WASD** / **arrows** — move
- **SPACE** — swing (hold to keep swinging; the cooldown paces it)
- **E** — shop, escape through the portal
- **↑↓ / ENTER / ESC** — navigate the shop
- **BACKSPACE** on the title screen — wipe the save

## The rules

**Three demons slain forges one full key.** Every kill drops a key fragment; three
fragments assemble into a whole key. The HUD shows whole keys plus pips for the
fragments you're carrying toward the next one.

**You cannot escape until every demon on the floor is dead.** The exit portal is
sealed red and stays that way until the last one falls, then turns green.

**3,000 coins forge one galaxy coin.** Coins drop from kills and chests. Galaxy coins
are the premium currency, spent on the three strongest upgrades.

### How keys and the exit fit together

These two rules would collide if keys were what opened the exit — you'd never need a
key, because killing everything is already the requirement. So keys open something
else: **vaults**.

A vault is a sealed side-room hanging off a main room, holding a treasure chest and a
couple of demons. It's optional loot, gated behind a locked door that costs one full
key. Meanwhile the exit is gated behind clearing the floor. Both rules stay live and
neither makes the other pointless.

This is generated so it can never softlock:

- Vaults are carved **adjacent** to their host room and opened by punching a single
  door into the shared wall — never reached by a corridor. That single tile is
  provably the only way in.
- The generator rejects any vault placement where a corridor already runs through or
  alongside the space, so a vault can never end up with a second entrance.
- Demons outside the vaults always yield enough fragments to open every door on the
  floor, so the floor is always clearable.

`npm run test` asserts all of this by flood-filling 25 generated floors: the exit must
be reachable with zero keys, every vault must be unreachable *without* a key and
reachable *with* one, and no demon may ever be stranded.

## The shop

Found on the green pad in the room you start each floor in.

| Upgrade          | Currency | Effect                                       |
| ---------------- | -------- | -------------------------------------------- |
| Vitality         | Coins    | +15 max HP per level                         |
| Edge             | Coins    | +5 damage per level                          |
| Swiftness        | Coins    | +8% movement speed per level                 |
| Frenzy           | Coins    | −7% swing cooldown per level                 |
| Greed            | Galaxy   | +25% coins from every kill                   |
| Soul Harvest     | Galaxy   | Kills drop extra key fragments               |
| Revenant         | Galaxy   | Survive one lethal hit per floor at 30% HP   |

The last row of the shop exchanges 3,000 coins for a galaxy coin.

## Death

You lose 20% of your coins and restart the current floor. **Upgrades are permanent** —
they're the thing that carries a bad run forward. Coins, galaxy coins, upgrades and
your current floor persist to `localStorage`; keys and fragments are run-scoped.

## Layout

```
src/
  main.ts                 Phaser config and scene registration
  systems/
    config.ts             Every tunable number — balance lives here, not in scenes
    state.ts              Save/load, currency, upgrades, key economy
    dungeon.ts            Floor generation (rooms, corridors, vaults, spawns)
    combat.ts             Pure swing-arc maths, kept testable
    textures.ts           Every sprite, drawn at boot
  entities/
    Player.ts             Movement, swinging, i-frames, Revenant
    Monster.ts            Three demon types with distinct chase behaviour
  scenes/
    BootScene.ts          Draws the textures
    TitleScene.ts         Title, rules, continue/wipe
    DungeonScene.ts       The floor: world building, combat, drops, doors, exit
    HudScene.ts           Overlay: health, keys, coins, demons remaining
    ShopScene.ts          Modal shop over a paused dungeon
    GameOverScene.ts      Death and retry
tests/
  rules.test.ts           The key economy, currency, shop, persistence, swing arc
  dungeon.test.ts         25 floors flood-filled for reachability and softlocks
```

## Tuning it

Almost everything you'd want to change is in `src/systems/config.ts`: monster stats,
player damage and speed, how fast floors scale, `KEYS.fragmentsPerKey`, and
`CURRENCY.coinsPerGalaxyCoin`. Upgrade costs and effects are in `src/systems/state.ts`.

## Ideas from here

- A boss demon every fifth floor, holding the portal shut
- Ranged demons, so positioning matters more than closing distance
- A second weapon or a dash bound to shift
- Sound — there is none yet
- Fog of war, so a floor has to be explored rather than read at a glance
