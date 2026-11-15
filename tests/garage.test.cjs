'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {tripContext,serviceDue}=require('../app/src/main/assets/garage.js');
const {parseCSV,hasGap}=require('../app/src/main/assets/engine.js');

test('RPM and idle are calculated only from available continuous samples',()=>{
  const rows=parseCSV('t_s,speed_kmh,long_ms2,lat_ms2,engine_rpm\n0,0,0,0,600\n1,0,0,0,800\n2,0,0,0,\n5,0,0,0,1000');
  assert.deepEqual(tripContext(rows,hasGap),{averageRpm:700,idleSeconds:1});
  assert.deepEqual(tripContext(rows.map(({rpm,...s})=>s),hasGap),{averageRpm:null,idleSeconds:null});
});

test('service due uses the latest replacement and the earlier mileage or calendar threshold',()=>{
  const day=new Date(2026,0,31,12);
  const profile={km:59000,monthlyKm:1000,rules:{타이어:{intervalKm:10000,intervalMonths:8}}};
  const entries=[{part:'타이어',action:'교체',date:'2025-07-31',km:50000},
    {part:'타이어',action:'점검',date:'2026-01-01',km:58500}];
  assert.deepEqual(serviceDue(profile,entries,'타이어',day),{dueKm:60000,month:'2026-03',overdue:false});
  profile.rules.타이어.intervalMonths=1;
  assert.deepEqual(serviceDue(profile,entries,'타이어',day),{dueKm:60000,month:'2025-08',overdue:true});
  assert.equal(serviceDue(profile,entries,'브레이크',day),null);
});
