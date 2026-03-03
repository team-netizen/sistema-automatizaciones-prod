
import crypto from 'crypto';

/**
 * Valida la firma de un webhook de WooCommerce (HMAC SHA256).
 */
export function validarFirmaWooCommerce(payload: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('base64');
    return digest === signature;
}

/**
 * Valida que los datos mínimos de un pedido existan según el proveedor
 */
export function validarCamposPedido(proveedor: string, body: any): boolean {
    if (proveedor === 'woocommerce') {
        return !!(body.id && body.line_items && Array.isArray(body.line_items));
    }
    if (proveedor === 'kommo') {
        // Validación básica para Kommo leads
        return !!(body.leads?.add?.length > 0 || body.id);
    }
    return false;
}
