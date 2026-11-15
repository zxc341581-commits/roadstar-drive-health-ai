(function(root){
  'use strict';
  const TYPES=[
    {id:'brake',label:'급감속',part:'브레이크',unit:'m/s²',threshold:3.0,value:s=>-s.long},
    {id:'turn',label:'급코너링',part:'타이어',unit:'m/s²',threshold:3.2,value:s=>Math.abs(s.lat)},
    {id:'accel',label:'급가속',part:'구동계',unit:'m/s²',threshold:3.0,value:s=>s.long}
  ];
  const MAX_ACCELERATION=30;
  const ROUNDING_TOLERANCE=1e-9;
  const decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  function parseCSV(text){
    const lines=text.trim().split(/\r?\n/);
    if(lines.shift()?.replace(/^\uFEFF/,'').trim()!=='t_s,speed_kmh,long_ms2,lat_ms2') throw Error('CSV 헤더를 확인해 주세요.');
    const rows=lines.map((line,i)=>{
      const cells=line.split(',').map(cell=>cell.trim());
      const [t,speed,long,lat]=cells.map(Number);
      if(cells.length!==4||cells.some(value=>!decimal.test(value))||![t,speed,long,lat].every(Number.isFinite)||t<0||speed<0||speed>300||Math.abs(long)>MAX_ACCELERATION||Math.abs(lat)>MAX_ACCELERATION) throw Error(`${i+2}행의 값이 올바르지 않습니다.`);
      return {t,speed,long,lat};
    });
    if(rows.length<3) throw Error('3개 이상의 샘플이 필요합니다.');
    rows.forEach((s,i)=>{if(i&&(s.t<=rows[i-1].t||s.t-rows[i-1].t>5)) throw Error('시간은 오름차순이며 샘플 간격은 5초 이하여야 합니다.');});
    return rows;
  }
  const ANALYSIS_VERSION=4;
  function isSpeedSpike(row){
    return row.lat===null&&Math.abs(row.long)>MAX_ACCELERATION+ROUNDING_TOLERANCE;
  }
  function hasGap(row,previous){
    return Boolean(previous&&(row.gapBefore||isSpeedSpike(row)||row.t-previous.t>1+ROUNDING_TOLERANCE));
  }
  function tripFingerprint(rows){
    let hash=2166136261;
    for(const row of rows){
      const fields=[row.t-rows[0].t,row.speed,row.long,row.lat,row.gapBefore===true].join(',');
      for(const character of fields+';')hash=Math.imul(hash^character.charCodeAt(0),16777619);
    }
    return rows.length+':'+(hash>>>0).toString(16);
  }
  function analyze(rows){
    const events=[],active={};
    let km=0,missingSeconds=0;
    rows.forEach((s,i)=>{
      const previous=rows[i-1];
      const gap=hasGap(s,previous);
      const spike=isSpeedSpike(s);
      if(i){
        const duration=s.t-rows[i-1].t;
        if(gap)missingSeconds+=duration;
        else km+=duration*(s.speed+rows[i-1].speed)/7200;
      }
      TYPES.forEach(type=>{
        const peak=type.value(s);
        if(gap&&active[type.id]){
          if(active[type.id].end-active[type.id].t>=0.5-ROUNDING_TOLERANCE)events.push(active[type.id]);
          delete active[type.id];
        }
        // Derived acceleration covers the interval ending at this sample.
        const gateSpeed=type.id==='brake'&&s.lat===null&&previous&&!gap
          ?Math.max(previous.speed,s.speed):s.speed;
        if(!spike&&(type.id!=='turn'||s.lat!==null)&&peak>=type.threshold-ROUNDING_TOLERANCE&&gateSpeed>=5-ROUNDING_TOLERANCE){
          if(!active[type.id])active[type.id]={type:type.id,t:s.t,end:s.t,peak,speed:s.speed};
          else {active[type.id].end=s.t; active[type.id].peak=Math.max(active[type.id].peak,peak);}
        } else if(active[type.id]){
          if(active[type.id].end-active[type.id].t>=0.5-ROUNDING_TOLERANCE)events.push(active[type.id]);
          delete active[type.id];
        }
      });
    });
    Object.values(active).forEach(e=>{if(e.end-e.t>=0.5-ROUNDING_TOLERANCE)events.push(e);});
    return {km,missingSeconds,vehicleClock:rows[0]?.vehicleClock===true,analysisVersion:ANALYSIS_VERSION,fingerprint:tripFingerprint(rows),events:events.sort((a,b)=>a.t-b.t)};
  }
  function demo(improved=false){
    const brakes=improved?[80,175,315]:[65,105,160,235,315];
    const turns=improved?[122,282]:[122,205,282];
    const launches=improved?[24,329]:[24,140,329];
    const rows=[];
    for(let i=0;i<=840;i++){
      const t=i/2; const spike=(times)=>times.some(x=>t>=x&&t<=x+1);
      const braking=spike(brakes), accel=spike(launches);
      rows.push({t,speed:Math.max(0,Math.round((48+11*Math.sin(t/19)-(braking?8:0))*Math.min(1,t/12,(420-t)/12)*10)/10),long:braking?-3.8:accel?3.4:0.1*Math.cos(t/19),lat:spike(turns)?3.5:0.2*Math.sin(t/10)});
    }
    return rows;
  }
  function fromSpeedSamples(samples){
    if(!Array.isArray(samples)||samples.length<3||samples.length>14401) throw Error('분석할 차속 샘플이 부족합니다.');
    return samples.map((sample,i)=>{
      if(!Array.isArray(sample)||(sample.length!==2&&(sample.length!==3||sample[2]!==true||!i))) throw Error('차속 샘플을 확인해 주세요.');
      const [t,mps,markedGap=false]=sample;
      if(!Number.isFinite(t)||t<0||!Number.isFinite(mps)||Math.abs(mps)>300/3.6) throw Error('차속 샘플을 확인해 주세요.');
      const dt=i?t-samples[i-1][0]:0;
      if(i&&(dt<=0||dt>2+ROUNDING_TOLERANCE)) throw Error('차속 신호의 시간 간격이 유효하지 않습니다.');
      const prev=i?samples[i-1][1]:mps;
      const acceleration=i?(mps-prev)/dt:0;
      const gapBefore=markedGap||dt>1+ROUNDING_TOLERANCE
        ||Math.abs(acceleration)>MAX_ACCELERATION+ROUNDING_TOLERANCE;
      const long=!gapBefore&&prev>=0&&mps>=0?acceleration:0;
      return {t,speed:Math.abs(mps)*3.6,long,lat:null,...(gapBefore?{gapBefore:true}:{})};
    });
  }
  function speedReplay(){
    const knots=[[0,0],[5,10],[10,10],[12,2],[17,12],[22,12],[24,4],[30,10],[35,10],[37,2],[40,0]];
    let k=0;
    return Array.from({length:81},(_,i)=>{
      const t=i/2;
      while(k+1<knots.length-1&&t>knots[k+1][0])k++;
      const [ta,va]=knots[k],[tb,vb]=knots[k+1];
      return [t,va+(vb-va)*(t-ta)/(tb-ta)];
    });
  }
  function rate(n,km){return km>0?n/km*100:null;}
  const api={TYPES,parseCSV,analyze,hasGap,demo,rate,fromSpeedSamples,speedReplay};
  if(typeof module!=='undefined')module.exports=api;else root.DriveEngine=api;
})(globalThis);
