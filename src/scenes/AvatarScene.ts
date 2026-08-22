import Phaser from 'phaser';
import { AVATARS, avatarTexture } from '../systems/avatars';
import { WORLD } from '../systems/config';
import { gameState } from '../systems/state';

const FONT = 'system-ui, sans-serif';
const COLS = 5;
const CELL_W = 108;
const CELL_H = 126;

interface Cell {
  id: string;
  bg: Phaser.GameObjects.Rectangle;
  sprite: Phaser.GameObjects.Image;
  worn: Phaser.GameObjects.Text;
}

/**
 * The wardrobe, opened from the Avatar row of the shop once it is bought. Modal over
 * a paused shop, exactly like the shop is modal over a paused dungeon.
 */
export class AvatarScene extends Phaser.Scene {
  private cells: Cell[] = [];
  private selected = 0;
  private returnTo = 'Shop';
  private nameText!: Phaser.GameObjects.Text;
  /** Stops the ENTER that opened this screen from instantly picking something. */
  private ready = false;

  constructor() {
    super('Avatar');
  }

  init(data: { returnTo?: string }): void {
    this.returnTo = data.returnTo ?? 'Shop';
    this.cells = [];
    this.selected = Math.max(
      0,
      AVATARS.findIndex((a) => a.id === gameState.avatar)
    );
    this.ready = false;
  }

  create(): void {
    const W = WORLD.viewWidth;
    const H = WORLD.viewHeight;

    this.add.rectangle(0, 0, W, H, 0x05040a, 0.9).setOrigin(0);
    const panelW = 640;
    const panelX = (W - panelW) / 2;
    this.add
      .rectangle(panelX, 26, panelW, H - 52, 0x16121f, 1)
      .setOrigin(0)
      .setStrokeStyle(1, 0x4a3f66);

    this.add
      .text(W / 2, 56, 'THE WARDROBE', {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffe9a8',
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 80, 'You can be anything.', {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#9c96ad',
      })
      .setOrigin(0.5);

    const rows = Math.ceil(AVATARS.length / COLS);
    const gridX = W / 2 - (COLS * CELL_W) / 2;
    const gridY = 106;

    AVATARS.forEach((avatar, i) => {
      const cx = gridX + (i % COLS) * CELL_W + CELL_W / 2;
      const cy = gridY + Math.floor(i / COLS) * CELL_H + CELL_H / 2;

      const bg = this.add.rectangle(cx, cy, CELL_W - 8, CELL_H - 8, 0x1e1a2b, 1);
      const sprite = this.add.image(cx, cy - 8, avatarTexture(avatar.id)).setScale(3);
      const worn = this.add
        .text(cx, cy + CELL_H / 2 - 18, 'WORN', {
          fontFamily: FONT,
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#4ade80',
        })
        .setOrigin(0.5)
        .setVisible(false);

      this.cells.push({ id: avatar.id, bg, sprite, worn });
    });

    this.nameText = this.add
      .text(W / 2, gridY + rows * CELL_H + 34, '', {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H - 34, '← → ↑ ↓ choose · ENTER wear · E / ESC back to the shop', {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#7d7a8c',
      })
      .setOrigin(0.5);

    this.bindInput();
    this.refresh();
    this.time.delayedCall(220, () => {
      this.ready = true;
    });
  }

  private bindInput(): void {
    const kb = this.input.keyboard!;
    const move = (delta: number) => {
      this.selected = (this.selected + delta + AVATARS.length) % AVATARS.length;
      this.refresh();
    };

    kb.on('keydown-LEFT', () => move(-1));
    kb.on('keydown-RIGHT', () => move(1));
    kb.on('keydown-UP', () => move(-COLS));
    kb.on('keydown-DOWN', () => move(COLS));
    kb.on('keydown-ENTER', () => this.wear());
    kb.on('keydown-SPACE', () => this.wear());
    kb.on('keydown-ESC', () => this.close());
    kb.on('keydown-E', () => this.close());
  }

  private wear(): void {
    if (!this.ready) return;
    const avatar = AVATARS[this.selected];
    if (gameState.setAvatar(avatar.id)) {
      this.cameras.main.flash(160, 120, 200, 255);
      const cell = this.cells[this.selected];
      this.tweens.add({
        targets: cell.sprite,
        scale: { from: 3.8, to: 3 },
        duration: 260,
        ease: 'Back.easeOut',
      });
    }
    this.refresh();
  }

  private refresh(): void {
    this.cells.forEach((cell, i) => {
      const active = i === this.selected;
      const worn = cell.id === gameState.avatar;
      cell.bg.setFillStyle(active ? 0x2f2743 : 0x1e1a2b, 1);
      cell.bg.setStrokeStyle(active ? 2 : 1, active ? 0xffd15c : worn ? 0x4ade80 : 0x342c47);
      cell.worn.setVisible(worn);
      cell.sprite.setAlpha(active || worn ? 1 : 0.75);
    });

    const avatar = AVATARS[this.selected];
    const worn = avatar.id === gameState.avatar;
    this.nameText
      .setText(worn ? `${avatar.name} — worn` : `${avatar.name} — ENTER to wear`)
      .setColor(worn ? '#4ade80' : '#ffe9a8');
  }

  private close(): void {
    if (!this.ready) return;
    gameState.save();
    this.input.keyboard!.removeAllListeners();
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
