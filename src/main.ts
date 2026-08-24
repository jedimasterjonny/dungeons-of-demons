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
import { music } from './systems/music';
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

/**
 * The theme tune is global rather than per scene, so it plays straight through the
 * title, the dungeon, the shop and the story without restarting at every door.
 *
 * It cannot simply be started here: a browser keeps audio suspended until the page
 * has had a real key or click, so the first input is what actually starts it.
 */
let audioWoken = false;
const wake = (): void => {
  if (audioWoken) return;
  audioWoken = true;
  if (!gameState.musicOff) music.start();
};

window.addEventListener('pointerdown', wake);
window.addEventListener('keydown', (e: KeyboardEvent) => {
  wake();
  if (e.key !== 'm' && e.key !== 'M') return;
  // M is deliberately not a Phaser key: it works from every scene, including the
  // shop and the story, without each one having to bind it.
  gameState.musicOff = !music.toggle();
  gameState.save();
});

// Debug handles: poke at scenes and progression from the browser console.
Object.assign(window as unknown as Record<string, unknown>, {
  __game: game,
  __state: gameState,
  __music: music,
});
