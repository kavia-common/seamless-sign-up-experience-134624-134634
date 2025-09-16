#!/usr/bin/env node
/**
 * Run MongoDB initialization using environment variables.
 * Loads env from db_visualizer/mongodb.env if present, then executes init_mongo.js with mongosh.
 *
 * Requirements:
 *  - mongosh must be installed in the environment.
 *
 * Usage:
 *  node init_db.js
 */

const { spawnSync } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const { join } = require('path');

// Load env from mongodb.env if available
const envPath = join(__dirname, 'db_visualizer', 'mongodb.env');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('export ')) {
      const [key, ...rest] = trimmed.substring(7).split('=');
      if (key && rest.length > 0) {
        let val = rest.join('=');
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  });
}

const url = process.env.MONGODB_URL;
const dbName = process.env.MONGODB_DB;

if (!url || !dbName) {
  console.error('Missing environment variables. Ensure MONGODB_URL and MONGODB_DB are set.');
  process.exit(1);
}

const initScript = join(__dirname, 'init_mongo.js');
const args = [`${url}/${dbName}`, '--file', initScript];

console.log(`Running init script: mongosh ${args.join(' ')}`);
const result = spawnSync('mongosh', args, { stdio: 'inherit' });

if (result.error) {
  console.error('Error running mongosh:', result.error);
  process.exit(1);
}

process.exit(result.status || 0);
