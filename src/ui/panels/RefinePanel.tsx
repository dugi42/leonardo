import { defaultDesign, RANGES } from '../../design/schema';
import { randomSeed } from '../../engine/prng';
import { useT } from '../../i18n/useT';
import { useStore } from '../../state/store';
import { updateModifiers, updateRecipe } from '../../state/updates';
import { Slider } from '../controls/Slider';
import { Icon } from '../icons';
import { FormSection } from './FormSection';
import { SpectrumEditor } from './SpectrumEditor';

const DEFAULTS = defaultDesign(0);

export function RefinePanel() {
  const t = useT();
  const recipe = useStore((s) => s.design.spectrum.recipe);
  const modifiers = useStore((s) => s.design.modifiers);
  const r = DEFAULTS.spectrum.recipe;
  const pct = (v: number) => `${Math.round(v * 100)}`;

  return (
    <div className="panel-body">
      <FormSection />
      <SpectrumEditor />

      <section className="panel-section">
        <header className="section-head">
          <h3>{t('shape.title')}</h3>
          <button
            className="btn ghost small"
            onClick={() => useStore.getState().setDesign((d) => ({ ...d, seed: randomSeed() }))}
          >
            <Icon name="dice" width={15} height={15} />
            {t('shape.reroll')}
          </button>
        </header>
        <Slider label={t('shape.bulge')} value={recipe.bulge} min={0} max={1} step={0.01} defaultValue={r.bulge} format={pct} unit="%" onChange={(bulge) => updateRecipe({ bulge })} />
        <Slider label={t('shape.flutes')} value={recipe.flutes} min={0} max={1} step={0.01} defaultValue={r.flutes} format={pct} unit="%" onChange={(flutes) => updateRecipe({ flutes })} />
        <Slider label={t('shape.roughness')} value={recipe.roughness} min={0} max={1} step={0.01} defaultValue={r.roughness} format={pct} unit="%" onChange={(roughness) => updateRecipe({ roughness })} />
        <Slider
          label={t('shape.symmetry')}
          value={recipe.symmetry}
          min={RANGES.symmetry[0]}
          max={RANGES.symmetry[1]}
          step={1}
          defaultValue={r.symmetry}
          format={(v) => (v === 0 ? t('shape.symmetryOff') : `${v}×`)}
          onChange={(symmetry) => updateRecipe({ symmetry })}
        />
        <Slider label={t('shape.ribs')} value={recipe.ribs} min={0} max={1} step={0.01} defaultValue={r.ribs} format={pct} unit="%" onChange={(ribs) => updateRecipe({ ribs })} />
        <Slider
          label={t('shape.ribFrequency')}
          value={recipe.ribFrequency}
          min={RANGES.ribFrequency[0]}
          max={RANGES.ribFrequency[1]}
          step={1}
          defaultValue={r.ribFrequency}
          onChange={(ribFrequency) => updateRecipe({ ribFrequency })}
        />
      </section>

      <section className="panel-section">
        <header className="section-head">
          <h3>{t('modifiers.title')}</h3>
        </header>
        <Slider
          label={t('modifiers.twist')}
          value={modifiers.twist}
          min={RANGES.twist[0]}
          max={RANGES.twist[1]}
          step={0.01}
          defaultValue={0}
          format={(v) => v.toFixed(2)}
          unit={t('modifiers.turns')}
          onChange={(twist) => updateModifiers({ twist })}
        />
        <Slider
          label={t('modifiers.edginess')}
          value={modifiers.edginess}
          min={RANGES.edginess[0]}
          max={RANGES.edginess[1]}
          step={0.05}
          defaultValue={0}
          format={(v) => v.toFixed(1)}
          onChange={(edginess) => updateModifiers({ edginess })}
        />
      </section>
    </div>
  );
}
