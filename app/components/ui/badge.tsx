import * as React from "react";
import clsx from "clsx";

export function NewBadge({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <span
      className={clsx(
        "ml-auto inline-block h-1.5 w-1.5 rounded-full bg-[#FA824C]"
      )}
      aria-label="New"
      title="New"
    />
  ) : (
    <span
      className={clsx(
        "ml-2 inline-flex items-center rounded-full bg-[#FA824C]/90 px-1.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-[#FA824C]"
      )}
    >
      New
    </span>
  );
}
