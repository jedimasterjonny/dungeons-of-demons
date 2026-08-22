import Phaser from 'phaser';

/**
 * Every avatar you can wear. Like the rest of the game these are drawn rather than
 * loaded, and they are all the same size as the default delver so that changing your
 * look never changes your hitbox — it is pure decoration.
 */

export const AVATAR_SIZE = 26;
export const DEFAULT_AVATAR = 'delver';

export interface Avatar {
  id: string;
  name: string;
  draw: (g: Phaser.GameObjects.Graphics) => void;
}

/** Texture key an avatar is baked under at boot. */
export function avatarTexture(id: string): string {
  return `avatar:${id}`;
}

const S = AVATAR_SIZE;

/** The soft ellipse every grounded avatar stands on. */
function shadow(g: Phaser.GameObjects.Graphics, w = 18): void {
  g.fillStyle(0x000000, 0.25).fillEllipse(S / 2, S - 3, w, 7);
}

function eyes(g: Phaser.GameObjects.Graphics, y: number, spread = 3, r = 1.6, color = 0x1a0f14): void {
  g.fillStyle(color, 1).fillCircle(S / 2 - spread, y, r);
  g.fillStyle(color, 1).fillCircle(S / 2 + spread, y, r);
}

export const AVATARS: Avatar[] = [
  {
    id: DEFAULT_AVATAR,
    name: 'Hooded Delver',
    draw: (g) => {
      shadow(g);
      g.fillStyle(0x3f6fd1, 1).fillRoundedRect(4, 7, S - 8, S - 11, 5);
      g.fillStyle(0x5b8ef0, 1).fillRoundedRect(5, 3, S - 10, 12, 6);
      g.fillStyle(0xf2c9a0, 1).fillRoundedRect(8, 8, S - 16, 7, 3);
      g.fillStyle(0x21386b, 1).fillRect(4, S - 8, S - 8, 3);
    },
  },
  {
    id: 'cat',
    name: 'Cat',
    draw: (g) => {
      shadow(g, 16);
      // Tail first, so the body draws over where it joins.
      g.fillStyle(0xf0913a, 1).fillCircle(22, 19, 2.6);
      g.fillStyle(0xf0913a, 1).fillCircle(23.5, 15.5, 2.4);
      g.fillStyle(0xf0913a, 1).fillCircle(23, 12, 2.2);
      g.fillStyle(0xffa245, 1).fillRoundedRect(6, 11, 14, 12, 5);
      g.fillStyle(0xffa245, 1).fillTriangle(6, 7, 8, 1, 13, 8);
      g.fillStyle(0xffa245, 1).fillTriangle(20, 7, 18, 1, 13, 8);
      g.fillStyle(0xff9ecb, 1).fillTriangle(8, 6.5, 9, 3.5, 11.5, 7);
      g.fillStyle(0xff9ecb, 1).fillTriangle(18, 6.5, 17, 3.5, 14.5, 7);
      g.fillStyle(0xffa245, 1).fillCircle(13, 10, 7);
      g.fillStyle(0xfff0dc, 1).fillEllipse(13, 13, 9, 6);
      eyes(g, 9, 3.2, 1.7, 0x2a1a10);
      g.fillStyle(0xff7ab0, 1).fillTriangle(11.5, 12, 14.5, 12, 13, 14);
    },
  },
  {
    id: 'dragon',
    name: 'Dragon',
    draw: (g) => {
      shadow(g, 20);
      g.fillStyle(0x2f7d4f, 1).fillTriangle(1, 12, 7, 5, 8, 16);
      g.fillStyle(0x2f7d4f, 1).fillTriangle(25, 12, 19, 5, 18, 16);
      g.fillStyle(0x4ac86f, 1).fillRoundedRect(6, 8, 14, 15, 6);
      g.fillStyle(0x4ac86f, 1).fillCircle(13, 9, 7);
      g.fillStyle(0xa8f0bf, 1).fillEllipse(13, 18, 9, 8);
      // Snout and horns.
      g.fillStyle(0x4ac86f, 1).fillRoundedRect(10, 11, 6, 5, 2);
      g.fillStyle(0xfff0b8, 1).fillTriangle(7, 4, 9, 0, 10, 4);
      g.fillStyle(0xfff0b8, 1).fillTriangle(19, 4, 17, 0, 16, 4);
      eyes(g, 8, 3.4, 1.7, 0x0f2a18);
      g.fillStyle(0xff6b4a, 1).fillCircle(11.5, 15, 1);
      g.fillStyle(0xff6b4a, 1).fillCircle(14.5, 15, 1);
    },
  },
  {
    id: 'robot',
    name: 'Robot',
    draw: (g) => {
      shadow(g, 17);
      g.fillStyle(0x9aa3b5, 1).fillRect(12, 0, 2, 4);
      g.fillStyle(0xff4a5e, 1).fillCircle(13, 1.5, 2);
      g.fillStyle(0x8892a6, 1).fillRoundedRect(5, 12, 16, 11, 3);
      g.fillStyle(0xb3bccf, 1).fillRoundedRect(4, 4, 18, 12, 4);
      g.fillStyle(0x1b2233, 1).fillRoundedRect(6, 7, 14, 6, 3);
      g.fillStyle(0x4ad9ff, 1).fillCircle(10, 10, 2);
      g.fillStyle(0x4ad9ff, 1).fillCircle(16, 10, 2);
      g.fillStyle(0x5b8ef0, 1).fillRect(8, 17, 10, 2);
      g.fillStyle(0x6b7488, 1).fillRect(2, 14, 3, 7);
      g.fillStyle(0x6b7488, 1).fillRect(21, 14, 3, 7);
    },
  },
  {
    id: 'ghost',
    name: 'Ghost',
    draw: (g) => {
      g.fillStyle(0x000000, 0.15).fillEllipse(S / 2, S - 2, 14, 5);
      g.fillStyle(0xe8e6f5, 0.95).fillCircle(13, 11, 9);
      g.fillStyle(0xe8e6f5, 0.95).fillRect(4, 11, 18, 8);
      // Wavy hem, drawn as three lobes.
      g.fillStyle(0xe8e6f5, 0.95).fillCircle(7, 19, 3.2);
      g.fillStyle(0xe8e6f5, 0.95).fillCircle(13, 20, 3.4);
      g.fillStyle(0xe8e6f5, 0.95).fillCircle(19, 19, 3.2);
      eyes(g, 10, 3.6, 2.1, 0x2b2740);
      g.fillStyle(0x2b2740, 1).fillEllipse(13, 15, 4, 3);
    },
  },
  {
    id: 'slime',
    name: 'Slime',
    draw: (g) => {
      shadow(g, 19);
      g.fillStyle(0x39c46b, 0.95).fillCircle(13, 15, 10);
      g.fillStyle(0x39c46b, 0.95).fillRect(3, 15, 20, 8);
      g.fillStyle(0x7bef9f, 0.9).fillEllipse(9, 11, 6, 4);
      eyes(g, 14, 4, 2.2, 0x0f3a20);
      g.fillStyle(0x0f3a20, 1).fillEllipse(13, 19, 5, 2.5);
      g.fillStyle(0x2a9c52, 1).fillRect(3, 21, 20, 2);
    },
  },
  {
    id: 'wizard',
    name: 'Wizard',
    draw: (g) => {
      shadow(g);
      g.fillStyle(0x6b4a9f, 1).fillTriangle(3, 23, 23, 23, 13, 9);
      g.fillStyle(0xf2c9a0, 1).fillCircle(13, 10, 6);
      g.fillStyle(0x9b5de5, 1).fillTriangle(4, 9, 22, 9, 13, 0);
      g.fillStyle(0xc8a2ff, 1).fillRect(5, 8, 16, 2);
      g.fillStyle(0xffd15c, 1).fillCircle(13, 4, 1.6);
      eyes(g, 10, 2.6, 1.4, 0x2a1a10);
      g.fillStyle(0xf5f2ff, 1).fillTriangle(9, 13, 17, 13, 13, 21);
    },
  },
  {
    id: 'dino',
    name: 'Dino',
    draw: (g) => {
      shadow(g, 20);
      g.fillStyle(0x2f7d4f, 1).fillCircle(21, 17, 4);
      g.fillStyle(0x6bd86b, 1).fillRoundedRect(4, 10, 15, 13, 5);
      g.fillStyle(0x6bd86b, 1).fillCircle(10, 9, 7);
      g.fillStyle(0x6bd86b, 1).fillRoundedRect(2, 9, 9, 6, 3);
      // Back spikes.
      g.fillStyle(0xffc93c, 1).fillTriangle(15, 9, 18, 4, 19, 10);
      g.fillStyle(0xffc93c, 1).fillTriangle(19, 11, 22, 7, 23, 13);
      g.fillStyle(0xa8f0bf, 1).fillEllipse(11, 19, 10, 7);
      g.fillStyle(0x0f2a18, 1).fillCircle(8, 8, 1.7);
      g.fillStyle(0xfff0dc, 1).fillTriangle(3, 12, 5, 12, 4, 14.5);
    },
  },
  {
    id: 'pizza',
    name: 'Pizza Slice',
    draw: (g) => {
      shadow(g, 15);
      g.fillStyle(0xc98d13, 1).fillRoundedRect(2, 2, 22, 6, 3);
      g.fillStyle(0xffd15c, 1).fillTriangle(3, 7, 23, 7, 13, 24);
      g.fillStyle(0xffe89a, 1).fillTriangle(6, 8, 20, 8, 13, 20);
      g.fillStyle(0xff4a5e, 1).fillCircle(9, 11, 2.2);
      g.fillStyle(0xff4a5e, 1).fillCircle(17, 11, 2.2);
      g.fillStyle(0xff4a5e, 1).fillCircle(13, 16, 2.2);
      eyes(g, 10, 3.4, 1.5, 0x5a3a10);
      g.fillStyle(0x5a3a10, 1).fillEllipse(13, 13.5, 4, 2);
    },
  },
  {
    id: 'star',
    name: 'Superstar',
    draw: (g) => {
      shadow(g, 14);
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 12 : 5.2;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push({ x: 13 + Math.cos(a) * r, y: 12 + Math.sin(a) * r });
      }
      g.fillStyle(0xffc93c, 1).fillPoints(pts, true);
      g.fillStyle(0xffe89a, 1).fillCircle(13, 11, 5);
      eyes(g, 10, 2.4, 1.3, 0x7a4a05);
      g.fillStyle(0x7a4a05, 1).fillEllipse(13, 13.5, 3.5, 2);
    },
  },
];

export function avatarName(id: string): string {
  return AVATARS.find((a) => a.id === id)?.name ?? AVATARS[0].name;
}

export function isAvatarId(id: string): boolean {
  return AVATARS.some((a) => a.id === id);
}
