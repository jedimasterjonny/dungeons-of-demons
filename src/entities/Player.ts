import Phaser from 'phaser';
import { avatarTexture } from '../systems/avatars';
import { PLAYER } from '../systems/config';
import { gameState } from '../systems/state';

export class Player extends Phaser.Physics.Arcade.Sprite {
  /** Radians. Kept from the last movement input so a standing swing still aims. */
  facing = Math.PI / 2;
  private attackTimer = 0;
  private invulnTimer = 0;
  private hurtFlash = 0;

  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, avatarTexture(gameState.avatar));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(20);
    this.body.setCircle(PLAYER.radius, this.width / 2 - PLAYER.radius, this.height / 2 - PLAYER.radius + 3);
    this.body.setCollideWorldBounds(true);
  }

  /** Puts on whatever avatar is currently chosen. Same size, so nothing else moves. */
  refreshAvatar(): void {
    this.setTexture(avatarTexture(gameState.avatar));
  }

  get hp(): number {
    return gameState.hp;
  }

  get maxHp(): number {
    return gameState.maxHp;
  }

  get isInvulnerable(): boolean {
    return this.invulnTimer > 0;
  }

  get canAttack(): boolean {
    return this.attackTimer <= 0;
  }

  /** Puts the swing on cooldown and reports the angle it went out at. */
  beginSwing(): number {
    this.attackTimer = gameState.attackCooldown;
    return this.facing;
  }

  move(dir: Phaser.Math.Vector2): void {
    if (dir.lengthSq() > 0) {
      dir.normalize().scale(gameState.speed);
      this.facing = Math.atan2(dir.y, dir.x);
      // Flip to face travel direction; the sprite is drawn facing the viewer.
      this.setFlipX(dir.x < -1);
    }
    this.body.setVelocity(dir.x, dir.y);
  }

  /** Returns true if the hit actually landed (i-frames can eat it). */
  takeDamage(amount: number, fromX: number, fromY: number): boolean {
    if (this.invulnTimer > 0) return false;

    gameState.hp -= amount;
    this.invulnTimer = PLAYER.invulnTime;
    this.hurtFlash = 0.18;

    const away = Math.atan2(this.y - fromY, this.x - fromX);
    this.body.setVelocity(Math.cos(away) * 300, Math.sin(away) * 300);

    if (gameState.hp <= 0 && gameState.hasRevenant && !gameState.revenantUsed) {
      gameState.revenantUsed = true;
      gameState.hp = Math.ceil(gameState.maxHp * 0.3);
      this.invulnTimer = PLAYER.invulnTime * 2;
      this.scene.events.emit('revenant');
    }
    return true;
  }

  heal(amount: number): void {
    gameState.hp = Math.min(gameState.maxHp, gameState.hp + amount);
  }

  tick(dt: number): void {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    // A screech wears off while you play, so it lives on the timer, not on a flag.
    gameState.screechTimer = Math.max(0, gameState.screechTimer - dt);

    if (this.hurtFlash > 0) {
      this.setTint(0xff4444);
    } else {
      this.clearTint();
      // Blink through the remaining i-frames so the player can read them.
      this.setAlpha(this.invulnTimer > 0 ? (Math.floor(this.invulnTimer * 20) % 2 ? 0.4 : 1) : 1);
    }

    // Depth-sort against monsters so whoever is lower on screen draws in front.
    this.setDepth(20 + this.y / 1000);
  }
}
