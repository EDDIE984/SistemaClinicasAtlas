import type { SupabaseClient } from '@supabase/supabase-js';

// Completa los datos que el flujo de WhatsApp (n8n) no envió en `datos`. agenda_conversaciones se vacía al
// terminar la conversación, pero el chat completo queda en conversations_detail: cada mensaje de la mamá
// (`humano`) con su `remotejid` (igual al remote_jid que envía n8n) y su `telefono`.

const VENTANA_CHAT_MS = 2 * 60 * 60 * 1000; // solo la conversación reciente
const PATRON_CORREO = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;

interface MensajeChat {
  humano: string | null;
  telefono: string | null;
  created_at: string;
}

async function mensajesRecientes(
  supabase: SupabaseClient,
  remoteJid: string | null,
  telefono: string | null,
): Promise<MensajeChat[]> {
  if (!remoteJid && !telefono) return [];
  const desde = new Date(Date.now() - VENTANA_CHAT_MS).toISOString();
  let query = supabase
    .from('conversations_detail')
    .select('humano, telefono, created_at')
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(200);
  query = remoteJid ? query.eq('remotejid', remoteJid) : query.eq('telefono', telefono);
  const { data, error } = await query;
  if (error) {
    console.error('❌ No se pudo leer conversations_detail:', error);
    return [];
  }
  return (data || []) as MensajeChat[];
}

/** Correo y teléfono desde el chat de WhatsApp: el último correo que escribió la mamá y el teléfono del contacto */
export async function datosDesdeConversacion(
  supabase: SupabaseClient,
  remoteJid: string | null,
  telefono: string | null,
): Promise<{ correo: string | null; telefono: string | null }> {
  const mensajes = await mensajesRecientes(supabase, remoteJid, telefono);
  const correo = mensajes
    .map((m) => m.humano?.match(PATRON_CORREO)?.[0] ?? null)
    .find((c): c is string => !!c);
  const telefonoChat = mensajes.find((m) => m.telefono?.trim())?.telefono?.trim() ?? null;
  return { correo: correo ? correo.toLowerCase() : null, telefono: telefonoChat };
}

/** Nombre ya registrado para esa cédula: solicitud de maternidad anterior o ficha de paciente */
export async function nombrePorCedula(supabase: SupabaseClient, cedula: string): Promise<string | null> {
  const { data: solicitud } = await supabase
    .from('maternidad_solicitud')
    .select('nombre_madre')
    .eq('cedula', cedula)
    .not('nombre_madre', 'ilike', 'Paciente %')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (solicitud?.nombre_madre?.trim()) return solicitud.nombre_madre.trim();

  const { data: paciente } = await supabase
    .from('paciente')
    .select('nombres, apellidos')
    .eq('cedula', cedula)
    .order('estado', { ascending: true })
    .limit(1)
    .maybeSingle();
  const nombre = [paciente?.apellidos, paciente?.nombres].filter(Boolean).join(' ').trim();
  return nombre || null;
}
