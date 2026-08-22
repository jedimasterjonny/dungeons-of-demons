import Phaser from 'phaser';
import { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { isInSwingArc } from '../systems/combat';
import { BOSS, CRATES, PLANET, KEYS, PLAYER, SCREECH, TILE, WORLD } from '../systems/config';
import {
  TileType,
  generateDungeon,
  isCrateTile,
  isPlanetFloor,
  tileToWorld,
  worldToTile,
  type DungeonData,
} from '../systems/dungeon';
import { gameState } from '../systems/state';
import { hasStoryAfter } from '../systems/stories';

interface DoorSprite extends Phaser.Physics.Arcade.Sprite {
  tileX: number;
  tileY: number;
}

/** A dropped crate. It wears down, so being walled in is always temporary. */
interface CrateSprite extends Phaser.Physics.Arcade.Sprite {
  hp: number;
}

export class DungeonScene extends Phaser.Scene {
  private dungeon!: DungeonData;
  player!: Player;
  private monsters!: Phaser.Physics.Arcade.Group;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private doors!: Phaser.Physics.Arcade.StaticGroup;
  private pickups!: Phaser.Physics.Arcade.Group;
  private chests!: Phaser.Physics.Arcade.StaticGroup;
  private crates!: Phaser.Physics.Arcade.StaticGroup;
  /** Set on boss floors only, so the HUD can show its health bar. */
  private boss?: Monster;
  /** The Star Sword lying on the planet, until someone walks over it. */
  private sword?: Phaser.Physics.Arcade.Sprite;
  private exitPortal!: Phaser.GameObjects.Sprite;
  private shopPad!: Phaser.GameObjects.Sprite;
  /** Only exists once you own a pair — it rides along on the player's head. */
  private playerMuffs?: Phaser.GameObjects.Sprite;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  private prompt!: Phaser.GameObjects.Text;
  private monstersLeft = 0;
  private transitioning = false;
  /** Recomputed each frame; the E handler acts on whatever is currently in reach. */
  private nearShop = false;
  private nearExit = false;

  constructor() {
    super('Dungeon');
  }

  create(): void {
    this.transitioning = false;
    gameState.revenantUsed = false;
    // A new floor starts with clear ears and a full stack of crates, whatever the
    // last one did to you.
    gameState.screechTimer = 0;
    gameState.crates = gameState.cratesPerFloor;
    // The Star Sword belongs to the planet and is picked up there, never carried in.
    gameState.hasStarSword = false;
    this.dungeon = generateDungeon(gameState.floor);

    const worldW = WORLD.cols * TILE;
    const worldH = WORLD.rows * TILE;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor(0x0a0a0f);

    this.buildTiles(worldW, worldH);
    this.spawnEntities();
    this.bindInput();

    this.prompt = this.add
      .text(0, 0, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#ffe9a8',
        backgroundColor: '#00000099',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setDepth(200)
      .setVisible(false);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.fadeIn(350, 0, 0, 0);

    this.scene.launch('Hud');
    this.emitStats();

    this.events.on('screech', this.onScreech, this);
    // You may have changed your look in the shop's wardrobe while we were paused.
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);

    this.events.on('revenant', () => {
      this.cameras.main.flash(400, 255, 210, 90);
      this.floatText(this.player.x, this.player.y - 30, 'REVENANT!', '#ffd15c');
    });

    // The HUD is a separate scene; make sure it dies with this one.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop('Hud');
      this.events.off('revenant');
      this.events.off('screech', this.onScreech, this);
      this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
      this.input.keyboard?.off('keydown-E', this.onInteract, this);
      this.input.keyboard?.off('keydown-Q', this.onDropCrate, this);
    });
  }

  private onResume(): void {
    this.player.refreshAvatar();
  }

  // --- world construction -------------------------------------------------

  private buildTiles(worldW: number, worldH: number): void {
    const { grid } = this.dungeon;

    // Stamp the floor only where you can actually walk. A world-sized tileSprite
    // would paint the solid rock too, making rooms and corridors invisible.
    // One render texture keeps it to a single draw call instead of ~1000 sprites.
    const ground = this.add.renderTexture(0, 0, worldW, worldH).setOrigin(0).setDepth(0);
    ground.beginDraw();
    for (let y = 0; y < WORLD.rows; y++) {
      for (let x = 0; x < WORLD.cols; x++) {
        if (grid[y][x] !== TileType.Wall) ground.batchDrawFrame('floor', undefined, x * TILE, y * TILE);
      }
    }
    ground.endDraw();

    this.walls = this.physics.add.staticGroup();
    this.doors = this.physics.add.staticGroup();

    const isWall = (x: number, y: number) =>
      grid[y]?.[x] === undefined || grid[y][x] === TileType.Wall;

    for (let y = 0; y < WORLD.rows; y++) {
      for (let x = 0; x < WORLD.cols; x++) {
        const t = grid[y][x];
        if (t !== TileType.Wall) continue;

        // Only build wall tiles that border walkable space. The solid interior is
        // unreachable and unseen, so skipping it saves ~2000 sprites per floor.
        let borders = false;
        for (let dy = -1; dy <= 1 && !borders; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!isWall(x + dx, y + dy)) {
              borders = true;
              break;
            }
          }
        }
        if (!borders) continue;

        this.walls
          .create(tileToWorld(x), tileToWorld(y), 'wall')
          .setDepth(10)
          .refreshBody();
      }
    }

    for (const d of this.dungeon.doors) {
      const sprite = this.doors
        .create(tileToWorld(d.x), tileToWorld(d.y), 'door')
        .setDepth(11) as DoorSprite;
      sprite.tileX = d.x;
      sprite.tileY = d.y;
      sprite.refreshBody();
    }

    if (isPlanetFloor(gameState.floor)) this.dressThePlanet(ground, worldW, worldH);

    this.shopPad = this.add
      .sprite(tileToWorld(this.dungeon.shop.x), tileToWorld(this.dungeon.shop.y), 'shoppad')
      .setDepth(1);

    this.exitPortal = this.add
      .sprite(tileToWorld(this.dungeon.exit.x), tileToWorld(this.dungeon.exit.y), 'portal')
      .setDepth(2)
      .setTint(0xff4a5e);
    this.tweens.add({
      targets: this.exitPortal,
      scale: { from: 0.85, to: 1.1 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Repaints the floor for the one level that is not in the castle: alien ground,
   * violet rock, and stars showing through the empty space around the arena.
   */
  private dressThePlanet(ground: Phaser.GameObjects.RenderTexture, worldW: number, worldH: number): void {
    this.cameras.main.setBackgroundColor(PLANET.sky);
    ground.setTint(PLANET.ground);
    for (const w of this.walls.getChildren() as Phaser.GameObjects.Sprite[]) w.setTint(PLANET.walls);

    // Behind the ground, so stars only show in the void between the rocks.
    const stars = this.add.graphics().setDepth(-1);
    for (let i = 0; i < 260; i++) {
      const a = Phaser.Math.FloatBetween(0.25, 0.95);
      stars
        .fillStyle(0xffffff, a)
        .fillCircle(Phaser.Math.Between(0, worldW), Phaser.Math.Between(0, worldH), a > 0.8 ? 1.6 : 1);
    }
  }

  private spawnEntities(): void {
    const start = this.dungeon.playerStart;
    this.player = new Player(this, tileToWorld(start.x), tileToWorld(start.y));

    if (gameState.blocksScreech) {
      this.playerMuffs = this.add.sprite(this.player.x, this.player.y - 9, 'earmuffs').setScale(0.85);
    }

    this.monsters = this.physics.add.group({ runChildUpdate: false });
    for (const m of this.dungeon.monsters) {
      this.monsters.add(new Monster(this, tileToWorld(m.x), tileToWorld(m.y), m.kind, gameState.floor));
    }
    this.monstersLeft = this.monsters.getLength();
    this.boss = (this.monsters.getChildren() as Monster[]).find((m) => m.stats.boss);
    this.publishBoss();

    this.pickups = this.physics.add.group();

    this.crates = this.physics.add.staticGroup();

    this.chests = this.physics.add.staticGroup();
    for (const c of this.dungeon.chests) {
      this.chests.create(tileToWorld(c.x), tileToWorld(c.y), 'chest').setDepth(5).refreshBody();
    }

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.monsters, this.walls);
    this.physics.add.collider(this.monsters, this.monsters);
    this.physics.add.collider(this.player, this.doors, undefined, () => {
      this.tryUnlockNearestDoor();
      return true;
    });
    this.physics.add.collider(this.monsters, this.doors);
    this.physics.add.collider(this.player, this.crates);
    // Demons chew through what blocks them. The callback runs every frame of
    // contact, so the damage is dealt per second rather than per touch.
    this.physics.add.collider(this.monsters, this.crates, (m, c) => {
      const dt = this.game.loop.delta / 1000;
      this.damageCrate(c as CrateSprite, (m as Monster).damage * CRATES.chewRate * dt);
    });

    this.physics.add.overlap(this.player, this.monsters, (_p, m) => {
      const monster = m as Monster;
      if (this.player.takeDamage(monster.damage, monster.x, monster.y)) {
        this.cameras.main.shake(120, 0.006);
        this.emitStats();
        if (gameState.hp <= 0) this.onDeath();
      }
    });

    this.physics.add.overlap(this.player, this.pickups, (_p, item) => {
      this.collect(item as Phaser.Physics.Arcade.Sprite);
    });

    this.physics.add.overlap(this.player, this.chests, (_p, c) => {
      this.openChest(c as Phaser.Physics.Arcade.Sprite);
    });

    if (this.dungeon.sword) {
      const { x, y } = this.dungeon.sword;
      this.sword = this.physics.add
        .sprite(tileToWorld(x), tileToWorld(y), 'starsword')
        .setDepth(16);
      // World gravity is zero and nothing collides with it, so it just sits there.
      this.tweens.add({
        targets: this.sword,
        y: this.sword.y - 7,
        scale: 1.15,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.physics.add.overlap(this.player, this.sword, () => this.takeSword());
    }
  }

  private bindInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Interact is event-driven rather than polled: a JustDown check only sees the
    // key if a frame happens to land while it is held, so a quick tap can vanish.
    kb.on('keydown-E', this.onInteract, this);
    kb.on('keydown-Q', this.onDropCrate, this);
  }

  private onInteract(): void {
    if (this.transitioning) return;
    if (this.nearShop) this.openShop();
    else if (this.nearExit && this.monstersLeft === 0) this.escape();
  }

  /** Drops a crate on the tile you are facing, if that tile is free. */
  private onDropCrate(): void {
    if (this.transitioning) return;

    if (gameState.crates <= 0) {
      this.floatText(this.player.x, this.player.y - 30, 'NO CRATES LEFT', '#ff8a8a');
      return;
    }

    const tx = worldToTile(this.player.x + Math.cos(this.player.facing) * TILE);
    const ty = worldToTile(this.player.y + Math.sin(this.player.facing) * TILE);
    const wx = tileToWorld(tx);
    const wy = tileToWorld(ty);

    const blocked =
      !isCrateTile(this.dungeon.grid, tx, ty) ||
      // Never drop one on your own feet — you would be shoved out of it.
      Phaser.Math.Distance.Between(this.player.x, this.player.y, wx, wy) < TILE * 0.75 ||
      (this.crates.getChildren() as CrateSprite[]).some((c) => c.x === wx && c.y === wy) ||
      (this.chests.getChildren() as Phaser.Physics.Arcade.Sprite[]).some(
        (c) => Phaser.Math.Distance.Between(c.x, c.y, wx, wy) < TILE * 0.75
      ) ||
      (this.monsters.getChildren() as Monster[]).some(
        (m) => Phaser.Math.Distance.Between(m.x, m.y, wx, wy) < m.stats.radius + TILE / 2
      );

    if (blocked) {
      this.floatText(this.player.x, this.player.y - 30, 'NO ROOM', '#ff8a8a');
      return;
    }

    gameState.crates -= 1;
    const crate = this.crates.create(wx, wy, 'crate').setDepth(12) as CrateSprite;
    crate.hp = CRATES.maxHp;
    crate.refreshBody();

    // Slam it down rather than fade it in, so it reads as solid immediately.
    crate.setScale(1.35);
    this.tweens.add({ targets: crate, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.spark(wx, wy, 0xa87a37, 8);
    this.emitStats();
  }

  /** Wears a crate down and splinters it at zero. */
  private damageCrate(crate: CrateSprite, amount: number): void {
    if (!crate.active) return;
    crate.hp -= amount;

    if (crate.hp <= 0) {
      this.spark(crate.x, crate.y, 0xa87a37, 14);
      crate.destroy();
      return;
    }
    // Fade with the damage so a nearly-gone crate looks it.
    crate.setAlpha(0.45 + 0.55 * (crate.hp / CRATES.maxHp));
  }

  // --- loop ---------------------------------------------------------------

  override update(_time: number, delta: number): void {
    if (this.transitioning) return;
    const dt = delta / 1000;

    const dir = new Phaser.Math.Vector2(
      (this.keyD.isDown || this.cursors.right.isDown ? 1 : 0) -
        (this.keyA.isDown || this.cursors.left.isDown ? 1 : 0),
      (this.keyS.isDown || this.cursors.down.isDown ? 1 : 0) -
        (this.keyW.isDown || this.cursors.up.isDown ? 1 : 0)
    );
    this.player.move(dir);
    this.player.tick(dt);

    const target = new Phaser.Math.Vector2(this.player.x, this.player.y);
    for (const m of this.monsters.getChildren() as Monster[]) {
      m.tick(dt, target);
    }

    // Held rather than tapped: the swing cooldown already paces it.
    if (this.keySpace.isDown && this.player.canAttack) {
      this.swing();
    }

    if (this.playerMuffs) {
      // Sit just in front of the player so they never disappear behind their own hood.
      this.playerMuffs.setPosition(this.player.x, this.player.y - 9).setDepth(this.player.depth + 0.001);
    }

    this.publishBoss();
    this.updatePrompts();
    this.homePickups(dt);
  }

  private swing(): void {
    const angle = this.player.beginSwing();

    const arc = this.add
      .sprite(
        this.player.x + Math.cos(angle) * 14,
        this.player.y + Math.sin(angle) * 14,
        'swing'
      )
      .setRotation(angle)
      .setDepth(30)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(gameState.hasStarSword ? 0.95 : 0.7)
      .setTint(gameState.hasStarSword ? 0xfff6cf : 0xffffff);
    this.tweens.add({
      targets: arc,
      alpha: { from: 0.9, to: 0 },
      scale: gameState.hasStarSword ? 1.25 : 0.95,
      duration: 160,
      onComplete: () => arc.destroy(),
    });

    const maxArc = Phaser.Math.DegToRad(PLAYER.attackArc);
    let hitAny = false;

    for (const m of [...(this.monsters.getChildren() as Monster[])]) {
      if (!m.active) continue;
      if (!isInSwingArc(this.player, angle, m, m.stats.radius, PLAYER.attackRange, maxArc)) continue;

      const toMonster = Math.atan2(m.y - this.player.y, m.x - this.player.x);
      hitAny = true;
      const killed = m.takeDamage(gameState.damage, toMonster);
      this.spark(m.x, m.y, 0xffffff, 6);
      if (killed) this.killMonster(m);
    }

    // Your own crates are in the way of your own sword — that is the way out of a
    // box you have walled yourself into.
    for (const c of [...(this.crates.getChildren() as CrateSprite[])]) {
      if (!c.active) continue;
      if (!isInSwingArc(this.player, angle, c, TILE / 2, PLAYER.attackRange, maxArc)) continue;
      hitAny = true;
      this.spark(c.x, c.y, 0xa87a37, 4);
      this.damageCrate(c, gameState.damage);
    }

    if (hitAny) this.cameras.main.shake(80, 0.003);
  }

  private killMonster(m: Monster): void {
    const { x, y } = m;
    const coins = m.coinValue;
    const wasBoss = m.stats.boss;
    m.destroy();
    this.monstersLeft = this.monsters.getLength();

    this.spark(x, y, m.stats.tint, wasBoss ? 40 : 14);

    if (wasBoss) {
      this.boss = undefined;
      this.publishBoss();
      this.cameras.main.shake(500, 0.012);
      this.cameras.main.flash(500, 255, 90, 120);
      this.floatText(x, y - 34, `THE ${BOSS.name.toUpperCase()} FALLS`, '#ff3b5c');
    }

    // Every kill drops its coins plus a key fragment. Three fragments make a key.
    this.dropPickup(x, y, 'coin', { coins });
    for (let i = 0; i < gameState.fragmentsPerKill; i++) {
      this.dropPickup(x, y, 'fragment', { fragment: true });
    }

    if (this.monstersLeft === 0) {
      this.exitPortal.setTint(0x4ade80);
      this.floatText(this.exitPortal.x, this.exitPortal.y - 24, 'THE WAY OUT IS OPEN', '#4ade80');
      this.cameras.main.flash(300, 60, 200, 120);
    }
    this.emitStats();
  }

  /** Picks up the Star Sword: your swing becomes a flat 500 for the rest of the floor. */
  private takeSword(): void {
    if (!this.sword?.active || gameState.hasStarSword) return;

    gameState.hasStarSword = true;
    const { x, y } = this.sword;
    this.sword.destroy();
    this.sword = undefined;

    this.cameras.main.flash(500, 255, 246, 207);
    this.spark(x, y, 0xfff6cf, 26);
    this.floatText(x, y - 24, PLANET.swordName.toUpperCase(), '#fff6cf');
    this.floatText(this.player.x, this.player.y - 40, `SWING ${PLANET.swordDamage}`, '#ffd15c');
    this.emitStats();
  }

  /**
   * A demon screamed. The ring is always drawn — you should see the noise coming
   * either way — but earmuffs decide whether it lands on you.
   */
  private onScreech(m: Monster): void {
    const ring = this.add
      .sprite(m.x, m.y, 'screechring')
      .setTint(m.stats.tint)
      .setDepth(35)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.2);
    this.tweens.add({
      targets: ring,
      scale: (SCREECH.range * 2) / 96,
      alpha: { from: 0.85, to: 0 },
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    // A shout squashes the shouter.
    this.tweens.add({
      targets: m,
      scaleX: 1.3,
      scaleY: 0.78,
      duration: 130,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    this.floatText(m.x, m.y - 22, 'SCREEEECH!', '#ffffff');

    if (gameState.blocksScreech) {
      this.floatText(this.player.x, this.player.y - 30, 'MUFFLED', '#ff9ecb');
      this.spark(this.player.x, this.player.y - 9, 0xff9ecb, 8);
      return;
    }

    gameState.screechTimer = SCREECH.duration;
    this.cameras.main.shake(200, 0.004);
    this.floatText(
      this.player.x,
      this.player.y - 30,
      `ATTACK -${Math.round(SCREECH.attackReduction * 100)}%`,
      '#ff8a8a'
    );
    this.emitStats();
  }

  // --- pickups ------------------------------------------------------------

  private dropPickup(
    x: number,
    y: number,
    texture: 'coin' | 'fragment',
    data: { coins?: number; fragment?: boolean }
  ): void {
    const item = this.pickups.create(x, y, texture) as Phaser.Physics.Arcade.Sprite;
    item.setDepth(15).setData(data);
    // A short scatter, then homePickups() reels them in.
    const a = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 90;
    item.body!.velocity.set(Math.cos(a) * speed, Math.sin(a) * speed);
    (item.body as Phaser.Physics.Arcade.Body).setDrag(320);
    item.setData('age', 0);
    this.tweens.add({ targets: item, scale: { from: 0, to: 1 }, duration: 180, ease: 'Back.easeOut' });
  }

  private homePickups(dt: number): void {
    for (const item of this.pickups.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      const age = (item.getData('age') as number) + dt;
      item.setData('age', age);
      if (age < 0.35) continue;

      const d = Phaser.Math.Distance.Between(item.x, item.y, this.player.x, this.player.y);
      if (d < 190) {
        const a = Math.atan2(this.player.y - item.y, this.player.x - item.x);
        const pull = Phaser.Math.Linear(520, 180, Math.min(1, d / 190));
        item.body!.velocity.set(Math.cos(a) * pull, Math.sin(a) * pull);
      }
    }
  }

  private collect(item: Phaser.Physics.Arcade.Sprite): void {
    if (!item.active) return;
    const coins = item.getData('coins') as number | undefined;
    const fragment = item.getData('fragment') as boolean | undefined;

    if (coins) {
      gameState.addCoins(coins);
      this.floatText(item.x, item.y, `+${Math.round(coins * gameState.coinMultiplier)}`, '#ffc93c');
    }
    if (fragment) {
      const { keysGained } = gameState.addFragments(1);
      if (keysGained > 0) {
        gameState.keys += keysGained;
        this.floatText(this.player.x, this.player.y - 34, 'KEY FORGED', '#ffd15c');
        this.cameras.main.flash(180, 255, 209, 92);
      }
    }
    item.destroy();
    this.emitStats();
  }

  private openChest(chest: Phaser.Physics.Arcade.Sprite): void {
    if (chest.getData('opened')) return;
    chest.setData('opened', true);

    const loot = Phaser.Math.Between(180, 340) * (1 + 0.15 * (gameState.floor - 1));
    gameState.addCoins(loot);
    this.floatText(chest.x, chest.y - 16, `+${Math.round(loot * gameState.coinMultiplier)} coins`, '#ffc93c');
    this.spark(chest.x, chest.y, 0xffc93c, 16);

    this.player.heal(Math.round(gameState.maxHp * 0.25));
    this.floatText(chest.x, chest.y - 34, '+25% HP', '#4ade80');

    this.tweens.add({ targets: chest, alpha: 0.35, duration: 250 });
    chest.body!.enable = false;
    this.emitStats();
  }

  // --- doors, shop, exit --------------------------------------------------

  private tryUnlockNearestDoor(): void {
    if (gameState.keys <= 0) return;

    let nearest: DoorSprite | null = null;
    let best = Infinity;
    for (const d of this.doors.getChildren() as DoorSprite[]) {
      const dist = Phaser.Math.Distance.Between(d.x, d.y, this.player.x, this.player.y);
      if (dist < best) {
        best = dist;
        nearest = d;
      }
    }
    if (!nearest || best > TILE * 1.4) return;

    gameState.keys -= 1;
    this.dungeon.grid[nearest.tileY][nearest.tileX] = TileType.Floor;
    this.floatText(nearest.x, nearest.y - 20, 'UNLOCKED', '#ffd15c');
    this.spark(nearest.x, nearest.y, 0xffd15c, 12);

    const door = nearest;
    this.doors.remove(door, false, false);
    door.body!.enable = false;
    this.tweens.add({
      targets: door,
      alpha: 0,
      scaleY: 0.2,
      duration: 250,
      onComplete: () => door.destroy(),
    });
    this.emitStats();
  }

  private updatePrompts(): void {
    const nearShop =
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.shopPad.x, this.shopPad.y) <
      TILE * 1.3;
    const nearExit =
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitPortal.x, this.exitPortal.y) <
      TILE * 1.4;
    this.nearShop = nearShop;
    this.nearExit = nearExit;

    let text = '';

    if (nearShop) text = 'E — Shop';
    else if (nearExit)
      text =
        this.monstersLeft === 0
          ? 'E — Escape to the next floor'
          : `Sealed — ${this.monstersLeft} demon${this.monstersLeft === 1 ? '' : 's'} still breathing`;
    else if (this.nearestDoorDistance() < TILE * 1.6)
      text = gameState.keys > 0 ? 'Walk into the door to unlock' : 'Locked — you need a full key';

    if (text) {
      this.prompt.setText(text).setPosition(this.player.x, this.player.y - 26).setVisible(true);
    } else {
      this.prompt.setVisible(false);
    }

  }

  private nearestDoorDistance(): number {
    let best = Infinity;
    for (const d of this.doors.getChildren() as DoorSprite[]) {
      best = Math.min(best, Phaser.Math.Distance.Between(d.x, d.y, this.player.x, this.player.y));
    }
    return best;
  }

  private openShop(): void {
    if (this.scene.isActive('Shop')) return;
    this.scene.pause();
    this.scene.launch('Shop', { returnTo: 'Dungeon' });
  }

  private escape(): void {
    if (this.transitioning) return;
    this.transitioning = true;

    const cleared = gameState.floor;
    gameState.floor += 1;
    gameState.deepestFloor = Math.max(gameState.deepestFloor, gameState.floor);
    // Escaping patches you up a little — enough to keep going, not enough to coast.
    gameState.hp = Math.min(gameState.maxHp, gameState.hp + Math.round(gameState.maxHp * 0.35));
    gameState.save();

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Every tenth floor has a chapter waiting; it starts the next floor itself.
      if (hasStoryAfter(cleared)) this.scene.start('Story', { afterFloor: cleared, next: 'Dungeon' });
      else this.scene.restart();
    });
  }

  private onDeath(): void {
    if (this.transitioning) return;
    this.transitioning = true;

    const lost = Math.round(gameState.coins * 0.2);
    gameState.coins -= lost;
    gameState.save();

    this.cameras.main.fadeOut(600, 40, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('Hud');
      this.scene.start('GameOver', { coinsLost: lost, floor: gameState.floor });
    });
  }

  /** Publishes boss health for the HUD, only when it actually moves. */
  private publishBoss(): void {
    const hp = this.boss?.active ? Math.max(0, Math.ceil(this.boss.hp)) : 0;
    if (this.registry.get('bossHp') !== hp) this.registry.set('bossHp', hp);
    const max = this.boss?.maxHp ?? 0;
    if (this.registry.get('bossMaxHp') !== max) this.registry.set('bossMaxHp', max);
    const name = this.boss?.stats.label ?? BOSS.name;
    if (this.registry.get('bossName') !== name) this.registry.set('bossName', name);
  }

  // --- feedback -----------------------------------------------------------

  private spark(x: number, y: number, tint: number, count: number): void {
    const emitter = this.add.particles(x, y, 'spark', {
      speed: { min: 40, max: 170 },
      lifespan: 380,
      quantity: count,
      scale: { start: 1, end: 0 },
      tint,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    emitter.setDepth(40);
    emitter.explode(count);
    this.time.delayedCall(500, () => emitter.destroy());
  }

  private floatText(x: number, y: number, message: string, color: string): void {
    const t = this.add
      .text(x, y, message, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color,
      })
      .setOrigin(0.5)
      .setDepth(210);
    this.tweens.add({
      targets: t,
      y: y - 30,
      alpha: { from: 1, to: 0 },
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /**
   * The HUD reads gameState directly, so only scene-local facts need publishing.
   * Registry values are shared across scenes and survive the HUD restarting.
   */
  private emitStats(): void {
    this.registry.set('monstersLeft', this.monstersLeft);
    this.registry.set('monstersTotal', this.dungeon.monsters.length);
    this.registry.set('fragmentsPerKey', KEYS.fragmentsPerKey);
  }
}
