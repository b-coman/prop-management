/**
 * Gets months between two dates
 */
export function getMonthsBetweenDates(startDate: Date, endDate: Date): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];

  const currentDate = new Date(startDate);
  currentDate.setDate(1); // Start at the beginning of the month

  const lastDate = new Date(endDate);
  lastDate.setDate(1); // Compare based on month start

  while (currentDate <= lastDate) {
    months.push({
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1
    });

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return months;
}
