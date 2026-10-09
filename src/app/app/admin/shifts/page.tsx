"use client";

import { useState } from "react";
import { useShifts, useCreateShift } from "@/hooks/use-admin";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export default function ShiftsAdminPage() {
  const { data, isLoading, isError, refetch } = useShifts();
  const create = useCreateShift();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", startTime: "09:00", endTime: "18:00", breakMinutes: "60" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      name: form.name,
      code: form.code,
      startTime: form.startTime,
      endTime: form.endTime,
      breakMinutes: Number(form.breakMinutes),
      isActive: true,
    });
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shifts</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Shift</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Start</Label><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required /></div>
                <div><Label>End</Label><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required /></div>
              </div>
              <div><Label>Break (minutes)</Label><Input type="number" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending ? "Creating..." : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((s) => (
            <Card key={s._id}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{s.name}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm">{s.startTime} – {s.endTime}</p>
                <p className="text-sm text-muted-foreground">Break: {s.breakMinutes ?? 60} min</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </QueryBoundary>
    </div>
  );
}
