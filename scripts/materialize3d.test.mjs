import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
test('all 229 native animated GLB models materialize and validate',()=>{
  const out=execFileSync(process.execPath,['scripts/materialize3d.mjs'],{encoding:'utf8'});
  assert.match(out,/229 verified GLB/);
  const verify=execFileSync(process.execPath,['scripts/materialize3d.mjs','--verify'],{encoding:'utf8'});
  assert.match(verify,/229 verified GLB/);
});
