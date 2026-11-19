import type { Tile } from '../levels/index.ts';
import { headingOffsets, type BoundaryBlock, type Event } from './plan.ts';
import { BOUNDARY_REACTION_MS, GOAL_REACTION_MS, VICTORY_DANCE_MS, boundaryApproach, boundaryPose, dancePose, missedGoalPose } from './reactions.ts';

type MoveStep = Extract<Event, { kind: 'moveStep' }>;
type OtherEvent = Exclude<Event, MoveStep>;
export type Motion =
  | Readonly<{ kind: 'flight'; event: MoveStep; fraction: number; speed: number }>
  | Readonly<{ kind: 'boundary'; event: BoundaryBlock; pose: ReturnType<typeof boundaryPose> }>
  | Readonly<{ kind: 'effect'; event: OtherEvent; fraction: number }>;

type Callbacks = {
  begin(event: Event, previous?: Event): void;
  motion(frame?: Motion): void;
  commit(event: Event): void;
  end(): void;
};

type Clip = { kind: 'flight'; steps: MoveStep[]; boundary?: BoundaryBlock } | { kind: 'event'; event: OtherEvent };

function groupEvents(events: readonly Event[]): Clip[] {
  const clips: Clip[] = [];
  for (const event of events) {
    const previous = clips.at(-1);
    const first = previous?.kind === 'flight' ? previous.steps[0] : undefined;
    if (event.kind === 'blocked' && event.reason === 'bounds') {
      if (previous?.kind === 'flight' && first?.direction === event.direction && first.span === event.span) {
        previous.boundary = event;
      } else {
        clips.push({ kind: 'flight', steps: [], boundary: event });
      }
      continue;
    }
    if (event.kind !== 'moveStep') {
      clips.push({ kind: 'event', event });
      continue;
    }
    if (previous?.kind === 'flight' && first?.direction === event.direction && first.span === event.span) {
      previous.steps.push(event);
    } else {
      clips.push({ kind: 'flight', steps: [event] });
    }
  }
  return clips;
}

const TILE_MS = 420;
const ACCELERATION_MS = 135;

/** Ease into and out of the whole command, with constant speed across interior tiles. */
function flightAt(elapsed: number, tiles: number) {
  const duration = tiles * TILE_MS;
  const ramp = ACCELERATION_MS;
  const rate = tiles / (duration - ramp);
  const remaining = Math.max(0, duration - elapsed);
  if (elapsed < ramp) return { distance: rate * elapsed ** 2 / (2 * ramp), speed: elapsed / ramp };
  if (remaining < ramp) return { distance: tiles - rate * remaining ** 2 / (2 * ramp), speed: remaining / ramp };
  return { distance: rate * (elapsed - ramp / 2), speed: 1 };
}

function boundaryAt(elapsed: number, tiles: number, event: BoundaryBlock) {
  const contact = boundaryApproach(event.direction);
  const duration = tiles * TILE_MS;
  const ramp = tiles ? ACCELERATION_MS : 115;
  const rate = tiles ? tiles / (duration - ramp / 2) : 2 * contact / ramp;
  const hitTime = tiles ? duration + contact / rate : ramp;
  const carry = tiles ? 1 : .45;
  if (elapsed >= hitTime) {
    const time = elapsed - hitTime;
    const pose = boundaryPose(time, rate, contact);
    pose.carry *= carry;
    return { distance: tiles, speed: carry, pose, hit: true, done: time >= BOUNDARY_REACTION_MS };
  }
  const speed = Math.min(1, elapsed / ramp);
  const travel = elapsed < ramp ? rate * elapsed ** 2 / (2 * ramp) : rate * (elapsed - ramp / 2);
  if (travel < tiles) return { distance: travel, speed };
  const pose = { ...boundaryPose(0, rate, contact), offset: travel - tiles, carry: carry * speed };
  return { distance: tiles, speed, pose };
}

export function visualPosition(position: Tile, motion?: Motion): Tile {
  if (motion?.kind === 'boundary') {
    const { x, y } = headingOffsets[motion.event.direction];
    return { x: position.x + x * motion.pose.offset, y: position.y + y * motion.pose.offset };
  }
  if (motion?.kind !== 'flight') return position;
  const { from, state } = motion.event;
  return {
    x: from.x + (state.position.x - from.x) * motion.fraction,
    y: from.y + (state.position.y - from.y) * motion.fraction,
  };
}

export function failurePose(motion?: Motion) {
  if (motion?.kind === 'boundary') return motion.pose;
  if (motion?.kind === 'effect' && motion.event.kind === 'completed' && !motion.event.success && motion.event.reason === 'goal') {
    return missedGoalPose(motion.fraction * GOAL_REACTION_MS);
  }
}

export function victoryPose(motion?: Motion) {
  if (motion?.kind === 'effect' && motion.event.kind === 'completed' && motion.event.success) {
    return dancePose(motion.fraction * VICTORY_DANCE_MS);
  }
}

function effectDuration(event: OtherEvent, reduced: boolean) {
  if (event.kind === 'runtimeError') return 0;
  if (event.kind === 'completed') {
    if (reduced) return 0;
    if (event.success) return VICTORY_DANCE_MS;
    return event.reason === 'goal' ? GOAL_REACTION_MS : 0;
  }
  if (event.kind === 'harvest') return reduced ? 85 : 525;
  if (event.kind === 'trayPlanted' && event.used) return reduced ? 100 : 150 + 52 * event.used;
  if (event.kind === 'batteryPercentReported') return reduced ? 180 : 400;
  return reduced ? 35 : 170;
}

export class Playback {
  private request?: number;
  private version = 0;
  private lastTime?: number;
  constructor() { document.addEventListener('visibilitychange', this.visibility); }
  private visibility = () => { this.lastTime = undefined; };

  play(events: readonly Event[], reduced: boolean, callbacks: Callbacks) {
    this.cancel();
    const version = this.version;
    const clips = groupEvents(events);
    let index = 0;
    let elapsed = 0;
    let crossings = 0;
    let started = false;
    let committed = false;
    let previous: Event | undefined;

    const commit = (event: Event) => {
      callbacks.commit(event);
      previous = event;
    };
    const advance = (preserveMotion = false) => {
      if (!preserveMotion) callbacks.motion();
      index++;
      elapsed = 0;
      crossings = 0;
      started = false;
      committed = false;
    };

    const tick = (now: number) => {
      if (version !== this.version) return;
      this.request = undefined;
      if (document.hidden) {
        this.lastTime = undefined;
      } else {
        const clip = clips[index];
        if (!clip) {
          callbacks.end();
          return;
        }
        if (!started) {
          started = true;
          this.lastTime = now;
          callbacks.begin(clip.kind === 'flight' ? clip.steps[0] ?? clip.boundary! : clip.event, previous);
        }
        elapsed += this.lastTime === undefined ? 0 : Math.min(50, now - this.lastTime);
        this.lastTime = now;
        if (clip.kind === 'flight') {
          const { steps, boundary } = clip;
          const approach = boundary && !reduced ? boundaryAt(elapsed, steps.length, boundary) : undefined;
          const { distance, speed } = approach ?? flightAt(elapsed, steps.length);
          // Publish charge and grid position only as each center is crossed.
          while (crossings < Math.floor(distance)) commit(steps[crossings++]);
          if (approach?.pose) {
            callbacks.motion({ kind: 'boundary', event: boundary!, pose: approach.pose });
            if (approach.hit && !committed) {
              committed = true;
              commit(boundary!);
            }
            if (approach.done) advance(true);
          } else if (crossings === steps.length) {
            if (boundary) commit(boundary);
            advance();
          } else callbacks.motion({ kind: 'flight', event: steps[crossings], fraction: distance - crossings, speed });
        } else {
          const { event } = clip;
          const duration = effectDuration(event, reduced);
          const fraction = duration ? Math.min(1, elapsed / duration) : 1;
          if (!reduced && fraction < 1 && (event.kind === 'harvest' || event.kind === 'completed' && duration > 0 || event.kind === 'trayPlanted' && event.used)) {
            callbacks.motion({ kind: 'effect', event, fraction });
          }
          // Start the victory celebration with the dance and keep percentage commands highlighted after reporting.
          const commitAtStart = event.kind === 'batteryPercentReported' || (event.kind === 'completed' && event.success);
          if (!committed && (fraction === 1 || commitAtStart)) {
            committed = true;
            commit(event);
          }
          if (fraction === 1) advance();
        }
      }
      if (version === this.version) this.request = requestAnimationFrame(tick);
    };
    this.request = requestAnimationFrame(tick);
  }

  cancel() {
    this.version++;
    this.lastTime = undefined;
    if (this.request !== undefined) cancelAnimationFrame(this.request);
    this.request = undefined;
  }
  dispose() { this.cancel(); document.removeEventListener('visibilitychange', this.visibility); }
}
