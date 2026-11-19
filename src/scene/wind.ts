import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { ShadowDepthWrapper } from '@babylonjs/core/Materials/shadowDepthWrapper';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer';

const GUST_ORIGIN = -2.5;
const GUST_SPEED = 3.2;
const GUST_LENGTH = 2.1;
const FIRST_LULL = .48;
const GUST_INTERVALS = [3.25, 3.75, 3.45, 4.05];

export class GardenWind {
  age = -FIRST_LULL;
  private nextGust = 0;
  private previousInterval = 0;
  private readonly minimumInterval: number;

  constructor(boardWidth: number) {
    const crossingTime = (boardWidth + 2 - GUST_ORIGIN) / GUST_SPEED + GUST_LENGTH;
    // Two gusts can cross different parts of the yard while each plant gets a lull.
    this.minimumInterval = Math.max(GUST_LENGTH, crossingTime / 2 + .08);
  }

  get previousAge() {
    return this.age + this.previousInterval;
  }

  advance(delta: number, reduced: boolean) {
    if (reduced) {
      this.age = -FIRST_LULL;
      this.previousInterval = 0;
      return;
    }
    this.age += delta;
    const interval = Math.max(this.minimumInterval,GUST_INTERVALS[this.nextGust]);
    if (this.age >= interval) {
      this.age -= interval;
      this.previousInterval = interval;
      this.nextGust = (this.nextGust + 1) % GUST_INTERVALS.length;
    }
  }
}

export class FoliageWind extends MaterialPluginBase {
  constructor(material: StandardMaterial, private readonly wind: GardenWind,
    private readonly rootY: number, private readonly tilt: number) {
    super(material,'FoliageWind',200,{},true,true);
    const shadow = new ShadowDepthWrapper(material);
    material.shadowDepthWrapper = shadow;
    material.onDisposeObservable.addOnce(()=>shadow.dispose());
  }

  override getUniforms() {
    return {
      ubo: [{ name:'gardenWind', size:4, type:'vec4' }],
      vertex: '#ifndef UNIFORMBUFFERS\nuniform vec4 gardenWind;\n#endif',
    };
  }

  override bindForSubMesh(buffer: UniformBuffer) {
    buffer.updateFloat4('gardenWind',this.wind.age,this.tilt,this.rootY,this.wind.previousAge);
  }

  override getAttributes(attributes: string[]) {
    if (!attributes.includes(VertexBuffer.UV2Kind)) attributes.push(VertexBuffer.UV2Kind);
  }

  override getCustomCode(shaderType: string) {
    if (shaderType !== 'vertex') return null;
    return {
      CUSTOM_VERTEX_DEFINITIONS: `
        #ifndef UV2
        attribute vec2 uv2;
        #endif
        float gardenGust(float age) {
          return smoothstep(0.0, 0.68, age)
               * (1.0 - smoothstep(0.82, ${GUST_LENGTH.toFixed(2)}, age));
        }
      `,
      CUSTOM_VERTEX_UPDATE_WORLDPOS: `{
        vec2 root = vec2(uv2.x, gardenWind.z);
        float arrival = (root.x - (${GUST_ORIGIN.toFixed(1)})) / ${GUST_SPEED.toFixed(1)};
        float gust = max(gardenGust(gardenWind.x - arrival), gardenGust(gardenWind.w - arrival));
        float angle = gust * gardenWind.y;
        float c = cos(angle), s = sin(angle);
        mat2 lean = mat2(c, -s, s, c);
        worldPos.xy = root + lean * (worldPos.xy - root);
        #ifdef NORMAL
        vNormalW.xy = lean * vNormalW.xy;
        #endif
      }`,
    };
  }
}
