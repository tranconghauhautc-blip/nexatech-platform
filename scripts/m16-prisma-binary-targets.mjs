import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const appsDir = join(process.cwd(), 'apps');
for (const name of readdirSync(appsDir)) {
  const schemaPath = join(appsDir, name, 'prisma', 'schema.prisma');
  try {
    let raw = readFileSync(schemaPath, 'utf8');
    if (raw.includes('binaryTargets')) {
      console.log('skip', name);
      continue;
    }
    const next = raw.replace(
      /generator client \{\n  provider = "prisma-client-js"\n  output\s*=\s*"[^"]+"\n\}/,
      (block) =>
        block.replace(
          /\n\}/,
          `\n  binaryTargets = ["native", "debian-openssl-3.0.x"]\n}`,
        ),
    );
    if (next === raw) {
      console.error('pattern miss', name);
      process.exitCode = 1;
      continue;
    }
    writeFileSync(schemaPath, next, 'utf8');
    console.log('updated', name);
  } catch {
    // no prisma
  }
}
