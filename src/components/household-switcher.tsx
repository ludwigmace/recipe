"use client";

import { useRouter } from "next/navigation";

interface Household {
  id: string;
  name: string;
}

export function HouseholdSwitcher({
  households,
  selectedId,
  pathname = "/",
}: {
  households: Household[];
  selectedId: string;
  pathname?: string;
}) {
  const router = useRouter();

  return (
    <label className="household-switcher">
      <span>Your households</span>
      <select
        value={selectedId}
        onChange={(event) => {
          router.push(`${pathname}?household=${encodeURIComponent(event.target.value)}`);
        }}
      >
        {households.map((household) => (
          <option value={household.id} key={household.id}>{household.name}</option>
        ))}
      </select>
    </label>
  );
}
