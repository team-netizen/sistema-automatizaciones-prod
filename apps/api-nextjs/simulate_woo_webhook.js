const crypto = require('crypto');
const http = require('http');

const EMPRESA_ID = '6a68e800-41df-4d10-84c9-6a3cddd9241f';
const WEBHOOK_TOKEN = 'secret_woo_123';
const API_URL = 'http://localhost:3000/api/webhooks/woocommerce';

const payload = {
    id: 12345,
    number: "WC-12345",
    status: "processing",
    total: "150.00",
    currency: "USD",
    date_created: new Date().toISOString(),
    billing: {
        first_name: "Juan",
        last_name: "Pérez",
        address_1: "Calle Falsa 123",
        city: "Lima",
        state: "Lima",
        postcode: "15001",
        country: "PE",
        email: "juan@example.com",
        phone: "987654321"
    },
    shipping: {
        first_name: "Juan",
        last_name: "Pérez",
        address_1: "Calle Falsa 123",
        city: "Lima",
        state: "Lima",
        postcode: "15001",
        country: "PE"
    },
    payment_method_title: "Contra Entrega",
    line_items: [
        {
            id: 101,
            name: "Camiseta Básica",
            product_id: 10,
            quantity: 2,
            sku: "CAM-001",
            price: "25.00",
            total: "50.00"
        }
    ],
    meta_data: [
        { key: "_billing_dni", value: "12345678" }
    ]
};

const rawBody = JSON.stringify(payload);
const signature = crypto
    .createHmac('sha256', WEBHOOK_TOKEN)
    .update(rawBody)
    .digest('base64');

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-empresa-id': EMPRESA_ID,
        'x-wc-webhook-signature': signature
    }
};

const req = http.request(API_URL, options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response:', data);
    });
});

req.on('error', (err) => {
    console.error('Error:', err.message);
});

req.write(rawBody);
req.end();
