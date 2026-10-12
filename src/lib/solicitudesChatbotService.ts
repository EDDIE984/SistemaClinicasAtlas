import { supabase } from './supabase';
import type { DatosSolicitudChatbot, SolicitudChatbot, TipoSolicitudChatbot } from './supabaseTypes';

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function obtenerCampo(mensaje: string, campo: string): string | null {
  const match = mensaje.match(new RegExp(`\\*${campo}:\\*\\s*([^\\r\\n]+)`, 'i'));
  return match?.[1]?.trim() || null;
}

function fechaHoyISO(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const obtener = (tipo: Intl.DateTimeFormatPartTypes) => partes.find(p => p.type === tipo)?.value || '';
  return `${obtener('year')}-${obtener('month')}-${obtener('day')}`;
}

function parsearFecha(fechaTexto: string | null): string | null {
  if (!fechaTexto) return null;
  const match = normalizar(fechaTexto).match(/(?:\S+\s+)?(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/i);
  if (!match) return null;
  const dia = Number(match[1]);
  const mes = MESES[match[2]];
  if (!mes || dia < 1 || dia > 31) return null;
  const hoy = fechaHoyISO();
  let anio = match[3] ? Number(match[3]) : Number(hoy.slice(0, 4));
  let resultado = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  if (!match[3] && resultado < hoy) {
    anio += 1;
    resultado = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }
  const fecha = new Date(`${resultado}T00:00:00`);
  return Number.isNaN(fecha.getTime()) || fecha.getDate() !== dia ? null : resultado;
}

function parsearHora(horaTexto: string | null): string | null {
  if (!horaTexto) return null;
  const limpia = horaTexto.toLowerCase().replace(/[.\s]/g, '');
  const match = limpia.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!match) return null;
  let hora = Number(match[1]);
  const minuto = Number(match[2] || '0');
  const meridiano = match[3];
  if (minuto > 59 || hora > (meridiano ? 12 : 23)) return null;
  if (meridiano) {
    if (hora === 12) hora = 0;
    if (meridiano === 'pm') hora += 12;
  }
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

export function parsearMensajeAgente(mensaje: string): DatosSolicitudChatbot {
  const paciente = obtenerCampo(mensaje, 'Paciente');
  const cedulaRaw = obtenerCampo(mensaje, 'Cédula');
  const fechaTexto = obtenerCampo(mensaje, 'Fecha');
  const horaTexto = obtenerCampo(mensaje, 'Hora');
  const servicio = obtenerCampo(mensaje, 'Servicio');
  const especialidad = obtenerCampo(mensaje, 'Especialidad');
  const seguroTexto = obtenerCampo(mensaje, 'Seguro');
  const seguroNormalizado = seguroTexto ? normalizar(seguroTexto).toUpperCase() : '';
  const seguro = seguroNormalizado.startsWith('SI') ? 'SI' : seguroNormalizado.startsWith('NO') ? 'NO' : null;
  const tipo: TipoSolicitudChatbot = servicio ? 'servicio' : especialidad ? 'consulta_externa' : 'desconocido';

  return {
    tipo,
    pacienteNombre: paciente && normalizar(paciente) !== 'no registrado' ? paciente : null,
    cedula: cedulaRaw?.replace(/\D/g, '') || null,
    telefono: obtenerCampo(mensaje, 'Teléfono'),
    correo: obtenerCampo(mensaje, 'Correo'),
    fecha: parsearFecha(fechaTexto),
    hora: parsearHora(horaTexto),
    servicio,
    especialidad,
    seguro,
    fechaTexto,
    horaTexto,
  };
}

type ConversacionPendiente = { id_conversacion: number; fecha_conversacion: string; remote_jid: string | null };
type DetalleSolicitud = { id: string; id_conversacion: number | null; created_at: string; mensajeAgente: string | null };

export async function getSolicitudesChatbotPendientes(): Promise<SolicitudChatbot[]> {
  try {
    const { data: conversaciones, error: conversacionesError } = await (supabase.from('conversacion_chatbot' as any) as any)
      .select('id_conversacion, fecha_conversacion, remote_jid, estado')
      .eq('estado', 'pendiente')
      .order('id_conversacion', { ascending: false });
    if (conversacionesError) throw conversacionesError;

    const filasConversacion = (conversaciones || []) as ConversacionPendiente[];
    const ids = filasConversacion.map(fila => fila.id_conversacion);
    if (!ids.length) return [];

    const { data: detalles, error: detallesError } = await (supabase.from('conversations_detail' as any) as any)
      .select('id, id_conversacion, created_at, "mensajeAgente"')
      .in('id_conversacion', ids)
      .not('mensajeAgente', 'is', null)
      .order('created_at', { ascending: false });
    if (detallesError) throw detallesError;

    const recientes = new Map<number, DetalleSolicitud>();
    for (const detalle of (detalles || []) as DetalleSolicitud[]) {
      if (detalle.id_conversacion && detalle.mensajeAgente && !recientes.has(detalle.id_conversacion)) {
        recientes.set(detalle.id_conversacion, detalle);
      }
    }

    return filasConversacion.flatMap(conversacion => {
      const detalle = recientes.get(conversacion.id_conversacion);
      if (!detalle?.mensajeAgente) return [];
      return [{
        id_conversacion: conversacion.id_conversacion,
        fecha_conversacion: conversacion.fecha_conversacion,
        remote_jid: conversacion.remote_jid,
        id_detalle: detalle.id,
        fecha_mensaje: detalle.created_at,
        mensajeAgente: detalle.mensajeAgente,
        datos: parsearMensajeAgente(detalle.mensajeAgente),
      }];
    }).sort((a, b) => b.fecha_mensaje.localeCompare(a.fecha_mensaje));
  } catch (error) {
    console.error('❌ Error al obtener solicitudes del chatbot:', error);
    throw error;
  }
}

function horaActualEcuador(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(new Date());
}

async function cerrarSolicitud(
  idConversacion: number,
  estado: 'completado' | 'cancelado',
  ref: { id_cita?: number; id_cita_servicio?: number } = {},
): Promise<boolean> {
  try {
    const { data, error } = await (supabase.from('conversacion_chatbot' as any) as any)
      .update({ estado, hora_fin: horaActualEcuador(), ...ref, updated_at: new Date().toISOString() })
      .eq('id_conversacion', idConversacion)
      .eq('estado', 'pendiente')
      .select('id_conversacion');
    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
  } catch (error) {
    console.error(`❌ Error al marcar solicitud del chatbot como ${estado}:`, error);
    return false;
  }
}

export function marcarSolicitudChatbotAtendida(
  idConversacion: number,
  ref: { id_cita?: number; id_cita_servicio?: number },
): Promise<boolean> {
  return cerrarSolicitud(idConversacion, 'completado', ref);
}

export function descartarSolicitudChatbot(idConversacion: number): Promise<boolean> {
  return cerrarSolicitud(idConversacion, 'cancelado');
}
