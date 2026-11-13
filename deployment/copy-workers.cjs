const { mkdir, readdir, copyFile } = require('node:fs/promises');
const { resolve } = require('node:path');

async function main() {
  const source = resolve(__dirname, '../apps/api/src/workers');
  const destination = resolve(__dirname, '../apps/api/dist/workers');
  await mkdir(destination, { recursive: true });
  for (const file of await readdir(source)) {
    if (file.endsWith('.cjs')) await copyFile(resolve(source, file), resolve(destination, file));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
