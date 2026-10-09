import mongoose from "mongoose";
import connectDB from "@/lib/db";

export type GridFSBucketName = "avatars" | "documents" | "receipts" | "announcements";

export async function getGridFSBucket(bucketName: GridFSBucketName) {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");
  return new mongoose.mongo.GridFSBucket(db, { bucketName });
}

export async function uploadToGridFS(
  bucketName: GridFSBucketName,
  buffer: Buffer,
  filename: string,
  metadata?: Record<string, unknown>
) {
  const bucket = await getGridFSBucket(bucketName);
  return new Promise<mongoose.Types.ObjectId>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, { metadata });
    uploadStream.end(buffer);
    uploadStream.on("finish", () => resolve(uploadStream.id as mongoose.Types.ObjectId));
    uploadStream.on("error", reject);
  });
}

export async function downloadFromGridFS(bucketName: GridFSBucketName, gridFsId: mongoose.Types.ObjectId) {
  const bucket = await getGridFSBucket(bucketName);
  return bucket.openDownloadStream(gridFsId);
}

export async function deleteFromGridFS(bucketName: GridFSBucketName, gridFsId: mongoose.Types.ObjectId) {
  const bucket = await getGridFSBucket(bucketName);
  await bucket.delete(gridFsId);
}
