import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const packageUrl = pathToFileURL(path.join(root, 'package.json')).href;
const routerUrl = pathToFileURL(path.join(root, 'server/routes/materials-tooling.ts')).href;
const schemaUrl = pathToFileURL(path.join(root, 'server/materials-tooling/schema.ts')).href;

test('new material documents can execute without approval configuration', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mt-no-approval-'));
  const runner = path.join(dir, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const express = require('express');
    const { ensureMaterialsToolingSchema } = await import(${JSON.stringify(schemaUrl)});
    const { createMaterialsToolingRouter } = await import(${JSON.stringify(routerUrl)});
    const db = new Database(':memory:'); db.pragma('foreign_keys = ON');
    db.exec(\`CREATE TABLE users (id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE audit_log (id TEXT PRIMARY KEY,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,user_id TEXT,user_name TEXT NOT NULL,action TEXT NOT NULL,changes TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);\`);
    ensureMaterialsToolingSchema(db);
    db.prepare("INSERT INTO users(id,name,role) VALUES('admin','Admin','admin'),('clerk','Clerk','member')").run();
    db.prepare("INSERT INTO mt_permissions(user_id,manage_materials,approve,view_prices,manage_periods,updated_by,updated_at) VALUES('clerk',1,0,0,0,'admin','x')").run();
    db.prepare("INSERT INTO mt_items(id,code,name,category,unit,is_active,created_by,updated_by,created_at,updated_at) VALUES('item','MAT-1','Test material','Material','pc',1,'admin','admin','x','x')").run();
    const people = new Map([['admin',{id:'admin',name:'Admin',role:'admin'}],['clerk',{id:'clerk',name:'Clerk',role:'member'}]]);
    const app = express(); app.use(express.json()); app.use((req:any,_res:any,next:any)=>{ req.user=people.get(String(req.headers['x-user'])); next(); }); app.use('/mt',createMaterialsToolingRouter(db));
    const server = await new Promise<any>((ok,bad)=>{ const s=app.listen(0,'127.0.0.1',()=>ok(s)); s.on('error',bad); });
    const base = 'http://127.0.0.1:' + server.address().port + '/mt';
    async function call(path:string, method='GET', body?:any) { const response=await fetch(base+path,{method,headers:{'x-user':'clerk',...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)}); return {status:response.status,body:response.status===204?null:await response.json()}; }
    try {
      const created = await call('/documents','POST',{ document_type:'count_adjustment', request_date:'2026-08-07', lines:[{ material_item_id:'item', requested_quantity:2, execution_quantity:2, unit:'pc', system_quantity:0, counted_quantity:2, adjustment_delta:2 }] });
      assert.equal(created.status,201,JSON.stringify(created.body));
      const submitted = await call('/documents/'+created.body.document.id+'/submit','POST',{});
      assert.equal(submitted.status,200,JSON.stringify(submitted.body));
      assert.equal(submitted.body.document.status,'pending_execution');
      assert.equal(submitted.body.document.assigned_approver_user_id,null);
      const executed = await call('/documents/'+created.body.document.id+'/execute','POST',{});
      assert.equal(executed.status,200,JSON.stringify(executed.body));
      assert.equal(executed.body.document.status,'executed');
      assert.equal(db.prepare("SELECT COALESCE(SUM(quantity_delta),0) quantity FROM mt_movements WHERE item_id='item'").get().quantity,2);
      assert.equal(db.prepare("SELECT COUNT(*) count FROM mt_approvals").get().count,0);
    } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); db.close(); }
  `);
  try { assert.equal(execFileSync(tsx, [runner], { cwd: root, encoding: 'utf8', stdio: 'pipe' }), ''); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});
