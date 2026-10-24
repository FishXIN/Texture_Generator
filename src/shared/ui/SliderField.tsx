import { clamp } from '@/shared/lib/math';
import { Input } from './input';

type SliderFieldProps = {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
};

export function SliderField({ label, hint, value, min, max, step, onChange, format }: SliderFieldProps) {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-muted/30 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-ui-sm font-medium">{label}</div>
          {hint ? <div className="mt-1 text-ui-xs text-muted-foreground">{hint}</div> : null}
        </div>
        <div className="rounded-lg bg-card px-2 py-1 text-ui-xs font-medium text-foreground">
          {format ? format(value) : value}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          onChange(clamp(Number.isFinite(nextValue) ? nextValue : min, min, max));
        }}
      />
    </div>
  );
}
