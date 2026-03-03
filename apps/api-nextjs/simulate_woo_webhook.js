const crypto = require('crypto');
const http = require('http');
const https = require('https');

const EMPRESA_ID = process.env.EMPRESA_ID;
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN;
const WEBHOOK_URL =
  process.env.WEBHOOK_URL ||
  'https://sistema-automatizaciones-backend.onrender.com/api/webhooks/woocommerce';

if (!EMPRESA_ID || !WEBHOOK_TOKEN) {
  console.error('Faltan variables: EMPRESA_ID y WEBHOOK_TOKEN.');
  process.exit(1);
}

const url = new URL(WEBHOOK_URL);
if (!url.searchParams.get('empresa_id')) {
  url.searchParams.set('empresa_id', EMPRESA_ID);
}

const payload = {
  id: Date.now(),
  number: `WC-${Date.now()}`,
  status: 'processing',
  total: '150.00',
  currency: 'USD',
  date_created: new Date().toISOString(),
  billing: {
    first_name: 'Juan',
    last_name: 'Perez',
    address_1: 'Calle Falsa 123',
    city: 'Lima',
    state: 'Lima',
    postcode: '15001',
    country: 'PE',
    email: 'juan@example.com',
    phone: '987654321',
  },
  shipping: {
    first_name: 'Juan',
    last_name: 'Perez',
    address_1: 'Calle Falsa 123',
    city: 'Lima',
    state: 'Lima',
    postcode: '15001',
    country: 'PE',
  },
  payment_method_title: 'Contra Entrega',
  line_items: [
    {
      id: 101,
      name: 'Producto de prueba',
      product_id: 10,
      quantity: 2,
      sku: process.env.TEST_SKU || 'CAM-001',
      price: '25.00',
      total: '50.00',
    },
  ],
  meta_data: [{ key: '_billing_dni', value: '12345678' }],
};

const rawBody = JSON.stringify(payload);
const signature = crypto
  .createHmac('sha256', WEBHOOK_TOKEN)
  .update(rawBody)
  .digest('base64');

const client = url.protocol === 'https:' ? https : http;

const req = client.request(
  {
    method: 'POST',
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    headers: {
      'Content-Type': 'application/json',
      'x-wc-webhook-signature': signature,
    },
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('Request URL:', url.toString());
      console.log('Status Code:', res.statusCode);
      console.log('Response:', data);
    });
  }
);

req.on('error', (err) => {
  console.error('Error:', err.message);
});

req.write(rawBody);
req.end();
