/** Pure report-text builder for report.mts (exported for unit tests). */
export const buildReportText = (opts: { slug: string; links?: string; step?: string; error?: string }): string => {
  const { slug, links = "", step = "", error = "" } = opts;
  if (error) {
    return `:x: *[video-short CI]* run gagal di *${step || "unknown step"}* untuk \`${slug}\`\nError: ${error.slice(0, 300)}`;
  }
  if (links) {
    const [yt, tt] = links.split(",");
    return `:rocket: *[Kali Aja Tau] Video baru live*\n*Judul:* lihat di ${yt ?? ""}\n▶️ ${yt ?? "?"}\n🎵 ${tt ?? "?"}\nProject: \`${slug}\` — diproduksi otomatis oleh video-short CI (self-hosted runner).`;
  }
  return `:information_source: *[video-short CI]* \`${slug}\` — report (tidak ada links/error diberikan)`;
};
