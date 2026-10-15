import { useId } from 'react';
import { BODY_KINDS, defaultDesign, RANGES } from '../../design/schema';
import { PRINTERS, type PrinterId } from '../../engine/printers';
import { useT } from '../../i18n/useT';
import { useStore } from '../../state/store';
import { updateBody, updatePrint } from '../../state/updates';
import { Slider } from '../controls/Slider';
import { getPreview } from '../preview';

const DEFAULTS = defaultDesign(0);
const mm = (v: number) => v.toFixed(v < 10 ? 1 : 0);

export function PrintPanel() {
  const t = useT();
  const design = useStore((s) => s.design);
  const showOverhang = useStore((s) => s.showOverhang);
  const printerId = useId();
  const { body, print } = design;
  const { scale, stats } = getPreview(design);
  const vessel = body.kind === 'hollow' || body.kind === 'planter';
  const [x, y, z] = stats.size;

  return (
    <div className="panel-body">
      <section className="panel-section">
        <header className="section-head">
          <h3>{t('print.title')}</h3>
        </header>
        <div className="field">
          <label htmlFor={printerId}>{t('print.printer')}</label>
          <select
            id={printerId}
            value={print.printer}
            onChange={(e) => updatePrint({ printer: e.target.value as PrinterId })}
          >
            {PRINTERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.bed[0]}×{p.bed[1]}×{p.height}
              </option>
            ))}
          </select>
        </div>
        <Slider
          label={t('print.height')}
          value={print.heightMm}
          min={RANGES.heightMm[0]}
          max={RANGES.heightMm[1]}
          step={1}
          defaultValue={DEFAULTS.print.heightMm}
          unit="mm"
          onChange={(heightMm) => updatePrint({ heightMm })}
        />
        {scale.capped && (
          <p className="note warn" role="status">
            {t('print.capped', { height: Math.round(scale.heightMm) })}
          </p>
        )}
      </section>

      <section className="panel-section">
        <header className="section-head">
          <h3>{t('print.body')}</h3>
        </header>
        <div className="segmented body-kinds" role="radiogroup" aria-label={t('print.body')}>
          {BODY_KINDS.map((k) => (
            <label key={k} className={body.kind === k ? 'seg on' : 'seg'}>
              <input type="radio" name="body" checked={body.kind === k} onChange={() => updateBody({ kind: k })} />
              {t(`body.${k}`)}
            </label>
          ))}
        </div>
        <p className="help">{t(`body.${body.kind}.help`)}</p>
        {vessel && (
          <>
            <Slider label={t('print.wall')} value={body.wallMm} min={RANGES.wallMm[0]} max={RANGES.wallMm[1]} step={0.1} defaultValue={DEFAULTS.body.wallMm} unit="mm" onChange={(wallMm) => updateBody({ wallMm })} />
            <Slider label={t('print.floor')} value={body.floorMm} min={RANGES.floorMm[0]} max={RANGES.floorMm[1]} step={0.1} defaultValue={DEFAULTS.body.floorMm} unit="mm" onChange={(floorMm) => updateBody({ floorMm })} />
          </>
        )}
        {body.kind === 'planter' && (
          <Slider label={t('print.hole')} value={body.holeMm} min={RANGES.holeMm[0]} max={RANGES.holeMm[1]} step={0.5} defaultValue={DEFAULTS.body.holeMm} unit="mm" onChange={(holeMm) => updateBody({ holeMm })} />
        )}
      </section>

      <section className="panel-section">
        <header className="section-head">
          <h3>{t('stats.title')}</h3>
        </header>
        <dl className="stats">
          <div>
            <dt>{t('stats.size')}</dt>
            <dd>
              {mm(x)} × {mm(y)} × {mm(z)} mm
            </dd>
          </div>
          <div>
            <dt>{t('stats.volume')}</dt>
            <dd>{(stats.volumeMm3 / 1000).toFixed(0)} cm³</dd>
          </div>
          <div>
            <dt>{t('stats.weight')}</dt>
            <dd>{stats.grams.toFixed(0)} g</dd>
          </div>
          <div>
            <dt>{t('stats.overhang')}</dt>
            <dd className={stats.overhangAreaMm2 > 0 ? 'warn' : undefined}>
              {(stats.overhangAreaMm2 / 100).toFixed(1)} cm²
            </dd>
          </div>
        </dl>
        <label className="toggle">
          <input
            type="checkbox"
            checked={showOverhang}
            onChange={(e) => useStore.getState().setShowOverhang(e.target.checked)}
          />
          <span>{t('print.overhang')}</span>
        </label>
        <p className="help">{t('print.overhangHelp')}</p>
      </section>
    </div>
  );
}
