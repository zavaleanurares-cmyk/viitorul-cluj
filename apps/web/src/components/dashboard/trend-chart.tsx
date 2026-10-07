"use client";
import { AVAILABILITY_COLORS, StackedBarsChart } from "@/components/charts";

/** Tendința disponibilității: bare stivuite pe săptămâni, în culorile de disponibilitate. */
export function AvailabilityTrend({ data, labels, caption }: {
  data: Array<{ x: string; full: number; limited: number; out: number }>;
  labels: { full: string; limited: string; out: string };
  caption: string;
}) {
  return (
    <StackedBarsChart
      caption={caption}
      height={260}
      data={data}
      series={[
        { key: "full", label: labels.full, color: AVAILABILITY_COLORS.full },
        { key: "limited", label: labels.limited, color: AVAILABILITY_COLORS.limited },
        { key: "out", label: labels.out, color: AVAILABILITY_COLORS.out },
      ]}
    />
  );
}
