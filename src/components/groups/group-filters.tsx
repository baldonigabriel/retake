"use client";

import { useFilterNavigation } from "@/components/dashboard/dashboard-filters";
import { SegmentedControl } from "@/components/ui/segmented-control";

type Option = { value: string; label: string };

/** One URL-backed switch (?week=, ?mode=, ?metric=). Switching doesn't animate. */
export function GroupFilter({
  name,
  label,
  options,
  value,
  fallback,
}: {
  name: string;
  label: string;
  options: readonly Option[];
  value: string;
  fallback: string;
}) {
  const navigate = useFilterNavigation();
  if (options.length < 2) return null;
  return <SegmentedControl label={label} options={options} value={value} onChange={(v) => navigate(name, v, fallback)} />;
}
