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

test('void replacement reverses material movements and all related writes atomically', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mt-void-reversal-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createHash, randomUUID } from 'node:crypto';
    import { createRequire } from 'node:module';
    const require=createRequire(${JSON.stringify(packageUrl)});
    const Database=require('better-sqlite3'); const express=require('express');
    const {ensureMaterialsToolingSchema}=await import(${JSON.stringify(schemaUrl)});
    const {createMaterialsToolingRouter}=await import(${JSON.stringify(routerUrl)});
    const db=new Database(':memory:'); db.pragma('foreign_keys=ON');
    db.exec(\`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE audit_log(id TEXT PRIMARY KEY,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,user_id TEXT,user_name TEXT NOT NULL,action TEXT NOT NULL,changes TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);\`);
    ensureMaterialsToolingSchema(db);
    for(const user of [['admin','Admin','admin'],['member','Member','member'],['clerk','Clerk','member']]) db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(...user);
    db.prepare(\`INSERT INTO mt_items(id,code,name,category,unit,created_by,updated_by,created_at,updated_at)
      VALUES('item','MAT','Brush','耗材','把','admin','admin','x','x'),('item2','MAT2','Disk','耗材','个','admin','admin','x','x'),('item3','MAT3','Glove','耗材','把','admin','admin','x','x')\`).run();
    db.prepare(\`INSERT INTO mt_suppliers(id,code,name,created_by,updated_by,created_at,updated_at)
      VALUES('supplier','SUP','Supplier','admin','admin','x','x')\`).run();
    db.prepare(\`INSERT INTO mt_movements(id,item_id,movement_type,quantity_delta,movement_date,created_by,created_at,source_workbook,cutover_period)
      VALUES('opening','item','opening_balance',10,'2026-07-01','admin','x','cutover.xlsx','2026-07')\`).run();
    db.prepare(\`INSERT INTO mt_movements(id,item_id,movement_type,quantity_delta,movement_date,created_by,created_at,source_workbook,cutover_period)
      VALUES('opening3','item3','opening_balance',10,'2026-07-01','admin','x','cutover.xlsx','2026-07')\`).run();
    const actors=new Map([['admin',{id:'admin',name:'Admin',role:'admin'}],['member',{id:'member',name:'Member',role:'member'}]]);
    const app=express(); app.use(express.json()); app.use((req,_res,next)=>{req.user=actors.get(String(req.headers['x-user']));next()}); app.use('/mt',createMaterialsToolingRouter(db));
    const server=await new Promise((ok,bad)=>{const s=app.listen(0,'127.0.0.1',()=>ok(s));s.on('error',bad)}); const address=server.address(); const base='http://127.0.0.1:'+address.port+'/mt';
    async function call(path,user='admin',body={reason:'correction'}){const response=await fetch(base+path,{method:path==='/items'?'GET':'POST',headers:{'x-user':user,'content-type':'application/json'},body:path==='/items'?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json()}}
    let serial=0;
    function source(status='executed',options={}){
      serial+=1; const type=options.type??'purchase_receipt'; const prefix={purchase_receipt:'GR',material_issue:'MI',material_return:'MR',scrap:'MS',count_adjustment:'CA',tooling_movement:'TM'}[type];
      const max=db.prepare("SELECT MAX(CAST(substr(document_number,-4) AS INTEGER)) n FROM mt_documents WHERE document_type=? AND document_number LIKE ?").get(type,prefix+'-2026-%').n??0;
      const id='source-'+serial; const number=prefix+'-2026-'+String(max+1).padStart(4,'0');
      db.prepare(\`INSERT INTO mt_documents(id,document_number,document_type,version,status,applicant_user_id,department,request_date,execution_date,purpose,supplier_id,invoice_number,contract_number,assigned_approver_user_id,created_by,updated_by,created_at,updated_at,notes,executed_by_user_id,recipient_name,inspection_result)
        VALUES(?,?,?,1,?,'member','Factory','2026-07-10','2026-07-10','purpose',?,'INV','CON','admin','member','admin','x','x','notes','admin','Worker','passed')\`).run(id,number,type,status,type==='purchase_receipt'?'supplier':null);
      const quantities=options.quantities??(type==='tooling_movement'?[]:[2]); const lines=[];
      quantities.forEach((quantity,index)=>{const lineId=id+'-line-'+index; db.prepare(\`INSERT INTO mt_document_lines(id,document_id,line_number,material_item_id,requested_quantity,execution_quantity,unit,tax_inclusive_unit_price,related_issue_line_id,notes)
        VALUES(?,?,?,?,?,?,?,?,?,?)\`).run(lineId,id,index+1,options.itemId??'item',Math.abs(quantity),Math.abs(quantity),options.itemId==='item2'?'个':'把',type==='purchase_receipt'?(options.price??12):null,options.relatedIssueLineId??null,'line-note'); lines.push(db.prepare('SELECT * FROM mt_document_lines WHERE id=?').get(lineId));});
      const header={...db.prepare('SELECT * FROM mt_documents WHERE id=?').get(id),status:'pending_approval'}; const snapshot=JSON.stringify({header,lines});
      db.prepare('INSERT INTO mt_document_versions(document_id,version,snapshot_json,snapshot_sha256,submitted_by,submitted_at) VALUES(?,1,?,?,?,?)').run(id,snapshot,createHash('sha256').update(snapshot).digest('hex'),'member','x');
      db.prepare("INSERT INTO mt_approvals(id,document_id,version,approver_user_id,decision,decided_at) VALUES(?,?,1,'admin','approved','x')").run(randomUUID(),id);
      quantities.forEach((quantity,index)=>{if(options.noMovements)return; db.prepare(\`INSERT INTO mt_movements(id,item_id,document_id,document_line_id,movement_type,quantity_delta,reference_unit_price,movement_date,created_by,created_at,supplier_id)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)\`).run(randomUUID(),options.itemId??'item',id,id+'-line-'+index,type,quantity,type==='purchase_receipt'?(options.price??12):null,'2026-07-10','admin','x',type==='purchase_receipt'?'supplier':null)});
      if(quantities.length&&!options.noMovements) db.prepare("INSERT INTO audit_log(id,entity_type,entity_id,user_id,user_name,action,changes,created_at) VALUES(?, 'mt_document', ?, 'admin', 'Admin', 'execute', '{}', 'x')").run(randomUUID(),id);
      return {id,number,lines};
    }
    try {
      const baseline=source('executed',{quantities:[4],price:8});
      const target=source('executed',{quantities:[2,3],price:12});
      assert.equal((await call('/documents/'+target.id+'/void-and-replace','member')).status,403);
      for(const body of [{},{reason:'   '},{reason:'x',extra:true}]) assert.equal((await call('/documents/'+target.id+'/void-and-replace','admin',body)).status,400);
      const quantityBefore=db.prepare("SELECT SUM(quantity_delta) q FROM mt_movements WHERE item_id='item'").get().q;
      const result=await call('/documents/'+target.id+'/void-and-replace'); assert.equal(result.status,201,JSON.stringify(result.body));
      const replacement=result.body.document; assert.match(replacement.document_number,/^GR-2026-\\d{4}$/); assert.notEqual(replacement.document_number,target.number); assert.equal(replacement.status,'draft'); assert.equal(replacement.replaces_document_id,target.id);
      const original=db.prepare('SELECT * FROM mt_documents WHERE id=?').get(target.id); assert.equal(original.status,'voided'); assert.equal(original.replaced_by_document_id,replacement.id); assert.equal(original.void_reason,'correction');
      for(const field of ['execution_date','executed_by_user_id','assigned_approver_user_id','rejection_reason','void_reason','replaced_by_document_id']) assert.equal(db.prepare('SELECT '+field+' value FROM mt_documents WHERE id=?').get(replacement.id).value,null);
      const originalLines=db.prepare(\`SELECT line_number,material_item_id,requested_quantity,execution_quantity,unit,tax_inclusive_unit_price,related_request_line_id,related_issue_line_id,return_condition,system_quantity,counted_quantity,adjustment_delta,notes FROM mt_document_lines WHERE document_id=? ORDER BY line_number\`).all(target.id);
      const replacementLines=db.prepare(\`SELECT line_number,material_item_id,requested_quantity,execution_quantity,unit,tax_inclusive_unit_price,related_request_line_id,related_issue_line_id,return_condition,system_quantity,counted_quantity,adjustment_delta,notes FROM mt_document_lines WHERE document_id=? ORDER BY line_number\`).all(replacement.id); assert.deepEqual(replacementLines,originalLines);
      const originals=db.prepare("SELECT item_id,document_line_id,quantity_delta,reference_unit_price,movement_date FROM mt_movements WHERE document_id=? AND movement_type='purchase_receipt' ORDER BY document_line_id").all(target.id);
      const reversals=db.prepare("SELECT item_id,document_line_id,quantity_delta,reference_unit_price,movement_date,created_by FROM mt_movements WHERE document_id=? AND movement_type='void_reversal' ORDER BY document_line_id").all(target.id);
      assert.deepEqual(reversals,originals.map(row=>({...row,quantity_delta:-row.quantity_delta,created_by:'admin'})));
      assert.equal(db.prepare("SELECT SUM(quantity_delta) q FROM mt_movements WHERE item_id='item'").get().q,quantityBefore-5);
      const audits=db.prepare("SELECT action,changes FROM audit_log WHERE entity_id IN (?,?) AND action IN ('void','create_replacement') ORDER BY action").all(target.id,replacement.id); assert.equal(audits.length,2); for(const row of audits) assert(!row.changes.includes('correction')&&!row.changes.includes('12'));
      const voidChanges=JSON.parse(audits.find(row=>row.action==='void').changes); assert.equal(voidChanges.status.old,'executed'); assert.equal(voidChanges.status.new,'voided'); assert.equal(voidChanges.status.new,voidChanges.status.next); assert.equal(voidChanges.version.new,voidChanges.version.next);
      const beforeDuplicate=db.prepare("SELECT COUNT(*) n FROM mt_movements WHERE document_id=? AND movement_type='void_reversal'").get(target.id).n; assert.equal((await call('/documents/'+target.id+'/void-and-replace')).status,409); assert.equal(db.prepare("SELECT COUNT(*) n FROM mt_movements WHERE document_id=? AND movement_type='void_reversal'").get(target.id).n,beforeDuplicate);

      const items=await call('/items'); const item=items.body.items.find(row=>row.id==='item'); assert.equal(item.purchaseSummary.unitPrice,8,'voided receipt is excluded from latest purchase summary');
      const unlinkedReturn=source('pending_execution',{type:'material_return',quantities:[],noMovements:true});
      db.prepare("INSERT INTO mt_document_lines(id,document_id,line_number,material_item_id,requested_quantity,execution_quantity,unit) VALUES(?, ?,1,'item',1,1,'把')").run(unlinkedReturn.id+'-return-line',unlinkedReturn.id);
      const returnLine=db.prepare('SELECT * FROM mt_document_lines WHERE id=?').get(unlinkedReturn.id+'-return-line'); const returnHeader={...db.prepare('SELECT * FROM mt_documents WHERE id=?').get(unlinkedReturn.id),status:'pending_approval'}; const returnSnapshot=JSON.stringify({header:returnHeader,lines:[returnLine]});
      db.exec('DROP TRIGGER trg_mt_document_versions_append_only_update'); db.prepare('UPDATE mt_document_versions SET snapshot_json=?,snapshot_sha256=? WHERE document_id=?').run(returnSnapshot,createHash('sha256').update(returnSnapshot).digest('hex'),unlinkedReturn.id);
      assert.equal((await call('/documents/'+unlinkedReturn.id+'/execute','admin',{})).status,200); assert.equal(db.prepare("SELECT reference_unit_price p FROM mt_movements WHERE document_id=? AND movement_type='material_return'").get(unlinkedReturn.id).p,8,'return pricing falls back to previous valid receipt');

      for(const status of ['awaiting_signed_copy','completed']){const doc=source(status,{noMovements:true}); assert.equal((await call('/documents/'+doc.id+'/void-and-replace')).status,201)}
      const zero=source('executed',{type:'count_adjustment',noMovements:true}); const zeroResult=await call('/documents/'+zero.id+'/void-and-replace'); assert.equal(zeroResult.status,201); assert.equal(db.prepare("SELECT COUNT(*) n FROM mt_movements WHERE document_id=?").get(zero.id).n,0);
      const pending=source('pending_execution',{noMovements:true}); assert.equal((await call('/documents/'+pending.id+'/void-and-replace')).status,409);
      // Tooling movement void reversal via HTTP
      const movementsBeforeToolingVoid=db.prepare("SELECT COUNT(*) n FROM mt_movements").get().n;
      db.prepare("INSERT INTO mt_tooling_assets(id,tooling_code,name,category,specification,status,custodian_user_id,location,created_by,updated_by,created_at,updated_at) VALUES('tva-1','MOLD-T1','Test Tooling','Mold','A4','in_use','member','Workshop','admin','admin','x','x')").run();
      const toolSource=source('executed',{type:'tooling_movement',noMovements:true});
      db.prepare("INSERT INTO mt_tooling_requests(document_id,asset_id,action,to_custodian_user_id,to_location) VALUES(?,'tva-1','issue','clerk','B2')").run(toolSource.id);
      const tMovId=randomUUID();
      db.prepare("INSERT INTO mt_tooling_movements(id,asset_id,document_id,movement_type,from_status,to_status,from_custodian_user_id,to_custodian_user_id,from_location,to_location,created_by,created_at) VALUES(?,?,?,'issue','in_stock','in_use',NULL,'member','Storage A','Workshop','admin','x')").run(tMovId,'tva-1',toolSource.id);
      const toolResult=await call('/documents/'+toolSource.id+'/void-and-replace'); assert.equal(toolResult.status,200,JSON.stringify(toolResult.body));
      assert.ok(toolResult.body.tooling); assert.equal(db.prepare("SELECT status FROM mt_documents WHERE id=?").get(toolSource.id).status,'voided');
      const toolReversal=db.prepare("SELECT movement_type,to_status FROM mt_tooling_movements WHERE document_id=? AND movement_type='void_reversal'").get(toolSource.id) as any;
      assert.ok(toolReversal); assert.equal(toolReversal.to_status,'in_stock');
      const toolAudit=db.prepare("SELECT action FROM audit_log WHERE entity_type='mt_tooling_asset' AND action='void_reversal'").get() as any;
      assert.ok(toolAudit);
      // Verify mt_movements table is untouched by tooling reversal (no new mt_movements row)
      assert.equal(db.prepare("SELECT COUNT(*) n FROM mt_movements").get().n, movementsBeforeToolingVoid);

      const receiptToBlock=source('executed',{itemId:'item2',quantities:[2],price:5}); source('executed',{type:'material_issue',itemId:'item2',quantities:[-2]}); const blockedCount=db.prepare('SELECT COUNT(*) n FROM mt_documents').get().n; assert.equal((await call('/documents/'+receiptToBlock.id+'/void-and-replace')).status,409,'reversal cannot make stock negative'); assert.equal(db.prepare('SELECT COUNT(*) n FROM mt_documents').get().n,blockedCount); assert.equal(db.prepare("SELECT COUNT(*) n FROM mt_movements WHERE document_id=? AND movement_type='void_reversal'").get(receiptToBlock.id).n,0); assert.equal(db.prepare('SELECT status FROM mt_documents WHERE id=?').get(receiptToBlock.id).status,'executed');

      const issued=source('executed',{type:'material_issue',itemId:'item3',quantities:[-4]});
      const returned=source('executed',{type:'material_return',itemId:'item3',quantities:[2],relatedIssueLineId:issued.id+'-line-0'});
      const beforeBlockedIssue=db.prepare("SELECT SUM(quantity_delta) q FROM mt_movements WHERE item_id='item3'").get().q;
      assert.equal((await call('/documents/'+issued.id+'/void-and-replace')).status,409,'an issue referenced by an active return cannot be voided');
      assert.equal(db.prepare('SELECT status FROM mt_documents WHERE id=?').get(issued.id).status,'executed');
      assert.equal(db.prepare("SELECT SUM(quantity_delta) q FROM mt_movements WHERE item_id='item3'").get().q,beforeBlockedIssue);
      assert.equal((await call('/documents/'+returned.id+'/void-and-replace')).status,201);
      const replacementReturn=db.prepare('SELECT replaced_by_document_id id FROM mt_documents WHERE id=?').get(returned.id).id;
      db.prepare("UPDATE mt_documents SET status='withdrawn' WHERE id=?").run(replacementReturn);
      const laterReturn=source('pending_execution',{type:'material_return',itemId:'item3',quantities:[3],relatedIssueLineId:issued.id+'-line-0',noMovements:true});
      assert.equal((await call('/documents/'+laterReturn.id+'/execute','admin',{})).status,200,'voided return quantity does not consume the issue return allowance');

      const voidedIssue=source('executed',{type:'material_issue',itemId:'item3',quantities:[-1]});
      db.prepare("UPDATE mt_documents SET status='voided' WHERE id=?").run(voidedIssue.id);
      const pendingReturn=source('pending_execution',{type:'material_return',itemId:'item3',quantities:[1],relatedIssueLineId:voidedIssue.id+'-line-0',noMovements:true});
      const beforePendingReturn=db.prepare("SELECT SUM(quantity_delta) q FROM mt_movements WHERE item_id='item3'").get().q;
      assert.equal((await call('/documents/'+pendingReturn.id+'/execute','admin',{})).status,409,'a pending return cannot execute against a voided issue');
      assert.equal(db.prepare("SELECT SUM(quantity_delta) q FROM mt_movements WHERE item_id='item3'").get().q,beforePendingReturn); assert.equal(db.prepare('SELECT status FROM mt_documents WHERE id=?').get(pendingReturn.id).status,'pending_execution');

      const auditFailure=source('executed',{quantities:[1]}); const beforeAuditFailure=db.prepare("SELECT SUM(quantity_delta) q FROM mt_movements WHERE item_id='item'").get().q; db.exec(\`CREATE TRIGGER fail_void_audit BEFORE INSERT ON audit_log WHEN NEW.action='void' BEGIN SELECT RAISE(ABORT,'audit fail'); END\`); assert.equal((await call('/documents/'+auditFailure.id+'/void-and-replace')).status,500); db.exec('DROP TRIGGER fail_void_audit'); assert.equal(db.prepare("SELECT SUM(quantity_delta) q FROM mt_movements WHERE item_id='item'").get().q,beforeAuditFailure); assert.equal(db.prepare('SELECT status FROM mt_documents WHERE id=?').get(auditFailure.id).status,'executed'); assert.equal(db.prepare('SELECT replaced_by_document_id r FROM mt_documents WHERE id=?').get(auditFailure.id).r,null);
      const linkFailure=source('executed',{quantities:[1]}); const beforeLinkFailure=db.prepare("SELECT COUNT(*) n FROM mt_movements WHERE document_id=?").get(linkFailure.id).n; db.exec(\`CREATE TRIGGER fail_link BEFORE UPDATE OF replaced_by_document_id ON mt_documents WHEN NEW.replaced_by_document_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'link fail'); END\`); assert.equal((await call('/documents/'+linkFailure.id+'/void-and-replace')).status,500); db.exec('DROP TRIGGER fail_link'); assert.equal(db.prepare("SELECT COUNT(*) n FROM mt_movements WHERE document_id=?").get(linkFailure.id).n,beforeLinkFailure); assert.equal(db.prepare('SELECT status FROM mt_documents WHERE id=?').get(linkFailure.id).status,'executed');
    } finally {await new Promise((ok,bad)=>server.close(error=>error?bad(error):ok()));db.close()}
  `);
  try { execFileSync(tsx,[runner],{cwd:root,stdio:'pipe'}); }
  finally { rmSync(directory,{recursive:true,force:true}); }
});
