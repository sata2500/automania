import { closeLocalSqliteDatabase, getLocalSqliteDatabase } from '@/lib/sqlite-runtime';

async function main() {
  await getLocalSqliteDatabase();
  await closeLocalSqliteDatabase();
  console.log(`sqlite_database_initialized=${process.env.SQLITE_DATABASE_PATH || '.data/automania.local.sqlite'}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
