import express from 'express';
import cors from 'cors';
import { authMiddleware, getApiKey } from './auth';
import companiesRouter from './routes/companies';
import contactsRouter from './routes/contacts';
import activitiesRouter from './routes/activities';
import tasksRouter from './routes/tasks';
import inquiriesRouter from './routes/inquiries';
import quotationsRouter from './routes/quotations';
import ordersRouter from './routes/orders';
import shipmentsRouter from './routes/shipments';
import paymentsRouter from './routes/payments';
import pipelineRouter from './routes/pipeline';
import sampleRequestsRouter from './routes/sample-requests';

const app = express();
const PORT = 3001;

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

// Config: frontend fetches the API key here on startup
app.get('/api/config', (_req, res) => {
  res.json({ apiKey: getApiKey() });
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

app.listen(PORT, () => {
  console.log(`CRM Server running on http://localhost:${PORT}`);
});
