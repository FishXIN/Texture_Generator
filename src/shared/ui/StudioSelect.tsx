import { Children, Fragment, isValidElement, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import './studio-select.css';

type OptionProps = { value?: string | number; disabled?: boolean; children?: ReactNode };
function options(children: ReactNode): OptionProps[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<OptionProps>(child)) return [];
    if (child.type === Fragment || child.type === 'optgroup') return options(child.props.children);
    return child.type === 'option' ? [child.props] : [];
  });
}

export function StudioSelect({ label, value, onChange, children, disabled = false, className = '' }: {
  label: string; value: string | number; onChange: (value: string) => void;
  children: ReactNode; disabled?: boolean; className?: string;
}) {
  const [container, setContainer] = useState<HTMLElement | undefined>();
  const triggerRef = useCallback((node: HTMLButtonElement | null) => {
    const dialog = node?.closest('dialog');
    setContainer(dialog instanceof HTMLElement ? dialog : undefined);
  }, []);
  // Empty strings represent “no source” in existing project fields.
  const encode = (value: string | number | undefined) => `option:${String(value ?? '')}`;
  return <Select.Root value={encode(value)} onValueChange={v => onChange(v.slice(7))} disabled={disabled}>
    <Select.Trigger type="button" aria-label={label} data-value={String(value)}
      className={`studio-select ${className}`} ref={triggerRef} onKeyDown={event => event.stopPropagation()}>
      <Select.Value/><Select.Icon><ChevronDown size={12}/></Select.Icon>
    </Select.Trigger>
    <Select.Portal container={container}>
      <Select.Content className="studio-select-popup" position="popper" sideOffset={6} collisionPadding={12}
        aria-label={label} onEscapeKeyDown={event => event.stopPropagation()}
        onKeyDown={event => event.stopPropagation()}>
        <Select.ScrollUpButton className="studio-select-scroll"><ChevronUp size={12}/></Select.ScrollUpButton>
        <Select.Viewport className="studio-select-options">
          {options(children).map(option => <Select.Item key={encode(option.value)} value={encode(option.value)}
            disabled={option.disabled} className="studio-select-option" data-value={String(option.value)}>
            <Select.ItemText>{option.children}</Select.ItemText>
            <Select.ItemIndicator className="studio-select-check"><Check size={13}/></Select.ItemIndicator>
          </Select.Item>)}
        </Select.Viewport>
        <Select.ScrollDownButton className="studio-select-scroll"><ChevronDown size={12}/></Select.ScrollDownButton>
      </Select.Content>
    </Select.Portal>
  </Select.Root>;
}
