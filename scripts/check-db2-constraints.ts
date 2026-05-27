import { getSoldDb } from '@/lib/db';

(async () => {
  const sd = getSoldDb();
  if (!sd) { console.log('No DB'); return; }

  const constraints = await (sd`
    SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
     WHERE conrelid = 'sold.sold_records'::regclass
  ` as unknown as Promise<Array<{ conname: string; contype: string; definition: string }>>);
  console.log('Constraints on sold.sold_records:');
  console.log(JSON.stringify(constraints, null, 2));

  const indexes = await (sd`
    SELECT indexname, indexdef
      FROM pg_indexes
     WHERE schemaname = 'sold' AND tablename = 'sold_records'
  ` as unknown as Promise<Array<{ indexname: string; indexdef: string }>>);
  console.log('');
  console.log('Indexes:');
  console.log(JSON.stringify(indexes, null, 2));
})();
