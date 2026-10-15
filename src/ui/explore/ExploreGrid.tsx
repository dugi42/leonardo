import { useEffect, useState } from 'react';
import { encodeDesign } from '../../design/codec';
import { randomDesign, variation } from '../../design/mutate';
import type { Design } from '../../design/schema';
import { randomSeed, sfc32 } from '../../engine/prng';
import { useT } from '../../i18n/useT';
import { useStore } from '../../state/store';
import { Slider } from '../controls/Slider';
import { Icon } from '../icons';
import { renderThumbnail } from '../thumbnail';

const CENTRE = 4;

export function shuffleTiles() {
  const { design, setExplore } = useStore.getState();
  setExplore({ tiles: Array.from({ length: 9 }, () => randomDesign(randomSeed(), design)), selected: 0, kind: 'shuffle' });
}

export function variationTiles() {
  const { explore, setExplore } = useStore.getState();
  const parent = explore.tiles[explore.selected];
  if (!parent) return;
  const rng = sfc32(randomSeed());
  const tiles = Array.from({ length: 9 }, (_, i) => {
    if (i === CENTRE) return parent;
    // Retry so no variation lands exactly on the parent (possible at low temperature).
    let child = variation(parent, explore.temperature, rng);
    for (let n = 0; n < 5 && JSON.stringify(child) === JSON.stringify(parent); n++) {
      child = variation(parent, Math.max(0.1, explore.temperature), rng);
    }
    return child;
  });
  setExplore({ tiles, selected: CENTRE, kind: 'variations' });
}

/** Tiles carry shapes; filament, body and printer always come from the current design. */
export function withSetup(tile: Design, current: Design): Design {
  return { ...tile, body: current.body, print: current.print, look: current.look };
}

export function refineSelected() {
  const { explore, design, setDesign, setMode } = useStore.getState();
  const chosen = explore.tiles[explore.selected];
  if (chosen) setDesign(withSetup(chosen, design));
  setMode('refine');
}

function Tile({ design, index, selected, label }: { design: Design; index: number; selected: boolean; label: string }) {
  const t = useT();
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let live = true;
    setSrc(undefined);
    renderThumbnail(design, encodeDesign(design)).then((url) => live && setSrc(url));
    return () => {
      live = false;
    };
  }, [design]);
  return (
    <button
      className={selected ? 'tile selected' : 'tile'}
      aria-pressed={selected}
      aria-label={t('explore.tile', { seed: design.seed })}
      onClick={() => useStore.getState().setExplore({ selected: index })}
      onDoubleClick={refineSelected}
    >
      {src ? <img src={src} alt="" draggable={false} /> : <span className="tile-wait" aria-hidden="true" />}
      <span className={index === CENTRE && label !== `#${design.seed}` ? 'tile-seed parent' : 'tile-seed'}>{label}</span>
    </button>
  );
}

export function ExploreGrid() {
  const t = useT();
  const explore = useStore((s) => s.explore);
  const current = useStore((s) => s.design);
  const label = (d: Design, i: number) => {
    if (explore.kind !== 'variations') return `#${d.seed}`;
    if (i === CENTRE) return t('explore.parent');
    return t('explore.variation', { n: i < CENTRE ? i + 1 : i });
  };

  useEffect(() => {
    if (useStore.getState().explore.tiles.length === 0) shuffleTiles();
  }, []);

  return (
    <div className="explore">
      <div className="explore-grid">
        {explore.tiles.map((tile, i) => {
          const d = withSetup(tile, current);
          return <Tile key={`${i}-${encodeDesign(d)}`} design={d} index={i} selected={i === explore.selected} label={label(d, i)} />;
        })}
      </div>
    </div>
  );
}

export function ExplorePanel() {
  const t = useT();
  const temperature = useStore((s) => s.explore.temperature);
  return (
    <div className="panel-body">
      <section className="panel-section">
        <p className="lead">{t('explore.hint')}</p>
        <div className="stack">
          <button className="btn" onClick={shuffleTiles} title="Space">
            <Icon name="shuffle" />
            {t('explore.shuffle')}
          </button>
          <button className="btn" onClick={variationTiles}>
            <Icon name="sparkle" />
            {t('explore.variations')}
          </button>
        </div>
        <Slider
          label={t('explore.temperature')}
          value={temperature}
          min={0.05}
          max={1}
          step={0.01}
          defaultValue={0.35}
          format={(v) => `${Math.round(v * 100)}`}
          unit="%"
          onChange={(v) => useStore.getState().setExplore({ temperature: v })}
        />
        <button className="btn primary wide" onClick={refineSelected}>
          {t('explore.refine')}
        </button>
      </section>
    </div>
  );
}
