export interface EmailTemplate {
  id: string;
  category: string;
  title: string;
  subject: string;
  body: string;
  variables: string[];
}

const templates: EmailTemplate[] = [
  // ── Development / Cold Outreach ──
  {
    id: 'dev-general',
    category: 'Development',
    title: 'General Cold Outreach',
    subject: '{{company}} — High-Performance Engineering Plastics Supply',
    body: `Dear {{contact}},

I hope this message finds you well.

We are a professional supplier of high-performance engineering plastics, specializing in {{product}} and other advanced materials for the {{industry}} industry.

We have extensive experience supplying to leading companies in your sector and would be happy to discuss how our materials can support your upcoming projects.

Could we schedule a brief call next week to explore potential collaboration?

Best regards,
{{sender}}
{{sender_phone}}`,
    variables: ['company', 'contact', 'product', 'industry', 'sender', 'sender_phone'],
  },
  {
    id: 'dev-peek',
    category: 'Development',
    title: 'PEEK Supply Outreach',
    subject: 'PEEK {{product}} Supply — {{company}}',
    body: `Dear {{contact}},

We are writing to introduce ourselves as a reliable supplier of PEEK (Polyether Ether Ketone) in various forms including sheet, rod, tube, and custom profiles.

Our PEEK materials offer:
• Continuous service temperature up to 260°C
• Excellent chemical resistance
• High mechanical strength
• UL94 V-0 rated grades available

We currently stock {{product}} with short lead times and competitive pricing.

Would you be interested in receiving our latest stock list and pricing?

Looking forward to hearing from you.

Best regards,
{{sender}}
{{sender_email}}`,
    variables: ['contact', 'company', 'product', 'sender', 'sender_email'],
  },

  // ── Quotation / Pricing ──
  {
    id: 'quote-cover',
    category: 'Quotation',
    title: 'Quotation Cover Letter',
    subject: 'Quotation — {{product}} for {{company}}',
    body: `Dear {{contact}},

Thank you for your inquiry regarding {{product}}.

Please find attached our quotation {{quotation_number}} with the following details:

• Product: {{product}}
• Quantity: {{quantity}}
• Total Amount: {{total}}
• Validity: {{valid_until}}
• Delivery: {{delivery_term}}

We look forward to your feedback. Should you have any questions or require further technical information, please do not hesitate to contact us.

Best regards,
{{sender}}
{{sender_email}}`,
    variables: ['contact', 'company', 'product', 'quotation_number', 'quantity', 'total', 'valid_until', 'delivery_term', 'sender', 'sender_email'],
  },
  {
    id: 'quote-followup',
    category: 'Quotation',
    title: 'Quotation Follow-up',
    subject: 'Following up on Quotation {{quotation_number}} — {{product}}',
    body: `Dear {{contact}},

I hope this message finds you well.

I am writing to follow up on the quotation {{quotation_number}} we sent on {{date}} regarding {{product}}.

We would be happy to:
• Provide additional technical data or samples
• Discuss volume discounts
• Adjust delivery schedules to meet your requirements

Please let us know if you have any questions or need further information.

Best regards,
{{sender}}
{{sender_email}}`,
    variables: ['contact', 'company', 'quotation_number', 'product', 'date', 'sender', 'sender_email'],
  },

  // ── Follow-up / Nurture ──
  {
    id: 'followup-sample',
    category: 'Follow-up',
    title: 'Sample Follow-up',
    subject: 'Following up on PEEK Sample — {{company}}',
    body: `Dear {{contact}},

I hope the sample of {{product}} has arrived safely.

We would love to hear your feedback on the material performance. Do you have any initial test results or observations you could share?

If you need any technical support during your evaluation, our engineering team is ready to assist.

Looking forward to your update.

Best regards,
{{sender}}
{{sender_email}}`,
    variables: ['contact', 'company', 'product', 'sender', 'sender_email'],
  },
  {
    id: 'followup-silent',
    category: 'Follow-up',
    title: 'Re-engagement (Silent Customer)',
    subject: 'Checking in — {{company}}',
    body: `Dear {{contact}},

It has been some time since we last connected, and I wanted to check in to see if you have any ongoing or upcoming projects where we might be able to support you with high-performance engineering plastics.

We have recently updated our product range and pricing, which may be of interest.

Would you be open to a quick call to discuss your current requirements?

Best regards,
{{sender}}
{{sender_email}}`,
    variables: ['contact', 'company', 'sender', 'sender_email'],
  },

  // ── Order / Logistics ──
  {
    id: 'order-confirm',
    category: 'Order',
    title: 'Order Confirmation',
    subject: 'Order Confirmation {{order_number}} — {{company}}',
    body: `Dear {{contact}},

Thank you for your order. We are pleased to confirm the following:

Order Number: {{order_number}}
Product: {{product}}
Quantity: {{quantity}}
Total Amount: {{total}}
Expected Delivery: {{delivery_date}}

We will keep you updated on the production progress and shipping status.

Should you have any questions, please feel free to reach out.

Best regards,
{{sender}}
{{sender_email}}`,
    variables: ['contact', 'company', 'order_number', 'product', 'quantity', 'total', 'delivery_date', 'sender', 'sender_email'],
  },
  {
    id: 'order-shipment',
    category: 'Order',
    title: 'Shipment Notification',
    subject: 'Shipment Notification {{order_number}} — {{tracking}}',
    body: `Dear {{contact}},

We are pleased to inform you that your order {{order_number}} has been shipped.

Shipping Details:
• Carrier: {{carrier}}
• Tracking Number: {{tracking_number}}
• Estimated Delivery: {{delivery_date}}

Please find attached the packing list and certificate of analysis.

Thank you for your business!

Best regards,
{{sender}}
{{sender_email}}`,
    variables: ['contact', 'company', 'order_number', 'carrier', 'tracking_number', 'delivery_date', 'sender', 'sender_email'],
  },

  // ── Seasonal / Holiday ──
  {
    id: 'holiday-cny',
    category: 'Holiday',
    title: 'Chinese New Year Closing Notice',
    subject: 'Chinese New Year Holiday Notice — {{year}}',
    body: `Dear {{contact}},

Please be advised that our office will be closed from {{start_date}} to {{end_date}} for the Chinese New Year holiday.

Normal operations will resume on {{resume_date}}.

To ensure your orders are not delayed, we recommend placing orders before {{deadline}}.

We wish you a wonderful holiday season!

Best regards,
{{sender}}
{{sender_email}}`,
    variables: ['contact', 'year', 'start_date', 'end_date', 'resume_date', 'deadline', 'sender', 'sender_email'],
  },
  {
    id: 'holiday-christmas',
    category: 'Holiday',
    title: 'Christmas & New Year Greetings',
    subject: 'Seasons Greetings from {{sender_company}}',
    body: `Dear {{contact}},

As the year comes to a close, we want to express our sincere gratitude for your continued trust and partnership throughout {{year}}.

We look forward to working with you in the coming year and wish you and your family a joyful holiday season and a prosperous New Year.

Our office will be closed from {{start_date}} to {{end_date}}.

Warmest regards,
{{sender}}
{{sender_company}}`,
    variables: ['contact', 'year', 'start_date', 'end_date', 'sender', 'sender_company'],
  },

  // ── Payment ──
  {
    id: 'payment-reminder',
    category: 'Payment',
    title: 'Payment Reminder',
    subject: 'Payment Reminder — Invoice {{invoice_number}}',
    body: `Dear {{contact}},

This is a friendly reminder that invoice {{invoice_number}} for {{amount}} was due on {{due_date}} and is now overdue.

Details:
• Invoice: {{invoice_number}}
• Amount Due: {{amount}}
• Due Date: {{due_date}}
• Days Overdue: {{days_overdue}}

We would appreciate your prompt payment. Please let us know if there are any issues we should discuss.

Best regards,
{{sender}}
{{sender_email}}`,
    variables: ['contact', 'invoice_number', 'amount', 'due_date', 'days_overdue', 'sender', 'sender_email'],
  },
];

export function getTemplatesByCategory(category?: string): EmailTemplate[] {
  if (category) return templates.filter(t => t.category === category);
  return templates;
}

export function getCategories(): string[] {
  return [...new Set(templates.map(t => t.category))];
}

export function fillTemplate(template: EmailTemplate, variables: Record<string, string>): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replaceAll(placeholder, value || `[${key}]`);
    body = body.replaceAll(placeholder, value || `[${key}]`);
  }
  return { subject, body };
}

export default templates;
