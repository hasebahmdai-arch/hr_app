import { apiError, apiSuccess } from "@/lib/api-response";
import { requireHR } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Document, Employee, FileMetadata } from "@/lib/models";
import { handleRouteError } from "@/lib/route-utils";
import { z } from "zod";

const createDocumentSchema = z.object({
  fileId: z.string().min(1),
  title: z.string().min(1),
  type: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    const employeeId = params.id;

    const body = await req.json();
    const parsed = createDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid document data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    const employee = await Employee.findById(employeeId);
    if (!employee) return apiError("Employee not found", "NOT_FOUND", 404);

    const file = await FileMetadata.findById(parsed.data.fileId);
    if (!file) return apiError("File not found", "NOT_FOUND", 404);
    if (file.bucket !== "documents") {
      return apiError("File must be in the documents bucket", "VALIDATION_ERROR", 400);
    }

    const doc = await Document.create({
      employeeId,
      fileId: parsed.data.fileId,
      title: parsed.data.title,
      type: parsed.data.type || "general",
    });

    return apiSuccess(
      {
        _id: doc._id.toString(),
        employeeId,
        fileId: parsed.data.fileId,
        title: doc.title,
        type: doc.type,
      },
      201
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireHR();
    const employeeId = params.id;

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");
    if (!documentId) {
      return apiError("documentId is required", "VALIDATION_ERROR", 400);
    }

    await connectDB();
    const doc = await Document.findOne({ _id: documentId, employeeId });
    if (!doc) return apiError("Document not found", "NOT_FOUND", 404);

    await Document.deleteOne({ _id: documentId });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
