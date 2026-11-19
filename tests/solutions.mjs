import { levels } from '../src/levels/index.ts';

export const levelsById = Object.fromEntries(levels.map(level => [level.id, level]));
const offset = 'int offset = rosePosition - zikiPosition;\nMove(offset);';
const chooseRose = `int distance1 = rose1Position - zikiPosition;
int distance2 = rose2Position - zikiPosition;

if (distance1 <= batteryRange)
{
    Move(distance1);
}
else if (distance2 <= batteryRange)
{
    Move(distance2);
}`;

export const solutions = {
  'first-harvest': 'Move(3);',
  'fly-west': 'Move(-3);',
  'rose-position': levelsById['rose-position'].starter.replace('Move(1);', 'Move(rosePosition);'),
  'movement-offset': levelsById['movement-offset'].starter.replace('Move(rosePosition);', offset),
  'movement-offset-west': levelsById['movement-offset-west'].starter.replace('Move(rosePosition);', offset),
  'battery-range': levelsById['battery-range'].starter + '\n' + chooseRose,
  'battery-last-meter': levelsById['battery-last-meter'].starter + '\n' + chooseRose,
  'battery-display': 'UpdateBatteryPercentage(Math.Round(batteryPercentage));',
  'gps-rose': levelsById['gps-rose'].starter.replace('(int)gpsX', '(int)Math.Round(gpsX)').replace('(int)gpsY', '(int)Math.Round(gpsY)'),
  'shorter-route': levelsById['shorter-route'].starter.replace('shortest = distanceA', 'shortest = Math.Min(distanceA, distanceB)'),
  'charge-for-either': levelsById['charge-for-either'].starter.replace('SetBatteryRange(distanceA)', 'SetBatteryRange(Math.Max(distanceA, distanceB))'),
  'seed-tray': 'LoadSeeds((int)Math.Pow(bedSide, 2));\nPlantBed();',
  'row-end': levelsById['row-end'].starter.replace('columns = 1', 'columns = (int)Math.Sqrt(seedlingCount)'),
};
