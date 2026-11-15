const assert = require('node:assert/strict');
const { test } = require('node:test');
const { analyze, fromSpeedSamples, parseCSV, speedReplay } = require('../app/src/main/assets/engine.js');

test('vehicle replay detects three brake events and has no lateral measurements', () => {
  const rows = fromSpeedSamples(speedReplay());
  const result = analyze(rows);
  assert.ok(rows.every(row => row.lat === null));
  assert.equal(result.events.filter(event => event.type === 'brake').length, 3);
  assert.ok(result.events.every(event => event.type !== 'turn'));
  assert.ok(Math.abs(result.km - 0.305) < 0.001);
});

test('unavailable or invalid speed samples cannot become analyzable zeros', () => {
  for (const samples of [
    [[0, 0], null, [1, 2]],
    [[-0.5, 0], [0, 1], [0.5, 2]],
    [[0, 0], [0, 1], [1, 2]],
    [[0, 0], [2.01, 1], [3, 2]],
    [[0, 0], [0.5, '2'], [1, 2]],
  ]) {
    assert.throws(() => fromSpeedSamples(samples), /차속/);
  }
});

test('threshold spikes shorter than half a second are excluded', () => {
  const rows = fromSpeedSamples([[0,10],[0.5,10],[1,8],[1.5,8],[2,6],[2.5,4],[3,4]]);
  const events = analyze(rows).events;
  assert.deepEqual(events.map(({type,t,end}) => ({type,t,end})), [{type:'brake',t:2,end:2.5}]);
});

test('CSV rejects missing acceleration and reverse is not evaluated as forward braking', () => {
  assert.throws(() => parseCSV('t_s,speed_kmh,long_ms2,lat_ms2\n0,0,0,\n1,0,0,0\n2,0,0,0'));
  const rows = fromSpeedSamples([[0,-8],[0.5,-6],[1,-4],[1.5,-2]]);
  assert.ok(analyze(rows).km > 0);
  assert.deepEqual(analyze(rows).events, []);
});

test('a short marked vehicle gap contributes no distance, acceleration, or bridged event', () => {
  const rows = fromSpeedSamples([[0,12],[0.5,10],[1,8],[2.5,2,true],[3,2]]);
  const result = analyze(rows);
  assert.equal(rows[3].long, 0);
  assert.equal(result.missingSeconds, 1.5);
  assert.ok(Math.abs(result.km - 0.011) < 1e-9);
  assert.deepEqual(result.events.map(({type,t,end}) => ({type,t,end})),
    [{type:'brake',t:0.5,end:1}]);
});

test('a marked gap cannot override invalid timestamps or bridge two single acceleration samples', () => {
  assert.throws(() => fromSpeedSamples([[0,0,true],[0.5,0],[1,2]]), /차속/);
  assert.throws(() => fromSpeedSamples([[0,0],[2.01,0,true],[2.51,2]]), /차속/);
  const rows = fromSpeedSamples([[0,10],[0.5,8],[2,7,true],[2.5,5],[3,5]]);
  assert.equal(analyze(rows).events.length, 0);
});

test('CSV accepts decimal telemetry and rejects ambiguous JavaScript numeric literals', () => {
  const header = 't_s,speed_kmh,long_ms2,lat_ms2';
  assert.deepEqual(parseCSV(header+'\n 0 , 3e1 , -.5 , +0 \n1,30.0,0,0\n2,30.,0,0')[0],
    {t:0,speed:30,long:-0.5,lat:0});
  for (const speed of ['0x20', '0b10', '0o20', 'NaN', 'Infinity']) {
    assert.throws(() => parseCSV(header+'\n0,'+speed+',0,0\n1,30,0,0\n2,30,0,0'),/2행/);
  }
});

test('sparse CSV samples split event segments and do not add interpolated distance', () => {
  const rows = parseCSV('t_s,speed_kmh,long_ms2,lat_ms2\n0,36,-4,0\n0.5,36,0,0\n3,36,-4,0\n3.5,36,0,0');
  const result = analyze(rows);
  assert.equal(result.missingSeconds, 2.5);
  assert.equal(result.km, 0.01);
  assert.equal(result.events.length, 0);
});

test('a confirmed braking interval is detected when deceleration reaches a complete stop', () => {
  const stops = [
    {samples:[[0,4],[0.5,2],[1,0],[1.5,0]], expected:1},
    {samples:[[0,4],[0.5,2],[1,0,true],[1.5,0]], expected:0},
    {samples:[[0,-4],[0.5,-2],[1,0],[1.5,0]], expected:0},
    {samples:[[0,1],[0.25,0],[0.75,0]], expected:0}
  ];
  for (const {samples,expected} of stops) {
    const result=analyze(fromSpeedSamples(samples));
    assert.equal(result.events.filter(event=>event.type==='brake').length,expected,JSON.stringify(samples));
  }
});

test('physically inconsistent speed change is excluded from acceleration and distance', () => {
  const rows=fromSpeedSamples([[0,24],[.5,24],[.55,1],[1.05,1],[1.55,1]]);
  const result=analyze(rows);
  assert.equal(rows[2].gapBefore,true);
  assert.equal(rows[2].long,0);
  assert.ok(Math.abs(result.missingSeconds-.05)<1e-9);
  assert.ok(Math.abs(result.km-.013)<1e-9);
  assert.equal(result.events.length,0);
});

test('a short but coherent acceleration interval is retained', () => {
  const rows=fromSpeedSamples([[0,10],[.05,9.9],[.10,9.8],[.6,9.8]]);
  assert.ok(rows.every(row=>!row.gapBefore));
  assert.equal(analyze(rows).missingSeconds,0);
  assert.ok(Math.abs(rows[1].long+2)<1e-9);
});

test('floating point roundoff does not create a gap or drop a half-second event', () => {
  const header='t_s,speed_kmh,long_ms2,lat_ms2\n';
  const regular=analyze(parseCSV(header+'3.2,20,0,0\n4.2,20,0,0\n5.2,20,0,0'));
  assert.equal(regular.missingSeconds,0);
  const exact=analyze(parseCSV(header+'0.2,20,-3,0\n0.7,18,-3,0\n1,18,0,0'));
  assert.equal(exact.events.filter(event=>event.type==='brake').length,1);
  const shorter=analyze(parseCSV(header+'0.2,20,-3,0\n0.699,18,-3,0\n1,18,0,0'));
  assert.equal(shorter.events.length,0);
});

test('restored speed-only records also exclude previously saved spikes', () => {
  const result=analyze([
    {t:0,speed:20,long:0,lat:null},
    {t:.5,speed:19,long:-80,lat:null},
    {t:1,speed:13,long:-3.3,lat:null},
    {t:1.5,speed:12,long:0,lat:null},
  ]);
  assert.equal(result.missingSeconds,.5);
  assert.equal(result.events.length,0);
});
