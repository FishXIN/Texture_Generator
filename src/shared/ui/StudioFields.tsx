import type { ReactNode } from 'react';
export function Field({label,value,min,max,step=1,onChange,unit='',disabled=false}:{
  label:string;value:number;min:number;max:number;step?:number;onChange:(v:number)=>void;unit?:string;disabled?:boolean;
}) {
  const change=(v:number)=>{if(Number.isFinite(v))onChange(Math.max(min,Math.min(max,Number((Math.round(v/step)*step).toFixed(6)))));};
  return <label className="param-field"><span className="field-label">{label}<span className="field-value">
    <input aria-label={`${label}数值`} type="number" min={min} max={max} step={step} value={Number(value.toFixed(3))}
      disabled={disabled} onChange={e=>change(Number(e.target.value))}/>{unit}</span></span>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e=>change(Number(e.target.value))}/>
  </label>;
}
export function SelectField({label,value,onChange,children,disabled=false}:{
  label:string;value:string;onChange:(v:string)=>void;children:ReactNode;disabled?:boolean;
}) {
  return <label className="select-field"><span>{label}</span><select aria-label={label} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{children}</select></label>;
}
export function Toggle({label,checked,onChange,disabled=false}:{
  label:string;checked:boolean;onChange:(v:boolean)=>void;disabled?:boolean;
}) {
  return <label className="toggle-field"><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/></label>;
}
