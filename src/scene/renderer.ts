import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import '@babylonjs/loaders/glTF/glTFFileLoader';
import { assets, boxPoint, buildGarden, world, type Garden } from './garden.ts';
import { createHoverDust } from './dust.ts';
import { createBoundary } from './boundary.ts';
import type { Fixture } from '../levels/index.ts';
import { failurePose, victoryPose, visualPosition, type Motion } from '../game/playback.ts';
import { headingOffsets, type BoundaryBlock, type RunState } from '../game/plan.ts';
import { SAD_DIP } from '../game/reactions.ts';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { MorphTarget } from '@babylonjs/core/Morph/morphTarget';


export type ViewFrame = { state: RunState; motion?: Motion; reduced: boolean; low: boolean; sad: boolean; boundary?: BoundaryBlock };
type Board = { scene: Scene; camera: FreeCamera; garden: Garden; drone: TransformNode; labels: HTMLSpanElement[];
  dust: ReturnType<typeof createHoverDust>; boundary: ReturnType<typeof createBoundary>;
  rotor: TransformNode[]; eyes: { node: AbstractMesh; scale: Vector3 }[];
  brows: { node: AbstractMesh; scale: Vector3; height: number; rotation: Quaternion; sadTilt: Quaternion }[];
  frown?: MorphTarget; surprisedMouth?: MorphTarget };
type Graphics = 'loading' | 'ready' | 'unavailable' | 'lost' | 'asset-error';
const skyDirection = new Vector3(-.41,1.02,-1.39).normalize();
const right = Vector3.Cross(skyDirection,Vector3.Up()).normalize();
const up = Vector3.Cross(right,skyDirection).normalize();
const identity = Matrix.Identity();
const levelBrow = Quaternion.Identity();
const lerp = (a: number,b: number,t: number) => a+(b-a)*t;
const ease = (t: number) => t*t*(3-2*t);

export class Renderer {
  private engine: Engine;
  private board?: Board;
  private fixture?: Fixture;
  private version = 0;
  private observer: ResizeObserver;
  private abort = new AbortController();
  private modelBytes = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();
  private disposed = false;
  private contextLost = false;
  private elapsed = 0;
  private heading = 0;
  private pulse = 0;
  private concernedUntil = 0;
  private wasLow = false;
  private lastLength = -1;
  private frames = 0;
  private sampleAt = 0;

  constructor(private canvas: HTMLCanvasElement, private layer: HTMLDivElement, private focusArea: HTMLDivElement, private view: () => ViewFrame,
    private graphics: (status: Graphics) => void) {
    this.engine = new Engine(canvas, true, { alpha: true, preserveDrawingBuffer: false, stencil: false, premultipliedAlpha: true });
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.observer.observe(focusArea);
    this.engine.onContextLostObservable.add(this.onLoss);
    this.engine.onContextRestoredObservable.add(this.onRestore);
    document.addEventListener('visibilitychange',this.visibility);
    this.visibility();
  }
  private visibility = () => {
    this.sampleAt = 0;
    if (document.hidden || this.contextLost) this.engine.stopRenderLoop(this.render);
    else this.engine.runRenderLoop(this.render);
  };
  private onLoss = () => {
    this.contextLost = true;
    this.version++;
    this.canvas.removeAttribute('data-fps');
    this.graphics('lost');
    this.visibility();
  };
  private onRestore = () => {
    if (this.disposed) return;
    this.contextLost = false;
    if (this.fixture) this.setBoard(this.fixture);
    this.visibility();
  };
  private fetchModel(name: string) {
    const cached = this.modelBytes.get(name);
    if (cached) return cached;
    const bytes = fetch(assets + name, { signal: this.abort.signal }).then(response => {
      if (!response.ok) throw new Error(`Could not load ${name}.`);
      return response.arrayBuffer();
    }).then(buffer => new Uint8Array(buffer)).catch(error => {
      this.modelBytes.delete(name);
      throw error;
    });
    this.modelBytes.set(name, bytes);
    return bytes;
  }

  setBoard(fixture: Fixture) {
    this.fixture = fixture;
    if (this.disposed || this.contextLost) return;
    const version = ++this.version;
    this.graphics('loading');
    this.board?.scene.dispose();
    this.board = undefined;
    this.layer.replaceChildren();
    const scene = new Scene(this.engine);
    scene.clearColor = new Color4(0,0,0,0);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = Color3.FromHexString('#f7e5c8');
    scene.fogDensity = .0045;
    scene.skipPointerMovePicking = true;
    scene.autoClear = true;
    const camera = new FreeCamera('Garden fixed camera',Vector3.Zero(),scene);
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.minZ = .15;
    camera.maxZ = 100;
    const ambient = new HemisphericLight('Cool sky fill',boxPoint(.12,1,-.32),scene);
    ambient.diffuse = Color3.FromHexString('#d7e8ff');
    ambient.groundColor = Color3.FromHexString('#a4b99b');
    ambient.intensity = .68;
    const sun = new DirectionalLight('Afternoon sun',boxPoint(.49,-1,.45).normalize(),scene);
    sun.intensity = .78;
    sun.diffuse = Color3.FromHexString('#ffe6bf');

    const garden = buildGarden(scene,fixture);
    const lightCenter=boxPoint((fixture.width-1)/2,0,(fixture.height-1)/2+.4);
    sun.position.copyFrom(lightCenter.subtract(sun.direction.scale(17)));
    sun.shadowFrustumSize=Math.hypot(fixture.width+5,fixture.height+7);
    sun.shadowMinZ=6;
    sun.shadowMaxZ=29;
    const shadows=new ShadowGenerator(2048,sun);
    shadows.usePercentageCloserFiltering=true;
    shadows.filteringQuality=ShadowGenerator.QUALITY_HIGH;
    shadows.bias=.0012;
    shadows.normalBias=.025;
    shadows.darkness=.24;
    for (const mesh of garden.shadowCasters) shadows.addShadowCaster(mesh,false);
    const glow = new GlowLayer('Visor, tile borders, and target bloom',scene,{mainTextureRatio:.5,blurKernelSize:20});
    glow.intensity=.23;
    garden.bloomMeshes.forEach(mesh=>glow.addIncludedOnlyMesh(mesh));
    garden.targetRings.forEach(ring=>glow.addIncludedOnlyMesh(ring));
    if (SSAO2RenderingPipeline.IsSupported) {
      const occlusion=new SSAO2RenderingPipeline('Subtle garden contact shading',scene,{ssaoRatio:.5,blurRatio:1},[camera]);
      occlusion.samples=16;
      occlusion.radius=.3;
      occlusion.totalStrength=.28;
      occlusion.base=.01;
      occlusion.bilateralSamples=8;
      occlusion.bilateralSoften=.5;
      // Keep geometry anti-aliased when the scene renders through the SSAO pipeline.
      occlusion.textureSamples=Math.min(4,this.engine.getCaps().maxMSAASamples);
    }
    const drone = new TransformNode('Hero pivot',scene);
    const mount = new TransformNode('Hero faces the camera',scene);
    mount.parent = drone;
    mount.rotation.y = Math.PI;
    const labels = garden.markers.map(marker => {
      const badge = document.createElement('span');
      badge.className = 'world-label ' + (marker.className ?? '');
      badge.dataset.marker = marker.id;
      badge.textContent = marker.text;
      this.layer.append(badge);
      return badge;
    });
    this.heading = this.pulse = 0;
    this.lastLength = -1;
    this.wasLow = false;
    this.concernedUntil = 0;
    this.sampleAt = 0;
    this.canvas.removeAttribute('data-fps');
    const board: Board = { scene, camera, garden, drone, labels, dust: createHoverDust(scene), boundary: createBoundary(scene, fixture),
      rotor: [], eyes: [], brows: [] };
    this.board = board;
    this.resize();
    const roseBytes = garden.roseNodes.size ? this.fetchModel('rose.glb') : undefined;
    void Promise.all([this.fetchModel('ziki.glb'), roseBytes]).then(async ([heroBytes, roseBytes]) => {
      if (this.version !== version || this.disposed) return;
      const [container, roses] = await Promise.all([
        LoadAssetContainerAsync(heroBytes, scene, { pluginExtension: '.glb', name: 'ziki.glb' }),
        roseBytes && LoadAssetContainerAsync(roseBytes, scene, { pluginExtension: '.glb', name: 'rose.glb' }),
      ]);
      if (this.version !== version || this.disposed) {
        container.dispose();
        roses?.dispose();
        return;
      }
      container.addAllToScene();
      for (const node of container.rootNodes) node.parent = mount;
      board.rotor = container.transformNodes.filter(node => /^Rotor_\d$/.test(node.name));
      board.eyes = container.meshes.filter(node=>node.name.startsWith('Mint eye'))
        .map(node=>({node, scale:node.scaling.clone()}));
      for (const mesh of container.meshes) {
        const mouth = mesh.name === 'Visor mouth';
        const brow = mesh.name.startsWith('Sad brow');
        if (mouth && mesh instanceof Mesh) {
          board.frown = mesh.morphTargetManager?.getTargetByName('Frown') ?? undefined;
          board.surprisedMouth = mesh.morphTargetManager?.getTargetByName('Surprise') ?? undefined;
        }
        if (brow) {
          const rotation = mesh.rotationQuaternion ??= Quaternion.FromEulerVector(mesh.rotation);
          board.brows.push({ node: mesh, scale: mesh.scaling.clone(), height: mesh.position.y, rotation, sadTilt: rotation.clone() });
          mesh.setEnabled(false);
        }
        mesh.isPickable=false;
        if (!mouth && !brow && mesh.getTotalVertices() > 0) {
          shadows.addShadowCaster(mesh,false);
          mesh.receiveShadows=true;
        }
        if (mesh instanceof Mesh && (mouth || brow || mesh.name.startsWith('Mint eye') || mesh.name==='Green status LED')) glow.addIncludedOnlyMesh(mesh);
      }
      if (roses) {
        for (const rose of garden.roseNodes.values()) {
          const { rootNodes } = roses.instantiateModelsToScene();
          for (const root of rootNodes) root.parent = rose;
          for (const mesh of rose.getChildMeshes()) {
            mesh.isPickable = false;
            if (mesh.getTotalVertices() > 0) {
              shadows.addShadowCaster(mesh, false);
              mesh.receiveShadows = true;
            }
          }
        }
      }
      scene.executeWhenReady(() => {
        if (version === this.version && !this.disposed) this.graphics('ready');
      });
    }).catch(()=>{
      if (version === this.version && !this.disposed) this.graphics('asset-error');
    });
  }
  private resize = () => {
    if (this.disposed || this.contextLost) return;
    // Hardware scaling is inverse pixel density. Match Retina screens up to 2×.
    const scaling = 1 / Math.min(window.devicePixelRatio || 1, 2);
    if (this.engine.getHardwareScalingLevel() !== scaling) this.engine.setHardwareScalingLevel(scaling);
    else this.engine.resize();
    if (!this.board) return;
    const { camera,garden } = this.board;
    const width = Math.max(1,this.canvas.clientWidth);
    const height = Math.max(1,this.canvas.clientHeight);
    const area = this.focusArea.getBoundingClientRect();
    const canvasBounds = this.canvas.getBoundingClientRect();
    const focusWidth = Math.max(1,area.width), focusHeight = Math.max(1,area.height);
    const ratio = Math.max(.35,focusWidth / focusHeight);
    const usableHeight = Math.max(1, focusHeight - 32);
    function frame(points: readonly Vector3[]) {
      const horizontal = points.map(point => Vector3.Dot(point, right));
      const vertical = points.map(point => Vector3.Dot(point, up));
      const left = Math.min(...horizontal), rightEdge = Math.max(...horizontal);
      const bottom = Math.min(...vertical), top = Math.max(...vertical);
      return {
        x: (left + rightEdge) / 2,
        y: (bottom + top) / 2,
        halfHeight: Math.max(((top - bottom) / 2 + .20) * focusHeight / usableHeight, ((rightEdge - left) / 2 + .53) / ratio),
      };
    }
    const scenery = frame(garden.bounds);
    const focus = frame(garden.playableBounds);
    // Prioritize the full playable bed, with a little surrounding yard for context.
    const half = Math.max(focus.halfHeight, scenery.halfHeight * .68);
    const center = right.scale(focus.x).add(up.scale(focus.y));
    // Frame the playable world beside the console while rendering scenery behind it.
    const unitsPerPixel = 2 * half / focusHeight;
    center.addInPlace(right.scale((width / 2 - (area.left - canvasBounds.left + focusWidth / 2)) * unitsPerPixel));
    center.addInPlace(up.scale((area.top - canvasBounds.top + focusHeight / 2 - height / 2) * unitsPerPixel));
    const fullHalf = half * height / focusHeight;
    camera.position.copyFrom(center.add(skyDirection.scale(42)));
    camera.setTarget(center);
    camera.orthoLeft = -fullHalf*width/height;
    camera.orthoRight = fullHalf*width/height;
    camera.orthoTop = fullHalf;
    camera.orthoBottom = -fullHalf;
    garden.fadeMeadow(up, center, fullHalf);
  };
  private render = () => {
    const board = this.board;
    if (!board || this.disposed || this.contextLost) return;
    // Display changes can update pixel density without changing the CSS dimensions.
    if (this.engine.getHardwareScalingLevel() !== 1 / Math.min(window.devicePixelRatio || 1, 2)) this.resize();
    const { state, motion, reduced, low, sad, boundary } = this.view(), { drone, garden, scene, camera } = board;
    const dt = Math.min(40,this.engine.getDeltaTime())/1000;
    this.elapsed += dt;
    garden.wind.advance(dt,reduced);
    this.pulse = Math.max(0,this.pulse-dt*4);
    if (low && !this.wasLow) this.concernedUntil=this.elapsed+.85;
    this.wasLow=low;
    const concerned=low && (reduced || this.elapsed<this.concernedUntil);
    const flight = motion?.kind === 'flight' ? motion : undefined;
    const impact = !reduced && motion?.kind === 'boundary' ? motion : undefined;
    const effect = motion?.kind === 'effect' ? motion : undefined;
    const movement = flight?.event ?? impact?.event;
    const pose = reduced ? undefined : failurePose(motion);
    const dance = reduced ? undefined : victoryPose(motion);
    const sadness = pose?.sadness ?? Number(sad);
    const surprise = pose?.surprise ?? 0;
    const progress = ease(effect?.fraction ?? 0);
    const { x, y: z } = visualPosition(state.position, motion?.kind === 'boundary' ? impact : motion);
    const bob = reduced ? 0 : .026 * Math.sin(this.elapsed * 5);
    const speed = reduced ? 0 : flight?.speed ?? impact?.pose.carry ?? 0;
    const settled = state.trace.length === 1 && !movement;
    const lift = dance?.lift ?? pose?.lift ?? (sad && !reduced ? -SAD_DIP : 0);
    drone.position.set(x, .72 + bob + .16 * speed + lift, z);
    board.dust(this.elapsed, drone.position, !reduced && !movement && board.rotor.length > 0);
    const heading = movement ? { East:-.33, West:.33, North:.12, South:0 }[movement.direction] * (impact?.pose.carry ?? 1) : 0;
    this.heading = reduced ? 0 : lerp(this.heading, heading, Math.min(1, dt * 9));
    const bank = movement ? { East:.17, West:-.17, North:.045, South:.045 }[movement.direction] * speed : concerned ? -.07 : 0;
    const axis = impact && headingOffsets[impact.event.direction];
    const correction = impact?.pose.bank ?? 0;
    drone.rotation.set(-.09 * speed - (axis?.y ?? 0) * correction + (dance?.pitch ?? 0),
      this.heading + (pose?.yaw ?? dance?.yaw ?? 0),
      reduced ? 0 : bank + (axis?.x ?? 0) * correction + (dance?.bank ?? 0));
    board.boundary(boundary, impact?.pose.bend, impact?.pose.opacity, !impact || impact.pose.opacity < .27 && impact.pose.carry === 0);
    for (let i=0;i<board.rotor.length;i++) {
      if (!reduced) {
        const hub=board.rotor[i];
        if (hub.rotationQuaternion) {
          // Blender exports an identity rotation; use Euler yaw for the intended pivot.
          hub.rotationQuaternion=null;
        }
        hub.rotation.y+=dt*(settled ? 7 : 34)*(i%2 ? -1 : 1);
      }
    }
    if (board.frown) board.frown.influence = sadness;
    if (board.surprisedMouth) board.surprisedMouth.influence = surprise;
    const eyeHeight = concerned ? .48 : 1 + .13 * surprise - .35 * sadness;
    for (const {node,scale} of board.eyes) {
      node.scaling.x = scale.x * (1 + .46 * surprise);
      node.scaling.y = scale.y * eyeHeight;
    }
    const browWeight = sadness + surprise;
    for (const {node,scale,height,rotation,sadTilt} of board.brows) {
      node.setEnabled(browWeight > 0);
      const size = Math.max(.001, browWeight);
      node.scaling.copyFrom(scale).scaleInPlace(size);
      node.scaling.y *= 1 - .42 * surprise;
      node.position.y = height + .030 * surprise;
      Quaternion.SlerpToRef(sadTilt, levelBrow, surprise / size, rotation);
    }
    garden.groundMarker.position.x=state.position.x;
    garden.groundMarker.position.z=state.position.y;
    if (state.trace.length>this.lastLength && this.lastLength!==-1 && state.trace.length>1) this.pulse=1;
    this.lastLength=state.trace.length;
    const scale=reduced ? 1 : 1+.15*this.pulse;
    garden.groundMarker.scaling.set(scale,1,scale);

    const movingRose=effect?.event.kind==='harvest' ? effect.event.rose : undefined;
    const targetScale = reduced ? 1 : 1 + .06 * (1 - Math.cos(this.elapsed * 2 * Math.PI / 2.4));
    for(const rose of this.fixture!.roses) {
      const node=garden.roseNodes.get(rose.id)!;
      const ring=garden.targetRings.get(rose.id)!;
      const harvested=state.harvested.includes(rose.id);
      const inPickup=movingRose?.id===rose.id;
      node.setEnabled(!harvested);
      ring.setEnabled(!harvested);
      if (harvested) continue;
      ring.scaling.set(targetScale,1,targetScale);
      const p = inPickup ? progress : 0;
      node.position.y = .34 * p;
      node.scaling.setAll(1 - p);
      node.rotation.z = .18 * p;
    }
    const planting=effect?.event.kind==='trayPlanted' ? effect.event : undefined;
    for(let i=0;i<garden.planted.length;i++) {
      const seed=garden.planted[i];
      const scale=i<state.planted ? 1 : planting ? Math.min(1,Math.max(0,planting.previous+effect!.fraction*planting.used-i)) : 0;
      seed.setEnabled(scale>0);
      seed.scaling.setAll(scale);
      seed.position.y=.31+(scale>0 ? (1-scale)*.20 : 0);
    }
    scene.render();
    const viewport=camera.viewport.toGlobal(this.canvas.clientWidth,this.canvas.clientHeight);
    for(let i=0;i<board.labels.length;i++) {
      const marker=garden.markers[i], label=board.labels[i];
      label.hidden = marker.roseId !== undefined && state.harvested.includes(marker.roseId);
      const point=Vector3.Project(marker.at,identity,scene.getTransformMatrix(),viewport);
      label.style.left=`${Math.round(point.x)}px`;
      label.style.top=`${Math.round(point.y)}px`;
    }
    const now=performance.now();
    if (!this.sampleAt) { this.sampleAt=now; this.frames=0; }
    this.frames++;
    if (now-this.sampleAt>1000) {
      this.canvas.dataset.fps=(this.frames*1000/(now-this.sampleAt)).toFixed(1);
      this.sampleAt=now; this.frames=0;
    }
  };
  dispose() {
    if (this.disposed) return;
    this.disposed=true;
    this.version++;
    this.abort.abort();
    document.removeEventListener('visibilitychange',this.visibility);
    this.observer.disconnect();
    this.engine.stopRenderLoop(this.render);
    this.board?.scene.dispose();
    this.engine.dispose();
    this.layer.replaceChildren();
  }
}
