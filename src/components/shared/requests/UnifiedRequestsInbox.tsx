"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { useRequestInbox } from "@/hooks/use-request-inbox";
import { useRequestAction } from "@/hooks/use-requests";
import { REQUEST_LABELS } from "@/lib/navigation";
import type { RequestType } from "@/lib/constants";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_TABS = [
  { value: "ATTENTION", label: "Needs attention" },
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CANCELING", label: "Canceling" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
];

function InboxRowActions({ type, id, status }: { type: RequestType; id: string; status: string }) {
  const action = useRequestAction(type);

  if (status === "PENDING") {
    return (
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={() => action.mutate({ id, action: "approve" })} disabled={action.isPending}>Approve</Button>
        <Button size="sm" variant="destructive" onClick={() => action.mutate({ id, action: "reject" })} disabled={action.isPending}>Reject</Button>
      </div>
    );
  }
  if (status === "CANCELING") {
    return (
      <Button size="sm" onClick={() => action.mutate({ id, action: "approve" })} disabled={action.isPending}>Approve Cancel</Button>
    );
  }
  return null;
}

export function UnifiedRequestsInbox() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") === "CANCELING" ? "CANCELING" : searchParams.get("status") === "PENDING" ? "ATTENTION" : "ATTENTION";
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useRequestInbox(status, page);

  useEffect(() => {
    const s = searchParams.get("status");
    if (s === "PENDING" || s === "CANCELING") setStatus(s === "CANCELING" ? "CANCELING" : "ATTENTION");
  }, [searchParams]);

  return (
    <div className="space-y-4">
      <PageHeader title="Requests" subtitle="All employee requests in one place" />

      <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
        <TabsList className="flex-wrap h-auto">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="border rounded-xl overflow-hidden bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted-bg">
              <tr>
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-left p-3 font-medium">Employee</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((row) => (
                <tr key={`${row.type}-${row._id}`} className="border-t even:bg-muted-bg/30">
                  <td className="p-3 font-mono text-xs">{row.requestCode}</td>
                  <td className="p-3">
                    <Link href={`/app/people/${row.employeeId}`} className="hover:text-primary">{row.employeeName}</Link>
                  </td>
                  <td className="p-3">{REQUEST_LABELS[row.type as RequestType] ?? row.type}</td>
                  <td className="p-3"><StatusBadge status={row.status} /></td>
                  <td className="p-3 text-muted-foreground">{format(new Date(row.createdAt), "MMM d, yyyy")}</td>
                  <td className="p-3">
                    <InboxRowActions type={row.type as RequestType} id={row._id} status={row.status} />
                  </td>
                </tr>
              ))}
              {!data?.items.length && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No requests found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {data && data.total > data.limit && (
          <div className="flex justify-center gap-2 mt-4">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-sm self-center">Page {page} of {Math.ceil(data.total / data.limit)}</span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / data.limit)} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
