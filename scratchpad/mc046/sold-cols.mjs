import { loadEnv } from '../../scripts/verify/lib/env.mjs'; loadEnv();
import { neon } from '@neondatabase/serverless';
const sd = neon(process.env.SOLD_DATABASE_URL), ad = neon(process.env.ANALYTICS_DATABASE_URL);
const c = await sd`select column_name from information_schema.columns where table_schema='sold' and table_name='sold_records' order by ordinal_position`;
console.log('sold_records cols:', c.map((r) => r.column_name).join(','));
const t = await ad`select table_name from information_schema.tables where table_schema='analytics' order by 1`;
console.log('analytics tables:', t.map((r) => r.table_name).join(','));
