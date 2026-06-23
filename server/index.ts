import express from 'express';
import cors from 'cors';
import { authMiddleware, isAuthEnabled } from './auth.js';
import companiesRouter from './routes/companies.js';
import contactsRouter from './routes/contacts.js';
import activitiesRouter from './routes/activities.js';
import tasksRouter from './routes/tasks.js';
import inquiriesRouter from './routes/inquiries.js';
import quotationsRouter from './routes/quotations.js';
import ordersRouter from './routes/orders.js';
import shipmentsRouter from './routes/shipments.js';
import paymentsRouter from './routes/payments.js';
import pipelineRouter from './routes/pipeline.js';
import sampleRequestsRouter from './routes/sample-requests.js';
import inventoryRouter from './routes/inventory.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '127.0.0.1';

app.use(cors({
  origin: [
    "https://crm.xuyaoting.com",
    "https://admin.xuyaoting.com",
    /^https?:\/\/localhost(:\d+)?$/,
  ],
  credentials: true,
}));
app.use(express.json());

// ── Public endpoints (no auth required) ──

app.get('/api/config', (_req, res) => {
  res.json({ authEnabled: isAuthEnabled() });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Auth middleware — all routes below require x-api-key header ──
app.use('/api', authMiddleware);

// ── Protected API routes ──
app.use('/api/companies', companiesRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/inquiries', inquiriesRouter);
app.use('/api/quotations', quotationsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/shipments', shipmentsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/sample-requests', sampleRequestsRouter);
app.use('/api/inventory', inventoryRouter);

app.listen(PORT, HOST, () => {
  console.log(`CRM Server running on http://${HOST}:${PORT}`);
});
