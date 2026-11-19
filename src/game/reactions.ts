import type { Heading } from './plan.ts';

export type ReactionPose = Readonly<{
  yaw: number;
  lift: number;
  sadness: number;
  surprise: number;
}>;

const progress = (time: number, start: number, end: number) => Math.max(0, Math.min(1, (time - start) / (end - start)));
const smooth = (t: number) => t * t * (3 - 2 * t);
const shake = (t: number) => -.41 * Math.sin(2 * Math.PI * t) * Math.sin(Math.PI * t) ** .7;

export const SAD_DIP = .055;
export const GOAL_REACTION_MS = 1160;
export const BOUNDARY_REACTION_MS = 2200;
export const VICTORY_DANCE_MS = 1460;
export const boundaryApproach = (direction: Heading) => ({ East: .085, West: .085, North: .185, South: .235 })[direction];

export function dancePose(time: number) {
  const beat = (start: number, end: number) => Math.sin(Math.PI * progress(time, start, end)) ** 2;
  const leftHop = beat(0, 520), rightHop = beat(480, 1030), bow = beat(1030, VICTORY_DANCE_MS);
  return {
    lift: .36 * leftHop + .30 * rightHop - .075 * bow,
    bank: .24 * (leftHop - rightHop),
    yaw: -.28 * leftHop + .28 * rightHop,
    pitch: -.19 * bow,
  };
}

export function missedGoalPose(time: number): ReactionPose {
  const sadness = smooth(progress(time, 55, 380));
  return {
    yaw: shake(progress(time, 255, 1065)),
    lift: -SAD_DIP * sadness,
    sadness,
    surprise: 0,
  };
}

export function boundaryPose(time: number, speed: number, contact: number) {
  const stretch = .225;
  // The compression starts at the incoming speed and decelerates to rest.
  const compression = 1 - (1 - progress(time, 0, 325)) ** (speed * 325 / stretch);
  const release = smooth(progress(time, 373, 696));
  const flex = compression * (1 - release);
  const coast = progress(time, 696, 1125);
  const recovery = Math.sin(Math.PI * coast) * (1 - coast);
  const oscillation = Math.sin(2 * Math.PI * coast) * (1 - coast) ** 2;
  const sadness = smooth(progress(time, 1125, 1450));
  return {
    offset: (contact + stretch * flex) * (1 - smooth(coast)) - .11 * recovery,
    bend: stretch * flex - .075 * oscillation,
    opacity: .94 * smooth(progress(time, 0, 130)) * (1 - smooth(progress(time, 515, 980))),
    carry: 1 - smooth(progress(time, 0, 510)),
    bank: .065 * flex - .12 * recovery + .035 * oscillation,
    lift: -.02 * flex + .045 * recovery - SAD_DIP * sadness,
    yaw: shake(progress(time, 1400, BOUNDARY_REACTION_MS)),
    sadness,
    surprise: smooth(progress(time, 0, 145)) * (1 - sadness),
  };
}
