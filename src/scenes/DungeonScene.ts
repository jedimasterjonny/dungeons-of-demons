import Phaser from 'phaser';
import { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { isInSwingArc } from '../systems/combat';
import { BOSS, COOP, CRATES, DARKNESS, PLANET, KEYS, PLAYER, SCREECH, TILE, WORLD } from '../systems/config';
import {
  TileType,
  generateDungeon,
  isCrateTile,
  isDarkFloor,
  isPlanetFloor,
  tileToWorld,
  worldToTile,
  type DungeonData,
} from '../systems/dungeon';
import { gameState, type PlayerState } from '../systems/state';
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
  /** One per person playing. Index 0 is player one; the array is the whole party. */
  players: Player[] = [];
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
  /** One per player who owns a pair — it rides along on their head. */
  private playerMuffs = new Map<Player, Phaser.GameObjects.Sprite>();
  /** The coloured ring under each player's feet. Co-op only. */
  private footRings = new Map<Player, Phaser.GameObjects.Image>();
  /**
   * What the camera actually follows. With two players it sits at their midpoint,
   * because a camera cannot follow two things at once.
   */
  private camAnchor!: Phaser.GameObjects.Zone;

  /** Set on dark floors only. Undefined everywhere else, which is what turns it off. */
  private dark?: {
    /** Full black. Only ever erased, so the trail you walk stays open for good. */
    seen: Phaser.GameObjects.RenderTexture;
    /** Thinner black, refilled every frame, with the hole that follows you. */
    near: Phaser.GameObjects.RenderTexture;
    /**
     * The same surface as `near`, typed as what it actually is. The RenderTexture
     * wrapper only exposes a whole-sheet clear(); clearing a sub-rectangle is what
     * keeps the per-frame repaint cheap, and only DynamicTexture offers it.
     */
    nearTex: Phaser.Textures.DynamicTexture;
    /** Off the display list: it exists only to be erased with. */
    brush: Phaser.GameObjects.Image;
    /** Where the trail was last stamped, so standing still stops eating the edge. */
    lastStamp: Phaser.Math.Vector2[];
    /** Per player, the box their hole was punched in last frame, to fill back in. */
    lit: Phaser.Geom.Rectangle[];
  };

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  /** Player two: arrows to move, ENTER to swing, SHIFT to drop a crate. */
  private keyEnter!: Phaser.Input.Keyboard.Key;

  private prompt!: Phaser.GameObjects.Text;
  /** The rescue bar drawn over a fallen player. Redrawn from scratch every frame. */
  private rescueUi!: Phaser.GameObjects.Graphics;
  private monstersLeft = 0;
  private transitioning = false;
  /** Recomputed each frame; the E handler acts on whatever is currently in reach. */
  private nearShop = false;
  private nearExit = false;
  /** Whichever player is standing on the thing E would act on. */
  private interactor?: Player;

  constructor() {
    super('Dungeon');
  }

  create(): void {
    this.transitioning = false;
    // A new floor starts with clear ears, a full stack of crates and everybody back
    // on their feet, whatever the last one did to you. The Star Sword belongs to the
    // planet and is picked up there, never carried in.
    for (const p of gameState.players) p.refreshForFloor();
    this.playerMuffs.clear();
    this.footRings.clear();
    // The scene object is reused floor to floor, so last floor's darkness would
    // otherwise linger as a handle to render textures this floor has already destroyed.
    this.dark = undefined;
    this.dungeon = generateDungeon(gameState.floor);

    const worldW = WORLD.cols * TILE;
    const worldH = WORLD.rows * TILE;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor(0x0a0a0f);

    this.buildTiles(worldW, worldH);
    this.spawnEntities();
    this.bindInput();
    // After spawnEntities: the first stamp needs the player to already exist.
    if (isDarkFloor(gameState.floor)) this.buildDarkness(worldW, worldH);

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

    // Above the world and the darkness, below the prompt.
    this.rescueUi = this.add.graphics().setDepth(199);

    // An invisible point rather than a player: in co-op it tracks the midpoint of
    // the party, and following it keeps the existing smoothing for free.
    this.camAnchor = this.add.zone(this.players[0].x, this.players[0].y, 1, 1);
    this.cameras.main.startFollow(this.camAnchor, true, 0.12, 0.12);
    this.cameras.main.setZoom(1);
    this.trackCamera(1);
    this.cameras.main.fadeIn(350, 0, 0, 0);

    this.scene.launch('Hud');
    this.emitStats();

    this.events.on('screech', this.onScreech, this);
    // You may have changed your look in the shop's wardrobe while we were paused.
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);

    this.events.on('revenant', (who: Player) => {
      this.cameras.main.flash(400, 255, 210, 90);
      this.floatText(who.x, who.y - 30, 'REVENANT!', '#ffd15c');
    });

    this.events.on('downed', (who: Player) => {
      this.cameras.main.shake(280, 0.01);
      this.floatText(who.x, who.y - 30, 'DOWN! — stand over them to help', '#ff8a8a');
    });

    // The HUD is a separate scene; make sure it dies with this one.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop('Hud');
      this.events.off('revenant');
      this.events.off('downed');
      this.events.off('screech', this.onScreech, this);
      this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
      this.input.keyboard?.off('keydown-E', this.onInteract, this);
      this.input.keyboard?.off('keydown-Q', this.onDropCrateOne, this);
      this.input.keyboard?.off('keydown-SHIFT', this.onDropCrateTwo, this);
    });
  }

  private onResume(): void {
    // You may have changed your look in the wardrobe while we were paused.
    for (const p of this.players) p.refreshAvatar();
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

  /**
   * Two sheets of black over the whole floor.
   *
   * `seen` is opaque and is only ever erased, so every step burns a permanent hole
   * in it — that is the map you build by walking. `near` is thinner, wiped and
   * refilled every frame, and carries the hole that travels with you. Ground you
   * have never reached shows both (black), ground you remember shows only `near`
   * (dim), and ground you are standing on shows neither.
   *
   * Both sit above the world and below the prompt at depth 200, so text stays
   * readable in the dark.
   */
  private buildDarkness(worldW: number, worldH: number): void {
    const seen = this.add.renderTexture(0, 0, worldW, worldH).setOrigin(0).setDepth(100);
    seen.fill(0x000000, 1);

    const near = this.add.renderTexture(0, 0, worldW, worldH).setOrigin(0).setDepth(101);

    // make(), not add(): a brush that rendered normally would be a white blob
    // following the player around.
    const brush = this.make.image({ key: 'light' }, false).setOrigin(0.5);

    this.dark = {
      seen,
      near,
      nearTex: near.texture as Phaser.Textures.DynamicTexture,
      brush,
      lastStamp: this.players.map(() => new Phaser.Math.Vector2(Infinity, Infinity)),
      lit: this.players.map((p) => new Phaser.Geom.Rectangle(p.x, p.y, 0, 0)),
    };
    this.paintDarkness();
  }

  /** Points the shared brush at one glow profile and erases it out of one sheet. */
  private eraseLight(
    target: Phaser.GameObjects.RenderTexture,
    key: 'light' | 'lighttrail',
    radius: number,
    x: number,
    y: number
  ): void {
    const brush = this.dark!.brush;
    const size = this.textures.get(key).getSourceImage().width;
    brush.setTexture(key).setPosition(x, y).setScale((radius * 2) / size);
    target.erase(brush);
  }

  private paintDarkness(): void {
    if (!this.dark) return;
    const { seen, near, nearTex, lastStamp, lit } = this.dark;
    const r = DARKNESS.lightRadius;

    this.players.forEach((player, i) => {
      // Erasing is subtractive, so re-stamping the same spot every frame would keep
      // eating into the soft rim until the trail was as wide as the whole brush.
      // Only stamping once you have actually moved keeps the trail a fixed width.
      const last = lastStamp[i];
      if (Phaser.Math.Distance.Between(last.x, last.y, player.x, player.y) >= DARKNESS.stampDistance) {
        this.eraseLight(seen, 'lighttrail', DARKNESS.memoryRadius, player.x, player.y);
        last.set(player.x, player.y);
      }
    });

    // Only the box a light can reach is repainted, unioned with the box it reached
    // last frame so the hole punched then gets filled back in behind it. Redoing the
    // whole 1920x1408 sheet every frame instead costs about two thirds of the frame
    // rate. Two players get a box each rather than one box around both: apart, a
    // single box spanning them would cover most of the floor and cost the same.
    //
    // Every fill happens before any erase, because one player's fill box can overlap
    // the other's light and would otherwise paint their hole black again.
    const boxes = this.players.map((player, i) => {
      const was = lit[i];
      const box = new Phaser.Geom.Rectangle();
      box.x = Math.max(0, Math.min(player.x - r, was.x));
      box.y = Math.max(0, Math.min(player.y - r, was.y));
      box.width = Math.min(near.width, Math.max(player.x + r, was.right)) - box.x;
      box.height = Math.min(near.height, Math.max(player.y + r, was.bottom)) - box.y;
      was.setTo(player.x - r, player.y - r, r * 2, r * 2);
      return box;
    });

    for (const box of boxes) {
      // clear() first: fill() blends, so filling a region twice would darken it.
      nearTex.clear(box.x, box.y, box.width, box.height);
      nearTex.fill(0x000000, DARKNESS.memoryDarkness, box.x, box.y, box.width, box.height);
    }
    for (const player of this.players) {
      this.eraseLight(near, 'light', r, player.x, player.y);
    }
  }

  private spawnEntities(): void {
    const start = this.dungeon.playerStart;
    this.players = gameState.players.map((sheet, i) => {
      // Player two lands one tile to the side. The start tile is always floor and
      // rooms are never one tile wide, so there is room; if the neighbour happened
      // to be rock, the collider simply pushes them back out onto the start tile.
      const p = new Player(this, tileToWorld(start.x + (i === 0 ? 0 : 1)), tileToWorld(start.y), sheet);
      // A coloured ring under the feet, so two people wearing the same avatar are
      // still tellable apart at a glance. Only in co-op — on your own it is clutter.
      if (gameState.isCoop) {
        this.footRings.set(
          p,
          this.add
            .image(p.x, p.y + 11, 'footring')
            .setTint(i === 0 ? COOP.playerOneTint : COOP.playerTwoTint)
            .setDepth(3)
        );
      }
      if (sheet.blocksScreech) {
        this.playerMuffs.set(p, this.add.sprite(p.x, p.y - 9, 'earmuffs').setScale(0.85));
      }
      return p;
    });

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

    this.physics.add.collider(this.monsters, this.walls);
    this.physics.add.collider(this.monsters, this.monsters);
    this.physics.add.collider(this.monsters, this.doors);

    for (const player of this.players) {
      this.physics.add.collider(player, this.walls);
      this.physics.add.collider(player, this.crates);
      this.physics.add.collider(player, this.doors, undefined, () => {
        this.tryUnlockNearestDoor(player);
        return true;
      });
    }
    // Demons chew through what blocks them. The callback runs every frame of
    // contact, so the damage is dealt per second rather than per touch.
    this.physics.add.collider(this.monsters, this.crates, (m, c) => {
      const dt = this.game.loop.delta / 1000;
      this.damageCrate(c as CrateSprite, (m as Monster).damage * CRATES.chewRate * dt);
    });

    for (const player of this.players) {
      this.physics.add.overlap(player, this.monsters, (_p, m) => {
        const monster = m as Monster;
        // You can only be downed while somebody else is still up to come for you.
        // Alone, running out of health is simply death.
        const rescuerLeft = this.players.some((o) => o !== player && o.sheet.isPlaying);
        if (player.takeDamage(monster.damage, monster.x, monster.y, rescuerLeft)) {
          this.cameras.main.shake(120, 0.006);
          this.emitStats();
          if (gameState.living.length === 0) this.onDeath();
        }
      });

      this.physics.add.overlap(player, this.pickups, (_p, item) => {
        this.collect(item as Phaser.Physics.Arcade.Sprite, player);
      });

      this.physics.add.overlap(player, this.chests, (_p, c) => {
        this.openChest(c as Phaser.Physics.Arcade.Sprite, player);
      });
    }

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
      for (const player of this.players) {
        this.physics.add.overlap(player, this.sword, () => this.takeSword(player));
      }
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
    this.keyEnter = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    // Interact is event-driven rather than polled: a JustDown check only sees the
    // key if a frame happens to land while it is held, so a quick tap can vanish.
    kb.on('keydown-E', this.onInteract, this);
    kb.on('keydown-Q', this.onDropCrateOne, this);
    kb.on('keydown-SHIFT', this.onDropCrateTwo, this);
  }

  private onDropCrateOne(): void {
    this.onDropCrate(this.players[0]);
  }

  /** Only ever does anything in co-op, where there is a player two to drop it. */
  private onDropCrateTwo(): void {
    if (this.players[1]) this.onDropCrate(this.players[1]);
  }

  private onInteract(): void {
    if (this.transitioning) return;
    if (this.nearShop) this.openShop();
    else if (this.nearExit && this.monstersLeft === 0) this.escape();
  }

  /** Which player E is acting for — whoever is standing on the pad or the portal. */
  private get shopper(): PlayerState {
    return (this.interactor ?? this.players[0]).sheet;
  }

  /** Drops a crate on the tile you are facing, if that tile is free. */
  private onDropCrate(player: Player): void {
    if (this.transitioning || player.isDowned) return;

    if (player.sheet.crates <= 0) {
      this.floatText(player.x, player.y - 30, 'NO CRATES LEFT', '#ff8a8a');
      return;
    }

    const tx = worldToTile(player.x + Math.cos(player.facing) * TILE);
    const ty = worldToTile(player.y + Math.sin(player.facing) * TILE);
    const wx = tileToWorld(tx);
    const wy = tileToWorld(ty);

    const blocked =
      !isCrateTile(this.dungeon.grid, tx, ty) ||
      // Never drop one on anybody's feet — they would be shoved out of it.
      this.players.some((o) => Phaser.Math.Distance.Between(o.x, o.y, wx, wy) < TILE * 0.75) ||
      (this.crates.getChildren() as CrateSprite[]).some((c) => c.x === wx && c.y === wy) ||
      (this.chests.getChildren() as Phaser.Physics.Arcade.Sprite[]).some(
        (c) => Phaser.Math.Distance.Between(c.x, c.y, wx, wy) < TILE * 0.75
      ) ||
      (this.monsters.getChildren() as Monster[]).some(
        (m) => Phaser.Math.Distance.Between(m.x, m.y, wx, wy) < m.stats.radius + TILE / 2
      );

    if (blocked) {
      this.floatText(player.x, player.y - 30, 'NO ROOM', '#ff8a8a');
      return;
    }

    player.sheet.crates -= 1;
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

    this.players.forEach((player, i) => {
      player.move(this.readDirection(i));
      player.tick(dt);
      // Held rather than tapped: the swing cooldown already paces it.
      if (this.attackHeld(i) && player.canAttack) this.swing(player);

      const muffs = this.playerMuffs.get(player);
      if (muffs) {
        // Sit just in front so they never disappear behind their own hood.
        muffs.setPosition(player.x, player.y - 9).setDepth(player.depth + 0.001);
      }

      // Just behind the feet, so it reads as standing on the ring rather than in it.
      this.footRings.get(player)?.setPosition(player.x, player.y + 11);
    });

    for (const m of this.monsters.getChildren() as Monster[]) {
      m.tick(dt, this.threatTarget(m));
    }

    this.tickRescues(dt);
    this.trackCamera(dt);
    this.paintDarkness();
    this.publishBoss();
    this.updatePrompts();
    this.homePickups(dt);
  }

  /**
   * Player one is WASD and player two is the arrows — but on your own both sets
   * drive you, exactly as they did before there was a player two.
   */
  private readDirection(index: number): Phaser.Math.Vector2 {
    const wasd = new Phaser.Math.Vector2(
      (this.keyD.isDown ? 1 : 0) - (this.keyA.isDown ? 1 : 0),
      (this.keyS.isDown ? 1 : 0) - (this.keyW.isDown ? 1 : 0)
    );
    const arrows = new Phaser.Math.Vector2(
      (this.cursors.right.isDown ? 1 : 0) - (this.cursors.left.isDown ? 1 : 0),
      (this.cursors.down.isDown ? 1 : 0) - (this.cursors.up.isDown ? 1 : 0)
    );
    if (this.players.length < 2) return wasd.lengthSq() > 0 ? wasd : arrows;
    return index === 0 ? wasd : arrows;
  }

  private attackHeld(index: number): boolean {
    if (this.players.length < 2) return this.keySpace.isDown;
    return index === 0 ? this.keySpace.isDown : this.keyEnter.isDown;
  }

  /**
   * Who a demon goes for: the nearest player still on their feet. A downed player
   * stops being a target, so demons leave a body alone and turn on the rescuer —
   * which is what makes a rescue a decision rather than a formality.
   */
  private threatTarget(m: Monster): Phaser.Math.Vector2 {
    let best = this.players[0];
    let bestDist = Infinity;
    for (const p of this.players) {
      if (!p.sheet.isPlaying) continue;
      const d = Phaser.Math.Distance.Between(m.x, m.y, p.x, p.y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return new Phaser.Math.Vector2(best.x, best.y);
  }

  /**
   * Standing over a fallen player brings them back. Step away and the progress is
   * lost, so it has to be three uninterrupted seconds with the demons still coming.
   */
  private tickRescues(dt: number): void {
    this.rescueUi.clear();
    if (this.players.length < 2) return;

    for (const fallen of this.players) {
      if (!fallen.isDowned) continue;

      const helper = this.players.find(
        (o) =>
          o !== fallen &&
          o.sheet.isPlaying &&
          Phaser.Math.Distance.Between(o.x, o.y, fallen.x, fallen.y) <= COOP.rescueRange
      );

      if (!helper) {
        fallen.sheet.rescueProgress = 0;
      } else {
        fallen.sheet.rescueProgress += dt;
        if (fallen.sheet.rescueProgress >= COOP.rescueTime) {
          fallen.revive();
          this.spark(fallen.x, fallen.y, 0x8affc9, 22);
          this.cameras.main.flash(260, 120, 255, 190);
          this.floatText(fallen.x, fallen.y - 30, 'BACK UP!', '#8affc9');
          this.emitStats();
          continue;
        }
      }

      // A bar over the body: the only way to know how much longer to stand there.
      const pct = Phaser.Math.Clamp(fallen.sheet.rescueProgress / COOP.rescueTime, 0, 1);
      const w = 42;
      this.rescueUi
        .fillStyle(0x000000, 0.7)
        .fillRoundedRect(fallen.x - w / 2, fallen.y - 30, w, 7, 3)
        .fillStyle(helper ? 0x8affc9 : 0x6b6478, 1)
        .fillRoundedRect(fallen.x - w / 2 + 1, fallen.y - 29, Math.max(2, (w - 2) * pct), 5, 2);
    }
  }

  /**
   * With one player the camera simply follows them. With two it sits at the midpoint
   * and pulls back far enough to hold both — down to COOP.minZoom, past which they
   * are left to separate rather than shrinking the game to nothing.
   */
  private trackCamera(dt: number): void {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    // Downed players count: the camera must never leave a body off screen, because
    // walking back to it is the whole rescue.
    for (const p of this.players) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    this.camAnchor.setPosition((minX + maxX) / 2, (minY + maxY) / 2);
    if (this.players.length < 2) return;

    const margin = 240;
    const want = Phaser.Math.Clamp(
      Math.min(WORLD.viewWidth / (maxX - minX + margin), WORLD.viewHeight / (maxY - minY + margin)),
      COOP.minZoom,
      1
    );
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Linear(cam.zoom, want, Math.min(1, dt * 3.5)));
  }

  private swing(player: Player): void {
    const angle = player.beginSwing();
    const star = player.sheet.hasStarSword;

    const arc = this.add
      .sprite(player.x + Math.cos(angle) * 14, player.y + Math.sin(angle) * 14, 'swing')
      .setRotation(angle)
      .setDepth(30)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(star ? 0.95 : 0.7)
      .setTint(star ? 0xfff6cf : 0xffffff);
    this.tweens.add({
      targets: arc,
      alpha: { from: 0.9, to: 0 },
      scale: star ? 1.25 : 0.95,
      duration: 160,
      onComplete: () => arc.destroy(),
    });

    const maxArc = Phaser.Math.DegToRad(PLAYER.attackArc);
    let hitAny = false;

    for (const m of [...(this.monsters.getChildren() as Monster[])]) {
      if (!m.active) continue;
      if (!isInSwingArc(player, angle, m, m.stats.radius, PLAYER.attackRange, maxArc)) continue;

      const toMonster = Math.atan2(m.y - player.y, m.x - player.x);
      hitAny = true;
      const killed = m.takeDamage(player.sheet.damage, toMonster);
      this.spark(m.x, m.y, 0xffffff, 6);
      if (killed) this.killMonster(m, player);
    }

    // Your own crates are in the way of your own sword — that is the way out of a
    // box you have walled yourself into.
    for (const c of [...(this.crates.getChildren() as CrateSprite[])]) {
      if (!c.active) continue;
      if (!isInSwingArc(player, angle, c, TILE / 2, PLAYER.attackRange, maxArc)) continue;
      hitAny = true;
      this.spark(c.x, c.y, 0xa87a37, 4);
      this.damageCrate(c, player.sheet.damage);
    }

    if (hitAny) this.cameras.main.shake(80, 0.003);
  }

  private killMonster(m: Monster, by: Player): void {
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
    for (let i = 0; i < by.sheet.fragmentsPerKill; i++) {
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
  private takeSword(player: Player): void {
    // One sword, and it goes to whoever got there first.
    if (!this.sword?.active || gameState.players.some((p) => p.hasStarSword)) return;

    player.sheet.hasStarSword = true;
    const { x, y } = this.sword;
    this.sword.destroy();
    this.sword = undefined;

    this.cameras.main.flash(500, 255, 246, 207);
    this.spark(x, y, 0xfff6cf, 26);
    this.floatText(x, y - 24, PLANET.swordName.toUpperCase(), '#fff6cf');
    this.floatText(player.x, player.y - 40, `SWING ${PLANET.swordDamage}`, '#ffd15c');
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

    // Each player's own ears decide: one pair of earmuffs never covers two heads,
    // and standing out of earshot is its own answer.
    let landedOnAnyone = false;
    for (const player of this.players) {
      if (!player.sheet.isPlaying) continue;
      if (Phaser.Math.Distance.Between(m.x, m.y, player.x, player.y) > SCREECH.range) continue;

      if (player.sheet.blocksScreech) {
        this.floatText(player.x, player.y - 30, 'MUFFLED', '#ff9ecb');
        this.spark(player.x, player.y - 9, 0xff9ecb, 8);
        continue;
      }

      landedOnAnyone = true;
      player.sheet.screechTimer = SCREECH.duration;
      this.floatText(
        player.x,
        player.y - 30,
        `ATTACK -${Math.round(SCREECH.attackReduction * 100)}%`,
        '#ff8a8a'
      );
    }

    if (landedOnAnyone) this.cameras.main.shake(200, 0.004);
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

      // Nearest player still on their feet: loot should not chase a body.
      let target: Player | undefined;
      let best = Infinity;
      for (const player of this.players) {
        if (!player.sheet.isPlaying) continue;
        const d = Phaser.Math.Distance.Between(item.x, item.y, player.x, player.y);
        if (d < best) {
          best = d;
          target = player;
        }
      }

      if (target && best < 190) {
        const a = Math.atan2(target.y - item.y, target.x - item.x);
        const pull = Phaser.Math.Linear(520, 180, Math.min(1, best / 190));
        item.body!.velocity.set(Math.cos(a) * pull, Math.sin(a) * pull);
      }
    }
  }

  private collect(item: Phaser.Physics.Arcade.Sprite, by: Player): void {
    if (!item.active || by.isDowned) return;
    const coins = item.getData('coins') as number | undefined;
    const fragment = item.getData('fragment') as boolean | undefined;

    if (coins) {
      // The pot is shared, but it is the collector's own MORE! that swells it.
      gameState.addCoins(coins, by.sheet);
      this.floatText(item.x, item.y, `+${Math.round(coins * by.sheet.coinMultiplier)}`, '#ffc93c');
    }
    if (fragment) {
      const { keysGained } = gameState.addFragments(1);
      if (keysGained > 0) {
        gameState.keys += keysGained;
        this.floatText(by.x, by.y - 34, 'KEY FORGED', '#ffd15c');
        this.cameras.main.flash(180, 255, 209, 92);
      }
    }
    item.destroy();
    this.emitStats();
  }

  private openChest(chest: Phaser.Physics.Arcade.Sprite, by: Player): void {
    if (chest.getData('opened') || by.isDowned) return;
    chest.setData('opened', true);

    const loot = Phaser.Math.Between(180, 340) * (1 + 0.15 * (gameState.floor - 1));
    gameState.addCoins(loot, by.sheet);
    this.floatText(chest.x, chest.y - 16, `+${Math.round(loot * by.sheet.coinMultiplier)} coins`, '#ffc93c');
    this.spark(chest.x, chest.y, 0xffc93c, 16);

    by.heal(Math.round(by.maxHp * 0.25));
    this.floatText(chest.x, chest.y - 34, '+25% HP', '#4ade80');

    this.tweens.add({ targets: chest, alpha: 0.35, duration: 250 });
    chest.body!.enable = false;
    this.emitStats();
  }

  // --- doors, shop, exit --------------------------------------------------

  private tryUnlockNearestDoor(by: Player): void {
    if (gameState.keys <= 0 || by.isDowned) return;

    let nearest: DoorSprite | null = null;
    let best = Infinity;
    for (const d of this.doors.getChildren() as DoorSprite[]) {
      const dist = Phaser.Math.Distance.Between(d.x, d.y, by.x, by.y);
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
    // In co-op either player can be the one standing on the pad, so the prompt is
    // anchored to whoever is actually in reach rather than to player one.
    const near = (target: Phaser.GameObjects.Sprite, within: number) =>
      this.players.find(
        (p) => p.sheet.isPlaying && Phaser.Math.Distance.Between(p.x, p.y, target.x, target.y) < within
      );

    const atShop = near(this.shopPad, TILE * 1.3);
    const atExit = near(this.exitPortal, TILE * 1.4);
    this.nearShop = atShop !== undefined;
    this.nearExit = atExit !== undefined;
    this.interactor = atShop ?? atExit;

    let text = '';
    let anchor = atShop ?? atExit;

    if (atShop) text = 'E — Shop';
    else if (atExit)
      text =
        this.monstersLeft === 0
          ? 'E — Escape to the next floor'
          : `Sealed — ${this.monstersLeft} demon${this.monstersLeft === 1 ? '' : 's'} still breathing`;
    else {
      const atDoor = this.nearestDoorTo();
      if (atDoor) {
        anchor = atDoor;
        text = gameState.keys > 0 ? 'Walk into the door to unlock' : 'Locked — you need a full key';
      }
    }

    if (text && anchor) {
      this.prompt.setText(text).setPosition(anchor.x, anchor.y - 26).setVisible(true);
    } else {
      this.prompt.setVisible(false);
    }
  }

  /** The player standing next to a locked door, if anybody is. */
  private nearestDoorTo(): Player | undefined {
    for (const player of this.players) {
      if (!player.sheet.isPlaying) continue;
      for (const d of this.doors.getChildren() as DoorSprite[]) {
        if (Phaser.Math.Distance.Between(d.x, d.y, player.x, player.y) < TILE * 1.6) return player;
      }
    }
    return undefined;
  }

  private openShop(): void {
    if (this.scene.isActive('Shop')) return;
    this.scene.pause();
    // The party's coins, but the upgrade goes to whoever walked onto the pad.
    this.scene.launch('Shop', { returnTo: 'Dungeon', buyerIndex: this.shopper.index });
  }

  private escape(): void {
    if (this.transitioning) return;
    this.transitioning = true;

    const cleared = gameState.floor;
    gameState.floor += 1;
    gameState.deepestFloor = Math.max(gameState.deepestFloor, gameState.floor);
    // Escaping patches you up a little — enough to keep going, not enough to coast.
    // A player who was down when the floor ended is picked back up by leaving it.
    for (const p of gameState.players) {
      p.downed = false;
      p.rescueProgress = 0;
      p.hp = Math.min(p.maxHp, Math.max(p.hp, 1) + Math.round(p.maxHp * 0.35));
    }
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
