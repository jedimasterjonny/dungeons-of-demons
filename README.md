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

|                  | One player        | Player one | Player two |
| ---------------- | ----------------- | ---------- | ---------- |
| Move             | WASD or arrows    | WASD       | Arrows     |
| Swing            | SPACE             | SPACE      | ENTER      |
| Drop a crate     | Q                 | Q          | SHIFT      |
| Drop a cage      | C                 | C          | /          |
| Shop / escape    | E                 | E          | E          |

- **ENTER** on the title screen — one player. **2** — two players.
- **M** — theme tunes on/off, from anywhere in the game
- **↑↓ / ENTER / ESC** — navigate the shop
- **BACKSPACE** on the title screen — wipe the save

## The rules

**Three demons slain forges one full key.** Every kill drops a key fragment; three
fragments assemble into a whole key. The HUD shows whole keys plus pips for the
fragments you're carrying toward the next one.

**You cannot escape until every demon on the floor is dead, and every grave is
smashed.** The exit portal is sealed red and stays that way until the last one goes,
then turns green. See [The graves](#the-graves).

**Every twentieth floor is dark.** You see only what your own light reaches, and only
the ground you have already walked stays lit behind you. See [The dark floors](#the-dark-floors).

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

## The ????? Shards

> Earn shards, get MASSIVE power and have fun hitting Thanos!

That is the front cover — the line across the top of the title screen. Under it, a
wraith, a brute and an imp stand either side of the title: the real sprites from the
dungeon in their own colours, three times the size. The imps hop, the brutes stomp and
the wraiths float (`COVER` and `BOB` in `src/scenes/TitleScene.ts`).

**Every tenth floor the Demon Lord drops a ????? Shard** where it falls, on floors 10,
20, 30 and on down: a violet crystal, bobbing on the floor. It does not fly to you
like coins do. **Walk over it to take it. Leave the floor without it and it is gone for
good.** The HUD counts the ones you have under your keys (◆ 3/10).

**Each shard is a tiny power-up: +2 damage** on your own swing, for good. Ten of them is
+20, the same as four levels of Edge.

**All ten shards make a MASSIVE power-up to beat Thanos.** With ten, every hit you land
on Thanos counts **four times**. The Star Sword's 500 becomes 2,000 against him, so he
takes **20 swings instead of 80**. Picking up the tenth announces it, and landing on
the planet with all ten announces it again. Miss even one and you face Thanos without it.

| Shards | Your swing    | Star Sword on Thanos | Swings to beat Thanos |
| ------ | ------------- | -------------------- | --------------------- |
| 0      | 20 + Edge     | 500                  | 80                    |
| 3      | 26 + Edge     | 500                  | 80                    |
| 9      | 38 + Edge     | 500                  | 80                    |
| **10** | **40 + Edge** | **2,000**            | **20**                |

The rules underneath:

- The +2 is added to your *own* swing. The Star Sword still replaces it with a flat 500,
  so the sword is worth the same to everyone, as before.
- The ×4 is aimed at Thanos only. Every other demon on the planet still takes 500.
- A screech still bites: screeched, the sword hits Thanos for 300 × 4 = 1,200.
- Shards are saved, like upgrades. The save also remembers the last floor whose shard
  was picked up (`shardFloor`), so dying after taking one and beating the boss again on
  the replay never pays twice. Leaving a floor with its shard still lying there moves
  that number up too, so a trap that sends you back to the floor cannot give you
  a second chance at a shard you left behind (see [the traps](#the-traps)).
- In co-op whoever picks it up, both players get it, and player two joins with player
  one's.
- A save made before shards existed is given the ones already earned: one for each
  Demon Lord above the deepest floor reached.

Worth knowing: the boss dies at sword's length, so its shard usually lands a step from
your feet — forgetting it takes real effort, or a portal reached in a hurry. `SHARDS` in `config.ts` holds every number.

## The traps

> there are some tiles that will do bad stuff. (e.g. going back a level, coins going
> down.) the screen will say 'out witted!'
>
> but you can tell. some (keep that in mind) say: T (tiny)

Every floor has **three trap tiles**. Step on one and the screen says **OUT WITTED!**
in big red letters, with what it just did to you underneath:

| Trap          | What it does                                           |
| ------------- | ------------------------------------------------------ |
| Back a level  | Everything freezes for a moment, then you go up a floor |
| Coins go down | The party loses 10% of its coins (dying costs 20%)      |

**Two of the three have a tiny T on them.** It is a shade lighter than the floor, so
you see it if you are looking. The third looks exactly like floor. Each trap goes off
once and leaves a red crack where it was.

- Traps are never in the room you land in, never under a chest, and never on the shop
  pad, the portal or a doorway. They can be anywhere else, vaults included.
- **Floor 1 has nowhere to go back to**, so its traps only ever take coins.
- Going back a level keeps your deepest floor, your keys and your health (you are not
  healed the way the portal heals you). The floor you land on is a fresh one, full of
  demons again: floors are built from their number, so floor 13 is always the same
  floor 13, traps and all.
- A story chapter plays the first time you clear its floor, not again if a trap sends
  you back up to it.
- A shard you left lying is still gone if a trap sends you back to its floor. A shard
  that never dropped (a trap got you before the Demon Lord fell) is still waiting.
- In co-op either player can set one off, and it hits the whole party.

`TRAPS` in `config.ts` holds the numbers: how many per floor, how many have a T, and
the coin loss. They are placed after everything else on the floor is generated, so
adding them did not move a single room, demon or chest on any existing floor.

## The giving tiles

> now there are giving tiles. exact opposite

Every floor also has **three giving tiles**, and they do exactly what a trap does the
other way round. The screen says **LUCKY!** in big green letters:

| Giving tile       | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| Forward a level   | Everything freezes for a moment, then you go down a floor |
| Coins go up       | The party gains 10% of its coins — the same 10% a trap takes |

**Two of the three have a tiny G**, the same size and shade as a trap's T, so a sharp
eye can tell a G from a T. The third looks exactly like floor. Each goes off once and
leaves a green sparkle where it was.

- **A giving tile never skips a Demon Lord or Thanos.** On floors 10, 20, 30 … 100 and
  on the planet, giving tiles only give coins. That is the mirror of floor 1's traps,
  and it means you can never skip a boss, its shard, or the chapter after it.
- Going forward counts: it is your new deepest floor. It does not heal you the way the
  portal does.
- A trap and a giving tile are never on the same tile, and every rule about where traps
  can go applies to giving tiles too.
- 10% of no coins is no coins. With an empty purse a coin gift gives nothing, just as
  a coin trap takes nothing.

In the code a trap and a giving tile are one thing, a `SpecialTile` with `good` set or
not, since one is exactly the other flipped. `GIFTS` in `config.ts` has its own numbers,
so they can be tuned apart later. "LUCKY!" is a placeholder until he names it.

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

## The dark floors

**Every twentieth floor the lights go out** — 20, 40, 60, 80, 100 and on down. The floor
is pitch black. You carry a light eight tiles wide, and that is all you can see:
demons, chests, doors and the portal are all invisible until your light falls on them.

The ground you walk over stays lit behind you, dimmer than your torch but well clear of
black. So a dark floor is *mapped by walking it* rather than read at a glance, and the
map you build is yours — it does not carry to the next dark floor.

Two things about them are worth knowing before you drop in.

**Every dark floor is also a boss floor.** Twenty is a multiple of ten, so it always
was — but in the dark a Demon Lord spots you from 460 pixels away while your light
reaches 256, so it still sees you the best part of twice as early as you see it. Its
health bar appearing on the HUD is the only warning you get. Earmuffs help here too,
since bosses scream.

**Nothing glows through the dark**, on purpose: the exit portal is as hidden as
everything else, so clearing the floor and then *finding* the way out are two separate
problems. `DARKNESS.lightRadius` in `config.ts` is the one number to raise if that turns
out to be too mean — it started at five tiles and was widened to eight for exactly that
reason.

### How it is drawn

Two sheets of black over the floor, both above the world and below the on-screen prompts
so text stays readable.

- **`seen`** is opaque and is only ever *erased*. Every step burns a near-solid hole in
  it, and that hole never comes back — it is the map you build by walking.
- **`near`** is thinner (66% black) and carries the hole that travels with you. It is
  wiped and repainted every frame.

Ground you have never reached shows both, so it is black. Ground you remember shows only
`near`, so it is dim. Ground you are standing on shows neither.

Only the box your light can reach is repainted each frame, unioned with the box it
reached last frame so the hole punched then gets filled back in behind you. Repainting
the whole 1920×1408 sheet instead measured about a third slower.

The two glows are different shapes for a reason. The torch feathers away over most of
its radius, which is what makes it read as a pool of light. The trail burnt into `seen`
is almost solid, because erasing is subtractive: two soft sheets multiply, and a soft
trail left even the ground under your feet looking half-lit.

## The screech

Wraiths — the fast, weaving blue demons that rise out of graves from floor 3 — do not just
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

## The graves

> also, wraiths come from graves. these have to be destroyed incase wraiths stop spawning

From floor 3, **no wraith is ever just standing on the floor when it starts.** Every
one comes out of a grave instead: a grey headstone with a cross on it, two to a floor,
always in a main room you can walk to without a key and never in the room you land in.

- Each grave raises **one wraith as the floor begins**, then **another every 10 seconds**.
- It waits while **2 of its own wraiths** are still about, so the floor never floods.
  Kill one and the 10 seconds start again.
- Smash a grave with your sword: **200 health**, ten swings at your starting damage. It
  fades as it cracks, like a crate. A smashed grave raises nothing ever again, but the
  wraiths it already raised are still out there.
- **The portal stays sealed while any grave is standing**, even with every demon dead,
  because otherwise more would just keep coming. The HUD counts both:
  `22 demons · 2 graves remaining`.
- Graves block you and every demon except wraiths. Wraiths are ghosts; they float
  straight through headstones.

The demons that used to start a floor as wraiths start as imps and brutes instead, so
every floor still has the same number of demons in the same places, and the same key
economy. `GRAVES` in `config.ts` holds every number.

## The cage maker

> cage maker. find cage pieces to make one. imps can't escape, brutes can, but only
> in 100 moves. wraiths can escape immediately.

**Three cage pieces make one cage.** Three pieces lie somewhere on every floor (a
little barred panel, bobbing), vaults included, so each floor has exactly one cage to
find. The HUD shows whole cages, with pips for the pieces toward the next, like keys.

Press **C** (player two: **/**) and a cage slams down over the **nearest demon within
three tiles**. Inside it, a demon **cannot move and cannot hurt you**, even if you stand
in the cage with it. You can still hit it through the bars.

| Demon      | In a cage                                                         |
| ---------- | ----------------------------------------------------------------- |
| Imp        | **Can't escape.** It is in there until you kill it                |
| Brute      | **Escapes in 100 moves.** The count is over the cage: 100, 99, 98… |
| Wraith     | **Escapes immediately.** It slips out, and the cage is used up     |
| Demon Lord | Too big for a cage. You keep the cage                             |
| Thanos     | Too big for a cage. You keep the cage                             |

A brute rattles the bars **4 moves a second**, so 100 moves is **25 seconds**, and the
cage shakes with every one. A cage is used up whatever happens: it breaks when its
demon breaks out or dies.

A caged demon is not a dead one, so the portal still wants it dead. The cage is for
holding it still while you deal with everything else, or while you hit it.

Cages and pieces are run-scoped, like keys: they carry from floor to floor, the party
shares them, and dying or starting from the title loses them. They are never saved.
How long each demon lasts is `cageMoves` in `MONSTERS`, so every kind of demon has a
cage rule; the rest is `CAGES` in `config.ts`.

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

## The theme tune

> dum dumdum dummmm dom dom dam

There is no `.mp3` anywhere. The game ships with no art assets — every sprite is drawn
at boot — and the music keeps the same rule: the whole tune is a table of notes in
`src/systems/music.ts`, played on oscillators through an envelope. **M** turns it off
from anywhere, and it stays off between sessions.

The line above is the rhythm, note for note: one, then two quick ones run together,
then the long one, then three coming back down.

| Syllable   | Eighth-notes | First half | Second half |
| ---------- | ------------ | ---------- | ----------- |
| dum        | 2            | D3         | F3          |
| dum        | 1            | D3         | F3          |
| dum        | 1            | D3         | F3          |
| **dummmm** | **4**        | **A3**     | **C4**      |
| dom        | 2            | F3         | A3          |
| dom        | 2            | E3         | G3          |
| dam        | 4            | D3         | A3          |

The vowel changing from "u" to "o" to "a" is where the tune turns around, so the held
**dummmm** is the top note and the descending "dom dom dam" walks back down. The theme
plays the line twice: the first half lands back on D, settled, and the second lands on
A, which does not settle — which is what makes it want to come round again. About eight
and a half seconds for this one.

### The second theme

> boy girl cat mouse cheese

The two themes take turns: dum dumdum first, then this one, then round again — about
fourteen seconds for both. It is a chase up the stairs. Each word is one step higher,
"cat mouse" are run together quickly because the cat is right behind the mouse, and
**cheese** is held at the top because that is what everyone was running for.

| Word       | Eighth-notes | Going up | Coming down |
| ---------- | ------------ | -------- | ----------- |
| boy        | 2            | D3       | C4          |
| girl       | 2            | F3       | A3          |
| cat        | 1            | G3       | G3          |
| mouse      | 1            | A3       | F3          |
| **cheese** | **4**        | **C4**   | **D3**      |

Going up, cheese lands high on C and does not settle — still being chased. Coming down,
it lands on D, home, which is exactly the note dum dumdum starts on, so the hand-back
between the two themes is seamless. He gave the words, not the rhythm or the notes; the
rhythm and pitches above are one reading of them, and each is a one-line change in
`CHEESE` / `CHEESE_THEME` in `src/systems/music.ts`.

Each note is a triangle for the body, a quiet detuned square for the edge, and a sine an
octave down on the longer notes for weight, through a lowpass at 1.4 kHz. That
sub-octave started at half gain and was measurably louder than the note itself — a bass
rumble rather than a tune — so it sits at 0.26 now.

Notes are scheduled against the audio clock, not `setInterval`, because a timer that
fires late makes the tune stumble. A timer only decides when to queue up more.

`Music.render(loops)` plays the same synthesis into an `OfflineAudioContext` instead of
the speakers. That is how the tune gets checked: rendering it and measuring the pitch of
every note by autocorrelation proves the synthesiser produces the melody in the table
above, which no amount of asserting on the data can.

Browsers keep audio suspended until a page has had a real key or click, so the first
input is what actually starts it — the game is deliberately silent until then.

## Two players

Press **2** on the title screen and a second player joins on the arrow keys, on the
same keyboard. A coloured ring under each player's feet says who is who — gold for
player one, green for player two — because both of you can be wearing the same avatar.

The camera cannot follow two people, so it follows the midpoint between you and pulls
back to hold you both, down to `COOP.minZoom`. Past that it stops shrinking the game
and simply lets you separate.

### Going down, and being picked up

Running out of health in co-op does not kill you. You go **down**: flat on the floor,
out of the fight, with a bar over your body. The other player stands over you for
**three uninterrupted seconds** and you are back up with **half your health**. Step away
and the progress resets to zero.

Two things make it a real decision rather than a formality:

- **Demons stop targeting a downed player and turn on the rescuer.** Whoever comes for
  you takes everything that was hitting you, standing still, for three seconds.
- **If both of you go down, the run is over** and you restart the floor together.

Leaving a floor picks up anybody still down, so a rescue that never came cannot strand
the party on the stairs.

Alone, none of this applies: with nobody coming for you, running out of health is simply
death, exactly as it always was.

### What the party shares

| Shared                 | Your own                                  |
| ---------------------- | ----------------------------------------- |
| Coins and galaxy coins | Health, and max health                    |
| Keys and fragments     | Every upgrade, bought separately          |
| Which floor you are on | Crates in hand                            |
|                        | Earmuffs — one pair covers one head       |
|                        | Your avatar                               |
|                        | The Star Sword, carried by whoever got it |

The shop charges the party's pot but upgrades **whoever walked onto the pad**, so the
two of you build different characters out of one pile of coins. A screech is worked out
against each player's own ears and each player's own distance from the demon.

Player two starts with a **copy** of player one's upgrades. There is only one save on
this computer for them to inherit from, and a level-one partner standing next to a maxed
player would be a liability rather than a help. From that moment the two sets are
independent — buying for one never upgrades the other. Only player one is written to
disk; player two is a guest for the length of the run.

### How it is put together

`PlayerState` owns everything that belongs to one person; `GameState` owns the run and
holds a list of them. That split is the whole feature — `Player` sprites read their own
sheet and never reach for a global, so a second player is a second entry in an array
rather than a special case threaded through the scene.

It is also deliberately the shape networked play needs, where each player arrives from a
different computer carrying their own upgrades. Floors are already generated from a
deterministic seed (`generateDungeon(20)` builds the identical dungeon everywhere), so
two machines would never have to send the map to each other — only the moving things.

One naming trap worth knowing: the field on `Player` is called `sheet`, as in character
sheet, not `state`. Phaser's `GameObject` already owns a `state` property, and shadowing
it silently breaks every physics signature that takes a sprite.

## The shop

Found on the green pad in the room you start each floor in.

| Upgrade          | Currency | Effect                                       |
| ---------------- | -------- | -------------------------------------------- |
| Vitality         | Coins    | +15 max HP per level                         |
| Edge             | Coins    | +5 damage per level                          |
| Swiftness        | Coins    | +8% movement speed per level                 |
| LESS             | Coins    | −7% swing cooldown per level                 |
| Armour           | Coins    | Every hit hurts 8% less per level, five deep |
| Crate            | Coins    | Carry one more crate per floor (4,000 each)  |
| Cute Fluffy Earmuffs | Coins | Demon screeches cannot weaken you (6,000)   |
| Avatar           | Coins    | Be anything — unlocks the wardrobe (9,000)   |
| MORE!            | Galaxy   | +25% coins from every kill                   |
| TAKE THAT!       | Galaxy   | Kills drop extra key fragments               |
| Revenant         | Galaxy   | Survive one lethal hit per floor at 30% HP   |

**LESS**, **MORE!** and **TAKE THAT!** were named by the designer. Only the display
names changed: the ids behind them are still `frenzy`, `greed` and `harvest`, because an
id is the key an upgrade is saved under and renaming one would quietly wipe everybody's
levels for it on the next load.

### Armour

Five levels, 8% off every hit each, so a fully armoured player takes **60%** of what
lands. That is the only defensive stat that scales with what is hitting you: Vitality
gives a bigger pool, Revenant gives one free death, and armour makes the numbers
themselves smaller. A Demon Lord's flat 44 becomes 26, and Thanos's 70 becomes 42.

It is applied in one place — `Player.takeDamage` — so every source of damage in the game
goes through it exactly once. `damageMultiplier` is also floored at 0.2 no matter what
the level is, so raising `maxLevel` later can never reach immunity or, worse, go negative
and make demons heal you. There is a test for that.


The last row of the shop exchanges 3,000 coins for a galaxy coin.

## Death

You lose 20% of your coins and restart the current floor. **Upgrades are permanent** —
they're the thing that carries a bad run forward. Coins, galaxy coins, upgrades and
your current floor persist to `localStorage`; keys, fragments, cages and cage pieces
are run-scoped.

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

- The netcode: a server so the second player can be on another computer
- Ranged demons, so positioning matters more than closing distance
- More noises to defend against — a demon whose howl slows you instead
- Crates you can shove rather than only drop
- More avatars — and unlocking them by doing things rather than buying them
- A different boss every tenth floor rather than the same Demon Lord
- More planets past the first one
- A second weapon or a dash bound to shift
- More sound — a hit, a coin, a door, a boss roar
- A lantern in the shop, so your light on a dark floor can be bought wider
