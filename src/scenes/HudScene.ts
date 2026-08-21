import Phaser from 'phaser';
import { WORLD } from '../systems/config';
import { gameState } from '../systems/state';

const FONT = 'system-ui, sans-serif';

/** Overlay scene drawn on top of the dungeon. Reads shared state every frame. */
export class HudScene extends Phaser.Scene {
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private monsterText!: Phaser.GameObjects.Text;
  private keyText!: Phaser.GameObjects.Text;
  private fragPips!: Phaser.GameObjects.Graphics;
  private coinText!: Phaser.GameObjects.Text;
  private galaxyText!: Phaser.GameObjects.Text;
  private galaxyBar!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'Hud', active: false });
  }

  create(): void {
    const W = WORLD.viewWidth;

    this.add.rectangle(0, 0, W, 62, 0x000000, 0.55).setOrigin(0);
    this.add.rectangle(0, 62, W, 1, 0xffffff, 0.12).setOrigin(0);

    // --- health
    this.hpBar = this.add.graphics();
    this.hpText = this.add
      .text(16, 30, '', { fontFamily: FONT, fontSize: '12px', color: '#ffffff' })
      .setOrigin(0, 0.5);

    // --- keys and fragments
    this.add.image(238, 22, 'key').setScale(0.9);
    this.keyText = this.add
      .text(256, 22, '0', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#ffd15c' })
      .setOrigin(0, 0.5);
    this.fragPips = this.add.graphics();

    // --- floor and demons remaining
    this.floorText = this.add
      .text(W / 2, 16, '', {
        fontFamily: FONT,
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0);
    this.monsterText = this.add
      .text(W / 2, 38, '', { fontFamily: FONT, fontSize: '12px', color: '#ff8a8a' })
      .setOrigin(0.5, 0);

    // --- currency
    this.add.image(W - 178, 18, 'coin');
    this.coinText = this.add
      .text(W - 166, 18, '0', { fontFamily: FONT, fontSize: '15px', color: '#ffc93c' })
      .setOrigin(0, 0.5);

    this.galaxyText = this.add
      .text(W - 16, 18, '', {
        fontFamily: FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#c8a2ff',
      })
      .setOrigin(1, 0.5);
    this.galaxyBar = this.add.graphics();

    this.add
      .text(W - 16, 46, 'WASD move · SPACE attack · E interact', {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#7d7a8c',
      })
      .setOrigin(1, 0.5);
  }

  override update(): void {
    const W = WORLD.viewWidth;
    const monstersLeft = (this.registry.get('monstersLeft') as number) ?? 0;
    const fragsPerKey = (this.registry.get('fragmentsPerKey') as number) ?? 3;

    // --- health bar
    const pct = Phaser.Math.Clamp(gameState.hp / gameState.maxHp, 0, 1);
    this.hpBar.clear();
    this.hpBar.fillStyle(0x2a1520, 1).fillRoundedRect(14, 12, 200, 14, 4);
    const color = pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xffc93c : 0xff4a5e;
    if (pct > 0) {
      this.hpBar.fillStyle(color, 1).fillRoundedRect(15, 13, Math.max(3, 198 * pct), 12, 3);
    }
    this.hpText.setText(`${Math.max(0, Math.ceil(gameState.hp))} / ${gameState.maxHp}`);

    // --- keys, with pips for the fragments toward the next one
    this.keyText.setText(`${gameState.keys}`);
    this.fragPips.clear();
    for (let i = 0; i < fragsPerKey; i++) {
      const filled = i < gameState.fragments;
      this.fragPips
        .fillStyle(filled ? 0xffd15c : 0xffffff, filled ? 1 : 0.16)
        .fillCircle(288 + i * 13, 22, 4.5);
    }

    this.floorText.setText(`FLOOR ${gameState.floor}`);
    this.monsterText
      .setText(
        monstersLeft === 0
          ? 'Floor cleared — reach the portal'
          : `${monstersLeft} demon${monstersLeft === 1 ? '' : 's'} remaining`
      )
      .setColor(monstersLeft === 0 ? '#4ade80' : '#ff8a8a');

    this.coinText.setText(`${gameState.coins.toLocaleString()}`);
    this.galaxyText.setText(`◈ ${gameState.galaxyCoins}`);

    // --- progress toward the next galaxy coin
    const prog = gameState.galaxyProgress;
    this.galaxyBar.clear();
    this.galaxyBar.fillStyle(0xffffff, 0.12).fillRoundedRect(W - 96, 30, 80, 5, 2.5);
    if (prog > 0) {
      this.galaxyBar.fillStyle(0xc8a2ff, 1).fillRoundedRect(W - 96, 30, Math.max(2, 80 * prog), 5, 2.5);
    }
  }
}
