#!/usr/bin/env node
/**
 * One-shot migration: state.json -> Prisma DB
 * Run ONCE after `npx prisma migrate deploy`
 * Usage: node scripts/migrate.js
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const stateFile = path.resolve(process.env.STATE_DIR || 'data', 'state.json');

async function prompt(question) {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function main() {
  console.log('TikTok V2 — state.json -> DB migration\n');

  let state = { creators: [], recordings: [] };
  try {
    const raw = await fs.readFile(stateFile, 'utf8');
    state = JSON.parse(raw);
    console.log(`Read state.json: ${state.creators.length} creators, ${state.recordings.length} recordings`);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('No state.json found — starting with empty DB');
    } else {
      throw e;
    }
  }

  for (const c of state.creators) {
    await prisma.creator.upsert({
      where: { username: c.username },
      update: { enabled: c.enabled ?? true },
      create: {
        username: c.username,
        enabled: c.enabled ?? true,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date()
      }
    });
  }
  console.log(`Migrated ${state.creators.length} creators`);

  let skipped = 0;
  for (const r of state.recordings) {
    await prisma.creator.upsert({
      where: { username: r.username },
      update: {},
      create: { username: r.username }
    });
    const exists = await prisma.recording.findFirst({
      where: {
        username: r.username,
        startedAt: new Date(r.startedAt)
      }
    });
    if (exists) {
      skipped++;
      continue;
    }
    await prisma.recording.create({
      data: {
        username: r.username,
        startedAt: new Date(r.startedAt),
        finishedAt: r.finishedAt ? new Date(r.finishedAt) : null,
        bytes: r.bytes ? BigInt(r.bytes) : null,
        objectKey: r.objectKey || null,
        url: r.url || null,
        uploadStatus: 'DONE'
      }
    });
  }
  console.log(`Migrated ${state.recordings.length - skipped} recordings (${skipped} skipped as duplicates)`);

  const existingAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!existingAdmin) {
    const envAdminUser = process.env.INITIAL_ADMIN_USERNAME;
    const envAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
    const envAdminPass = process.env.INITIAL_ADMIN_PASSWORD;

    let username = envAdminUser;
    let email = envAdminEmail;
    let password = envAdminPass;

    if (!username || !email || !password) {
      console.log('\nNo SUPER_ADMIN found. Creating initial admin user.');
      username = username || (await prompt('  Admin username: '));
      email = email || (await prompt('  Admin email: '));
      password = password || (await prompt('  Admin password (min 8 chars): '));
    }

    if (!username || !email || !password || password.length < 8) {
      throw new Error('Invalid credentials provided (password must be at least 8 chars). Aborting.');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { username, email, passwordHash, role: 'SUPER_ADMIN' }
    });
    console.log(`SUPER_ADMIN created: ${username}`);
  } else {
    console.log(`SUPER_ADMIN already exists: ${existingAdmin.username}`);
  }

  try {
    await fs.rename(stateFile, `${stateFile}.migrated`);
    console.log('Archived state.json -> state.json.migrated');
  } catch {}

  console.log('\nMigration complete!\n');
}

main()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
