import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  const secret = event.headers["x-cron-secret"] || event.headers["X-Cron-Secret"];
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  try {
    const { processLeaveDeductionsGlobal } = await import("../../src/lib/leave-deduct");
    const { processWfhDeductionsGlobal } = await import("../../src/lib/wfh-deduct");
    const leave = await processLeaveDeductionsGlobal();
    const wfh = await processWfhDeductionsGlobal();
    return {
      statusCode: 200,
      body: JSON.stringify({ leave, wfh }),
    };
  } catch (error) {
    console.error("scheduled-leave-deduct failed", error);
    return {
      statusCode: 500,
      body: error instanceof Error ? error.message : "Leave deduct failed",
    };
  }
};
