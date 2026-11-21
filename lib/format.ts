export function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return "K " + v.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function localDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA");
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZM", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
