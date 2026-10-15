/** Common PLA colours. Hex values are approximations of typical spools, not vendor specs. */
export const FILAMENTS = [
  { id: 'white', hex: '#ecebe6' },
  { id: 'beige', hex: '#e8d9c4' },
  { id: 'gray', hex: '#8e9089' },
  { id: 'black', hex: '#262626' },
  { id: 'red', hex: '#c12e1f' },
  { id: 'orange', hex: '#ff6a13' },
  { id: 'yellow', hex: '#f4d02a' },
  { id: 'green', hex: '#00ae42' },
  { id: 'cyan', hex: '#0086d6' },
  { id: 'blue', hex: '#0a2989' },
  { id: 'purple', hex: '#5e43b7' },
  { id: 'pink', hex: '#f55a74' },
  { id: 'brown', hex: '#9d432c' },
] as const;

export type FilamentId = (typeof FILAMENTS)[number]['id'];
export const FILAMENT_IDS = FILAMENTS.map((f) => f.id) as FilamentId[];

export type Finish = 'matte' | 'basic' | 'silk';
export const FINISHES: readonly Finish[] = ['matte', 'basic', 'silk'];

export function filamentById(id: string): (typeof FILAMENTS)[number] {
  return FILAMENTS.find((f) => f.id === id) ?? FILAMENTS[0];
}

export interface PhysicalLook {
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
}

/** Renderer parameters for a filament finish (MeshPhysicalMaterial). */
export function finishMaterial(finish: Finish): PhysicalLook {
  switch (finish) {
    case 'matte':
      return { roughness: 0.85, metalness: 0, clearcoat: 0, clearcoatRoughness: 1, sheen: 0.2 };
    case 'silk':
      return { roughness: 0.28, metalness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.6 };
    default:
      return { roughness: 0.45, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0 };
  }
}
