import { Router, Request, Response } from 'express';
import db from '../db.js';

const router = Router();

interface PipelineCard {
  id: string;
  entityType: string;
  entityId: string;
  companyName: string;
  companyId: string;
  material: string;
  value: number;
  currency: string;
  owner: string;
  status: string;
  stage: string;
  nextAction: string;
  daysInStage: number;
  urgency?: string;
}

router.get('/', (_req: Request, res: Response) => {
  const cards: PipelineCard[] = [];

  // 1. Quotations → "Quotation" stage (primary sales entity)
  const quotations = db.prepare(`
    SELECT q.*, c.name as company_name
    FROM quotations q
    LEFT JOIN companies c ON q.company_id = c.id
    WHERE q.deleted_at IS NULL AND q.status IN ('draft', 'pending_approval', 'approved', 'sent', 'negotiating')
    ORDER BY q.created_at DESC
  `).all() as any[];

  for (const q of quotations) {
    const days = Math.floor((Date.now() - new Date(q.created_at).getTime()) / 86400000);
    const nextAction = q.status === 'draft' ? 'Finalize and send' :
                       q.status === 'sent' ? 'Follow up with customer' :
                       q.status === 'negotiating' ? 'Negotiate terms' :
                       q.status === 'accepted' ? 'Create order' : 'Review quotation';
    cards.push({
      id: `qt-${q.id}`,
      entityType: 'quotation',
      entityId: q.id,
      companyName: q.company_name || '—',
      companyId: q.company_id,
      material: q.target_material_requested || '—',
      value: q.total || 0,
      currency: q.currency || 'USD',
      owner: q.assigned_to || '—',
      status: q.status,
      stage: 'quotation',
      nextAction,
      daysInStage: days,
      urgency: q.urgency,
    });
  }

  // 3. Sample Requests → "Sample" stage
  const samples = db.prepare(`
    SELECT s.*, c.name as company_name
    FROM sample_requests s
    LEFT JOIN companies c ON s.company_id = c.id
    WHERE s.deleted_at IS NULL AND s.status IN ('approved', 'dispatched')
    ORDER BY s.created_at DESC
  `).all() as any[];

  for (const s of samples) {
    const days = Math.floor((Date.now() - new Date(s.created_at).getTime()) / 86400000);
    cards.push({
      id: `smp-${s.id}`,
      entityType: 'sample',
      entityId: s.id,
      companyName: s.company_name || '—',
      companyId: s.company_id,
      material: s.purpose?.slice(0, 60) || '—',
      value: s.sample_charge || 0,
      currency: 'USD',
      owner: s.assigned_to || '—',
      status: s.status,
      stage: 'sample',
      nextAction: s.status === 'approved' ? 'Dispatch sample' : 'Check tracking',
      daysInStage: days,
    });
  }

  // 4. Samples in testing → "Testing" stage
  const testing = db.prepare(`
    SELECT s.*, c.name as company_name
    FROM sample_requests s
    LEFT JOIN companies c ON s.company_id = c.id
    WHERE s.deleted_at IS NULL AND s.status IN ('delivered', 'testing_in_progress', 'testing_complete')
    ORDER BY s.created_at DESC
  `).all() as any[];

  for (const t of testing) {
    const days = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000);
    cards.push({
      id: `tst-${t.id}`,
      entityType: 'sample',
      entityId: t.id,
      companyName: t.company_name || '—',
      companyId: t.company_id,
      material: t.purpose?.slice(0, 60) || '—',
      value: 0,
      currency: 'USD',
      owner: t.assigned_to || '—',
      status: t.status,
      stage: 'testing',
      nextAction: t.status === 'delivered' ? 'Await test results' :
                  t.status === 'testing_in_progress' ? 'Check test progress' : 'Review results',
      daysInStage: days,
    });
  }

  // 5. Orders → "Order" stage
  const orders = db.prepare(`
    SELECT o.*, c.name as company_name
    FROM orders o
    LEFT JOIN companies c ON o.company_id = c.id
    WHERE o.deleted_at IS NULL AND o.status != 'cancelled'
    ORDER BY o.created_at DESC
  `).all() as any[];

  for (const o of orders) {
    const days = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86400000);
    const nextAction = o.status === 'draft' ? 'Confirm order' :
                       o.status === 'confirmed' ? 'Start production' :
                       o.status === 'in_production' ? 'Monitor production' :
                       o.status === 'quality_check' ? 'QC pending' :
                       o.status === 'ready_to_ship' ? 'Arrange shipping' : 'Update status';
    cards.push({
      id: `ord-${o.id}`,
      entityType: 'order',
      entityId: o.id,
      companyName: o.company_name || '—',
      companyId: o.company_id,
      material: '—',
      value: o.total || 0,
      currency: o.currency || 'USD',
      owner: o.assigned_to || '—',
      status: o.status,
      stage: 'order',
      nextAction,
      daysInStage: days,
    });
  }

  res.json(cards);
});

// Update stage — move card between columns
router.put('/move', (req: Request, res: Response) => {
  const { entityType, entityId, fromStage, toStage } = req.body;
  const now = new Date().toISOString();

  try {
    // Map: entityType → toStage → new status
    const stageMap: Record<string, Record<string, string>> = {
      inquiry: {
        inquiry: 'open',
        quotation: 'under_review',
        sample: 'quoted',
        order: 'closed_won',
      },
      quotation: {
        inquiry: 'draft',
        quotation: 'sent',
        sample: 'negotiating',
        order: 'accepted',
      },
      sample: {
        inquiry: 'draft',
        quotation: 'draft',
        sample: 'approved',
        testing: 'delivered',
        order: 'testing_complete',
      },
      order: {
        inquiry: 'draft',
        quotation: 'draft',
        sample: 'confirmed',
        testing: 'confirmed',
        order: 'confirmed',
      },
    };

    const transition = stageMap[entityType]?.[toStage];
    if (!transition) {
      return res.status(400).json({ error: `No valid transition from ${entityType} to ${toStage}` });
    }

    const tableName = entityType === 'sample' ? 'sample_requests' : `${entityType}s`;
    db.prepare(`UPDATE ${tableName} SET status = ?, updated_at = ? WHERE id = ?`)
      .run(transition, now, entityId);

    res.json({ success: true });
  } catch (e) {
    console.error('Move failed', e);
    res.status(500).json({ error: 'Move failed' });
  }
});

export default router;
