'use strict';

const serviceParts={
  '엔진오일':{habit:'짧은 거리 주행과 공회전이 반복되면 차량 매뉴얼의 가혹 조건을 확인하세요.',check:'오일량·상태와 제조사 교체 기준',coach:'가능한 경우 짧은 일정을 한 번의 이동으로 묶으세요.'},
  '타이어':{habit:'잦은 급코너링과 급가감속은 타이어 부담을 살필 단서입니다.',check:'냉간 공기압·트레드 깊이·편마모',coach:'코너에 들어가기 전에 속도를 줄이고 부드럽게 조향하세요.'},
  '브레이크':{habit:'잦은 급감속은 마찰제동을 사용하는 상황에서 패드·로터 부담을 살필 단서입니다.',check:'패드 두께·로터 상태',coach:'전방 흐름을 일찍 확인해 여유 있게 감속하세요. 필요한 제동은 즉시 하세요.'},
  '배터리':{habit:'잦은 짧은 운행에서는 12V 배터리의 충전 상태를 살펴보세요.',check:'12V 배터리 상태·시동 또는 전원 계통 점검',coach:'전원이 꺼진 상태에서 전장품 사용을 줄이고, 시동이나 전원 문제가 반복되면 점검을 받으세요.'},
  '변속기 오일':{habit:'반복적인 급가속과 가혹한 운행 조건에서는 차량별 기준을 확인하세요.',check:'장착된 변속기 유형·제조사 점검 기준',coach:'속도를 부드럽게 높이고 견인이나 정체가 잦으면 제조사 가혹 조건을 확인하세요.'}
};

function tripContext(rows,gapAt){
  let rpmSeconds=0,rpmIntegral=0,idleSeconds=0;
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1],b=rows[i];
    if(gapAt(b,a)||!Number.isFinite(a.rpm)||!Number.isFinite(b.rpm))continue;
    const dt=b.t-a.t;
    rpmSeconds+=dt;
    rpmIntegral+=(a.rpm+b.rpm)/2*dt;
    if(a.speed<=1&&b.speed<=1&&a.rpm>0&&b.rpm>0)idleSeconds+=dt;
  }
  return {averageRpm:rpmSeconds?rpmIntegral/rpmSeconds:null,idleSeconds:rpmSeconds?idleSeconds:null};
}

function addCalendarMonths(date,months){
  const end=new Date(date.getFullYear(),date.getMonth()+months+1,0,12);
  return new Date(end.getFullYear(),end.getMonth(),Math.min(date.getDate(),end.getDate()),12);
}

function serviceDue(profile,records,part,today=new Date()){
  const rule=profile.rules?.[part];
  const last=records.filter(record=>record.part===part&&record.action==='교체')
    .sort((a,b)=>b.date.localeCompare(a.date)||b.km-a.km)[0];
  if(!last||!rule||(!rule.intervalKm&&!rule.intervalMonths))return null;
  const candidates=[];
  const dueKm=rule.intervalKm>0?last.km+rule.intervalKm:null;
  if(rule.intervalMonths>0)candidates.push(addCalendarMonths(new Date(last.date+'T12:00:00'),rule.intervalMonths));
  if(dueKm!==null&&profile.km!==null){
    const remaining=dueKm-profile.km;
    if(remaining<=0)candidates.push(today);
    else if(profile.monthlyKm>0)candidates.push(new Date(today.getFullYear(),today.getMonth(),today.getDate()+Math.ceil(remaining/profile.monthlyKm*30.4375),12));
  }
  const due=candidates.sort((a,b)=>a-b)[0]??null;
  const key=due?due.getFullYear()+'-'+String(due.getMonth()+1).padStart(2,'0'):null;
  return {dueKm,month:key,overdue:Boolean(due&&due<=today)||Boolean(dueKm!==null&&profile.km!==null&&dueKm<=profile.km)};
}

if(typeof module!=='undefined')module.exports={serviceParts,tripContext,addCalendarMonths,serviceDue};
