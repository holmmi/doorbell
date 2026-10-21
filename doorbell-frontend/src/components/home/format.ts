export const toIsoDate = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

export const formatNumber = (value: number, language: string) =>
  new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value)

// Parse YYYY-MM-DD as a local date so the day never shifts across time zones.
export const formatDayMonth = (isoDate: string, language: string) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(language, {
    month: 'long',
    day: 'numeric',
  }).format(new Date(year, month - 1, day))
}
