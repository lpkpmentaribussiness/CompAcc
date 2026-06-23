import { X } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '../lib/format'

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}) {
  const variants = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  }
  const sizes = {
    sm: 'h-9 px-3 text-sm rounded-lg',
    md: 'h-11 px-4 text-sm rounded-xl',
    lg: 'h-13 px-5 text-base rounded-xl'
  }
  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', variants[variant], sizes[size], className)}
      {...props}
    />
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-2xl border border-slate-200/80 bg-white shadow-soft', className)}>{children}</section>
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn('h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500', className)}
      {...props}
    />
  )
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn('h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 transition focus:border-brand-500', className)}
      {...props}
    >
      {children}
    </select>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function Badge({
  children,
  tone = 'neutral'
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-600',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
    warning: 'bg-amber-50 text-amber-700 ring-amber-600/10',
    danger: 'bg-red-50 text-red-700 ring-red-600/10',
    info: 'bg-indigo-50 text-indigo-700 ring-indigo-600/10'
  }
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset', tones[tone])}>{children}</span>
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide = false
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className={cn('max-h-[92vh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl', wide ? 'max-w-4xl' : 'max-w-xl')}>
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Tutup">
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-6">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 rounded-2xl bg-slate-100 p-3 text-slate-500">{icon}</div>
      <h3 className="font-bold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
