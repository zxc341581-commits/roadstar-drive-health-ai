'use strict';
const {TYPES,parseCSV,analyze,hasGap,demo,rate,fromSpeedSamples,speedReplay}=DriveEngine;
const names={vehicle:'차량 기록',overview:'주행 리포트',parts:'부품별 분석',progress:'습관 비교',budget:'정비 예산'};
const state={page:'overview',rows:demo(),base:null,basePinned:false,demonstration:true,vehicleSource:'',improved:false,vehicle:'ice',error:''};
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
  try{saveTrips(updated,kind);}
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
    packed[kind]={...trip,rows,vehicleClock:trip.rows[0].vehicleClock===true};
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
  storeTrip();
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
const quoteParts=[...Object.keys(referenceCosts),'정기정비'];
const validMonth=value=>typeof value==='string'&&/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
let budgets=[];
let editingQuote=null;
let referencePart=null;

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
function overview(r){
  const alternative=otherSavedKind();
  const restoreLabel=alternative==='csv'?'최근 CSV':'최근 차량 기록';
  const action=`<div class="actions">${!state.demonstration?'<button class="button" id="forget">최근 기록 삭제</button>':''}<button class="button" id="open-budget">부품 점검·예산</button><button class="button" id="reset">예제 주행</button>${alternative?'<button class="button" id="restore">'+restoreLabel+'</button>':''}<button class="button primary" id="import">CSV 분석</button><input type="file" id="file" accept=".csv,text/csv" hidden></div>`;
  const cards=[['분석 주행거리',fmt(r.km)+' km',r.missingSeconds>0?'수집된 구간만 계산':'시간과 차속으로 계산'],['급감속',count(r,'brake')+'건',fmt(rate(count(r,'brake'),r.km))+'건 / 100km'],['급코너링',speedOnly()?'—':count(r,'turn')+'건',speedOnly()?'횡가속도 신호 미수집':fmt(rate(count(r,'turn'),r.km))+'건 / 100km']].map(([t,v,d])=>`<div class="card metric"><h3>${t}</h3><strong>${v}</strong><p>${d}</p></div>`).join('');
  const events=r.events.slice(0,100).map(e=>`<div class="event"><strong>${TYPES.find(t=>t.id===e.type).label}</strong><span>${timer(e.t-state.rows[0].t)} · ${fmt(e.peak)} m/s²</span></div>`).join('');
  const duration=state.rows[state.rows.length-1].t-state.rows[0].t;
  const observedSeconds=Math.max(0,duration-r.missingSeconds);
  const basis=r.vehicleClock?'차량 신호 시각 기준':'기록의 표본 시각 기준';
  const coverage='<p class="subtle">분석 가능 시간 '+fmt(observedSeconds)+'초 / '+fmt(duration)+'초 · '+basis+'</p>';
  const gapNotice=r.missingSeconds>0
    ?'<div class="note">표본 간격이 길거나 신호가 누락·이상인 '+fmt(r.missingSeconds)+'초는 거리와 이벤트 계산에서 제외했습니다.</div>':'';
  return title('주행 리포트','주행을 마친 뒤 주요 운전 이벤트를 확인하세요.',action)+
    `<p id="error" class="warn" role="status"></p>${coverage}${gapNotice}<div class="metrics">${cards}</div><div class="columns"><article class="card"><h2>주행 속도</h2><p class="subtle">km/h · 주황색 점은 급감속 구간</p>${graph(state.rows,r)}</article><article class="card"><h2>감지한 이벤트</h2><div class="events">${events||'<p>감지된 이벤트가 없습니다.</p>'}</div></article></div><div class="note">급감속의 원인과 필요성은 이 데이터만으로 판별하기 어렵습니다.</div>`;
}
function parts(r){
  return title('부품별 부담 요인','운전 이벤트를 부품별로 해석하고 다음 주행 목표를 정합니다.',
    `<label class="field">파워트레인<select id="vehicle"><option value="ice">내연기관</option><option value="electric">HEV·EV</option></select></label>`)+
    `<div class="split"><article class="card"><span class="tag">브레이크</span><strong class="big">${count(r,'brake')}건</strong><h2>급감속 구간</h2><p>${state.vehicle==='electric'?'회생제동과 마찰제동 비중을 확인할 차량 신호가 필요합니다.':'반복 감속은 마찰제동 사용 시 브레이크 부담과 관련될 수 있습니다.'}</p><div class="note"><strong>다음 주행 목표</strong><br>가능한 상황에서 전방 흐름을 일찍 살피고 감속을 미리 시작해 보세요. 필요한 제동은 즉시 하세요.</div></article>
    <article class="card"><span class="tag">타이어</span><strong class="big">${speedOnly()?'—':count(r,'turn')+'건'}</strong><h2>큰 횡가속 구간</h2><p>${speedOnly()?'차속만 읽은 기록입니다. 타이어 관련 횡가속도 분석에는 별도 입력이 필요합니다.':'타이어의 상태는 공기압, 노면, 정렬과 운전 조건에 영향을 받습니다.'}</p><div class="note"><strong>다음 주행 목표</strong><br>안전한 속도로 코너에 진입하고 조향을 부드럽게 이어가 보세요.</div></article></div><div class="note">이 리포트는 운전 이벤트 요약입니다. 부품 마모량과 교체일은 정비 점검으로 확인하세요.</div>`;
}
function progress(r){
  const action='<div class="actions"><button class="button" id="baseline">현재 기록을 기준으로 설정</button><button class="button primary" id="improve">개선 예제 비교</button></div>';
  const repeated=baselineIsCurrent||state.base?.fingerprint===r.fingerprint;
  const olderBaseline=state.base&&state.base.analysisVersion!==r.analysisVersion;
  const differentClock=state.base&&Boolean(state.base.vehicleClock)!==r.vehicleClock;
  const canCompare=state.base?.km>0&&r.km>0&&!repeated&&!olderBaseline&&!differentClock
    &&!state.base.missingSeconds&&!r.missingSeconds;
  const showChange=canCompare&&(state.improved||comparableRoute);
  const context=canCompare&&!state.improved
    ?'<label><input id="comparable-route" type="checkbox" '+(comparableRoute?'checked':'')+'> 노선과 교통 조건이 비슷한 주행입니다</label>':'';
  const distances=state.base?'기준 '+fmt(state.base.km,2)+' km · 비교 '+fmt(r.km,2)+' km':'';
  const panels=TYPES.slice(0,speedOnly()?1:2).map(t=>{
    const baselineCount=state.base&&!olderBaseline&&!differentClock?count(state.base,t.id):null;
    const tripCount=count(r,t.id);
    const a=baselineCount===null?null:rate(baselineCount,state.base.km);
    const b=rate(tripCount,r.km);
    const rawCounts=baselineCount===null?'비교 '+tripCount+'건':'기준 '+baselineCount+'건 · 비교 '+tripCount+'건';
    const zeroNote=showChange&&a===0?'<p>기준 0건이라 변화율을 계산할 수 없습니다.</p>':'';
    const max=Math.max(1,a||0,b||0);
    const change=showChange&&a>0&&b!==null?(b-a)/a*100:null;
    return `<article class="card"><h2>${t.label} 빈도</h2><p>100km당 이벤트 수</p><p>${rawCounts}</p><div class="row"><span>기준 주행</span><b>${fmt(a)}</b></div><div class="bar old"><i style="width:${(a||0)/max*100}%"></i></div><div class="row"><span>비교 주행</span><b>${fmt(b)}</b></div><div class="bar"><i style="width:${(b||0)/max*100}%"></i></div><strong class="big">${change===null?'—':(change>0?'+':'')+fmt(change,0)+'%'}</strong>${zeroNote}</article>`;
  }).join('');
  const repeatNote=repeated?'같은 주행입니다. 별도 기록을 분석하면 비교할 수 있습니다. ':'';
  const versionNote=olderBaseline?'이전 계산 방식으로 저장한 기준입니다. 최신 기록을 새 기준으로 설정해 주세요. ':'';
  const clockNote=differentClock?'두 차량 기록의 시간 기준이 다릅니다. 현재 기록을 새 기준으로 지정해 주세요. ':'';
  const storageError=state.error?'<span id="progress-error" role="status"></span> ':'';
  return title('습관 비교','비슷한 조건의 두 주행을 거리당 이벤트 수로 비교합니다.',action)+`${context}<p>${distances}</p><div class="split">${panels}</div><div class="note">${storageError}${state.basePinned?'기준 주행이 고정되어 있습니다. ':state.base?'':'비교할 기준 주행이 아직 없습니다. '}${state.demonstration?'시연 데이터입니다. 비교하려면 같은 유형의 기록을 두 번 분석하세요.':'기준과 비교 데이터의 노선·교통 조건은 사용자가 확인해야 합니다.'} ${repeatNote}${state.base&&(state.base.missingSeconds||r.missingSeconds)?'신호 누락이 있는 비교에서는 변화율을 표시하지 않습니다. ':''}${versionNote}${clockNote}비율 변화는 비용 절감액으로 환산하지 않습니다.</div>`;
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
function budget(r){
  const month=nextCalendarMonth();
  const monthly=budgets.filter(q=>q.month===month);
  const references=monthly.filter(q=>q.reference===true).length;
  const quote=editingQuote===null?null:budgets[editingQuote];
  const part=quote?.part??referencePart;
  const filled=quote??referenceCosts[referencePart];
  const options=quoteParts.map(p=>`<option${p===part?' selected':''}>${p}</option>`).join('');
  const selectedMonth=quote?(validMonth(quote.month)?quote.month:''):month;
  const braking=count(r,'brake');
  const turns=speedOnly()?null:count(r,'turn');
  const brakeNotice=braking
    ?'급감속이 반복되면 마찰제동을 쓰는 상황에서 브레이크 패드에 부담이 커질 수 있습니다.'
    :'이 기록에서 급감속 이벤트가 잡히지 않았습니다.';
  const tireNotice=turns===null?'횡가속도 미수집 · 차속만으로 급코너링을 평가할 수 없습니다.'
    :turns?'빠른 코너링이 반복되면 타이어가 고르게 닳지 않을 수 있습니다.'
    :'이 기록에서 급코너링 이벤트가 잡히지 않았습니다.';
  const source=state.demonstration?'가상 주행 예시':state.vehicleSource?'차량 차속 기록':'가져온 CSV 기록';
  const monthlyDetail=monthly.length
    ?`등록 ${monthly.length}건 · 직접 입력 ${monthly.length-references}건 · 참고가 ${references}건`
    :'다음 달에 예정된 정비가 없습니다. 견적과 예정 월을 입력해 보세요.';
  const rows=budgets.map((b,i)=>`<div class="row quote-row"><div><strong>${b.part}</strong>
    <p class="subtle">${monthLabel(b.month)} · ${b.reference?'미국 참고가':'직접 입력'}</p></div>
    <b>${estimateRange([b])}</b><div class="actions">
    <button class="button" data-edit="${i}" aria-label="${b.part} 견적 수정">수정</button>
    <button class="button" data-delete="${i}" aria-label="${b.part} 견적 삭제">삭제</button></div></div>`).join('');
  return title('정비 예산','주행습관에서 확인할 부품을 찾고, 정비 견적 범위를 바탕으로 다음 달 지출을 계획하세요.')+
    `<article class="card budget-summary"><div><span class="subtle">${monthLabel(month)}</span>
    <h2>다음 달 예상 지출</h2><p>${monthlyDetail}</p></div>
    <strong class="big">${monthly.length?estimateRange(monthly):'—'}</strong></article>
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
    <div class="events">${rows||'<p>등록한 정비 견적이 없습니다.</p>'}</div></article></div>`;
}
function vehicle(){
  return title('차량 기록','차속과 변속 위치를 읽어 주차 후 주행 리포트를 엽니다.')+
    `<article class="card"><h2>차속 기록</h2><p id="vehicle-status" role="status"></p>
    <div class="actions"><button class="button primary" id="live-start"${!window.DriveVehicle?' disabled':''}>차량 기록 시작</button><button class="button" id="speed-replay">가상 차속 재생</button></div>
    <div class="note">차량 기록에는 차속과 선택 기어를 읽을 권한이 필요합니다. P단에 두고 정차한 뒤 시작하세요. 가상 차속은 차량이 없는 환경에서 분석 흐름을 재현합니다.</div></article>`;
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
  document.querySelector('#crumb').textContent=names[state.page];
  document.querySelector('#source').textContent=state.vehicleSource||(state.demonstration?'시뮬레이션 데이터':'가져온 CSV');
  document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('on',b.dataset.page===state.page);b.setAttribute('aria-current',b.dataset.page===state.page?'page':'false');});
  content.innerHTML=({overview,parts,progress,budget,vehicle})[state.page](r);
  if(state.page==='vehicle'){
    document.querySelector('#vehicle-status').textContent=window.DriveVehicle?capture.message:'브라우저에서는 가상 차속을 재생할 수 있습니다.';
    document.querySelector('#live-start').onclick=()=>{
      if(!window.DriveVehicle||capture.busy)return;
      window.showVehicleStatus('차량 신호와 차속 권한을 확인하고 있습니다.',true);
      try{window.DriveVehicle.start();}
      catch{window.showVehicleStatus('차량 기록을 시작하지 못했습니다. 다시 시도해 주세요.',false);}
    };
    document.querySelector('#speed-replay').onclick=()=>{if(!capture.busy)receiveSpeed(speedReplay(),true);};
  }
  if(state.page==='overview'){
    document.querySelector('#error').textContent=state.error;
    document.querySelector('#open-budget').onclick=()=>{state.page='budget';render();};
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
  if(state.page==='parts'){const selector=document.querySelector('#vehicle');selector.value=state.vehicle;selector.onchange=()=>{state.vehicle=selector.value;render();document.querySelector('#vehicle').focus();};}
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
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{if(!capture.busy){editingQuote=null;referencePart=null;state.page=b.dataset.page;render();}});
render();
