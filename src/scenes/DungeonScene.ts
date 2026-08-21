import Phaser from 'phaser';
import { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { isInSwingArc } from '../systems/combat';
import { KEYS, PLAYER, TILE, WORLD } from '../systems/config';
import {
  TileType,
  generateDungeon,
  tileToWorld,
  type DungeonData,
} from '../systems/dungeon';
import { gameState } from '../systems/state';

interface DoorSprite extends Phaser.Physics.Arcade.Sprite {
  tileX: number;
  tileY: number;
}

export class DungeonScene extends Phaser.Scene {
  private dungeon!: DungeonData;
  player!: Player;
  private monsters!: Phaser.Physics.Arcade.Group;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private doors!: Phaser.Physics.Arcade.StaticGroup;
  private pickups!: Phaser.Physics.Arcade.Group;
  private chests!: Phaser.Physics.Arcade.StaticGroup;
  private exitPortal!: Phaser.GameObjects.Sprite;
  private shopPad!: Phaser.GameObjects.Sprite;

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

    this.events.on('revenant', () => {
      this.cameras.main.flash(400, 255, 210, 90);
      this.floatText(this.player.x, this.player.y - 30, 'REVENANT!', '#ffd15c');
    });

    // The HUD is a separate scene; make sure it dies with this one.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop('Hud');
      this.events.off('revenant');
      this.input.keyboard?.off('keydown-E', this.onInteract, this);
    });
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

  private spawnEntities(): void {
    const start = this.dungeon.playerStart;
    this.player = new Player(this, tileToWorld(start.x), tileToWorld(start.y));

    this.monsters = this.physics.add.group({ runChildUpdate: false });
    for (const m of this.dungeon.monsters) {
      this.monsters.add(new Monster(this, tileToWorld(m.x), tileToWorld(m.y), m.kind, gameState.floor));
    }
    this.monstersLeft = this.monsters.getLength();

    this.pickups = this.physics.add.group();

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
  }

  private onInteract(): void {
    if (this.transitioning) return;
    if (this.nearShop) this.openShop();
    else if (this.nearExit && this.monstersLeft === 0) this.escape();
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
      .setScale(0.7);
    this.tweens.add({
      targets: arc,
      alpha: { from: 0.9, to: 0 },
      scale: 0.95,
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

    if (hitAny) this.cameras.main.shake(80, 0.003);
  }

  private killMonster(m: Monster): void {
    const { x, y } = m;
    const coins = m.coinValue;
    m.destroy();
    this.monstersLeft = this.monsters.getLength();

    this.spark(x, y, m.stats.tint, 14);

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

    gameState.floor += 1;
    gameState.deepestFloor = Math.max(gameState.deepestFloor, gameState.floor);
    // Escaping patches you up a little — enough to keep going, not enough to coast.
    gameState.hp = Math.min(gameState.maxHp, gameState.hp + Math.round(gameState.maxHp * 0.35));
    gameState.save();

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart();
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
