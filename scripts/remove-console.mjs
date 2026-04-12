import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd());
const exts = ['.js', '.ts', '.tsx', '.jsx'];

function walk(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (file === 'node_modules' || file === '.git') continue;
      results.push(...walk(full));
    } else {
      if (exts.includes(path.extname(full))) results.push(full);
    }
  }
  return results;
}

const files = walk(root);
for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;
  // Remove lines containing console.log( ... ) entirely
  src = src.split(/\r?\n/).filter(line => !/console\.log\s*\(/.test(line)).join('\n');
  if (src !== orig) {
    fs.writeFileSync(file, src, 'utf8');
    console.log('Cleaned:', path.relative(root, file));
  }
}
console.log('Done cleaning console.log occurrences.');
