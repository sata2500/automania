import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createLocalSqliteDatabase, parseSqliteJson, sqliteJson } from '@/lib/sqlite-runtime';

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'automania-sqlite-'));
  const databasePath = path.join(directory, 'test.sqlite');
  const database = await createLocalSqliteDatabase(databasePath);

  try {
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").getAsObject();
    const tableNames = database.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0]?.values.flat() || [];
    assert.ok(tableNames.includes('users'));
    assert.ok(tableNames.includes('user_workspaces'));
    assert.ok(tableNames.includes('user_etsy_listings'));

    database.run("INSERT INTO users (id, email) VALUES (?, ?)", ['u1', 'u1@example.com']);
    database.run("INSERT INTO user_workspaces (user_id) VALUES (?)", ['u1']);
    database.run("INSERT INTO user_etsy_listings (id, user_id, listing_id) VALUES (?, ?, ?)", ['row1', 'u1', 'listing-1']);
    assert.throws(() => {
      database.run("INSERT INTO user_etsy_listings (id, user_id, listing_id) VALUES (?, ?, ?)", ['row2', 'u1', 'listing-1']);
    });

    const value = { tags: ['red', 'circle'], count: 2 };
    assert.deepEqual(parseSqliteJson(sqliteJson(value), {}), value);
    assert.deepEqual(parseSqliteJson('{bad-json', value), value);
    console.log(`sqlite_runtime_test=passed tables=${tables ? 'available' : 'available'}`);
  } finally {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
