import test from 'node:test';
import assert from 'node:assert/strict';
import { RapierPhysics } from '../src/physics-rapier.ts';
import { stages } from '../src/data/maps.ts';

const dt = 1 / 60;
const finite = (p) => assert.ok([p.x, p.y, p.angle].every(Number.isFinite));
const spawn = (p, n) => {
  for (let id = 0; id < n; id++) p.createMarble(id, 10.25 + id % 10 * 0.6, 5 - Math.floor(id / 10));
};
const run = (name, fn) => test(name, async () => {
  const p = new RapierPhysics();
  await p.init();
  try { await fn(p); } finally { p.dispose(); }
});
const floor = { title: 'test', goalY: 10, zoomY: 9, entities: [{
  type: 'static', position: { x: 0, y: 4 },
  shape: { type: 'box', width: 10, height: 0.05, rotation: 0 },
  props: { density: 1, restitution: 0, angularVelocity: 0 },
}] };
run('all actual maps: shape state and finite positions', (p) => {
  for (const stage of stages) {
    p.clearMarbles(); p.clear(); p.createStage(stage);
    assert.equal(p.getEntities().length, stage.entities.length);
    spawn(p, 100); p.start();
    for (let step = 0; step < 120; step++) p.step(dt);
    for (let id = 0; id < 100; id++) finite(p.getMarblePosition(id));
  }
});
run('inactive marbles, gravity, thin-floor collision, CCD enabled', (p) => {
  p.createStage(floor); p.createMarble(0, 0, 0);
  for (let i = 0; i < 30; i++) p.step(dt);
  assert.equal(p.getMarblePosition(0).y, 0);
  p.start();
  assert.equal(p.marbles.get(0).isCcdEnabled(), true);
  p.marbles.get(0).setLinvel({ x: 0, y: 150 }, true);
  for (let i = 0; i < 120; i++) p.step(dt);
  assert.ok(p.getMarblePosition(0).y > 3);
  assert.ok(p.getMarblePosition(0).y < 4);
});
run('rotating obstacles preserve angular velocity', (p) => {
  p.createStage({ ...floor, entities: [{ ...floor.entities[0], type: 'kinematic', props: { ...floor.entities[0].props, angularVelocity: 2 } }] });
  for (let i = 0; i < 30; i++) p.step(dt);
  assert.ok(Math.abs(p.getEntities()[0].angle - 1) < 0.02);
});
run('impact and removal affect only the intended bodies', (p) => {
  p.createMarble(0, 0, 0); p.createMarble(1, 1, 0); p.createMarble(2, 20, 0);
  p.start(); p.impact(0); p.step(dt);
  assert.ok(p.getMarblePosition(1).x > 1);
  assert.equal(p.getMarblePosition(2).x, 20);
  p.removeMarble(1); p.removeMarble(1);
  p.step(dt); finite(p.getMarblePosition(2));
  assert.equal(p.marbles.size, 2);
});
run('temporary pins and pending deletion are cleared across resets', (p) => {
  const stage = { ...floor, entities: [{ ...floor.entities[0], props: { ...floor.entities[0].props, life: 1 } }] };
  p.createStage(stage); p.createMarble(0, 0, 3.6); p.start();
  for (let i = 0; i < 60 && p.getEntities().length; i++) p.step(dt);
  assert.equal(p.getEntities().length, 0);
  p.clearMarbles(); p.clear(); p.createStage(stage); p.createMarble(0, 0, 0); p.start(); p.step(dt);
  assert.equal(p.getEntities().length, 1);
  assert.equal(p.marbles.size, 1);
});
run('clearMarbles preserves the stage', (p) => {
  p.createStage(floor); spawn(p, 200); p.start();
  for (let i = 0; i < 10; i++) p.step(dt);
  p.clearMarbles(); p.step(dt);
  assert.equal(p.getEntities().length, 1);
  assert.equal(p.marbles.size, 0);
});
run('3000 marbles: repeated reset and dense collisions stay finite', (p) => {
  for (let round = 0; round < 10; round++) {
    p.clearMarbles(); p.clear(); p.createStage(stages[0]); spawn(p, 3000); p.start();
    for (let i = 0; i < 30; i++) p.step(dt);
    for (let id = 0; id < 3000; id++) finite(p.getMarblePosition(id));
    assert.equal(p.marbles.size, 3000);
  }
});
run('sprite angles stay continuous across Rapier angle wrapping', (p) => {
  p.createMarble(0, 0, 0); p.start();
  p.marbles.get(0).setAngvel(10, true);
  let previous = 0;
  for (let step = 0; step < 120; step++) {
    p.step(dt);
    const angle = p.getMarblePosition(0).angle;
    assert.ok(Math.abs(angle - previous) < 0.3);
    previous = angle;
  }
  assert.ok(previous > 19);
});
run('3000 densely packed marbles plus repeated impact stay finite', (p) => {
  const cup = { ...floor, entities: [floor.entities[0], ...[-10, 10].map(x => ({ ...floor.entities[0], position: { x, y: -10 }, shape: { type: 'box', width: 0.1, height: 20, rotation: 0 } }))] };
  p.createStage(cup);
  for (let id = 0; id < 3000; id++) p.createMarble(id, -9 + id % 36 * 0.5, 3.5 - Math.floor(id / 36) * 0.5);
  p.start();
  for (let step = 0; step < 300; step++) {
    if (step % 30 === 0) p.impact(step);
    p.step(dt);
  }
  for (let id = 0; id < 3000; id++) finite(p.getMarblePosition(id));
});
run('actual map reaches a goal without async removal timers', (p) => {
  p.createStage(stages[0]); spawn(p, 30); p.start();
  let winner = false;
  for (let step = 0; step < 8000 && !winner; step++) {
    p.step(dt);
    for (let id = 0; id < 30; id++) {
      const pos = p.getMarblePosition(id); finite(pos);
      if (pos.y > stages[0].goalY) { winner = true; p.removeMarble(id); break; }
    }
  }
  assert.equal(winner, true);
});
