import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-input bg-background px-3 text-ui-sm transition focus:border-ring focus:ring-2 focus:ring-ring/20',
        className,
      )}
      {...props}
    />
  );
});
