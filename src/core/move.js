// Shared player movement step (used by the browser for prediction and by the Colyseus server as the authority).
// Pure: depends only on the World instance passed in. Units are meters, +Y up, yaw 0 faces -Z.
import { damp } from './util.js';

export const MOVE = { R: 0.34, H: 1.75, HC: 1.3, STEP: 0.5, WALK: 4.6, CROUCH: 2.3, JUMP: 5.0, GRAVITY: 16 };

/**
 * Advance one player by dt seconds.
 * p: {x,y,z,vy,velX,velZ,yaw,crouch,grounded,speed}
 * it: {mx, mz, jump, ads, reloading}  (mx right +, mz forward +, both in [-1,1])
 */
export function stepMove(world, p, it, dt) {
  const sp = (p.crouch ? MOVE.CROUCH : MOVE.WALK) * (it.ads ? 0.6 : 1) * (it.reloading ? 0.85 : 1);
  let mx = it.mx, mz = it.mz;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  const ac = p.grounded ? 14 : 3;
  p.velX = damp(p.velX, (fx * mz + rx * mx) * sp, ac, dt);
  p.velZ = damp(p.velZ, (fz * mz + rz * mx) * sp, ac, dt);
  const px = p.x, pz = p.z;
  world.move(p, p.velX * dt, p.velZ * dt, MOVE.R, p.crouch ? MOVE.HC : MOVE.H, MOVE.STEP);
  p.speed = Math.hypot(p.x - px, p.z - pz) / dt;
  if (it.jump && p.grounded && !p.crouch) { p.vy = MOVE.JUMP; p.grounded = false; }
  p.vy -= MOVE.GRAVITY * dt; p.y += p.vy * dt;
  const gr = world.groundAt(p.x, p.z, 0.3, p.y, 0.5);
  if (p.y <= gr + 0.001 || (p.grounded && p.vy <= 0 && p.y - gr < 0.22)) { p.y = gr; p.vy = 0; p.grounded = true; } else p.grounded = false;
}
