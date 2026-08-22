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
- **Q** — drop a crate on the tile you are facing
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

## The bosses

A **Demon Lord** stands on every tenth floor — 10, 20, 30, 40 and on down — and it is
always posted in the room with the exit portal, so it is guarding the way out. Since a
floor is only clear when every demon on it is dead, the boss is the last thing between
you and the stairs down. Its health is shown on its own bar under the HUD while it
lives.

A boss has **exactly 100 health** — five clean swings at base damage — and hits for a
flat **44**. Neither number scales with depth, unlike every ordinary demon, so a boss is
the same fight on floor 90 as on floor 10. That is deliberate in both directions: fixed
health was the rule asked for, and fixed damage is what stops a floor-101 boss from
one-shotting a fully upgraded player (scaled, Thanos would hit for 910). Bosses also
scream like wraiths, so earmuffs matter in a boss fight.

Worth knowing: because ordinary demons scale and bosses do not, a floor-10 brute (223
health) already outlasts a boss. `BOSS.maxHp` in `config.ts` is the one number to change
if bosses should grow with the floors instead.

## The story

A chapter of story lands after every tenth floor — right after the boss falls, on the
way down to the next one. Eleven chapters in all: one for each of the ten Demon Lords,
and one more after the planet. They are plain text in `src/systems/stories.ts`, keyed by
the floor you have just finished, so adding or rewriting one touches nothing else.

The tenth chapter is the ending: you step out of the castle, fall past the stars, and
land somewhere that is not the dungeon at all.

## Floor 101: the weird planet

Past floor 100 the game leaves the castle. Floor 101 is **the weird planet** — purple
sand, violet rock, stars showing through the empty space around the arena. It is an
arena rather than a dungeon: no vaults, no locked doors, eight demons, and **Thanos**.

Thanos has **40,000 health** and hits for a flat 70. Your own sword would need 572
swings for that, so the planet provides: the **Star Sword** lies two tiles from where
you land, glowing, and picking it up sets your swing to a flat **500** — eighty swings
instead of five hundred and seventy.

The sword replaces your damage rather than adding to it, so it is worth exactly the
same to a brand new player as to a maxed one, and it belongs to the planet: leave the
floor, in any direction, and it is gone. A screech still cuts it (to 300), so earmuffs
stay useful even holding a star.

Even then he hits for 70 against your 250 at most — four hits — and he is slow (76
against your 190), so crates and kiting are the strategy rather than an option.

Beat him and the eleventh chapter plays, the castle comes back for you, and the floors
carry on from 102 as normal.

## The crates

You walk onto every floor carrying **three crates**, and **Q** drops one on the tile
you are facing. A crate is a solid block: nothing walks through it, so it is a wall you
build yourself — to plug a doorway, to break a chase, or to put something between you
and a brute while your health comes back.

Crates are not permanent cover. A demon pressed against one gnaws through it, dealing
its own damage every second, so a crate buys you roughly twelve seconds against an imp
and five against a brute. Your own sword goes through them too, at full damage — five
swings and it splinters — which means you can never seal yourself into a box you cannot
get out of.

A crate only lands on plain floor: never in rock, a locked doorway, on the shop pad, on
the exit portal, on a chest, on another crate, on a demon, or under your own feet. A
refused drop costs you nothing — you keep the crate.

The stack refills to full at the start of every floor, and dying and restarting a floor
refills it too. Crates in hand are never saved; the size of the stack is.

## The screech

Wraiths — the fast, weaving blue demons that start showing up on floor 3 — do not just
chase you. Once one has you in sight and is within earshot it plants its feet, screams,
and pushes out a ring of noise. It costs you no health at all. It makes your swing
**40% weaker for 5 seconds**, which is worse: the demon you were two hits from killing
now takes four.

Two things keep it fair. The scream has a wind-up: a screaming wraith stops moving for
a moment, so the noise is also your opening to hit it. And it can only scream every
7 seconds, which is longer than the weakness lasts, so the pressure always lets up.

**Cute Fluffy Earmuffs** are the answer, sold in the shop for 6,000 coins. One pair is
all you can own and all you need — with them on, a screech does nothing whatsoever. You
can see them: pink and fuzzy, worn on your head for the rest of the game.

Whether a screech lands is decided in exactly one place (`blocksScreech` in
`state.ts`), so there is no path where the muffs are on and the noise still gets
through. Any demon can be made a screecher by flipping `screecher: true` in `MONSTERS`.

## Your avatar

For **9,000 coins** the shop sells the wardrobe, and after that you can be anything —
a cat, a dragon, a robot, a ghost, a slime, a wizard, a dino, a slice of pizza, a star,
or the hooded delver you started as. Ten looks, all free to switch between once the
wardrobe is yours.

Open it from the **Avatar** row of the shop (which turns into a door to the wardrobe
once bought), pick with the arrow keys, and press **ENTER** to wear. Your choice is
saved, so you keep it between sessions.

It is purely cosmetic and deliberately so: every avatar is drawn at the same 26×26 size,
so your hitbox, reach and speed are identical whichever one you wear. Being a pizza is
no harder than being a knight.

## The shop

Found on the green pad in the room you start each floor in.

| Upgrade          | Currency | Effect                                       |
| ---------------- | -------- | -------------------------------------------- |
| Vitality         | Coins    | +15 max HP per level                         |
| Edge             | Coins    | +5 damage per level                          |
| Swiftness        | Coins    | +8% movement speed per level                 |
| Frenzy           | Coins    | −7% swing cooldown per level                 |
| Crate            | Coins    | Carry one more crate per floor (4,000 each)  |
| Cute Fluffy Earmuffs | Coins | Demon screeches cannot weaken you (6,000)   |
| Avatar           | Coins    | Be anything — unlocks the wardrobe (9,000)   |
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
    avatars.ts            Every avatar you can wear, also drawn at boot
    stories.ts            The chapter that plays after every tenth floor
  entities/
    Player.ts             Movement, swinging, i-frames, Revenant
    Monster.ts            Three demon types with distinct chase behaviour
  scenes/
    BootScene.ts          Draws the textures
    TitleScene.ts         Title, rules, continue/wipe
    DungeonScene.ts       The floor: world building, combat, drops, doors, exit
    HudScene.ts           Overlay: health, keys, coins, demons remaining
    ShopScene.ts          Modal shop over a paused dungeon
    AvatarScene.ts        The wardrobe, modal over the paused shop
    StoryScene.ts         A story chapter, between floors
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

- Ranged demons, so positioning matters more than closing distance
- More noises to defend against — a demon whose howl slows you instead
- Crates you can shove rather than only drop
- More avatars — and unlocking them by doing things rather than buying them
- A different boss every tenth floor rather than the same Demon Lord
- More planets past the first one
- A second weapon or a dash bound to shift
- Sound — there is none yet
- Fog of war, so a floor has to be explored rather than read at a glance
