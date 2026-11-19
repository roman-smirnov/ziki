import { readFile, writeFile } from 'node:fs/promises';

const packageFiles = new Map([
  ['@babylonjs/core', ['license.md', 'NOTICE.md']],
  ['@babylonjs/loaders', ['license.md']],
  ['react', ['LICENSE']],
  ['react-dom', ['LICENSE']],
  ['scheduler', ['LICENSE']],
  ['@fontsource/nunito', ['LICENSE']],
  ['@fontsource/jetbrains-mono', ['LICENSE']],
]);
const texts = ['Ziki — third-party runtime notices'];
for (const [name, filenames] of packageFiles) {
  const pkgDir = new URL(`../node_modules/${name}/`, import.meta.url);
  const {version} = JSON.parse(await readFile(new URL('package.json', pkgDir), 'utf8'));
  for (const file of filenames) {
    texts.push(`${name} ${version} — ${file}\n\n${(await readFile(new URL(file, pkgDir), 'utf8')).trim()}`);
  }
}
await writeFile(new URL('../dist/THIRD_PARTY_NOTICES.txt',import.meta.url), texts.join('\n\n----------------------------------------------------------------\n\n')+'\n');
