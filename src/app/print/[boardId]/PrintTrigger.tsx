"use client";

import { useEffect } from "react";
import { Printer, X } from "lucide-react";

export default function PrintTrigger() {
  // Give fonts and layout a beat before the print dialog snapshots the page.
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 700);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="no-print sticky top-0 z-10 -mx-8 mb-6 flex items-center gap-2 border-b border-[#e5e5e5] bg-white/95 px-8 py-3 backdrop-blur">
      <p className="flex-1 text-xs text-[#555]">
        Choose <strong>Save as PDF</strong> as the destination in the print
        dialog.
      </p>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C5CFF] px-3 py-1.5 text-xs font-medium text-white"
      >
        <Printer className="size-3.5" />
        Print
      </button>
      <button
        onClick={() => window.close()}
        aria-label="Close"
        className="grid size-8 place-items-center rounded-lg text-[#666] hover:bg-[#f0f0f0]"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
