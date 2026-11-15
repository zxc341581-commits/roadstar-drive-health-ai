'use strict';

function calculateWear(inputs){
  const {beforeKm,nowKm,beforeMm,nowMm,newMm,limitMm,monthlyKm,improvement}=inputs;
  const values=[beforeKm,nowKm,beforeMm,nowMm,newMm,limitMm,monthlyKm,improvement];
  if(values.some(value=>!Number.isFinite(value)||value<0)||nowKm<=beforeKm
      ||beforeMm<=nowMm||newMm<beforeMm||nowMm<limitMm||monthlyKm<=0||improvement>=100){
    throw Error('같은 부품의 두 실측값, 늘어난 누적 주행거리, 새 부품 두께와 점검 기준을 확인하세요. 개선 가정은 0~99%입니다.');
  }
  const wearPerKm=(beforeMm-nowMm)/(nowKm-beforeKm);
  const remainingKm=(nowMm-limitMm)/wearPerKm;
  const improvedKm=remainingKm/(1-improvement/100);
  const annualWearShare=12*monthlyKm*wearPerKm/(newMm-limitMm);
  const savingShare=annualWearShare*improvement/100;
  if(![remainingKm,improvedKm,annualWearShare,savingShare].every(Number.isFinite)){
    throw Error('계산 범위를 벗어났습니다. 측정값과 주행거리를 확인하세요.');
  }
  return {remainingKm,improvedKm,annualWearShare,savingShare};
}

function forecastMonths(firstMonth,quotes,premium){
  const [year,month]=firstMonth.split('-').map(Number);
  return Array.from({length:12},(_,i)=>{
    const d=new Date(year,month-1+i,1);
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const planned=quotes.filter(quote=>quote.month===key);
    return {
      month:key,
      low:planned.reduce((sum,quote)=>sum+Math.round(quote.low*100),0)/100,
      high:planned.reduce((sum,quote)=>sum+Math.round(quote.high*100),0)/100,
      premium
    };
  });
}

if(typeof module!=='undefined') module.exports={calculateWear,forecastMonths};
