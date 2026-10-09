export const handler = async (event: {
  headers: Record<string, string | undefined>;
}) => {
  const secret = event.headers["x-cron-secret"] || event.headers["X-Cron-Secret"];
  if (secret !== process.env.CRON_SECRET) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  try {
    const { runCelebrationNotifications } = await import("../../src/lib/celebrations");
    await runCelebrationNotifications();
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }),
    };
  }
};
