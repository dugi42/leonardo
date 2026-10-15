import { RANGES } from '../../design/schema';
import { ARCHETYPE_IDS, ARCHETYPES, archetypeProfile, RIMS, type ArchetypeId } from '../../engine/profile';
import { useT } from '../../i18n/useT';
import { useStore } from '../../state/store';
import { Slider } from '../controls/Slider';

const updateForm = (patch: Partial<ReturnType<typeof useStore.getState>['design']['form']>) =>
  useStore.getState().setDesign((d) => ({ ...d, form: { ...d.form, ...patch } }));

/** Mirrored silhouette of an archetype at its default proportion, as an SVG path. */
function silhouette(id: ArchetypeId): string {
  const height = 4.4 - 3.4 * ARCHETYPES[id].proportion;
  const scale = 26 / Math.max(height, 2);
  const right: string[] = [];
  const left: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const h = i / 24;
    const r = archetypeProfile(id, h) * scale;
    const y = 30 - h * height * scale;
    right.push(`${(16 + r).toFixed(2)},${y.toFixed(2)}`);
    left.unshift(`${(16 - r).toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${right.join('L')}L${left.join('L')}Z`;
}
const SILHOUETTES = Object.fromEntries(ARCHETYPE_IDS.map((id) => [id, silhouette(id)])) as Record<ArchetypeId, string>;

export function FormSection() {
  const t = useT();
  const form = useStore((s) => s.design.form);
  const proportionWord = (p: number) =>
    p < 0.34 ? t('form.slender') : p > 0.66 ? t('form.squat') : t('form.balanced');

  return (
    <section className="panel-section">
      <header className="section-head">
        <h3>{t('form.title')}</h3>
      </header>
      <div className="archetypes" role="radiogroup" aria-label={t('form.title')}>
        {ARCHETYPE_IDS.map((id) => (
          <label key={id} className={form.archetype === id ? 'archetype on' : 'archetype'} title={t(`archetype.${id}`)}>
            <input
              type="radio"
              name="archetype"
              checked={form.archetype === id}
              onChange={() => updateForm({ archetype: id, proportion: ARCHETYPES[id].proportion })}
            />
            <svg viewBox="0 0 32 32" aria-hidden="true" data-testid="silhouette">
              <path d={SILHOUETTES[id]} />
            </svg>
            <span>{t(`archetype.${id}`)}</span>
          </label>
        ))}
      </div>
      <Slider
        label={t('form.proportion')}
        value={form.proportion}
        min={RANGES.proportion[0]}
        max={RANGES.proportion[1]}
        step={0.01}
        defaultValue={ARCHETYPES[form.archetype].proportion}
        format={proportionWord}
        onChange={(proportion) => updateForm({ proportion })}
      />
      <div className="field-row">
        <span className="field-label">{t('form.rim')}</span>
        <div className="segmented three" role="radiogroup" aria-label={t('form.rim')}>
          {RIMS.map((rim) => (
            <label key={rim} className={form.rim === rim ? 'seg on' : 'seg'}>
              <input type="radio" name="rim" checked={form.rim === rim} onChange={() => updateForm({ rim })} />
              {t(`rim.${rim}`)}
            </label>
          ))}
        </div>
      </div>
      <Slider
        label={t('form.foot')}
        value={form.foot}
        min={RANGES.foot[0]}
        max={RANGES.foot[1]}
        step={0.01}
        defaultValue={0}
        format={(v) => (v === 0 ? t('form.footNone') : `${Math.round(v * 100)}`)}
        unit={form.foot === 0 ? undefined : '%'}
        onChange={(foot) => updateForm({ foot })}
      />
    </section>
  );
}
