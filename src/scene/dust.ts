import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

const MOTE_COUNT = 8;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function createHoverDust(scene: Scene) {
  const size = 16;
  const pixels = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const falloff = Math.max(0, 1 - Math.hypot(x - center, y - center) / center);
      pixels.set([255, 255, 255, Math.round(255 * falloff ** 1.5)], (y * size + x) * 4);
    }
  }
  const texture = RawTexture.CreateRGBATexture(pixels, size, size, scene, false);
  texture.hasAlpha = true;
  const material = new StandardMaterial('Soil dust', scene);
  material.disableLighting = true;
  material.emissiveColor = Color3.FromHexString('#d9b591');
  material.opacityTexture = texture;
  material.backFaceCulling = false;

  const root = new TransformNode('Hover dust', scene);
  root.setEnabled(false);
  const motes = Array.from({ length: MOTE_COUNT }, (_, i) => {
    const mote = CreatePlane('Soil dust puff', { width: .11 + (i % 3) * .02, height: .07 }, scene);
    mote.parent = root;
    mote.material = material;
    mote.rotation.x = Math.PI / 2;
    mote.isPickable = false;
    return mote;
  });

  return (elapsed: number, position: Vector3, visible: boolean) => {
    root.setEnabled(visible);
    if (!visible) return;

    root.position.set(position.x, 0, position.z);
    for (const [i, mote] of motes.entries()) {
      const age = elapsed / (.95 + (i % 4) * .14) + i / MOTE_COUNT;
      const cycle = Math.floor(age);
      const t = Math.min(1, (age - cycle) / .52);
      const angle = (i + cycle * MOTE_COUNT) * GOLDEN_ANGLE;
      // The rotor wash meets the bed and pushes loose dust outward along it.
      const radius = .11 + (i % 3) * .035 + .21 * (1 - (1 - t) ** 2);
      const height = .018 + .016 * Math.sin(Math.PI * t);
      mote.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      mote.rotation.y = -angle;
      mote.scaling.setAll(.7 + t * .65);
      mote.visibility = .46 * Math.sin(Math.PI * t) ** 2;
    }
  };
}
