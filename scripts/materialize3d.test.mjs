import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

test('all 229 animated GLB assets materialize and validate', () => {
  const generated = execFileSync(process.execPath, ['scripts/materialize3d.mjs'], { encoding: 'utf8' });
  expect(generated).toMatch(/229 verified GLB/);
  const verified = execFileSync(process.execPath, ['scripts/materialize3d.mjs','--verify'], { encoding: 'utf8' });
  expect(verified).toMatch(/229 verified GLB/);
});
