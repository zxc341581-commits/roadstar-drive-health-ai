'use strict';

const assert=require('node:assert/strict');
const {test}=require('node:test');
const {calculateWear,forecastMonths}=require('../app/src/main/assets/forecast.js');

const measurements={beforeKm:15000,nowKm:25000,beforeMm:8,nowMm:6,newMm:10,
  limitMm:2,monthlyKm:1000,improvement:20};

test('wear projection derives remaining life and a cost-share difference from measured wear',()=>{
  const output=calculateWear(measurements);
  assert.equal(output.remainingKm,20000);
  assert.equal(output.improvedKm,25000);
  assert.ok(Math.abs(output.annualWearShare-0.3)<1e-9);
  assert.ok(Math.abs(output.savingShare-0.06)<1e-9);
});

test('invalid or unchanging inspection records do not produce a forecast',()=>{
  for(const changes of [{nowMm:8},{nowKm:15000},{nowMm:1},{newMm:7},{improvement:100}]){
    assert.throws(()=>calculateWear({...measurements,...changes}));
  }
  assert.equal(calculateWear({...measurements,nowMm:2}).remainingKm,0);
});

test('ownership forecast includes only dated quotes within the twelve-month window',()=>{
  const result=forecastMonths('2026-12',[
    {month:'2026-12',low:335,high:394},{month:'2026-12',low:0.1,high:0.3},
    {month:'2027-01',low:100,high:120},{low:75,high:80},{month:'2027-12',low:600,high:750}
  ],150);
  assert.equal(result.length,12);
  assert.deepEqual(result[0],{month:'2026-12',low:335.1,high:394.3,premium:150});
  assert.deepEqual(result[1],{month:'2027-01',low:100,high:120,premium:150});
  assert.deepEqual(result[11],{month:'2027-11',low:0,high:0,premium:150});
  assert.equal(forecastMonths('2026-12',[],null)[0].premium,null);
});
