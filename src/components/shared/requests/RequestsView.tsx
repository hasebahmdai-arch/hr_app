"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
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

  useEffect(() => {
    if (urlStatus && REQUEST_STATUSES.includes(urlStatus as typeof REQUEST_STATUSES[number])) {
      setStatus(urlStatus);
      setPage(1);
    }
  }, [urlStatus]);

  useEffect(() => {
    if (modalOpen) {
      setForm(defaultForm(type));
      setFormError("");
    }
  }, [modalOpen, type]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    try {
      const body = buildCreateBody(type, form);
      await create.mutateAsync(body);
      setModalOpen(false);
      setForm(defaultForm(type));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to submit request");
    }
  }

  const actionBusy = action.isPending;

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
              <CreateFormFields type={type} form={form} setForm={setForm} />
              <div>
                <Label>Reason (optional)</Label>
                <Input value={form.reason ?? ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
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
  return { reason: "" };
}

function CreateFormFields({ type, form, setForm }: { type: RequestType; form: Record<string, string>; setForm: (f: Record<string, string>) => void }) {
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
    case "expense":
      return (
        <>
          <div><Label>Amount</Label><Input type="number" min="0.01" step="0.01" value={form.amount ?? ""} onChange={(e) => set("amount", e.target.value)} required /></div>
          <div><Label>Category</Label><Input value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} required /></div>
        </>
      );
    case "loans":
      return (
        <>
          <div><Label>Amount</Label><Input type="number" min="0.01" step="0.01" value={form.amount ?? ""} onChange={(e) => set("amount", e.target.value)} required /></div>
          <div><Label>Purpose</Label><Input value={form.purpose ?? ""} onChange={(e) => set("purpose", e.target.value)} required /></div>
        </>
      );
    case "wfh":
      return <div><Label>Dates (comma-separated YYYY-MM-DD, today or future)</Label><Input value={form.dates ?? ""} onChange={(e) => set("dates", e.target.value)} placeholder={`${today}, ${today}`} required /></div>;
    case "official-duty":
      return (
        <>
          <div><Label>Location</Label><Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} required /></div>
          <div><Label>Dates (comma-separated YYYY-MM-DD, today or future)</Label><Input value={form.dates ?? ""} onChange={(e) => set("dates", e.target.value)} required /></div>
        </>
      );
    case "relaxation":
      return (
        <>
          <div><Label>Date</Label><Input type="date" max={today} value={form.date ?? ""} onChange={(e) => set("date", e.target.value)} required /></div>
          <div><Label>Type</Label><Input value={form.type ?? ""} onChange={(e) => set("type", e.target.value)} required /></div>
          <div><Label>Minutes</Label><Input type="number" min="1" value={form.minutes ?? ""} onChange={(e) => set("minutes", e.target.value)} required /></div>
        </>
      );
    case "travel":
      return (
        <>
          <div><Label>Destination</Label><Input value={form.destination ?? ""} onChange={(e) => set("destination", e.target.value)} required /></div>
          <div><Label>Dates (comma-separated YYYY-MM-DD, today or future)</Label><Input value={form.dates ?? ""} onChange={(e) => set("dates", e.target.value)} required /></div>
          <div><Label>Purpose</Label><Input value={form.purpose ?? ""} onChange={(e) => set("purpose", e.target.value)} /></div>
        </>
      );
    default:
      return null;
  }
}

function buildCreateBody(type: RequestType, form: Record<string, string>): Record<string, unknown> {
  switch (type) {
    case "punch":
      return {
        punchType: form.punchType || "check_in",
        requestedTimestamp: form.requestedTimestamp,
        reason: form.reason || undefined,
      };
    case "leave":
      return { leaveType: form.leaveType, startDate: form.startDate, endDate: form.endDate, reason: form.reason || undefined };
    case "expense":
      return { amount: Number(form.amount), category: form.category, reason: form.reason || undefined };
    case "loans":
      return { amount: Number(form.amount), purpose: form.purpose, reason: form.reason || undefined };
    case "wfh":
      return { dates: (form.dates ?? "").split(",").map((d) => d.trim()).filter(Boolean), reason: form.reason || undefined };
    case "official-duty":
      return { location: form.location, dates: (form.dates ?? "").split(",").map((d) => d.trim()).filter(Boolean), reason: form.reason || undefined };
    case "relaxation":
      return { date: form.date, type: form.type, minutes: Number(form.minutes), reason: form.reason || undefined };
    case "travel":
      return {
        destination: form.destination,
        dates: (form.dates ?? "").split(",").map((d) => d.trim()).filter(Boolean),
        purpose: form.purpose || undefined,
        reason: form.reason || undefined,
      };
    default:
      return form;
  }
}
