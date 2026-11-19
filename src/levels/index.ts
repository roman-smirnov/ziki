import type { MathName } from '../code/evaluator.ts';

export type Tile = Readonly<{ x: number; y: number }>;
export type Rose = Tile & { id: 'A' | 'B'; label?: string };
export const CHARGE_PER_METER = 1_000_000;
export type Battery = { capacity: number; startCharge: number };
export type Fixture = {
  width: number;
  height: number;
  dock: Tile;
  roses: readonly Rose[];
  walkable?: readonly Tile[];
  battery?: Battery;
  gps?: Tile;
  bedSide?: number;
  seedlingCount?: number;
};
export type Command = 'Move' | 'UpdateBatteryPercentage' | 'SetBatteryRange' | 'LoadSeeds' | 'PlantBed';
export type Sensor = 'zikiX' | 'zikiY' | 'batteryRange' | 'batteryPercentage' | 'roseX' | 'roseY' | 'roseAX' | 'roseAY' | 'roseBX' | 'roseBY' | 'gpsX' | 'gpsY' | 'bedSide' | 'seedlingCount';
export type Level = {
  id: string;
  title: string;
  topic: string;
  objective: string;
  starter: string;
  fixture: Fixture;
  twoAxisMove?: boolean;
  math: readonly MathName[];
  commands: readonly Command[];
  sensors: readonly Sensor[];
  goal: 'harvest' | 'percentage' | 'nearest' | 'range' | 'tray';
  teacher?: boolean;
};

const dock = (x: number, y = 0): Tile => ({ x, y });
const a = (x: number, y = 0): Rose => ({ id: 'A', x, y });
const b = (x: number, y: number): Rose => ({ id: 'B', x, y });
const battery = (range: number, cap = range): Battery => ({ capacity: cap * CHARGE_PER_METER, startCharge: range * CHARGE_PER_METER });
const strip = (x: number, rose: number): Fixture => ({ width: 6, height: 1, dock: dock(x), roses: [a(rose)] });
const moveOnly = ['Move'] as const;
const coords = ['zikiX', 'zikiY'] as const;
const roseCoords = ['roseAX', 'roseAY', 'roseBX', 'roseBY'] as const;
const offsetExercise = (start: number, rose: number) => ({
  starter: `int zikiPosition = ${start};\nint rosePosition = ${rose};\nMove(rosePosition);`,
  fixture: strip(start, rose),
  math: [], commands: moveOnly, sensors: coords, goal: 'harvest' as const,
});
const batteryExercise = (start: number, rose1: number, rose2: number, range: number) => ({
  starter: `int batteryRange = ${range};\nint rose1Position = ${rose1};\nint rose2Position = ${rose2};\nint zikiPosition = ${start};`,
  fixture: {
    width: 11, height: 1, dock: dock(start), battery: battery(range),
    roses: [{ ...a(rose1), label: 'Rose 1' }, { ...b(rose2, 0), label: 'Rose 2' }],
  },
  math: [], commands: moveOnly, sensors: coords, goal: 'harvest' as const,
});
const routeCosts = `int distanceA = Math.Abs(roseAX - zikiX)
    + Math.Abs(roseAY - zikiY);
int distanceB = Math.Abs(roseBX - zikiX)
    + Math.Abs(roseBY - zikiY);`;
export const levels: readonly Level[] = [
  {
    id: 'first-harvest', title: 'First Harvest', topic: '01 · East on the grid',
    objective: 'Fly Ziki east from the starting tile to the rose, then pick it up.',
    starter: 'Move(1);',
    fixture: strip(0, 3), math: [], commands: moveOnly, sensors: coords, goal: 'harvest',
  },
  {
    id: 'fly-west', title: 'Fly West', topic: '02 · West on the grid',
    objective: 'Fly west from x = 5 to collect the rose at x = 2.',
    starter: 'Move(-1);',
    fixture: strip(5, 2), math: [], commands: moveOnly, sensors: coords, goal: 'harvest',
  },
  {
    id: 'rose-position', title: 'Follow the Rose Position', topic: '03 · Variables',
    objective: 'Pass rosePosition to Move to collect the rose.',
    starter: 'int rosePosition = 2;\nMove(1);',
    fixture: strip(0, 2), math: [], commands: moveOnly, sensors: coords, goal: 'harvest',
  },
  {
    id: 'movement-offset', title: 'Calculate the Move', topic: '04 · Subtract positions',
    objective: 'Calculate the signed movement from Ziki’s starting position to the rose.',
    ...offsetExercise(1, 4),
  },
  {
    id: 'movement-offset-west', title: 'Calculate the Move West', topic: '05 · Negative offsets',
    objective: 'Calculate a negative offset from the supplied positions to reach the rose west of Ziki.',
    ...offsetExercise(3, 1),
  },
  {
    id: 'battery-range', title: 'Choose a Reachable Rose', topic: '06 · Battery and decisions',
    objective: 'Use the battery range and positions to choose a rose Ziki can reach.',
    ...batteryExercise(1, 4, 9, 4),
  },
  {
    id: 'battery-last-meter', title: 'Reach a Rose on the Last Meter', topic: '07 · Exact battery range',
    objective: 'Choose the rose Ziki can reach using exactly the remaining battery range.',
    ...batteryExercise(2, 8, 5, 3),
  },
  {
    id: 'battery-display', title: 'Program the Battery Display', topic: '08 · Math.Round',
    teacher: true,
    objective: 'Keep Ziki parked and make the battery display show the nearest whole percent.',
    starter: 'UpdateBatteryPercentage(batteryPercentage);',
    fixture: { width: 4, height: 2, dock: dock(1), roses: [], battery: { capacity: 10_000_000, startCharge: 9_775_562 } },
    math: ['Round'], commands: ['UpdateBatteryPercentage'], sensors: ['batteryPercentage'], goal: 'percentage',
  },
  {
    id: 'gps-rose', title: 'Find the GPS Rose', topic: '09 · Round and cast',
    objective: 'Use the fractional GPS pin to choose the nearest whole tile. Land there and harvest.',
    starter: `int targetX = (int)gpsX;
int targetY = (int)gpsY;
Move(targetX - zikiX, targetY - zikiY);`,
    fixture: { width: 10, height: 10, dock: dock(0), roses: [a(5, 2)], gps: dock(4.7, 1.6), battery: battery(9) },
    twoAxisMove: true, math: ['Round'], commands: moveOnly, sensors: [...coords, 'gpsX', 'gpsY', 'batteryRange'], goal: 'harvest',
  },
  {
    id: 'shorter-route', title: 'One Charge, Two Roses', topic: '10 · Math.Min',
    objective: 'Ziki has 5 m of range. Find and harvest the rose with the shorter cardinal route.',
    starter: routeCosts + `
int shortest = distanceA;

if (shortest == distanceA)
{
    Move(roseAX - zikiX, roseAY - zikiY);
}
else
{
    Move(roseBX - zikiX, roseBY - zikiY);
}`,
    fixture: { width: 5, height: 5, dock: dock(0), roses: [a(3, 3), b(0, 4)], battery: battery(5) },
    twoAxisMove: true, math: ['Abs', 'Min'], commands: moveOnly, sensors: [...coords, ...roseCoords, 'batteryRange'], goal: 'nearest',
  },
  {
    id: 'charge-for-either', title: 'Charge for Either Rose', topic: '11 · Math.Max',
    objective: 'At the starting tile, set the smallest range that would reach either rose on a fresh departure.',
    starter: routeCosts + '\nSetBatteryRange(distanceA);',
    fixture: { width: 6, height: 5, dock: dock(1, 1), roses: [a(4, 1), b(5, 3)], battery: battery(0, 9) },
    math: ['Abs', 'Max'], commands: ['SetBatteryRange'], sensors: [...coords, ...roseCoords, 'batteryRange'], goal: 'range',
  },
  {
    id: 'seed-tray', title: 'Fill a Square Seed Tray', topic: '12 · Math.Pow',
    objective: 'Calculate a seed load that fills every slot in the square tray and leaves the dispenser empty.',
    starter: 'LoadSeeds(bedSide);\nPlantBed();',
    fixture: { width: 6, height: 4, dock: dock(0, 1), roses: [], battery: battery(6), bedSide: 3 },
    math: ['Pow'], commands: ['LoadSeeds', 'PlantBed'], sensors: ['bedSide'], goal: 'tray',
  },
  {
    id: 'row-end', title: 'Find the End of the Row', topic: '13 · Math.Sqrt',
    objective: 'The seedlings form a square starting at x = 1. Find its width and fly east to the last column.',
    starter: 'int columns = 1;\nMove(columns);',
    fixture: { width: 7, height: 5, dock: dock(0), roses: [a(5)], battery: battery(6), seedlingCount: 25 },
    twoAxisMove: true, math: ['Sqrt'], commands: moveOnly, sensors: [...coords, 'seedlingCount', 'batteryRange'], goal: 'harvest',
  },
];
