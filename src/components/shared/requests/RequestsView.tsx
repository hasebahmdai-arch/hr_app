"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, X } from "lucide-react";
import { format } from "date-fns";
import { useRequests, useCreateRequest, useRequestAction } from "@/hooks/use-requests";
import { REQUEST_STATUSES } from "@/lib/constants";
import type { RequestType } from "@/lib/constants";
import { REQUEST_LABELS } from "@/lib/navigation";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface RequestsViewProps {
  type: RequestType;
}

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

function nowLocalDatetimeMax() {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm");
}

export function RequestsView({ type }: RequestsViewProps) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const isHR = session?.user?.role === "hr";
  const urlStatus = searchParams.get("status");
  const [status, setStatus] = useState(urlStatus && REQUEST_STATUSES.includes(urlStatus as typeof REQUEST_STATUSES[number]) ? urlStatus : "ALL");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const { data, isLoading, isError, refetch } = useRequests(type, status, page);
  const create = useCreateRequest(type);
  const action = useRequestAction(type);

  const [form, setForm] = useState<Record<string, string>>(() => defaultForm(type));
  const [wfhDates, setWfhDates] = useState<string[]>([todayIso()]);

  useEffect(() => {
    if (urlStatus && REQUEST_STATUSES.includes(urlStatus as typeof REQUEST_STATUSES[number])) {
      setStatus(urlStatus);
      setPage(1);
    }
  }, [urlStatus]);

  useEffect(() => {
    if (modalOpen) {
      setForm(defaultForm(type));
      setWfhDates([todayIso()]);
      setFormError("");
    }
  }, [modalOpen, type]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    try {
      const body = buildCreateBody(type, form, wfhDates);
      await create.mutateAsync(body);
      setModalOpen(false);
      setForm(defaultForm(type));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to submit request");
    }
  }

  const actionBusy = action.isPending;
  const reasonRequired = type === "reimbursement";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-semibold">{REQUEST_LABELS[type]} Requests</h1>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />New</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New {REQUEST_LABELS[type]} Request</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <CreateFormFields
                type={type}
                form={form}
                setForm={setForm}
                wfhDates={wfhDates}
                setWfhDates={setWfhDates}
              />
              {type !== "loans" && (
                <div>
                  <Label>Reason {reasonRequired ? "" : "(optional)"}</Label>
                  <Input
                    value={form.reason ?? ""}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    required={reasonRequired}
                  />
                </div>
              )}
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ALL">All</TabsTrigger>
          {REQUEST_STATUSES.map((s) => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="space-y-3">
          {data?.items.map((req) => (
            <Card key={req._id}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-medium">{req.requestCode}</p>
                    {req.employee && isHR && (
                      <p className="text-sm text-muted-foreground">{req.employee.firstName} {req.employee.lastName}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{format(new Date(req.createdAt), "MMM d, yyyy")}</p>
                    {type === "loans" && typeof (req as unknown as { salaryCount?: number }).salaryCount === "number" && (
                      <p className="text-sm mt-1">
                        {(req as unknown as { salaryCount: number }).salaryCount}{" "}
                        {(req as unknown as { salaryCount: number }).salaryCount === 1 ? "salary" : "salaries"}
                        {(req as unknown as { purpose?: string }).purpose
                          ? ` · ${(req as unknown as { purpose: string }).purpose}`
                          : ""}
                      </p>
                    )}
                    {type === "reimbursement" && typeof (req as unknown as { amount?: number }).amount === "number" && (
                      <p className="text-sm mt-1">
                        Amount: {(req as unknown as { amount: number }).amount}
                        {(req as unknown as { reason?: string }).reason
                          ? ` · ${(req as unknown as { reason: string }).reason}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={req.status} />
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {isHR && req.status === "PENDING" && (
                    <>
                      <Button size="sm" onClick={() => action.mutate({ id: req._id, action: "approve" })} disabled={actionBusy}>
                        {actionBusy ? "Approving..." : "Approve"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => action.mutate({ id: req._id, action: "reject" })} disabled={actionBusy}>
                        {actionBusy ? "Rejecting..." : "Reject"}
                      </Button>
                    </>
                  )}
                  {isHR && req.status === "CANCELING" && (
                    <Button size="sm" onClick={() => action.mutate({ id: req._id, action: "approve" })} disabled={actionBusy}>
                      {actionBusy ? "Processing..." : "Approve Cancel"}
                    </Button>
                  )}
                  {!isHR && req.status === "PENDING" && (
                    <Button size="sm" variant="outline" onClick={() => action.mutate({ id: req._id, action: "request_cancel" })} disabled={actionBusy}>
                      {actionBusy ? "Submitting..." : "Request Cancel"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {!data?.items.length && <p className="text-center text-muted-foreground py-8">No requests found</p>}
        </div>
        {data && data.total > data.limit && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-sm self-center">Page {page}</span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / data.limit)} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}

function defaultForm(type: RequestType): Record<string, string> {
  if (type === "punch") return { punchType: "check_in", requestedTimestamp: "", reason: "" };
  if (type === "loans") return { salaryCount: "1", purpose: "", reason: "" };
  if (type === "reimbursement") return { amount: "", reason: "" };
  return { reason: "" };
}

function CreateFormFields({
  type,
  form,
  setForm,
  wfhDates,
  setWfhDates,
}: {
  type: RequestType;
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
  wfhDates: string[];
  setWfhDates: (d: string[]) => void;
}) {
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  const today = todayIso();
  const maxNow = nowLocalDatetimeMax();

  switch (type) {
    case "punch":
      return (
        <>
          <div>
            <Label>Punch Type</Label>
            <select
              className="w-full h-10 rounded-md border px-3 text-sm"
              value={form.punchType ?? "check_in"}
              onChange={(e) => set("punchType", e.target.value)}
              required
            >
              <option value="check_in">Check In</option>
              <option value="check_out">Check Out</option>
            </select>
          </div>
          <div>
            <Label>Requested Time</Label>
            <Input
              type="datetime-local"
              max={maxNow}
              value={form.requestedTimestamp ? format(new Date(form.requestedTimestamp), "yyyy-MM-dd'T'HH:mm") : ""}
              onChange={(e) => set("requestedTimestamp", e.target.value ? new Date(e.target.value).toISOString() : "")}
              required
            />
          </div>
        </>
      );
    case "leave":
      return (
        <>
          <div><Label>Leave Type</Label><Input value={form.leaveType ?? ""} onChange={(e) => set("leaveType", e.target.value)} required /></div>
          <div><Label>Start Date</Label><Input type="date" min={today} value={form.startDate ?? ""} onChange={(e) => set("startDate", e.target.value)} required /></div>
          <div><Label>End Date</Label><Input type="date" min={form.startDate || today} value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} required /></div>
        </>
      );
    case "reimbursement":
      return (
        <div>
          <Label>Amount</Label>
          <Input type="number" min="0.01" step="0.01" value={form.amount ?? ""} onChange={(e) => set("amount", e.target.value)} required />
        </div>
      );
    case "loans":
      return (
        <>
          <div>
            <Label>Number of salaries</Label>
            <select
              className="w-full h-10 rounded-md border px-3 text-sm"
              value={form.salaryCount ?? "1"}
              onChange={(e) => set("salaryCount", e.target.value)}
              required
            >
              <option value="1">1 salary</option>
              <option value="2">2 salaries</option>
              <option value="3">3 salaries</option>
            </select>
          </div>
          <div><Label>Purpose</Label><Input value={form.purpose ?? ""} onChange={(e) => set("purpose", e.target.value)} required /></div>
        </>
      );
    case "wfh":
      return (
        <div className="space-y-3">
          <Label>Dates (today or future)</Label>
          {wfhDates.map((d, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                type="date"
                min={today}
                value={d}
                onChange={(e) => {
                  const next = [...wfhDates];
                  next[i] = e.target.value;
                  setWfhDates(next);
                }}
                required
              />
              {wfhDates.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setWfhDates(wfhDates.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setWfhDates([...wfhDates, today])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add date
          </Button>
        </div>
      );
    default:
      return null;
  }
}

function buildCreateBody(
  type: RequestType,
  form: Record<string, string>,
  wfhDates: string[]
): Record<string, unknown> {
  switch (type) {
    case "punch":
      return {
        punchType: form.punchType || "check_in",
        requestedTimestamp: form.requestedTimestamp,
        reason: form.reason || undefined,
      };
    case "leave":
      return { leaveType: form.leaveType, startDate: form.startDate, endDate: form.endDate, reason: form.reason || undefined };
    case "reimbursement":
      return { amount: Number(form.amount), reason: form.reason };
    case "loans":
      return {
        salaryCount: Number(form.salaryCount),
        purpose: form.purpose,
      };
    case "wfh":
      return {
        dates: wfhDates.map((d) => d.trim()).filter(Boolean),
        reason: form.reason || undefined,
      };
    default:
      return form;
  }
}
