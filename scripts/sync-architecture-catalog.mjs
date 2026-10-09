// Sync architecture fixtures into a standalone EventCatalog Community project.
// The source of truth stays in docs/agent-platform/eventcatalog-poc; never publish
// unreviewed customer files, secrets, or proprietary API payloads.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = path.join(repoRoot, 'architecture-catalog');
const examples = path.join(repoRoot, 'docs', 'agent-platform', 'eventcatalog-poc');
for (const segment of ['agents', 'domains', 'services', 'events', 'commands', 'queries', 'flows']) {
  const source = path.join(examples, segment);
  const target = path.join(catalog, segment);
  if (!existsSync(source)) throw new Error(`Missing catalog content: ${source}`);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  const count = readdirSync(target).length;
  if (count === 0) throw new Error(`Empty catalog resources: ${segment}`);
  console.log(`Synced ${segment}: ${count} resource group(s)`);
}
