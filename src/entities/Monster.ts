import Phaser from 'phaser';
import { damageFor, maxHpFor } from '../systems/combat';
import { FLOOR, MONSTERS, SCREECH, type MonsterKind, type MonsterStats } from '../systems/config';

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
  /** Counts down to the next scream. Staggered at spawn so a room never screams in unison. */
  private screechCooldown: number;

  /** In a cage: it cannot move or hurt anybody, but it can still be hit through the bars. */
  caged = false;

  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: MonsterKind, floor: number) {
    super(scene, x, y, kind);
    this.kind = kind;
    this.stats = MONSTERS[kind];

    const coinScale = 1 + FLOOR.coinScalePerFloor * (floor - 1);

    this.maxHp = maxHpFor(this.stats, floor);
    this.hp = this.maxHp;
    this.damage = damageFor(this.stats, floor);
    this.coinValue = Math.round(
      Phaser.Math.Between(this.stats.coinDrop[0], this.stats.coinDrop[1]) * coinScale
    );
    this.bobSeed = Math.random() * Math.PI * 2;
    this.screechCooldown = 1.5 + Math.random() * SCREECH.cooldown;

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

  get canScreech(): boolean {
    return this.stats.screecher;
  }

  /**
   * Plants its feet and screams. The scene listens for this and decides what the
   * noise does to the player — that way earmuffs are checked in exactly one place.
   */
  private screech(): void {
    this.screechCooldown = SCREECH.cooldown;
    // Reuse the stun timer: it stops steering, so the scream is also your opening.
    this.stunTimer = SCREECH.windUp;
    this.body.setVelocity(0, 0);
    this.scene.events.emit('screech', this);
  }

  /** Returns true if this hit killed it. */
  takeDamage(amount: number, fromAngle: number): boolean {
    this.hp -= amount;
    this.hitFlash = 0.12;
    this.stunTimer = 0.18;
    this.aggro = true;

    // A boss barely rocks; a brute rocks a little; everything else flies. Unless it is
    // in a cage, where the bars stop it going anywhere.
    const knock = this.caged ? 0 : this.stats.boss ? 55 : this.kind === 'brute' ? 150 : 280;
    this.body.setVelocity(Math.cos(fromAngle) * knock, Math.sin(fromAngle) * knock);
    return this.hp <= 0;
  }

  tick(dt: number, target: Phaser.Math.Vector2): void {
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.screechCooldown = Math.max(0, this.screechCooldown - dt);

    // FILL flashes a solid silhouette, which reads on full-colour sprites too. Since
    // Phaser 4, setTint() no longer drops you out of FILL, so the mode is put back
    // to MULTIPLY explicitly — otherwise every demon stays a white blob after a hit.
    if (this.hitFlash > 0) this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else {
      this.setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.stats.tint === 0xffffff) this.clearTint();
      else this.setTint(this.stats.tint);
    }

    if (this.caged) {
      this.body.setVelocity(0, 0);
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    // Aggro is sticky: once it has seen you, it keeps coming.
    if (dist < this.stats.aggroRange) this.aggro = true;

    if (this.stunTimer > 0) return;

    if (this.aggro) {
      if (this.stats.screecher && this.screechCooldown <= 0 && dist < SCREECH.range) {
        this.screech();
        return;
      }

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
