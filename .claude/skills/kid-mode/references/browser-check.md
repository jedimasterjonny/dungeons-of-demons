# Driving the game in a real browser

Read this when a feature is written and needs checking on screen, or when a screenshot
is wanted for him. Tests cannot see rendering, layout collisions, or a scene that throws
every frame — playing it can.

## Setup

Chrome is already installed for Puppeteer:

```
/home/jonny/.cache/puppeteer/chrome/linux-151.0.7922.77/chrome-linux64/chrome
```

`puppeteer-core` lives in a session scratchpad rather than the project. Find an existing
copy and symlink it into the current scratchpad rather than reinstalling:

```bash
PC=$(find /tmp/claude-* -maxdepth 6 -name puppeteer-core -type d | head -1)
ln -sfn "$(dirname "$PC")" "$SCRATCH/node_modules"   # link the node_modules holding it
```

If Chrome refuses to launch, it is missing system libraries (passwordless sudo works):

```bash
sudo zypper install libatk-1_0-0 libatk-bridge-2_0-0 libXcomposite1 libXdamage1 libXrandr2 libatspi0
```

Start the dev server bound to the LAN address so it is reachable, and reuse an existing
one rather than starting a second:

```bash
ss -ltnp | grep 5173 || npm run dev -- --host 192.168.1.118
```

## Launch options that work

```js
const browser = await puppeteer.launch({
  headless: true,                    // not 'shell'
  executablePath: '/home/jonny/.cache/puppeteer/chrome/linux-151.0.7922.77/chrome-linux64/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  defaultViewport: { width: 1000, height: 620 },
});
await page.goto('http://192.168.1.118:5173/', { waitUntil: 'domcontentloaded' });
```

`waitUntil: 'networkidle0'` never resolves — a running game loop is never network-idle.

## Debug handles the game exposes

`src/main.ts` puts these on `window` on purpose:

- `window.__game` — the Phaser.Game. Reach a scene with
  `window.__game.scene.getScene('Dungeon')`.
- `window.__state` — the `gameState` singleton.

TypeScript `private` is not private at runtime, so a driver can read `scene.player`,
`scene.monsters`, `scene.crates`, `scene.dungeon.grid`, `monster.screechCooldown` and so
on. Use that to force a situation instead of playing toward it.

Jump straight to the state you want to test by writing the save before the game boots,
then reloading:

```js
await page.evaluate(() => localStorage.setItem('dungeons-of-demons/save/v1', JSON.stringify({
  coins: 60000, galaxyCoins: 5, floor: 101, deepestFloor: 101,
  upgrades: { vitality: 10, edge: 10, earmuffs: 1 }, avatar: 'delver',
})));
await page.reload({ waitUntil: 'domcontentloaded' });
```

## Four gotchas that each cost real time

**Keys need a gap.** `page.keyboard.press()` sends keydown and keyup with nothing
between, and the game can miss it. Always:

```js
await page.keyboard.down('Enter');
await new Promise(r => setTimeout(r, 90));
await page.keyboard.up('Enter');
```

**Poll inside the page, never from Node.** A headless page throttles frames while Node
sleeps, so `await sleep(); read state;` reads stale values. Use
`page.waitForFunction(fn, { polling: 'raf' })`, or sample with `setInterval` inside a
single `page.evaluate` that resolves a promise with the collected trace.

**Never teleport onto an unchecked tile.** `player.body.reset(monster.x - 96, monster.y)`
lands inside solid rock about half the time, and then crates get refused, demons never
reach you and swings never connect — all looking exactly like feature bugs. Either move
the *monster* to the player's known-good tile:

```js
monster.body.reset(scene.player.x + 74, scene.player.y);
```

or find real floor tiles first (`grid[y][x] === 1` is `TileType.Floor`) and place both
on them.

**Scene control lives on the scene, not the manager.** `game.scene.launch(...)` does not
exist. Use the plugin on a scene:

```js
const d = window.__game.scene.getScene('Dungeon');
d.scene.pause();
d.scene.launch('Shop', { returnTo: 'Dungeon' });
```

## What to actually look at

Screenshot and *read* the image, do not just assert on numbers:

- Does new HUD text collide with `FLOOR n`, the coins, or the boss bar? Check with the
  longest string it can hold.
- Does a new shop row push the coin-exchange line into the hint text?
- Is the sprite legible at game size, or just a coloured blob?
- Watch for `pageerror` and console errors — collect them and report anything that is
  not the harmless `/favicon.ico` 404:

```js
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
```

A `pageerror` about `undefined` while nothing responds to input means a scene is
throwing every frame — usually a field the code updates but never created.

Then send the good screenshots to him with SendUserFile.
