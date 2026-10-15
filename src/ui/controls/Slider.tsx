import { useId, type ReactNode } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (value: number) => void;
  format?: (value: number) => ReactNode;
  unit?: string;
}

/** Range input with a live readout. Double-click resets to the default value. */
export function Slider({ label, value, min, max, step, defaultValue, onChange, format, unit }: SliderProps) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>
        {format ? format(value) : value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)}
        {unit && <span className="unit">{unit}</span>}
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(defaultValue)}
      />
    </div>
  );
}
