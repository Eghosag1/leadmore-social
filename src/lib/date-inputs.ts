// Splits an ISO timestamp into the local-time `value` strings native
// <input type="date">/<input type="time"> expect, for pre-filling an edit
// form.
export function formatDateInputs(iso: string | null): { dateValue: string; timeValue: string } {
  if (!iso) return { dateValue: "", timeValue: "" };

  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateValue = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timeValue = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  return { dateValue, timeValue };
}
