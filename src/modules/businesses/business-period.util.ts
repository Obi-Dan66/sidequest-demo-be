import { BusinessMetricsPeriod } from './dto/business-metrics-period.enum';

export interface DateRange {
  start: Date;
  endExclusive: Date;
}

const MS_DAY = 86_400_000;

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Current window and the immediately preceding window of equal length.
 * Ranges are half-open: [start, endExclusive).
 */
export function currentAndPreviousWindow(
  period: BusinessMetricsPeriod,
  now: Date,
): { current: DateRange; previous: DateRange } {
  if (period === BusinessMetricsPeriod.MONTH) {
    const monthStart = startOfUtcMonth(now);
    const lengthMs = Math.max(0, now.getTime() - monthStart.getTime());
    const prevEndExclusive = monthStart;
    const prevStart = new Date(monthStart.getTime() - lengthMs);
    return {
      current: { start: monthStart, endExclusive: now },
      previous: { start: prevStart, endExclusive: prevEndExclusive },
    };
  }

  const days =
    period === BusinessMetricsPeriod.SEVEN_D
      ? 7
      : period === BusinessMetricsPeriod.THIRTY_D
        ? 30
        : 90;
  const lenMs = days * MS_DAY;
  const curEndExclusive = now;
  const curStart = new Date(curEndExclusive.getTime() - lenMs);
  const prevEndExclusive = curStart;
  const prevStart = new Date(prevEndExclusive.getTime() - lenMs);
  return {
    current: { start: curStart, endExclusive: curEndExclusive },
    previous: { start: prevStart, endExclusive: prevEndExclusive },
  };
}
