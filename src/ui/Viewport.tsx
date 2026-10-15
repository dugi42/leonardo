import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { BufferAttribute, BufferGeometry, CanvasTexture, Color, Object3D } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { printerById } from '../engine/printers';
import { faceOverhang } from '../engine/stats';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';
import { Icon } from './icons';
import { getPreview } from './preview';
import { meshToGeometry, SURFACE } from './three/geometry';

// Printers think in z-up; so does every mesh we build.
Object3D.DEFAULT_UP.set(0, 0, 1);

const BASE = new Color(SURFACE.color);
const HOT = new Color('#ff5b4d');

function overhangColors(marks: Float32Array): Float32Array {
  const out = new Float32Array(marks.length * 3);
  const c = new Color();
  for (let i = 0; i < marks.length; i++) {
    c.copy(BASE).lerp(HOT, marks[i]);
    out[3 * i] = c.r;
    out[3 * i + 1] = c.g;
    out[3 * i + 2] = c.b;
  }
  return out;
}

/** Bed outline with a 10 mm grid and 50 mm major lines, centred on the origin. */
function BedPlate({ printerId, strong }: { printerId: string; strong: boolean }) {
  const [bx, by] = printerById(printerId).bed;
  const { minor, major, outline } = useMemo(() => {
    const lines = (step: number, skip?: number) => {
      const pts: number[] = [];
      for (let x = -Math.floor(bx / 2 / step) * step; x <= bx / 2; x += step) {
        if (skip && Math.abs(x % skip) < 1e-6) continue;
        pts.push(x, -by / 2, 0, x, by / 2, 0);
      }
      for (let y = -Math.floor(by / 2 / step) * step; y <= by / 2; y += step) {
        if (skip && Math.abs(y % skip) < 1e-6) continue;
        pts.push(-bx / 2, y, 0, bx / 2, y, 0);
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(Float32Array.from(pts), 3));
      return g;
    };
    const o = new BufferGeometry();
    const [x, y] = [bx / 2, by / 2];
    o.setAttribute('position', new BufferAttribute(Float32Array.from([-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0, -x, -y, 0]), 3));
    return { minor: lines(10, 50), major: lines(50), outline: o };
  }, [bx, by]);
  useEffect(() => () => [minor, major, outline].forEach((g) => g.dispose()), [minor, major, outline]);
  return (
    <group position={[0, 0, -0.05]}>
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[bx, by]} />
        <meshStandardMaterial color="#161a21" roughness={0.9} transparent opacity={strong ? 0.9 : 0.5} />
      </mesh>
      <lineSegments geometry={minor}>
        <lineBasicMaterial color="#2a313c" transparent opacity={strong ? 0.9 : 0.45} />
      </lineSegments>
      <lineSegments geometry={major}>
        <lineBasicMaterial color="#3a4352" transparent opacity={strong ? 1 : 0.55} />
      </lineSegments>
      <line>
        <primitive object={outline} attach="geometry" />
        <lineBasicMaterial color={strong ? '#6cc3b5' : '#3a4352'} />
      </line>
    </group>
  );
}

let shadowTexture: CanvasTexture | null = null;
function getShadowTexture(): CanvasTexture {
  if (!shadowTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.75)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    shadowTexture = new CanvasTexture(c);
  }
  return shadowTexture;
}

/** Soft contact shadow: a blurred disc under the footprint. */
function ShadowDisc({ size }: { size: number }) {
  return (
    <mesh position={[0, 0, 0.02]} renderOrder={1}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={getShadowTexture()} transparent depthWrite={false} />
    </mesh>
  );
}

/** Places the camera to frame the object; re-runs when `fitKey` changes. */
function CameraRig({ width, height, fitKey }: { width: number; height: number; fitKey: number }) {
  const { camera, controls, invalidate } = useThree();
  useEffect(() => {
    const r = Math.hypot(width / 2, height / 2);
    const fov = 'fov' in camera ? (camera.fov as number) : 30;
    const dist = (r / Math.sin((fov * Math.PI) / 360)) * 1.45;
    camera.position.set(dist * 0.32, -dist * 0.9, height / 2 + dist * 0.3);
    const c = controls as unknown as OrbitControlsImpl | null;
    c?.target.set(0, 0, height / 2);
    c?.update();
    camera.lookAt(0, 0, height / 2);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, controls]);
  return null;
}

export function Viewport() {
  const t = useT();
  const live = useStore((s) => s.design);
  const mode = useStore((s) => s.mode);
  const showOverhang = useStore((s) => s.showOverhang) && mode === 'print';
  const design = useDeferredValue(live);
  const preview = getPreview(design);
  const [fitKey, setFitKey] = useState(0);

  const geometry = useMemo(
    () => meshToGeometry(preview.mesh, showOverhang ? overhangColors(faceOverhang(preview.mesh)) : undefined),
    [preview, showOverhang],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  const [w, , h] = preview.stats.size;
  // Refit when the printer or mode changes the scale of the scene.
  useEffect(() => setFitKey((k) => k + 1), [mode, design.print.printer]);

  return (
    <div className="viewport">
      <div className="viewport-canvas" role="img" aria-label={t('viewport.label')}>
        <Canvas
          dpr={[1, 2]}
          frameloop="demand"
          camera={{ fov: 30, near: 1, far: 8000, position: [0, -500, 200] }}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.35} color="#9aa6c0" />
          <directionalLight position={[180, -260, 420]} intensity={2.1} color="#fff3e0" />
          <directionalLight position={[-300, 220, 120]} intensity={0.9} color="#7fd0c4" />
          <Environment resolution={256}>
            <Lightformer form="rect" intensity={2.2} position={[0, -6, 6]} scale={[10, 4, 1]} color="#ffffff" />
            <Lightformer form="rect" intensity={1.2} position={[-8, 4, 3]} scale={[4, 8, 1]} color="#bfe9e2" />
            <Lightformer form="ring" intensity={1.6} position={[7, 3, 5]} scale={3} color="#ffd9a0" />
          </Environment>
          <mesh geometry={geometry}>
            <meshPhysicalMaterial {...SURFACE} color={showOverhang ? '#ffffff' : SURFACE.color} vertexColors={showOverhang} />
          </mesh>
          <BedPlate printerId={design.print.printer} strong={mode === 'print'} />
          <ShadowDisc size={Math.max(w, preview.stats.size[1]) * 1.7} />
          <OrbitControls makeDefault enableDamping={false} minDistance={20} maxDistance={3000} />
          <CameraRig width={Math.max(w, preview.stats.size[1])} height={h} fitKey={fitKey} />
        </Canvas>
      </div>

      <div className="viewport-hud">
        <span className="dims">
          {preview.stats.size.map((v) => v.toFixed(0)).join(' × ')} mm
        </span>
        <button className="icon-btn" onClick={() => setFitKey((k) => k + 1)} aria-label={t('viewport.reset')} title={t('viewport.reset')}>
          <Icon name="focus" />
        </button>
      </div>
      {!preview.check.ok && (
        <p className="viewport-error" role="alert">
          {t('error.mesh', { reason: preview.check.reason ?? '' })}
        </p>
      )}
    </div>
  );
}
