import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from './auth.js';
import authRouter from './routes/auth.js';
import companiesRouter from './routes/companies.js';
import contactsRouter from './routes/contacts.js';
import activitiesRouter from './routes/activities.js';
import inquiriesRouter from './routes/inquiries.js';
import tasksRouter from './routes/tasks.js';
import quotationsRouter from './routes/quotations.js';
import ordersRouter from './routes/orders.js';
import shipmentsRouter from './routes/shipments.js';
import paymentsRouter from './routes/payments.js';
import pipelineRouter from './routes/pipeline.js';
import sampleRequestsRouter from './routes/sample-requests.js';
import inventoryRouter from './routes/inventory.js';
import { auditRouter } from './audit.js';
import teamRouter from './routes/team.js';
import db from './db.js';
import {
  createMaterialsToolingRouter,
  materialsJsonParseErrorHandler,
} from './routes/materials-tooling.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '127.0.0.1';

// ── Production: serve built frontend ──
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
}

app.use(cors({
  origin: [
    "https://crm.xuyaoting.com",
    "https://admin.xuyaoting.com",
    /^https?:\/\/localhost(:\d+)?$/,
  ],
  credentials: true,
}));
app.use(express.json());
app.use(materialsJsonParseErrorHandler);

// ── Public endpoints (no auth required) ──

app.get('/api/config', (_req, res) => {
  res.json({ authEnabled: true });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public — registration and token verification)
app.use('/api/auth', authRouter);

// ── Auth middleware — all routes below require Bearer token ──
app.use('/api', authMiddleware);

// ── Protected API routes ──
app.use('/api/companies', companiesRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/activities', activitiesRouter);
// Legacy compatibility API: the UI uses quotations as the primary sales entry,
// but existing integrations and historical records still use Inquiry routes.
app.use('/api/inquiries', inquiriesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/quotations', quotationsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/shipments', shipmentsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/sample-requests', sampleRequestsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/audit', auditRouter);
app.use('/api/team', teamRouter);
app.use('/api/materials-tooling', createMaterialsToolingRouter(db));

// ── Production SPA fallback: serve index.html for all non-API routes ──
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`CRM Server running on http://${HOST}:${PORT}`);
});
