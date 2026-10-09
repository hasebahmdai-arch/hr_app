"use client";

import { ResponsiveView } from "@/components/shared/ResponsiveView";
import { TimesheetWeb } from "@/components/web/timesheet/TimesheetWeb";
import { TimesheetMobile } from "@/components/mobile/timesheet/TimesheetMobile";

export default function TimesheetPage() {
  return <ResponsiveView web={<TimesheetWeb />} mobile={<TimesheetMobile />} />;
}
