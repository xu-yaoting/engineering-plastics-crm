import { v4 as uuidv4 } from 'uuid';
import db from './db.js';

const now = new Date().toISOString();
const today = now.slice(0, 10);

function seed() {
  // ---- Companies ----
  const companies = [
    { id: uuidv4(), name: 'Acme Aerospace Corp', type: 'end_user', industry: 'aerospace', country: 'US', city: 'Los Angeles', state: 'California', class: 'A', credit_limit: 100000 },
    { id: uuidv4(), name: 'MedTech Instruments Inc', type: 'end_user', industry: 'medical', country: 'US', city: 'Boston', state: 'MA', class: 'A', credit_limit: 75000 },
    { id: uuidv4(), name: 'Precision Parts Co', type: 'oem', industry: 'automotive', country: 'US', city: 'Detroit', state: 'MI', class: 'B', credit_limit: 50000 },
    { id: uuidv4(), name: 'AeroFit Industries', type: 'end_user', industry: 'aerospace', country: 'US', city: 'Seattle', state: 'WA', class: 'B', credit_limit: 40000 },
    { id: uuidv4(), name: 'TechPlast Distributors', type: 'distributor', industry: 'general_engineering', country: 'CN', city: 'Shanghai', class: 'C', credit_limit: 25000 },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO companies (id, name, company_type, industry, country, city, state_province,
      classification, credit_limit, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `);

  for (const c of companies) {
    stmt.run(c.id, c.name, c.type, c.industry, c.country, c.city, c.state, c.class, c.credit_limit, now, now);
  }

  // ---- Contacts ----
  const contacts = [
    { company_id: companies[0].id, first: 'John', last: 'Chen', title: 'Sr. Procurement Manager', role: 'procurement', email: 'john@acme.aero', primary: true, dm: true },
    { company_id: companies[0].id, first: 'Lisa', last: 'Park', title: 'R&D Engineer', role: 'engineering', email: 'lpark@acme.aero', primary: false, dm: false },
    { company_id: companies[1].id, first: 'David', last: 'Miller', title: 'Purchasing Director', role: 'procurement', email: 'david@medtech.com', primary: true, dm: true },
    { company_id: companies[2].id, first: 'Mike', last: 'Johnson', title: 'Quality Manager', role: 'quality', email: 'mike@precision-parts.com', primary: true, dm: false },
    { company_id: companies[3].id, first: 'Sarah', last: 'Wilson', title: 'Supply Chain Mgr', role: 'procurement', email: 'swilson@aerofit.com', primary: true, dm: true },
  ];

  const cStmt = db.prepare(`
    INSERT OR IGNORE INTO contacts (id, company_id, first_name, last_name, job_title,
      role_in_process, email, is_primary_contact, is_decision_maker, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of contacts) {
    cStmt.run(uuidv4(), c.company_id, c.first, c.last, c.title, c.role, c.email, c.primary ? 1 : 0, c.dm ? 1 : 0, now, now);
  }

  // ---- Inquiries ----
  const inquiries = [
    { company_id: companies[0].id, desc: 'Need PEEK 450G sheet for compressor housing component. Operating temp up to 240°C with oil exposure.', material: 'PEEK 450G', qty: '500 sheets/year', urgency: 'immediate', budget: 12500 },
    { company_id: companies[1].id, desc: 'Looking for PAI 1000 sheet for medical instrument parts. Need FDA compliance.', material: 'PAI 1000', qty: '200 sheets', urgency: 'within_2_weeks', budget: 8200 },
    { company_id: companies[2].id, desc: 'Require PEEK CF30 rod for automotive bearing cages. High wear resistance needed.', material: 'PEEK CF30', qty: '200 kg', urgency: 'within_1_month', budget: 22400 },
    { company_id: companies[3].id, desc: 'Need PPS sheet for aircraft interior brackets. UL94 V-0 required.', material: 'PPS', qty: '100 sheets', urgency: 'within_1_month', budget: 3500 },
    { company_id: companies[4].id, desc: 'Distributor requesting PTFE sheet stock for various clients.', material: 'PTFE', qty: '500 kg', urgency: 'no_rush', budget: 4500 },
  ];

  let inqCount = 0;
  const iStmt = db.prepare(`
    INSERT OR IGNORE INTO inquiries (id, inquiry_number, company_id, source, application_description,
      target_material_requested, quantity_estimate, urgency, estimated_budget, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const i of inquiries) {
    inqCount++;
    const inqId = uuidv4();
    const inqNum = `INQ-${today.slice(2,4)}-${String(inqCount).padStart(4, '0')}`;
    iStmt.run(inqId, inqNum, i.company_id, 'email', i.desc, i.material, i.qty, i.urgency, i.budget, inqCount <= 2 ? 'open' : 'under_review', now, now);
  }

  // ---- Activities ----
  const activityTypes = ['call', 'email', 'note', 'status_change'];
  const activitySubjects = [
    'Called John — discussed PEEK test results',
    'Sent quotation QT-0031 to MedTech Inc',
    'Updated pricing tier for PEEK grades',
    'INQ-0042 status changed to Under Review',
    'Email received from David — RE: PAI inquiry',
  ];

  const aStmt = db.prepare(`
    INSERT OR IGNORE INTO activities (id, entity_type, entity_id, activity_type, subject, description, direction, created_at, updated_at)
    VALUES (?, 'company', ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < 5; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    aStmt.run(uuidv4(), companies[i % companies.length].id, activityTypes[i % activityTypes.length],
      activitySubjects[i], `Activity description for item ${i + 1}`, 'outbound', date.toISOString(), date.toISOString());
  }

  // ---- Tasks ----
  const tasks = [
    { subject: 'Review pricing for Acme Aerospace', priority: 'high', due: '2026-06-12', entity: companies[0].id, type: 'company' },
    { subject: 'Send updated COA to John Chen', priority: 'medium', due: '2026-06-14', entity: companies[0].id, type: 'company' },
    { subject: 'Prepare Q3 forecast', priority: 'medium', due: '2026-06-20', entity: null, type: null },
    { subject: 'Follow up on QT-0031 — MedTech Inc', priority: 'high', due: '2026-06-11', entity: companies[1].id, type: 'company' },
    { subject: 'Call Precision Parts — production update', priority: 'medium', due: '2026-06-15', entity: companies[2].id, type: 'company' },
  ];

  const tStmt = db.prepare(`
    INSERT OR IGNORE INTO tasks (id, subject, task_type, priority, status, due_date, entity_type, entity_id, created_at, updated_at)
    VALUES (?, ?, 'follow_up', ?, 'pending', ?, ?, ?, ?, ?)
  `);

  for (const t of tasks) {
    tStmt.run(uuidv4(), t.subject, t.priority, t.due, t.type, t.entity, now, now);
  }

  console.log('✅ Seed data inserted successfully');
  console.log(`   - ${companies.length} companies`);
  console.log(`   - ${contacts.length} contacts`);
  console.log(`   - ${inquiries.length} inquiries`);
  console.log(`   - ${activitySubjects.length} activities`);
  console.log(`   - ${tasks.length} tasks`);
}

seed();
