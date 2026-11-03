"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, X } from "lucide-react";
import { format } from "date-fns";
import { useRequests, useCreateRequest, useRequestAction } from "@/hooks/use-requests";
import type { RequestType } from "@/lib/constants";
import { REQUEST_LABELS } from "@/lib/navigation";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";

const REQUEST_TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
] as const;

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
  const initialTab = REQUEST_TABS.some((t) => t.value === urlStatus) ? urlStatus! : "PENDING";
  const [status, setStatus] = useState(initialTab);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const { data, isLoading, isError, refetch } = useRequests(type, status, page);
  const create = useCreateRequest(type);
  const action = useRequestAction(type);

  const [form, setForm] = useState<Record<string, string>>(() => defaultForm(type));
  const [wfhDates, setWfhDates] = useState<string[]>([todayIso()]);

  useEffect(() => {
    if (urlStatus && REQUEST_TABS.some((t) => t.value === urlStatus)) {
      setStatus(urlStatus);
      setPage(1);
    }
  }, [urlStatus]);

  useEffect(() => {
    if (modalOpen && !editingId) {
      setForm(defaultForm(type));
      setWfhDates([todayIso()]);
      setFormError("");
    }
  }, [modalOpen, type, editingId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    try {
      const body = buildCreateBody(type, form, wfhDates);
      if (editingId) {
        await action.mutateAsync({ id: editingId, action: "update", fields: body });
      } else {
        await create.mutateAsync(body);
      }
      setModalOpen(false);
      setEditingId(null);
      setForm(defaultForm(type));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to submit request");
    }
  }

  function openEdit(req: Record<string, unknown>) {
    setEditingId(String(req._id));
    setForm(formFromRequest(type, req));
    if (type === "wfh" && Array.isArray(req.dates)) {
      setWfhDates(
        (req.dates as (string | Date)[]).map((d) => format(new Date(d), "yyyy-MM-dd"))
      );
    }
    setFormError("");
    setModalOpen(true);
  }

  const actionBusy = action.isPending;
  const actionFor = (id: string, act: string) =>
    action.isPending && action.variables?.id === id && action.variables?.action === act;
  const reasonRequired = type === "reimbursement";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-semibold">{REQUEST_LABELS[type]} Requests</h1>
        <Dialog
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) setEditingId(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />New</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit" : "New"} {REQUEST_LABELS[type]} Request
              </DialogTitle>
            </DialogHeader>
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
              <LoadingButton
                type="submit"
                className="w-full"
                loading={
                  create.isPending ||
                  (editingId
                    ? actionFor(editingId, "update")
                    : false)
                }
              >
                {editingId ? "Save changes" : "Submit Request"}
              </LoadingButton>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
        <TabsList className="flex-wrap h-auto">
          {REQUEST_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
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
                        {(req as unknown as { expenseDate?: string }).expenseDate
                          ? ` · ${format(new Date((req as unknown as { expenseDate: string }).expenseDate), "MMM d, yyyy h:mm a")}`
                          : ""}
                      </p>
                    )}
                    {type === "leave" && (
                      <p className="text-sm mt-1">
                        {(req as unknown as { leaveType?: string }).leaveType ?? "Leave"}
                        {(req as unknown as { startDate?: string }).startDate
                          ? ` · ${format(new Date((req as unknown as { startDate: string }).startDate), "MMM d")}`
                          : ""}
                        {(req as unknown as { endDate?: string }).endDate
                          ? ` – ${format(new Date((req as unknown as { endDate: string }).endDate), "MMM d, yyyy")}`
                          : ""}
                      </p>
                    )}
                    {type === "wfh" && Array.isArray((req as unknown as { dates?: string[] }).dates) && (
                      <p className="text-sm mt-1">
                        {(req as unknown as { dates: string[] }).dates
                          .map((d) => format(new Date(d), "MMM d"))
                          .join(", ")}
                      </p>
                    )}
                    {type === "punch" && (req as unknown as { punchType?: string }).punchType && (
                      <p className="text-sm mt-1">
                        {(req as unknown as { punchType: string }).punchType === "check_out"
                          ? "Check out"
                          : "Check in"}
                        {(req as unknown as { requestedTimestamp?: string }).requestedTimestamp
                          ? ` · ${format(new Date((req as unknown as { requestedTimestamp: string }).requestedTimestamp), "MMM d, h:mm a")}`
                          : ""}
                      </p>
                    )}
                    {(req as unknown as { reason?: string }).reason ? (
                      <p className="text-sm mt-1 text-muted-foreground">
                        Reason: {(req as unknown as { reason: string }).reason}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={req.status} />
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {isHR && req.status === "PENDING" && (
                    <>
                      <LoadingButton
                        size="sm"
                        loading={actionFor(req._id, "approve")}
                        disabled={actionBusy && !actionFor(req._id, "approve")}
                        onClick={() => action.mutate({ id: req._id, action: "approve" })}
                      >
                        Approve
                      </LoadingButton>
                      <LoadingButton
                        size="sm"
                        variant="destructive"
                        loading={actionFor(req._id, "reject")}
                        disabled={actionBusy && !actionFor(req._id, "reject")}
                        onClick={() => action.mutate({ id: req._id, action: "reject" })}
                      >
                        Reject
                      </LoadingButton>
                    </>
                  )}
                  {isHR && req.status === "CANCELING" && (
                    <LoadingButton
                      size="sm"
                      loading={actionFor(req._id, "approve")}
                      disabled={actionBusy && !actionFor(req._id, "approve")}
                      onClick={() => action.mutate({ id: req._id, action: "approve" })}
                    >
                      Approve Cancel
                    </LoadingButton>
                  )}
                  {!isHR && req.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(req as unknown as Record<string, unknown>)}
                        disabled={actionBusy}
                      >
                        Edit
                      </Button>
                      <LoadingButton
                        size="sm"
                        variant="outline"
                        loading={actionFor(req._id, "request_cancel")}
                        disabled={actionBusy && !actionFor(req._id, "request_cancel")}
                        onClick={() => action.mutate({ id: req._id, action: "request_cancel" })}
                      >
                        Request Cancel
                      </LoadingButton>
                    </>
                  )}
                  {!isHR && req.status === "COMPLETED" && (type === "punch" || type === "leave" || type === "wfh") && (
                    <LoadingButton
                      size="sm"
                      variant="outline"
                      loading={actionFor(req._id, "request_cancel")}
                      disabled={actionBusy && !actionFor(req._id, "request_cancel")}
                      onClick={() => action.mutate({ id: req._id, action: "request_cancel" })}
                    >
                      Request Cancel
                    </LoadingButton>
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
  if (type === "reimbursement") return { amount: "", expenseDate: new Date().toISOString(), reason: "" };
  if (type === "leave") return { leaveType: "Casual", startDate: todayIso(), endDate: todayIso(), reason: "" };
  return { reason: "" };
}

function formFromRequest(type: RequestType, req: Record<string, unknown>): Record<string, string> {
  const base = defaultForm(type);
  base.reason = typeof req.reason === "string" ? req.reason : "";
  if (type === "punch") {
    base.punchType = String(req.punchType ?? "check_in");
    base.requestedTimestamp = req.requestedTimestamp
      ? new Date(req.requestedTimestamp as string).toISOString()
      : "";
  } else if (type === "leave") {
    base.leaveType = String(req.leaveType ?? "Casual");
    base.startDate = req.startDate ? format(new Date(req.startDate as string), "yyyy-MM-dd") : todayIso();
    base.endDate = req.endDate ? format(new Date(req.endDate as string), "yyyy-MM-dd") : todayIso();
  } else if (type === "reimbursement") {
    base.amount = String(req.amount ?? "");
    base.expenseDate = req.expenseDate
      ? new Date(req.expenseDate as string).toISOString()
      : new Date().toISOString();
  } else if (type === "loans") {
    base.salaryCount = String(req.salaryCount ?? "1");
    base.purpose = String(req.purpose ?? "");
  }
  return base;
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
      return <LeaveFormFields form={form} set={set} today={today} />;
    case "reimbursement":
      return (
        <>
          <div>
            <Label>Amount</Label>
            <Input type="number" min="0.01" step="0.01" value={form.amount ?? ""} onChange={(e) => set("amount", e.target.value)} required />
          </div>
          <div>
            <Label>Expense date & time</Label>
            <Input
              type="datetime-local"
              max={maxNow}
              value={form.expenseDate ? format(new Date(form.expenseDate), "yyyy-MM-dd'T'HH:mm") : ""}
              onChange={(e) => set("expenseDate", e.target.value ? new Date(e.target.value).toISOString() : "")}
              required
            />
          </div>
        </>
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
      return <WfhFormFields wfhDates={wfhDates} setWfhDates={setWfhDates} today={today} />;
    default:
      return null;
  }
}

function useLeaveBalancesMe() {
  return useQuery({
    queryKey: ["leave-balances", "me"],
    queryFn: () =>
      fetcher<{
        balances: { leaveType: string; remaining: number; available: number; entitled: number }[];
      }>("/api/leave-balances/me"),
  });
}

function LeaveFormFields({
  form,
  set,
  today,
}: {
  form: Record<string, string>;
  set: (k: string, v: string) => void;
  today: string;
}) {
  const { data } = useLeaveBalancesMe();
  const selected = data?.balances.find((b) => b.leaveType === (form.leaveType || "Casual"));

  return (
    <>
      <div>
        <Label>Leave Type</Label>
        <select
          className="w-full h-10 rounded-md border px-3 text-sm"
          value={form.leaveType ?? "Casual"}
          onChange={(e) => set("leaveType", e.target.value)}
          required
        >
          <option value="Sick">Sick</option>
          <option value="Casual">Casual</option>
        </select>
        {selected && (
          <p className="text-xs text-muted-foreground mt-1">
            Available: {selected.available} of {selected.entitled} days
          </p>
        )}
      </div>
      <div>
        <Label>Start Date</Label>
        <Input type="date" min={today} value={form.startDate ?? ""} onChange={(e) => set("startDate", e.target.value)} required />
      </div>
      <div>
        <Label>End Date</Label>
        <Input type="date" min={form.startDate || today} value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} required />
      </div>
    </>
  );
}

function WfhFormFields({
  wfhDates,
  setWfhDates,
  today,
}: {
  wfhDates: string[];
  setWfhDates: (d: string[]) => void;
  today: string;
}) {
  const { data } = useLeaveBalancesMe();
  const wfh = data?.balances.find((b) => b.leaveType === "WFH");

  return (
    <div className="space-y-3">
      {wfh && (
        <p className="text-xs text-muted-foreground">
          WFH available: {wfh.available} of {wfh.entitled} days
        </p>
      )}
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
      return { amount: Number(form.amount), expenseDate: form.expenseDate, reason: form.reason };
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
