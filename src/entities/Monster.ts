import Phaser from 'phaser';
import { FLOOR, MONSTERS, type MonsterKind, type MonsterStats } from '../systems/config';

export class Monster extends Phaser.Physics.Arcade.Sprite {
  readonly stats: MonsterStats;
  readonly kind: MonsterKind;
  hp: number;
  maxHp: number;
  damage: number;
  coinValue: number;

  /** Set while knocked back, so AI steering doesn't fight the impulse. */
  private stunTimer = 0;
  private hitFlash = 0;
  private aggro = false;
  private bobSeed: number;

  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: MonsterKind, floor: number) {
    super(scene, x, y, kind);
    this.kind = kind;
    this.stats = MONSTERS[kind];

    const hpScale = 1 + FLOOR.hpScalePerFloor * (floor - 1);
    const dmgScale = 1 + FLOOR.damageScalePerFloor * (floor - 1);
    const coinScale = 1 + FLOOR.coinScalePerFloor * (floor - 1);

    this.maxHp = Math.round(this.stats.maxHp * hpScale);
    this.hp = this.maxHp;
    this.damage = Math.round(this.stats.damage * dmgScale);
    this.coinValue = Math.round(
      Phaser.Math.Between(this.stats.coinDrop[0], this.stats.coinDrop[1]) * coinScale
    );
    this.bobSeed = Math.random() * Math.PI * 2;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setTint(this.stats.tint);
    this.body.setCircle(
      this.stats.radius,
      this.width / 2 - this.stats.radius,
      this.height / 2 - this.stats.radius + 2
    );
    this.body.setCollideWorldBounds(true);
    this.body.setBounce(0.2);
  }

  get isAggro(): boolean {
    return this.aggro;
  }

  /** Returns true if this hit killed it. */
  takeDamage(amount: number, fromAngle: number): boolean {
    this.hp -= amount;
    this.hitFlash = 0.12;
    this.stunTimer = 0.18;
    this.aggro = true;

    const knock = this.kind === 'brute' ? 150 : 280;
    this.body.setVelocity(Math.cos(fromAngle) * knock, Math.sin(fromAngle) * knock);
    return this.hp <= 0;
  }

  tick(dt: number, target: Phaser.Math.Vector2): void {
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    this.setTint(this.hitFlash > 0 ? 0xffffff : this.stats.tint);

    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    // Aggro is sticky: once it has seen you, it keeps coming.
    if (dist < this.stats.aggroRange) this.aggro = true;

    if (this.stunTimer > 0) return;

    if (this.aggro) {
      const angle = Math.atan2(target.y - this.y, target.x - this.x);
      // Wraiths weave rather than beeline, which makes them harder to corner.
      const weave = this.kind === 'wraith' ? Math.sin(this.scene.time.now / 260 + this.bobSeed) * 0.5 : 0;
      const heading = angle + weave;
      this.body.setVelocity(
        Math.cos(heading) * this.stats.speed,
        Math.sin(heading) * this.stats.speed
      );
      this.setFlipX(target.x < this.x);
    } else {
      // Idle drift so a sleeping room still feels alive.
      const drift = Math.sin(this.scene.time.now / 900 + this.bobSeed);
      this.body.setVelocity(drift * 18, Math.cos(this.scene.time.now / 1100 + this.bobSeed) * 18);
    }

    this.setDepth(20 + this.y / 1000);
  }
}
