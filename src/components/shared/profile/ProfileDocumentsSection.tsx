"use client";

import { useState } from "react";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateEmployeeDocument, useDeleteEmployeeDocument } from "@/hooks/use-profile";

interface EmployeeDocument {
  _id: string;
  fileId?: string;
  title?: string;
  type?: string;
}

export function ProfileDocumentsSection({
  employeeId,
  documents,
  canUpload,
}: {
  employeeId: string;
  documents: EmployeeDocument[];
  canUpload: boolean;
}) {
  const create = useCreateEmployeeDocument(employeeId);
  const remove = useDeleteEmployeeDocument(employeeId);
  const [title, setTitle] = useState("");
  const [fileId, setFileId] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  async function handleAdd() {
    setError("");
    if (!title.trim() || !fileId) {
      setError("Title and file are required");
      return;
    }
    try {
      await create.mutateAsync({ title: title.trim(), fileId, type: "general" });
      setTitle("");
      setFileId("");
      setFileName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save document");
    }
  }

  return (
    <div className="space-y-4">
      {documents.length ? (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d._id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
              <a
                href={d.fileId ? `/api/files/${d.fileId}` : "#"}
                target="_blank"
                rel="noopener"
                className="text-sm text-primary hover:underline truncate"
              >
                {d.title || "Document"}
              </a>
              {canUpload && (
                <LoadingButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 shrink-0"
                  loading={remove.isPending && remove.variables === d._id}
                  onClick={() => remove.mutate(d._id)}
                >
                  Remove
                </LoadingButton>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {canUpload ? "No documents uploaded yet" : "No documents available"}
        </p>
      )}

      {canUpload && (
        <div className="space-y-3 pt-2 border-t">
          <p className="text-sm font-medium">Upload document</p>
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. National ID, Contract"
            />
          </div>
          <div>
            <Label>File</Label>
            <ImageUpload
              bucket="documents"
              label="Choose file"
              previewMode="filename"
              value={fileId || undefined}
              filename={fileName || undefined}
              accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              employeeId={employeeId}
              onUploaded={(file) => {
                setFileId(file._id);
                setFileName(file.filename);
              }}
              onClear={() => {
                setFileId("");
                setFileName("");
              }}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <LoadingButton
            type="button"
            size="sm"
            loading={create.isPending}
            disabled={!title.trim() || !fileId}
            onClick={handleAdd}
          >
            Add Document
          </LoadingButton>
        </div>
      )}
    </div>
  );
}
