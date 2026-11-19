import { asNumber, double, execute, int, printable, roundEven, type Value } from '../code/evaluator.ts';
import { Diagnostic, fail, parseProgram, quoteName, type Call, type Span } from '../code/parser.ts';
import { CHARGE_PER_METER, type Command, type Fixture, type Level, type Rose, type Sensor, type Tile } from '../levels/index.ts';

const MAX_STEPS = 256;
export type Heading = 'East' | 'West' | 'North' | 'South';
export const headingOffsets: Record<Heading, Tile> = { East: { x: 1, y: 0 }, West: { x: -1, y: 0 }, North: { x: 0, y: 1 }, South: { x: 0, y: -1 } };
export const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;
export const routeCost = (from: Tile, to: Tile) => Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
export type RunState = {
  position: Tile;
  charge?: number;
  percent?: number;
  harvested: readonly Rose['id'][];
  seeds: number;
  planted: number;
  trace: readonly Tile[];
};
export const rangeOf = (charge?: number) => charge === undefined ? undefined : Math.floor(charge / CHARGE_PER_METER);
export const rawPercent = (fixture: Fixture, charge = fixture.battery?.startCharge ?? 0) =>
  fixture.battery ? (100 * charge) / fixture.battery.capacity : undefined;
export const startState = (fixture: Fixture): RunState => ({
  position: fixture.dock, charge: fixture.battery?.startCharge, percent: rawPercent(fixture),
  harvested: [], seeds: 0, planted: 0, trace: [fixture.dock],
});
export const percentText = (value: number) => `${String(value)}%`;
type Payload =
  | { kind: 'moveStep'; from: Tile; direction: Heading }
  | { kind: 'harvest'; rose: Rose }
  | { kind: 'print' | 'batteryConfigured' | 'seedsLoaded'; text: string }
  | { kind: 'trayPlanted'; text: string; previous: number; used: number }
  | { kind: 'batteryPercentReported'; value: number }
  | { kind: 'blocked'; reason: 'bounds'; direction: Heading; text: string }
  | { kind: 'blocked'; reason: 'charge'; text: string }
  | { kind: 'runtimeError'; diagnostic: Diagnostic }
  | { kind: 'completed'; success: true; text: string }
  | { kind: 'completed'; success: false; reason: 'bounds' | 'charge' | 'goal'; text: string };
export type Event = Payload & { span?: Span; state: RunState };
export type BoundaryBlock = Extract<Event, { kind: 'blocked'; reason: 'bounds' }>;
export type Plan = { events: Event[]; state: RunState; success: boolean; message: string };
export type PlanResult = Plan | { diagnostic: Diagnostic };

export function planRun(level: Level, fixture: Fixture, source: string): PlanResult {
  let state = startState(fixture);
  const events: Event[] = [];
  let blocked = false, steps = 0, configured = false;
  const emit = (event: Payload, span?: Span) => events.push({ ...event, span, state });
  const isSensor = (name: string): name is Sensor => level.sensors.some(sensor => sensor === name);
  function readSensor(name: string): Value | undefined {
    if (!isSensor(name)) return;
    const target = fixture.roses[0], second = fixture.roses[1];
    switch (name) {
      case 'zikiX': return int(state.position.x);
      case 'zikiY': return int(state.position.y);
      case 'roseX': case 'roseAX': return int(target.x);
      case 'roseY': case 'roseAY': return int(target.y);
      case 'roseBX': return int(second.x);
      case 'roseBY': return int(second.y);
      case 'batteryRange': return int(rangeOf(state.charge)!);
      case 'batteryPercentage': return double(rawPercent(fixture, state.charge)!);
      case 'gpsX': return double(fixture.gps!.x);
      case 'gpsY': return double(fixture.gps!.y);
      case 'bedSide': return int(fixture.bedSide!);
      case 'seedlingCount': return int(fixture.seedlingCount!);
    }
  }
  function walkable(tile: Tile) {
    return tile.x >= 0 && tile.y >= 0 && tile.x < fixture.width && tile.y < fixture.height
      && (!fixture.walkable || fixture.walkable.some(allowed => sameTile(tile, allowed)));
  }
  function count(args: readonly Value[], index: number, node: Call, label: string) {
    const value = args[index];
    const span = node.args[index].span;
    if (value.type !== 'int') fail('wrongType', span, `${label} must be an int.`);
    if (value.value < 0) fail('argumentOutOfRange', span, `${label} must be zero or greater. The value was ${value.value}.`);
    return value.value;
  }
  function arity(node: Call, args: readonly Value[], required: number) {
    if (args.length !== required) fail('wrongArgumentCount', node.span, `${node.name} takes ${required} argument${required === 1 ? '' : 's'}.`);
  }
  function movementOffset(node: Call, args: readonly Value[], index: number, axis: string) {
    const value = args[index];
    if (value.type !== 'int') fail('wrongType', node.args[index].span, `${axis} offset must be an int.`, 'Check the value passed to Move.');
    return value.value;
  }
  function moveAlong(direction: Heading, tiles: number, span: Span) {
    const offset = headingOffsets[direction];
    for (let i = 0; i < Math.abs(tiles); i++) {
      const from = state.position;
      const to = { x: from.x + offset.x, y: from.y + offset.y };
      if (!walkable(to)) {
        blocked = true;
        emit({ kind: 'blocked', reason: 'bounds', direction, text: `Tile (${to.x}, ${to.y}) is outside the garden. Ziki stopped at (${from.x}, ${from.y}).` }, span);
        return;
      }
      if (state.charge !== undefined && state.charge < CHARGE_PER_METER) {
        blocked = true;
        emit({ kind: 'blocked', reason: 'charge', text: `Battery range ran out at (${from.x}, ${from.y}). The next tile costs 1 m.` }, span);
        return;
      }
      if (++steps > MAX_STEPS) fail('stepLimit', span, `Keep each run to ${MAX_STEPS} tile crossings or fewer.`, 'Reduce the total distance in this run.');
      state = {
        ...state, position: to, trace: [...state.trace, to],
        charge: state.charge === undefined ? undefined : state.charge - CHARGE_PER_METER,
      };
      emit({ kind: 'moveStep', from, direction }, span);
    }
  }
  function command(node: Call, args: readonly Value[]) {
    const { span } = node;
    switch (node.name.replace(/^System\./, '')) {
      case 'Console.WriteLine':
        if (args.length > 1) fail('wrongArgumentCount', span, 'Console.WriteLine accepts up to one value.');
        emit({ kind: 'print', text: printable(args[0]) }, span);
        break;
      case 'Move': {
        if (args.length !== 1 && !(level.twoAxisMove && args.length === 2)) {
          fail('wrongArgumentCount', span, level.twoAxisMove ? 'Use Move(tiles) or Move(x, y).' : 'Use Move(tiles) with one signed int in this lesson.');
        }
        const x = movementOffset(node, args, 0, 'Horizontal');
        const y = args.length === 2 ? movementOffset(node, args, 1, 'Vertical') : 0;
        moveAlong(x < 0 ? 'West' : 'East', x, span);
        if (!blocked) moveAlong(y < 0 ? 'South' : 'North', y, span);
        break;
      }
      case 'UpdateBatteryPercentage': {
        arity(node, args, 1);
        const { value } = asNumber(args[0], node.args[0].span);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          fail('argumentOutOfRange', node.args[0].span, 'Enter a finite percentage from 0 to 100.', `The value sent to the display was ${value}.`);
        }
        state = { ...state, percent: value };
        emit({ kind: 'batteryPercentReported', value }, span);
        break;
      }
      case 'SetBatteryRange': {
        arity(node, args, 1);
        const meters = count(args, 0, node, 'Battery range');
        const max = rangeOf(fixture.battery?.capacity)!;
        if (meters > max) fail('argumentOutOfRange', node.args[0].span, `Ziki can start with at most ${max} m.`);
        if (!sameTile(state.position, fixture.dock)) fail('invalidCommandState', span, 'Set the range at the starting tile.');
        configured = true;
        state = { ...state, charge: meters * CHARGE_PER_METER };
        const coverage = fixture.roses.map(rose => `Rose ${rose.id}: ${meters >= routeCost(fixture.dock, rose) ? 'covered' : 'out of range'}`);
        emit({ kind: 'batteryConfigured', text: `Set to ${meters} m. ${coverage.join(' · ')}.` }, span);
        break;
      }
      case 'LoadSeeds': {
        arity(node, args, 1);
        const seeds = count(args, 0, node, 'Seed count');
        state = { ...state, seeds };
        emit({ kind: 'seedsLoaded', text: `Loaded ${seeds} seeds into the dispenser.` }, span);
        break;
      }
      case 'PlantBed': {
        arity(node, args, 0);
        const slots = fixture.bedSide! ** 2;
        const previous = state.planted;
        const used = Math.min(state.seeds, slots - previous);
        state = { ...state, seeds: state.seeds - used, planted: previous + used };
        emit({ kind: 'trayPlanted', previous, used, text: `${state.planted} of ${slots} slots filled; ${state.seeds} seeds left.` }, span);
        break;
      }
    }
  }
  try {
    execute(parseProgram(source), {
      math: level.math, hasSensor: isSensor, readSensor, halted: () => blocked,
      validateCommand(node) {
        if (node.name === 'Console.WriteLine' || node.name === 'System.Console.WriteLine') return;
        if (node.name === 'Harvest') fail('unknownCommand', node.span, 'Remove Harvest(). Ziki automatically picks up the rose when the program ends on its tile.');
        if (!level.commands.includes(node.name as Command)) {
          const hint = level.commands.length ? `Ziki’s commands in this lesson: ${level.commands.join(', ')}. Check the spelling and capitalization.` : undefined;
          fail('unknownCommand', node.span, `${quoteName(node.name)} is not an available command in this lesson.`, hint);
        }
      },
      command,
    });
  } catch (error) {
    if (!(error instanceof Diagnostic)) throw error;
    if (error.category !== 'runtime' || !events.length) return { diagnostic: error };
    emit({ kind: 'runtimeError', diagnostic: error }, error.span);
    return { events, state, success: false, message: error.message };
  }
  const costs = fixture.roses.map(rose => routeCost(fixture.dock, rose));
  let success = false;
  let message = 'Try another sequence.';
  const last = events.at(-1);
  if (last?.kind === 'blocked') {
    message = last.text;
  } else {
    const collectsRose = level.goal === 'harvest' || level.goal === 'nearest';
    const rose = collectsRose ? fixture.roses.find(target => sameTile(target, state.position)) : undefined;
    if (rose) {
      state = { ...state, harvested: [rose.id] };
      emit({ kind: 'harvest', rose });
    }
    const harvestMessage = rose ? 'Rose harvested!' : `No rose to harvest at (${state.position.x}, ${state.position.y}).`;
    switch (level.goal) {
      case 'harvest':
        success = !!rose;
        message = harvestMessage;
        break;
      case 'nearest': {
        const shortest = Math.min(...costs);
        success = !!rose && routeCost(fixture.dock, rose) === shortest;
        message = success ? `Rose harvested via the ${shortest} m route!` : rose ? 'Try the rose with the lower route cost.' : harvestMessage;
        break;
      }
      case 'range': {
        const target = Math.max(...costs);
        const range = rangeOf(state.charge)!;
        success = configured && range === target;
        message = success ? `${range} m covers either rose with the smallest setting.`
          : !configured ? 'Set the departure range at the starting tile.'
          : range < target ? `${range} m is too short to cover both roses.`
          : `${range} m covers both roses, but a smaller setting also works.`;
        break;
      }
      case 'percentage':
        success = events.some(event => event.kind === 'batteryPercentReported') && state.percent === roundEven(rawPercent(fixture)!);
        message = success ? `Battery display calibrated: ${percentText(state.percent!)}.` : 'Show the nearest whole percentage on the dashboard.';
        break;
      case 'tray': {
        const slots = fixture.bedSide! ** 2;
        success = state.planted === slots && state.seeds === 0;
        message = success ? `All ${slots} slots filled. Dispenser empty!`
          : state.planted < slots ? `${slots - state.planted} slots are still empty.` : `${state.seeds} extra seeds are still in the dispenser.`;
        break;
      }
    }
  }
  if (success) emit({ kind: 'completed', success: true, text: message });
  else emit({ kind: 'completed', success: false, reason: last?.kind === 'blocked' ? last.reason : 'goal', text: message });
  return { events, state, success, message };
}
