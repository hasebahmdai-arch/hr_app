"use client";

import { useSession } from "next-auth/react";
import { ResponsiveView } from "@/components/shared/ResponsiveView";
import { EmployeeDashboardWeb } from "@/components/web/dashboard/EmployeeDashboardWeb";
import { EmployeeDashboardMobile } from "@/components/mobile/dashboard/EmployeeDashboardMobile";
import { HrDashboardWeb } from "@/components/web/dashboard/HrDashboardWeb";
import { HrDashboardMobile } from "@/components/mobile/dashboard/HrDashboardMobile";

export default function DashboardPage() {
  const { data: session } = useSession();
  const isHR = session?.user?.role === "hr";

  return (
    <ResponsiveView
      web={isHR ? <HrDashboardWeb /> : <EmployeeDashboardWeb />}
      mobile={isHR ? <HrDashboardMobile /> : <EmployeeDashboardMobile />}
    />
  );
}
