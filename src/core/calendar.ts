import { dateLabel, shiftDate } from './math';
import { dayNumber } from './streaks';
export function weekDates(date:string):string[]{
  if(dayNumber(date)===null)throw new Error('Wybierz poprawną datę.');
  const weekday=new Date(date+'T12:00:00').getDay(),monday=shiftDate(date,-((weekday+6)%7));
  return Array.from({length:7},(_,i)=>shiftDate(monday,i));
}
export function weekCaption(date:string):string{
  const days=weekDates(date),first=days[0],last=days[6];
  if(first.slice(0,7)===last.slice(0,7))return `${Number(first.slice(-2))}-${dateLabel(last,{day:'numeric',month:'short',year:'numeric'})}`;
  return `${dateLabel(first,{day:'numeric',month:'short',...(first.slice(0,4)!==last.slice(0,4)?{year:'numeric'}:{})})} - ${dateLabel(last,{day:'numeric',month:'short',year:'numeric'})}`;
}
