import { apiError, apiSuccess } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import { notify } from "@/lib/notifications";
import { REQUEST_MODELS } from "@/lib/models";
import { generateRequestCode } from "@/lib/request-code";
import { handleRouteError, parsePagination } from "@/lib/route-utils";
import { createRequestBodySchema, requestTypeSchema } from "@/lib/validations";
import type { RequestType } from "@/lib/constants";
import type { PaginatedResponse } from "@/types/api";

export async function GET(req: Request, { params }: { params: { type: string } }) {
  try {
    const session = await requireSession();
    const typeResult = requestTypeSchema.safeParse(params.type);
    if (!typeResult.success) {
      return apiError("Invalid request type", "VALIDATION_ERROR", 400);
    }

    const Model = REQUEST_MODELS[typeResult.data];
    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const status = searchParams.get("status");

    const filter: Record<string, unknown> = {};
    if (session.user.role !== "hr") {
      filter.employeeId = session.user.id;
    } else {
      const employeeId = searchParams.get("employeeId");
      if (employeeId) filter.employeeId = employeeId;
    }
    if (status) filter.status = status;

    await connectDB();
    const [items, total] = await Promise.all([
      Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("employeeId", "firstName lastName employeeCode").lean(),
      Model.countDocuments(filter),
    ]);

    const response: PaginatedResponse<Record<string, unknown>> = {
      items: items.map((item) => serializeRequest(item as Record<string, unknown>)),
      total,
      page,
      limit,
    };

    return apiSuccess(response);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request, { params }: { params: { type: string } }) {
  try {
    const session = await requireSession();
    const typeResult = requestTypeSchema.safeParse(params.type);
    if (!typeResult.success) {
      return apiError("Invalid request type", "VALIDATION_ERROR", 400);
    }

    const type = typeResult.data as RequestType;
    const body = await req.json();
    const schema = createRequestBodySchema(type);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid request data", "VALIDATION_ERROR", 400, parsed.error.issues);
    }

    await connectDB();
    const requestCode = await generateRequestCode(type);
    const Model = REQUEST_MODELS[type];
    const data = transformCreateData(type, parsed.data);

    const created = await Model.create({
      ...data,
      requestCode,
      employeeId: session.user.id,
      status: "PENDING",
    });

    await notify({
      type: `${type.toUpperCase().replace(/-/g, "_")}_REQUEST`,
      title: "New request submitted",
      body: `A new ${type.replace(/-/g, " ")} request (${requestCode}) was submitted and is waiting for review.\n\nOpen the inbox to approve or reject it.`,
      hrBroadcast: true,
      forceEmail: true,
      href: `/app/requests/${type}?status=PENDING`,
      ctaLabel: "Review request",
    });

    return apiSuccess(serializeRequest(created.toObject()), 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

function transformCreateData(type: RequestType, data: Record<string, unknown>) {
  const result = { ...data };
  if (type === "punch" && data.requestedTimestamp) {
    result.requestedTimestamp = new Date(data.requestedTimestamp as string);
  }
  if (type === "leave") {
    result.startDate = new Date(data.startDate as string);
    result.endDate = new Date(data.endDate as string);
  }
  if (["wfh", "official-duty", "travel"].includes(type) && Array.isArray(data.dates)) {
    result.dates = (data.dates as string[]).map((d) => new Date(d));
  }
  if (type === "relaxation" && data.date) {
    result.date = new Date(data.date as string);
  }
  return result;
}

function serializeRequest(item: Record<string, unknown>) {
  const employee = item.employeeId as Record<string, unknown> | undefined;
  return {
    ...item,
    _id: (item._id as { toString(): string }).toString(),
    employeeId: employee?._id
      ? (employee._id as { toString(): string }).toString()
      : (item.employeeId as { toString?: () => string })?.toString?.() ?? item.employeeId,
    reviewedBy: (item.reviewedBy as { toString?: () => string })?.toString?.(),
    employee: employee?.firstName
      ? {
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeCode: employee.employeeCode,
        }
      : undefined,
    createdAt: (item.createdAt as Date)?.toISOString?.() ?? item.createdAt,
    reviewedAt: (item.reviewedAt as Date)?.toISOString?.() ?? item.reviewedAt,
  };
}
