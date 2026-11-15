const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const assets = path.join(__dirname, '../app/src/main/assets');
const engine = require(path.join(assets, 'engine.js'));
const script = fs.readFileSync(path.join(assets, 'app.js'), 'utf8');
const tripKey = 'drive-health-trip-v1';
const budgetKey = 'drive-health-budget';

function start(storage = new Map()) {
  const nodes = new Map();
  const editButton={dataset:{edit:'0'}};
  const brakeReference={dataset:{reference:'브레이크'}};
  const nav = ['overview', 'vehicle', 'parts', 'progress', 'budget'].map(page => {
    return {dataset: {page}, classList: { toggle() {} }, setAttribute() {}};
  });
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {textContent: '', innerHTML: ''});
    return nodes.get(selector);
  }
  const context = vm.createContext({
    DriveEngine: engine,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [2026, 11, 31])); }
    },
    document: {querySelector: node, querySelectorAll: selector => selector === 'nav button' ? nav : selector === '[data-edit]' ? [editButton] : selector === '[data-reference]' ? [brakeReference] : []},
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    window: {},
    FormData: function(form) { return new Map(Object.entries(form)); }
  });
  vm.runInContext(script, context);
  return {
    context, node, storage, editFirst: () => editButton.onclick(), useBrakeReference: () => brakeReference.onclick(),
    go: page => nav.find(button => button.dataset.page === page).onclick(),
    csv: text => node('#file').onchange({ target: { files: [{size: text.length, text: () => text}] } }),
    submit: (low, high, month) => node('#estimate').onsubmit({
      preventDefault() {}, target: { part: '브레이크', low, high, month }
    })
  };
}

function demoFile(name) {
  return fs.readFileSync(path.join(__dirname, '../demo', name + '.csv'), 'utf8');
}

test('first CSV needs a baseline and a pinned baseline survives import and restart', async () => {
  let app = start();
  await app.csv(demoFile('baseline'));
  app.go('progress');
  assert.match(app.node('#content').innerHTML, /비교할 기준 주행이 아직 없습니다/);
  app.node('#baseline').onclick();
  const base = JSON.parse(app.storage.get(tripKey)).trips.csv.base;
  app.go('overview');
  await app.csv(demoFile('improved'));
  app = start(app.storage);
  app.go('progress');
  assert.match(app.node('#content').innerHTML, /기준 주행이 고정되어 있습니다/);
  assert.deepEqual(JSON.parse(app.storage.get(tripKey)).trips.csv.base, base);
});

test('simulation leaves the latest CSV available and invalid imports cannot replace it', async () => {
  const app = start();
  await app.csv(demoFile('baseline'));
  const before = app.storage.get(tripKey);
  await app.csv('invalid');
  assert.match(app.node('#error').textContent, /헤더/);
  app.go('vehicle');
  app.node('#speed-replay').onclick();
  assert.match(app.node('#content').innerHTML, /횡가속도 신호 미수집/);
  assert.equal(app.storage.get(tripKey), before);
  app.node('#restore').onclick();
  assert.equal(app.node('#source').textContent, '가져온 CSV');
  app.node('#forget').onclick();
  assert.equal(app.storage.has(tripKey), false);
});

test('budget rejects inverted ranges and preserves the prior total on storage failure', () => {
  let app = start();
  app.go('budget');
  app.submit('50', '30');
  assert.match(app.node('#form-error').textContent, /최대 견적/);
  app.submit('50', '80');
  app = start(app.storage);
  app.go('budget');
  assert.match(app.node('#content').innerHTML, /\$50\.00.*\$80\.00/);
  app.context.localStorage.setItem = () => { throw Error('quota'); };
  app.submit('10', '20');
  assert.match(app.node('#form-error').textContent, /저장하지 못했습니다/);
  assert.equal(JSON.parse(app.storage.get(budgetKey)).length, 1);
});

test('a vehicle start failure leaves recording controls usable and preserves the prior trip', async () => {
  const app = start();
  await app.csv(demoFile('baseline'));
  const prior = app.storage.get(tripKey);
  const bridge = app.context.window;
  bridge.DriveVehicle = { start: () => bridge.showVehicleStatus('차속 권한이 필요합니다.', false) };
  app.go('vehicle');
  app.node('#live-start').onclick();
  assert.match(app.node('#vehicle-status').textContent, /차속 권한/);
  bridge.showVehicleStatus('차량 기록 중', true);
  assert.match(app.node('#content').innerHTML, /차량 기록 중/);
  bridge.showVehicleStatus('기록 중 차량 신호를 읽지 못했습니다.', false);
  assert.match(app.node('#vehicle-status').textContent, /신호를 읽지 못했습니다/);
  assert.equal(app.storage.get(tripKey), prior);
});

test('a completed vehicle callback is restored and never uses a CSV baseline', async () => {
  const app = start();
  await app.csv(demoFile('baseline'));
  app.go('progress');
  app.node('#baseline').onclick();
  app.context.window.acceptVehicleTrip(engine.speedReplay());
  const saved = JSON.parse(app.storage.get(tripKey)).trips.vehicle;
  assert.equal(saved.kind, 'vehicle');
  assert.equal(saved.base, null);
  const restored = start(app.storage);
  assert.equal(restored.node('#source').textContent, '차량 차속 신호');
  assert.match(restored.node('#content').innerHTML, /횡가속도 신호 미수집/);
});

test('real CSV comparison waits for route confirmation and resets after a new import', async () => {
  const app = start();
  await app.csv(demoFile('baseline'));
  app.go('progress');
  app.node('#baseline').onclick();
  assert.match(app.node('#content').innerHTML, /별도 기록을 분석하면/);
  app.go('overview');
  await app.csv(demoFile('improved'));
  app.go('progress');
  const html = () => app.node('#content').innerHTML;
  assert.match(html(), /id="comparable-route"/);
  assert.doesNotMatch(html(), /class="big">[-+]?\d+%/);
  const checkbox = app.node('#comparable-route');
  checkbox.checked = true;
  checkbox.focus = () => {};
  checkbox.onchange();
  assert.match(html(), /class="big">-\d+%/);
  app.go('overview');
  await app.csv(demoFile('baseline'));
  app.go('progress');
  assert.doesNotMatch(html(), /class="big">[-+]?\d+%/);
});

test('gapped vehicle trip restores disconnected trace and blocks percent comparison', () => {
  const app = start();
  const bridge = app.context.window;
  bridge.acceptVehicleTrip(engine.speedReplay());
  bridge.acceptVehicleTrip([[0,12],[0.5,10],[1,8],[2.5,2,true],[3,2]]);
  const restored = start(app.storage);
  const html = restored.node('#content').innerHTML;
  assert.match(html, /1.5초는 거리와 이벤트 계산에서 제외/);
  assert.equal((html.match(/class="trace"/g)||[]).length, 2);
  restored.go('progress');
  assert.match(restored.node('#content').innerHTML, /신호 누락이 있는 비교/);
  assert.doesNotMatch(restored.node('#content').innerHTML, /id="comparable-route"/);
});

test('budget rejects empty, out-of-range or sub-cent quotes and adds integer cents', () => {
  const app = start();
  app.go('budget');
  for (const [low,high] of [['','10'],['10','100001'],['0.001','10']]) {
    app.submit(low,high);
    assert.equal(app.storage.has(budgetKey),false);
  }
  app.submit('0.10','0.30');
  app.submit('0.20','0.40');
  assert.match(app.node('#content').innerHTML,/\$0\.30.*\$0\.70/);
});

test('old single-trip storage upgrades without losing the pinned baseline', async () => {
  let app = start();
  await app.csv(demoFile('baseline'));
  app.go('progress');
  app.node('#baseline').onclick();
  const stored = JSON.parse(app.storage.get(tripKey)).trips.csv;
  const {vehicleClock,...oldTrip}=stored;
  oldTrip.rows=stored.rows.map(([t,speed,long,lat])=>({t,speed,long,lat}));
  app.storage.set(tripKey, JSON.stringify(oldTrip));
  app = start(app.storage);
  assert.equal(app.node('#source').textContent, '가져온 CSV');
  app.context.window.acceptVehicleTrip(engine.speedReplay());
  const saved = JSON.parse(app.storage.get(tripKey));
  assert.equal(saved.version, 3);
  assert.deepEqual(saved.trips.csv, stored);
});

test('alternating vehicle and CSV preserves their own baselines and deletes only the selected source', async () => {
  let app = start();
  await app.csv(demoFile('baseline'));
  app.go('progress');
  app.node('#baseline').onclick();
  app.context.window.acceptVehicleTrip(engine.speedReplay());
  app.go('progress');
  app.node('#baseline').onclick();
  app.go('overview');
  await app.csv(demoFile('improved'));
  app = start(app.storage);
  app.go('progress');
  assert.match(app.node('#content').innerHTML, /기준 5건 · 비교 3건/);
  app.go('overview');
  app.node('#restore').onclick();
  assert.equal(app.node('#source').textContent, '차량 차속 신호');
  app.go('progress');
  assert.match(app.node('#content').innerHTML, /기준 주행이 고정되어 있습니다/);
  app.go('overview');
  app.node('#forget').onclick();
  assert.equal(app.node('#source').textContent, '가져온 CSV');
  const saved = JSON.parse(app.storage.get(tripKey));
  assert.deepEqual(Object.keys(saved.trips), ['csv']);
  assert.equal(saved.trips.csv.basePinned, true);
});

test('reimporting pinned telemetry cannot unlock the comparison confirmation', async () => {
  let app = start();
  const original = demoFile('baseline');
  await app.csv(original);
  app.go('progress');
  app.node('#baseline').onclick();
  app = start(app.storage);
  await app.csv(demoFile('improved'));
  await app.csv(original.replace(/\r?\n/g, '\r\n'));
  app.go('progress');
  assert.match(app.node('#content').innerHTML, /같은 주행입니다/);
  assert.doesNotMatch(app.node('#content').innerHTML, /id="comparable-route"/);
});

test('older baseline summaries load with a notice and can be pinned again', async () => {
  let app = start();
  await app.csv(demoFile('baseline'));
  app.go('progress');
  app.node('#baseline').onclick();
  const old = JSON.parse(app.storage.get(tripKey));
  delete old.trips.csv.base.analysisVersion;
  delete old.trips.csv.base.fingerprint;
  app.storage.set(tripKey, JSON.stringify(old));
  app = start(app.storage);
  await app.csv(demoFile('improved'));
  app.go('progress');
  assert.match(app.node('#content').innerHTML,/이전 계산 방식/);
  assert.doesNotMatch(app.node('#content').innerHTML,/id="comparable-route"/);
  app.node('#baseline').onclick();
  assert.doesNotMatch(app.node('#content').innerHTML,/이전 계산 방식/);
});

test('vehicle start pending blocks duplicate start and navigation until native status arrives', () => {
  const app = start();
  const bridge = app.context.window;
  let starts=0;
  bridge.DriveVehicle={start:()=>starts++};
  app.go('vehicle');
  app.node('#live-start').onclick();
  app.node('#live-start').onclick();
  app.go('budget');
  assert.equal(starts,1);
  assert.match(app.node('#capture-status').textContent,/차속 권한/);
  assert.match(app.node('#content').innerHTML,/주차하면/);
  bridge.showVehicleStatus('차속 권한이 필요합니다.',false);
  assert.match(app.node('#vehicle-status').textContent,/차속 권한/);
  app.go('budget');
  assert.match(app.node('#content').innerHTML,/정비 견적 범위/);
});

test('editing a quote replaces just that item after storage succeeds and cancel keeps it', () => {
  const app=start();
  app.go('budget');
  app.submit('40','50');
  app.submit('60','70');
  app.editFirst();
  assert.match(app.node('#content').innerHTML,/견적 수정/);
  assert.match(app.node('#content').innerHTML,/name="low"[^>]+value="40"/);
  const original=app.context.localStorage.setItem;
  app.context.localStorage.setItem=()=>{throw Error('quota');};
  app.submit('45','55');
  assert.equal(JSON.parse(app.storage.get(budgetKey))[0].low,40);
  app.context.localStorage.setItem=original;
  app.submit('45','55');
  assert.deepEqual(JSON.parse(app.storage.get(budgetKey)).map(x=>x.low),[45,60]);
  assert.match(app.node('#content').innerHTML,/\$105\.00.*\$125\.00/);
  app.editFirst();
  app.node('#cancel-edit').onclick();
  assert.match(app.node('#content').innerHTML,/예산에 추가/);
  assert.equal(JSON.parse(app.storage.get(budgetKey))[0].low,45);
});

test('vehicle measurement time survives restore and is not compared to old polling time', () => {
  let app=start();
  const first=engine.speedReplay();
  const second=first.map(([t,v])=>[t,v*0.9]);
  app.context.window.acceptVehicleTrip(first);
  app.go('progress');
  app.node('#baseline').onclick();
  app.context.window.acceptVehicleTrip(second,true);
  app=start(app.storage);
  assert.match(app.node('#content').innerHTML,/분석 가능 시간 40.0초 \/ 40.0초 · 차량 신호 시각 기준/);
  app.go('progress');
  assert.match(app.node('#content').innerHTML,/시간 기준이 다릅니다/);
  assert.doesNotMatch(app.node('#content').innerHTML,/id="comparable-route"/);
  app.node('#baseline').onclick();
  app.context.window.acceptVehicleTrip(first,true);
  app.go('progress');
  assert.match(app.node('#content').innerHTML,/id="comparable-route"/);
});

test('compact storage fits a long vehicle trip plus CSV and restores its measurement clock', async () => {
  let app=start();
  await app.csv(demoFile('baseline'));
  const limit=350000;
  const write=app.context.localStorage.setItem;
  app.context.localStorage.setItem=(key,value)=>{
    if(value.length>limit)throw Error('quota');
    write(key,value);
  };
  const samples=Array.from({length:14000},(_,i)=>[i/2,20]);
  app.context.window.acceptVehicleTrip(samples,true);
  const raw=app.storage.get(tripKey);
  const saved=JSON.parse(raw);
  assert.equal(saved.trips.vehicle.rows.length,14000);
  const expanded=saved.trips.vehicle.rows.map(([t,speed,long,lat])=>({t,speed,long,lat}));
  assert.ok(JSON.stringify(expanded).length>limit);
  assert.ok(raw.length<limit);
  app=start(app.storage);
  assert.match(app.node('#content').innerHTML,/차량 신호 시각 기준/);
  app.node('#restore').onclick();
  assert.equal(app.node('#source').textContent,'가져온 CSV');
});

test('failed trip save leaves the persistent record and pinned baseline intact', async () => {
  let app=start();
  await app.csv(demoFile('baseline'));
  app.go('progress');
  app.node('#baseline').onclick();
  app.go('overview');
  const before=app.storage.get(tripKey);
  app.context.localStorage.setItem=()=>{throw Error('quota');};
  await app.csv(demoFile('improved'));
  assert.equal(app.storage.get(tripKey),before);
  assert.match(app.node('#error').textContent,/이전에 저장한 기록은 유지/);
  app=start(app.storage);
  app.go('progress');
  assert.match(app.node('#content').innerHTML,/기준 주행이 고정되어 있습니다/);
});

test('version 2 records migrate together and one malformed compact trip does not hide the other', async () => {
  let app=start();
  await app.csv(demoFile('baseline'));
  app.context.window.acceptVehicleTrip(engine.speedReplay(),true);
  const compact=JSON.parse(app.storage.get(tripKey));
  const legacy={version:2,active:'vehicle',trips:{}};
  for(const [kind,saved] of Object.entries(compact.trips)){
    const {vehicleClock,...trip}=saved;
    trip.rows=saved.rows.map(([t,speed,long,lat,gapBefore],index)=>{
      const row={t,speed,long,lat};
      if(gapBefore)row.gapBefore=true;
      if(index===0&&vehicleClock)row.vehicleClock=true;
      return row;
    });
    legacy.trips[kind]=trip;
  }
  app.storage.set(tripKey,JSON.stringify(legacy));
  app=start(app.storage);
  assert.match(app.node('#content').innerHTML,/차량 신호 시각 기준/);
  app.node('#restore').onclick();
  const migrated=JSON.parse(app.storage.get(tripKey));
  assert.equal(migrated.version,3);
  assert.equal(migrated.trips.vehicle.vehicleClock,true);
  migrated.active='vehicle';
  migrated.trips.vehicle.rows[0]=[0,0];
  app.storage.set(tripKey,JSON.stringify(migrated));
  app=start(app.storage);
  assert.equal(app.node('#source').textContent,'가져온 CSV');
});

test('next-month budget rolls into January and excludes undated or other-month quotes', () => {
  const app = start(new Map([[budgetKey, JSON.stringify([{part:'브레이크',low:99,high:100}])]]));
  app.go('budget');
  app.submit('10', '15', '2026-12');
  app.submit('20', '25', '2027-01');
  app.submit('50', '60', '2027-02');
  const summary=app.node('#content').innerHTML.split('</article>')[0];
  assert.match(summary, /2027년 1월/);
  assert.match(summary, /\$20\.00.*\$25\.00/);
  assert.match(app.node('#content').innerHTML, /일정 미정/);
});

test('a cost reference is counted only after the driver saves it for a month', () => {
  let app=start();
  app.go('budget');
  app.useBrakeReference();
  assert.equal(app.storage.has(budgetKey),false);
  app.submit('335','394','2027-13');
  assert.match(app.node('#form-error').textContent,/정비 예정 월/);
  assert.equal(app.storage.has(budgetKey),false);
  app.submit('335','394','2027-01');
  assert.equal(JSON.parse(app.storage.get(budgetKey))[0].reference,true);
  app=start(app.storage);
  app.go('budget');
  assert.match(app.node('#content').innerHTML.split('</article>')[0], /참고가 1건/);
  app.editFirst();
  app.submit('350','400','2027-01');
  assert.equal(JSON.parse(app.storage.get(budgetKey))[0].reference,undefined);
  assert.match(app.node('#content').innerHTML.split('</article>')[0], /직접 입력 1건/);
});

test('vehicle speed-only budget does not infer cornering, and replay is labelled', () => {
  const app=start();
  app.context.window.acceptVehicleTrip(engine.speedReplay());
  app.node('#open-budget').onclick();
  assert.match(app.node('#content').innerHTML,/횡가속도 미수집/);
  assert.match(app.node('#content').innerHTML,/차량 차속 기록/);
  app.go('vehicle');
  app.node('#speed-replay').onclick();
  app.node('#open-budget').onclick();
  assert.match(app.node('#content').innerHTML,/가상 주행 예시/);
});
