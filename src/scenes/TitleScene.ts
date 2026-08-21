import Phaser from 'phaser';
import { CURRENCY, WORLD } from '../systems/config';
import { gameState } from '../systems/state';

const FONT = 'system-ui, sans-serif';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const W = WORLD.viewWidth;
    const H = WORLD.viewHeight;
    this.cameras.main.setBackgroundColor(0x0a0a0f);

    // Drifting embers behind the title.
    this.add.particles(0, H + 10, 'spark', {
      x: { min: 0, max: W },
      speedY: { min: -26, max: -60 },
      speedX: { min: -12, max: 12 },
      lifespan: 6000,
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.5, end: 0 },
      tint: [0xff6b4a, 0xffc93c, 0x9b5de5],
      frequency: 180,
      blendMode: Phaser.BlendModes.ADD,
    });

    this.add
      .text(W / 2, H / 2 - 92, 'DUNGEONS', {
        fontFamily: FONT,
        fontSize: '58px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H / 2 - 42, 'of DEMONS', {
        fontFamily: FONT,
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ff6b4a',
      })
      .setOrigin(0.5);

    const rules = [
      'Three demons slain forges one full key.',
      'Keys open the vaults. Only a cleared floor opens the way out.',
      `${CURRENCY.coinsPerGalaxyCoin.toLocaleString()} coins forge a single galaxy coin.`,
    ];
    rules.forEach((line, i) => {
      this.add
        .text(W / 2, H / 2 + 4 + i * 20, line, {
          fontFamily: FONT,
          fontSize: '13px',
          color: '#9c96ad',
        })
        .setOrigin(0.5);
    });

    const hasRun = gameState.deepestFloor > 1 || gameState.coins > 0;
    const start = this.add
      .text(W / 2, H / 2 + 96, hasRun ? `CONTINUE — FLOOR ${gameState.floor}` : 'ENTER TO DESCEND', {
        fontFamily: FONT,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffd15c',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1 });

    if (hasRun) {
      this.add
        .text(
          W / 2,
          H / 2 + 122,
          `Deepest floor ${gameState.deepestFloor} · ${gameState.coins.toLocaleString()} coins · ◈ ${gameState.galaxyCoins}`,
          { fontFamily: FONT, fontSize: '12px', color: '#7d7a8c' }
        )
        .setOrigin(0.5);
      this.add
        .text(W / 2, H - 22, 'BACKSPACE — wipe save and start over', {
          fontFamily: FONT,
          fontSize: '11px',
          color: '#5c5868',
        })
        .setOrigin(0.5);
    }

    const kb = this.input.keyboard!;
    kb.once('keydown-ENTER', () => this.begin());
    kb.once('keydown-SPACE', () => this.begin());
    kb.on('keydown-BACKSPACE', () => {
      gameState.reset();
      this.scene.restart();
    });
  }

  private begin(): void {
    this.input.keyboard!.removeAllListeners();
    gameState.hp = gameState.maxHp;
    gameState.keys = 0;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Dungeon');
    });
  }
}
