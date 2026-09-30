// MC-046 Stage 0: stored content derived from VOW figures. COUNTS ONLY; no row content is printed.
import { loadEnv } from '../../scripts/verify/lib/env.mjs';
loadEnv();
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
const q = async (label, sql) => {
  const [r] = await db.$queryRawUnsafe(sql);
  console.log(`${label.padEnd(58)} ${Object.entries(r).map(([k, v]) => `${k}=${Number(v)}`).join(' ')}`);
};
const D = String.raw`\$[0-9]`;
try {
  await q('StreetGeneration (all rows)', `select count(*) n,
    count(*) filter (where "inputJson"::text ~ '"typicalPrice":\\s*[0-9]') input_has_typical,
    count(*) filter (where "sectionsJson"::text ~ '${D}') sections_dollar,
    count(*) filter (where "faqJson"::text ~ '${D}') faq_dollar
    from "StreetGeneration"`);
  await q('StreetContent published', `select count(*) n,
    count(*) filter (where description ~ '${D}') description_dollar,
    count(*) filter (where "metaDescription" ~ '${D}') meta_dollar,
    count(*) filter (where "statsJson" is not null) stats_json
    from "StreetContent" where status = 'published'`);
  await q('HubContent published', `select count(*) n,
    count(*) filter (where "faqJson" ~ '${D}') faq_dollar,
    count(*) filter (where description ~ '${D}') description_dollar
    from "HubContent" where status = 'published'`);
  await q('HubGeneration', `select count(*) n,
    count(*) filter (where "sectionsJson"::text ~ '${D}') sections_dollar
    from "HubGeneration"`);
  await q('CondoContent published', `select count(*) n,
    count(*) filter (where "statsJson" is not null) stats_json,
    count(*) filter (where "metaDescription" ~ '${D}') meta_dollar,
    count(*) filter (where "metaTitle" ~ '${D}') title_dollar,
    count(*) filter (where "faqJson" ~ '${D}') faq_dollar
    from "CondoContent" where status = 'published'`);
  await q('CondoGeneration', `select count(*) n,
    count(*) filter (where "sectionsJson"::text ~ '${D}') sections_dollar
    from "CondoGeneration"`);
  await q('MarketEdition', `select count(*) n from "MarketEdition"`);
  await q('ResidentialStreet soldCount12mo', `select count(*) n,
    count(*) filter (where "soldCount12mo" > 0) positive from "ResidentialStreet"`);
} finally {
  await db.$disconnect();
}
