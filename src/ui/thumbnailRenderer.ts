import {
  AmbientLight,
  DirectionalLight,
  Mesh as ThreeMesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import type { Design } from '../design/schema';
import { buildMesh } from '../engine/mesh';
import { filamentById, finishMaterial } from '../engine/materials';
import { meshToGeometry } from './three/geometry';

const SIZE = 240;

export function createThumbnailRenderer() {
  const canvas = document.createElement('canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  const scene = new Scene();
  scene.add(new AmbientLight('#9aa6c0', 0.9));
  const key = new DirectionalLight('#fff3e0', 2.4);
  key.position.set(1.2, -1.6, 2.2);
  scene.add(key);
  const rim = new DirectionalLight('#7fd0c4', 1.1);
  rim.position.set(-2, 1.5, 0.6);
  scene.add(rim);
  const material = new MeshPhysicalMaterial();
  const camera = new PerspectiveCamera(30, 1, 1, 5000);
  camera.up.set(0, 0, 1);

  return (design: Design): string | undefined => {
    const { mesh } = buildMesh(design, 'preview');
    const hex = filamentById(design.look.color).hex;
    material.setValues({ ...finishMaterial(design.look.finish), color: hex, sheenColor: hex });
    const geometry = meshToGeometry(mesh);
    const object = new ThreeMesh(geometry, material);
    scene.add(object);
    const sphere = geometry.boundingSphere!;
    const dist = sphere.radius / Math.sin((camera.fov * Math.PI) / 360) * 1.05;
    camera.position.set(sphere.center.x, sphere.center.y - dist * 0.94, sphere.center.z + dist * 0.34);
    camera.lookAt(sphere.center);
    renderer.render(scene, camera);
    const url = canvas.toDataURL('image/png');
    scene.remove(object);
    geometry.dispose();
    return url;
  };
}
