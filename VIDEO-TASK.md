TASK - publish one street video on Lemieux Court as a visual test

Single street. Proof of concept, not a rollout.

1. SCHEMA (nullable, migration only, no backfill)
   videoUrl         String?
   videoCapturedAt  DateTime?
   nightVideoUrl    String?
   nightCapturedAt  DateTime?

   Pages must render clean when null. Video is a tier, not a
   requirement. Add all four now - night clips are a confirmed
   second field and there is no point migrating twice. Night
   footage answers different questions than daylight: overnight
   street parking, lighting, after-hours activity.

2. HOSTING
   Vercel Blob. ~7MB, 1280 wide, ~39s, h264, faststart, no audio.
   File will be provided.

3. RENDER on /streets/lemieux-court-milton only
   - <video> element, controls, no autoplay, playsInline
   - poster frame extracted from the clip
   - caption line: "Captured 27 August 2026"
   - null videoUrl renders nothing at all - no placeholder,
     no "video coming soon"

4. STRUCTURED DATA
   VideoObject JSON-LD on any page carrying video:
   name, description, thumbnailUrl, uploadDate, duration,
   contentUrl.

NOT IN SCOPE
   - No transcript yet (narration not recorded). Without it this
     carries no SEO value - Google cannot crawl footage, only the
     transcript. This is a visual/UX test only.
   - No other streets, no batch upload, no coverage UI.
   - No UI implying completeness anywhere.
