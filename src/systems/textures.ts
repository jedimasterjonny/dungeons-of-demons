import Phaser from 'phaser';
import { AVATARS, AVATAR_SIZE, avatarTexture } from './avatars';
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

  // --- every avatar you can wear, all the same size so the hitbox never changes
  for (const avatar of AVATARS) {
    avatar.draw(g);
    emit(avatarTexture(avatar.id), AVATAR_SIZE, AVATAR_SIZE);
  }

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

  // --- boss: a crowned, winged demon, twice anything else on the floor
  const BS = 44;
  g.fillStyle(0x000000, 0.3).fillEllipse(BS / 2, BS - 4, 30, 10);
  g.fillStyle(0xbbbbbb, 1).fillTriangle(1, 24, 13, 8, 15, 28);
  g.fillStyle(0xbbbbbb, 1).fillTriangle(BS - 1, 24, BS - 13, 8, BS - 15, 28);
  g.fillStyle(0xffffff, 1).fillRoundedRect(9, 16, BS - 18, 24, 8);
  g.fillStyle(0xffffff, 1).fillCircle(BS / 2, 16, 12);
  g.fillStyle(0xffffff, 1).fillTriangle(6, 10, 11, 0, 15, 11);
  g.fillStyle(0xffffff, 1).fillTriangle(BS - 6, 10, BS - 11, 0, BS - 15, 11);
  // Crown, a shade down so it still reads once the whole thing is tinted red.
  g.fillStyle(0xd6d6d6, 1).fillRect(13, 5, 18, 4);
  g.fillStyle(0xd6d6d6, 1).fillTriangle(13, 5, 17, 0, 21, 5);
  g.fillStyle(0xd6d6d6, 1).fillTriangle(19, 5, 23, -1, 27, 5);
  g.fillStyle(0xd6d6d6, 1).fillTriangle(25, 5, 29, 0, 31, 5);
  g.fillStyle(0x2a0510, 1).fillCircle(BS / 2 - 4.5, 15, 2.6);
  g.fillStyle(0x2a0510, 1).fillCircle(BS / 2 + 4.5, 15, 2.6);
  g.fillStyle(0x2a0510, 1).fillRoundedRect(16, 21, 12, 5, 2);
  g.fillStyle(0xffffff, 1).fillRect(18, 21, 2, 3);
  g.fillStyle(0xffffff, 1).fillRect(23, 21, 2, 3);
  g.fillStyle(0xcccccc, 1).fillRect(12, 30, BS - 24, 3);
  emit('boss', BS, BS);

  // --- thanos: drawn in real colours (his MONSTERS tint is white, so nothing recolours him)
  const TS = 44;
  g.fillStyle(0x000000, 0.3).fillEllipse(TS / 2, TS - 3, 30, 9);
  g.fillStyle(0x2f4f9e, 1).fillRoundedRect(7, 20, TS - 14, 21, 7);
  g.fillStyle(0x3f6fd1, 1).fillRoundedRect(9, 22, TS - 18, 15, 5);
  g.fillStyle(0xffc93c, 1).fillRect(9, 28, TS - 18, 2);
  g.fillStyle(0x6b3fa8, 1).fillRoundedRect(12, 15, 20, 10, 5);
  g.fillStyle(0x9b5de5, 1).fillCircle(TS / 2, 14, 12);
  g.fillStyle(0x8a4fd4, 1).fillEllipse(TS / 2, 21, 15, 9);
  // The chin, which is the whole point of him.
  g.fillStyle(0x6b3fa8, 1).fillRect(18, 20, 2, 5);
  g.fillStyle(0x6b3fa8, 1).fillRect(24, 20, 2, 5);
  g.fillStyle(0x2a0510, 1).fillEllipse(TS / 2 - 5, 12, 5, 3);
  g.fillStyle(0x2a0510, 1).fillEllipse(TS / 2 + 5, 12, 5, 3);
  g.fillStyle(0x6b3fa8, 1).fillRect(13, 8, 7, 2);
  g.fillStyle(0x6b3fa8, 1).fillRect(24, 8, 7, 2);
  // The gauntlet, with all six stones.
  g.fillStyle(0xc98d13, 1).fillCircle(36, 31, 7.5);
  g.fillStyle(0xffc93c, 1).fillCircle(36, 31, 6);
  const stones = [0x9b5de5, 0xffc93c, 0xff4a5e, 0xff8a3c, 0x4ad9ff, 0x4ade80];
  stones.forEach((c, i) => {
    const a = (i / stones.length) * Math.PI * 2;
    g.fillStyle(c, 1).fillCircle(36 + Math.cos(a) * 3.4, 31 + Math.sin(a) * 3.4, 1.3);
  });
  emit('thanos', TS, TS);

  // --- star sword: a blade of planet-light, drawn in colour and left untinted
  const SW = 26;
  g.fillStyle(0xfff6cf, 0.35).fillCircle(SW / 2, SW / 2, 12);
  g.fillStyle(0xfff6cf, 0.55).fillCircle(SW / 2, SW / 2, 8);
  g.fillStyle(0xe8f4ff, 1).fillTriangle(SW / 2 - 3, 20, SW / 2 + 3, 20, SW / 2, 1);
  g.fillStyle(0xffffff, 1).fillTriangle(SW / 2 - 1, 19, SW / 2 + 1, 19, SW / 2, 3);
  g.fillStyle(0xffc93c, 1).fillRect(SW / 2 - 7, 19, 14, 3);
  g.fillStyle(0xc98d13, 1).fillRect(SW / 2 - 2, 22, 4, 4);
  emit('starsword', SW, SW);

  // --- ????? shard: a violet crystal splinter, in colour and left untinted
  const SH = 24;
  g.fillStyle(0xc8a2ff, 0.3).fillCircle(SH / 2, SH / 2, 11);
  g.fillStyle(0x9b5de5, 1).fillTriangle(SH / 2, 2, SH / 2 + 6, 12, SH / 2, 22);
  g.fillStyle(0x6b3fa8, 1).fillTriangle(SH / 2, 2, SH / 2 - 6, 12, SH / 2, 22);
  g.fillStyle(0xe6d4ff, 1).fillTriangle(SH / 2, 4, SH / 2 + 3, 11, SH / 2, 15);
  emit('shard', SH, SH);

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

  // --- sprung trap: the floor cracked open where you were out witted. Tinted at runtime.
  g.lineStyle(2, 0xffffff, 1);
  const crack = [[5, 7, 13, 14], [13, 14, 10, 21], [10, 21, 18, 27], [18, 27, 27, 24], [13, 14, 23, 11], [23, 11, 27, 4], [10, 21, 3, 26]];
  for (const [x1, y1, x2, y2] of crack) g.lineBetween(x1, y1, x2, y2);
  emit('trap', TILE, TILE);

  // --- the tiny T that gives some traps away. Drawn white, tinted at runtime.
  g.fillStyle(0xffffff, 1).fillRect(1, 1, 8, 2).fillRect(4, 1, 2, 8);
  emit('trapT', 10, 10);

  // --- the tiny G on some giving tiles. Same size and colour as the T.
  g.fillStyle(0xffffff, 1).fillRect(1, 1, 8, 2).fillRect(1, 1, 2, 8).fillRect(1, 7, 8, 2);
  g.fillRect(7, 4, 2, 5).fillRect(5, 4, 4, 2);
  emit('giftG', 10, 10);

  // --- used giving tile: a four-point sparkle, the opposite of the trap's crack.
  const mid = TILE / 2;
  g.fillStyle(0xffffff, 1)
    .fillTriangle(mid, 4, mid - 3, mid, mid + 3, mid)
    .fillTriangle(mid, TILE - 4, mid - 3, mid, mid + 3, mid)
    .fillTriangle(4, mid, mid, mid - 3, mid, mid + 3)
    .fillTriangle(TILE - 4, mid, mid, mid - 3, mid, mid + 3);
  emit('gift', TILE, TILE);

  // --- cage: bars on a frame, big enough to drop over a brute. Drawn white, tinted.
  const CG = 40;
  g.fillStyle(0xffffff, 1).fillRect(0, 0, CG, 4).fillRect(0, CG - 4, CG, 4);
  for (let x = 0; x <= CG - 3; x += 9.25) g.fillRect(x, 0, 3, CG);
  emit('cage', CG, CG);

  // --- cage piece: one barred panel, a quarter-size cage lying on the floor
  g.fillStyle(0xffffff, 1).fillRect(0, 0, 14, 3).fillRect(0, 11, 14, 3);
  g.fillRect(0, 0, 3, 14).fillRect(5.5, 0, 3, 14).fillRect(11, 0, 3, 14);
  emit('cagepiece', 14, 14);

  // --- grave: a round-topped headstone with a cross, on a heap of earth. In colour.
  g.fillStyle(0x3a2a1e, 1).fillEllipse(14, 29, 28, 7);
  g.fillStyle(0x8a8496, 1).fillRoundedRect(5, 4, 18, 25, { tl: 9, tr: 9, bl: 1, br: 1 });
  g.fillStyle(0x6b6578, 1).fillRect(5, 24, 18, 5);
  g.fillStyle(0x4a4556, 1).fillRect(13, 8, 2, 12).fillRect(9, 11, 10, 2);
  emit('grave', 28, 32);

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

  // --- crate: a tile-filling wooden box with corner posts and a brace
  g.fillStyle(0x3d2a14, 1).fillRect(0, 0, TILE, TILE);
  g.fillStyle(0x8a6229, 1).fillRect(1, 1, TILE - 2, TILE - 2);
  g.fillStyle(0xa87a37, 1).fillRect(3, 3, TILE - 6, TILE - 6);
  g.fillStyle(0x6b4a1f, 1).fillRect(3, TILE / 2 - 2, TILE - 6, 4);
  // Diagonal brace, faked with a stack of short bars so it reads at 32px.
  for (let i = 0; i < TILE - 8; i++) {
    g.fillStyle(0x6b4a1f, 1).fillRect(4 + i, TILE - 5 - i, 3, 2);
  }
  g.fillStyle(0xc79a55, 1).fillRect(3, 3, TILE - 6, 2);
  g.fillStyle(0x2a1c0d, 1).fillRect(0, TILE - 2, TILE, 2);
  emit('crate', TILE, TILE);

  // --- cute fluffy earmuffs: a headband and two pink pom-poms
  const E = 26;
  g.lineStyle(2.5, 0xd9d2e6, 1).beginPath();
  g.arc(E / 2, 13, 9, Math.PI, 0, false);
  g.strokePath();
  // Fluff is drawn as a scatter of overlapping circles so the edge reads as fuzzy.
  for (const cx of [5, E - 5]) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.fillStyle(0xff9ecb, 1).fillCircle(cx + Math.cos(a) * 2.6, 13 + Math.sin(a) * 2.6, 3.4);
    }
    g.fillStyle(0xffc3e0, 1).fillCircle(cx, 12, 3.2);
    g.fillStyle(0xffe4f1, 1).fillCircle(cx - 1, 11, 1.6);
  }
  emit('earmuffs', E, 20);

  // --- screech ring: a shockwave, built from dots for the same reason as the swing
  const R = 96;
  const ringR = R / 2 - 6;
  for (let a = 0; a < 360; a += 5) {
    const rad = Phaser.Math.DegToRad(a);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(R / 2 + Math.cos(rad) * ringR, R / 2 + Math.sin(rad) * ringR, 3.2);
  }
  for (let a = 0; a < 360; a += 9) {
    const rad = Phaser.Math.DegToRad(a);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(R / 2 + Math.cos(rad) * (ringR - 9), R / 2 + Math.sin(rad) * (ringR - 9), 2.2);
  }
  emit('screechring', R, R);

  // --- light: the glow ERASED out of the darkness on a dark floor. Built outside-in,
  // each ring adding just enough alpha to hit a target opacity, because a flat circle
  // would erase as a hard-edged spotlight with a visible cut line.
  //
  // Two profiles, because the two sheets of darkness want opposite things. The torch
  // you carry feathers away over most of its radius, which is what makes a pool of
  // light. The trail burnt into the memory sheet is almost solid: it answers "have I
  // walked here", and a soft trail would multiply against the torch and leave even the
  // ground under your feet looking half-lit.
  const L = 256;
  const lightR = L / 2;
  const glow = (key: string, solidTo: number) => {
    let opacity = 0;
    for (let r = lightR; r > 0 && opacity < 0.999; r -= 2) {
      // 0 at the rim, 1 at the middle; fully opaque from solidTo inward.
      const t = 1 - r / lightR;
      const target = Math.min(1, t / (1 - solidTo));
      const step = (target - opacity) / (1 - opacity);
      if (step <= 0) continue;
      g.fillStyle(0xffffff, step).fillCircle(lightR, lightR, r);
      opacity = target;
    }
    emit(key, L, L);
  };
  glow('light', 0.45);
  glow('lighttrail', 0.82);

  // --- foot ring: who is who in co-op. A ring under the feet rather than a tint on
  // the sprite, because avatars are drawn in full colour and tinting one green turns
  // a pizza into a swamp. Drawn white and tinted per player.
  const FR = 30;
  g.lineStyle(2.5, 0xffffff, 1).strokeEllipse(FR / 2, FR / 2, FR - 5, (FR - 5) * 0.45);
  g.fillStyle(0xffffff, 0.18).fillEllipse(FR / 2, FR / 2, FR - 7, (FR - 7) * 0.45);
  emit('footring', FR, FR);

  // --- soft particle for hits, pickups and portal glow
  g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
  emit('spark', 8, 8);

  g.destroy();
}
