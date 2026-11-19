import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { levels, CHARGE_PER_METER } from '../src/levels/index.ts';
import { planRun, rangeOf, startState } from '../src/game/plan.ts';
import { roundEven } from '../src/code/evaluator.ts';
import { levelsById, solutions } from './solutions.mjs';

const play = (id, code, level = levelsById[id], fixture = level.fixture) => planRun(level, fixture, code);

const expected = {
  'first-harvest': [3,0,null], 'fly-west': [2,0,null], 'rose-position': [2,0,null],
  'movement-offset': [4,0,null], 'movement-offset-west': [1,0,null],
  'battery-range': [4,0,1], 'battery-last-meter': [5,0,0], 'battery-display': [1,0,9],
  'gps-rose': [5,2,2], 'shorter-route': [0,4,1], 'charge-for-either': [1,1,6],
  'seed-tray': [0,1,6], 'row-end': [5,0,1],
};
for (const [i,level] of levels.entries()) {
  test(`Lesson ${i+1}: ${level.title} · starter and solution`,()=>{
    const code=solutions[level.id];
    const result=play(level.id,code);
    assert.ok(!result.diagnostic,result.diagnostic?.message);
    assert.equal(result.success,true,result.message);
    const [x,y,range]=expected[level.id];
    assert.deepEqual(result.state.position,{x,y});
    assert.equal(rangeOf(result.state.charge) ?? null,range);
    assert.deepEqual(result,play(level.id,code));
    assert.deepEqual(result.state.trace[0],level.fixture.dock);
    assert.ok(result.state.trace.every((tile,n,trace)=>n===0 || Math.abs(trace[n-1].x-tile.x)+Math.abs(trace[n-1].y-tile.y)===1));
    for(const event of result.events.slice(0,-1)) {
      if (event.kind === 'harvest') {
        assert.equal(event.span,undefined);
        continue;
      }
      assert.ok(event.span.start < event.span.end);
      assert.ok(event.span.line > 0 && event.span.column > 0);
    }
    assert.equal(play(level.id,level.starter).success,false);
  });
}

test('Cardinal movement, no-op and last valid step on board limits',()=>{
  const result=play('gps-rose',`Move(2, 4);
Move(-1, -2);
Move(0, 0);
Move(0, -3);`);
  assert.equal(result.events.filter(e=>e.kind==='moveStep').length,9);
  assert.equal(result.events.at(-2).reason,'charge');
  assert.deepEqual(result.state.position,{x:1,y:2});
  const bounds=play('first-harvest','Move(-1);');
  assert.equal(bounds.events[0].reason,'bounds');
  assert.deepEqual(bounds.state.position,{x:0,y:0});
  const zero=play('first-harvest','Move(0);');
  assert.deepEqual(zero.state,startState(levelsById['first-harvest'].fixture));
});

test('Automatic pickup happens once after the program ends on a rose',()=>{
  const pass=play('first-harvest','Move(3); Move(1);');
  assert.equal(pass.success,false);
  assert.deepEqual(pass.state.harvested,[]);
  const stop=play('first-harvest','Move(4); Move(-1);');
  assert.equal(stop.success,true);
  assert.deepEqual(stop.state.harvested,['A']);
  assert.deepEqual(stop.events.slice(-3).map(event=>event.kind),['moveStep','harvest','completed']);

  const level=levelsById['first-harvest'];
  const fixture={...level.fixture,battery:{capacity:3*CHARGE_PER_METER,startCharge:3*CHARGE_PER_METER}};
  const blocked=play('first-harvest','Move(4);',level,fixture);
  assert.deepEqual(blocked.state.position,{x:3,y:0});
  assert.deepEqual(blocked.state.harvested,[]);
  assert.equal(blocked.events.at(-2).reason,'charge');
  assert.match(play('first-harvest','Move(3); Harvest();').diagnostic.message,/automatically picks up the rose/);
});

test('Two-axis Move uses offsets from the current tile and crosses x before y',()=>{
  const level = levelsById['gps-rose'];
  const fixture = {...level.fixture, dock:{x:2,y:3}};
  const result = play('gps-rose','Move(3, -2);',level,fixture);
  assert.deepEqual(result.state.trace,[
    {x:2,y:3}, {x:3,y:3}, {x:4,y:3}, {x:5,y:3}, {x:5,y:2}, {x:5,y:1},
  ]);
  assert.equal(rangeOf(result.state.charge),4);

  const blocked = play('gps-rose','Move(-3, 1);',level,fixture);
  assert.deepEqual(blocked.state.position,{x:0,y:3});
  assert.equal(blocked.events.at(-2).reason,'bounds');
  assert.equal(rangeOf(blocked.state.charge),7);
});

test('Battery choice swaps the reachable rose; an unreachable choice cannot collect a rose',()=>{
  for (const [id,roseId] of [['battery-range','A'],['battery-last-meter','B']]) {
    const { fixture }=levelsById[id];
    assert.ok(fixture.width>6);
    const range=rangeOf(fixture.battery.startCharge);
    const reachable=fixture.roses.filter(rose=>Math.abs(rose.x-fixture.dock.x)<=range);
    assert.equal(reachable.length,1);
    const result=play(id,solutions[id]);
    assert.equal(result.success,true);
    assert.deepEqual(result.state.harvested,[roseId]);
    assert.deepEqual(result.state.position,{x:reachable[0].x,y:0});
    assert.equal(result.events.filter(event=>event.kind==='print').length,0);

    const unreachable=fixture.roses.find(rose=>rose!==reachable[0]);
    const blocked=play(id,`Move(${unreachable.x-fixture.dock.x});`);
    assert.equal(blocked.success,false);
    assert.equal(blocked.events.at(-2).reason,'charge');
    assert.equal(blocked.state.charge,0);
    assert.deepEqual(blocked.state.harvested,[]);
  }
});

test('Battery display uses sensor precision and never changes charge',()=>{
  const level=levelsById['battery-display'];
  const code='UpdateBatteryPercentage(0.0);\nConsole.WriteLine(batteryPercentage);\n'+solutions['battery-display'];
  for(const [startCharge,raw,rounded] of [[9_745_562,97.45562,97],[level.fixture.battery.startCharge,97.75562,98]]) {
    const fixture={...level.fixture,battery:{...level.fixture.battery,startCharge}};
    const result=play('battery-display',code,level,fixture);
    assert.equal(result.events[1].text,String(raw));
    assert.equal(result.events[2].value,rounded);
    assert.equal(result.events[2].span.line,3);
    assert.equal(result.state.charge,startCharge);
    assert.equal(startState(fixture).percent,raw);
  }
  assert.equal(play('battery-display','UpdateBatteryPercentage((int)batteryPercentage);').success,false);
  for(const expr of ['-1','101','1.0 / 0.0','0.0 / 0.0']) assert.match(play('battery-display',`UpdateBatteryPercentage(${expr});`).diagnostic.message,/finite percentage/);
});

test('GPS truncate lands on the wrong tile; rounded values still need an explicit int cast',()=>{
  const result=play('gps-rose',levelsById['gps-rose'].starter);
  assert.deepEqual(result.state.position,{x:4,y:1});
  assert.match(result.message,/No rose to harvest at \(4, 1\)/);
  for (const axis of ['gpsX','gpsY']) {
    assert.equal(play('gps-rose',solutions['gps-rose'].replace(`Math.Round(${axis})`,axis)).success,false);
  }
  for(const value of ['2.5','3.0','true','Math.Round(gpsX)']) {
    const bad=play('gps-rose',`// first line\nMove(${value});`);
    assert.equal(bad.diagnostic.span.line,2);
    assert.match(bad.diagnostic.message,/must be an int/);
  }
});

test('Charge coverage explains too little and too much; tray reports empty slots and excess seeds',()=>{
  const short=play('charge-for-either','SetBatteryRange(3);');
  assert.match(short.events[0].text,/Rose A: covered · Rose B: out of range/);
  assert.match(short.message,/too short/);
  assert.match(play('charge-for-either','SetBatteryRange(9);').message,/smaller setting/);
  assert.match(play('charge-for-either','SetBatteryRange(10);').diagnostic.message,/at most 9 m/);
  assert.match(play('seed-tray',levelsById['seed-tray'].starter).message,/6 slots are still empty/);
  const excess=play('seed-tray','LoadSeeds(11);\nPlantBed();');
  assert.equal(excess.state.planted,9);
  assert.equal(excess.state.seeds,2);
  assert.match(excess.message,/2 extra seeds/);
  assert.equal(play('seed-tray','LoadSeeds(4);\nPlantBed();\nLoadSeeds(5);\nPlantBed();').success,true);
});

test('Live sensors, block scope, fresh variables, typed assignments and supported literals',()=>{
  const result=play('gps-rose',`var initial = batteryRange;
Move(1);
Console.WriteLine(initial - batteryRange);
if (zikiX == 1 && !(zikiY > 0)) {
  bool found = true;
  Console.WriteLine("Moved: " + found);
}
string label = "x";
label = label + "y";
Console.WriteLine(label);
float amount = 1.5f;
double doubled = amount * 2;
Console.WriteLine(doubled);`);
  assert.deepEqual(result.events.filter(e=>e.kind==='print').map(e=>e.text),['1','Moved: True','xy','3']);
  assert.match(play('gps-rose','gpsX = 0;').diagnostic.message,/not a writable variable/);
  assert.match(play('gps-rose','{ int x = 2; } Console.WriteLine(x);').diagnostic.message,/Unknown name/);
  assert.match(play('gps-rose','int x = 3.0;').diagnostic.message,/Cannot convert/);
  assert.match(play('gps-rose','Console.WriteLine(initial);').diagnostic.message,/Unknown name/);
});

test('Allowlist and source, nesting, and emitted step limits are enforced before playback',()=>{
  for(const [lesson,code,pattern] of [
    ['first-harvest','flyTo(1, 2);',/not an available command/], ['first-harvest','Console.WriteLine(gpsX);',/Unknown name/],
    ['first-harvest','move(3);',/not an available command/],
    ['first-harvest','Move(Direction.East);',/Unknown name/],
    ['first-harvest','Move(1, 0);',/one signed int/],
    ['gps-rose','Move();',/Move\(tiles\) or Move\(x, y\)/],
    ['gps-rose','Move(1, 2, 3);',/Move\(tiles\) or Move\(x, y\)/],
    ['gps-rose','Move(3, 2.5);',/Vertical offset must be an int/],
    ['first-harvest','Console.WriteLine(Math.Pow(1, 2));',/not an available Math function/],
    ['first-harvest','Move(2);\nSystem.IO.File.Delete("x");',/Line 2/],
    ['first-harvest','Move(2);\n?;',/Line 2/],
    ['first-harvest','Move(2)',/Expected “;”/],
    ['first-harvest','//'+'.'.repeat(8000),/8000 characters/],
    ['first-harvest','Console.WriteLine('+'('.repeat(80)+'1'+')'.repeat(80)+');',/deeply nested/],
    ['first-harvest','Console.WriteLine('+Array(80).fill(1).join('+')+');',/deeply nested/],
    ['first-harvest','Move(5);\nMove(-5);\n'.repeat(27),/256 tile crossings/],
  ]) {
    const result=play(lesson,code);
    assert.match(result.diagnostic.message,pattern);
    assert.equal(result.events,undefined);
  }
});

test('Code diagnostics point to the visible source and stop before any flight',()=>{
  const missing = play('first-harvest','// Try moving\r\n  Move(1) // one tile\r\n\r\nMove(2);').diagnostic;
  assert.equal(missing.category,'code');
  assert.equal(missing.code,'missingSemicolon');
  assert.deepEqual(missing.span,{line:2,column:10,start:23,end:23});
  assert.equal(play('first-harvest','Move(1)\n\n').diagnostic.span.line,1);

  const unknown = play('fly-west','Move(-1);\nMovvve(-2);');
  assert.equal(unknown.diagnostic.code,'unknownCommand');
  assert.equal(unknown.diagnostic.span.line,2);
  assert.match(unknown.diagnostic.hint,/\bMove\b/);
  assert.equal(unknown.events,undefined);

  const limit = play('first-harvest','//'+'.'.repeat(8000)).diagnostic;
  assert.equal(limit.category,'limit');
  assert.equal(limit.code,'sourceLimit');
  assert.equal(limit.span,undefined);
  assert.equal(play('first-harvest','if (false) Movvve(3); Move(3);').success,true);
});

test('Value errors retain preceding events and stop without completing the goal',()=>{
  const code = 'Move(3);\nint divisor = 0;\nConsole.WriteLine(4 / divisor);\nMove(1);';
  const result = play('first-harvest',code);
  assert.equal(result.success,false);
  assert.deepEqual(result.state.position,{x:3,y:0});
  assert.deepEqual(result.state.harvested,[]);
  assert.deepEqual(result.events.map(event=>event.kind),['moveStep','moveStep','moveStep','runtimeError']);
  const error = result.events.at(-1);
  assert.equal(error.diagnostic.category,'runtime');
  assert.equal(error.diagnostic.code,'divisionByZero');
  assert.equal(error.span.line,3);
  assert.equal(code.slice(error.span.start,error.span.end),'divisor');
  assert.deepEqual(error.state,result.state);

  assert.equal(play('first-harvest','Move(0); int divisor = 0; Move(4 / divisor);').diagnostic.code,'divisionByZero');
  assert.equal(play('first-harvest','Move(1); Move(4.7);').diagnostic.code,'wrongType');
  assert.equal(play('battery-display','UpdateBatteryPercentage("100");').diagnostic.category,'code');
  assert.equal(play('battery-display','UpdateBatteryPercentage(101);').diagnostic.category,'runtime');
  assert.equal(play('first-harvest','Console.WriteLine("a\tb");').events[0].text,'a\tb');
});

test('C# numeric semantics match the checked .NET oracle values',()=>{
  const rows=JSON.parse(readFileSync(new URL('./oracle/expected.json',import.meta.url),'utf8'));
  const level={...levelsById['first-harvest'],math:['Abs','Round','Min','Max','Sqrt','Pow']};
  const result=play('first-harvest',rows.expressions.map(([expr])=>`Console.WriteLine(${expr});`).join('\n'),level);
  assert.deepEqual(result.events?.filter(e=>e.kind==='print').map(e=>e.text),rows.expressions.map(([,expected])=>expected));
  for(const [expr,diagnostic] of rows.diagnostics) assert.match(play('first-harvest',`Console.WriteLine(${expr});`,level).diagnostic.message,new RegExp(diagnostic));
  assert.ok(Object.is(roundEven(-.5),-0));
  // Even with spare fractional charge, the third successful crossing needs one full meter.
  const fixture={...level.fixture, battery:{startCharge:2_999_999,capacity:3*CHARGE_PER_METER}};
  const fractional=play('first-harvest',solutions['first-harvest'],level,fixture);
  assert.equal(fractional.state.charge,999_999);
  assert.equal(fractional.events.at(-2).reason,'charge');
});
