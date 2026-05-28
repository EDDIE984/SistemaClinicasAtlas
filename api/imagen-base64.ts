import type { VercelRequest, VercelResponse } from '@vercel/node';

const MIME_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { data, mimeType } = req.body as { data?: string; mimeType?: string };

    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'El campo "data" (base64) es requerido.' });
    }

    // Normalizar: aceptar con o sin el prefijo data:...;base64,
    let base64Data = data;
    let resolvedMime = mimeType || 'image/jpeg';

    if (data.startsWith('data:')) {
      const match = data.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ error: 'Formato base64 inválido.' });
      }
      resolvedMime = match[1];
      base64Data = match[2];
    }

    // Validar tipo MIME
    if (!MIME_PERMITIDOS.includes(resolvedMime.toLowerCase())) {
      return res.status(400).json({
        error: `Tipo de archivo no permitido. Solo se aceptan imágenes (${MIME_PERMITIDOS.join(', ')}).`,
      });
    }

    // Validar tamaño (base64 → bytes: largo * 3/4)
    const bytesAproximados = Math.floor(base64Data.length * 0.75);
    if (bytesAproximados > MAX_BYTES) {
      return res.status(413).json({ error: 'Imagen demasiado grande (máximo 5 MB).' });
    }

    const tamanio_kb = Math.round(bytesAproximados / 1024);
    const base64Normalizado = `data:${resolvedMime};base64,${base64Data}`;

    return res.status(200).json({
      base64: base64Normalizado,
      mimeType: resolvedMime,
      tamanio_kb,
      valido: true,
    });
  } catch (error) {
    console.error('❌ Error en /api/imagen-base64:', error);
    return res.status(500).json({ error: 'Error interno al procesar la imagen.' });
  }
}
