// scripts/videoRevalidate.ts
//
// Every video write revalidates the surfaces that print the clip, so page and schema move
// together: the street page, /streets (the film strip) and the home page (the video cards).
// Shared by the upload (scripts/upload-street-videos-r2.ts) and the re-key
// (scripts/rekey-video-dated.ts). Posts to /api/revalidate with REVALIDATION_SECRET;
// UPLOAD_REVALIDATE_BASE overrides the production host for a preview.

export async function revalidateVideoSurfaces(fullSlug: string): Promise<string> {
  const secret = process.env.REVALIDATION_SECRET ?? "";
  const base = process.env.UPLOAD_REVALIDATE_BASE ?? "https://miltonly.com";
  if (!secret) return "no REVALIDATION_SECRET; not revalidated";
  const codes: string[] = [];
  for (const p of [`/streets/${fullSlug}`, "/streets", "/"]) {
    const code = await fetch(`${base}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: p }),
    })
      .then((r) => String(r.status))
      .catch(() => "ERR");
    codes.push(`${p} ${code}`);
  }
  return `revalidated ${codes.join(", ")}`;
}
