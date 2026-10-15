import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { RANGES } from '../../design/schema';
import { KMAX, MMAX } from '../../engine/constants';
import { editedCoefficients, magnitude } from '../../engine/spectrum';
import { useT } from '../../i18n/useT';
import { useStore } from '../../state/store';
import { updateSpectrum } from '../../state/updates';
import { Slider } from '../controls/Slider';
import { kilnColor, magnitudeToT } from './kiln';

type Brush = 'off' | 'boost' | 'damp';
const BRUSH_GAIN = { boost: 1.6, damp: 0.5 } as const;
const CELL = 10;
const W = MMAX * CELL;
const H = KMAX * CELL;
/** Cells below this share of the strongest term draw as empty outlines. */
const EMPTY_T = 0.02;
const TICKS_M = [0, 8, 16, 24];
const TICKS_K = [0, 8, 16];

const key = (k: number, m: number) => `${k},${m}`;

export function SpectrumEditor() {
  const t = useT();
  const seed = useStore((s) => s.design.seed);
  const spectrum = useStore((s) => s.design.spectrum);
  const hover = useStore((s) => s.hoverCell);
  const [brush, setBrush] = useState<Brush>('off');
  const svgRef = useRef<SVGSVGElement>(null);
  const stroke = useRef<{ active: boolean; visited: Set<string> }>({ active: false, visited: new Set() });

  // Shows edits (including energy injected into empty cells) but not the truncation.
  const coeffs = useMemo(() => editedCoefficients(seed, spectrum), [seed, spectrum]);
  const maxMag = useMemo(() => {
    let max = 0;
    for (let k = 0; k < KMAX; k++) for (let m = 0; m < MMAX; m++) if (k || m) max = Math.max(max, magnitude(coeffs, k, m));
    return max;
  }, [coeffs]);
  const editCount = Object.keys(spectrum.edits).length;
  const setHover = useStore.getState().setHoverCell;

  const cellAt = (e: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect();
    const m = Math.floor(((e.clientX - box.left) / box.width) * MMAX);
    const k = KMAX - 1 - Math.floor(((e.clientY - box.top) / box.height) * KMAX);
    return { k: Math.min(KMAX - 1, Math.max(0, k)), m: Math.min(MMAX - 1, Math.max(0, m)) };
  };

  const apply = (k: number, m: number) => {
    if (brush === 'off') {
      updateSpectrum({ K: k + 1, M: m + 1 });
      return;
    }
    const id = key(k, m);
    if ((k === 0 && m === 0) || stroke.current.visited.has(id)) return;
    stroke.current.visited.add(id);
    const edits = useStore.getState().design.spectrum.edits;
    const gain = Math.round((edits[id] ?? 1) * BRUSH_GAIN[brush] * 1000) / 1000;
    updateSpectrum({ edits: { ...edits, [id]: gain } });
  };

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stroke.current = { active: true, visited: new Set() };
    const { k, m } = cellAt(e);
    apply(k, m);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const { k, m } = cellAt(e);
    const current = useStore.getState().hoverCell;
    if (!current || current.k !== k || current.m !== m) setHover({ k, m });
    if (stroke.current.active) apply(k, m);
  };
  const onUp = () => {
    stroke.current.active = false;
  };

  const cells = [];
  for (let k = 0; k < KMAX; k++) {
    for (let m = 0; m < MMAX; m++) {
      const x = m * CELL;
      const y = (KMAX - 1 - k) * CELL;
      const kept = k < spectrum.K && m < spectrum.M;
      if (k === 0 && m === 0) {
        cells.push(<rect key="form" className="cell-form" x={x} y={y} width={CELL - 1} height={CELL - 1} />);
        continue;
      }
      const tt = magnitudeToT(magnitude(coeffs, k, m), maxMag);
      cells.push(
        tt < EMPTY_T ? (
          <rect key={key(k, m)} className="cell-empty" x={x + 0.5} y={y + 0.5} width={CELL - 2} height={CELL - 2} opacity={kept ? 1 : 0.4} />
        ) : (
          <rect key={key(k, m)} x={x} y={y} width={CELL - 1} height={CELL - 1} fill={kilnColor(0.12 + 0.88 * tt)} opacity={kept ? 1 : 0.28} />
        ),
      );
      const gain = spectrum.edits[key(k, m)];
      if (gain !== undefined) {
        cells.push(
          <circle key={`e${k},${m}`} className={gain > 1 ? 'edit-boost' : 'edit-damp'} cx={x + CELL / 2 - 0.5} cy={y + CELL / 2 - 0.5} r={1.8} />,
        );
      }
    }
  }

  const rx = spectrum.M * CELL;
  const ry = (KMAX - spectrum.K) * CELL;

  let status: string;
  if (hover && hover.k === 0 && hover.m === 0) status = `k 0 · m 0 · ${t('spectrum.formCell')}`;
  else if (hover) {
    const gain = spectrum.edits[key(hover.k, hover.m)];
    status = `k ${hover.k} · m ${hover.m} · ${magnitude(coeffs, hover.k, hover.m).toFixed(3)}${gain !== undefined ? ` · ×${gain}` : ''}`;
  } else status = editCount > 0 ? t('spectrum.edits', { n: editCount }) : t('spectrum.hoverHint');

  return (
    <section className="panel-section spectrum">
      <header className="section-head">
        <h3>{t('spectrum.title')}</h3>
        <span className="readout">
          K {spectrum.K} × M {spectrum.M}
        </span>
      </header>
      <p className="help">{t('spectrum.help')}</p>
      <div className="heatmap-frame">
        <div className="ticks-k" aria-hidden="true">
          {TICKS_K.map((k) => (
            <span key={k} style={{ bottom: `${((k + 0.5) / KMAX) * 100}%` }}>{k}</span>
          ))}
          <span className="axis-name" style={{ top: 0 }}>k</span>
        </div>
        <svg
          ref={svgRef}
          role="img"
          aria-label={t('spectrum.title')}
          className={`heatmap brush-${brush}`}
          viewBox={`-0.5 -0.5 ${W} ${H}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={() => setHover(null)}
        >
          {cells}
          <rect className="kept" x={-0.5} y={ry - 0.5} width={rx} height={H - ry} />
          {hover && (
            <rect className="hover" x={hover.m * CELL - 1} y={(KMAX - 1 - hover.k) * CELL - 1} width={CELL + 1} height={CELL + 1} />
          )}
          <circle className="handle" cx={rx - 0.5} cy={ry - 0.5} r={4} aria-hidden="true" />
        </svg>
        <div className="ticks-m" aria-hidden="true">
          {TICKS_M.map((m) => (
            <span key={m} style={{ left: `${((m + 0.5) / MMAX) * 100}%` }}>{m}</span>
          ))}
          <span className="axis-name" style={{ right: 0 }}>m</span>
        </div>
      </div>
      <p className="spectrum-status" data-testid="spectrum-status" aria-live="polite">
        {status}
      </p>

      <div className="brushes" role="radiogroup" aria-label={t('spectrum.brush')}>
        {(['off', 'boost', 'damp'] as const).map((b) => (
          <label key={b} className={brush === b ? 'seg on' : 'seg'}>
            <input type="radio" name="brush" checked={brush === b} onChange={() => setBrush(b)} />
            {t(`spectrum.brush.${b}`)}
          </label>
        ))}
        <button className="btn ghost small" onClick={() => updateSpectrum({ edits: {} })} disabled={editCount === 0}>
          {t('spectrum.reset')}
        </button>
      </div>

      <Slider label={t('spectrum.k')} value={spectrum.K} min={RANGES.K[0]} max={RANGES.K[1]} step={1} defaultValue={8} onChange={(K) => updateSpectrum({ K })} />
      <Slider label={t('spectrum.m')} value={spectrum.M} min={RANGES.M[0]} max={RANGES.M[1]} step={1} defaultValue={12} onChange={(M) => updateSpectrum({ M })} />
    </section>
  );
}
