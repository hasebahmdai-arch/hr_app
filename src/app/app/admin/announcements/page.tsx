"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  useAdminDocuments,
  useCreateAdminDocument,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from "@/hooks/use-admin";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toastSuccess } from "@/lib/toast";

const emptyForm = { title: "", body: "", imageFileId: "" };

export default function AnnouncementsAdminPage() {
  const { data, isLoading, isError, refetch } = useAdminDocuments("announcements");
  const create = useCreateAdminDocument();
  const update = useUpdateAnnouncement();
  const remove = useDeleteAnnouncement();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(a: { _id: string; title: string; body: string; imageFileId?: string }) {
    setEditingId(a._id);
    setForm({ title: a.title, body: a.body, imageFileId: a.imageFileId ?? "" });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingId) {
        await update.mutateAsync({
          id: editingId,
          title: form.title,
          body: form.body,
          imageFileId: form.imageFileId || undefined,
          type: "general",
        });
        toastSuccess("Announcement updated");
      } else {
        await create.mutateAsync({ itemType: "announcement", ...form, type: "general" });
        toastSuccess("Announcement published");
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch {
      /* mutationCache toasts the error */
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this announcement?")) return;
    try {
      await remove.mutateAsync(id);
      toastSuccess("Announcement deleted");
    } catch {
      /* mutationCache toasts the error */
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        subtitle="Posts visible on the employee dashboard"
        action={
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) {
                setEditingId(null);
                setForm(emptyForm);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Add Announcement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Announcement" : "New Announcement"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  previewMode="image"
                  value={form.imageFileId || undefined}
                  onUploaded={(file) => setForm({ ...form, imageFileId: file._id })}
                  onClear={() => setForm({ ...form, imageFileId: "" })}
                />
                <LoadingButton type="submit" className="w-full" loading={saving}>
                  {editingId ? "Save" : "Publish"}
                </LoadingButton>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="space-y-4">
          {data?.announcements?.map((a) => (
            <Card key={a._id} className="border-0 shadow-card overflow-hidden">
              {a.imageFileId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files/${a.imageFileId}`}
                  alt=""
                  className="w-full max-h-56 object-cover"
                />
              ) : null}
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-base">{a.title}</CardTitle>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(a)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <LoadingButton
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600"
                    loading={remove.isPending && remove.variables === a._id}
                    onClick={() => handleDelete(a._id)}
                  >
                    {!(remove.isPending && remove.variables === a._id) && (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </LoadingButton>
                </div>
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
