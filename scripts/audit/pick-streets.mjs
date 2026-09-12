// MA-001. Pick the ten audit streets by shape from the record, not from memory.
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireEnv } from '../verify/lib/env.mjs';

loadEnv();
requireEnv('SOLD_DATABASE_URL', 'DATABASE_URL');
const sold = neon(process.env.SOLD_DATABASE_URL);
const app = neon(process.env.DATABASE_URL);

const pages = await app`SELECT sc."streetSlug" slug, sc."streetName" name, sc.template, sc."videoUrl" v, sc."nightVideoUrl" nv,
                               sc."createdAt" created, sc.neighbourhood nb, rs."neighbourhoodId" nid, n.name nbname
                        FROM public."StreetContent" sc
                        LEFT JOIN public."ResidentialStreet" rs ON rs.slug = sc."streetSlug"
                        LEFT JOIN public."Neighbourhood" n ON n.id = rs."neighbourhoodId"
                        WHERE sc.status='published' ORDER BY sc."streetSlug"`;
console.log('published', pages.length);
console.log('templates', Object.entries(pages.reduce((m,p)=>(m[p.template]=(m[p.template]||0)+1,m),{})));
console.log('with day video', pages.filter(p=>p.v).length, 'night', pages.filter(p=>p.nv).length);
console.log('night clips:', pages.filter(p=>p.nv).map(p=>p.slug).join(', '));
console.log('created >= 2026-09-11:', pages.filter(p=>new Date(p.created) >= new Date('2026-09-11')).map(p=>p.slug+' '+p.template).join(', '));
console.log('minimal:', pages.filter(p=>p.template!=='standard').map(p=>p.slug).slice(0,40).join(', '));
console.log('main street:', pages.filter(p=>/^main-street/.test(p.slug)).map(p=>p.slug).join(', '));
console.log('rural nbhd:', pages.filter(p=>/nassag|rural|campbell|brookville|moffat/i.test(p.nbname||p.nb||'')).map(p=>p.slug+' ('+(p.nbname||p.nb)+')').join(', '));

// 12-month sales per street identity and condo share
const rows = await sold`SELECT lower(street_name) sn, street_suffix sfx, property_type pt, COUNT(*)::int n
                        FROM sold.sold_records WHERE perm_advertise=TRUE AND transaction_type='For Sale'
                          AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
                        GROUP BY 1,2,3 ORDER BY 4 DESC`;
console.log('sample sold row', rows[0]);

const byStreet = await sold`SELECT street_slug s, COUNT(*)::int n,
                              SUM(CASE WHEN property_type='condo' THEN 1 ELSE 0 END)::int condo,
                              COUNT(*) FILTER (WHERE sold_price IS NULL OR sold_price = 0)::int zero
                            FROM sold.sold_records WHERE perm_advertise=TRUE AND transaction_type='For Sale'
                              AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
                            GROUP BY 1`;
const m = new Map(byStreet.map(r=>[r.s, r]));
const pub = new Set(pages.map(p=>p.slug));
const top = byStreet.filter(r=>pub.has(r.s)).sort((a,b)=>b.n-a.n);
console.log('top 12mo sales (published):', top.slice(0,12).map(r=>`${r.s} n=${r.n} condo=${r.condo}`).join(' | '));
console.log('condo-heavy:', top.filter(r=>r.condo/r.n>0.7 && r.n>=5).slice(0,10).map(r=>`${r.s} n=${r.n} condo=${r.condo}`).join(' | '));
console.log('thin (1-4 sales):', top.filter(r=>r.n>=1&&r.n<5).slice(0,15).map(r=>`${r.s} n=${r.n}`).join(' | '));
console.log('published with no 12mo sale:', pages.filter(p=>!m.has(p.slug)).length);
console.log('video streets with n:', pages.filter(p=>p.v).map(p=>`${p.slug} n=${m.get(p.slug)?.n??0}`).join(' | '));
console.log('programme pages with n:', pages.filter(p=>new Date(p.created) >= new Date('2026-09-11')).map(p=>`${p.slug} n=${m.get(p.slug)?.n??0}`).join(' | '));
console.log('main street n:', m.get('main-street-milton'));
console.log('--- rural n:', pages.filter(p=>/nassag|rural|campbell|brookville|moffat/i.test(p.nbname||p.nb||'')).map(p=>`${p.slug} n=${m.get(p.slug)?.n??0} ${p.template}`).join(' | '));
console.log('--- minimal n:', pages.filter(p=>p.template!=='standard').map(p=>`${p.slug} n=${m.get(p.slug)?.n??0}`).join(' | '));
console.log('--- zero 12mo, standard, no video, pre-programme:', pages.filter(p=>!m.has(p.slug)&&p.template==='standard'&&!p.v&&new Date(p.created)<new Date('2026-09-11')).map(p=>p.slug).slice(0,25).join(' | '));
