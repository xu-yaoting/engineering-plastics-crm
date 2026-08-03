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

test('materials reporting is exposed through authenticated HTTP routes', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mt-reporting-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createHash } from 'node:crypto';
    import { mkdirSync, writeFileSync } from 'node:fs';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const express = require('express');
    const XLSX = require('xlsx');
    const { ensureMaterialsToolingSchema } = await import(${JSON.stringify(schemaUrl)});
    const { createMaterialsToolingRouter } = await import(${JSON.stringify(routerUrl)});

    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(\`CREATE TABLE users (id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE audit_log (id TEXT PRIMARY KEY,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,user_id TEXT,user_name TEXT NOT NULL,action TEXT NOT NULL,changes TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);\`);
    ensureMaterialsToolingSchema(db);
    for (const user of [['admin','Admin','admin'],['member','Member','member'],['clerk','Moana','member']])
      db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(...user);
    db.prepare(\`INSERT INTO mt_permissions(user_id,manage_materials,approve,view_prices,manage_periods,updated_by,updated_at)
      VALUES('clerk',1,0,1,1,'admin','2026-07-01')\`).run();
    for (const item of [
      ['item-a','MAT-A','Brush','耗材','把',5],
      ['item-b','MAT-B','Unknown return','耗材','件',0],
      ['item-c','MAT-C','Zero denominator','工具','件',0],
    ]) db.prepare(\`INSERT INTO mt_items(id,code,name,category,unit,safety_quantity,created_by,updated_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,'admin','admin','x','x')\`).run(...item);
    db.prepare(\`INSERT INTO mt_suppliers(id,code,name,created_by,updated_by,created_at,updated_at)
      VALUES('supplier','SUP','Supplier','admin','admin','x','x')\`).run();
    db.prepare(\`INSERT INTO mt_movements(id,item_id,movement_type,quantity_delta,reference_unit_price,movement_date,created_by,created_at,source_workbook,cutover_period)
      VALUES('opening','item-a','opening_balance',10,5,'2026-06-30','admin','2026-06-30','cutover.xlsx','2026-06')\`).run();
    db.prepare(\`INSERT INTO mt_movements(id,item_id,movement_type,quantity_delta,reference_unit_price,movement_date,created_by,created_at,supplier_id,reference_quantity,source_workbook,cutover_period)
      VALUES('reference','item-a','reference_purchase',0,6,'2026-06-20','admin','2026-06-20','supplier',3,'history.xlsx','2026-06')\`).run();
    let seq=0;
    function movement(itemId:string,type:string,quantity:number,price:number|null,date:string,supplierId:string|null=null) {
      seq += 1; const documentId='doc-'+seq; const lineId='line-'+seq;
      const documentType=type==='void_reversal'?'count_adjustment':type;
      db.prepare(\`INSERT INTO mt_documents(id,document_number,document_type,status,applicant_user_id,request_date,execution_date,supplier_id,created_by,updated_by,created_at,updated_at)
        VALUES(?,?,?,'completed','member',?,?,?,'member','clerk','x','x')\`).run(documentId,'D-'+seq,documentType,date,date,supplierId);
      db.prepare(\`INSERT INTO mt_document_lines(id,document_id,line_number,material_item_id,requested_quantity,execution_quantity,unit,tax_inclusive_unit_price)
        VALUES(?,?,1,?,1,1,(SELECT unit FROM mt_items WHERE id=?),?)\`).run(lineId,documentId,itemId,itemId,price);
      const snapshot=JSON.stringify({header:{id:documentId,version:1,document_type:documentType,status:'pending_approval'},lines:[{id:lineId,material_item_id:itemId}]});
      db.prepare(\`INSERT INTO mt_document_versions(document_id,version,snapshot_json,snapshot_sha256,submitted_by,submitted_at)
        VALUES(?,1,?,?,?,?)\`).run(documentId,snapshot,createHash('sha256').update(snapshot).digest('hex'),'member',date);
      db.prepare(\`INSERT INTO mt_movements(id,item_id,document_id,document_line_id,movement_type,quantity_delta,reference_unit_price,movement_date,created_by,created_at,supplier_id)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)\`).run('movement-'+seq,itemId,documentId,lineId,type,quantity,price,date,'clerk',date,supplierId);
    }
    movement('item-a','purchase_receipt',4,8,'2026-07-02','supplier');
    movement('item-a','material_return',2,8,'2026-07-03');
    movement('item-a','material_issue',-3,82/14,'2026-07-04');
    movement('item-a','scrap',-1,82/14,'2026-07-05');
    movement('item-a','count_adjustment',2,8,'2026-07-06');
    movement('item-b','material_return',1,null,'2026-07-03');
    db.prepare(\`INSERT INTO mt_attachments(id,document_id,category,original_name,stored_name,mime_type,size_bytes,is_sensitive,uploaded_by,uploaded_at)
      VALUES('evidence','doc-1','invoice','invoice.pdf','private-uuid.pdf','application/pdf',123,1,'clerk','2026-07-02')\`).run();

    const app=express(); app.use(express.json());
    const actors=new Map([
      ['admin',{id:'admin',name:'Admin',role:'admin'}],
      ['member',{id:'member',name:'Member',role:'member'}],
      ['clerk',{id:'clerk',name:'Moana',role:'member'}],
    ]);
    app.use((req,_res,next)=>{req.user=actors.get(String(req.headers['x-user']??'admin'));next()});
    app.use('/mt',createMaterialsToolingRouter(db));
    const server=await new Promise((ok,bad)=>{const s=app.listen(0,'127.0.0.1',()=>ok(s));s.on('error',bad)});
    const address=server.address();
    try {
      const base='http://127.0.0.1:'+address.port+'/mt';
      const response=await fetch(base+'/overview');
      assert.equal(response.status,200);
      const pricedResponse=await fetch(base+'/ledger?month=2026-07',{headers:{'x-user':'clerk'}});
      assert.equal(pricedResponse.status,200);
      const priced=(await pricedResponse.json()).ledger;
      const a=priced.rows.find(row=>row.itemId==='item-a');
      assert.deepEqual({
        opening:a.opening.quantity,receipts:a.receipts.quantity,returns:a.returns.quantity,
        issues:a.issues.quantity,scrap:a.scrap.quantity,adjustment:a.adjustment.quantity,
        closing:a.closing.quantity,
      },{opening:10,receipts:4,returns:2,issues:3,scrap:1,adjustment:2,closing:14});
      assert.equal(a.closing.unitPrice,82/14);
      assert.equal(a.closing.amount,82);
      assert.equal(a.sources.receipts[0].documentNumber,'D-1');
      assert.equal(a.sources.receipts[0].referenceUnitPrice,8);
      assert.equal(a.sources.opening[0].kind,'movement');
      const importedOpening=a.sources.opening.find(source=>source.movementId==='opening');
      assert.equal(importedOpening.sourceWorkbook,'cutover.xlsx');
      assert.equal(priced.rows.find(row=>row.itemId==='item-b').returns.priceUnavailable,true);
      assert.equal(priced.rows.find(row=>row.itemId==='item-c').closing.unitPrice,0);
      assert.match(priced.referenceNotice,/not an accounting record/i);
      const filtered=await (await fetch(base+'/ledger?month=2026-07&search=Brush&category='+encodeURIComponent('耗材'),{headers:{'x-user':'clerk'}})).json();
      assert.deepEqual(filtered.ledger.rows.map(row=>row.itemId),['item-a']);

      const member=(await (await fetch(base+'/ledger?month=2026-07',{headers:{'x-user':'member'}})).json()).ledger;
      assert.equal(member.referenceNotice,undefined);
      assert.equal('unitPrice' in member.rows[0].opening,false);
      assert.equal('amount' in member.rows[0].closing,false);
      assert.equal('priceUnavailable' in member.rows[1].returns,false);
      assert.equal('referenceUnitPrice' in member.rows[0].sources.receipts[0],false);
      assert.equal(member.rows[0].sources.receipts[0].documentNumber,'D-1');
      assert.equal('referenceUnitPrice' in member.rows[0].sources.opening[0],false);
      assert.equal((await fetch(base+'/ledger?month=2026-13')).status,400);
      const historyResponse=await fetch(base+'/price-history/item-a',{headers:{'x-user':'clerk'}});
      assert.equal(historyResponse.status,200);
      const history=(await historyResponse.json()).priceHistory;
      assert.equal(history.latest.unitPrice,8);
      assert.equal(history.minimumUnitPrice,8);
      assert.equal(history.maximumUnitPrice,8);
      assert.equal(history.changeFromPrevious,null);
      assert.deepEqual(history.recentPurchases.map(row=>row.unitPrice),[8]);
      assert.equal(history.suppliers[0].supplierName,'Supplier');
      assert.deepEqual(history.latest.evidence,[{id:'evidence',category:'invoice',originalName:'invoice.pdf',mimeType:'application/pdf',sizeBytes:123,uploadedAt:'2026-07-02',notes:null}]);
      assert.equal(JSON.stringify(history).includes('private-uuid.pdf'),false);
      assert.equal((await fetch(base+'/price-history/item-a',{headers:{'x-user':'member'}})).status,403);

      const xlsxResponse=await fetch(base+'/ledger.xlsx?month=2026-07',{headers:{'x-user':'clerk'}});
      assert.equal(xlsxResponse.status,200);
      assert.match(xlsxResponse.headers.get('content-type')??'',/spreadsheetml/);
      const xlsxBuffer=Buffer.from(await xlsxResponse.arrayBuffer());
      const workbook=XLSX.read(xlsxBuffer,{type:'buffer'});
      const sheet=workbook.Sheets['月度明细账'];
      assert.equal(sheet.A3.v,'序号');
      assert.equal(sheet.D3.v,'期初结存');
      assert.equal(sheet.G3.v,'本期入库');
      assert.equal(sheet.J3.v,'领用发出');
      assert.equal(sheet.M3.v,'结存');
      assert.match(sheet.P5.v,/退回 2\.00/);
      assert.match(sheet.P5.v,/报废 1\.00/);
      assert.equal(sheet.P5.v.includes('盘点调整 +2.00'),true);
      assert.deepEqual(sheet['!merges'].slice(2),[
        {s:{r:2,c:3},e:{r:2,c:5}},{s:{r:2,c:6},e:{r:2,c:8}},
        {s:{r:2,c:9},e:{r:2,c:11}},{s:{r:2,c:12},e:{r:2,c:14}},
      ]);
      const memberWorkbook=XLSX.read(Buffer.from(await (await fetch(base+'/ledger.xlsx?month=2026-07',{headers:{'x-user':'member'}})).arrayBuffer()),{type:'buffer'});
      assert.equal(memberWorkbook.Sheets['月度明细账'].E3.v,'本期入库');
      assert.equal(memberWorkbook.Sheets['月度明细账'].E4.v,4,'member workbook contains quantities rather than hidden prices');

      const pdfResponse=await fetch(base+'/ledger.pdf?month=2026-07',{headers:{'x-user':'clerk'}});
      assert.equal(pdfResponse.status,200);
      assert.equal(pdfResponse.headers.get('content-type'),'application/pdf');
      const pdf=Buffer.from(await pdfResponse.arrayBuffer());
      assert.equal(pdf.subarray(0,4).toString(),'%PDF');
      assert.equal(pdf.toString('latin1').includes('/MediaBox [0 0 1190.55 841.89]'),true,'ledger PDF uses A3 landscape media box');
      if (process.env.MT_REPORTING_OUTPUT_DIR) {
        mkdirSync(process.env.MT_REPORTING_OUTPUT_DIR,{recursive:true});
        writeFileSync(process.env.MT_REPORTING_OUTPUT_DIR+'/materials-ledger-2026-07.xlsx',xlsxBuffer);
        writeFileSync(process.env.MT_REPORTING_OUTPUT_DIR+'/materials-ledger-2026-07.pdf',pdf);
      }

      db.prepare("UPDATE mt_documents SET status='pending_approval' WHERE id='doc-1'").run();
      let close=await fetch(base+'/periods/2026-07/close',{method:'POST',headers:{'x-user':'clerk','content-type':'application/json'},body:'{}'});
      assert.equal(close.status,409);
      assert.equal((await close.json()).error,'MATERIALS_PERIOD_BLOCKED');
      db.prepare("UPDATE mt_documents SET status='executed' WHERE id='doc-1'").run();
      close=await fetch(base+'/periods/2026-07/close',{method:'POST',headers:{'x-user':'clerk','content-type':'application/json'},body:'{}'});
      assert.equal(close.status,409,'missing signed copy blocks close');
      db.prepare("UPDATE mt_documents SET status='completed' WHERE id='doc-1'").run();
      db.prepare(\`INSERT INTO mt_documents(id,document_number,document_type,status,applicant_user_id,request_date,execution_date,created_by,updated_by,created_at,updated_at)
        VALUES('cross-period','MI-2026-9997','material_issue','pending_approval','member','2026-06-30','2026-07-01','member','member','x','x')\`).run();
      close=await fetch(base+'/periods/2026-07/close',{method:'POST',headers:{'x-user':'clerk','content-type':'application/json'},body:'{}'});
      assert.equal(close.status,409,'pending approval uses execution date when it crosses months');
      db.prepare("UPDATE mt_documents SET status='completed' WHERE id='cross-period'").run();
      close=await fetch(base+'/periods/2026-07/close',{method:'POST',headers:{'x-user':'clerk','content-type':'application/json'},body:'{}'});
      assert.equal(close.status,200,JSON.stringify(await close.clone().json()));
      assert.equal((await close.json()).period.status,'closed');
      assert.equal(db.prepare("SELECT COUNT(*) n FROM mt_period_snapshots WHERE period_key='2026-07'").get().n,1);

      db.prepare(\`INSERT INTO mt_movements(id,item_id,movement_type,quantity_delta,reference_unit_price,movement_date,created_by,created_at,source_workbook,cutover_period)
        VALUES('late-direct','item-c','opening_balance',2,9,'2026-07-20','admin','2026-07-20','late.xlsx','2026-07')\`).run();
      const frozen=(await (await fetch(base+'/ledger?month=2026-07',{headers:{'x-user':'clerk'}})).json()).ledger;
      assert.equal(frozen.status,'closed');
      assert.equal(frozen.rows.find(row=>row.itemId==='item-c').closing.quantity,0,'closed ledger reads immutable snapshot');
      const frozenMember=(await (await fetch(base+'/ledger?month=2026-07',{headers:{'x-user':'member'}})).json()).ledger;
      assert.equal('amount' in frozenMember.rows[0].closing,false);
      assert.equal('referenceUnitPrice' in frozenMember.rows[0].sources.receipts[0],false);
      const backdated=await fetch(base+'/documents',{method:'POST',headers:{'x-user':'member','content-type':'application/json'},body:JSON.stringify({request_date:'2026-07-20'})});
      assert.equal(backdated.status,409);
      assert.equal((await backdated.json()).error,'MATERIALS_PERIOD_CLOSED');
      db.prepare(\`INSERT INTO mt_documents(id,document_number,document_type,status,applicant_user_id,request_date,created_by,updated_by,created_at,updated_at)
        VALUES('closed-draft','MI-2026-9998','material_issue','draft','member','2026-07-21','member','member','x','x')\`).run();
      const blockedSubmit=await fetch(base+'/documents/closed-draft/submit',{method:'POST',headers:{'x-user':'member','content-type':'application/json'},body:'{}'});
      assert.equal(blockedSubmit.status,409);
      assert.equal((await blockedSubmit.json()).error,'MATERIALS_PERIOD_CLOSED');
      const blockedUpdate=await fetch(base+'/documents/doc-1',{method:'PUT',headers:{'x-user':'clerk','content-type':'application/json'},body:JSON.stringify({notes:'late edit'})});
      assert.equal(blockedUpdate.status,409);
      const blockedExecute=await fetch(base+'/documents/doc-1/execute',{method:'POST',headers:{'x-user':'clerk','content-type':'application/json'},body:'{}'});
      assert.equal(blockedExecute.status,409);
      assert.equal((await fetch(base+'/periods/2026-07/reopen',{method:'POST',headers:{'x-user':'clerk','content-type':'application/json'},body:JSON.stringify({reason:'fix'})})).status,403);
      assert.equal((await fetch(base+'/periods/2026-07/reopen',{method:'POST',headers:{'x-user':'admin','content-type':'application/json'},body:JSON.stringify({reason:' '})})).status,400);
      const reopened=await fetch(base+'/periods/2026-07/reopen',{method:'POST',headers:{'x-user':'admin','content-type':'application/json'},body:JSON.stringify({reason:'盘点复核'})});
      assert.equal(reopened.status,200);
      assert.equal((await reopened.json()).period.status,'open');
      close=await fetch(base+'/periods/2026-07/close',{method:'POST',headers:{'x-user':'clerk','content-type':'application/json'},body:'{}'});
      assert.equal(close.status,200);
      assert.deepEqual(db.prepare("SELECT version FROM mt_period_snapshots WHERE period_key='2026-07' ORDER BY version").all(),[{version:1},{version:2}]);
      const august=(await (await fetch(base+'/ledger?month=2026-08',{headers:{'x-user':'clerk'}})).json()).ledger;
      const augustA=august.rows.find(row=>row.itemId==='item-a');
      assert.deepEqual(augustA.opening,{quantity:14,unitPrice:82/14,amount:82},'next opening carries the latest closed snapshot rather than revaluing movements');
      assert.deepEqual(augustA.sources.opening,[{kind:'period_snapshot',periodKey:'2026-07',snapshotVersion:2}]);
      const augustMember=(await (await fetch(base+'/ledger?month=2026-08',{headers:{'x-user':'member'}})).json()).ledger;
      assert.deepEqual(augustMember.rows.find(row=>row.itemId==='item-a').sources.opening,[{kind:'period_snapshot',periodKey:'2026-07',snapshotVersion:2}]);
      assert.equal((await fetch(base+'/periods/2026-08/close',{method:'POST',headers:{'x-user':'clerk','content-type':'application/json'},body:'{}'})).status,200);
      let sequenceConflict=await fetch(base+'/periods/2026-07/reopen',{method:'POST',headers:{'x-user':'admin','content-type':'application/json'},body:JSON.stringify({reason:'must fail'})});
      assert.equal(sequenceConflict.status,409);
      assert.equal((await sequenceConflict.json()).error,'MATERIALS_PERIOD_SEQUENCE_CONFLICT');
      sequenceConflict=await fetch(base+'/periods/2026-06/close',{method:'POST',headers:{'x-user':'clerk','content-type':'application/json'},body:'{}'});
      assert.equal(sequenceConflict.status,409);
      assert.equal((await sequenceConflict.json()).error,'MATERIALS_PERIOD_SEQUENCE_CONFLICT');
      assert.throws(()=>db.prepare("UPDATE mt_period_snapshots SET snapshot_json='{}' WHERE period_key='2026-07'").run(),/immutable/);
      assert.throws(()=>db.prepare("DELETE FROM mt_period_snapshots WHERE period_key='2026-07'").run(),/immutable/);
      assert.deepEqual(db.prepare("SELECT action FROM audit_log WHERE entity_type='mt_period' ORDER BY created_at,rowid").all().map(row=>row.action),['close_period','reopen_period','close_period','close_period']);
    } finally {
      await new Promise((ok,bad)=>server.close(error=>error?bad(error):ok()));
      db.close();
    }
  `);
  try { execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
});
