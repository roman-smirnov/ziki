import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/instancedMesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';

type Blade = readonly [angle: number, height: number, width: number, bend: number];

function buildTuft(name: string, blades: readonly Blade[], material: StandardMaterial, scene: Scene) {
  const data = new VertexData();
  const positions: number[] = [], indices: number[] = [], colors: number[] = [], normals: number[] = [];
  for (const [angle,height,width,bend] of blades) {
    const base = positions.length/3;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    // Wider shoulders and an off-center ridge give each tapered blade two faces.
    const points = [
      [-width*.26, 0, .014, .68], [width*.26, 0, .014, .73],
      [-width*.50, height*.49, bend*.32, .92],
      [width*.09, height*.54, bend*.32-.017, 1.12],
      [width*.50, height*.49, bend*.32, .86],
      [width*.12, height, bend, 1.06],
    ];
    for (const [x,y,z,tone] of points) {
      positions.push(x*cos-z*sin,y,x*sin+z*cos);
      colors.push(tone,tone,tone,1);
    }
    indices.push(base,base+2,base+3, base,base+3,base+1, base+1,base+3,base+4,
      base+2,base+5,base+3, base+3,base+5,base+4);
  }
  VertexData.ComputeNormals(positions,indices,normals);
  data.positions=positions;
  data.indices=indices;
  data.colors=colors;
  data.normals=normals;
  const mesh = new Mesh(name,scene);
  data.applyToMesh(mesh);
  mesh.material=material;
  mesh.receiveShadows=true;
  mesh.isVisible=false;
  mesh.isPickable=false;
  return mesh;
}

export function createGrassScatter(scene: Scene, lawnY: number, random: () => number) {
  const grass = new StandardMaterial('Meadow grass',scene);
  grass.diffuseColor = Color3.FromHexString('#829c5d');
  grass.emissiveColor = new Color3(.062,.10,.033);
  grass.specularColor = Color3.Black();
  grass.backFaceCulling = false;
  const tufts = [
    buildTuft('Upright grass',[
      [0,.24,.072,.06], [1.34,.19,.055,.10], [2.76,.26,.065,.04],
      [4.26,.15,.058,.13], [5.15,.20,.061,.08],
    ],grass,scene),
    buildTuft('Spreading grass',[
      [.24,.15,.082,.13], [1.68,.18,.065,.10], [3.15,.13,.075,.15],
      [4.36,.21,.057,.07], [5.64,.16,.063,.12],
    ],grass,scene),
  ];
  const centers: { x:number; z:number }[] = [];

  return (x1:number,z1:number,x2:number,z2:number,count:number) => {
    let planted = 0;
    for (let attempt=0; attempt<count*10 && planted<count; attempt++) {
      const x=x1+(x2-x1)*random(), z=z1+(z2-z1)*random();
      if (centers.some(center=>(x-center.x)**2+(z-center.z)**2<.76**2)) continue;
      centers.push({x,z});
      planted++;
      const heading=random()*Math.PI*2;
      const members=random()<.48 ? 3 : 2;
      for (let i=0; i<members; i++) {
        const angle=heading+i*2.35+(random()-.5)*.62;
        const offset=.07+random()*.13;
        const source=tufts[Math.floor(random()*tufts.length)];
        const tuft=source.createInstance('Outer lawn grass tuft');
        tuft.position.set(x+Math.cos(angle)*offset,lawnY,z+Math.sin(angle)*offset);
        tuft.scaling.setAll(.83+random()*.33);
        tuft.rotation.y=random()*Math.PI*2;
        tuft.isPickable=false;
      }
    }
  };
}
