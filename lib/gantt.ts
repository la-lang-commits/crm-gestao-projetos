import { deliveryDay, shiftDay } from './calendar';
export type GanttStep={id:string;order:number;stageName:string;assigneeId:string;assignee:string;slaValue:number;slaUnit:string;status:string;startedAt:string|null;dueAt:string|null;completedAt:string|null;completedLate:boolean};
export type GanttProject={id:string;name:string;demand:string;sei:string;ticket:number;ownerId:string;owner:string;openedAt:string;slaDueAt:string|null;status:string;progress:number;workflow:GanttStep[]};
export type GanttTone='done'|'doing'|'attention'|'late'|'pending'|'cancelled';
export const ganttLabels:Record<GanttTone,string>={done:'Concluído',doing:'Em andamento',attention:'Atenção',late:'Atrasado',pending:'Não iniciado',cancelled:'Cancelado'};
export function dayDistance(a:string,b:string){return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);}
export function forecastEnd(start:string,value:number,unit:string){
 const amount=Math.max(0,Math.round(value));
 if(unit==='business_days'){let d=start,left=amount;while(left>0){d=shiftDay(d,1);const dow=new Date(d+'T12:00:00Z').getUTCDay();if(dow!==0&&dow!==6)left--;}return d;}
 if(unit==='months'){const d=new Date(start+'T12:00:00Z');const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+amount+1,0)).getUTCDate();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+amount,Math.min(d.getUTCDate(),last),12)).toISOString().slice(0,10);}
 return shiftDay(start,unit==='hours'?Math.ceil(amount/24):amount);
}
export function ganttTone(status:string,end:string|null,today:string):GanttTone{
 if(['Concluído','completed','skipped'].includes(status))return 'done';
 if(['Cancelado','cancelled'].includes(status))return 'cancelled';
 if(status==='pending')return 'pending';
 if(end&&end<today)return 'late';
 if(end&&dayDistance(today,end)<=3)return 'attention';
 return 'doing';
}
export function stepSchedule(project:GanttProject,today:string){
 let cursor=deliveryDay(project.openedAt);
 return [...project.workflow].sort((a,b)=>a.order-b.order).map(step=>{
  const projected=!step.startedAt;
  const start=step.startedAt?deliveryDay(step.startedAt):(cursor<today?today:cursor);
  const end=step.completedAt?deliveryDay(step.completedAt):step.dueAt?deliveryDay(step.dueAt):forecastEnd(start,step.slaValue,step.slaUnit);
  cursor=end;
  return {...step,start,end:end<start?start:end,projected,tone:project.status==='Cancelado'?'cancelled' as const:ganttTone(step.status,step.dueAt?deliveryDay(step.dueAt):end,today)};
 });
}
export function barPosition(start:string,end:string,from:string,to:string){
 if(end<from||start>to)return null;
 const total=dayDistance(from,to)+1;
 return {left:100*Math.max(0,dayDistance(from,start))/total,width:100*(dayDistance(start<from?from:start,end>to?to:end)+1)/total};
}
