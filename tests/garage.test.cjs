'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {tripContext,serviceDue,inspectionDue}=require('../app/src/main/assets/garage.js');
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
  assert.deepEqual(serviceDue(profile,entries,'타이어',day),{dueKm:60000,month:'2026-03',overdue:false,overKm:0,overDays:0});
  profile.rules.타이어.intervalMonths=1;
  assert.deepEqual(serviceDue(profile,entries,'타이어',day),{dueKm:60000,month:'2025-08',overdue:true,overKm:0,overDays:153});
  assert.equal(serviceDue(profile,entries,'브레이크',day),null);
});

test('severe driving uses only the separately registered schedule',()=>{
  const today=new Date(2026,0,1,12);
  const record={part:'냉각수',action:'교체',date:'2025-12-31',km:10000};
  const profile={km:11000,monthlyKm:0,usage:'severe',rules:{냉각수:{intervalMonths:12}}};
  assert.equal(serviceDue(profile,[record],'냉각수',today),null);
  profile.severeRules={냉각수:{intervalMonths:3}};
  assert.equal(serviceDue(profile,[record],'냉각수',today).month,'2026-03');
  assert.equal(serviceDue({...profile,usage:'normal'},[record],'냉각수',today).month,'2026-12');
});

test('inspection and replacement use their own intervals and a deadline applies all day',()=>{
  const today=new Date(2026,0,31,7);
  const profile={km:49000,monthlyKm:1000,rules:{타이어:{inspectionKm:5000,inspectionMonths:3,intervalKm:20000,intervalMonths:24}}};
  const entries=[
    {part:'타이어',action:'교체',date:'2025-01-20',km:38000},
    {part:'타이어',action:'점검',date:'2025-10-31',km:47000},
    {part:'타이어',action:'정비',date:'2026-01-25',km:48000},
  ];
  assert.deepEqual(inspectionDue(profile,entries,'타이어',today),{dueKm:52000,month:'2026-01',overdue:true,overKm:0,overDays:0});
  assert.deepEqual(serviceDue(profile,entries,'타이어',today),{dueKm:58000,month:'2026-11',overdue:false,overKm:0,overDays:0});
  delete profile.rules.타이어.inspectionMonths;
  delete profile.rules.타이어.inspectionKm;
  assert.equal(inspectionDue(profile,entries,'타이어',today),null);
});


test('engine oil inspection is 500 km overdue while replacement remains upcoming',()=>{
  const today=new Date(2026,10,15,7);
  const profile={km:45000,monthlyKm:1000,rules:{엔진오일:{intervalKm:6000,intervalMonths:2,inspectionKm:2500}}};
  const records=[{part:'엔진오일',action:'교체',date:'2026-10-05',km:42000}];
  const inspection=inspectionDue(profile,records,'엔진오일',today);
  assert.deepEqual(inspection,{dueKm:44500,month:'2026-11',overdue:true,overKm:500,overDays:0});
  const replacement=serviceDue(profile,records,'엔진오일',today);
  assert.deepEqual(replacement,{dueKm:48000,month:'2026-12',overdue:false,overKm:0,overDays:0});
  const exact=inspectionDue({...profile,km:44500},records,'엔진오일',today);
  assert.equal(exact.overdue,true);
  assert.equal(exact.overKm,0);
});
