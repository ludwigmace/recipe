"use client";

import { useRouter } from "next/navigation";

interface Household {
  id: string;
  name: string;
}

export function HouseholdSwitcher({
  households,
  selectedId,
}: {
  households: Household[];
  selectedId: string;
}) {
  const router = useRouter();

  return (
    <label className="household-switcher">
      <span>Your households</span>
      <select
        value={selectedId}
        onChange={(event) => {
          router.push(`/?household=${encodeURIComponent(event.target.value)}`);
        }}
      >
        {households.map((household) => (
          <option value={household.id} key={household.id}>{household.name}</option>
        ))}
      </select>
    </label>
  );
}
