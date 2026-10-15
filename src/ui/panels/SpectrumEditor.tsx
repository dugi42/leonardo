import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { RANGES } from '../../design/schema';
import { KMAX, MMAX } from '../../engine/constants';
import { fullCoefficients, magnitude } from '../../engine/spectrum';
import { useT } from '../../i18n/useT';
import { useStore } from '../../state/store';
import { updateSpectrum } from '../../state/updates';
import { Slider } from '../controls/Slider';
import { kilnColor, magnitudeToT } from './kiln';

type Brush = 'off' | 'boost' | 'damp';
const BRUSH_GAIN = { boost: 1.25, damp: 0.8 } as const;
const CELL = 10;
const W = MMAX * CELL;
const H = KMAX * CELL;

export function SpectrumEditor() {
  const t = useT();
  const seed = useStore((s) => s.design.seed);
  const spectrum = useStore((s) => s.design.spectrum);
  const [brush, setBrush] = useState<Brush>('off');
  const svgRef = useRef<SVGSVGElement>(null);
  const stroke = useRef<{ active: boolean; visited: Set<string> }>({ active: false, visited: new Set() });

  const base = useMemo(() => fullCoefficients(seed, spectrum.recipe), [seed, spectrum.recipe]);
  const maxMag = useMemo(() => {
    let max = 0;
    for (let k = 0; k < KMAX; k++)
      for (let m = 0; m < MMAX; m++)
        if (k || m) max = Math.max(max, magnitude(base, k, m) * (spectrum.edits[`${k},${m}`] ?? 1));
    return max;
  }, [base, spectrum.edits]);
  const editCount = Object.keys(spectrum.edits).length;

  const cellAt = (e: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect();
    const m = Math.floor(((e.clientX - box.left) / box.width) * MMAX);
    const k = KMAX - 1 - Math.floor(((e.clientY - box.top) / box.height) * KMAX);
    return { k: Math.min(KMAX - 1, Math.max(0, k)), m: Math.min(MMAX - 1, Math.max(0, m)) };
  };

  const apply = (e: PointerEvent) => {
    const { k, m } = cellAt(e);
    if (brush === 'off') {
      updateSpectrum({ K: k + 1, M: m + 1 });
      return;
    }
    const key = `${k},${m}`;
    if ((k === 0 && m === 0) || stroke.current.visited.has(key)) return;
    stroke.current.visited.add(key);
    const edits = useStore.getState().design.spectrum.edits;
    const gain = Math.round((edits[key] ?? 1) * BRUSH_GAIN[brush] * 1000) / 1000;
    updateSpectrum({ edits: { ...edits, [key]: gain } });
  };

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stroke.current = { active: true, visited: new Set() };
    apply(e);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (stroke.current.active) apply(e);
  };
  const onUp = () => {
    stroke.current.active = false;
  };

  const cells = [];
  for (let k = 0; k < KMAX; k++) {
    for (let m = 0; m < MMAX; m++) {
      const gain = spectrum.edits[`${k},${m}`] ?? 1;
      const mag = k === 0 && m === 0 ? maxMag : magnitude(base, k, m) * gain;
      const kept = k < spectrum.K && m < spectrum.M;
      cells.push(
        <rect
          key={`${k},${m}`}
          x={m * CELL}
          y={(KMAX - 1 - k) * CELL}
          width={CELL - 1}
          height={CELL - 1}
          fill={kilnColor(magnitudeToT(mag, maxMag))}
          opacity={kept ? 1 : 0.22}
        />,
      );
      if (gain !== 1) {
        cells.push(
          <circle
            key={`e${k},${m}`}
            className={gain > 1 ? 'edit-boost' : 'edit-damp'}
            cx={m * CELL + CELL / 2 - 0.5}
            cy={(KMAX - 1 - k) * CELL + CELL / 2 - 0.5}
            r={1.6}
          />,
        );
      }
    }
  }

  const rx = spectrum.M * CELL;
  const ry = (KMAX - spectrum.K) * CELL;

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
        <span className="axis axis-k" aria-hidden="true">k</span>
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
        >
          {cells}
          <rect className="kept" x={-0.5} y={ry - 0.5} width={rx} height={H - ry} />
          <circle className="handle" cx={rx - 0.5} cy={ry - 0.5} r={4} aria-hidden="true" />
        </svg>
        <span className="axis axis-m" aria-hidden="true">m</span>
      </div>

      <div className="brushes" role="radiogroup" aria-label={t('spectrum.brush')}>
        {(['off', 'boost', 'damp'] as const).map((b) => (
          <label key={b} className={brush === b ? 'seg on' : 'seg'}>
            <input type="radio" name="brush" checked={brush === b} onChange={() => setBrush(b)} />
            {t(`spectrum.brush.${b}`)}
          </label>
        ))}
        <button
          className="btn ghost small"
          onClick={() => updateSpectrum({ edits: {} })}
          disabled={editCount === 0}
        >
          {t('spectrum.reset')}
        </button>
        {editCount > 0 && <span className="muted small">{t('spectrum.edits', { n: editCount })}</span>}
      </div>

      <Slider
        label={t('spectrum.k')}
        value={spectrum.K}
        min={RANGES.K[0]}
        max={RANGES.K[1]}
        step={1}
        defaultValue={8}
        onChange={(K) => updateSpectrum({ K })}
      />
      <Slider
        label={t('spectrum.m')}
        value={spectrum.M}
        min={RANGES.M[0]}
        max={RANGES.M[1]}
        step={1}
        defaultValue={12}
        onChange={(M) => updateSpectrum({ M })}
      />
    </section>
  );
}
