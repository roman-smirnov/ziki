import assert from 'node:assert/strict';
import { test } from 'node:test';
import { failurePose, Playback, victoryPose, visualPosition } from '../src/game/playback.ts';
import { planRun, startState } from '../src/game/plan.ts';
import { levels } from '../src/levels/index.ts';

function recordPlayback(t, code, level = levels[0], reduced = false) {
  const fixture = level.fixture;
  const { events } = planRun(level, fixture, code);
  let frame;
  const globals = {
    document: Object.assign(new EventTarget(), { hidden: false }),
    requestAnimationFrame(callback) { frame = callback; return 1; },
    cancelAnimationFrame() { frame = undefined; },
  };
  const original = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.assign(globalThis, globals);
  const playback = new Playback();
  t.after(() => {
    playback.dispose();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  let state = startState(fixture), motion;
  const samples = [], committed = [];
  playback.play(events, reduced, {
    begin() {},
    motion(next) { motion = next; },
    commit(event) { state = event.state; committed.push(event); },
    end() {},
  });
  for (let time = 0; frame && time < 12_000; time += 5) {
    const tick = frame;
    frame = undefined;
    tick(time);
    samples.push({ time, state, motion, position: visualPosition(state.position, motion), pose: failurePose(motion), lastEvent: committed.at(-1) });
  }
  assert.equal(frame, undefined, 'playback finishes');
  return { samples, committed };
}

function assertGradualFrown(samples) {
  const poses = samples.flatMap(({ pose }) => pose ? [pose] : []);
  const firstTurn = poses.find(({ yaw }) => Math.abs(yaw) > .05);
  assert.ok(firstTurn?.sadness > .5, 'the expression is already changing when the head starts to turn');
  assert.ok(poses.some(({ yaw, sadness }) => yaw < -.15 && sadness > .5));
  assert.ok(poses.some(({ yaw, sadness }) => yaw > .15 && sadness > .5));
  const weights = poses.map(({ sadness }) => sadness);
  assert.ok(new Set(weights.filter(weight => weight > 0 && weight < 1)).size > 5);
  assert.ok(weights.every((weight, i) => i === 0 || weight >= weights[i - 1] && weight - weights[i - 1] < .04));
  assert.equal(weights.at(-1), 1);
}

test('An elastic edge keeps the approach speed through contact and commits only valid tiles', t => {
  const { samples, committed } = recordPlayback(t, 'Move(7); Move(-2);');
  const hit = samples.findIndex(({ motion }) => motion?.kind === 'boundary' && motion.pose.bend > 0);
  assert.ok(hit > 0);
  const previous = samples[hit - 1].position.x - samples[hit - 2].position.x;
  const atContact = samples[hit].position.x - samples[hit - 1].position.x;
  assert.ok(atContact > previous * .9, 'Ziki slows after contact');
  assert.deepEqual(committed.filter(event => event.kind === 'moveStep').map(event => event.state.position.x), [1, 2, 3, 4, 5]);
  assert.deepEqual(committed.slice(-2).map(event => event.reason), ['bounds', 'bounds']);
  assert.deepEqual(samples.at(-1).position, { x: 5, y: 0 });
  assertGradualFrown(samples);
  assert.ok(samples.every(({ motion, pose }) => !pose || motion.kind === 'boundary'), 'the boundary plays its own reaction once');
  assert.ok(samples.slice(0, hit).every(({ pose }) => !pose?.surprise));
  const poses = samples.slice(hit).filter(({ pose }) => pose).map(({ pose }) => pose);
  const surprised = poses.findIndex(({ surprise }) => surprise === 1);
  const firstFrown = poses.findIndex(({ sadness }) => sadness > 0);
  assert.ok(surprised > 0 && surprised < firstFrown, 'Ziki looks surprised before becoming sad');
  assert.ok(poses.slice(0, surprised).some(({ surprise }) => surprise > 0 && surprise < 1));
  assert.ok(poses.some(({ sadness, surprise }) => sadness > 0 && surprise > 0));
  assert.ok(poses.every(({ sadness, surprise }) => sadness + surprise <= 1));
  assert.equal(poses.at(-1).surprise, 0);
});

test('An in-bounds miss starts the frown before the head shake at the final tile', t => {
  const { samples, committed } = recordPlayback(t, 'Move(1); Move(1);');
  const motion = samples.filter(sample => sample.pose);
  assert.ok(motion.length > 0 && motion.every(({ position }) => position.x === 2));
  assertGradualFrown(motion);
  assert.ok(motion.every(({ pose }) => pose.surprise === 0));
  assert.equal(committed.at(-1).reason, 'goal');
  assert.ok(motion.every(({ motion }) => motion.kind === 'effect'));
});

test('Reduced motion keeps the result and omits the boundary reaction', t => {
  const { samples, committed } = recordPlayback(t, 'Move(-1);', levels[0], true);
  assert.ok(samples.every(({ pose, position }) => !pose && position.x === 0));
  assert.deepEqual(committed.map(event => event.reason), ['bounds', 'bounds']);
});

test('A runtime error commits after the last valid crossing and stops playback', t => {
  const { samples, committed } = recordPlayback(t, 'Move(1);\nint divisor = 0;\nMove(4 / divisor);\nMove(3);');
  assert.deepEqual(committed.map(event=>event.kind),['moveStep','runtimeError']);
  assert.deepEqual(committed.map(event=>event.state.position.x),[1,1]);
  assert.equal(committed.at(-1).span.line,3);
  assert.ok(samples.some(sample=>sample.lastEvent?.kind==='moveStep' && sample.position.x===1));
  assert.equal(samples.at(-1).position.x,1);
});

test('Victory starts with the dance and keeps Ziki above the harvested tile', t => {
  const { samples, committed } = recordPlayback(t, 'Move(3);');
  const dancing = samples.filter(({ motion }) => victoryPose(motion));
  assert.ok(dancing.length > 0);
  assert.ok(dancing.every(({ lastEvent, position }) =>
    lastEvent?.kind === 'completed' && lastEvent.success && position.x === 3 && position.y === 0));
  const poses = dancing.map(({ motion }) => victoryPose(motion));
  assert.ok(poses.some(({ lift, bank }) => lift > .25 && bank > .15));
  assert.ok(poses.some(({ lift, bank }) => lift > .25 && bank < -.15));
  assert.ok(poses.some(({ pitch }) => pitch < -.15));
  assert.equal(victoryPose(samples.at(-1).motion), undefined);
  assert.deepEqual(committed.slice(-2).map(event => event.kind), ['harvest', 'completed']);
});

test('Reduced motion completes the harvest with a static celebration', t => {
  const { samples, committed } = recordPlayback(t, 'Move(3);', levels[0], true);
  assert.ok(samples.every(({ motion }) => !victoryPose(motion)));
  assert.equal(committed.at(-1).success, true);
});
