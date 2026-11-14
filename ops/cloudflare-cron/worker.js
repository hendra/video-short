/**
 * Cron weker untuk pipeline video Kali Aja Tau.
 * Setiap 01:00, 04:30, 09:30 UTC (= 08:00, 11:30, 16:30 WIB) memicu
 * `repository_dispatch` di repo GitHub, yang menjalankan workflow video.yml.
 * Weker saja — semua kerja berat terjadi di runner GitHub-hosted (ubuntu-latest).
 */
export default {
  async scheduled(event, env, ctx) {
    const res = await fetch("https://api.github.com/repos/hendra/yt-video-short-generator/dispatches", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.VIDEO_SHORT_PAT}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "video-short-cron",
      },
      body: JSON.stringify({
        event_type: "video-run",
        client_payload: { source: "cloudflare-cron", at: new Date().toISOString() },
      }),
    });
    if (res.ok) return; // dispatch diterima (HTTP 204)
    const detail = (await res.text()).slice(0, 200);
    ctx.waitUntil(
      (async () => {
        try {
          const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              channel: env.SLACK_SOCIAL_CHANNEL_ID,
              text: `:warning: [video-short-cron] repository_dispatch gagal (${res.status}): ${detail}`,
              unfurl_links: false,
            }),
          });
          const body = await slackRes.json().catch(() => null);
          if (!slackRes.ok || !body?.ok) {
            console.log(`slack warning post failed: HTTP ${slackRes.status} ${body?.error ?? ""}`);
          }
        } catch (e) {
          console.log(`slack warning post threw: ${e?.message ?? e}`);
        }
      })(),
    );
  },
};
