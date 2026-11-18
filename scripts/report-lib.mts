/** Pure report-text builder for report.mts (exported for unit tests). */
import { ACCOUNTS, isAccountId } from "../src/accounts.ts";

export const formatLinksCsv = (links?: { youtube?: string | null; tiktok?: string | null; instagram?: string | null }): string =>
  [links?.youtube, links?.tiktok, links?.instagram].filter((v): v is string => Boolean(v)).join(",");

export const buildReportText = (opts: { slug: string; links?: string; step?: string; error?: string; account?: string }): string => {
  const { slug, links = "", step = "", error = "", account } = opts;
  const known = account !== undefined && isAccountId(account) ? account : undefined;
  const label = known ? ACCOUNTS[known].label : "video-short CI";
  if (error) {
    const suffix = known ? ` — ${label}` : "";
    return `:x: *[video-short CI]* run gagal di *${step || "unknown step"}* untuk \`${slug}\`${suffix}\nError: ${error.slice(0, 300)}`;
  }
  if (links) {
    const [yt, tt, ig] = links.split(",");
    const igLine = ig ? `\n📸 ${ig}` : "";
    return `:rocket: *[${label}] Video baru live*\n*Judul:* lihat di ${yt ?? ""}\n▶️ ${yt ?? "?"}\n🎵 ${tt ?? "?"}${igLine}\nProject: \`${slug}\` — diproduksi oleh pipeline video-short (GitHub-hosted).`;
  }
  return `:information_source: *[${label}]* \`${slug}\` — report (tidak ada links/error diberikan)`;
};
