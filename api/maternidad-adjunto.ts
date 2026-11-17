import type { VercelRequest, VercelResponse } from '@vercel/node';
import { documentosFijosMaternidad } from './_lib/maternidadPlantillas';

// Documentos fijos que acompañan cada cotización de maternidad (checklist y boletín), para verlos desde
// la pantalla Correos Maternidad. El presupuesto no está aquí: se vuelve a armar en el navegador.
//   GET /api/maternidad-adjunto?tipo=checklist | boletin

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  const tipo = Array.isArray(req.query.tipo) ? req.query.tipo[0] : req.query.tipo;
  const documento = documentosFijosMaternidad().find((d) => d.tipo === tipo);
  if (!documento) return res.status(404).json({ ok: false, error: 'tipo debe ser checklist o boletin' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${documento.nombre}"`);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.status(200).send(Buffer.from(documento.contenido));
}
