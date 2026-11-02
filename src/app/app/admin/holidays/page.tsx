"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useCreateHoliday, useDeleteHoliday, useHolidaysAdmin } from "@/hooks/use-admin";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function HolidaysAdminPage() {
  const { data, isLoading, isError, refetch } = useHolidaysAdmin();
  const create = useCreateHoliday();
  const remove = useDeleteHoliday();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: "", name: "" });
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await create.mutateAsync({ date: form.date, name: form.name, isActive: true });
      setOpen(false);
      setForm({ date: "", name: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create holiday");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Holidays</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Holiday</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending ? "Creating..." : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((h) => (
            <Card key={h._id}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-base">{h.name}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(h._id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{h.date}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {!data?.length && <p className="text-center text-muted-foreground py-12">No holidays yet</p>}
      </QueryBoundary>
    </div>
  );
}
