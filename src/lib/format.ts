export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0)

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)

export const formatDate = (value?: string) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

export const today = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export const makeId = () => crypto.randomUUID()

export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')

export const downloadCsv = (filename: string, rows: Array<Record<string, unknown>>) => {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const encode = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const csv = [headers.map(encode).join(','), ...rows.map((row) => headers.map((key) => encode(row[key])).join(','))].join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
  URL.revokeObjectURL(href)
}
