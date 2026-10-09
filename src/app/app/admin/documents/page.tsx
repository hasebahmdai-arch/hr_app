"use client";

import { useState } from "react";
import { useAdminDocuments, useCreateAdminDocument } from "@/hooks/use-admin";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export default function DocumentsAdminPage() {
  const { data, isLoading, isError, refetch } = useAdminDocuments();
  const create = useCreateAdminDocument();
  const [docOpen, setDocOpen] = useState(false);
  const [annOpen, setAnnOpen] = useState(false);
  const [docForm, setDocForm] = useState({ title: "", fileId: "", category: "" });
  const [annForm, setAnnForm] = useState({ title: "", body: "", imageFileId: "" });

  async function handleDocCreate(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ itemType: "document", ...docForm });
    setDocOpen(false);
    setDocForm({ title: "", fileId: "", category: "" });
  }

  async function handleAnnCreate(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ itemType: "announcement", ...annForm, type: "general" });
    setAnnOpen(false);
    setAnnForm({ title: "", body: "", imageFileId: "" });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Documents & Announcements</h1>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <Tabs defaultValue="documents">
          <TabsList>
            <TabsTrigger value="documents">Company Documents</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={docOpen} onOpenChange={setDocOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Document</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Document</DialogTitle></DialogHeader>
                  <form onSubmit={handleDocCreate} className="space-y-4">
                    <div><Label>Title</Label><Input value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} required /></div>
                    <div><Label>Category</Label><Input value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })} /></div>
                    <div>
                      <Label>File</Label>
                      {docForm.fileId ? <p className="text-sm text-green-600">Uploaded</p> : null}
                      <ImageUpload bucket="documents" label="Upload document" accept="*/*" onUploaded={(id) => setDocForm({ ...docForm, fileId: id })} />
                    </div>
                    <Button type="submit" className="w-full" disabled={create.isPending || !docForm.fileId}>
                      {create.isPending ? "Saving..." : "Create"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {data?.companyDocuments?.map((d) => (
                <Card key={d._id}>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{d.title}</CardTitle></CardHeader>
                  <CardContent>
                    {d.category && <p className="text-sm text-muted-foreground">{d.category}</p>}
                    {d.fileId && <a href={`/api/files/${d.fileId}`} target="_blank" rel="noopener" className="text-sm text-primary hover:underline">View file</a>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="announcements" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={annOpen} onOpenChange={setAnnOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Announcement</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
                  <form onSubmit={handleAnnCreate} className="space-y-4">
                    <div><Label>Title</Label><Input value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} required /></div>
                    <div><Label>Body</Label><textarea className="w-full min-h-[100px] rounded-md border px-3 py-2 text-sm" value={annForm.body} onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })} required /></div>
                    <ImageUpload bucket="announcements" onUploaded={(id) => setAnnForm({ ...annForm, imageFileId: id })} />
                    <Button type="submit" className="w-full" disabled={create.isPending}>
                      {create.isPending ? "Publishing..." : "Publish"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-4">
              {data?.announcements?.map((a) => (
                <Card key={a._id}>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{a.title}</CardTitle></CardHeader>
                  <CardContent><p className="text-sm">{a.body}</p></CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </QueryBoundary>
    </div>
  );
}
