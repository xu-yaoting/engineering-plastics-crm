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
const movementsUrl = pathToFileURL(path.join(root, 'server/materials-tooling/movements.ts')).href;

test('materials execute approved frozen quantities atomically and preserve reference pricing', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mt-movements-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createHash, randomUUID } from 'node:crypto';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const express = require('express');
    const { ensureMaterialsToolingSchema } = await import(${JSON.stringify(schemaUrl)});
    const { createMaterialsMovementService } = await import(${JSON.stringify(movementsUrl)});
    const { createMaterialsToolingRouter } = await import(${JSON.stringify(routerUrl)});

    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(\`CREATE TABLE users (id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE audit_log (id TEXT PRIMARY KEY,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,user_id TEXT,user_name TEXT NOT NULL,action TEXT NOT NULL,changes TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);\`);
    ensureMaterialsToolingSchema(db);
    for (const user of [['admin','Admin','admin'],['member','Member','member'],['clerk','Moana','member'],['wrong','Wrong approver','member']])
      db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(...user);
    db.prepare(\`INSERT INTO mt_permissions(user_id,manage_materials,approve,view_prices,manage_periods,updated_by,updated_at)
      VALUES('clerk',1,0,1,0,'admin','2026-07-14')\`).run();
    db.prepare(\`INSERT INTO mt_items(id,code,name,category,unit,created_by,updated_by,created_at,updated_at)
      VALUES('item','MAT','Brush','耗材','把','admin','admin','x','x')\`).run();
    db.prepare(\`INSERT INTO mt_suppliers(id,code,name,created_by,updated_by,created_at,updated_at)
      VALUES('supplier','SUP','Supplier','admin','admin','x','x')\`).run();
    db.prepare(\`INSERT INTO mt_movements(id,item_id,movement_type,quantity_delta,movement_date,created_by,created_at,source_workbook,cutover_period)
      VALUES('opening','item','opening_balance',10,'2026-07-01','admin','2026-07-01','cutover.xlsx','2026-07')\`).run();

    const actors = new Map([
      ['admin',{id:'admin',name:'Admin',role:'admin'}],
      ['member',{id:'member',name:'Member',role:'member'}],
      ['clerk',{id:'clerk',name:'Moana',role:'member'}],
    ]);
    const app=express(); app.use(express.json());
    app.use((req,_res,next)=>{req.user=actors.get(String(req.headers['x-user']));next()});
    app.use('/mt',createMaterialsToolingRouter(db));
    const server=await new Promise((ok,bad)=>{const s=app.listen(0,'127.0.0.1',()=>ok(s));s.on('error',bad)});
    const address=server.address(); const base='http://127.0.0.1:'+address.port+'/mt';
    async function call(path:string,user='clerk',method='POST'){const response=await fetch(base+path,{method,headers:{'x-user':user,'content-type':'application/json'},body:method==='GET'?undefined:'{}'});return {status:response.status,body:await response.json()}}

    let sequence=0;
    function executable(type:string, quantity:number, options={}) {
      sequence += 1;
      const id='doc-'+sequence; const lineId='line-'+sequence;
      const requestDate=options.requestDate ?? '2026-07-14';
      const executionDate=options.executionDate ?? requestDate;
      const line={
        id:lineId,document_id:id,line_number:1,material_item_id:'item',
        requested_quantity:options.requestedQuantity ?? quantity,execution_quantity:quantity,
        unit:options.unit ?? '把',tax_inclusive_unit_price:options.price ?? null,
        related_request_line_id:options.requestLineId ?? null,
        related_issue_line_id:options.issueLineId ?? null,return_condition:null,
        system_quantity:options.systemQuantity ?? null,counted_quantity:options.countedQuantity ?? null,
        adjustment_delta:options.adjustmentDelta ?? null,notes:null,
      };
      const header={
        id,document_number:type.toUpperCase()+'-2026-'+String(sequence).padStart(4,'0'),document_type:type,
        version:1,status:'pending_approval',applicant_user_id:'member',department:null,
        request_date:requestDate,required_date:null,execution_date:executionDate,purpose:null,
        supplier_id:type==='purchase_receipt'?'supplier':null,invoice_number:null,contract_number:null,
        replaces_document_id:null,replaced_by_document_id:null,assigned_approver_user_id:'admin',
        rejection_reason:null,void_reason:null,created_by:'member',updated_by:'admin',created_at:'x',updated_at:'x',
        notes:null,executed_by_user_id:null,recipient_user_id:null,recipient_name:null,inspection_result:null,
      };
      db.prepare(\`INSERT INTO mt_documents(id,document_number,document_type,version,status,applicant_user_id,request_date,execution_date,supplier_id,created_by,updated_by,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)\`).run(id,header.document_number,type,1,'pending_execution','member',requestDate,executionDate,header.supplier_id,'member','admin','x','x');
      db.prepare(\`INSERT INTO mt_document_lines(id,document_id,line_number,material_item_id,requested_quantity,execution_quantity,unit,tax_inclusive_unit_price,related_request_line_id,related_issue_line_id,system_quantity,counted_quantity,adjustment_delta)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)\`).run(lineId,id,1,'item',line.requested_quantity,quantity,line.unit,line.tax_inclusive_unit_price,line.related_request_line_id,line.related_issue_line_id,line.system_quantity,line.counted_quantity,line.adjustment_delta);
      const snapshot=JSON.stringify({header,lines:[line]});
      db.prepare(\`INSERT INTO mt_document_versions(document_id,version,snapshot_json,snapshot_sha256,submitted_by,submitted_at)
        VALUES(?,1,?,?,?,?)\`).run(id,snapshot,options.badHash ? '0'.repeat(64) : createHash('sha256').update(snapshot).digest('hex'),'member','2026-07-14');
      if (!options.noApproval) db.prepare(\`INSERT INTO mt_approvals(id,document_id,version,approver_user_id,decision,decided_at)
        VALUES(?,?,1,'admin','approved','2026-07-14')\`).run('approval-'+sequence,id);
      return {id,lineId};
    }
    function request(quantity:number) {
      sequence += 1; const id='request-'+sequence; const lineId='request-line-'+sequence;
      db.prepare(\`INSERT INTO mt_documents(id,document_number,document_type,status,applicant_user_id,request_date,created_by,updated_by,created_at,updated_at)
        VALUES(?,?,'purchase_request','approved','member','2026-07-10','member','admin','x','x')\`).run(id,'PR-2026-'+String(sequence).padStart(4,'0'));
      db.prepare(\`INSERT INTO mt_document_lines(id,document_id,line_number,material_item_id,requested_quantity,execution_quantity,unit)
        VALUES(?,?,1,'item',?,0,'把')\`).run(lineId,id,quantity);
      const header={id,document_number:'PR-2026-'+String(sequence).padStart(4,'0'),document_type:'purchase_request',version:1,status:'pending_approval',applicant_user_id:'member',assigned_approver_user_id:'admin',request_date:'2026-07-10'};
      const line={id:lineId,document_id:id,line_number:1,material_item_id:'item',requested_quantity:quantity,execution_quantity:0,unit:'把'};
      const snapshot=JSON.stringify({header,lines:[line]});
      db.prepare(\`INSERT INTO mt_document_versions(document_id,version,snapshot_json,snapshot_sha256,submitted_by,submitted_at)
        VALUES(?,1,?,?,?,?)\`).run(id,snapshot,createHash('sha256').update(snapshot).digest('hex'),'member','2026-07-10');
      db.prepare(\`INSERT INTO mt_approvals(id,document_id,version,approver_user_id,decision,decided_at)
        VALUES(?,?,1,'admin','approved','2026-07-10')\`).run('request-approval-'+sequence,id);
      return {id,lineId};
    }

    try {
      const movementService=createMaterialsMovementService(db);
      assert.equal(movementService.getCurrentQuantity('item'),10);

      const missingApproval=executable('purchase_receipt',1,{price:10,executionDate:'2026-07-05',noApproval:true});
      assert.equal((await call('/documents/'+missingApproval.id+'/execute')).status,409,'a snapshot without an approval cannot execute');
      assert.equal(movementService.getCurrentQuantity('item'),10);
      db.prepare(\`INSERT INTO mt_approvals(id,document_id,version,approver_user_id,decision,decided_at)
        VALUES('wrong-approval',?,1,'wrong','approved','2026-07-06')\`).run(missingApproval.id);
      assert.equal((await call('/documents/'+missingApproval.id+'/execute')).status,409,'approval must come from the approver assigned in the frozen version');
      db.prepare(\`INSERT INTO mt_approvals(id,document_id,version,approver_user_id,decision,decided_at)
        VALUES('late-approval',?,1,'admin','approved','2026-07-06')\`).run(missingApproval.id);
      assert.equal((await call('/documents/'+missingApproval.id+'/execute')).status,200);
      assert.equal(movementService.getCurrentQuantity('item'),11);

      const missingPrice=executable('purchase_receipt',1,{executionDate:'2026-07-06'});
      const beforeMissingPriceAudit=db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='execute'").get().n;
      assert.equal((await call('/documents/'+missingPrice.id+'/execute')).status,409,'a receipt without an approved price cannot execute');
      assert.equal(movementService.getCurrentQuantity('item'),11);
      assert.equal(db.prepare('SELECT status FROM mt_documents WHERE id=?').get(missingPrice.id).status,'pending_execution');
      assert.equal(db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='execute'").get().n,beforeMissingPriceAudit);

      db.prepare(\`INSERT INTO mt_documents(id,document_number,document_type,status,applicant_user_id,request_date,created_by,updated_by,created_at,updated_at)
        VALUES('draft-request','PR-2026-9000','purchase_request','draft','member','2026-07-10','member','member','x','x')\`).run();
      db.prepare(\`INSERT INTO mt_document_lines(id,document_id,line_number,material_item_id,requested_quantity,execution_quantity,unit)
        VALUES('draft-request-line','draft-request',1,'item',5,0,'把')\`).run();
      const draftRequest=await call('/documents/draft-request','member','GET');
      assert.equal(draftRequest.status,200);
      assert.equal('fulfillment' in draftRequest.body.document,false);

      const pr=request(5);
      const openProgress=await call('/documents/'+pr.id,'member','GET');
      assert.equal(openProgress.body.document.fulfillment.status,'open');
      assert.equal(openProgress.body.document.fulfillment.remainingQuantity,5);
      const receipt=executable('purchase_receipt',3,{price:12,requestLineId:pr.lineId,executionDate:'2026-07-10'});
      assert.equal((await call('/documents/'+receipt.id+'/execute','member')).status,403);
      const received=await call('/documents/'+receipt.id+'/execute'); assert.equal(received.status,200,JSON.stringify(received.body));
      assert.equal(received.body.document.status,'executed');
      assert.equal(db.prepare('SELECT quantity_delta q,reference_unit_price p FROM mt_movements WHERE document_id=?').get(receipt.id).q,3);
      assert.equal(db.prepare('SELECT reference_unit_price p FROM mt_movements WHERE document_id=?').get(receipt.id).p,12);
      assert.equal(movementService.getCurrentQuantity('item'),14);
      assert.equal(movementService.getCurrentQuantity('item','2026-07-09'),11);
      assert.equal((await call('/documents/'+receipt.id+'/execute')).status,409,'duplicate execution is rejected');
      assert.equal(db.prepare('SELECT COUNT(*) n FROM mt_movements WHERE document_id=?').get(receipt.id).n,1);

      const partialProgress=await call('/documents/'+pr.id,'member','GET');
      assert.deepEqual(partialProgress.body.document.fulfillment,{status:'partially_received',requestedQuantity:5,receivedQuantity:3,remainingQuantity:2,lines:[{lineId:pr.lineId,materialItemId:'item',requestedQuantity:5,receivedQuantity:3,remainingQuantity:2,status:'partially_received'}]});
      db.prepare('UPDATE mt_document_lines SET requested_quantity=100 WHERE id=?').run(pr.lineId);
      const finalReceipt=executable('purchase_receipt',2,{price:11,requestLineId:pr.lineId,executionDate:'2026-07-11'});
      assert.equal((await call('/documents/'+finalReceipt.id+'/execute')).status,200);
      const fulfilledProgress=await call('/documents/'+pr.id,'member','GET');
      assert.equal(fulfilledProgress.body.document.fulfillment.status,'fulfilled');
      assert.equal(fulfilledProgress.body.document.fulfillment.receivedQuantity,5);
      assert.equal(fulfilledProgress.body.document.fulfillment.remainingQuantity,0);
      const excessReceipt=executable('purchase_receipt',1,{price:11,requestLineId:pr.lineId,executionDate:'2026-07-11'});
      assert.equal((await call('/documents/'+excessReceipt.id+'/execute')).status,409,'linked receipts cannot exceed the approved request');
      assert.equal(db.prepare('SELECT status FROM mt_documents WHERE id=?').get(excessReceipt.id).status,'pending_execution');

      const issue=executable('material_issue',4,{executionDate:'2026-07-12'});
      assert.equal((await call('/documents/'+issue.id+'/execute')).status,200);
      const issueMovement=db.prepare('SELECT quantity_delta q,reference_unit_price p FROM mt_movements WHERE document_id=?').get(issue.id);
      assert.deepEqual(issueMovement,{q:-4,p:11});
      assert.equal(movementService.getCurrentQuantity('item'),12);

      const linkedReturn=executable('material_return',2,{issueLineId:issue.lineId,executionDate:'2026-07-13'});
      assert.equal((await call('/documents/'+linkedReturn.id+'/execute')).status,200);
      assert.deepEqual(db.prepare('SELECT quantity_delta q,reference_unit_price p FROM mt_movements WHERE document_id=?').get(linkedReturn.id),{q:2,p:11});
      const excessReturn=executable('material_return',3,{issueLineId:issue.lineId,executionDate:'2026-07-13'});
      assert.equal((await call('/documents/'+excessReturn.id+'/execute')).status,409,'linked returns cannot exceed the issued quantity');

      const futureReceipt=executable('purchase_receipt',1,{price:20,executionDate:'2026-07-20'});
      assert.equal((await call('/documents/'+futureReceipt.id+'/execute')).status,200);
      const unlinkedReturn=executable('material_return',1,{executionDate:'2026-07-15'});
      assert.equal((await call('/documents/'+unlinkedReturn.id+'/execute')).status,200);
      assert.equal(db.prepare('SELECT reference_unit_price p FROM mt_movements WHERE document_id=?').get(unlinkedReturn.id).p,11,'unlinked return uses latest actual receipt not after return date');

      const scrap=executable('scrap',1,{executionDate:'2026-07-16'});
      assert.equal((await call('/documents/'+scrap.id+'/execute')).status,200);
      assert.equal(db.prepare('SELECT quantity_delta q FROM mt_movements WHERE document_id=?').get(scrap.id).q,-1);

      const adjustment=executable('count_adjustment',2,{systemQuantity:15,countedQuantity:17,adjustmentDelta:2,executionDate:'2026-07-16'});
      assert.equal((await call('/documents/'+adjustment.id+'/execute')).status,200);
      assert.equal(db.prepare('SELECT quantity_delta q FROM mt_movements WHERE document_id=?').get(adjustment.id).q,2);
      const zero=executable('count_adjustment',1,{requestedQuantity:1,systemQuantity:17,countedQuantity:17,adjustmentDelta:0,executionDate:'2026-07-16'});
      assert.equal((await call('/documents/'+zero.id+'/execute')).status,200);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM mt_movements WHERE document_id=?').get(zero.id).n,0,'zero adjustment completes without a movement');

      const insufficient=executable('material_issue',99);
      const movementCount=db.prepare('SELECT COUNT(*) n FROM mt_movements').get().n;
      const auditCount=db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='execute'").get().n;
      assert.equal((await call('/documents/'+insufficient.id+'/execute')).status,409);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM mt_movements').get().n,movementCount);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='execute'").get().n,auditCount);
      assert.equal(db.prepare('SELECT status FROM mt_documents WHERE id=?').get(insufficient.id).status,'pending_execution');

      const wrongUnit=executable('material_issue',1,{unit:'件'});
      assert.equal((await call('/documents/'+wrongUnit.id+'/execute')).status,409);
      const badHash=executable('material_issue',1,{badHash:true});
      assert.equal((await call('/documents/'+badHash.id+'/execute')).status,409);

      const auditFailure=executable('material_return',1);
      db.exec(\`CREATE TRIGGER fail_execute_audit BEFORE INSERT ON audit_log WHEN NEW.action='execute' BEGIN SELECT RAISE(ABORT,'audit failure'); END;\`);
      const beforeFailure=movementService.getCurrentQuantity('item');
      assert.equal((await call('/documents/'+auditFailure.id+'/execute')).status,500);
      assert.equal(movementService.getCurrentQuantity('item'),beforeFailure,'audit failure rolls back movement');
      assert.equal(db.prepare('SELECT status FROM mt_documents WHERE id=?').get(auditFailure.id).status,'pending_execution');

      const executedDocs=db.prepare("SELECT COUNT(*) n FROM mt_documents WHERE status='executed'").get().n;
      const executionAudits=db.prepare("SELECT COUNT(*) n FROM audit_log WHERE entity_type='mt_document' AND action='execute'").get().n;
      assert.equal(executionAudits,executedDocs,'every successful execution is audited');
      for (const row of db.prepare("SELECT changes FROM audit_log WHERE action='execute'").all())
        assert.deepEqual(JSON.parse(row.changes).status,{old:'pending_execution',new:'executed'});
      assert.equal(db.prepare('SELECT executed_by_user_id e,execution_date d FROM mt_documents WHERE id=?').get(issue.id).e,'clerk');
    } finally {
      await new Promise<void>((ok,bad)=>server.close((error:Error)=>error?bad(error):ok()));
      db.close();
    }
  `);
  try {
    execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
