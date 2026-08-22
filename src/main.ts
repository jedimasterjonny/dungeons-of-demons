import Phaser from 'phaser';
import { AvatarScene } from './scenes/AvatarScene';
import { BootScene } from './scenes/BootScene';
import { DungeonScene } from './scenes/DungeonScene';
import { GameOverScene } from './scenes/GameOverScene';
import { HudScene } from './scenes/HudScene';
import { ShopScene } from './scenes/ShopScene';
import { StoryScene } from './scenes/StoryScene';
import { TitleScene } from './scenes/TitleScene';
import { WORLD } from './systems/config';
import { gameState } from './systems/state';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WORLD.viewWidth,
  height: WORLD.viewHeight,
  backgroundColor: '#0a0a0f',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, TitleScene, DungeonScene, HudScene, ShopScene, AvatarScene, StoryScene, GameOverScene],
});

// Debug handles: poke at scenes and progression from the browser console.
Object.assign(window as unknown as Record<string, unknown>, { __game: game, __state: gameState });
