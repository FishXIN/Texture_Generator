import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { StudioSelect } from './StudioSelect';
export function Field({label,value,min,max,step=1,onChange,unit='',disabled=false}:{
  label:string;value:number;min:number;max:number;step?:number;onChange:(v:number)=>void;unit?:string;disabled?:boolean;
}) {
  const change=(v:number)=>{if(Number.isFinite(v))onChange(Math.max(min,Math.min(max,Number((Math.round(v/step)*step).toFixed(6)))));};
  const current = useRef(value), target = useRef(value), velocity = useRef(0), frame = useRef(0);
  const dragging = useRef(false), callback = useRef(change), previous = useRef(0);
  callback.current = change;
  if (!dragging.current) current.current = target.current = value;
  const stop = () => {
    if (!dragging.current) return;
    cancelAnimationFrame(frame.current); dragging.current = false;
    current.current = target.current; velocity.current = 0; callback.current(target.current);
    window.dispatchEvent(new Event('texture-range-end'));
  };
  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    if (dragging.current) window.dispatchEvent(new Event('texture-range-end'));
  }, []);
  const tick = (time: number) => {
    const dt = Math.min(.032, (time - previous.current) / 1000 || .016); previous.current = time;
    // Critically damped spring: quick response with a soft stop, no overshoot.
    const omega = 32, delta = current.current - target.current;
    const decay = Math.exp(-omega * dt), impulse = velocity.current + omega * delta;
    current.current = target.current + (delta + impulse * dt) * decay;
    velocity.current = (velocity.current - omega * impulse * dt) * decay;
    callback.current(current.current);
    if (dragging.current) frame.current = requestAnimationFrame(tick);
  };
  return <label className="param-field"><span className="field-label">{label}<span className="field-value">
    <input aria-label={`${label}数值`} type="number" min={min} max={max} step={step} value={Number(value.toFixed(3))}
      disabled={disabled} onChange={e=>change(Number(e.target.value))}/>{unit}</span></span>
    <span className={`smooth-range${disabled?' disabled':''}`} style={{'--range-progress':`${(value-min)/(max-min)*100}%`} as CSSProperties}>
      <span className="smooth-range-track"/><span className="smooth-range-thumb"/>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onPointerDown={e=>{
          if(disabled)return;
          dragging.current=true; current.current=target.current=value; velocity.current=0; previous.current=performance.now();
          e.currentTarget.setPointerCapture(e.pointerId); window.dispatchEvent(new Event('texture-range-start'));
          frame.current=requestAnimationFrame(tick);
        }}
        onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
        onChange={e=>{
          const next=Number(e.target.value);
          if(dragging.current)target.current=next;else change(next);
        }}
        onKeyDown={e=>{
          if((e.shiftKey||e.altKey)&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
            e.preventDefault();change(value+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1)*step);
          }
        }}/>
    </span>
  </label>;
}
export function SelectField({label,value,onChange,children,disabled=false}:{
  label:string;value:string;onChange:(v:string)=>void;children:ReactNode;disabled?:boolean;
}) {
  return <label className="select-field"><span>{label}</span><StudioSelect label={label} value={value} disabled={disabled} onChange={onChange}>{children}</StudioSelect></label>;
}
export function Toggle({label,checked,onChange,disabled=false}:{
  label:string;checked:boolean;onChange:(v:boolean)=>void;disabled?:boolean;
}) {
  return <label className="toggle-field"><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/></label>;
}
