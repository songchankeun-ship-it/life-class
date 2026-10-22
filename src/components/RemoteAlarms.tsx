import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {cloudRequest,getCloudConfig} from '../utils/cloudSync';
import {isNativeAide,nativeAlarmCommand} from '../utils/nativeAlarms';
import {nativeAlarmSchedule,nativeAlarmLabel} from '../../shared/native-alarm-schedule.mjs';
import type {NativeAlarmRequest,NativeAlarmSchedule} from '../../shared/native-alarm-schedule.mjs';
import {Icon} from './Icon';
type Job={id:string;title:string;version:number;operation:string;nextFireAt:number|null;schedule:NativeAlarmSchedule|null;state:string;deviceName:string|null;receipt:null|{observedAt:number;fresh:boolean;matchesCurrentRequest:boolean;errorCode?:string}};
type Status={nativeAlarmsEnabled:boolean;backgroundPushConfigured:boolean;devices:{id:string;label:string;lastSeenAt:number|null;authorization:string;revoked:boolean}[];requests:Job[]};
const labels:Record<string,string>={'waiting-device':'아이폰 예약 대기','scheduled-confirmed':'아이폰에서 예약 확인','permission-denied':'아이폰 알람 권한 필요','device-disconnected':'아이폰 연결 해제','cancel-pending':'아이폰 취소 확인 대기','cancel-confirmed':'아이폰 취소 확인','time-passed-unverified':'예정 시각 지남 · 울림 미확인',missing:'아이폰에서 알람을 찾지 못함',failed:'아이폰 예약 실패',alerting:'아이폰에서 울리는 중으로 확인',snoozed:'아이폰에서 다시 알림 중',paused:'아이폰에서 일시 정지됨','elapsed-unverified':'예정 시각 지남 · 울림 미확인','app-update-required':'아이폰 앱 업데이트 필요'};
const time=(n:number)=>new Date(n).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const confirmed=(job:Job,networkOK:boolean)=>networkOK&&job.state==='scheduled-confirmed'&&job.receipt?.matchesCurrentRequest&&job.receipt.fresh;
const statusLabel=(job:Job,networkOK:boolean)=>job.state==='scheduled-confirmed'&&!confirmed(job,networkOK)?'이전 예약 확인 · 재확인 필요':labels[job.state]??'기기 확인 대기';
const empty=():NativeAlarmRequest=>({title:'기상',time:'08:30',weekdays:[1,2,3,4,5],snoozeSeconds:300});
export const openRemoteAlarms=(request?:NativeAlarmRequest)=>window.dispatchEvent(new CustomEvent('aide-open-remote-alarms',{detail:request}));
export function RemoteAlarmsSettings(){return <button type="button" className="aide-clock-settings lc-card" onClick={()=>openRemoteAlarms()}><Icon name="bell" size={24}/><span><strong>아이폰 앱 알람</strong><small>평일 반복 · 날짜 지정 · 실제 예약 확인</small></span><span aria-hidden="true">›</span></button>;}
export function RemoteAlarms(){
 const [connecting,setConnecting]=useState(false);
 const [open,setOpen]=useState(false),[data,setData]=useState<Status|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[pair,setPair]=useState<{code:string;expiresAt:number}|null>(null),[draft,setDraft]=useState<NativeAlarmRequest>(empty),[review,setReview]=useState(false);
 const dialog=useRef<HTMLDivElement>(null),reservations=useRef<HTMLDetailsElement>(null),busy=useRef(false),writeLock=useRef(false),retry=useRef<{fingerprint:string;requestId:string}|null>(null);
 const close=useCallback(()=>{if(!writeLock.current)setOpen(false);},[]);
 const refresh=useCallback(async()=>{if(busy.current)return;busy.current=true;setLoading(true);try{setData(await cloudRequest<Status>('/alarms/status'));setError('');}catch(e){setError(e instanceof Error?e.message:'알람 상태를 확인하지 못했어요.');}finally{busy.current=false;setLoading(false);}},[]);
 useEffect(()=>{const show=(event:Event)=>{setConnecting(false);const request=(event as CustomEvent<NativeAlarmRequest>).detail;if(request){setDraft(request);setReview(false);}setOpen(true);void refresh();};const connect=()=>{if(!isNativeAide())return;setConnecting(true);setNotice('');setOpen(true);void refresh();};window.addEventListener('aide-open-remote-alarms',show);window.addEventListener('aide-open-alarm-connection',connect);return()=>{window.removeEventListener('aide-open-remote-alarms',show);window.removeEventListener('aide-open-alarm-connection',connect);};},[refresh]);
 useEffect(()=>{if(!open)return;const t=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},5000);const result=()=>void refresh();window.addEventListener('aide-native-alarm-result',result);return()=>{clearInterval(t);window.removeEventListener('aide-native-alarm-result',result);};},[open,refresh]);
 useEffect(()=>{
  if(!open)return;const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow,shell=document.querySelector('.aide-shell'),had=shell?.hasAttribute('inert');document.body.style.overflow='hidden';shell?.setAttribute('inert','');dialog.current?.focus({preventScroll:true});
  const key=(e:KeyboardEvent)=>{if(e.isComposing)return;if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const els=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button,a[href],summary,input,select')??[]).filter(el=>!el.matches(':disabled')&&el.getClientRects().length);const first=els[0],last=els[els.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=overflow;if(!had)shell?.removeAttribute('inert');if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[open,close]);
 const write=async(action:()=>Promise<void>)=>{if(writeLock.current)return;writeLock.current=true;setSaving(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'저장에 실패했어요.');}finally{writeLock.current=false;setSaving(false);}};
 if(!open)return null;
 const enabled=data?.nativeAlarmsEnabled===true,connected=data?.devices.some(d=>!d.revoked),weekly=draft.weekdays!==undefined;
 let schedule:NativeAlarmSchedule|null=null;try{schedule=nativeAlarmSchedule(draft);}catch{}
 const change=(value:Partial<NativeAlarmRequest>)=>{setDraft(d=>({...d,...value}));setReview(false);setNotice('');};
 const connectDevice=()=>void write(async()=>{const result=await cloudRequest<{code:string;expiresAt:number}>('/alarms/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(isNativeAide()){nativeAlarmCommand('pair',result.code);setNotice('아이폰의 알람 허용 안내를 확인해 주세요.');}else setPair(result);});
 const create=()=>void write(async()=>{
  const fingerprint=JSON.stringify(draft);if(retry.current?.fingerprint!==fingerprint)retry.current={fingerprint,requestId:crypto.randomUUID()};
  const result=await cloudRequest<{message:string}>('/alarms/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...draft,requestId:retry.current.requestId})});
  retry.current=null;setNotice(result.message);setReview(false);await refresh();if(isNativeAide())nativeAlarmCommand('sync');
  requestAnimationFrame(()=>{if(reservations.current){reservations.current.open=true;reservations.current.scrollIntoView({block:'start'});}});
 });
 const parts=/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)?draft.time.split(':').map(Number):null;
 const period=parts?(parts[0]<12?'오전':'오후'):'';
 const clock=parts?`${parts[0]%12||12}:${String(parts[1]).padStart(2,'0')}`:'시간 선택';
 const weekdays=['월','화','수','목','금','토','일'];
 const isWeekday=draft.weekdays?.join(',')==='1,2,3,4,5';
 const repeatLabel=weekly?(isWeekday?'월~금':draft.weekdays?.length===7?'매일':draft.weekdays?.map(d=>weekdays[d-1]).join('·')||'요일을 선택해 주세요'):draft.date;
 return createPortal(<div className="aide-clock-backdrop" onClick={close}><div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="remote-alarm-title" className="aide-clock-sheet aide-alarm-sheet" onClick={e=>e.stopPropagation()}>
 <header className="aide-clock-header"><div><span>Aide · iPhone</span><h2 id="remote-alarm-title">{connecting?'아이폰 연결':review?'설정 확인':'알람 설정'}</h2></div><button type="button" onClick={close} disabled={saving} aria-label="알람 닫기"><Icon name="close" size={22}/></button></header>
 <div className="aide-clock-body">
 {!enabled&&<p className="aide-alarm-preview" role="status">앱 설치 전 미리보기예요. 아직 실제 알람은 예약되지 않아요.</p>}
 {error&&<p className="aide-clock-error" role="alert">{error}</p>}
 {connecting?<section className="aide-remote-form" aria-label="아이폰 연결"><h3>이 아이폰으로 알람을 받아요</h3><p>연결한 뒤 알람 허용 안내가 이어져요.</p><button type="button" className="aide-clock-primary" disabled={!enabled||loading||saving||!getCloudConfig().key||Boolean(connected)} onClick={connectDevice}>{saving?'연결 중…':'이 아이폰 연결'}</button>{notice&&<p role="status">{notice}</p>}</section>:<>
 <section className="aide-remote-form aide-alarm-editor" aria-label={review?'알람 설정 확인':'알람 만들기'}>
 {review&&schedule?<>
   <div className="aide-alarm-review-intro"><Icon name="bell" size={24}/><h3>이대로 설정할까요?</h3><p>소리는 아이폰에서만 울려요.</p></div>
   <div className="aide-alarm-review-card"><strong>{draft.title}</strong><div className="aide-alarm-time-display"><span>{period}</span><b>{clock}</b></div><dl><div><dt>{weekly?'반복':'날짜'}</dt><dd>{repeatLabel}</dd></div><div><dt>다시 알림</dt><dd>{(draft.snoozeSeconds??300)/60}분</dd></div><div><dt>시간대</dt><dd>한국 시간</dd></div></dl></div>
   <p className="aide-alarm-explanation">Aide 일정도 함께 저장해요. 아이폰에서 실제 예약을 확인하기 전까지는 ‘예약 대기’로 표시돼요.</p>
   {connected&&!data?.backgroundPushConfigured&&<p className="aide-clock-note">새 요청은 아이폰 앱을 열어야 전달돼요. 이미 예약된 알람은 PC를 꺼도 유지됩니다.</p>}
   <button type="button" className="aide-alarm-back" disabled={saving} onClick={()=>setReview(false)}>설정으로 돌아가기</button>
 </>:<>
   <div className="aide-remote-segment" role="group" aria-label="알람 종류"><button type="button" disabled={saving} aria-pressed={weekly} onClick={()=>{setDraft(empty());setReview(false);}}>요일 반복</button><button type="button" disabled={saving} aria-pressed={!weekly} onClick={()=>{setDraft({title:'아이폰 알람',date:new Date(Date.now()+86400000).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}),time:'10:00',snoozeSeconds:300});setReview(false);}}>날짜 지정</button></div>
   <label className="aide-alarm-time"><span>울릴 시각 · 한국 시간</span><span className="aide-alarm-time-display" aria-hidden="true"><span>{period}</span><b>{clock}</b><small>변경 ›</small></span><input type="time" aria-label="울릴 시각 · 한국 시간" disabled={saving} value={draft.time} onChange={e=>change({time:e.target.value})}/></label>
   {weekly?<div className="aide-alarm-control"><div className="aide-alarm-control-heading"><h3>반복 요일</h3><button type="button" disabled={saving} aria-pressed={isWeekday} onClick={()=>change({weekdays:[1,2,3,4,5]})}>평일 선택</button></div><div className="aide-remote-weekdays" role="group" aria-label="반복 요일">{weekdays.map((day,i)=><button type="button" key={day} disabled={saving} aria-label={`${day}요일`} aria-pressed={draft.weekdays?.includes(i+1)} onClick={()=>change({weekdays:draft.weekdays?.includes(i+1)?draft.weekdays.filter(d=>d!==i+1):[...draft.weekdays??[],i+1].sort()})}>{day}</button>)}</div><small aria-live="polite">{repeatLabel}{draft.weekdays?.length?'에 반복해요':''}</small></div>:<label className="aide-alarm-control">날짜<input type="date" disabled={saving} value={draft.date??''} onChange={e=>change({date:e.target.value})}/></label>}
   <div className="aide-alarm-control"><h3>다시 알림</h3><div className="aide-alarm-snooze" role="group" aria-label="다시 알림 간격">{[5,10].map(minutes=><button type="button" key={minutes} disabled={saving} aria-pressed={(draft.snoozeSeconds??300)===minutes*60} onClick={()=>change({snoozeSeconds:minutes*60})}>{minutes}분</button>)}</div><small>울릴 때 ‘다시 알림’을 누르면 이 간격으로 다시 울려요.</small></div>
   <label className="aide-alarm-name">알람 이름<input maxLength={200} value={draft.title} disabled={saving} onChange={e=>change({title:e.target.value})}/></label>
 </>}
 </section>
 {notice&&<p role="status" className="aide-clock-note">{notice}</p>}
 <details ref={reservations} className="aide-alarm-reservations"><summary>아이폰 예약 확인 <span>{data?.requests.length?`${data.requests.length}개 요청`:'예약 결과 보기'}</span></summary><div>
 {enabled&&!connected&&<p className="aide-clock-note">아이폰 앱 연결 후 실제 예약을 확인할 수 있어요.</p>}
 <h3>기기 예약 확인</h3><p>‘예약 확인’은 아이폰이 실제 AlarmKit 예약을 읽어 보고한 결과예요. 마지막 확인 시각 이후의 변경·실제 울림은 별도로 확인해야 해요.</p>
 {data?.devices.map(d=><section key={d.id} className="aide-remote-device"><strong>{d.label}</strong><p>{d.revoked?'연결 해제':d.authorization==='authorized'?'알람 권한 허용':'아이폰 알람 권한 확인 필요'} · {d.lastSeenAt?'마지막 통신 '+time(d.lastSeenAt):'아직 통신 없음'}</p></section>)}
 <div className="aide-remote-jobs">{data?.requests.length?data.requests.slice().reverse().map(j=><section className="aide-remote-job" key={j.id}><span className={confirmed(j,!error)?'is-confirmed':''}>{statusLabel(j,!error)}</span><h3>{j.title}</h3><p>{j.schedule?nativeAlarmLabel(j.schedule):'예약 시간 확인 필요'} · 한국 시간</p>{j.schedule?.kind==='weekly'&&j.nextFireAt&&<p>다음 예정: {time(j.nextFireAt)}</p>}<small>{j.deviceName??'아이폰 연결 대기'}</small>{j.receipt?.matchesCurrentRequest&&<p>기기 확인: {time(j.receipt.observedAt)}{j.receipt.fresh?'':' · 이전 결과, 현재 상태 재확인 필요'}</p>}{j.receipt&&!j.receipt.matchesCurrentRequest&&<p>변경 전의 기기 응답이에요. 새 예약 확인을 기다려요.</p>}{j.receipt?.errorCode&&<p>오류: {j.receipt.errorCode}</p>}{j.operation!=='cancel'&&<button type="button" className="aide-clock-secondary" disabled={!enabled||saving} onClick={()=>{if(window.confirm(`${j.title} 알람을 취소할까요? 일정은 남겨 두고 아이폰 취소 결과를 확인합니다.`))void write(async()=>{const result=await cloudRequest<{message:string}>(`/alarms/requests/${j.id}/cancel`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:j.version})});setNotice(result.message);await refresh();if(isNativeAide())nativeAlarmCommand('sync');});}}>알람 취소</button>}</section>):<p>아직 앱 알람 요청이 없어요.</p>}</div>
 <button type="button" className="aide-clock-secondary" disabled={loading||saving||!getCloudConfig().key} onClick={()=>{if(isNativeAide())nativeAlarmCommand('sync');void refresh();}}>{loading?'확인 중…':'지금 예약 상태 확인'}</button>
 </div></details>
 <details className="aide-clock-guide"><summary>아이폰 앱 연결</summary><p>앱 내부 ‘나의 Aide’에서 기존 PC와 일정 연결을 먼저 마친 후 알람 권한을 허용해 주세요. 기존 Safari의 일정·알림은 삭제하지 않습니다.</p><button type="button" className="aide-clock-secondary" disabled={!enabled||!getCloudConfig().key||saving||Boolean(connected)} onClick={connectDevice}>{isNativeAide()?'이 아이폰 연결':'앱 연결 코드 만들기'}</button>{pair&&<p><strong className="aide-remote-pair">{pair.expiresAt>Date.now()?pair.code:'코드 만료'}</strong><br/>아이폰 앱 ‘알람 연결’에 입력 · 5분·1회 사용 · 공유하지 마세요.</p>}</details>
 </>}
 </div><footer className="aide-clock-footer">{connecting?<button type="button" className="aide-clock-secondary" disabled={saving} onClick={close}>닫기</button>:review&&schedule?<button type="button" className="aide-clock-primary" disabled={!enabled||saving} onClick={create}>{saving?'저장 중…':enabled?'승인하고 예약 요청':'앱 설치 후 예약할 수 있어요'}</button>:<button type="button" className="aide-clock-primary" disabled={!schedule||!draft.title.trim()||saving} onClick={()=>{setReview(true);dialog.current?.querySelector('.aide-clock-body')?.scrollTo({top:0});}}>설정 내용 확인</button>}</footer>
 </div></div>,document.body);
}
