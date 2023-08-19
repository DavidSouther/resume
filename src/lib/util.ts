const SHOW_JOBS_SINCE = 2018;

export function show(date?: string | undefined): boolean {
  const year = Number(date?.substring(0, 4));
  const hide = year >= SHOW_JOBS_SINCE;
  return hide;
}
