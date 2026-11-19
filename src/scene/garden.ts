import { Color3 } from '@babylonjs/core/Maths/math.color';
import { SmoothStep } from '@babylonjs/core/Maths/math.scalar.functions';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Fixture, Rose, Tile } from '../levels/index.ts';
import { createCurbSurface } from './axisRail.ts';
import { createGrassScatter } from './grass.ts';
import { FoliageWind, GardenWind } from './wind.ts';

export const assets = import.meta.env.BASE_URL + 'assets/';
export const CURB_DEPTH = .32;
export const boxPoint = (x: number, y: number, z: number) => new Vector3(x, y, z);
export const world = (tile: Tile, elevation = 0) => boxPoint(tile.x, elevation, tile.y);
export type Marker = { id: string; text: string; at: Vector3; className?: string; roseId?: Rose['id'] };
export type Garden = ReturnType<typeof buildGarden>;

export function buildGarden(scene: Scene, fixture: Fixture) {
  const { width: w, height: h, dock, roses } = fixture;
  const midX = (w - 1) / 2, midZ = (h - 1) / 2;
  const railDepth = CURB_DEPTH;
  const northCurb = h - .5 + railDepth;
  const eastCurb = w - .5 + railDepth;
  const grassGap = .65;
  const rearFlowerDepth = .37;
  const rearFlowerZ = northCurb + grassGap + (rearFlowerDepth + .12) / 2;
  const fenceBack = rearFlowerZ + (rearFlowerDepth + .12) / 2 + .45;
  const fenceFront = -.5 - railDepth - grassGap;
  const fenceRight = eastCurb + grassGap;
  const frontFlowerZ = fenceFront - .60;
  const bounds: Vector3[] = [];
  const batches = new Map<StandardMaterial, Mesh[]>();
  const markers: Marker[] = [];
  const shadowCasters: Mesh[] = [];
  const bloomMeshes: Mesh[] = [];
  const materials = new Map<string, StandardMaterial>();
  const paint = (hex: string) => {
    let m = materials.get(hex);
    if (!m) {
      m = new StandardMaterial(hex, scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.specularColor = new Color3(.07, .07, .07);
      materials.set(hex, m);
    }
    return m;
  };
  function place(mesh: Mesh, m: StandardMaterial, x: number, y: number, z: number, batch: boolean) {
    mesh.material = m;
    mesh.position.set(x, y, z);
    mesh.isPickable = false;
    if (batch) {
      if (!batches.has(m)) batches.set(m, []);
      batches.get(m)!.push(mesh);
    }
    return mesh;
  }
  const box = (name: string, dimensions: [number, number, number], x: number, y: number, z: number, m: StandardMaterial, batch = true) =>
    place(CreateBox(name, { width: dimensions[0], height: dimensions[1], depth: dimensions[2] }, scene), m, x, y, z, batch);
  const orb = (name: string, dims: [number, number, number], x: number, y: number, z: number, m: StandardMaterial, batch = true) =>
    place(CreateSphere(name, { diameterX: dims[0], diameterY: dims[1], diameterZ: dims[2], segments: 8 }, scene), m, x, y, z, batch);
  const cylinder = (name: string, d: number, height: number, x: number, y: number, z: number, m: StandardMaterial, batch = true) =>
    place(CreateCylinder(name, { diameter: d, height, tessellation: 20 }, scene), m, x, y, z, batch);
  const ring = (name: string, d: number, thickness: number, x: number, y: number, z: number, m: StandardMaterial, batch = true) =>
    place(CreateTorus(name, { diameter: d, thickness, tessellation: 24 }, scene), m, x, y, z, batch);
  function register(x1: number, x2: number, y1: number, y2: number, z1: number, z2: number) {
    for (const x of [x1, x2]) for (const y of [y1, y2]) for (const z of [z1, z2]) bounds.push(boxPoint(x, y, z));
  }
  register(-1, w-.16, -.61, .38, -1, h-.16);
  // Reserve height at every tile for the drone and target labels.
  register(-.46, w-.54, 0, 1.3, -.46, h-.54);
  const playableBounds = bounds.slice();

  const ground = paint('#a6c48e');
  ground.specularColor = Color3.Black();
  const fenceWood = paint('#ead1a0');
  const fenceShade = paint('#b8885c');
  const darkMulch = paint('#775847');
  const clay = paint('#a16c52');
  const wood = paint('#c59470');
  const woodShade = paint('#99705a');
  const boards = paint('#daa67d');
  const grid = paint('#62a6ac');
  grid.emissiveColor = new Color3(.026, .11, .14);
  const gridEdge = paint('#67bbc4');
  gridEdge.emissiveColor = new Color3(.032, .15, .19);
  const railWood = paint('#65402e');
  const mint = paint('#62b6a5');
  const deepMint = paint('#426f65');
  const green = paint('#467052');
  const leaf = paint('#669456');
  const paleLeaf = paint('#7da96e');
  const glass = paint('#86d9d9');
  glass.alpha = .37;
  glass.specularColor = new Color3(.42,.55,.52);
  glass.specularPower = 70;
  const cream = paint('#f1dfb3');
  const coral = paint('#cd776d');
  const brick = paint('#a26555');
  const peach = paint('#dd9a82');
  const seedColor = paint('#e9ba66');
  const markerPaint = paint('#fff1b4');
  markerPaint.emissiveColor = new Color3(.20,.19,.08);
  const pink = paint('#ea6484');
  const yellow = paint('#f2c16b');
  const lilac = paint('#b489ca');
  const trim = paint('#f8e7b9');

  const lawnY = -.35;
  const wind = new GardenWind(w);
  function rootFoliage(mesh: Mesh, x: number) {
    // UV2 keeps the common pivot on every part when the garden meshes are batched.
    const roots = new Float32Array(mesh.getTotalVertices()*2);
    for (let i=0; i<roots.length; i+=2) roots[i]=x;
    mesh.setVerticesData(VertexBuffer.UV2Kind,roots);
  }
  const flowerWindMaterials = new Map<StandardMaterial, StandardMaterial>();
  function flowerWindMaterial(base: StandardMaterial) {
    let material = flowerWindMaterials.get(base);
    if (!material) {
      material = base.clone(base.name+' flower bed');
      new FoliageWind(material,wind,lawnY+.13,.023);
      flowerWindMaterials.set(base,material);
    }
    return material;
  }
  const shadowStamps: Mesh[] = [];
  function stampContact(x: number, z: number, width: number, depth: number) {
    const stamp = CreateGround('Contact shadow stamp', { width, height: depth }, scene);
    stamp.position.set(x,lawnY+.003,z);
    shadowStamps.push(stamp);
  }
  const meadowSize = 70;
  const meadow = CreateGround('Meadow', { width: meadowSize, height: meadowSize, subdivisions: 56 }, scene);
  const vertices = meadow.getVerticesData(VertexBuffer.PositionKind)!;
  const meadowColors = new Float32Array(vertices.length / 3 * 4);
  for (let i=0; i<vertices.length; i+=3) {
    const x=vertices[i], z=vertices[i+2];
    const light=.94+.036*Math.sin(.88*x+.37*z)+.025*Math.cos(.44*x-.65*z);
    meadowColors.set([light,light,.97*light,1],i / 3 * 4);
  }
  meadow.setVerticesData(VertexBuffer.ColorKind, meadowColors, true);
  meadow.hasVertexAlpha = true;
  meadow.alphaIndex = 0; // Blend before greenhouse glass and the other transparent details.
  place(meadow,ground,midX,lawnY,midZ,false).receiveShadows=true;

  function fadeMeadow(cameraUp: Vector3, center: Vector3, halfHeight: number) {
    const offset = Vector3.Dot(meadow.position, cameraUp) - Vector3.Dot(center, cameraUp);
    for (let i=0; i<vertices.length; i+=3) {
      const x=vertices[i], z=vertices[i+2];
      const height = (offset + x * cameraUp.x + z * cameraUp.z) / halfHeight;
      const edgeDistance = meadowSize / 2 - Math.max(Math.abs(x), Math.abs(z));
      const horizon = SmoothStep(1, 0, (height - .46) / .54);
      const edge = SmoothStep(0, 1, edgeDistance / 8);
      meadowColors[i / 3 * 4 + 3] = horizon * edge;
    }
    meadow.updateVerticesData(VertexBuffer.ColorKind, meadowColors);
  }

  box('Raised clay bed', [w+.14, .32, h+.14], midX, -.181, midZ, clay);
  box('Bed lower lip', [w+.23,.12,h+.23], midX, -.271, midZ, woodShade);
  stampContact(midX,midZ,w+.63,h+.63);
  const soil = new StandardMaterial('Baked soil', scene);
  soil.specularColor = Color3.Black();
  const texture = new Texture(assets + 'soil.png', scene);
  texture.uScale = w / 2.1;
  texture.vScale = h / 2.1;
  texture.anisotropicFilteringLevel = 16;
  soil.diffuseTexture = texture;
  const groundSurface = CreateGround('Soil', { width: w, height: h }, scene);
  place(groundSurface, soil, midX, 0, midZ, false).receiveShadows=true;
  const railOffset = -.5 - railDepth / 2;
  const railTop = .025;
  const sides = [
    { name:'South', length:w, x:midX, z:railOffset, rotation:0, axis:'x' },
    { name:'West', length:h, x:railOffset, z:midZ, rotation:Math.PI / 2, axis:h > 1 ? 'y' : undefined },
    { name:'North', length:w, x:midX, z:h - 1 - railOffset, rotation:Math.PI },
    { name:'East', length:h, x:w - 1 - railOffset, z:midZ, rotation:-Math.PI / 2 },
  ] as const;
  for (const side of sides) {
    const name = `${side.name} garden curb`;
    const surface = createCurbSurface(scene, name, side.length, railDepth, 'axis' in side ? side.axis : undefined);
    surface.position.set(side.x, railTop, side.z);
    surface.rotation.y = side.rotation;
    // Front and back support the corner joints. The side boards fit between them.
    const runsAlongX = side.rotation % Math.PI === 0;
    const dimensions: [number, number, number] = runsAlongX
      ? [side.length + railDepth * 2, .08, railDepth]
      : [railDepth, .08, side.length];
    box(`${name} support`, dimensions, side.x, railTop - .041, side.z, railWood);
  }
  for (let x=0; x<=w; x++) {
    const edge=x===0 || x===w;
    box('North-facing grid line', [edge ? .036 : .029,.009,h], x-.5,edge ? railTop : .009,midZ,edge ? gridEdge : grid);
  }
  for (let y=0; y<=h; y++) {
    const edge=y===0 || y===h;
    box('East-facing grid line', [w,.009,edge ? .036 : .029], midX,edge ? railTop : .009,y-.5,edge ? gridEdge : grid);
  }
  if (fixture.walkable) {
    for (let x=0; x<w; x++) for (let y=0; y<h; y++) {
      if (!fixture.walkable.some(tile => tile.x === x && tile.y === y)) box('Closed tile', [.97,.03,.97], x,.02,y,woodShade);
    }
  }
  const dropX = dock.x, dropZ = dock.y;

  function flower(x: number, y: number, z: number, scale: number, color: StandardMaterial,
    { sway }: { sway?: boolean } = {}) {
    const foliage = (base: StandardMaterial) => sway ? flowerWindMaterial(base) : base;
    const add = (mesh: Mesh) => {
      if (sway) rootFoliage(mesh,x);
      return mesh;
    };
    add(cylinder('Stem',.05*scale,.53*scale,x,y+.26*scale,z,foliage(green)));
    add(orb('Leaf',[.25*scale,.08*scale,.12*scale],x+.10*scale,y+.24*scale,z,foliage(leaf))).rotation.z=.42;
    add(orb('Leaf',[.25*scale,.076*scale,.12*scale],x-.09*scale,y+.31*scale,z,foliage(paleLeaf))).rotation.z=-.48;
    const petalPaint = foliage(color);
    for (let i=0;i<6;i++) {
      const angle=i*Math.PI/3;
      const petal=add(orb('Petal',[.20*scale,.113*scale,.13*scale],x+.123*scale*Math.cos(angle),y+.55*scale,z+.123*scale*Math.sin(angle),petalPaint));
      petal.rotation.y=-angle;
      petal.rotation.z=.30;
    }
    add(orb('Flower heart',[.19*scale,.13*scale,.19*scale],x,y+.57*scale,z,foliage(yellow)));
  }
  const roseNodes = new Map<'A' | 'B', TransformNode>();
  const targetRings = new Map<'A' | 'B', Mesh>();
  for (const rose of roses) {
    const node = new TransformNode(`Rose ${rose.id}`, scene);
    node.position.copyFrom(world(rose));
    roseNodes.set(rose.id,node);
    targetRings.set(rose.id, ring('Rose target outline', .64,.03,rose.x,.034,rose.y,markerPaint,false));
    if (rose.label) markers.push({ id: `rose-${rose.id}`, text: rose.label, at: world(rose, 1.24), roseId: rose.id });
  }
  if (fixture.gps) {
    const { x, y }=fixture.gps;
    const pin = paint('#56dfec');
    pin.emissiveColor = new Color3(.08,.33,.37);
    bloomMeshes.push(ring('Fractional GPS ring',.34,.028,x,.045,y,pin,false));
    cylinder('GPS pointer',.038,1.03,x,.56,y,pin);
    orb('GPS beacon',[.15,.15,.15],x,1.12,y,pin);
    markers.push({ id:'gps', text:`GPS target · (${x}, ${y})`, at:world(fixture.gps,1.19), className:'gps-label' });
  }

  // Keep the translucent panels separate so they can sort around the interior.
  const gx=.02, gz=fenceBack+1.76;
  const glassWidth=1.72, glassDepth=1.18, frameBase=-.24, eave=.58;
  box('Greenhouse plinth',[1.96,.12,1.34],gx,-.286,gz,trim);
  box('Greenhouse foundation',[1.82,.115,1.24],gx,-.174,gz,mint);
  for (const side of [-1,1]) {
    const z=gz+side*glassDepth/2;
    box('Greenhouse sill',[1.81,.065,.074],gx,frameBase+.08,z,mint);
    box('Greenhouse eave',[1.90,.053,.065],gx,eave,z,trim);
    if (side===1) box('Greenhouse back glass',[glassWidth,.74,.021],gx,.19,z,glass,false);
    if (side===-1) {
      for (const offset of [-.58,.58]) box('Greenhouse front glass',[.56,.74,.018],gx+offset,.19,z,glass,false);
    }
    for (const x of [gx-.86,gx-.28,gx+.28,gx+.86]) {
      box('Greenhouse frame post',[.063,.81,.063],x,.194,z,mint);
    }
  }
  for (const side of [-1,1]) {
    const x=gx+side*glassWidth/2;
    box('Greenhouse side glass',[.019,.74,glassDepth],x,.19,gz,glass,false);
    box('Greenhouse side mullion',[.065,.79,.047],x,.205,gz,mint);
    box('Greenhouse side sill',[.060,.06,glassDepth],x,-.147,gz,mint);
    box('Greenhouse seed bench',[.32,.093,.78],gx+side*.57,.075,gz,woodShade);
    for (const offset of [-.23,.15]) {
      cylinder('Greenhouse plant pot',.19,.14,gx+side*.57,.19,gz+offset,clay);
      flower(gx+side*.57,.248,gz+offset,.39,side===1 ? lilac : pink);
    }
    const slope=side*.44;
    const roof=box('Translucent pitched roof',[1.94,.029,.71],gx,.731,gz+side*.31,glass,false);
    roof.rotation.x=slope;
    for (const offset of [-.92,-.46,0,.46,.92]) {
      const rib=box('Greenhouse roof rib',[.044,.055,.73],gx+offset,.75,gz+side*.31,mint);
      rib.rotation.x=slope;
    }
  }
  box('Greenhouse ridge',[1.98,.061,.066],gx,.902,gz,trim);
  box('Greenhouse door',[.49,.75,.055],gx,.188,gz-.612,deepMint);
  box('Door glass',[.36,.43,.022],gx,.291,gz-.649,glass,false);
  orb('Brass handle',[.063,.063,.057],gx+.159,.091,gz-.666,seedColor);
  register(gx-1,gx+1,lawnY,.94,gz-.68,gz+.68);
  const cx = w-1.10, cz = fenceBack+1.86;
  box('Cottage walls',[1.43,.87,1.01],cx,.075,cz,cream);
  box('Stone foundation',[1.49,.15,1.06],cx,-.262,cz,woodShade);
  stampContact(cx,cz,1.95,1.50);
  const gable = new Mesh('Cottage gable',scene);
  const roofBase=.45, peak=.847, half=.69;
  const positions = [-half,roofBase,-.506, 0,peak,-.506, half,roofBase,-.506,
                      -half,roofBase,.506, 0,peak,.506, half,roofBase,.506];
  const indices = [0,2,1, 3,4,5, 0,1,4, 0,4,3, 1,2,5, 1,5,4, 0,3,5, 0,5,2];
  const normals:number[]=[];
  VertexData.ComputeNormals(positions,indices,normals);
  const gableGeometry = new VertexData();
  gableGeometry.positions=positions; gableGeometry.indices=indices; gableGeometry.normals=normals;
  gableGeometry.applyToMesh(gable);
  place(gable,peach,cx,0,cz,true);
  const roofSpan=.91;
  for (const s of [-1,1]) {
    const roof=box('Coral roof',[roofSpan,.115,1.18],cx+s*.388,.655,cz,coral);
    roof.rotation.z=-s*.5;
    for (let j=0;j<6;j++) {
      const seam=box('Roof tile seams',[roofSpan,.018,.024],cx+s*.39,.72,cz-.53+j*.21,brick);
      seam.rotation.z=roof.rotation.z;
    }
  }
  box('Chimney',[.24,.40,.25],cx+.39,.78,cz+.22,brick);
  box('Chimney cap',[.31,.072,.31],cx+.39,1.01,cz+.22,coral);
  box('Blue door',[.38,.58,.068],cx+.27,.003,cz-.535,deepMint);
  box('Window frame',[.41,.35,.073],cx-.36,.185,cz-.538,woodShade);
  const windowLight=paint('#f7d78a');
  windowLight.emissiveColor=new Color3(.13,.077,.024);
  box('Cottage window panes',[.32,.26,.019],cx-.36,.185,cz-.582,windowLight);
  box('Cottage crossbar',[.34,.037,.029],cx-.36,.188,cz-.599,woodShade);
  box('Cottage mullion',[.036,.28,.029],cx-.36,.185,cz-.599,woodShade);
  box('Cottage exterior shutters',[.072,.37,.038],cx-.59,.185,cz-.584,deepMint);
  box('Cottage exterior shutters',[.072,.37,.038],cx-.13,.185,cz-.584,deepMint);
  box('Cottage doorstep',[.56,.11,.28],cx+.27,-.273,cz-.674,trim);
  orb('Cottage brass knob',[.067,.052,.045],cx+.37,.024,cz-.58,seedColor);
  box('Flower box',[.51,.10,.16],cx-.36,-.014,cz-.60,brick);
  for (const x of [-.52,-.36,-.20]) flower(cx+x,.035,cz-.62,.33,pink);
  register(cx-.9,cx+.9,-.38,1.05,cz-.62,cz+.63);
  if (fixture.bedSide || fixture.seedlingCount) markers.push({
    id:'bed', text:fixture.bedSide ? `${fixture.bedSide} × ${fixture.bedSide} tray` : `Delivery · ${fixture.seedlingCount} seedlings`,
    at: fixture.bedSide ? boxPoint(3.0,.31,h-1.03) : boxPoint(2.4,.40,h-.77), className:'tray-label',
  });

  let randomSeed=27361;
  const rand=()=> { randomSeed = (Math.imul(randomSeed,1664525)+1013904223)>>>0; return randomSeed/4294967296; };
  function picketFence(x1:number,z1:number,x2:number,z2:number,height:number) {
    const dx=x2-x1, dz=z2-z1, length=Math.hypot(dx,dz);
    const spacing=.27, count=Math.round(length/spacing);
    for (const fraction of [.31,.70]) {
      const rail=box('Picket rail',[length,.062,.063],(x1+x2)/2,lawnY+height*fraction,(z1+z2)/2,fenceShade);
      rail.rotation.y=-Math.atan2(dz,dx);
    }
    for (let i=0;i<=count;i++) {
      const end=i===0 || i===count;
      const t=i/count, x=x1+dx*t, z=z1+dz*t, top=height+(end ? .11 : 0);
      const width=end ? .13 : .083;
      box('Picket',[width,top,width*.85],x,lawnY+top/2,z,end ? fenceShade : fenceWood);
      stampContact(x,z,width+.19,width+.19);
      const cap=box('Picket cap',[width*.72,width*.72,width*.79],x,lawnY+top,z,end ? fenceShade : fenceWood);
      cap.rotation.z=Math.PI/4;
    }
  }
  const left=-.87;
  picketFence(left,fenceBack,fenceRight,fenceBack,.57);
  if (h>1) picketFence(fenceRight,fenceBack,fenceRight,-.46,.43);
  const gateX=Math.min(w-1.18,Math.max(.25,dock.x));
  if (gateX-left>.95) picketFence(left,fenceFront,gateX-.59,fenceFront,.28);
  if (fenceRight-gateX>.95) picketFence(gateX+.59,fenceFront,fenceRight,fenceFront,.28);

  function flowerBed(x:number,z:number,width:number,depth:number,color:StandardMaterial) {
    if (width<.35) return;
    box('Flower bed timber frame',[width+.12,.13,depth+.12],x,lawnY+.052,z,wood);
    stampContact(x,z,width+.45,depth+.40);
    box('Flower bed mulch',[width,.118,depth],x,lawnY+.071,z,darkMulch);
    const cols=Math.max(1,Math.ceil(width/.33)), rows=Math.max(1,Math.ceil(depth/.35));
    for (let i=0;i<cols;i++) for (let j=0;j<rows;j++) {
      const fx=x+((i+.5)/cols-.5)*width+(rand()-.5)*.15;
      const fz=z+((j+.5)/rows-.5)*depth+(rand()-.5)*.16;
      flower(fx,lawnY+.13,fz,.40+rand()*.31,color,{ sway:true });
    }
  }
  flowerBed(w*.19-.45,rearFlowerZ,w*.37,rearFlowerDepth,pink);
  flowerBed(w*.71-.45,rearFlowerZ,w*.48,rearFlowerDepth,yellow);
  if (h>2) flowerBed(fenceRight+.56,midZ,.48,h-.75,lilac);
  const leftFlowers=gateX-.78-left, rightFlowers=fenceRight-(gateX+.78);
  flowerBed(left+leftFlowers/2,frontFlowerZ,leftFlowers,.43,lilac);
  flowerBed(fenceRight-rightFlowers/2,frontFlowerZ,rightFlowers,.43,pink);

  for (let row=0;row<3;row++) {
    for (const side of [-1,1]) {
      const stone=box('Sandstone path paver',[.39,.081,.36],
        gateX+side*.221+(rand()-.5)*.08,lawnY+.035,fenceFront+.12-row*.418, row%2 ? boards : trim);
      stone.rotation.y=(rand()-.5)*.13;
    }
  }
  register(gateX-.51,gateX+.51,lawnY,-.23,fenceFront-.92,fenceFront+.32);

  const bark=paint('#92674f');
  function swayTree(material: StandardMaterial) {
    new FoliageWind(material,wind,lawnY,.012);
  }
  swayTree(bark);
  function tree(x:number,z:number,size:number,bloom:boolean) {
    rootFoliage(cylinder('Orchard tree trunk',.16*size,.94*size,x,lawnY+.47*size,z,bark),x);
    const crown=bloom ? paint('#dc91a7') : paint('#7fba76');
    const tips=bloom ? paint('#eda5b9') : paint('#95c581');
    swayTree(crown);
    swayTree(tips);
    const canopy = [
      { x:0, y:1.19, z:0, radii:[.58,.62,.50], material:crown },
      { x:-.31, y:1.21, z:.09, radii:[.43,.50,.42], material:tips },
      { x:.29, y:1.36, z:.13, radii:[.37,.46,.36], material:crown },
    ];
    for (const tuft of canopy) {
      const mesh = CreateIcoSphere('Orchard crown', {
        radiusX:tuft.radii[0]*size, radiusY:tuft.radii[1]*size, radiusZ:tuft.radii[2]*size,
        subdivisions:3,
      },scene);
      place(mesh,tuft.material,x+tuft.x*size,lawnY+tuft.y*size,z+tuft.z*size,true);
      rootFoliage(mesh,x);
    }
  }
  tree(-1.43,fenceBack+.70,1.16,true);
  tree(w+.72,fenceBack+1.68,1.27,false);

  // Door-to-door stepping stones run behind the fence.
  const pathStone = ['#a5a098','#bcb1a0','#afa797'].map(paint);
  const pathStart = gx, pathEnd = cx+.27;
  const intervals = Math.ceil((pathEnd-pathStart)/.44);
  for (let i=0; i<=intervals; i++) {
    const t=i/intervals;
    const x=pathStart+(pathEnd-pathStart)*t;
    const z=fenceBack+.94+.13*Math.sin(Math.PI*t)+(rand()-.5)*.07;
    const stone = place(CreateCylinder('Stone footpath paver',{
      diameterTop:.33+rand()*.06, diameterBottom:.39+rand()*.06, height:.056, tessellation:6,
    },scene),pathStone[i%pathStone.length],x,lawnY+.025,z,true);
    stone.scaling.z=.88+rand()*.10;
    stone.rotation.y=rand()*Math.PI/3;
  }

  const canX=fenceRight+.35, canZ=frontFlowerZ+.09;
  const canPaint=paint('#5d8a86'), canRim=paint('#78a29b');
  place(CreateCylinder('Watering can body',{
    diameterTop:.30, diameterBottom:.36, height:.27, tessellation:10,
  },scene),canPaint,canX,lawnY+.135,canZ,true);
  cylinder('Watering can opening',.17,.012,canX,lawnY+.273,canZ,deepMint);
  ring('Watering can fill rim',.19,.022,canX,lawnY+.28,canZ,canRim);
  ring('Watering can handle',.23,.037,canX-.17,lawnY+.17,canZ,canRim).rotation.x=Math.PI/2;
  const spout = place(CreateCylinder('Watering can spout',{
    diameterTop:.052, diameterBottom:.089, height:.29, tessellation:8,
  },scene),canPaint,canX+.251,lawnY+.18,canZ,true);
  spout.rotation.z=-1.02;
  cylinder('Watering can rose',.115,.046,canX+.38,lawnY+.259,canZ,canRim).rotation.z=spout.rotation.z;
  stampContact(canX,canZ,.63,.43);
  register(canX-.32,canX+.44,lawnY,lawnY+.33,canZ-.20,canZ+.20);

  const scatterGrass=createGrassScatter(scene,lawnY,rand);
  scatterGrass(-2.65,frontFlowerZ-.16,-1.47,fenceBack-.36,Math.ceil(3+h*.5));
  scatterGrass(fenceRight+1.25,frontFlowerZ+.38,fenceRight+2.48,fenceBack+.55,Math.ceil(3+h*.5));
  scatterGrass(gateX+.82,frontFlowerZ-1.49,fenceRight+.58,frontFlowerZ-.73,Math.ceil((fenceRight-gateX)*.78));
  scatterGrass(-1.48,frontFlowerZ-1.55,gateX-.76,frontFlowerZ-.77,Math.min(4,Math.ceil((gateX+.72)*.8)));
  scatterGrass(gx+1.28,fenceBack+2.84,cx-.65,fenceBack+3.63,Math.ceil(w*.55));

  const planted: Mesh[]=[];
  if (fixture.bedSide) {
    const side=fixture.bedSide, spacing=.62, centerX=3,centerZ=1.6, extent=side*spacing;
    box('Wooden seed tray',[extent+.13,.19,extent+.13],centerX,.106,centerZ,woodShade);
    for(let y=0;y<side;y++) for(let x=0;x<side;x++){
      const tx=centerX+(x-(side-1)/2)*spacing,tz=centerZ+(y-(side-1)/2)*spacing;
      box('Seed pocket',[spacing-.075,.076,spacing-.075],tx,.23,tz,clay);
      planted.push(orb('Seed',[.26,.11,.15],tx,.31,tz,seedColor,false));
    }
  }
  if (fixture.seedlingCount) {
    const side=Math.sqrt(fixture.seedlingCount);
    for (let y=0;y<side;y++) for(let x=1;x<=side;x++) {
      // The front is the flyover row. Keep its rose tile's occupancy ring unobstructed.
      if (y===0 && x===side) continue;
      const shift = y===0 ? .23 : 0;
      cylinder('Seedling stem',.037,.21,x,.105,y+shift,green);
      orb('Seedling leaves',[.34,.12,.20],x,.186,y+shift,paleLeaf).rotation.z=.20;
      orb('Seedling leaves',[.18,.13,.27],x,.219,y+shift,leaf).rotation.x=-.22;
    }
  }

  for (const [material,members] of batches) {
    const mesh=members.length===1 ? members[0] : Mesh.MergeMeshes(members,true,true);
    if (mesh) {
      mesh.receiveShadows=true;
      shadowCasters.push(mesh);
      if (material===grid || material===gridEdge) bloomMeshes.push(mesh);
    }
  }
  const positionRingMaterial=paint('#80f5da');
  positionRingMaterial.emissiveColor=new Color3(.12,.58,.43);
  const groundMarker=ring('Current tile ring',.74,.034,dropX,.046,dropZ,positionRingMaterial,false);

  // Bake a small soft footprint texture and batch the stamps into one draw.
  const stampSize = 32;
  const stampPixels = new Uint8Array(stampSize ** 2 * 4).fill(255);
  for (let y=0; y<stampSize; y++) {
    for (let x=0; x<stampSize; x++) {
      const edgeX = Math.min(x,stampSize-1-x);
      const edgeY = Math.min(y,stampSize-1-y);
      stampPixels[(y*stampSize+x)*4+3] = Math.round(255 * SmoothStep(0,1,edgeX/11) * SmoothStep(0,1,edgeY/11));
    }
  }
  const stampTexture = RawTexture.CreateRGBATexture(stampPixels,stampSize,stampSize,scene,false);
  stampTexture.hasAlpha = true;
  const stampMaterial = new StandardMaterial('Soft garden contact shadows',scene);
  stampMaterial.disableLighting = true;
  stampMaterial.emissiveColor = Color3.FromHexString('#30362a');
  stampMaterial.opacityTexture = stampTexture;
  stampMaterial.alpha = .35;
  const contactShadows = Mesh.MergeMeshes(shadowStamps,true,true)!;
  contactShadows.material = stampMaterial;
  contactShadows.alphaIndex = 1; // Composite over the meadow and below the glass.
  contactShadows.isPickable = false;

  return {
    bounds, playableBounds, markers, roseNodes, targetRings, planted, groundMarker, shadowCasters, fadeMeadow,
    bloomMeshes, wind,
  };
}
