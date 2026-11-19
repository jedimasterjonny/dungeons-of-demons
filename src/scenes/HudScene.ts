import Phaser from 'phaser';
import { BOSS, CAGES, COOP, PLANET, SCREECH, SHARDS, WORLD } from '../systems/config';
import { isDarkFloor } from '../systems/dungeon';
import { gameState, type PlayerState } from '../systems/state';

const FONT = 'system-ui, sans-serif';

/**
 * One player's corner of the HUD: health, crates, ears, and the Star Sword on the
 * one floor you can be holding it. Two players get one of these each, stacked, which
 * is why the strip is taller in co-op — the single row was already full.
 */
interface Card {
  bar: Phaser.GameObjects.Graphics;
  tag: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Text;
  crateIcon: Phaser.GameObjects.Image;
  crateText: Phaser.GameObjects.Text;
  earIcon: Phaser.GameObjects.Image;
  swordIcon: Phaser.GameObjects.Image;
  status: Phaser.GameObjects.Text;
}

const CARD_H = 34;
const BAR_W = 186;

/** Overlay scene drawn on top of the dungeon. Reads shared state every frame. */
export class HudScene extends Phaser.Scene {
  private cards: Card[] = [];
  private stripH = 62;
  private floorText!: Phaser.GameObjects.Text;
  private monsterText!: Phaser.GameObjects.Text;
  private keyText!: Phaser.GameObjects.Text;
  private keyIcon!: Phaser.GameObjects.Image;
  private fragPips!: Phaser.GameObjects.Graphics;
  private shardText!: Phaser.GameObjects.Text;
  private cageIcon!: Phaser.GameObjects.Image;
  private cageText!: Phaser.GameObjects.Text;
  private cagePips!: Phaser.GameObjects.Graphics;
  private coinText!: Phaser.GameObjects.Text;
  private galaxyText!: Phaser.GameObjects.Text;
  private galaxyBar!: Phaser.GameObjects.Graphics;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'Hud', active: false });
  }

  create(): void {
    const W = WORLD.viewWidth;
    const coop = gameState.isCoop;
    this.cards = [];
    // One card fits in the old 62px strip; two need the room, so the strip grows
    // and everything hung beneath it (the boss bar) moves down with it.
    this.stripH = coop ? 8 + gameState.players.length * CARD_H : 62;

    this.add.rectangle(0, 0, W, this.stripH, 0x000000, 0.55).setOrigin(0);
    this.add.rectangle(0, this.stripH, W, 1, 0xffffff, 0.12).setOrigin(0);

    gameState.players.forEach((_, i) => {
      this.cards.push(this.buildCard(i, coop ? 10 + i * CARD_H : 12, coop));
    });

    // --- keys and fragments. Shared by the party: one pot of keys, one set of pips.
    const keyX = coop ? 300 : 238;
    const keyY = coop ? this.stripH / 2 : 22;
    this.keyIcon = this.add.image(keyX, keyY, 'key').setScale(0.9);
    this.keyText = this.add
      .text(keyX + 18, keyY, '0', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#ffd15c' })
      .setOrigin(0, 0.5);
    this.fragPips = this.add.graphics();

    // --- cages, shared like keys: whole ones, plus pips for pieces toward the next.
    // Right of centre, where the top row is free: beside the keys they run into
    // "FLOOR 100 · DARK", the widest thing the middle ever says.
    const cageX = W / 2 + 160;
    const cageY = 22;
    this.cageIcon = this.add.image(cageX, cageY, 'cage').setScale(0.4).setTint(CAGES.tint);
    this.cageText = this.add
      .text(cageX + 16, cageY, '0', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#d6dbe6' })
      .setOrigin(0, 0.5);
    this.cagePips = this.add.graphics();

    // --- ????? Shards, tucked under the keys: the top row has no room left.
    this.shardText = this.add
      .text(keyX - 8, keyY + 24, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#c8a2ff' })
      .setOrigin(0, 0.5);

    // --- floor and demons remaining
    this.floorText = this.add
      .text(W / 2, 16, '', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5, 0);
    this.monsterText = this.add
      .text(W / 2, 38, '', { fontFamily: FONT, fontSize: '12px', color: '#ff8a8a' })
      .setOrigin(0.5, 0);

    // --- boss bar, hung just under the HUD strip on boss floors
    this.bossBar = this.add.graphics();
    this.bossLabel = this.add
      .text(W / 2, this.stripH + 14, '', {
        fontFamily: FONT,
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ff3b5c',
      })
      .setOrigin(0.5)
      .setVisible(false);

    // --- currency, shared by the party
    this.add.image(W - 178, 18, 'coin');
    this.coinText = this.add
      .text(W - 166, 18, '0', { fontFamily: FONT, fontSize: '15px', color: '#ffc93c' })
      .setOrigin(0, 0.5);
    this.galaxyText = this.add
      .text(W - 16, 18, '', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#c8a2ff' })
      .setOrigin(1, 0.5);
    this.galaxyBar = this.add.graphics();

    // Two short lines in co-op rather than one long one: a single line wide enough
    // for both control sets runs straight into the demon counter in the middle.
    const hint = { fontFamily: FONT, fontSize: '10px', color: '#7d7a8c' };
    if (coop) {
      this.add.text(W - 16, 44, 'P1  WASD · SPACE · Q · C', { ...hint, color: '#9a9080' }).setOrigin(1, 0.5);
      this.add.text(W - 16, 58, 'P2  arrows · ENTER · SHIFT · /', { ...hint, color: '#6f9a88' }).setOrigin(1, 0.5);
    } else {
      this.add.text(W - 16, 46, 'WASD move · SPACE attack · Q crate · C cage · E interact', hint).setOrigin(1, 0.5);
    }
  }

  private buildCard(index: number, y: number, coop: boolean): Card {
    const barX = coop ? 38 : 14;
    const tag = this.add
      .text(14, y + 7, `P${index + 1}`, {
        fontFamily: FONT,
        fontSize: '12px',
        fontStyle: 'bold',
        color: index === 0 ? '#ffffff' : '#8affc9',
      })
      .setOrigin(0, 0.5)
      .setVisible(coop);

    const bar = this.add.graphics();
    const hp = this.add
      .text(barX + 2, y + 22, '', { fontFamily: FONT, fontSize: '11px', color: '#ffffff' })
      .setOrigin(0, 0.5);

    const crateIcon = this.add.image(barX + 78, y + 22, 'crate').setScale(0.45);
    const crateText = this.add
      .text(barX + 88, y + 22, '0', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#c79a55' })
      .setOrigin(0, 0.5);

    const earIcon = this.add.image(barX + 112, y + 22, 'earmuffs').setScale(0.5).setVisible(false);
    const swordIcon = this.add.image(barX + 132, y + 22, 'starsword').setScale(0.5).setVisible(false);

    const status = this.add
      .text(barX + 148, y + 22, '', { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#ff8a8a' })
      .setOrigin(0, 0.5);

    return { bar, tag, hp, crateIcon, crateText, earIcon, swordIcon, status };
  }

  private drawCard(card: Card, who: PlayerState, index: number, coop: boolean): void {
    const y = coop ? 10 + index * CARD_H : 12;
    const barX = coop ? 38 : 14;

    const pct = Phaser.Math.Clamp(who.hp / who.maxHp, 0, 1);
    card.bar.clear();
    card.bar.fillStyle(0x2a1520, 1).fillRoundedRect(barX, y, BAR_W, 14, 4);
    // A downed player's bar goes grey and empty: the bar itself is the alarm.
    const color = who.downed ? 0x6b6478 : pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xffc93c : 0xff4a5e;
    if (pct > 0) {
      card.bar.fillStyle(color, 1).fillRoundedRect(barX + 1, y + 1, Math.max(3, (BAR_W - 2) * pct), 12, 3);
    }
    if (who.downed) {
      // Rescue progress, drawn straight over the empty bar.
      const p = Phaser.Math.Clamp(who.rescueProgress / COOP.rescueTime, 0, 1);
      card.bar.fillStyle(0x8affc9, 1).fillRoundedRect(barX + 1, y + 1, Math.max(2, (BAR_W - 2) * p), 12, 3);
    }

    card.hp.setText(`${Math.max(0, Math.ceil(who.hp))} / ${who.maxHp}`);
    card.crateText.setText(`${who.crates}`).setColor(who.crates > 0 ? '#c79a55' : '#5c5468');
    card.crateIcon.setAlpha(who.crates > 0 ? 1 : 0.3);
    card.earIcon.setVisible(who.blocksScreech);
    card.swordIcon.setVisible(who.hasStarSword);

    if (who.downed) {
      card.status.setText('DOWN').setColor('#8affc9');
    } else if (who.isScreeched) {
      card.status.setText(`-${Math.round(SCREECH.attackReduction * 100)}%  ${who.screechTimer.toFixed(1)}s`).setColor('#ff8a8a');
    } else if (who.hasStarSword) {
      card.status.setText(`${PLANET.swordDamage}`).setColor('#fff6cf');
    } else {
      card.status.setText('');
    }
  }

  override update(): void {
    const W = WORLD.viewWidth;
    const coop = gameState.isCoop;
    const monstersLeft = (this.registry.get('monstersLeft') as number) ?? 0;
    const gravesLeft = (this.registry.get('gravesLeft') as number) ?? 0;
    const fragsPerKey = (this.registry.get('fragmentsPerKey') as number) ?? 3;

    gameState.players.forEach((who, i) => {
      if (this.cards[i]) this.drawCard(this.cards[i], who, i, coop);
    });

    // --- keys, with pips for the fragments toward the next one
    this.keyText.setText(`${gameState.keys}`);
    this.fragPips.clear();
    for (let i = 0; i < fragsPerKey; i++) {
      const filled = i < gameState.fragments;
      this.fragPips
        .fillStyle(filled ? 0xffd15c : 0xffffff, filled ? 1 : 0.16)
        .fillCircle(this.keyText.x + 22 + i * 13, this.keyIcon.y, 4.5);
    }

    this.cageText.setText(`${gameState.cages}`).setAlpha(gameState.cages > 0 ? 1 : 0.4);
    this.cageIcon.setAlpha(gameState.cages > 0 ? 1 : 0.4);
    this.cagePips.clear();
    for (let i = 0; i < CAGES.piecesPerCage; i++) {
      const filled = i < gameState.cagePieces;
      this.cagePips
        .fillStyle(filled ? CAGES.tint : 0xffffff, filled ? 1 : 0.16)
        .fillCircle(this.cageText.x + 22 + i * 13, this.cageIcon.y, 4.5);
    }

    // Shared by the party in practice (everyone gets each boss's shard), so player
    // one's count speaks for both. Gold once the massive power is ready.
    const shards = gameState.me.shards;
    this.shardText
      .setVisible(shards > 0)
      .setText(shards < SHARDS.forMassive ? `◆ ${shards}/${SHARDS.forMassive}` : `◆ ${shards}  MASSIVE`)
      .setColor(shards < SHARDS.forMassive ? '#c8a2ff' : '#ffd15c');

    // Marked on the title rather than given its own indicator: the second row is
    // already carrying the ears and the sword, and the black screen says it louder.
    const dark = isDarkFloor(gameState.floor);
    this.floorText
      .setText(dark ? `FLOOR ${gameState.floor}  ·  DARK` : `FLOOR ${gameState.floor}`)
      .setColor(dark ? '#a99cff' : '#ffffff');
    const cleared = monstersLeft === 0 && gravesLeft === 0;
    const left = [
      monstersLeft > 0 && `${monstersLeft} demon${monstersLeft === 1 ? '' : 's'}`,
      gravesLeft > 0 && `${gravesLeft} grave${gravesLeft === 1 ? '' : 's'}`,
    ].filter(Boolean);
    this.monsterText
      .setText(cleared ? 'Floor cleared — reach the portal' : `${left.join(' · ')} remaining`)
      .setColor(cleared ? '#4ade80' : '#ff8a8a');

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
      const by = this.stripH + 26;
      this.bossBar.fillStyle(0x2a0d16, 0.9).fillRoundedRect(bx, by, bw, 12, 4);
      this.bossBar
        .fillStyle(0xff3b5c, 1)
        .fillRoundedRect(bx + 2, by + 2, Math.max(3, (bw - 4) * (bossHp / bossMax)), 8, 3);
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
