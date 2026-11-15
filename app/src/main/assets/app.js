'use strict';
const {TYPES,parseCSV,analyze,hasGap,demo,rate,fromSpeedSamples,speedReplay}=DriveEngine;
const state={page:'overview',rows:demo(),base:null,basePinned:false,demonstration:true,vehicleSource:'',improved:false,error:''};
let capture={busy:false,message:'주차 상태에서 차량 기록을 시작하세요.'};
const tripKey='drive-health-trip-v1';
let trips={};
let lastKind=null;
let importRequest=0;
let comparableRoute=false;
let baselineIsCurrent=false;

function tripKind(){
  if(state.vehicleSource==='차량 차속 신호') return 'vehicle';
  if(state.vehicleSource==='가상 차속 재생') return 'replay';
  return state.demonstration?'example':'csv';
}

function storeTrip(){
  const kind=tripKind();
  if(kind!=='csv'&&kind!=='vehicle') return;
  const trip={kind,rows:state.rows,base:state.base,basePinned:state.basePinned,baselineIsCurrent};
  const updated={...trips,[kind]:trip};
  try{saveTrips(updated,kind);return true;}
  catch{state.error='이 기록을 저장하지 못했습니다. 이전에 저장한 기록은 유지되며 현재 분석 결과는 화면에서 볼 수 있습니다.';}
}

function saveTrips(updated,active){
  const packed={};
  for(const [kind,trip] of Object.entries(updated)){
    const rows=trip.rows.map(row=>{
      const sample=[row.t,row.speed,row.long,row.lat];
      if(row.gapBefore)sample.push(true);
      return sample;
    });
    const rpm=trip.rows.some(row=>Number.isFinite(row.rpm))?trip.rows.map(row=>row.rpm??null):null;
    packed[kind]={...trip,rows,vehicleClock:trip.rows[0].vehicleClock===true,...(rpm?{rpm}:{})};
  }
  localStorage.setItem(tripKey,JSON.stringify({version:3,active,trips:packed}));
  trips=updated;
  lastKind=active;
}

function restoreTrip(trip){
  comparableRoute=false;
  baselineIsCurrent=trip.baselineIsCurrent===true;
  Object.assign(state,{rows:trip.rows,base:trip.base,basePinned:trip.basePinned,
    demonstration:false,improved:false,vehicleSource:trip.kind==='vehicle'?'차량 차속 신호':'',error:''});
}

function acceptTrip(rows,kind){
  comparableRoute=false;
  baselineIsCurrent=false;
  const prior=tripKind()===kind?state:trips[kind]??null;
  state.base=prior?.basePinned?prior.base:prior?analyze(prior.rows):null;
  state.basePinned=Boolean(prior?.basePinned);
  Object.assign(state,{page:'overview',rows,improved:false,demonstration:kind==='replay',
    vehicleSource:kind==='vehicle'?'차량 차속 신호':kind==='replay'?'가상 차속 재생':'',error:''});
  if(storeTrip())trackTrip(rows,kind);
}

function validTrip(trip,kind){
  return trip?.kind===kind&&Array.isArray(trip.rows)&&trip.rows.length>=3
    &&trip.rows.every((row,i)=>row&&[row.t,row.speed,row.long].every(Number.isFinite)
      &&(kind==='vehicle'?row.lat===null:Number.isFinite(row.lat))
      &&(row.gapBefore===undefined||(kind==='vehicle'&&i>0&&row.gapBefore===true))
      &&(!i||row.t>trip.rows[i-1].t))
    &&(trip.base===null||(Number.isFinite(trip.base?.km)&&Array.isArray(trip.base.events)));
}

function unpackTrip(trip){
  if(!Array.isArray(trip?.rows))return null;
  const rows=trip.rows.map((sample,index)=>{
    if(!Array.isArray(sample)||(sample.length!==4&&(sample.length!==5||sample[4]!==true)))return null;
    const [t,speed,long,lat,gapBefore]=sample;
    const row={t,speed,long,lat};
    const rpm=Array.isArray(trip.rpm)?trip.rpm[index]:null;
    if(Number.isFinite(rpm)&&rpm>=0&&rpm<=20000)row.rpm=rpm;
    if(gapBefore)row.gapBefore=true;
    if(index===0&&trip.kind==='vehicle'&&trip.vehicleClock===true)row.vehicleClock=true;
    return row;
  });
  return {kind:trip.kind,rows,base:trip.base,basePinned:trip.basePinned,baselineIsCurrent:trip.baselineIsCurrent};
}

try{
  const saved=JSON.parse(localStorage.getItem(tripKey)||'null');
  const version=saved?.version;
  const multi=version===2||version===3;
  for(const kind of ['csv','vehicle']){
    const packed=multi?saved.trips?.[kind]:saved;
    const trip=version===3?unpackTrip(packed):packed;
    if(validTrip(trip,kind))trips[kind]=trip;
  }
  const preferred=multi?saved.active:saved?.kind;
  lastKind=Object.keys(trips).includes(preferred)?preferred:Object.keys(trips)[0]??null;
  if(lastKind)restoreTrip(trips[lastKind]);
}catch{}

function otherSavedKind(){
  const kind=tripKind();
  if(kind==='csv')return trips.vehicle?'vehicle':null;
  if(kind==='vehicle')return trips.csv?'csv':null;
  return lastKind;
}
const speedOnly=()=>state.rows[0].lat===null;
const referenceCosts={
  브레이크:{low:335,high:394,scope:'브레이크 패드 교체 · 세금·수수료 제외',source:'RepairPal · 2026년 9월'},
  타이어:{low:400,high:1000,scope:'16–20인치 사계절 타이어 4개 · 제품가만',source:'Discount Tire · 개당 $100–$250'}
};
const quoteParts=['브레이크','타이어',...Object.keys(serviceParts).filter(part=>!referenceCosts[part]),'정기정비'];
const validMonth=value=>typeof value==='string'&&/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
let budgets=[];
let editingQuote=null;
let referencePart=null;
let budgetPart=null;

function nextCalendarMonth(){
  const today=new Date();
  const month=new Date(today.getFullYear(),today.getMonth()+1,1);
  return month.getFullYear()+'-'+String(month.getMonth()+1).padStart(2,'0');
}

try{
  const saved=JSON.parse(localStorage.getItem('drive-health-budget')||'[]');
  if(Array.isArray(saved)){
    budgets=saved.filter(q=>quoteParts.includes(q?.part)&&Number.isFinite(q.low)
      &&Number.isFinite(q.high)&&q.low>=0&&q.high>=q.low);
  }
}catch{}
const content=document.querySelector('#content');
const fmt=(x,d=1)=>x===null?'—':x.toFixed(d);
const usd=x=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(x);
const timer=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
const count=(r,type)=>r.events.filter(e=>e.type===type).length;
const title=(h,p,actions='')=>`<div class="title"><div><h1>${h}</h1><p>${p}</p></div>${actions}</div>`;
const garageKey='drive-health-garage-v1';
const historyKey='drive-health-trip-summary-v1';
const minRateKm=10;
const canShowRate=r=>Boolean(r&&r.km>=minRateKm&&!r.missingSeconds);
const analysisMethod='<span class="pill">규칙 기반 분석</span> <span class="subtle">AI 개인화 예측은 향후 고도화 예정</span>';
const usModels={
  'Tucson':'ice','Tucson Hybrid':'hev','Tucson Plug-in Hybrid':'hev',
  'Santa Fe':'ice','Santa Fe Hybrid':'hev','Elantra':'ice','Elantra Hybrid':'hev',
  'Kona':'ice','Kona Electric':'ev','IONIQ 5':'ev','IONIQ 6':'ev','IONIQ 9':'ev'
};
const powertrains={ice:'내연기관',hev:'하이브리드(PHEV 포함)',ev:'전기차'};
const usageLabels={normal:'일반 운행',severe:'가혹 운행'};
const emptyGarage={model:'',year:null,km:null,monthlyKm:null,powertrain:'ice',usage:'normal',rules:{},severeRules:{},records:[]};
const isDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
  &&Number.isFinite(Date.parse(value+'T00:00:00Z'))
  &&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const intIn=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const knownPart=part=>Object.prototype.hasOwnProperty.call(serviceParts,part);
let garage=emptyGarage;
let tripHistory=[];
let selectedPart='브레이크';

function readStoredRules(raw){
  return Object.fromEntries(Object.entries(raw??{}).filter(([part,rule])=>knownPart(part)&&rule
    &&intIn(rule.intervalKm,0,1000000)&&intIn(rule.intervalMonths,0,240)
    &&intIn(rule.inspectionKm??0,0,1000000)&&intIn(rule.inspectionMonths??0,0,240)
    &&((rule.low===null&&rule.high===null)||(Number.isFinite(rule.low)&&Number.isFinite(rule.high)
    &&rule.low>=0&&rule.high>=rule.low&&rule.high<=100000))));
}
try{
  const saved=JSON.parse(localStorage.getItem(garageKey)||'null');
  if(saved&&typeof saved.model==='string'&&Object.keys(powertrains).includes(saved.powertrain)){
    const records=Array.isArray(saved.records)?saved.records.filter(r=>r&&knownPart(r.part)
      &&['교체','점검','정비'].includes(r.action)&&isDate(r.date)&&intIn(r.km,0,9999999)):[];
    garage={model:saved.model.slice(0,60),powertrain:saved.powertrain,records,
      usage:saved.usage==='severe'?'severe':'normal',
      rules:readStoredRules(saved.rules),severeRules:readStoredRules(saved.severeRules),
      year:intIn(saved.year,1900,2100)?saved.year:null,km:intIn(saved.km,0,9999999)?saved.km:null,
      monthlyKm:intIn(saved.monthlyKm,1,99999)?saved.monthlyKm:null};
  }
}catch{}
try{
  const saved=JSON.parse(localStorage.getItem(historyKey)||'[]');
  if(Array.isArray(saved))tripHistory=saved.filter(t=>t&&Number.isFinite(t.km)&&t.km>0
    &&['csv','vehicle'].includes(t.kind)&&typeof t.fingerprint==='string').slice(0,12);
}catch{}

function trackTrip(rows,kind){
  const summary=analyze(rows);
  if(summary.km<=0)return;
  const next=[{kind,km:summary.km,fingerprint:summary.fingerprint},
    ...tripHistory.filter(t=>t.kind!==kind||t.fingerprint!==summary.fingerprint)].slice(0,12);
  try{localStorage.setItem(historyKey,JSON.stringify(next));tripHistory=next;}
  catch{}
}

function vehicleParts(){
  return Object.keys(serviceParts).filter(part=>garage.powertrain!=='ev'||!['엔진오일','엔진 에어필터','변속기 오일'].includes(part));
}
function readAmount(form,key){
  const value=String(form.get(key)??'').trim();
  return value===''?null:/^\d+(?:\.\d{1,2})?$/.test(value)&&Number(value)<=100000?Number(value):NaN;
}
function readInteger(form,key){
  const value=String(form.get(key)??'').trim();
  return value===''?null:/^\d+$/.test(value)?Number(value):NaN;
}
function saveGarage(next,error){
  try{localStorage.setItem(garageKey,JSON.stringify(next));}
  catch{document.querySelector(error).textContent='기기에 저장하지 못했습니다.';return;}
  garage=next;
  render();
}

function dueLabel(due,requiredRecord){
  if(!due)return requiredRecord+' 이력과 '+usageLabels[garage.usage]+' 기준 필요';
  const mileage=due.dueKm===null?'':due.dueKm.toLocaleString('ko-KR')+' km';
  const timing=[due.month?monthLabel(due.month):'',mileage].filter(Boolean).join(' · ');
  if(due.overdue)return '기준 도달'+(timing?' · '+timing:'');
  return timing||'예정 월 미정';
}

const primaryParts=['엔진오일','브레이크','타이어'];
const partName=part=>part==='브레이크'?'브레이크 패드':part==='배터리'?'12V 배터리':part;

function partDashboard(r){
  const available=vehicleParts();
  if(!available.includes(selectedPart))selectedPart=available[0];
  const part=selectedPart, spec=serviceParts[part], rule=serviceRules(garage)[part];
  const nextMonth=nextCalendarMonth();
  const schedules=available.map(name=>{
    const inspection=inspectionDue(garage,garage.records,name);
    const replacement=serviceDue(garage,garage.records,name);
    const dates=[inspection,replacement].filter(Boolean);
    const reached=dates.some(due=>due.overdue);
    const soon=dates.some(due=>due.month&&due.month<=nextMonth);
    const priority=reached?0:soon?1:dates.length?2:3;
    const status=['기준 도달','다음 달까지 예정','기준 등록됨','정보 필요'][priority];
    return {name,inspection,replacement,priority,status};
  }).sort((a,b)=>a.priority-b.priority);
  const current=schedules.find(item=>item.name===part);
  const partButton=({name,priority,status})=>`<button type="button" class="part-card" data-part-card="${name}" aria-pressed="${name===part}">
    <strong>${partName(name)}</strong><span class="signal${priority===0?' signal-detected':''}">${status}</span></button>`;
  const core=schedules.filter(item=>primaryParts.includes(item.name)||item.inspection||item.replacement);
  const other=schedules.filter(item=>!core.includes(item));
  const latest=garage.records.filter(record=>record.part===part).sort((a,b)=>b.date.localeCompare(a.date)||b.km-a.km)[0];
  const knownPrice=rule?.low!=null?{low:rule.low,high:rule.high}:referenceCosts[part];
  const evidence=part==='브레이크'?'급감속 '+count(r,'brake')+'건'
    :part==='타이어'?(speedOnly()?'횡가속도 미수집':'급코너링 '+count(r,'turn')+'건')
    :part==='변속기 오일'?'급가속 '+count(r,'accel')+'건'
    :['엔진오일','배터리'].includes(part)&&r.km>0&&r.km<10?'이번 기록 10 km 미만':'정비 이력·등록 기준';
  return title('소모품 통합 관리','차량 정보, 등록한 정비 기준과 주행 기록으로 점검 우선순위를 살펴보세요.')+
    `<div class="part-grid" aria-label="소모품 점검 상태">${core.map(partButton).join('')}</div>
    ${other.length?`<details class="extra-parts" ${other.some(item=>item.name===part)?'open':''}><summary>추가 소모품 ${other.length}개</summary><div class="part-grid">${other.map(partButton).join('')}</div></details>`:''}
    <div class="split budget-section"><article class="card"><h2>${partName(part)}</h2>
    <p class="pill inline-pill">${evidence}</p><p>${spec.habit}</p>
    <p><strong>점검 항목</strong> ${spec.check}</p><p><strong>추천 행동</strong> ${spec.coach}</p>
    <dl class="info-list"><div><dt>최근 정비</dt><dd>${latest?`${latest.date} · ${latest.action} · ${latest.km.toLocaleString('ko-KR')} km`:'미등록'}</dd></div>
    <div><dt>다음 점검</dt><dd>${dueLabel(current.inspection,'점검·교체')}</dd></div>
    <div><dt>예상 교체</dt><dd>${dueLabel(current.replacement,'교체')}</dd></div>
    <div><dt>예상 정비비</dt><dd>${knownPrice?estimateRange([knownPrice]):'미입력'} ${knownPrice&&rule?.low==null?'(미국 참고가)':''}</dd></div></dl>
    <button type="button" id="parts-to-budget" class="button primary">${partName(part)} 예산 보기</button></article>
    <article class="card"><h2>차량별 정비 기준</h2><p class="pill inline-pill">${usageLabels[garage.usage]}</p>
    <p>차량 매뉴얼에 맞춰 기준을 입력하세요. 거리와 기간 중 먼저 도달하는 기준을 적용합니다.</p>
    <p class="subtle">다음 점검은 최근 점검 또는 교체부터, 다음 교체는 최근 교체부터 계산합니다. 12V 배터리는 구동용 배터리와 별도로 관리합니다.</p>
    <form id="service-rule-form"><div class="split quote-fields">
    <label class="field">점검 주기 (km)<input type="number" name="inspectionKm" min="1" max="1000000" value="${rule?.inspectionKm||''}"></label>
    <label class="field">점검 주기 (개월)<input type="number" name="inspectionMonths" min="1" max="240" value="${rule?.inspectionMonths||''}"></label>
    <label class="field">교체 주기 (km)<input type="number" name="intervalKm" min="1" max="1000000" value="${rule?.intervalKm||''}"></label>
    <label class="field">교체 주기 (개월)<input type="number" name="intervalMonths" min="1" max="240" value="${rule?.intervalMonths||''}"></label>
    <label class="field">최소 교체비 (USD)<input type="number" name="low" min="0" max="100000" step=".01" value="${rule?.low??''}"></label>
    <label class="field">최대 교체비 (USD)<input type="number" name="high" min="0" max="100000" step=".01" value="${rule?.high??''}"></label>
    </div><button class="button primary">기준 저장</button><p id="rule-error" class="warn" role="status"></p></form></article></div>`;
}
function servicePlan(month){
  const end=addCalendarMonths(new Date(month+'-01T12:00:00'),12);
  const endKey=end.getFullYear()+'-'+String(end.getMonth()+1).padStart(2,'0');
  const now=new Date();
  const current=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const available=vehicleParts();
  const quotes=budgets.filter(q=>validMonth(q.month)&&q.month>=current&&q.month<endKey
    &&(!knownPart(q.part)||available.includes(q.part))).sort((a,b)=>a.month.localeCompare(b.month));
  const items=quotes.filter(q=>q.month>=month);
  const near=[];
  const within=value=>Boolean(value&&value>=month&&value<endKey);
  for(const part of available){
    const replacement=serviceDue(garage,garage.records,part,now);
    const inspection=inspectionDue(garage,garage.records,part,now);
    const quote=quotes.find(q=>q.part===part);
    const replacementMonth=quote?.month??replacement?.month;
    const rule=serviceRules(garage)[part];
    if(!quote&&within(replacement?.month)){
      items.push({part,month:replacement.month,low:rule.low,high:rule.high,task:'교체'});
    }
    if(within(inspection?.month)&&(!replacementMonth||inspection.month<replacementMonth)){
      items.push({part,month:inspection.month,low:null,high:null,task:'점검'});
    }
    if(replacement?.month&&replacement.month<month)near.push({part,task:'교체 기준',due:replacement});
    if(inspection?.month&&inspection.month<month&&(!replacement?.month||inspection.month<replacement.month)){
      near.push({part,task:'점검 기준',due:inspection});
    }
  }
  return {items,near};
}

const priced=item=>Number.isFinite(item.low)&&Number.isFinite(item.high);
const plannedName=item=>partName(item.part)+' '+(item.task??'등록 견적');

function dataPanels(){
  const options=Object.entries(powertrains).map(([key,label])=>`<option value="${key}"${garage.powertrain===key?' selected':''}>${label}</option>`).join('');
  const models=Object.keys(usModels).map(model=>`<option>${model}</option>`).join('');
  const uses=Object.entries(usageLabels).map(([key,label])=>`<option value="${key}"${garage.usage===key?' selected':''}>${label}</option>`).join('');
  const parts=vehicleParts().map(item=>`<option>${item}</option>`).join('');
  const records=garage.records.map((record,i)=>({record,i})).sort((a,b)=>b.record.date.localeCompare(a.record.date))
    .map(({record:r,i})=>`<div class="row quote-row"><div><strong>${r.part} · ${r.action}</strong>
    <p class="subtle">${r.date} · ${r.km.toLocaleString('ko-KR')} km${Number.isFinite(r.cost)?' · '+usd(r.cost):''}</p>
    ${r.memo?`<p>${escapeText(r.memo)}</p>`:''}</div><div class="actions"><button type="button" data-remove-service="${i}" class="button" aria-label="${r.part} 내역 삭제">삭제</button></div></div>`).join('');
  return `<div class="split budget-section"><article class="card"><h2>차량 프로필</h2>
    <form id="vehicle-profile-form">
    <label class="field">미국 현대차 모델 선택<select id="us-model"><option value="">직접 입력 또는 모델 선택</option>${models}</select></label>
    <label class="field">차량 모델<input name="model" maxlength="60" value="${escapeText(garage.model)}" required></label>
    <div class="split quote-fields"><label class="field">연식<input type="number" name="year" min="1900" max="2100" value="${garage.year??''}" required></label>
    <label class="field">파워트레인<select name="powertrain">${options}</select></label>
    <label class="field">누적 주행거리 (km)<input type="number" name="km" min="0" max="9999999" value="${garage.km??''}" required></label>
    <label class="field">예상 월 주행거리 (km)<input type="number" name="monthlyKm" min="1" max="99999" value="${garage.monthlyKm??''}"></label></div>
    <label class="field">매뉴얼 기준 운행 조건<select name="usage">${uses}</select></label>
    <p class="subtle">차량 매뉴얼에서 적용 조건을 확인하세요. 일반·가혹 운행의 정비 기준을 따로 저장합니다.</p>
    <button class="button primary">차량 정보 저장</button><p id="profile-error" class="warn" role="status"></p></form></article>
    <article class="card"><h2>교체·정비 내역 등록</h2><form id="service-record-form">
    <div class="split quote-fields"><label class="field">부품<select name="part">${parts}</select></label>
    <label class="field">유형<select name="action"><option>교체</option><option>점검</option><option>정비</option></select></label>
    <label class="field">정비일<input type="date" name="date" required></label>
    <label class="field">정비 시 주행거리 (km)<input type="number" name="km" min="0" max="9999999" required></label></div>
    <label class="field">실제 정비비 (USD)<input type="number" name="cost" min="0" max="100000" step=".01"></label>
    <label class="field">정비 메모<input name="memo" maxlength="160"></label>
    <button class="button primary">정비 내역 추가</button><p id="service-error" class="warn" role="status"></p>
    </form></article></div>
    <article class="card budget-section"><h2>정비 이력</h2><div class="events">${records||'<p>아직 등록한 정비 내역이 없습니다.</p>'}</div></article>`;
}

function graph(rows,r){
  const end=rows[rows.length-1].t-rows[0].t;
  const x=t=>36+(t-rows[0].t)/end*605;
  const max=rows.reduce((max,s)=>Math.max(max,s.speed),60);
  const y=v=>130-v/max*105;
  const stride=Math.max(1,Math.ceil(rows.length/450));
  const segments=[[]];
  rows.forEach((row,index)=>{
    const gap=hasGap(row,rows[index-1]);
    if(gap)segments.push([]);
    const gapFollows=rows[index+1]&&hasGap(rows[index+1],row);
    if(index%stride===0||gap||gapFollows||index===rows.length-1){
      segments[segments.length-1].push(x(row.t).toFixed(1)+','+y(row.speed).toFixed(1));
    }
  });
  const trace=segments.map(points=>'<polyline class="trace" points="'+points.join(' ')+'"/>').join('');
  const markers=r.events.filter(e=>e.type==='brake').slice(0,300).map(e=>`<circle class="marker" cx="${x(e.t)}" cy="${y(e.speed)}" r="4.5"/>`).join('');
  return `<svg class="graph" viewBox="0 0 665 160" role="img" aria-label="차속 추세 및 급감속 발생 위치"><line class="axis" x1="36" y1="130" x2="641" y2="130"/><line class="axis" x1="36" y1="25" x2="641" y2="25"/><text x="2" y="29">${Math.round(max)}</text><text x="15" y="133">0</text>${trace}${markers}<text x="36" y="153">시작</text><text x="609" y="153">${timer(end)}</text></svg>`;
}
function coachingSummary(r){
  if(count(r,'brake')>=2)return serviceParts.브레이크.coach;
  if(!speedOnly()&&count(r,'turn')>=2)return serviceParts.타이어.coach;
  if(count(r,'accel')>=2)return serviceParts['변속기 오일'].coach;
  if(r.km>0&&r.km<10&&garage.powertrain!=='ev')return serviceParts.엔진오일.coach;
  return '비슷한 노선의 주행을 더 기록해 운전습관 변화를 확인하세요.';
}
function drivingContext(r){
  const signals=tripContext(state.rows,hasGap);
  const short=tripHistory.filter(t=>t.km<10).length;
  const share=tripHistory.length?Math.round(short/tripHistory.length*100):null;
  return `<section class="card budget-section"><div class="section-heading"><h2>운전습관 요약</h2><span class="pill">규칙 기반 분석</span></div>
    <p>${coachingSummary(r)}</p>
    <dl class="info-list"><div><dt>급가속</dt><dd>${count(r,'accel')}건</dd></div>
    <div><dt>단거리 / 장거리 비율</dt><dd>${share===null?'저장된 기록 없음':share+'% / '+(100-share)+'% · '+tripHistory.length+'건'}</dd></div>
    <div><dt>공회전 추정</dt><dd>${signals.idleSeconds===null?'RPM 신호 미수집':timer(Math.round(signals.idleSeconds))}</dd></div>
    <div><dt>평균 엔진 RPM</dt><dd>${signals.averageRpm===null?'미수집':Math.round(signals.averageRpm).toLocaleString('ko-KR')+' RPM'}</dd></div></dl>
    <p class="subtle">단거리 기준은 10 km 미만입니다. 기기 수집과 가져오기에서 최근 저장한 기록 최대 12건을 사용합니다. RPM은 해당 열이 있는 CSV에서 계산합니다.</p></section>`;
}
function overview(r){
  const alternative=otherSavedKind();
  const restoreLabel=alternative==='csv'?'최근 CSV':'최근 차량 기록';
  const action=`<div class="actions">${!state.demonstration?'<button class="button" id="forget">최근 기록 삭제</button>':''}<button class="button" id="open-budget">정비 예산</button><button class="button" id="reset">예제 주행</button>${alternative?'<button class="button" id="restore">'+restoreLabel+'</button>':''}<button class="button primary" id="import">CSV 분석</button><input type="file" id="file" accept=".csv,text/csv" hidden></div>`;
  const brief=!canShowRate(r);
  const duration=state.rows[state.rows.length-1].t-state.rows[0].t;
  const observedSeconds=Math.max(0,duration-r.missingSeconds);
  const brake=count(r,'brake'),turn=count(r,'turn');
  const normalized=type=>fmt(rate(count(r,type),r.km))+'회 / 100km';
  const cards=[['분석 주행거리',fmt(r.km)+' km',r.missingSeconds>0?'수집된 구간만 계산':'시간과 차속으로 계산'],
    ['급감속',brake+'회',brief?'이번 기록 횟수 · 거리당 환산 제외':normalized('brake')],
    brief?['분석한 주행시간',fmt(observedSeconds,0)+'초',speedOnly()?'차속 기록 · 횡가속도 신호 미수집':'유효 표본 구간']
      :['급코너링',speedOnly()?'—':turn+'회',speedOnly()?'횡가속도 신호 미수집':normalized('turn')]]
    .map(([t,v,d])=>`<div class="card metric"><h3>${t}</h3><strong>${v}</strong><p>${d}</p></div>`).join('');
  const related=[];
  if(brake>0)related.push(['브레이크',`급감속 ${brake}회 · 패드 두께와 최근 교체 기록 확인`]);
  if(!speedOnly()&&turn>0)related.push(['타이어',`급코너링 ${turn}회 · 공기압과 편마모 확인`]);
  if(tripHistory.filter(trip=>trip.km<minRateKm).length>=3&&vehicleParts().includes('엔진오일')){
    related.push(['엔진오일','짧은 주행 반복 · 차량 매뉴얼의 점검 기준 확인']);
  }
  const followup=related.length?`<article class="card trip-followup"><h2>이번 주행에서 확인할 소모품</h2>
    <div class="actions">${related.map(([part,reason])=>`<button type="button" class="button" data-trip-part="${part}"><strong>${partName(part)}</strong><span>${reason}</span></button>`).join('')}</div>
    <p class="subtle">주행 기록을 점검 단서로 사용합니다. 실제 상태는 부품 점검으로 확인하세요.</p></article>`:'';
  const events=r.events.slice(0,100).map(e=>`<div class="event"><strong>${TYPES.find(t=>t.id===e.type).label}</strong><span>${timer(e.t-state.rows[0].t)} · ${fmt(e.peak)} m/s²</span></div>`).join('');
  const basis=r.vehicleClock?'차량 신호 시각 기준':'기록의 표본 시각 기준';
  const coverage='<p class="subtle">분석 가능 시간 '+fmt(observedSeconds)+'초 / '+fmt(duration)+'초 · '+basis+'</p>';
  const gapNotice=r.missingSeconds>0
    ?'<div class="note">표본 간격이 길거나 신호가 누락·이상인 '+fmt(r.missingSeconds)+'초는 거리와 이벤트 계산에서 제외했습니다.</div>':'';
  return title('주행 분석',analysisMethod,action)+
    `<p id="error" class="warn" role="status"></p>${coverage}${gapNotice}<div class="metrics">${cards}</div><div class="columns"><article class="card"><h2>주행 속도</h2><p class="subtle">km/h · 주황색 점은 급감속 구간</p>${graph(state.rows,r)}</article><div class="trip-side">${followup}<article class="card"><h2>감지한 이벤트</h2><div class="events">${events||'<p>감지된 이벤트가 없습니다.</p>'}</div></article></div></div>${brief?`<p class="note">유효 주행 ${minRateKm} km 이상이고 누락 구간이 없을 때 거리당 빈도를 표시합니다. 이번 기록의 횟수만 참고하세요.</p>`:''}`+drivingContext(r);
}
function parts(r){return partDashboard(r);}
function progress(r){
  const action='<div class="actions"><button class="button" id="baseline">현재 기록을 기준으로 설정</button><button class="button primary" id="improve">개선 예제 비교</button></div>';
  const repeated=baselineIsCurrent||state.base?.fingerprint===r.fingerprint;
  const olderBaseline=state.base&&state.base.analysisVersion!==r.analysisVersion;
  const differentClock=state.base&&Boolean(state.base.vehicleClock)!==r.vehicleClock;
  const canCompare=state.base?.km>0&&r.km>0&&!repeated&&!olderBaseline&&!differentClock
    &&!state.base.missingSeconds&&!r.missingSeconds;
  const qualified=canShowRate(state.base)&&canShowRate(r);
  const showChange=canCompare&&qualified&&(state.improved||comparableRoute);
  const context=canCompare&&!state.improved
    ?'<label><input id="comparable-route" type="checkbox" '+(comparableRoute?'checked':'')+'> 노선과 교통 조건이 비슷한 주행입니다</label>':'';
  const previousTrips=tripHistory.slice(6,12);
  const latestTrips=tripHistory.slice(0,6);
  const shortTrips=entries=>entries.filter(entry=>entry.km<10).length;
  const shortTrend=previousTrips.length>=3
    ?`저장 기록의 단거리 주행 · 직전 ${shortTrips(previousTrips)}/${previousTrips.length}건 → 최근 ${shortTrips(latestTrips)}/${latestTrips.length}건`
    :'이전 기록이 더 쌓이면 단거리 반복 주행 추세를 비교합니다.';
  const distances=state.base?'기준 '+fmt(state.base.km,2)+' km · 비교 '+fmt(r.km,2)+' km':'';
  const panels=TYPES.slice(0,speedOnly()?1:2).map(t=>{
    const baselineCount=state.base&&!olderBaseline&&!differentClock?count(state.base,t.id):null;
    const tripCount=count(r,t.id);
    const a=baselineCount===null?null:rate(baselineCount,state.base.km);
    const b=rate(tripCount,r.km);
    const rawCounts=baselineCount===null?'비교 '+tripCount+'건':'기준 '+baselineCount+'건 · 비교 '+tripCount+'건';
    if(!qualified)return `<article class="card"><h2>${t.label} 횟수</h2><p>${rawCounts}</p><p class="subtle">두 기록 모두 유효 주행 ${minRateKm} km 이상이고 누락이 없을 때 거리당 빈도를 표시합니다.</p></article>`;
    const zeroNote=showChange&&a===0?'<p>기준 0건이라 변화율을 계산할 수 없습니다.</p>':'';
    const max=Math.max(1,a||0,b||0);
    const change=showChange&&a>0&&b!==null?(b-a)/a*100:null;
    return `<article class="card"><h2>${t.label} 빈도</h2><p>100km당 이벤트 수</p><p>${rawCounts}</p><div class="row"><span>기준 주행</span><b>${fmt(a)}</b></div><div class="bar old"><i style="width:${(a||0)/max*100}%"></i></div><div class="row"><span>비교 주행</span><b>${fmt(b)}</b></div><div class="bar"><i style="width:${(b||0)/max*100}%"></i></div><strong class="big">${change===null?'—':(change>0?'+':'')+fmt(change,0)+'%'}</strong>${zeroNote}</article>`;
  }).join('');
  const repeatNote=repeated?'같은 주행입니다. 별도 기록을 분석하면 비교할 수 있습니다. ':'';
  const versionNote=olderBaseline?'이전 계산 방식으로 저장한 기준입니다. 최신 기록을 새 기준으로 설정해 주세요. ':'';
  const clockNote=differentClock?'두 차량 기록의 시간 기준이 다릅니다. 현재 기록을 새 기준으로 지정해 주세요. ':'';
  const storageError=state.error?'<span id="progress-error" role="status"></span> ':'';
  return title('운전 코칭',analysisMethod,action)+`${context}<p>${distances}</p><div class="split">${panels}</div><div class="note">${storageError}${state.basePinned?'기준 주행이 고정되어 있습니다. ':state.base?'':'비교할 기준 주행이 아직 없습니다. '}${state.demonstration?'시연 데이터입니다. 비교하려면 같은 유형의 기록을 두 번 분석하세요.':'기준과 비교 데이터의 노선·교통 조건은 사용자가 확인해야 합니다.'} ${repeatNote}${state.base&&(state.base.missingSeconds||r.missingSeconds)?'신호 누락이 있는 비교에서는 변화율을 표시하지 않습니다. ':''}${versionNote}${clockNote}비율 변화는 비용 절감액으로 환산하지 않습니다.</div>
    <article class="card budget-section"><h2>다음 주행에서 바꿀 행동</h2><p>${coachingSummary(r)}</p>
    <p class="subtle">${state.base&&r.km>0?`단거리 기준 10 km · 기준 ${state.base.km<10?'단거리':'장거리'} → 현재 ${r.km<10?'단거리':'장거리'}`:'최근 두 기록이 있으면 단거리 여부의 변화도 표시합니다.'}</p><p class="subtle">${shortTrend}</p></article>`;
}
function estimateRange(items){
  let low=0,high=0;
  for(const quote of items){
    low+=Math.round(quote.low*100);
    high+=Math.round(quote.high*100);
  }
  return usd(low/100)+' – '+usd(high/100);
}
function monthLabel(month){
  return validMonth(month)?month.slice(0,4)+'년 '+Number(month.slice(5))+'월':'일정 미정';
}
function careCard(part,events,signal,notice,check,action){
  const reference=referenceCosts[part];
  const amount=usd(reference.low)+' – '+usd(reference.high);
  return `<article class="card care-card">
    <div class="care-heading"><h3>${part}</h3><span class="signal ${events>0?'signal-detected':''}">${signal}</span></div>
    <p>${notice}</p><p><strong>확인할 항목</strong> ${check}</p>
    <div class="care-cost"><span class="subtle">교체 시 미국 참고가</span><strong>${amount}</strong>
    <p class="subtle">${reference.scope} · ${reference.source}</p></div>
    <button type="button" class="button" data-reference="${part}">${action}</button>
  </article>`;
}
const forecastKey='drive-health-forecast-v1';
const wearFields=[
  ['beforeKm','이전 점검 누적 주행거리 (km)','1',0],
  ['nowKm','최근 점검 누적 주행거리 (km)','1',1],
  ['beforeMm','이전 측정 두께 (mm)','0.01',0],
  ['nowMm','최근 측정 두께 (mm)','0.01',0],
  ['newMm','새 부품 기준 두께 (mm)','0.01',0.01],
  ['limitMm','정비소·매뉴얼 점검 기준 두께 (mm)','0.01',0],
  ['monthlyKm','예상 월 주행거리 (km)','1',1],
  ['improvement','습관 개선 후 마모율 감소 가정 (%)','1',0,99]
];
let forecast={part:'브레이크',parts:{},premium:null};
try{
  const saved=JSON.parse(localStorage.getItem(forecastKey)||'null');
  if(saved&&typeof saved==='object'){
    for(const part of Object.keys(referenceCosts)){
      try{
        calculateWear(saved.parts?.[part]??{});
        forecast.parts[part]=saved.parts[part];
      }catch{}
    }
    if(quoteParts.slice(0,2).includes(saved.part))forecast.part=saved.part;
    if(Number.isFinite(saved.premium)&&saved.premium>=0&&saved.premium<=100000)forecast.premium=saved.premium;
  }
}catch{}

function ownershipForecast(month,items){
  const known=items.filter(priced);
  const months=forecastMonths(month,known,forecast.premium);
  const insurance=forecast.premium===null?null:Math.round(forecast.premium*100)*months.length/100;
  const totalItems=insurance===null?known:[...known,{low:insurance,high:insurance}];
  const rows=months.map(entry=>{
    const scheduled=items.filter(item=>item.month===entry.month);
    const hasPrice=scheduled.some(priced);
    const missing=scheduled.some(item=>!priced(item));
    const range=hasPrice?estimateRange([entry]):missing?'비용 미등록':'현재 예측된 정비 없음';
    const combined=insurance===null
      ?(hasPrice?estimateRange([entry]):'—')
      :estimateRange([{low:entry.low+entry.premium,high:entry.high+entry.premium}]);
    return `<tr><th scope="row">${monthLabel(entry.month)}</th>
      <td>${scheduled.map(plannedName).join(' · ')||'—'}</td>
      <td>${range}${hasPrice&&missing?' · 미등록 비용 별도':''}</td>
      <td>${insurance===null?'미입력':usd(entry.premium)}</td><td>${combined}</td></tr>`;
  }).join('');
  return `<article class="card budget-section" id="annual-plan"><h2>12개월 정비 일정과 지출</h2>
    <p>${garage.monthlyKm===null?'예상 월 주행거리 미등록 · 기간 기준과 등록 견적을 반영합니다.':
      '예상 월 주행거리 '+garage.monthlyKm.toLocaleString('ko-KR')+' km · 점검·교체 기준과 등록 견적을 반영합니다.'}</p>
    <form id="insurance-form" class="forecast-form">
      <label class="field">월 자동차 보험료 (USD)<input name="premium" type="number" min="0" max="100000" step="0.01" value="${forecast.premium??''}" placeholder="예: 150"></label>
      <button class="button primary">보험료 반영</button>
      <p id="insurance-error" class="warn" role="status"></p>
    </form>
    <p class="subtle">등록 견적이 있으면 날짜와 비용을 우선 적용합니다. 비용이 미등록된 일정은 표에 표시하고 합계에서는 제외합니다.</p>
    <div class="forecast-total"><span>12개월 확인된 비용 합계${insurance===null?' · 보험료 미입력':''}</span>
    <strong class="big">${totalItems.length?estimateRange(totalItems):'—'}</strong></div>
    <details open><summary>월별 정비 일정과 비용</summary><div class="forecast-table" tabindex="0" role="region" aria-label="월별 정비 일정과 비용">
    <table><thead><tr><th scope="col">예정 월</th><th scope="col">정비 일정</th><th scope="col">정비비</th><th scope="col">보험료</th><th scope="col">확인된 합계</th></tr></thead><tbody>${rows}</tbody></table>
    </div></details></article>`;
}
function partForecast(r){
  const data=forecast.parts[forecast.part];
  const result=data?calculateWear(data):null;
  const prices=referenceCosts[forecast.part];
  const eventText=forecast.part==='브레이크'?'급감속 '+count(r,'brake')+'건'
    :speedOnly()?'횡가속도 미수집':'급코너링 '+count(r,'turn')+'건';
  const comparable=canShowRate(r)&&canShowRate(state.base)
    &&r.analysisVersion===state.base.analysisVersion&&r.vehicleClock===Boolean(state.base.vehicleClock)
    &&r.fingerprint!==state.base.fingerprint&&!baselineIsCurrent&&(comparableRoute||state.improved)
    &&(forecast.part==='브레이크'||!speedOnly());
  const eventType=forecast.part==='브레이크'?'brake':'turn';
  const change=comparable
    ?`비교한 주행의 100km당 이벤트 ${fmt(rate(count(state.base,eventType),state.base.km))}
      → ${fmt(rate(count(r,eventType),r.km))}건. `
    :'';
  const options=Object.keys(referenceCosts).map(part=>`<option${part===forecast.part?' selected':''}>${part}</option>`).join('');
  const fields=wearFields.map(([name,label,step,min,max])=>`<label class="field">${label}
    <input type="number" name="${name}" min="${min}" step="${step}" ${max===undefined?'':`max="${max}"`}
    value="${data?.[name]??(name==='improvement'?0:'')}" required></label>`).join('');
  const mileage=km=>Math.round(km).toLocaleString('ko-KR')+' km';
  const reserve=share=>estimateRange([{low:prices.low*share,high:prices.high*share}]);
  return `<section class="budget-section" aria-labelledby="forecast-title">
    <div class="section-heading"><h2 id="forecast-title">부품 수명과 정비비 전망</h2></div>
    <div class="split"><article class="card"><h3>부품 점검값과 운전습관 시나리오</h3>
    <p>교체 이력 없이 같은 부품을 두 번 측정한 값을 입력하세요.</p>
    <form id="wear-form">
    <label class="field">분석할 부품<select id="wear-part" name="part">${options}</select></label>
    <div class="split quote-fields">${fields}</div>
    <p class="subtle">${change}운전 이벤트 빈도와 마모율의 관계는 차량마다 달라, 마모율 감소는 직접 가정합니다.</p>
    <button class="button primary">수명과 정비비 계산</button>
    <p id="wear-error" class="warn" role="status"></p>
    </form></article>
    <div class="forecast-results"><article class="card"><h3>개별 부품 잔여수명</h3>
    <p class="subtle">${state.demonstration?'가상 주행':'현재 주행 기록'} · ${eventText}</p>
    <strong class="big">${result?mileage(result.remainingKm):'—'}</strong>
    <p>${result?`최근 마모 속도가 이어지면 점검 기준까지 약 ${fmt(result.remainingKm/data.monthlyKm)}개월입니다.`:'같은 부품의 두 점검값과 주행거리를 입력하면 기준 두께까지 남은 거리를 추정합니다.'}</p>
    </article><article class="card"><h3>운전습관 개선 시 정비비 절약 시나리오</h3>
    <strong class="big">${result?reserve(result.savingShare):'—'}</strong>
    <p>${result?`마모율 ${data.improvement}% 감소 가정 · 기준까지 ${mileage(result.improvedKm)} · 연간 정비비 적립 추정 ${reserve(result.annualWearShare)} → ${reserve(result.annualWearShare-result.savingShare)}`:'같은 거리를 달릴 때 마모율을 낮춘 경우의 12개월 정비비 적립액 차이를 계산합니다.'}</p>
    <p class="subtle">${prices.scope}. 비용은 마모량에 비례해 나눠 계산한 값입니다. 실제 절약액과 교체 시점은 점검·견적에 따라 달라집니다.</p>
    </article></div></div>
    </section>`;
}
function storeForecast(next,errorSelector){
  try{localStorage.setItem(forecastKey,JSON.stringify(next));}
  catch{document.querySelector(errorSelector).textContent='기기에 저장하지 못했습니다.';return;}
  forecast=next;
  render();
}
function budget(r){
  const month=nextCalendarMonth();
  const plan=servicePlan(month);
  const next=plan.items.filter(item=>item.month===month);
  const monthItems=next.filter(priced);
  const monthly=next.filter(item=>!item.task);
  const projected=next.filter(item=>item.task==='교체');
  const premium=forecast.premium;
  const totalItems=premium===null?monthItems:[...monthItems,{low:premium,high:premium}];
  const references=monthly.filter(q=>q.reference===true).length;
  const quote=editingQuote===null?null:budgets[editingQuote];
  const part=quote?.part??referencePart??budgetPart;
  const planItems=plan.items.filter(item=>item.part===budgetPart).sort((a,b)=>a.month.localeCompare(b.month));
  const pending=plan.near.filter(item=>item.part===budgetPart);
  const planned=planItems.find(item=>item.task!=='점검');
  const filled=quote??referenceCosts[referencePart]??(planned&&priced(planned)?planned:null);
  const options=quoteParts.filter(p=>!knownPart(p)||vehicleParts().includes(p)||p===quote?.part)
    .map(p=>`<option value="${p}"${p===part?' selected':''}>${partName(p)}</option>`).join('');
  const selectedMonth=quote?(validMonth(quote.month)?quote.month:''):planned?.month??month;
  const focus=budgetPart?`<article class="card budget-section" id="part-budget"><h2>${partName(budgetPart)} 정비 준비</h2>
    ${pending.length?`<p class="warn">${pending.map(item=>item.task+' 확인 필요').join(' · ')}</p>`:''}
    ${planItems.length?`<ul>${planItems.map(item=>`<li>${monthLabel(item.month)} · ${plannedName(item)} · ${priced(item)?estimateRange([item]):'비용 미등록'}</li>`).join('')}</ul>`
      :'<p>등록한 정비 이력과 기준 또는 예정 월이 있는 견적이 필요합니다.</p>'}
    <button type="button" class="button primary" id="jump-quote">이 부품의 견적 입력</button></article>`:'';
  const braking=count(r,'brake');
  const turns=speedOnly()?null:count(r,'turn');
  const brakeNotice=braking
    ?'급감속이 반복되면 마찰제동을 쓰는 상황에서 브레이크 패드에 부담이 커질 수 있습니다.'
    :'이 기록에서 급감속 이벤트가 잡히지 않았습니다.';
  const tireNotice=turns===null?'횡가속도 미수집 · 차속만으로 급코너링을 평가할 수 없습니다.'
    :turns?'빠른 코너링이 반복되면 타이어가 고르게 닳지 않을 수 있습니다.'
    :'이 기록에서 급코너링 이벤트가 잡히지 않았습니다.';
  const source=state.demonstration?'가상 주행 예시':state.vehicleSource?'차량 차속 기록':'가져온 CSV 기록';
  const monthlyDetail=next.length
    ?`등록 견적 ${monthly.length}건 · 직접 입력 ${monthly.length-references}건 · 참고가 ${references}건 · 교체 전망 ${projected.length}건`
    :'현재 예측된 정비 없음';
  const rows=budgets.map((b,i)=>`<div class="row quote-row"><div><strong>${b.part}</strong>
    <p class="subtle">${monthLabel(b.month)} · ${b.reference?'미국 참고가':'직접 입력'}</p></div>
    <b>${estimateRange([b])}</b><div class="actions">
    <button class="button" data-edit="${i}" aria-label="${b.part} 견적 수정">수정</button>
    <button class="button" data-delete="${i}" aria-label="${b.part} 견적 삭제">삭제</button></div></div>`).join('');
  return title('My Car Budget','정비 견적 범위와 소모품 교체 전망을 월별·연간 유지비로 확인하세요.')+
    `<article class="card budget-summary"><div><span class="subtle">${monthLabel(month)}</span>
    <h2>다음 달 예상 지출</h2><p>${monthlyDetail}</p>
    ${next.length?`<p>${next.map(plannedName).join(' · ')}</p>`:''}
    ${next.some(item=>!priced(item))?'<p class="subtle">비용 미등록 일정은 합계에서 제외</p>':''}
    <button class="button" type="button" id="jump-annual">12개월 정비 일정 보기</button>
    <dl class="info-list"><div><dt>예상 정비비</dt><dd>${monthItems.length?estimateRange(monthItems):'—'}</dd></div>
    <div><dt>월 보험료</dt><dd>${premium===null?'미입력':usd(premium)}</dd></div></dl></div>
    <strong class="big">${totalItems.length?estimateRange(totalItems):'—'}</strong></article>
    ${focus}
    ${plan.near.length?`<article class="card budget-section"><h2>먼저 확인할 정비</h2><p>${plan.near.map(item=>partName(item.part)+' '+item.task+' · '+(item.due.overdue?'도달':monthLabel(item.due.month))).join(' / ')}</p></article>`:''}
    ${ownershipForecast(month,plan.items)}
    <section class="budget-section" aria-labelledby="care-title"><div class="section-heading">
    <h2 id="care-title">주행습관으로 확인할 부품</h2><span class="pill">${source}</span></div>
    <div class="split">
    ${careCard('브레이크',braking,'급감속 '+braking+'건',brakeNotice,'패드 두께와 로터 상태. HEV·EV는 회생제동 비중에 따라 부담이 달라집니다.','브레이크 참고가 가져오기')}
    ${careCard('타이어',turns,turns===null?'횡가속도 미수집':'급코너링 '+turns+'건',tireNotice,'공기압, 트레드 깊이와 편마모.','타이어 참고가 가져오기')}
    </div><p class="subtle">주행 이벤트는 점검 단서입니다. 교체 여부와 시기는 차량 점검 결과를 기준으로 판단하세요. 참고가는 차종·규격과 지역에 따라 달라집니다.</p></section>
    <div class="split budget-section"><article class="card"><h2>${quote?'견적 수정':'정비 계획 등록'}</h2>
    <form id="estimate">
      <label class="field">정비 항목<select name="part">${options}</select></label>
      <label class="field">정비 예정 월<input id="plan-month" name="month" type="month" placeholder="YYYY-MM" value="${selectedMonth}"></label>
      <div class="split quote-fields">
        <label class="field">최소 견적 (USD)<input id="low" name="low" type="number" min="0" max="100000" step=".01" required value="${filled?.low??''}"></label>
        <label class="field">최대 견적 (USD)<input id="high" name="high" type="number" min="0" max="100000" step=".01" required value="${filled?.high??''}"></label>
      </div>
      <p class="subtle">${referencePart?'참고가를 불러왔습니다. 정비소에서 견적을 받으면 금액을 바꿔 저장하세요.':'예정 월을 비워 두면 등록한 견적 목록에만 저장됩니다.'}</p>
      <div class="actions"><button class="button primary">${quote?'변경 저장':'예산에 추가'}</button>
      ${quote||referencePart?'<button class="button" type="button" id="cancel-edit">취소</button>':''}</div>
      <p id="form-error" class="warn" role="status"></p>
    </form></article>
    <article class="card"><h2>등록한 견적 합계</h2>
    <strong class="big">${budgets.length?estimateRange(budgets):'—'}</strong>
    <div class="events">${rows||'<p>등록한 정비 견적이 없습니다.</p>'}</div></article></div>
    ${partForecast(r)}`;
}
function vehicle(){
  return title('차량 데이터','차량 정보와 정비 이력을 관리하고, 주행 기록을 수집하세요.')+
    `<article class="card"><h2>차속 기록</h2><p id="vehicle-status" role="status"></p>
    <div class="actions"><button class="button primary" id="live-start"${!window.DriveVehicle?' disabled':''}>차량 기록 시작</button><button class="button" id="speed-replay">가상 차속 재생</button></div>
    <div class="note">차량 기록에는 차속과 선택 기어를 읽을 권한이 필요합니다. P단에 두고 정차한 뒤 시작하세요. 가상 차속은 차량이 없는 환경에서 분석 흐름을 재현합니다.</div></article>`+dataPanels();
}
window.showVehicleStatus=function(message,busy){
  capture={message,busy};
  if(busy)importRequest++;
  render();
};
function receiveSpeed(samples,simulated,vehicleClock=false){
  try{
    const rows=fromSpeedSamples(samples);
    if(vehicleClock===true&&!simulated)rows[0].vehicleClock=true;
    importRequest++;
    acceptTrip(rows,simulated?'replay':'vehicle');
    capture={busy:false,message:simulated?'가상 차속 분석 완료':'차량 주행 분석 완료'};
    render();
  }catch(error){window.showVehicleStatus(error.message,false);}
}
window.acceptVehicleTrip=(samples,vehicleClock)=>receiveSpeed(samples,false,vehicleClock);
function render(){
  document.querySelector('#theme-toggle').disabled=capture.busy;
  if(capture.busy){
    document.querySelectorAll('nav button').forEach(button=>button.disabled=true);
    document.querySelector('#crumb').textContent='차량 기록';
    document.querySelector('#source').textContent='기록 중';
    content.innerHTML=title('차량 기록 중','주차하면 주행 분석을 표시합니다.')
      +'<p id="capture-status" role="status"></p>';
    document.querySelector('#capture-status').textContent=capture.message;
    return;
  }
  document.querySelectorAll('nav button').forEach(button=>button.disabled=false);
  const r=analyze(state.rows);
  document.querySelector('#crumb').textContent=garage.model||'차량 관리';
  document.querySelector('#source').textContent=state.vehicleSource||(state.demonstration?'시뮬레이션 데이터':'가져온 CSV');
  document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('on',b.dataset.page===state.page);b.setAttribute('aria-current',b.dataset.page===state.page?'page':'false');});
  content.innerHTML=({overview,parts,progress,budget,vehicle})[state.page](r);
  if(state.page==='vehicle'){
    document.querySelector('#us-model').onchange=event=>{
      const model=event.target.value;
      if(!Object.prototype.hasOwnProperty.call(usModels,model))return;
      document.querySelector('#vehicle-profile-form [name="model"]').value=model;
      document.querySelector('#vehicle-profile-form [name="powertrain"]').value=usModels[model];
    };
    document.querySelector('#vehicle-status').textContent=window.DriveVehicle?capture.message:'브라우저에서는 가상 차속을 재생할 수 있습니다.';
    document.querySelector('#live-start').onclick=()=>{
      if(!window.DriveVehicle||capture.busy)return;
      window.showVehicleStatus('차량 신호와 차속 권한을 확인하고 있습니다.',true);
      try{window.DriveVehicle.start();}
      catch{window.showVehicleStatus('차량 기록을 시작하지 못했습니다. 다시 시도해 주세요.',false);}
    };
    document.querySelector('#speed-replay').onclick=()=>{if(!capture.busy)receiveSpeed(speedReplay(),true);};
    document.querySelector('#vehicle-profile-form').onsubmit=event=>{
      event.preventDefault();
      const form=new FormData(event.target);
      const model=String(form.get('model')??'').trim().slice(0,60);
      const year=readInteger(form,'year'),km=readInteger(form,'km'),monthlyKm=readInteger(form,'monthlyKm');
      const powertrain=form.get('powertrain'),usage=form.get('usage')??'normal';
      if(!model||!Object.keys(powertrains).includes(powertrain)||!Object.keys(usageLabels).includes(usage)||!intIn(year,1900,2100)||!intIn(km,0,9999999)
          ||(monthlyKm!==null&&!intIn(monthlyKm,1,99999))){
        document.querySelector('#profile-error').textContent='차량 모델, 연식, 주행거리를 확인해 주세요.';
        return;
      }
      saveGarage({...garage,model,year,km,monthlyKm,powertrain,usage},'#profile-error');
    };
    document.querySelector('#service-record-form').onsubmit=event=>{
      event.preventDefault();
      const form=new FormData(event.target);
      const part=form.get('part'),action=form.get('action'),date=form.get('date');
      const km=readInteger(form,'km'),cost=readAmount(form,'cost');
      const memo=String(form.get('memo')??'').trim().slice(0,160);
      if(!vehicleParts().includes(part)||!['교체','점검','정비'].includes(action)||!isDate(date)
          ||new Date(date+'T00:00:00')>new Date()||!intIn(km,0,9999999)||Number.isNaN(cost)){
        document.querySelector('#service-error').textContent='정비일, 주행거리 또는 비용을 확인해 주세요.';
        return;
      }
      const record={part,action,date,km,cost,memo};
      saveGarage({...garage,records:[...garage.records,record]},'#service-error');
    };
    document.querySelectorAll('[data-remove-service]').forEach(button=>button.onclick=()=>{
      const index=Number(button.dataset.removeService);
      saveGarage({...garage,records:garage.records.filter((_,i)=>i!==index)},'#service-error');
    });

  }
  if(state.page==='overview'){
    document.querySelector('#error').textContent=state.error;
    document.querySelector('#open-budget').onclick=()=>showPage('budget');
    document.querySelectorAll('[data-trip-part]').forEach(button=>button.onclick=()=>{
      selectedPart=button.dataset.tripPart;
      showPage('parts');
    });
    const reset=()=>{
      importRequest++;
      comparableRoute=false;
      baselineIsCurrent=false;
      Object.assign(state,{rows:demo(),base:null,basePinned:false,demonstration:true,vehicleSource:'',improved:false,error:''});
      render();
    };
    document.querySelector('#reset').onclick=reset;
    const forget=document.querySelector('#forget');
    if(forget)forget.onclick=()=>{
      const updated={...trips};
      delete updated[tripKind()];
      const remaining=Object.keys(updated)[0]??null;
      try{
        if(remaining)saveTrips(updated,remaining);
        else{
          localStorage.removeItem(tripKey);
          trips={};
          lastKind=null;
        }
      }catch{state.error='기기 저장소에서 최근 기록을 삭제하지 못했습니다.';render();return;}
      importRequest++;
      if(remaining){restoreTrip(trips[remaining]);render();}
      else reset();
    };
    const restore=document.querySelector('#restore');
    if(restore)restore.onclick=()=>{
      const kind=otherSavedKind();
      importRequest++;
      restoreTrip(trips[kind]);
      try{saveTrips(trips,kind);}
      catch{state.error='최근에 연 기록을 기기 저장소에 표시하지 못했습니다.';}
      render();
    };
    document.querySelector('#import').onclick=()=>document.querySelector('#file').click();
    document.querySelector('#file').onchange=async e=>{
      const file=e.target.files[0];
      e.target.value='';
      if(!file)return;
      const request=++importRequest;
      try{
        if(file.size>3000000)throw Error('CSV는 3MB 이하만 분석할 수 있습니다.');
        const rows=parseCSV(await file.text());
        if(request!==importRequest)return;
        acceptTrip(rows,'csv');
      }catch(error){
        if(request!==importRequest)return;
        state.error=error.message;
      }
      render();
    };
  }
  if(state.page==='parts'){
    document.querySelector('#parts-to-budget').onclick=()=>showPage('budget',selectedPart);
    document.querySelectorAll('[data-part-card]').forEach(button=>button.onclick=()=>{
      selectedPart=button.dataset.partCard;
      render();
      document.querySelector('[data-part-card][aria-pressed="true"]')?.focus();
    });
    document.querySelector('#service-rule-form').onsubmit=event=>{
      event.preventDefault();
      const form=new FormData(event.target);
      const intervalKm=readInteger(form,'intervalKm')??0;
      const intervalMonths=readInteger(form,'intervalMonths')??0;
      const inspectionKm=readInteger(form,'inspectionKm')??0;
      const inspectionMonths=readInteger(form,'inspectionMonths')??0;
      const low=readAmount(form,'low'),high=readAmount(form,'high');
      if(!intIn(intervalKm,0,1000000)||!intIn(intervalMonths,0,240)
          ||!intIn(inspectionKm,0,1000000)||!intIn(inspectionMonths,0,240)
          ||(low===null)!==(high===null)||Number.isNaN(low)||Number.isNaN(high)||high<low){
        document.querySelector('#rule-error').textContent='점검·교체 기준과 최소·최대 비용 범위를 확인해 주세요.';
        return;
      }
      const rule={intervalKm,intervalMonths,inspectionKm,inspectionMonths,low,high};
      const key=garage.usage==='severe'?'severeRules':'rules';
      saveGarage({...garage,[key]:{...garage[key],[selectedPart]:rule}},'#rule-error');
    };
  }
  if(state.page==='progress'){
    const error=document.querySelector('#progress-error');
    if(error)error.textContent=state.error;
    const routeCheck=document.querySelector('#comparable-route');
    if(routeCheck)routeCheck.onchange=()=>{
      comparableRoute=routeCheck.checked;
      render();
      document.querySelector('#comparable-route')?.focus();
    };
    document.querySelector('#baseline').onclick=()=>{
      comparableRoute=false;
      baselineIsCurrent=true;
      state.improved=false;
      state.base=r;state.basePinned=true;state.error='';storeTrip();render();
    };
    document.querySelector('#improve').onclick=()=>{importRequest++;comparableRoute=false;baselineIsCurrent=false;Object.assign(state,{rows:demo(true),base:analyze(demo()),basePinned:false,demonstration:true,vehicleSource:'',improved:true,error:''});render();};
  }
  if(state.page==='budget'){
    document.querySelector('#jump-annual').onclick=()=>document.querySelector('#annual-plan').scrollIntoView?.({block:'start'});
    if(budgetPart)document.querySelector('#jump-quote').onclick=()=>{
      document.querySelector('#estimate').scrollIntoView?.({block:'start'});
      document.querySelector('#low').focus?.({preventScroll:true});
    };
    document.querySelector('#wear-part').onchange=e=>{
      if(quoteParts.slice(0,2).includes(e.target.value)){
        forecast={...forecast,part:e.target.value};
        render();
        document.querySelector('#wear-part')?.focus?.();
      }
    };
    document.querySelector('#wear-form').onsubmit=e=>{
      e.preventDefault();
      const form=new FormData(e.target);
      const values=Object.fromEntries(wearFields.map(([name])=>{
        const value=form.get(name);
        return [name,typeof value==='string'&&value.trim()?Number(value):NaN];
      }));
      try{calculateWear(values);}
      catch(error){document.querySelector('#wear-error').textContent=error.message;return;}
      storeForecast({...forecast,parts:{...forecast.parts,[forecast.part]:values}},'#wear-error');
      document.querySelector('#forecast-title')?.scrollIntoView?.({block:'start'});
    };
    document.querySelector('#insurance-form').onsubmit=e=>{
      e.preventDefault();
      const raw=String(new FormData(e.target).get('premium')??'').trim();
      if(raw&&(!/^\d+(?:\.\d{1,2})?$/.test(raw)||Number(raw)>100000)){
        document.querySelector('#insurance-error').textContent='0~100,000 USD 사이에서 소수점 둘째 자리까지 입력하세요.';
        return;
      }
      storeForecast({...forecast,premium:raw?Number(raw):null},'#insurance-error');
    };
    const commit=next=>{
      try{localStorage.setItem('drive-health-budget',JSON.stringify(next));}
      catch{document.querySelector('#form-error').textContent='기기 저장소에 저장하지 못했습니다. 다시 시도해 주세요.';return;}
      budgets=next;
      editingQuote=null;
      referencePart=null;
      render();
    };
    document.querySelector('#estimate').onsubmit=e=>{
      e.preventDefault();
      const fields=new FormData(e.target);
      const part=fields.get('part');
      const values=[fields.get('low'),fields.get('high')];
      const [low,high]=values.map(Number);
      if(!quoteParts.includes(part)||values.some(value=>typeof value!=='string'||!value.trim())
        ||[low,high].some(value=>!Number.isFinite(value)||value<0||value>100000)){
        document.querySelector('#form-error').textContent='0~100,000 USD 사이의 견적을 입력해 주세요.';
        return;
      }
      if(values.some(value=>!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))){
        document.querySelector('#form-error').textContent='견적 금액은 소수점 둘째 자리까지 입력해 주세요.';
        return;
      }
      if(high<low){document.querySelector('#form-error').textContent='최대 견적은 최소 견적 이상이어야 합니다.';return;}
      const month=fields.get('month')??'';
      if(month!==''&&!validMonth(month)){
        document.querySelector('#form-error').textContent='정비 예정 월을 연도와 월 형식으로 입력해 주세요.';
        return;
      }
      const reference=referenceCosts[part];
      const prior=budgets[editingQuote];
      const fromReference=(referencePart===part||(prior?.part===part&&prior.reference===true))
        &&reference?.low===low&&reference?.high===high;
      const quote={part,low,high,...(month?{month}:{}),...(fromReference?{reference:true}:{})};
      const next=editingQuote===null?[...budgets,quote]
        :budgets.map((previous,index)=>index===editingQuote?quote:previous);
      commit(next);
    };
    const cancel=document.querySelector('#cancel-edit');
    if(cancel)cancel.onclick=()=>{editingQuote=null;referencePart=null;render();};
    document.querySelectorAll('[data-reference]').forEach(button=>button.onclick=()=>{
      editingQuote=null;
      referencePart=button.dataset.reference;
      render();
      document.querySelector('#plan-month')?.focus?.();
    });
    document.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>{
      editingQuote=Number(button.dataset.edit);
      referencePart=null;
      render();
      document.querySelector('#low')?.focus?.();
    });
    document.querySelectorAll('[data-delete]').forEach(button=>button.onclick=()=>{
      commit(budgets.filter((_,index)=>index!==Number(button.dataset.delete)));
    });
  }
}
function showPage(page,part=null){
  if(capture.busy)return;
  editingQuote=null;
  referencePart=null;
  budgetPart=part;
  state.page=page;
  render();
  window.scrollTo?.(0,0);
}

function setupTheme(){
  const root=document.documentElement;
  const button=document.querySelector('#theme-toggle');
  const system=window.matchMedia('(prefers-color-scheme: dark)');
  const key='drive-health-theme';
  let manual;
  try{manual=localStorage.getItem(key);}catch{}
  const apply=()=>{
    const dark=manual==='dark'||(manual!=='light'&&(window.DriveVehicle?.isNightMode?.()??system.matches));
    root.dataset.theme=dark?'dark':'light';
    button.setAttribute('aria-pressed',String(dark));
    button.querySelector('span').textContent=dark?'주간':'야간';
    button.setAttribute('aria-label',dark?'주간 테마로 전환':'야간 테마로 전환');
  };
  button.onclick=()=>{
    manual=root.dataset.theme==='dark'?'light':'dark';
    try{localStorage.setItem(key,manual);}catch{}
    apply();
  };
  system.addEventListener('change',apply);
  apply();
}

document.querySelectorAll('nav button').forEach(button=>button.onclick=()=>showPage(button.dataset.page));
if(document.documentElement)setupTheme();
render();
