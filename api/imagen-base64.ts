import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const MIME_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function detectarMimeImagen(buffer: Buffer): string | null {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp';
  return null;
}

function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  return { url, key };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { id_cita_servicio, data, mimeType } = req.body as {
      id_cita_servicio?: number | string;
      data?: string;
      mimeType?: string;
    };

    const idCitaServicio = Number(id_cita_servicio);

    if (!Number.isInteger(idCitaServicio) || idCitaServicio <= 0) {
      return res.status(400).json({ error: 'El campo "id_cita_servicio" es requerido y debe ser un número válido.' });
    }

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

    const bufferImagen = Buffer.from(base64Data, 'base64');
    const mimeDetectado = detectarMimeImagen(bufferImagen);
    if (!mimeDetectado) {
      return res.status(400).json({ error: 'El contenido enviado no corresponde a una imagen válida.' });
    }

    const tamanio_kb = Math.round(bytesAproximados / 1024);
    const base64Normalizado = `data:${mimeDetectado};base64,${base64Data}`;

    const { url, key } = getSupabaseConfig();
    if (!url || !key) {
      return res.status(500).json({
        error: 'Supabase no está configurado. Configure SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.',
      });
    }

    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: citaActualizada, error } = await supabase
      .from('cita_servicio')
      .update({ foto_pedido_base64: base64Normalizado })
      .eq('id_cita_servicio', idCitaServicio)
      .select('id_cita_servicio')
      .single();

    if (error) {
      console.error('❌ Error al guardar imagen en cita_servicio:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'No existe una cita_servicio con el id indicado.' });
      }

      return res.status(500).json({
        error: 'No se pudo guardar la imagen en la cita de servicio.',
        details: error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      id_cita_servicio: idCitaServicio,
      mimeType: resolvedMime,
      tamanio_kb,
      message: 'Imagen guardada correctamente en la cita de servicio.',
    });
  } catch (error) {
    console.error('❌ Error en /api/imagen-base64:', error);
    return res.status(500).json({ error: 'Error interno al procesar la imagen.' });
  }
}
