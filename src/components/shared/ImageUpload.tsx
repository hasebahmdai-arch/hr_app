"use client";

import { useCallback, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { FileText, Upload, X } from "lucide-react";
import { uploadFile } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { LoadingButton } from "@/components/ui/loading-button";

export type UploadedFileInfo = { _id: string; filename: string };

interface ImageUploadProps {
  bucket?: string;
  onUploaded: (file: UploadedFileInfo) => void;
  className?: string;
  label?: string;
  accept?: string;
  employeeId?: string;
  /** Controlled file id after upload */
  value?: string;
  /** Show image thumbnail when accept is image-like; otherwise show filename */
  previewMode?: "image" | "filename" | "auto";
  filename?: string;
  onClear?: () => void;
}

function isImageAccept(accept?: string) {
  if (!accept) return true;
  return accept.includes("image") && !accept.includes(".pdf") && !accept.includes("application/");
}

export function ImageUpload({
  bucket = "avatars",
  onUploaded,
  className,
  label = "Upload image",
  accept = "image/*",
  employeeId,
  value,
  previewMode = "auto",
  filename,
  onClear,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [localName, setLocalName] = useState(filename ?? "");

  const mode =
    previewMode === "auto"
      ? isImageAccept(accept) || bucket === "avatars" || bucket === "announcements"
        ? "image"
        : "filename"
      : previewMode;

  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      setUploading(true);
      try {
        const toUpload =
          file.type.startsWith("image/")
            ? await imageCompression(file, {
                maxSizeMB: 1,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
              })
            : file;
        const result = await uploadFile(
          toUpload,
          bucket,
          employeeId ? { employeeId } : undefined
        );
        setLocalName(result.filename || file.name);
        onUploaded({ _id: result._id, filename: result.filename || file.name });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [bucket, employeeId, onUploaded]
  );

  const displayName = filename || localName;

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <LoadingButton
          type="button"
          variant="outline"
          size="sm"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {!uploading && <Upload className="h-4 w-4 mr-2" />}
          {label}
        </LoadingButton>

        {value && mode === "image" && (
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/${value}`}
              alt="Upload preview"
              className="h-16 w-16 rounded-md border object-cover"
            />
            {onClear && (
              <button
                type="button"
                className="absolute -right-1.5 -top-1.5 rounded-full bg-background border p-0.5 shadow"
                onClick={onClear}
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {value && mode === "filename" && (
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-medium text-foreground">
              {displayName || "File attached"}
            </span>
            {onClear && (
              <button type="button" className="text-xs text-red-600 shrink-0" onClick={onClear}>
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
