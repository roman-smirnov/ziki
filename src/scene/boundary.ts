import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Fixture } from '../levels/index.ts';
import { headingOffsets, type BoundaryBlock } from '../game/plan.ts';
import { CURB_DEPTH } from './garden.ts';

const COLUMNS = 12;
const ROWS = 20;
const WIDTH = 1.08;
const HEIGHT = 1.47;
const edges = [0, 4, 8, COLUMNS];
const bands = [0, 5, 10, 15, ROWS];

export function createBoundary(scene: Scene, fixture: Fixture) {
  const anchor = new TransformNode('Garden boundary', scene);
  anchor.setEnabled(false);
  const membrane = new Mesh('Elastic field', scene);
  const material = new StandardMaterial('Translucent teal field', scene);
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.emissiveColor = Color3.FromHexString('#58dbd5');
  material.alpha = .34;
  membrane.material = material;
  membrane.parent = anchor;
  membrane.isPickable = false;
  membrane.alwaysSelectAsActiveMesh = true;

  const points = Array.from({ length: (COLUMNS + 1) * (ROWS + 1) }, () => new Vector3());
  const grid = Array.from({ length: ROWS + 1 }, (_, row) => points.slice(row * (COLUMNS + 1), (row + 1) * (COLUMNS + 1)));
  const lines = [...bands.map(row => grid[row]), ...edges.map(col => grid.map(row => row[col]))];
  const lattice = CreateLineSystem('Elastic field seams', { lines, updatable: true }, scene);
  lattice.color = Color3.FromHexString('#d6fff1');
  lattice.parent = anchor;
  lattice.isPickable = false;
  lattice.alwaysSelectAsActiveMesh = true;

  const indices: number[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const a = row * (COLUMNS + 1) + col;
      const b = a + COLUMNS + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const positions = new Float32Array(points.length * 3);
  const vertices = new VertexData();
  vertices.positions = positions;
  vertices.indices = indices;
  vertices.applyToMesh(membrane, true);

  const rail = CreateBox('Stopped boundary marker', { width: WIDTH, height: .009, depth: .026 }, scene);
  const railMaterial = new StandardMaterial('Amber boundary marker', scene);
  railMaterial.disableLighting = true;
  railMaterial.emissiveColor = Color3.FromHexString('#ffe1a0');
  rail.material = railMaterial;
  rail.parent = anchor;
  rail.isPickable = false;

  return (block?: BoundaryBlock, bend = 0, opacity = 0, showRail = false) => {
    anchor.setEnabled(Boolean(block));
    if (!block) return;
    const { direction, state: { position } } = block;
    const { x, y: z } = headingOffsets[direction];
    const exterior = position.x + x < 0 || position.x + x >= fixture.width
      || position.y + z < 0 || position.y + z >= fixture.height;
    const edge = .5 + (exterior ? CURB_DEPTH : 0);
    anchor.position.set(position.x + x * edge, .03, position.y + z * edge);
    anchor.rotation.y = Math.atan2(x, z);
    rail.position.z = exterior ? -CURB_DEPTH / 2 : 0;
    rail.setEnabled(showRail);
    membrane.setEnabled(opacity > 0);
    lattice.setEnabled(opacity > 0);
    if (opacity <= 0) return;

    for (let row = 0; row <= ROWS; row++) {
      const up = row / ROWS;
      const bulge = bend * Math.sin(Math.PI * up) ** 1.28;
      for (let col = 0; col <= COLUMNS; col++) {
        const across = col / COLUMNS;
        const height = up * HEIGHT;
        const stretch = bulge * (.78 + .22 * Math.sin(Math.PI * across));
        const point = grid[row][col];
        point.set((across - .5) * WIDTH, height, (x !== 0 ? height * .095 : 0) + stretch);
        point.toArray(positions, (row * (COLUMNS + 1) + col) * 3);
      }
    }
    material.alpha = opacity * .37;
    lattice.alpha = opacity * .89;
    membrane.updateVerticesData(VertexBuffer.PositionKind, positions);
    CreateLineSystem('Elastic field seams', { lines, instance: lattice }, scene);
  };
}
