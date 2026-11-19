import { useCallback, useEffect, useRef, useState } from 'react';
import { levels } from '../levels/index.ts';
import { planRun, startState, type Event } from '../game/plan.ts';
import { Playback } from '../game/playback.ts';
import { GardenAudio } from '../game/audio.ts';
import type { ViewFrame } from '../scene/renderer.ts';
import { GardenView } from './GardenView.tsx';
import { Editor } from './Editor.tsx';
import { Icon } from './icons.tsx';
import { ProgramError, type ProgramIssue } from './ProgramError.tsx';

const formatLevel = (i:number) => String(i+1).padStart(2,'0');
const initialStatus = '';
const soundPreferenceKey = 'ziki-garden.sound';
type Outcome = 'ready' | 'running' | 'success' | 'retry' | 'error';

export default function App() {
  const [levelIndex,setLevelIndex]=useState(0);
  const level=levels[levelIndex], fixture=level.fixture;
  const [drafts,setDrafts]=useState<Partial<Record<string,string>>>({});
  const code=drafts[level.id] ?? level.starter;
  const [passed,setPassed]=useState<ReadonlySet<string>>(new Set());
  const [state,setState]=useState(()=>startState(fixture));
  const [status,setStatus]=useState(initialStatus), [outcome,setOutcome]=useState<Outcome>('ready');
  const [line,setLine]=useState<number>();
  const [playing,setPlaying]=useState(false);
  const [issue,setIssue]=useState<ProgramIssue & { id:number }>();
  const issueId=useRef(0);
  const editorInput=useRef<HTMLTextAreaElement>(null);
  const issueRow=useRef<HTMLDivElement>(null);
  const [muted,setMuted]=useState(()=>{
    try { return window.localStorage.getItem(soundPreferenceKey) !== 'on'; }
    catch { return true; }
  });
  const [fullscreen,setFullscreen]=useState(false);
  const [fullscreenFailed,setFullscreenFailed]=useState(false);
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const frame=useRef<ViewFrame>({state,reduced,low:false,sad:false});
  const audio=useRef<GardenAudio | null>(null), player=useRef<Playback | null>(null);
  const garden=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const playback=new Playback(), sound=new GardenAudio();
    player.current=playback; audio.current=sound;
    const fullscreenChange=()=>setFullscreen(Boolean(document.fullscreenElement));
    const visibilityChange=()=>{ if (document.hidden) sound.stop(); };
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const motionChange=()=>setReduced(preference.matches);
    document.addEventListener('fullscreenchange',fullscreenChange);
    document.addEventListener('visibilitychange',visibilityChange);
    preference.addEventListener('change',motionChange);
    return ()=>{
      document.removeEventListener('fullscreenchange',fullscreenChange);
      document.removeEventListener('visibilitychange',visibilityChange);
      preference.removeEventListener('change',motionChange);
      playback.dispose(); sound.dispose(); player.current=null; audio.current=null;
    };
  },[]);
  useEffect(()=>{ frame.current.reduced=reduced; },[reduced]);
  const showState=useCallback((next:typeof state)=>{
    frame.current.state=next;
    setState(next);
  },[]);
  function prepare(nextFixture=fixture,message=initialStatus) {
    player.current?.cancel(); audio.current?.stop();
    frame.current.motion=undefined; frame.current.low=false;
    frame.current.sad=false; frame.current.boundary=undefined;
    showState(startState(nextFixture));
    setStatus(message); setOutcome('ready'); setLine(undefined); setIssue(undefined); setPlaying(false);
  }
  function changeLevel(index:number) {
    prepare(levels[index].fixture);
    setLevelIndex(index);
  }
  function reportIssue(problem:ProgramIssue) {
    setIssue({category:problem.category, explanation:problem.explanation, hint:problem.hint, span:problem.span, id:++issueId.current});
    setStatus(initialStatus); setOutcome('error'); setLine(undefined);
    audio.current?.cue('blocked');
  }
  function dismissIssue() {
    setIssue(undefined);
    setOutcome(previous=>previous==='error'?'ready':previous);
  }
  function editCode(value:string) {
    setDrafts(previous=>({...previous,[level.id]:value}));
    if(outcome==='running') {
      prepare();
      return;
    }
    if(playing && (outcome==='error' || outcome==='ready')) {
      player.current?.cancel();
      audio.current?.stop();
      frame.current.motion=undefined;
      setPlaying(false);
    }
    dismissIssue();
  }
  function commit(event:Event) {
    showState(event.state);
    switch(event.kind) {
      case 'moveStep': audio.current?.cue('step'); break;
      case 'harvest': audio.current?.cue('harvest'); break;
      case 'blocked':
        frame.current.low=event.reason==='charge';
        if(event.reason==='bounds') frame.current.boundary=event;
        reportIssue({
          category:'flight', span:event.span, explanation:event.text,
          hint:event.reason==='bounds' ? 'Check the direction and distance passed to Move.'
            : 'Compare the move distance with the available battery range.',
        });
        break;
      case 'runtimeError':
        reportIssue(event.diagnostic);
        break;
      case 'trayPlanted': audio.current?.cue('plant'); break;
      case 'completed':
        frame.current.sad=!event.success && event.reason!=='charge';
        if(!event.success && event.reason!=='goal') break;
        setStatus(event.text); setOutcome(event.success?'success':'retry');
        if(event.success) {
          setPassed(previous=>new Set([...previous,level.id]));
          audio.current?.cue('victory');
        }
        break;
    }
  }
  function run() {
    if (!player.current) return;
    prepare();
    audio.current?.enable(muted);
    const result=planRun(level,fixture,code);
    if ('diagnostic' in result) {
      reportIssue(result.diagnostic);
      return;
    }
    const stage=garden.current;
    if(stage && stage.getBoundingClientRect().top<0) stage.scrollIntoView({block:'start'});
    setStatus('Running sequence…'); setOutcome('running'); setPlaying(true);
    player.current.play(result.events,reduced,{
      begin(event,previous) {
        setLine(event.span?.line);
        if(event.kind==='moveStep' && (previous?.kind!=='moveStep' || previous.span?.start!==event.span?.start)) audio.current?.cue('fly');
      },
      motion(motion) { frame.current.motion=motion; },
      commit,
      end() { setLine(undefined); setPlaying(false); },
    });
  }
  useEffect(()=>{
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==='Enter' && (event.ctrlKey || event.metaKey) && !event.repeat && !event.isComposing) {
        event.preventDefault(); run();
      }
    };
    window.addEventListener('keydown',keyboard);
    return ()=>window.removeEventListener('keydown',keyboard);
  });
  function toggleSound() {
    const next=!muted;
    setMuted(next); audio.current?.enable(next);
    try { window.localStorage.setItem(soundPreferenceKey,next?'off':'on'); }
    catch { /* The sound toggle still works for the current page. */ }
  }
  async function toggleFullscreen() {
    setFullscreenFailed(false);
    try {
      if(document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { setFullscreenFailed(true); }
  }
  const fullscreenLabel = fullscreen ? 'Exit fullscreen' : 'Fullscreen';
  const displayControls = <div className="display-controls" role="group" aria-label="Display controls">
    <button type="button" className="utility" aria-pressed={!muted} onClick={toggleSound}>
      <Icon name={muted?'mute':'speaker'}/> Sound {muted?'off':'on'}
    </button>
    {document.fullscreenEnabled && <button type="button" className="utility square-button" aria-label={fullscreenLabel} title={fullscreenLabel} onClick={()=>void toggleFullscreen()}>
      <Icon name={fullscreen?'exitFullscreen':'fullscreen'}/>
    </button>}
    <div className="display-message" role="status">{fullscreenFailed && 'Fullscreen is unavailable in this browser window.'}</div>
  </div>;
  return <main>
      <h1 className="sr-only">Ziki</h1>
      <div className="garden-stage">
        <div ref={garden} className="garden-world">
          <GardenView fixture={fixture} frame={frame} state={state} celebrating={outcome==='success'} controls={displayControls}
            onLost={()=>prepare(fixture,'Flight reset after the graphics interruption.')}/>
        </div>
        <section className="workspace" aria-label="Flight workspace">
          <div className="workspace-bar">
            <div className="actions">
              <button className="primary" aria-keyshortcuts="Control+Enter Meta+Enter" title="Run sequence (Ctrl or Cmd + Enter)" onClick={run}><Icon name="play"/> Run Sequence</button>
              <button className="secondary" onClick={()=>prepare()}><Icon name="reset"/> Reset Garden</button>
            </div>
            <div className="status-strip" data-outcome={outcome} role="status">
              {status && <><span aria-hidden="true" className="status-dot">{outcome==='success' && <Icon name="tick" size={13}/>}</span><span>{status}</span></>}
            </div>
          </div>
          <div className="program-workspace">
            <ProgramError issue={issue} playing={playing} rowRef={issueRow} inputRef={editorInput} onDismiss={dismissIssue}/>
            <Editor code={code} line={line} issue={issue} inputRef={editorInput} issueRowRef={issueRow} onChange={editCode}
              onRestore={()=>{ prepare(); setDrafts(previous=>({...previous,[level.id]:undefined})); }}/>
          </div>
          <div className="lesson-controls" role="group" aria-label="Lesson navigation">
            <label>
              <span id="lesson-label">Lesson</span>
              <span className="select-wrap">
                <select aria-labelledby="lesson-label" value={level.id} onChange={event=>changeLevel(event.currentTarget.selectedIndex)}>
                  {levels.map((item,i)=><option value={item.id} key={item.id}>{formatLevel(i)} · {item.title}{passed.has(item.id)?' ✓':''}</option>)}
                </select>
                <Icon name="chevron" size={15}/>
              </span>
            </label>
            {outcome==='success' && levelIndex<levels.length-1 &&
              <button type="button" onClick={()=>changeLevel(levelIndex+1)} className="next">Next level <Icon name="arrow" size={15}/></button>}
          </div>
        </section>
      </div>
  </main>;
}
