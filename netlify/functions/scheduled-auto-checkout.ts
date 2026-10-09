export const handler = async (event: {
  headers: Record<string, string | undefined>;
}) => {
  const secret = event.headers["x-cron-secret"] || event.headers["X-Cron-Secret"];
  if (secret !== process.env.CRON_SECRET) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  try {
    const { autoCheckoutForgottenSessions } = await import("../../src/lib/timesheet-auto-checkout");
    const result = await autoCheckoutForgottenSessions();
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }),
    };
  }
};
