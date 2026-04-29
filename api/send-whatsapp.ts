import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, text } = req.body as { to?: string; text?: string };

  if (!to || !text) {
    return res.status(400).json({ error: 'Faltan campos: to y text son requeridos' });
  }

  const token = process.env.WASENDERAPI_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Token de WhatsApp no configurado' });
  }

  try {
    const response = await fetch('https://wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, text }),
    });

    const raw = await response.text();
    let data: unknown = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: raw || response.statusText };
    }
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('❌ Error al enviar WhatsApp:', error);
    return res.status(500).json({ error: 'Error al conectar con el servicio de WhatsApp' });
  }
}
