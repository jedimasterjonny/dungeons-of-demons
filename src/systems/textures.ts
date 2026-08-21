import Phaser from 'phaser';
import { TILE } from './config';

/**
 * Every sprite is drawn at boot instead of loaded, so the game ships with no
 * external assets and runs offline. Shapes that get tinted are drawn in white.
 */
export function buildTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const emit = (key: string, w: number, h: number) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    g.generateTexture(key, w, h);
    g.clear();
  };

  // Floor and wall carry most of the readability load, so they are pushed well
  // apart in value: lit ground, near-black stone, and pure black for solid rock
  // that never gets drawn at all.

  // --- floor: lit flagstone with a darker seam around the edge
  g.fillStyle(0x272033, 1).fillRect(0, 0, TILE, TILE);
  g.fillStyle(0x3a3150, 1).fillRect(1, 1, TILE - 2, TILE - 2);
  g.fillStyle(0x413757, 1).fillRect(3, 3, TILE - 6, TILE - 6);
  emit('floor', TILE, TILE);

  // --- wall: near-black block with a bright cap to fake height
  g.fillStyle(0x0d0a13, 1).fillRect(0, 0, TILE, TILE);
  g.fillStyle(0x6b5a92, 1).fillRect(0, 0, TILE, 4);
  g.fillStyle(0x4a3f66, 1).fillRect(0, 4, TILE, 5);
  g.fillStyle(0x0d0a13, 1).fillRect(2, 11, TILE - 4, TILE - 13);
  emit('wall', TILE, TILE);

  // --- locked door: banded metal with a keyhole
  g.fillStyle(0x6b4a1f, 1).fillRect(0, 0, TILE, TILE);
  g.fillStyle(0x8a6229, 1).fillRect(2, 2, TILE - 4, TILE - 4);
  g.fillStyle(0x4a3315, 1).fillRect(0, TILE / 2 - 2, TILE, 4);
  g.fillStyle(0xffd15c, 1).fillCircle(TILE / 2, TILE / 2 - 4, 4);
  g.fillStyle(0xffd15c, 1).fillRect(TILE / 2 - 2, TILE / 2 - 4, 4, 9);
  emit('door', TILE, TILE);

  // --- exit portal: concentric rings, tinted at runtime for sealed vs open
  g.fillStyle(0xffffff, 0.18).fillCircle(TILE / 2, TILE / 2, TILE / 2 - 1);
  g.fillStyle(0xffffff, 0.45).fillCircle(TILE / 2, TILE / 2, TILE / 2 - 6);
  g.fillStyle(0xffffff, 0.95).fillCircle(TILE / 2, TILE / 2, TILE / 2 - 11);
  emit('portal', TILE, TILE);

  // --- shop pad
  g.fillStyle(0x1f4c3d, 1).fillRect(0, 0, TILE, TILE);
  g.fillStyle(0x2e6d57, 1).fillRect(2, 2, TILE - 4, TILE - 4);
  g.fillStyle(0x7bd8a8, 1).fillRect(TILE / 2 - 1, 7, 2, TILE - 14);
  g.fillStyle(0x7bd8a8, 1).fillRect(9, TILE / 2 - 1, TILE - 18, 2);
  emit('shoppad', TILE, TILE);

  // --- player: hooded delver, drawn facing down
  const P = 26;
  g.fillStyle(0x000000, 0.25).fillEllipse(P / 2, P - 3, 18, 7);
  g.fillStyle(0x3f6fd1, 1).fillRoundedRect(4, 7, P - 8, P - 11, 5);
  g.fillStyle(0x5b8ef0, 1).fillRoundedRect(5, 3, P - 10, 12, 6);
  g.fillStyle(0xf2c9a0, 1).fillRoundedRect(8, 8, P - 16, 7, 3);
  g.fillStyle(0x21386b, 1).fillRect(4, P - 8, P - 8, 3);
  emit('player', P, P);

  // --- imp: small horned brawler
  const I = 22;
  g.fillStyle(0x000000, 0.25).fillEllipse(I / 2, I - 2, 14, 6);
  g.fillStyle(0xffffff, 1).fillCircle(I / 2, I / 2, 8);
  g.fillStyle(0xffffff, 1).fillTriangle(3, 7, 7, 1, 8, 8);
  g.fillStyle(0xffffff, 1).fillTriangle(I - 3, 7, I - 7, 1, I - 8, 8);
  g.fillStyle(0x1a0f14, 1).fillCircle(I / 2 - 3, I / 2 - 1, 1.6);
  g.fillStyle(0x1a0f14, 1).fillCircle(I / 2 + 3, I / 2 - 1, 1.6);
  emit('imp', I, I);

  // --- brute: heavy, wide, slab-shouldered
  const B = 32;
  g.fillStyle(0x000000, 0.3).fillEllipse(B / 2, B - 3, 22, 8);
  g.fillStyle(0xffffff, 1).fillRoundedRect(4, 8, B - 8, B - 12, 6);
  g.fillStyle(0xffffff, 1).fillRoundedRect(9, 3, B - 18, 10, 4);
  g.fillStyle(0xffffff, 1).fillTriangle(2, 12, 8, 3, 9, 13);
  g.fillStyle(0xffffff, 1).fillTriangle(B - 2, 12, B - 8, 3, B - 9, 13);
  g.fillStyle(0x2a0f2e, 1).fillRect(11, 7, 4, 3);
  g.fillStyle(0x2a0f2e, 1).fillRect(B - 15, 7, 4, 3);
  emit('brute', B, B);

  // --- wraith: hooded, tapering to nothing
  const W = 24;
  g.fillStyle(0xffffff, 0.9).fillTriangle(W / 2, 2, 3, W - 2, W - 3, W - 2);
  g.fillStyle(0xffffff, 1).fillCircle(W / 2, 9, 7);
  g.fillStyle(0x081a22, 1).fillCircle(W / 2 - 2.5, 8, 1.8);
  g.fillStyle(0x081a22, 1).fillCircle(W / 2 + 2.5, 8, 1.8);
  emit('wraith', W, W);

  // --- coin
  g.fillStyle(0xffc93c, 1).fillCircle(7, 7, 6);
  g.lineStyle(1.5, 0xc98d13, 1).strokeCircle(7, 7, 5.5);
  g.fillStyle(0xffe89a, 1).fillCircle(5.5, 5.5, 2.5);
  emit('coin', 14, 14);

  // --- key fragment: a jagged third of a key
  g.fillStyle(0xffd15c, 1).fillTriangle(2, 12, 6, 1, 11, 9);
  g.fillStyle(0xfff0b8, 1).fillTriangle(4, 10, 6, 4, 9, 9);
  emit('fragment', 14, 14);

  // --- whole key, for the HUD
  g.fillStyle(0xffd15c, 1).fillCircle(6, 8, 5);
  g.fillStyle(0x1b1626, 1).fillCircle(6, 8, 2);
  g.fillStyle(0xffd15c, 1).fillRect(10, 6.5, 10, 3);
  g.fillStyle(0xffd15c, 1).fillRect(16, 9, 3, 4);
  emit('key', 22, 16);

  // --- chest
  const C = 26;
  g.fillStyle(0x000000, 0.25).fillEllipse(C / 2, C - 3, 20, 6);
  g.fillStyle(0x6b4a1f, 1).fillRoundedRect(2, 8, C - 4, C - 12, 3);
  g.fillStyle(0x8a6229, 1).fillRoundedRect(2, 4, C - 4, 8, 4);
  g.fillStyle(0xffc93c, 1).fillRect(C / 2 - 3, 8, 6, 7);
  g.fillStyle(0x4a3315, 1).fillRect(2, 12, C - 4, 2);
  emit('chest', C, C);

  // --- swing arc: a crescent of blobs along the swing path, thickest at the middle.
  // Built from circles rather than a subtracted ring because generateTexture bakes
  // fills as opaque pixels — punching a hole with a second fill would leave black.
  const S = 80;
  const swingR = S / 2 - 9;
  for (let a = -55; a <= 55; a += 3) {
    const t = 1 - Math.abs(a) / 55;
    const rad = Phaser.Math.DegToRad(a);
    g.fillStyle(0xffffff, 0.35 + 0.65 * t);
    g.fillCircle(S / 2 + Math.cos(rad) * swingR, S / 2 + Math.sin(rad) * swingR, 3 + 5 * t);
  }
  emit('swing', S, S);

  // --- soft particle for hits, pickups and portal glow
  g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
  emit('spark', 8, 8);

  g.destroy();
}
