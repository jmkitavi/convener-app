"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { setDataScope } from "@/lib/data-scope";

export function ScopeControls({ scope }: { scope: "ndc" | "all" }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function changeScope(nextScope: "ndc" | "all") {
    if (nextScope === scope || pending) return;
    setError("");
    startTransition(async () => {
      try {
        await setDataScope(nextScope);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("scope");
        router.replace(`${pathname}${params.size ? `?${params}` : ""}${window.location.hash}`, { scroll: false });
      } catch {
        setError("Could not save results scope. Please retry.");
      }
    });
  }

  return (
    <div>
    <div className="scope-controls" role="group" aria-label="Results scope" aria-busy={pending}>
      <button
        type="button"
        aria-pressed={scope === "ndc"}
        disabled={pending}
        onClick={() => changeScope("ndc")}
      >
        NDC only
      </button>
      <button
        type="button"
        aria-pressed={scope === "all"}
        disabled={pending}
        onClick={() => changeScope("all")}
      >
        All (internal)
      </button>
    </div>
    {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
