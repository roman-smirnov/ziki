import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Fixture } from '../levels/index.ts';
import type { Renderer, ViewFrame } from '../scene/renderer.ts';
import { headingOffsets, sameTile, type RunState } from '../game/plan.ts';
import { failurePose, victoryPose, visualPosition } from '../game/playback.ts';
import { celebrateGarden } from './celebration.ts';
import { Icon } from './icons.tsx';

type Graphics = 'loading' | 'ready' | 'unavailable' | 'lost' | 'asset-error';
type Props = { fixture:Fixture; frame:RefObject<ViewFrame>; state:RunState; celebrating:boolean; onLost:()=>void; controls:ReactNode };

export function GardenView({ fixture, frame, state, celebrating, onLost, controls }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null), layer = useRef<HTMLDivElement>(null), focus = useRef<HTMLDivElement>(null);
  const owner = useRef<Renderer | null>(null), currentFixture = useRef(fixture), lossHandler = useRef(onLost);
  const [graphics,setGraphics] = useState<Graphics>('loading');
  useEffect(() => { lossHandler.current=onLost; },[onLost]);
  useEffect(() => {
    currentFixture.current = fixture;
    owner.current?.setBoard(fixture);
  },[fixture]);
  useEffect(() => {
    let live=true;
    void import('../scene/renderer.ts').then(({ Renderer })=>{
      if(!live || !canvas.current || !layer.current || !focus.current) return;
      try {
        const renderer = new Renderer(canvas.current,layer.current,focus.current,()=>frame.current,status=>{
          if(!live) return;
          setGraphics(status);
          if(status==='lost') lossHandler.current();
        });
        owner.current=renderer;
        renderer.setBoard(currentFixture.current);
      } catch {
        owner.current?.dispose();
        owner.current=null;
        setGraphics('unavailable');
      }
    }).catch(()=>{ if(live) setGraphics('unavailable'); });
    return ()=>{ live=false; owner.current?.dispose(); owner.current=null; };
  },[frame]);
  useEffect(() => {
    if (celebrating && focus.current) return celebrateGarden(focus.current, () => frame.current.reduced);
  }, [celebrating, frame]);

  const hasFallback = ['unavailable','lost','asset-error'].includes(graphics);
  return <section className="garden-view" aria-label="Garden view" data-graphics={graphics}>
    <div className="terrain">
      <canvas ref={canvas} inert aria-hidden="true" className={hasFallback?'garden-canvas canvas-fallback':'garden-canvas'}/>
      <div ref={layer} className="label-layer" hidden={hasFallback || graphics==='loading'}/>
    </div>
    <div ref={focus} className="scene-focus">
      {graphics==='loading' && <div className="terrain-message" role="status">Opening the garden…</div>}
      {hasFallback && <div className="fallback">
        <div className="terrain-message">{graphics==='asset-error' ? 'The 3D garden couldn’t load.' : graphics==='lost' ? 'The 3D view was interrupted.' : 'WebGL isn’t available.'} You can still fly on this map.</div>
        <FlatMap fixture={fixture} state={state} frame={frame}/>
      </div>}
    </div>
    <div className="garden-footer">
      {controls}
      {(fixture.bedSide!==undefined || fixture.seedlingCount!==undefined) && <div className="bed-overlay">
        {fixture.bedSide ? <><Icon name="sprout"/> <span><strong>{state.planted}/{fixture.bedSide**2}</strong> slots · <strong>{state.seeds}</strong> seeds left</span></>
          : <><Icon name="sprout"/> <span>Delivery tag: <strong>{fixture.seedlingCount} seedlings</strong></span></>}
      </div>}
    </div>
    <span className="sr-only">{`Starting tile: (${fixture.dock.x}, ${fixture.dock.y}). ${fixture.gps ?
      `GPS target: (${fixture.gps.x}, ${fixture.gps.y}).` :
      fixture.roses.map(rose=>`${rose.label ?? `Rose ${rose.id}`} at (${rose.x}, ${rose.y}).`).join(' ')}`}</span>
  </section>;
}

function FlatMap({ fixture, state, frame }: { fixture: Fixture; state: RunState; frame: RefObject<ViewFrame> }) {
  const drone = useRef<HTMLSpanElement>(null);
  const edge = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let request: number;
    // Convert a tile center to a CSS grid coordinate, allowing for the 2px gap.
    const offset = (tile: number, count: number) => {
      const fraction = (tile + .5) / count;
      return `calc(${fraction * 100}% + ${2 * fraction - 1}px)`;
    };
    function render() {
      const { state, motion, sad, reduced, boundary } = frame.current;
      const position = visualPosition(state.position, reduced && motion?.kind === 'boundary' ? undefined : motion);
      const pose = reduced ? undefined : failurePose(motion);
      const dance = reduced ? undefined : victoryPose(motion);
      if (drone.current) {
        drone.current.style.left = offset(position.x, fixture.width);
        drone.current.style.top = offset(fixture.height - 1 - position.y, fixture.height);
        drone.current.style.setProperty('--sadness', String(pose?.sadness ?? Number(sad)));
        drone.current.style.setProperty('--surprise', String(pose?.surprise ?? 0));
        const yaw = (pose?.yaw ?? dance?.yaw ?? 0) * 1.8;
        const transform = dance ? ` translateY(${-dance.lift * 25}px) rotateZ(${dance.bank}rad)` : '';
        drone.current.style.transform = `translate(-50%, -50%)${transform} rotateY(${yaw}rad)`;
      }
      if (edge.current) {
        edge.current.hidden = !boundary;
        if (boundary) {
          const { x, y } = headingOffsets[boundary.direction];
          const tile = boundary.state.position;
          edge.current.style.left = offset(tile.x + x / 2, fixture.width);
          edge.current.style.top = offset(fixture.height - 1 - tile.y - y / 2, fixture.height);
          edge.current.style.width = y ? `calc((100% + 2px) / ${fixture.width} - 2px)` : '3px';
          edge.current.style.height = x ? `calc((100% + 2px) / ${fixture.height} - 2px)` : '3px';
        }
      }
      request = requestAnimationFrame(render);
    }
    render();
    return () => cancelAnimationFrame(request);
  }, [fixture, frame]);
  return <div className="flat-map-wrap"><div className="flat-map" style={{gridTemplateColumns:`repeat(${fixture.width}, minmax(0, 1fr))`}} aria-hidden="true">
    {Array.from({length:fixture.width*fixture.height},(_,i)=>{
      const tile={x:i%fixture.width,y:fixture.height-1-Math.floor(i/fixture.width)};
      const rose=fixture.roses.find(rose=>sameTile(tile,rose) && !state.harvested.includes(rose.id));
      const active=sameTile(tile,state.position);
      return <div key={i} className={'map-cell'+(active?' map-active':'')}>
        <span>{rose ? <><Icon name="petals"/>{rose.label && <small>{rose.label}</small>}</> : null}</span><small>{tile.x},{tile.y}</small>
      </div>;
    })}
    <div className="map-flight"><span ref={edge} className="map-boundary" hidden/>
      <span ref={drone} className="map-drone"><Icon name="logo" size={14}/><Icon name="surprised" size={14}/><Icon name="sad" size={14}/></span></div>
  </div>{fixture.gps && <div className="map-gps">GPS target · ({fixture.gps.x}, {fixture.gps.y})</div>}</div>;
}
