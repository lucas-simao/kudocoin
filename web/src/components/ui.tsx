// The few pieces every screen is built from. Colors, radii and shadows come from brand/theme.css.
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
  useState,
} from 'react'

type Variant = 'coin' | 'quiet' | 'danger'

const VARIANTS: Record<Variant, string> = {
  coin: 'bg-coin text-on-coin hover:bg-coin-hover active:bg-coin-pressed font-semibold',
  quiet: 'bg-transparent text-ink border border-line hover:bg-hover',
  danger: 'bg-transparent text-alert-text border border-line hover:bg-alert-soft',
}

export function Button({
  variant = 'coin',
  busy = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-[0.9375rem] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** `tour` names the card for the guided tour (features/tour/tour.ts). */
export function Card({ children, className = '', tour }: { children: ReactNode; className?: string; tour?: string }) {
  return (
    <section data-tour={tour} className={`rounded-card border border-line-subtle bg-surface p-5 shadow-card sm:p-6 ${className}`}>
      {children}
    </section>
  )
}

export function Heading({ children, as: Tag = 'h2' }: { children: ReactNode; as?: 'h1' | 'h2' | 'h3' }) {
  const size = Tag === 'h1' ? 'text-2xl sm:text-3xl' : Tag === 'h2' ? 'text-lg' : 'text-base'
  return <Tag className={`font-display font-semibold tracking-tight text-ink ${size}`}>{children}</Tag>
}

interface FieldProps {
  label: string
  hint?: string
  error?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children(id, describedBy)}
      {hint ? (
        <p id={hintId} className="text-[0.8125rem] text-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[0.8125rem] text-alert-text">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const CONTROL =
  'min-h-11 w-full rounded-control border border-line-control/50 bg-raised px-3 text-[0.9375rem] text-ink placeholder:text-subtle hover:border-line-control aria-invalid:border-alert-text'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${props.className ?? ''}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} min-h-20 py-2.5 ${props.className ?? ''}`} />
}

/** The browser's own arrow sits against the edge and differs on every system; this one has room and follows the theme. */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${CONTROL} appearance-none pr-11 ${props.className ?? ''}`} />
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        width="18"
        height="18"
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-subtle"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[0.9375rem]">
      <input type="checkbox" className="size-5 accent-[var(--color-coin-pressed)]" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}

export function Avatar({ name, picture, size = 36 }: { name: string; picture: string | null; size?: number }) {
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return picture ? (
    <img src={picture} alt="" width={size} height={size} referrerPolicy="no-referrer" className="shrink-0 rounded-full bg-hover object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-coin-soft text-[0.75rem] font-semibold text-coin-text"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'done'; children: ReactNode }) {
  const tones = { info: 'bg-coin-soft text-ink', error: 'bg-alert-soft text-alert-text', done: 'bg-done-soft text-done-text' }
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-control px-3 py-2.5 text-sm ${tones[tone]}`}>
      {children}
    </p>
  )
}

/** A coin amount with the organization's coin name. */
export function Coins({ amount, name, strong = false }: { amount: string; name: string; strong?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className={`tabular ${strong ? 'font-semibold' : ''}`}>{amount}</span> <span className="text-subtle">{name}</span>
    </span>
  )
}

/**
 * Asks before a destructive action, in place: the button turns into the question with confirm focused,
 * Enter confirms and Esc leaves it.
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  cancelLabel,
  onConfirm,
  variant = 'danger',
}: {
  label: string
  question: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => Promise<unknown> | void
  variant?: Variant
}) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!asking) {
    return (
      <Button variant={variant} onClick={() => setAsking(true)}>
        {label}
      </Button>
    )
  }
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-control bg-hover p-2"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setAsking(false)
      }}
    >
      <span className="px-1 text-sm">{question}</span>
      <Button
        variant={variant}
        autoFocus
        busy={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onConfirm()
          } finally {
            setBusy(false)
            setAsking(false)
          }
        }}
      >
        {confirmLabel}
      </Button>
      <Button variant="quiet" onClick={() => setAsking(false)}>
        {cancelLabel}
      </Button>
    </div>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-10 text-sm text-subtle">
      <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-line border-t-coin" />
      {label}
    </p>
  )
}
