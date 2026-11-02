"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAdminDocuments, useCreateAdminDocument } from "@/hooks/use-admin";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AnnouncementsAdminPage() {
  const { data, isLoading, isError, refetch } = useAdminDocuments("announcements");
  const create = useCreateAdminDocument();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", imageFileId: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ itemType: "announcement", ...form, type: "general" });
    setOpen(false);
    setForm({ title: "", body: "", imageFileId: "" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        subtitle="Posts visible on the employee dashboard"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Announcement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Announcement</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Body</Label>
                  <textarea
                    className="w-full min-h-[100px] rounded-md border px-3 py-2 text-sm"
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    required
                  />
                </div>
                <ImageUpload
                  bucket="announcements"
                  onUploaded={(id) => setForm({ ...form, imageFileId: id })}
                />
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  {create.isPending ? "Publishing..." : "Publish"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="space-y-4">
          {data?.announcements?.map((a) => (
            <Card key={a._id} className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{a.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{a.body}</p>
              </CardContent>
            </Card>
          ))}
          {!data?.announcements?.length && (
            <p className="text-center text-muted-foreground py-8">No announcements yet</p>
          )}
        </div>
      </QueryBoundary>
    </div>
  );
}
