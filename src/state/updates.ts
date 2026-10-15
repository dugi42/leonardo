import type { Body, Modifiers, PrintSettings, Recipe, Spectrum } from '../design/schema';
import { useStore } from './store';

const set = useStore.getState().setDesign;

export const updateRecipe = (patch: Partial<Recipe>) =>
  set((d) => ({ ...d, spectrum: { ...d.spectrum, recipe: { ...d.spectrum.recipe, ...patch } } }));

export const updateSpectrum = (patch: Partial<Omit<Spectrum, 'recipe'>>) =>
  set((d) => ({ ...d, spectrum: { ...d.spectrum, ...patch } }));

export const updateModifiers = (patch: Partial<Modifiers>) =>
  set((d) => ({ ...d, modifiers: { ...d.modifiers, ...patch } }));

export const updateBody = (patch: Partial<Body>) => set((d) => ({ ...d, body: { ...d.body, ...patch } }));

export const updatePrint = (patch: Partial<PrintSettings>) =>
  set((d) => ({ ...d, print: { ...d.print, ...patch } }));
