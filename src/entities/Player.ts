import Phaser from 'phaser';
import { avatarTexture } from '../systems/avatars';
import { COOP, PLAYER } from '../systems/config';
import { type PlayerState } from '../systems/state';

export class Player extends Phaser.Physics.Arcade.Sprite {
  /** Radians. Kept from the last movement input so a standing swing still aims. */
  facing = Math.PI / 2;
  private attackTimer = 0;
  private invulnTimer = 0;
  private hurtFlash = 0;

  declare body: Phaser.Physics.Arcade.Body;

  /**
   * Every player owns the slice of state that is theirs — health, gear, crates. The
   * sprite never reaches for a global, so a second player is just a second one of
   * these rather than a special case threaded through the scene.
   *
   * Called `sheet`, as in character sheet, because Phaser's GameObject already owns
   * a property called `state` and shadowing it breaks every physics signature.
   */
  constructor(scene: Phaser.Scene, x: number, y: number, readonly sheet: PlayerState) {
    super(scene, x, y, avatarTexture(sheet.avatar));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(20);
    this.body.setCircle(PLAYER.radius, this.width / 2 - PLAYER.radius, this.height / 2 - PLAYER.radius + 3);
    this.body.setCollideWorldBounds(true);
  }

  /** Puts on whatever avatar is currently chosen. Same size, so nothing else moves. */
  refreshAvatar(): void {
    this.setTexture(avatarTexture(this.sheet.avatar));
  }

  get hp(): number {
    return this.sheet.hp;
  }

  get maxHp(): number {
    return this.sheet.maxHp;
  }

  get isDowned(): boolean {
    return this.sheet.downed;
  }

  get isInvulnerable(): boolean {
    return this.invulnTimer > 0;
  }

  get canAttack(): boolean {
    return this.attackTimer <= 0 && !this.sheet.downed;
  }

  /** Puts the swing on cooldown and reports the angle it went out at. */
  beginSwing(): number {
    this.attackTimer = this.sheet.attackCooldown;
    return this.facing;
  }

  move(dir: Phaser.Math.Vector2): void {
    // A downed player is lying on the floor. They keep their sprite and their
    // position — that is what the other player has to walk to — but not their legs.
    if (this.sheet.downed) {
      this.body.setVelocity(0, 0);
      return;
    }
    if (dir.lengthSq() > 0) {
      dir.normalize().scale(this.sheet.speed);
      this.facing = Math.atan2(dir.y, dir.x);
      // Flip to face travel direction; the sprite is drawn facing the viewer.
      this.setFlipX(dir.x < -1);
    }
    this.body.setVelocity(dir.x, dir.y);
  }

  /**
   * Returns true if the hit actually landed (i-frames can eat it).
   *
   * `canBeDowned` is the co-op rule: with someone else still standing you go down
   * instead of dying, and they can pick you up. Alone, there is nobody coming, so
   * running out of health is simply death and the scene ends the run.
   */
  takeDamage(amount: number, fromX: number, fromY: number, canBeDowned = false): boolean {
    if (this.invulnTimer > 0 || this.sheet.downed) return false;

    // Armour is applied here rather than at each call site, so every source of
    // damage in the game goes through it exactly once.
    this.sheet.hp -= amount * this.sheet.damageMultiplier;
    this.invulnTimer = PLAYER.invulnTime;
    this.hurtFlash = 0.18;

    const away = Math.atan2(this.y - fromY, this.x - fromX);
    this.body.setVelocity(Math.cos(away) * 300, Math.sin(away) * 300);

    if (this.sheet.hp <= 0 && this.sheet.hasRevenant && !this.sheet.revenantUsed) {
      this.sheet.revenantUsed = true;
      this.sheet.hp = Math.ceil(this.sheet.maxHp * 0.3);
      this.invulnTimer = PLAYER.invulnTime * 2;
      this.scene.events.emit('revenant', this);
      return true;
    }

    // Revenant first, then being downed: a free life is worth more than a rescue,
    // and spending it means your partner does not have to come for you at all.
    if (this.sheet.hp <= 0 && canBeDowned) {
      this.sheet.hp = 0;
      this.sheet.downed = true;
      this.sheet.rescueProgress = 0;
      this.body.setVelocity(0, 0);
      this.scene.events.emit('downed', this);
    }
    return true;
  }

  /** Brought back by the other player, on their feet with a share of their health. */
  revive(): void {
    this.sheet.downed = false;
    this.sheet.rescueProgress = 0;
    this.sheet.hp = Math.max(1, Math.ceil(this.sheet.maxHp * COOP.reviveHealth));
    // A moment of mercy, so you are not knocked straight back down by the demon
    // that was standing over you.
    this.invulnTimer = PLAYER.invulnTime * 3;
    this.setAngle(0);
  }

  heal(amount: number): void {
    this.sheet.hp = Math.min(this.sheet.maxHp, this.sheet.hp + amount);
  }

  tick(dt: number): void {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    // A screech wears off while you play, so it lives on the timer, not on a flag.
    this.sheet.screechTimer = Math.max(0, this.sheet.screechTimer - dt);

    // Lying down reads instantly at a glance, which matters when the other player
    // has to spot you across a room.
    this.setAngle(this.sheet.downed ? 90 : 0);

    if (this.hurtFlash > 0) {
      this.setTint(0xff4444);
    } else if (this.sheet.downed) {
      this.setTint(0x6b6478);
      this.setAlpha(1);
    } else {
      // clearTint(), not setTint(white): an avatar drawn in full colour must come
      // back to its own colours, and white is only a no-op for the drawn-white ones.
      this.clearTint();
      // Blink through the remaining i-frames so the player can read them.
      this.setAlpha(this.invulnTimer > 0 ? (Math.floor(this.invulnTimer * 20) % 2 ? 0.4 : 1) : 1);
    }

    // Depth-sort against monsters so whoever is lower on screen draws in front.
    this.setDepth(20 + this.y / 1000);
  }
}
