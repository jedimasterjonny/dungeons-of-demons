/**
 * Pure combat maths, kept out of the scene so it can be reasoned about and tested
 * without booting Phaser.
 */

export interface Point {
  x: number;
  y: number;
}

/** Wraps an angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

/**
 * True when `target` falls inside the wedge swept by a swing: within reach
 * (measured to the target's edge, so big monsters are easier to clip) and within
 * `arcRad` either side of where the attacker is facing.
 */
export function isInSwingArc(
  from: Point,
  facing: number,
  target: Point,
  targetRadius: number,
  range: number,
  arcRad: number
): boolean {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range + targetRadius) return false;
  // Standing inside the target means the swing always connects; the angle to a
  // point you are on top of is meaningless.
  if (dist < 1e-6) return true;
  return Math.abs(wrapAngle(Math.atan2(dy, dx) - facing)) <= arcRad;
}

/** Monster stat scaling for a given floor. Floor 1 is the unscaled baseline. */
export function scaleForFloor(base: number, perFloor: number, floor: number): number {
  return base * (1 + perFloor * (floor - 1));
}
