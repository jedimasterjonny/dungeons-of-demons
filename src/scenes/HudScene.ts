import Phaser from 'phaser';
import { BOSS, PLANET, SCREECH, WORLD } from '../systems/config';
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
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossLabel!: Phaser.GameObjects.Text;
  private crateText!: Phaser.GameObjects.Text;
  private crateIcon!: Phaser.GameObjects.Image;
  private swordIcon!: Phaser.GameObjects.Image;
  private swordText!: Phaser.GameObjects.Text;
  private screechText!: Phaser.GameObjects.Text;
  private earmuffIcon!: Phaser.GameObjects.Image;
  private earmuffLabel!: Phaser.GameObjects.Text;

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

    // --- crates in hand
    this.crateIcon = this.add.image(340, 22, 'crate').setScale(0.55);
    this.crateText = this.add
      .text(356, 22, '0', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#c79a55' })
      .setOrigin(0, 0.5);

    // --- the Star Sword, on the one floor you can be holding it
    // Second row, clear of the floor title: the top row is already full.
    this.swordIcon = this.add.image(238, 48, 'starsword').setScale(0.7).setVisible(false);
    this.swordText = this.add
      .text(252, 48, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#fff6cf' })
      .setOrigin(0, 0.5)
      .setVisible(false);

    // --- how your ears are doing, under the health bar. Screeched and muffled are
    // mutually exclusive by definition, so they share the one line.
    this.screechText = this.add
      .text(16, 48, '', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#ff8a8a' })
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.earmuffIcon = this.add.image(24, 48, 'earmuffs').setScale(0.7).setVisible(false);
    this.earmuffLabel = this.add
      .text(40, 48, 'screeches blocked', { fontFamily: FONT, fontSize: '11px', color: '#ff9ecb' })
      .setOrigin(0, 0.5)
      .setVisible(false);

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

    // --- boss bar, hung just under the HUD strip on boss floors
    this.bossBar = this.add.graphics();
    this.bossLabel = this.add
      .text(W / 2, 76, '', {
        fontFamily: FONT,
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ff3b5c',
      })
      .setOrigin(0.5)
      .setVisible(false);

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
      .text(W - 16, 46, 'WASD move · SPACE attack · Q crate · E interact', {
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

    // --- crates: greyed out once the stack is empty
    this.crateText.setText(`${gameState.crates}`).setColor(gameState.crates > 0 ? '#c79a55' : '#5c5468');
    this.crateIcon.setAlpha(gameState.crates > 0 ? 1 : 0.3);

    // --- star sword
    this.swordIcon.setVisible(gameState.hasStarSword);
    this.swordText.setVisible(gameState.hasStarSword).setText(`${PLANET.swordDamage}`);

    // --- screech and earmuffs
    const muffed = gameState.blocksScreech;
    this.earmuffIcon.setVisible(muffed);
    this.earmuffLabel.setVisible(muffed);

    if (gameState.isScreeched) {
      this.screechText
        .setText(
          `SCREECHED!  attack -${Math.round(SCREECH.attackReduction * 100)}%  (${gameState.screechTimer.toFixed(1)}s)`
        )
        .setVisible(true);
    } else {
      this.screechText.setVisible(false);
    }

    this.floorText.setText(`FLOOR ${gameState.floor}`);
    this.monsterText
      .setText(
        monstersLeft === 0
          ? 'Floor cleared — reach the portal'
          : `${monstersLeft} demon${monstersLeft === 1 ? '' : 's'} remaining`
      )
      .setColor(monstersLeft === 0 ? '#4ade80' : '#ff8a8a');

    // --- boss health, whenever one is alive on this floor
    const bossHp = (this.registry.get('bossHp') as number) ?? 0;
    const bossMax = (this.registry.get('bossMaxHp') as number) ?? 0;
    this.bossBar.clear();
    this.bossLabel.setVisible(bossHp > 0);
    if (bossHp > 0 && bossMax > 0) {
      const name = ((this.registry.get('bossName') as string) ?? BOSS.name).toUpperCase();
      this.bossLabel.setText(`${name}   ${bossHp.toLocaleString()} / ${bossMax.toLocaleString()}`);
      const bw = 300;
      const bx = W / 2 - bw / 2;
      this.bossBar.fillStyle(0x2a0d16, 0.9).fillRoundedRect(bx, 88, bw, 12, 4);
      this.bossBar
        .fillStyle(0xff3b5c, 1)
        .fillRoundedRect(bx + 2, 90, Math.max(3, (bw - 4) * (bossHp / bossMax)), 8, 3);
    }

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
