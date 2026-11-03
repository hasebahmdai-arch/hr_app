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
import { LoadingButton } from "@/components/ui/loading-button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
];

function InboxRowActions({ type, id, status }: { type: RequestType; id: string; status: string }) {
  const action = useRequestAction(type);

  const loadingAction = (act: string) =>
    action.isPending && action.variables?.action === act;

  if (status === "PENDING") {
    return (
      <div className="flex gap-2 flex-wrap">
        <LoadingButton
          size="sm"
          loading={loadingAction("approve")}
          disabled={action.isPending && !loadingAction("approve")}
          onClick={() => action.mutate({ id, action: "approve" })}
        >
          Approve
        </LoadingButton>
        <LoadingButton
          size="sm"
          variant="destructive"
          loading={loadingAction("reject")}
          disabled={action.isPending && !loadingAction("reject")}
          onClick={() => action.mutate({ id, action: "reject" })}
        >
          Reject
        </LoadingButton>
      </div>
    );
  }
  if (status === "CANCELING") {
    return (
      <LoadingButton
        size="sm"
        loading={loadingAction("approve")}
        onClick={() => action.mutate({ id, action: "approve" })}
      >
        Approve Cancel
      </LoadingButton>
    );
  }
  return null;
}

function RowDetails({
  row,
}: {
  row: {
    type: string;
    reason?: string;
    summary?: string;
    employeeId: string;
    employeeName: string;
    requestCode: string;
    status: string;
    createdAt: string;
    _id: string;
  };
}) {
  return (
    <>
      <div className="flex justify-between gap-2 items-start">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{row.requestCode}</p>
          <Link href={`/app/people/${row.employeeId}`} className="font-medium hover:text-primary">
            {row.employeeName}
          </Link>
          <p className="text-sm text-muted-foreground">
            {REQUEST_LABELS[row.type as RequestType] ?? row.type}
            {row.summary ? ` · ${row.summary}` : ""}
          </p>
          {row.reason ? (
            <p className="text-sm mt-1 line-clamp-2" title={row.reason}>
              {row.reason}
            </p>
          ) : null}
        </div>
        <StatusBadge status={row.status} />
      </div>
      <div className="flex items-center justify-between gap-2 mt-3">
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.createdAt), "MMM d, yyyy")}
        </span>
        <InboxRowActions type={row.type as RequestType} id={row._id} status={row.status} />
      </div>
    </>
  );
}

export function UnifiedRequestsInbox() {
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get("status");
  const initialStatus =
    urlStatus === "COMPLETED" ||
    urlStatus === "REJECTED" ||
    urlStatus === "PENDING" ||
    urlStatus === "CANCELING"
      ? urlStatus === "CANCELING"
        ? "PENDING"
        : urlStatus
      : "PENDING";
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useRequestInbox(status, page);

  useEffect(() => {
    const s = searchParams.get("status");
    if (s === "PENDING" || s === "COMPLETED" || s === "REJECTED") setStatus(s);
    if (s === "CANCELING") setStatus("PENDING");
  }, [searchParams]);

  return (
    <div className="space-y-4">
      <PageHeader title="Requests" subtitle="All employee requests in one place" />

      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      >
        <TabsList className="flex-wrap h-auto">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="hidden lg:block border rounded-xl overflow-hidden bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted-bg">
              <tr>
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-left p-3 font-medium">Employee</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Details</th>
                <th className="text-left p-3 font-medium">Reason</th>
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
                    <Link href={`/app/people/${row.employeeId}`} className="hover:text-primary">
                      {row.employeeName}
                    </Link>
                  </td>
                  <td className="p-3">{REQUEST_LABELS[row.type as RequestType] ?? row.type}</td>
                  <td className="p-3 text-muted-foreground max-w-[180px] truncate" title={row.summary}>
                    {row.summary || "—"}
                  </td>
                  <td
                    className="p-3 text-muted-foreground max-w-[180px] truncate"
                    title={row.reason ?? undefined}
                  >
                    {row.reason || "—"}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {format(new Date(row.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="p-3">
                    <InboxRowActions
                      type={row.type as RequestType}
                      id={row._id}
                      status={row.status}
                    />
                  </td>
                </tr>
              ))}
              {!data?.items.length && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden space-y-3">
          {data?.items.map((row) => (
            <Card key={`${row.type}-${row._id}`} className="border-0 shadow-card">
              <CardContent className="pt-4">
                <RowDetails row={row} />
              </CardContent>
            </Card>
          ))}
          {!data?.items.length && (
            <p className="text-center text-muted-foreground py-8">No requests found</p>
          )}
        </div>

        {data && data.total > data.limit && (
          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm self-center">
              Page {page} of {Math.ceil(data.total / data.limit)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(data.total / data.limit)}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
