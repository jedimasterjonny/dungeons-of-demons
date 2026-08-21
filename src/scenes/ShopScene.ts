import Phaser from 'phaser';
import { CURRENCY, WORLD } from '../systems/config';
import { UPGRADES, gameState, type Upgrade } from '../systems/state';

const FONT = 'system-ui, sans-serif';

interface Row {
  upgrade: Upgrade;
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  desc: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  pips: Phaser.GameObjects.Graphics;
}

/**
 * Modal overlay launched from the shop pad. The dungeon scene is paused behind it,
 * so this scene owns input entirely while it is up.
 */
export class ShopScene extends Phaser.Scene {
  private rows: Row[] = [];
  private selected = 0;
  private returnTo = 'Dungeon';
  private coinText!: Phaser.GameObjects.Text;
  private galaxyText!: Phaser.GameObjects.Text;
  private convertRow!: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
  private toast!: Phaser.GameObjects.Text;
  /** Guards against the same E keypress that opened the shop closing it again. */
  private ready = false;

  constructor() {
    super('Shop');
  }

  init(data: { returnTo?: string }): void {
    this.returnTo = data.returnTo ?? 'Dungeon';
    this.rows = [];
    this.selected = 0;
    this.ready = false;
  }

  create(): void {
    const W = WORLD.viewWidth;
    const H = WORLD.viewHeight;

    this.add.rectangle(0, 0, W, H, 0x05040a, 0.86).setOrigin(0);
    const panelW = 640;
    const panelX = (W - panelW) / 2;
    this.add.rectangle(panelX, 26, panelW, H - 52, 0x16121f, 1).setOrigin(0).setStrokeStyle(1, 0x4a3f66);

    this.add
      .text(W / 2, 48, 'THE BLACK MARKET', {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffe9a8',
      })
      .setOrigin(0.5);

    this.coinText = this.add
      .text(panelX + 22, 78, '', { fontFamily: FONT, fontSize: '13px', color: '#ffc93c' })
      .setOrigin(0, 0.5);
    this.galaxyText = this.add
      .text(panelX + panelW - 22, 78, '', {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#c8a2ff',
      })
      .setOrigin(1, 0.5);

    let y = 104;
    for (const upgrade of UPGRADES) {
      this.rows.push(this.buildRow(upgrade, panelX + 14, y, panelW - 28));
      y += 46;
    }

    // --- galaxy coin conversion, the one non-upgrade line in the shop
    const bg = this.add
      .rectangle(panelX + 14, y + 6, panelW - 28, 38, 0x241f2e, 1)
      .setOrigin(0)
      .setStrokeStyle(1, 0x6b4a9f);
    const label = this.add
      .text(panelX + 28, y + 25, '', { fontFamily: FONT, fontSize: '13px', color: '#c8a2ff' })
      .setOrigin(0, 0.5);
    this.convertRow = { bg, label };

    this.toast = this.add
      .text(W / 2, H - 52, '', { fontFamily: FONT, fontSize: '13px', color: '#ff8a8a' })
      .setOrigin(0.5)
      .setAlpha(0);

    this.add
      .text(W / 2, H - 34, '↑↓ select · ENTER buy · E / ESC leave', {
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

  private buildRow(upgrade: Upgrade, x: number, y: number, w: number): Row {
    const bg = this.add.rectangle(x, y, w, 40, 0x1e1a2b, 1).setOrigin(0);
    const name = this.add
      .text(x + 14, y + 13, upgrade.name, {
        fontFamily: FONT,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);
    const desc = this.add
      .text(x + 14, y + 29, '', { fontFamily: FONT, fontSize: '11px', color: '#9c96ad' })
      .setOrigin(0, 0.5);
    const cost = this.add
      .text(x + w - 14, y + 20, '', { fontFamily: FONT, fontSize: '13px', color: '#ffc93c' })
      .setOrigin(1, 0.5);
    const pips = this.add.graphics();
    return { upgrade, bg, name, desc, cost, pips };
  }

  private bindInput(): void {
    const kb = this.input.keyboard!;
    const total = () => this.rows.length + 1;

    kb.on('keydown-UP', () => {
      this.selected = (this.selected - 1 + total()) % total();
      this.refresh();
    });
    kb.on('keydown-DOWN', () => {
      this.selected = (this.selected + 1) % total();
      this.refresh();
    });
    kb.on('keydown-ENTER', () => this.confirm());
    kb.on('keydown-SPACE', () => this.confirm());
    kb.on('keydown-ESC', () => this.close());
    kb.on('keydown-E', () => this.close());
  }

  private confirm(): void {
    // The last row is the coin -> galaxy coin exchange, not an upgrade.
    if (this.selected === this.rows.length) {
      if (gameState.convertToGalaxyCoin()) {
        this.flash(`Forged 1 galaxy coin for ${CURRENCY.coinsPerGalaxyCoin.toLocaleString()} coins`, '#c8a2ff');
      } else {
        this.flash(
          `Need ${(CURRENCY.coinsPerGalaxyCoin - gameState.coins).toLocaleString()} more coins`,
          '#ff8a8a'
        );
      }
      this.refresh();
      return;
    }

    const row = this.rows[this.selected];
    const level = gameState.level(row.upgrade.id);

    if (level >= row.upgrade.maxLevel) {
      this.flash(`${row.upgrade.name} is fully upgraded`, '#9c96ad');
    } else if (gameState.buy(row.upgrade)) {
      this.flash(`${row.upgrade.name} → level ${gameState.level(row.upgrade.id)}`, '#4ade80');
      this.cameras.main.flash(140, 80, 200, 120);
    } else {
      const cost = gameState.costOf(row.upgrade);
      this.flash(
        row.upgrade.tier === 'coin'
          ? `Need ${(cost - gameState.coins).toLocaleString()} more coins`
          : `Need ${cost - gameState.galaxyCoins} more galaxy coin${cost - gameState.galaxyCoins === 1 ? '' : 's'}`,
        '#ff8a8a'
      );
    }
    this.refresh();
  }

  private flash(message: string, color: string): void {
    this.toast.setText(message).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1100, duration: 400 });
  }

  private refresh(): void {
    this.coinText.setText(`${gameState.coins.toLocaleString()} coins`);
    this.galaxyText.setText(`◈ ${gameState.galaxyCoins} galaxy`);

    this.rows.forEach((row, i) => {
      const { upgrade } = row;
      const level = gameState.level(upgrade.id);
      const maxed = level >= upgrade.maxLevel;
      const active = i === this.selected;
      const affordable = gameState.canAfford(upgrade);

      row.bg.setFillStyle(active ? 0x2f2743 : 0x1e1a2b, 1);
      row.bg.setStrokeStyle(active ? 2 : 1, active ? 0xffd15c : 0x342c47);
      row.name.setColor(maxed ? '#7d7a8c' : '#ffffff');
      row.desc.setText(maxed ? 'Maxed out' : upgrade.describe(level));

      const cost = upgrade.cost(level);
      row.cost.setText(
        maxed ? '—' : upgrade.tier === 'coin' ? `${cost.toLocaleString()}` : `◈ ${cost}`
      );
      row.cost.setColor(maxed ? '#4a4658' : affordable ? (upgrade.tier === 'coin' ? '#ffc93c' : '#c8a2ff') : '#6b5a5a');

      // Level pips sit just left of the cost.
      row.pips.clear();
      const px = row.cost.x - row.cost.width - 16;
      for (let l = 0; l < upgrade.maxLevel; l++) {
        const filled = l < level;
        row.pips
          .fillStyle(filled ? (upgrade.tier === 'coin' ? 0xffc93c : 0xc8a2ff) : 0xffffff, filled ? 1 : 0.14)
          .fillRect(px - (upgrade.maxLevel - l) * 7, row.bg.y + 17, 4, 7);
      }
    });

    const convertActive = this.selected === this.rows.length;
    const can = gameState.canConvert();
    this.convertRow.bg.setFillStyle(convertActive ? 0x2f2743 : 0x241f2e, 1);
    this.convertRow.bg.setStrokeStyle(convertActive ? 2 : 1, convertActive ? 0xffd15c : 0x6b4a9f);
    this.convertRow.label
      .setText(
        `Forge a galaxy coin  —  ${CURRENCY.coinsPerGalaxyCoin.toLocaleString()} coins  →  ◈ 1` +
          (can ? '' : `   (${Math.round(gameState.galaxyProgress * 100)}% of the way there)`)
      )
      .setColor(can ? '#c8a2ff' : '#7d6a9c');
  }

  private close(): void {
    if (!this.ready) return;
    gameState.save();
    this.input.keyboard!.removeAllListeners();
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
