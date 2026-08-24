import Phaser from 'phaser';
import { WORLD } from '../systems/config';
import { gameState } from '../systems/state';

const FONT = 'system-ui, sans-serif';

export class GameOverScene extends Phaser.Scene {
  private coinsLost = 0;
  private floor = 1;

  constructor() {
    super('GameOver');
  }

  init(data: { coinsLost?: number; floor?: number }): void {
    this.coinsLost = data.coinsLost ?? 0;
    this.floor = data.floor ?? gameState.floor;
  }

  create(): void {
    const W = WORLD.viewWidth;
    const H = WORLD.viewHeight;
    this.cameras.main.setBackgroundColor(0x120508);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.add
      .text(W / 2, H / 2 - 66, 'THE DEMONS TOOK YOU', {
        fontFamily: FONT,
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ff4a5e',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H / 2 - 20, `You fell on floor ${this.floor}.`, {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#d8d3e0',
      })
      .setOrigin(0.5);

    this.add
      .text(
        W / 2,
        H / 2 + 8,
        `The dark kept ${this.coinsLost.toLocaleString()} of your coins. Your upgrades are yours forever.`,
        { fontFamily: FONT, fontSize: '12px', color: '#9c96ad' }
      )
      .setOrigin(0.5);

    const retry = this.add
      .text(W / 2, H / 2 + 62, `ENTER — descend into floor ${this.floor} again`, {
        fontFamily: FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffd15c',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: retry, alpha: { from: 1, to: 0.4 }, duration: 800, yoyo: true, repeat: -1 });

    this.add
      .text(W / 2, H - 28, 'ESC — back to the gate', {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#5c5868',
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.once('keydown-ENTER', () => this.restartFloor());
    kb.once('keydown-SPACE', () => this.restartFloor());
    kb.once('keydown-ESC', () => {
      this.input.keyboard!.removeAllListeners();
      this.scene.start('Title');
    });
  }

  private restartFloor(): void {
    this.input.keyboard!.removeAllListeners();
    // A death costs coins and progress on this floor, never your upgrades.
    for (const p of gameState.players) {
      p.refreshForFloor();
      p.hp = p.maxHp;
    }
    gameState.keys = 0;
    gameState.fragments = 0;
    this.scene.start('Dungeon');
  }
}
