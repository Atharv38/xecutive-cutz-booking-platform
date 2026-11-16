import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] shadow-[0_8px_22px_-6px_rgba(233,184,75,0.35)]',
  outline:
    'border border-[rgba(218,174,77,0.35)] bg-[#1C1B18] text-[#F5F2EA] hover:border-[#E9B84B] hover:text-[#E9B84B]',
  ghost: 'text-[#A5A29B] hover:text-[#E9B84B] hover:bg-[#1C1B18]',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-10 px-5 py-2 text-sm',
  sm: 'h-9 px-3.5 text-xs',
  lg: 'h-11 px-7 text-sm',
  icon: 'h-10 w-10 p-0',
};

export function Button({
  variant = 'default',
  size = 'default',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#E9B84B] whitespace-nowrap rounded-sm ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}
