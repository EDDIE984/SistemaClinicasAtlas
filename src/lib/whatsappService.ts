// Envío de mensajes de WhatsApp (WasenderAPI) a través de la función serverless /api/send-whatsapp.
// El token WASENDERAPI_TOKEN vive solo en el servidor (Vercel) o en el proxy de Vite en desarrollo.

export const UBICACION_CLINICA = 'https://maps.app.goo.gl/MiSFvJ9a4Un6gErx6';
export const TELEFONO_CONSULTA_EXTERNA = '+593990438143';
const LINEA_MODIFICAR_CITA = `📞 Si desea modificar su cita, comuníquese directamente con Consulta Externa al ${TELEFONO_CONSULTA_EXTERNA}.`;

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Convierte un teléfono local o internacional al formato +593XXXXXXXXX. Devuelve null si no es válido. */
export function normalizarTelefonoWhatsApp(telefono?: string | null): string | null {
  const limpio = (telefono || '').replace(/[\s()-]/g, '');
  if (!limpio) return null;
  const numero = limpio.startsWith('+') ? limpio : `+593${limpio.replace(/^0/, '')}`;
  return /^\+\d{10,15}$/.test(numero) ? numero : null;
}

/** "2026-09-17" → "Jueves 17 de septiembre de 2026" */
export function formatearFechaLarga(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const date = new Date(anio, mes - 1, dia);
  return `${DIAS[date.getDay()]} ${dia} de ${MESES[mes - 1]} de ${anio}`;
}

export interface DatosMensajeCitaConfirmada {
  nombrePaciente?: string | null;
  /** Especialidad (consulta externa) o servicio (imagen), p. ej. "MEDICINA INTERNA" o "Resonancia magnética" */
  atencion: string;
  fecha: string;       // YYYY-MM-DD
  horaInicio: string;  // HH:MM o HH:MM:SS
  profesional?: string | null; // Nombre del médico (solo consulta externa)
  sucursal?: string | null;
}

export function construirMensajeCitaConfirmada(datos: DatosMensajeCitaConfirmada): string {
  const saludo = datos.nombrePaciente?.trim()
    ? `Hola ${datos.nombrePaciente.trim()}, su cita ha sido agendada exitosamente.`
    : 'Su cita ha sido agendada exitosamente.';

  const lineasCita = [
    `🏥 ${datos.atencion.trim().toUpperCase()}`,
    `📅 ${formatearFechaLarga(datos.fecha)}`,
    `🕐 ${datos.horaInicio.slice(0, 5)}`,
    datos.profesional?.trim() ? `👨‍⚕️ Dr./Dra. ${datos.profesional.trim().toUpperCase()}` : null,
    datos.sucursal?.trim() ? `📍 ${datos.sucursal.trim()}` : null,
  ].filter(Boolean);

  return [
    '✅ *CITA CONFIRMADA*',
    '',
    saludo,
    '',
    '*DATOS DE LA CITA*',
    ...lineasCita,
    '',
    '📋 *Para su atención, le recordamos:*',
    '• *Cédula de identidad:* requisito obligatorio para ingresar al edificio.',
    '• *Puntualidad:* le sugerimos llegar 10 minutos antes de su cita.',
    `• *Ubicación:* ${UBICACION_CLINICA}`,
    '',
    LINEA_MODIFICAR_CITA,
    '',
    'Gracias por preferirnos. ¡Hasta pronto!',
    '',
    '_Este es un mensaje automático, por favor no responda._',
  ].join('\n');
}

/** Envía un mensaje de WhatsApp. Lanza un error con el detalle si el envío falla. */
export async function enviarWhatsApp(telefono: string, texto: string): Promise<void> {
  try {
    const res = await fetch('/api/send-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: telefono, text: texto }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || res.statusText);
    }
  } catch (error) {
    console.error('❌ Error al enviar WhatsApp:', error);
    throw error;
  }
}

/**
 * Envía la confirmación de cita al paciente sin bloquear el agendamiento:
 * la cita ya está guardada, así que un fallo solo se notifica como aviso.
 */
export async function enviarConfirmacionCitaWhatsApp(
  telefonoPaciente: string | null | undefined,
  datos: DatosMensajeCitaConfirmada,
): Promise<{ enviado: boolean; motivo?: string }> {
  const telefono = normalizarTelefonoWhatsApp(telefonoPaciente);
  if (!telefono) return { enviado: false, motivo: 'el paciente no tiene un teléfono válido' };
  try {
    await enviarWhatsApp(telefono, construirMensajeCitaConfirmada(datos));
    return { enviado: true };
  } catch (error) {
    return { enviado: false, motivo: error instanceof Error ? error.message : 'error desconocido' };
  }
}

// ========================================
// RECORDATORIOS (módulo Recordatorio Pacientes)
// ========================================

// Variantes de saludo para que los recordatorios no salgan con texto idéntico
const SALUDOS_RECORDATORIO = [
  (nombre: string) => `Hola ${nombre}, le recordamos que tiene una cita programada.`,
  (nombre: string) => `Estimado/a ${nombre}, le recordamos que tiene una cita programada.`,
  (nombre: string) => `${nombre}, este es un recordatorio de su próxima cita.`,
];

export function construirMensajeRecordatorioPaciente(datos: DatosMensajeCitaConfirmada): string {
  const nombre = datos.nombrePaciente?.trim();
  const saludo = nombre
    ? SALUDOS_RECORDATORIO[Math.floor(Math.random() * SALUDOS_RECORDATORIO.length)](nombre)
    : 'Le recordamos que tiene una cita programada.';

  const lineasCita = [
    `🏥 ${datos.atencion.trim().toUpperCase()}`,
    `📅 ${formatearFechaLarga(datos.fecha)}`,
    `🕐 ${datos.horaInicio.slice(0, 5)}`,
    datos.profesional?.trim() ? `👨‍⚕️ Dr./Dra. ${datos.profesional.trim().toUpperCase()}` : null,
    datos.sucursal?.trim() ? `📍 ${datos.sucursal.trim()}` : null,
  ].filter(Boolean);

  return [
    '🔔 *RECORDATORIO DE CITA*',
    '',
    saludo,
    '',
    '*DATOS DE LA CITA*',
    ...lineasCita,
    '',
    '📋 *Recuerde:*',
    '• Traer su cédula de identidad (obligatoria para ingresar al edificio).',
    '• Llegar 10 minutos antes de su cita.',
    `• Ubicación: ${UBICACION_CLINICA}`,
    '',
    LINEA_MODIFICAR_CITA,
    '',
    '_Este es un mensaje automático, por favor no responda._',
  ].join('\n');
}

export interface DatosResumenMedico {
  medico: string;
  fecha: string; // YYYY-MM-DD
  sucursal?: string | null;
  citas: { hora: string; paciente: string; atencion?: string | null }[];
}

export function construirMensajeResumenMedico(datos: DatosResumenMedico): string {
  const citas = [...datos.citas].sort((a, b) => a.hora.localeCompare(b.hora));
  const encabezadoFecha = `📅 ${formatearFechaLarga(datos.fecha)}${datos.sucursal?.trim() ? ` · 📍 ${datos.sucursal.trim()}` : ''}`;
  return [
    '🩺 *RECORDATORIO DE AGENDA*',
    '',
    `Dr./Dra. ${datos.medico.trim().toUpperCase()}, le recordamos sus citas programadas:`,
    '',
    encabezadoFecha,
    ...citas.map(cita => `• ${cita.hora.slice(0, 5)} – ${cita.paciente.trim().toUpperCase()}${cita.atencion ? ` (${cita.atencion})` : ''}`),
    '',
    `Total: ${citas.length} ${citas.length === 1 ? 'cita' : 'citas'}.`,
    '',
    '_Este es un mensaje automático, por favor no responda._',
  ].join('\n');
}

export interface ResultadoEnvioWhatsApp {
  ok: boolean;
  status: number;          // 0 = error de red
  error?: string;
  retryAfterSegundos?: number;
}

/** Envía un WhatsApp sin lanzar errores; devuelve el estado HTTP y la espera sugerida si hay límite (429). */
export async function enviarWhatsAppConDetalle(telefono: string, texto: string): Promise<ResultadoEnvioWhatsApp> {
  try {
    const res = await fetch('/api/send-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: telefono, text: texto }),
    });
    if (res.ok) return { ok: true, status: res.status };

    const cuerpo = await res.json().catch(() => ({}));
    const retryHeader = Number(res.headers.get('retry-after') || res.headers.get('x-ratelimit-reset'));
    const retryCuerpo = Number(cuerpo.retry_after);
    const retryAfterSegundos = retryCuerpo > 0 ? retryCuerpo : retryHeader > 0 ? retryHeader : undefined;
    return { ok: false, status: res.status, error: cuerpo.error || cuerpo.message || res.statusText, retryAfterSegundos };
  } catch (error) {
    console.error('❌ Error de red al enviar WhatsApp:', error);
    return { ok: false, status: 0, error: error instanceof Error ? error.message : 'error de red' };
  }
}

