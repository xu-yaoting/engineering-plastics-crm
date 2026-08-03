import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const packageUrl = pathToFileURL(path.join(root, 'package.json')).href;
const routerUrl = pathToFileURL(path.join(root, 'server/routes/materials-tooling.ts')).href;
const schemaUrl = pathToFileURL(path.join(root, 'server/materials-tooling/schema.ts')).href;
const attachmentsUrl = pathToFileURL(path.join(root, 'server/materials-tooling/attachments.ts')).href;

test('attachment commit rechecks document state before inserting metadata', () => {
  const source = readFileSync(path.join(root, 'server/materials-tooling/attachments.ts'), 'utf8');
  const transaction = source.indexOf('const row = database.transaction(() => {');
  const recheck = source.indexOf('const currentDocument = requireDocument(documentId);', transaction);
  const insert = source.indexOf('INSERT INTO mt_attachments', transaction);
  assert(transaction >= 0 && recheck > transaction && insert > recheck);
  assert.match(source, /status: \{ old: currentDocument\.status, new: 'completed' \}/);
});

test('materials attachments stay private, permission-safe, signed and transactionally consistent', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mt-attachments-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createHash } from 'node:crypto';
    import { createRequire } from 'node:module';
    import { readdirSync } from 'node:fs';
    const require=createRequire(${JSON.stringify(packageUrl)}); const Database=require('better-sqlite3'); const express=require('express');
    const {ensureMaterialsToolingSchema}=await import(${JSON.stringify(schemaUrl)});
    const {MAX_ATTACHMENT_BYTES}=await import(${JSON.stringify(attachmentsUrl)});
    const {createMaterialsToolingRouter}=await import(${JSON.stringify(routerUrl)});
    const db=new Database(':memory:'); db.pragma('foreign_keys=ON'); db.exec(\`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1); CREATE TABLE audit_log(id TEXT PRIMARY KEY,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,user_id TEXT,user_name TEXT NOT NULL,action TEXT NOT NULL,changes TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);\`); ensureMaterialsToolingSchema(db);
    for(const user of [['admin','Admin','admin'],['member','Member','member'],['clerk','Moana','member'],['uploader','Uploader','member']]) db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(...user);
    db.prepare("INSERT INTO mt_permissions(user_id,manage_materials,approve,view_prices,manage_periods,updated_by,updated_at) VALUES('clerk',1,0,1,0,'admin','x'),('uploader',1,0,0,0,'admin','x')").run();
    function document(id,status='executed',type='material_issue'){const prefix=type==='purchase_receipt'?'GR':type==='purchase_request'?'PR':'MI';db.prepare(\`INSERT INTO mt_documents(id,document_number,document_type,version,status,applicant_user_id,request_date,created_by,updated_by,created_at,updated_at) VALUES(?,?, ?,1,?,'member','2026-07-15','member','admin','x','x')\`).run(id,prefix+'-2026-'+id.slice(-4).padStart(4,'0'),type,status)}
    document('doc0001'); document('doc0002','awaiting_signed_copy'); document('doc0003','awaiting_signed_copy'); document('doc0004','voided');
    const procurementCases=[
      ['doc0005','purchase_receipt','signed_copy'],['doc0006','purchase_request','signed_copy'],
      ['doc0007','purchase_receipt','delivery_note'],['doc0008','purchase_request','delivery_note'],
      ['doc0009','purchase_receipt','acceptance_record'],['doc0010','purchase_request','acceptance_record'],
    ];
    for(const [id,type] of procurementCases) document(id,'awaiting_signed_copy',type);
    for(const id of ['doc0001','doc0002','doc0003',...procurementCases.map(([id])=>id)]){const snapshot=JSON.stringify({header:{id},lines:[]}); db.prepare("INSERT INTO mt_document_versions(document_id,version,snapshot_json,snapshot_sha256,submitted_by,submitted_at) VALUES(?,1,?,?, 'member','x')").run(id,snapshot,createHash('sha256').update(snapshot).digest('hex'))} db.prepare("INSERT INTO mt_snapshots(id,document_id,version,variant,relative_path,sha256,created_by,created_at) VALUES('snap','doc0002',1,'approved','private/doc.pdf','hash','admin','x')").run();
    let clock=Date.parse('2026-07-15T00:00:00.000Z'); const users=new Map([['admin',{id:'admin',name:'Admin',role:'admin'}],['member',{id:'member',name:'Member',role:'member'}],['clerk',{id:'clerk',name:'Moana',role:'member'}],['uploader',{id:'uploader',name:'Uploader',role:'member'}]]);
    const previousJwt=process.env.JWT_SECRET; delete process.env.JWT_SECRET; const missingSecretRouter=createMaterialsToolingRouter(db,{attachments:{storageRoot:${JSON.stringify(directory)},now:()=>new Date(clock)}}); process.env.JWT_SECRET='env-secret'; const environmentSecretRouter=createMaterialsToolingRouter(db,{attachments:{storageRoot:${JSON.stringify(directory)},now:()=>new Date(clock)}}); if(previousJwt===undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET=previousJwt;
    const app=express(); app.use((req,_res,next)=>{req.user=users.get(String(req.headers['x-user']));next()}); app.use('/api/materials-tooling',createMaterialsToolingRouter(db,{attachments:{storageRoot:${JSON.stringify(directory)},tokenSecret:'test-secret',now:()=>new Date(clock)}})); app.use('/missing-sign',missingSecretRouter); app.use('/env-sign',environmentSecretRouter);
    const server=await new Promise((ok,bad)=>{const s=app.listen(0,'127.0.0.1',()=>ok(s));s.on('error',bad)}); const address=server.address(); const base='http://127.0.0.1:'+address.port+'/api/materials-tooling';
    async function upload(documentId,user,filename,mime,category='other',bytes=new TextEncoder().encode('file'),extra={}){const form=new FormData();form.set('category',category);for(const [key,value] of Object.entries(extra))form.set(key,String(value));form.set('file',new Blob([bytes],{type:mime}),filename);const response=await fetch(base+'/documents/'+documentId+'/attachments',{method:'POST',headers:{'x-user':user},body:form});return {status:response.status,body:await response.json()}}
    async function json(pathname,user='member',method='GET'){const response=await fetch(base+pathname,{method,headers:{'x-user':user,'content-type':'application/json'},body:method==='POST'?'{}':undefined});return {status:response.status,body:await response.json()}}
    try {
      assert.equal(typeof MAX_ATTACHMENT_BYTES,'number');
      assert.equal((await upload('doc0001','member','note.pdf','application/pdf')).status,403);
      assert.equal((await upload('doc0001','clerk','note.txt','text/plain')).status,400);
      assert.equal((await upload('doc0001','clerk','note.pdf','image/png')).status,400);
      assert.equal((await upload('doc0001','clerk','..evil.pdf','application/pdf')).status,400);
      assert.equal((await upload('doc0004','clerk','old.pdf','application/pdf')).status,409);
      assert.equal((await upload('doc0001','uploader','contract.pdf','application/pdf','contract')).status,403);
      const ordinary=await upload('doc0001','clerk','warehouse note.pdf','application/pdf'); assert.equal(ordinary.status,201,JSON.stringify(ordinary.body)); const ordinaryId=ordinary.body.attachment.id;
      assert.equal('stored_name' in ordinary.body.attachment,false); const storedName=db.prepare('SELECT stored_name FROM mt_attachments WHERE id=?').get(ordinaryId).stored_name; assert.notEqual(storedName,'warehouse note.pdf'); assert.match(storedName,/^[0-9a-f-]+\.pdf$/); assert.equal(readdirSync(${JSON.stringify(directory)}).includes(storedName),true);
      const sensitive=await upload('doc0001','clerk','invoice.pdf','application/pdf','invoice'); assert.equal(sensitive.status,201); assert.equal(sensitive.body.attachment.is_sensitive,true); const sensitiveId=sensitive.body.attachment.id;
      const listMember=await json('/documents/doc0001/attachments'); assert.deepEqual(listMember.body.attachments.map(row=>row.id),[ordinaryId]); assert(!JSON.stringify(listMember.body).includes('invoice.pdf'));
      const listClerk=await json('/documents/doc0001/attachments','clerk'); assert.equal(listClerk.body.attachments.length,2);
      const ordinaryDownload=await fetch(base+'/attachments/'+ordinaryId+'/download',{headers:{'x-user':'member'}}); assert.equal(ordinaryDownload.status,200); assert.equal(await ordinaryDownload.text(),'file'); assert.match(ordinaryDownload.headers.get('content-disposition')??'',/^attachment;/); assert(!(ordinaryDownload.headers.get('content-disposition')??'').includes(${JSON.stringify(directory)}));
      assert.equal((await fetch(base+'/attachments/'+sensitiveId+'/download',{headers:{'x-user':'member'}})).status,403); assert.equal((await fetch(base+'/attachments/'+sensitiveId+'/download',{headers:{'x-user':'clerk'}})).status,200);
      const signed=await json('/attachments/'+sensitiveId+'/signed-url','clerk','POST'); assert.equal(signed.status,200); assert(Date.parse(signed.body.expiresAt)-clock<=60000); const signedUrl=signed.body.url; assert.equal((await fetch('http://127.0.0.1:'+address.port+signedUrl,{headers:{'x-user':'clerk'}})).status,200); assert.equal((await fetch('http://127.0.0.1:'+address.port+signedUrl+'x',{headers:{'x-user':'clerk'}})).status,403); clock+=61000; assert.equal((await fetch('http://127.0.0.1:'+address.port+signedUrl,{headers:{'x-user':'clerk'}})).status,403);
      assert.equal((await fetch('http://127.0.0.1:'+address.port+'/missing-sign/attachments/'+ordinaryId+'/signed-url',{method:'POST',headers:{'x-user':'clerk','content-type':'application/json'},body:'{}'})).status,503); assert.equal((await fetch('http://127.0.0.1:'+address.port+'/env-sign/attachments/'+ordinaryId+'/signed-url',{method:'POST',headers:{'x-user':'clerk','content-type':'application/json'},body:'{}'})).status,200);
      const versionsBefore=db.prepare("SELECT COUNT(*) n FROM mt_document_versions WHERE document_id='doc0002'").get().n; const snapshotsBefore=db.prepare("SELECT COUNT(*) n FROM mt_snapshots WHERE document_id='doc0002'").get().n; const signedCopy=await upload('doc0002','clerk','signed.jpg','image/jpeg','signed_copy'); assert.equal(signedCopy.status,201); assert.equal(db.prepare("SELECT status FROM mt_documents WHERE id='doc0002'").get().status,'completed'); assert.equal(db.prepare("SELECT COUNT(*) n FROM mt_document_versions WHERE document_id='doc0002'").get().n,versionsBefore); assert.equal(db.prepare("SELECT COUNT(*) n FROM mt_snapshots WHERE document_id='doc0002'").get().n,snapshotsBefore);
      for(const [documentId,documentType,category] of procurementCases){
        const filename=documentType+'-'+category+'.pdf';
        assert.equal((await upload(documentId,'uploader',filename,'application/pdf',category)).status,403,documentType+' '+category+' upload must require price access');
        const procurementAttachment=await upload(documentId,'clerk',filename,'application/pdf',category); assert.equal(procurementAttachment.status,201,JSON.stringify(procurementAttachment.body)); assert.equal(procurementAttachment.body.attachment.is_sensitive,true);
        const procurementAttachmentId=procurementAttachment.body.attachment.id; assert.equal((await json('/documents/'+documentId+'/attachments','member')).body.attachments.length,0); assert.equal((await fetch(base+'/attachments/'+procurementAttachmentId+'/download',{headers:{'x-user':'member'}})).status,403); assert.equal((await fetch(base+'/attachments/'+procurementAttachmentId+'/download',{headers:{'x-user':'clerk'}})).status,200);
      }
      const filesBeforeFailure=readdirSync(${JSON.stringify(directory)}).sort(); db.exec(\`CREATE TRIGGER fail_attachment_audit BEFORE INSERT ON audit_log WHEN NEW.action='upload_attachment' BEGIN SELECT RAISE(ABORT,'audit fail'); END\`); const failed=await upload('doc0003','clerk','failed.jpg','image/jpeg','signed_copy'); assert.equal(failed.status,500); db.exec('DROP TRIGGER fail_attachment_audit'); assert.deepEqual(readdirSync(${JSON.stringify(directory)}).sort(),filesBeforeFailure); assert.equal(db.prepare("SELECT COUNT(*) n FROM mt_attachments WHERE document_id='doc0003'").get().n,0); assert.equal(db.prepare("SELECT status FROM mt_documents WHERE id='doc0003'").get().status,'awaiting_signed_copy');
      const oversized=await upload('doc0001','clerk','large.pdf','application/pdf','other',new Uint8Array(MAX_ATTACHMENT_BYTES+1)); assert.equal(oversized.status,413); assert(!JSON.stringify(oversized.body).toLowerCase().includes('stack'));
      assert.equal((await json('/'+storedName,'member')).status,404,'stored names are not static routes');
      const auditText=JSON.stringify(db.prepare("SELECT changes FROM audit_log WHERE action IN ('upload_attachment','download_attachment')").all()); assert(!auditText.includes(${JSON.stringify(directory)})); assert(!auditText.includes('invoice.pdf'));
    } finally {await new Promise((ok,bad)=>server.close(error=>error?bad(error):ok()));db.close()}
  `);
  try { execFileSync(tsx,[runner],{cwd:root,stdio:'pipe'}); }
  finally { rmSync(directory,{recursive:true,force:true}); }
});
