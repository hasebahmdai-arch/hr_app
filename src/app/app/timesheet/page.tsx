"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ResponsiveView } from "@/components/shared/ResponsiveView";
import { TimesheetWeb } from "@/components/web/timesheet/TimesheetWeb";
import { TimesheetMobile } from "@/components/mobile/timesheet/TimesheetMobile";

function TimesheetFallback() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

export default function TimesheetPage() {
  return (
    <Suspense fallback={<TimesheetFallback />}>
      <ResponsiveView web={<TimesheetWeb />} mobile={<TimesheetMobile />} />
    </Suspense>
  );
}
