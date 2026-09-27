import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepClock } from '../src/fixed-step-clock.ts';

for (const speed of [1, 2, 5]) test(`60Hz fixed steps at ${speed}x`, () => {
  const clock = new FixedStepClock();
  let steps = 0;
  for (let frame = 0; frame <= 60; frame++) clock.advance(frame * 1000 / 60, speed, () => steps++);
  assert.equal(steps, 60 * speed);
  assert.equal(clock.droppedMs, 0);
});
test('25ms frame at 5x retains 125ms instead of discarding 100ms', () => {
  const clock = new FixedStepClock();
  clock.advance(0, 5, () => {});
  assert.equal(clock.advance(25, 5, () => {}), 7);
  assert.equal(clock.droppedMs, 0);
  assert.ok(Math.abs(clock.interpolation - 0.5) < 1e-6);
});
test('long stall is bounded, reset clears backlog', () => {
  const clock = new FixedStepClock();
  clock.advance(0, 5, () => {});
  assert.equal(clock.advance(10000, 5, () => {}), 12);
  assert.ok(clock.droppedMs > 49000);
  assert.ok(clock.interpolation <= 1);
  clock.reset();
  assert.equal(clock.advance(20000, 5, () => {}), 0);
  assert.equal(clock.droppedMs, 0);
});
