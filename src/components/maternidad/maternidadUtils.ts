// Utilidades compartidas por las pantallas del módulo Maternidad
import type {
  EstadoSeguimientoMaternidad,
  EstadoSolicitudMaternidad,
  ResultadoPartoMaternidad,
} from '../../lib/supabaseTypes';

export const DIAS_SEMANA_MATERNIDAD = [
  { valor: 1, nombre: 'Lunes', abrev: 'Lun' },
  { valor: 2, nombre: 'Martes', abrev: 'Mar' },
  { valor: 3, nombre: 'Miércoles', abrev: 'Mié' },
  { valor: 4, nombre: 'Jueves', abrev: 'Jue' },
  { valor: 5, nombre: 'Viernes', abrev: 'Vie' },
  { valor: 6, nombre: 'Sábado', abrev: 'Sáb' },
  { valor: 7, nombre: 'Domingo', abrev: 'Dom' },
];

export const nombreDiaSemana = (dia: number) =>
  DIAS_SEMANA_MATERNIDAD.find(d => d.valor === dia)?.nombre || String(dia);

export const ESTADO_BADGE_MATERNIDAD: Record<EstadoSolicitudMaternidad, { label: string; className: string }> = {
  solo_cotizacion: { label: 'Solo cotización', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  agendada: { label: 'Tour agendado', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  confirmada: { label: 'Confirmada', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  asistio: { label: 'Asistió', className: 'bg-green-100 text-green-800 border-green-200' },
  no_asistio: { label: 'No asistió', className: 'bg-red-100 text-red-800 border-red-200' },
  cancelada: { label: 'Cancelada', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export const PARTO_BADGE_MATERNIDAD: Record<ResultadoPartoMaternidad, { label: string; className: string }> = {
  pendiente: { label: 'Parto pendiente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  clinica: { label: 'Dio a luz en la clínica', className: 'bg-green-100 text-green-800 border-green-200' },
  perdida: { label: 'Seguimiento cerrado', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

/** YYYY-MM-DD de una fecha local (sin conversión a UTC) */
export function toISOFechaLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function fechaHoyEcuadorISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
}

/** HH:MM actual en Ecuador */
export function horaActualEcuador(): string {
  return new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** true si el turno (fecha + hora inicio) ya empezó en hora de Ecuador */
export function turnoYaPaso(fecha: string, horaInicio: string): boolean {
  const hoy = fechaHoyEcuadorISO();
  if (fecha !== hoy) return fecha < hoy;
  return horaInicio.slice(0, 5) <= horaActualEcuador();
}

export function getLunesDeSemana(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay();
  d.setDate(d.getDate() + (dia === 0 ? -6 : 1 - dia));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getDiasSemana(lunes: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** 1=Lunes … 7=Domingo */
export const diaSemanaISO = (d: Date) => (d.getDay() === 0 ? 7 : d.getDay());

export function formatFechaLarga(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatFechaHora(valor?: string | null): string {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** $ 1,390.00 — mismo formato que el presupuesto en PDF (api/_lib/presupuestoMembretado.ts) */
export const formatearUSD = (valor: number) =>
  `$ ${(Number(valor) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

export const formatHorario = (inicio?: string | null, fin?: string | null) =>
  inicio ? `${inicio.slice(0, 5)}${fin ? ` - ${fin.slice(0, 5)}` : ''}` : '—';

/** DD/MM/AAAA de una fecha YYYY-MM-DD (sin conversión de zona horaria) */
export const formatFechaCorta = (fecha?: string | null) =>
  fecha ? fecha.slice(0, 10).split('-').reverse().join('/') : '—';


// ── Bitácora de tours ────────────────────────────────────────────────────────

/**
 * Estado de seguimiento por semanas de gestación. Lo calcula la base (vista_maternidad_solicitudes,
 * migración 082) en cada consulta: alerta roja de 20 a 40 semanas, llamar de 37 a 40, cierre después de 40.
 */
export type SeguimientoTour = EstadoSeguimientoMaternidad;

export const SEGUIMIENTO_TOUR: Record<EstadoSeguimientoMaternidad, { label: string; className: string }> = {
  temprana: { label: 'Pendiente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  seguimiento: { label: 'En seguimiento', className: 'bg-red-100 text-red-800 border-red-200' },
  llamar: { label: 'Llamar a seguimiento', className: 'bg-red-600 text-white border-red-600' },
  vencida: { label: 'Ya está perdida', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  perdida: { label: 'Ya está perdida', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  parto_clinica: { label: 'Dio a luz en la clínica', className: 'bg-green-100 text-green-800 border-green-200' },
  sin_semanas: { label: 'Sin semanas', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

/** Opciones del filtro de seguimiento (vencida y perdida se agrupan como "Ya está perdida") */
export const FILTROS_SEGUIMIENTO: { value: string; label: string; estados: EstadoSeguimientoMaternidad[] }[] = [
  { value: 'alerta', label: 'En alerta (20–40 semanas)', estados: ['seguimiento', 'llamar'] },
  { value: 'llamar', label: 'Llamar a seguimiento (37–40)', estados: ['llamar'] },
  { value: 'seguimiento', label: 'En seguimiento (20–36)', estados: ['seguimiento'] },
  { value: 'temprana', label: 'Pendiente (< 20)', estados: ['temprana'] },
  { value: 'perdida', label: 'Ya está perdida', estados: ['perdida', 'vencida'] },
  { value: 'parto_clinica', label: 'Dio a luz en la clínica', estados: ['parto_clinica'] },
  { value: 'sin_semanas', label: 'Sin semanas', estados: ['sin_semanas'] },
];

/** true si la mamá está en alerta roja (entre 20 y 40 semanas, sin parto registrado) */
export const enAlerta = (estado?: EstadoSeguimientoMaternidad | null) => estado === 'llamar' || estado === 'seguimiento';

export const seguimientoTour = (s: { estado_seguimiento?: EstadoSeguimientoMaternidad | null }): SeguimientoTour =>
  s.estado_seguimiento || 'sin_semanas';

/** Semanas de gestación a hoy, con un decimal (calculado por la base) */
export const semanasHoy = (s: { semanas_actuales?: number | string | null }): number | null =>
  s.semanas_actuales === null || s.semanas_actuales === undefined ? null : Number(s.semanas_actuales);

/** "38.4" → "38 s 3 d" para mostrar semanas y días */
export function formatSemanas(semanas: number | null): string {
  if (semanas === null) return '—';
  const enteras = Math.floor(semanas);
  const dias = Math.round((semanas - enteras) * 7);
  return dias > 0 && dias < 7 ? `${enteras} s ${dias} d` : `${Math.round(semanas)} s`;
}

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "febrero" para una fecha YYYY-MM-DD */
export const nombreMes = (fecha?: string | null) => (fecha ? MESES[Number(fecha.slice(5, 7)) - 1] || '' : '');

/** Duración en minutos entre dos horas HH:MM (null si falta alguna o es negativa) */
export function duracionMinutos(inicio?: string | null, fin?: string | null): number | null {
  if (!inicio || !fin) return null;
  const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const d = minutos(fin) - minutos(inicio);
  return d > 0 ? d : null;
}

/** Seguro a mostrar: aseguradora del catálogo o, en la bitácora histórica, el texto del Excel */
export const seguroDe = (s: { aseguradora?: string | null; seguro_texto?: string | null }) =>
  s.aseguradora || s.seguro_texto || '';

// ── Períodos de los reportes ─────────────────────────────────────────────────

export type ClavePeriodo = 'este_mes' | 'mes_anterior' | 'ultimos_3' | 'este_anio' | 'personalizado';

export const PERIODOS: { value: ClavePeriodo; label: string }[] = [
  { value: 'este_mes', label: 'Este mes' },
  { value: 'mes_anterior', label: 'Mes anterior' },
  { value: 'ultimos_3', label: 'Últimos 3 meses' },
  { value: 'este_anio', label: 'Este año' },
  { value: 'personalizado', label: 'Personalizado' },
];

/** Rango YYYY-MM-DD (hora de Ecuador) de un acceso rápido; "personalizado" devuelve null */
export function rangoPeriodo(clave: ClavePeriodo): { desde: string; hasta: string } | null {
  const hoy = fechaHoyEcuadorISO();
  const [anio, mes] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7))];
  const primerDia = (a: number, m: number) => toISOFechaLocal(new Date(a, m - 1, 1));
  const ultimoDia = (a: number, m: number) => toISOFechaLocal(new Date(a, m, 0));
  switch (clave) {
    case 'este_mes': return { desde: primerDia(anio, mes), hasta: hoy };
    case 'mes_anterior': return { desde: primerDia(anio, mes - 1), hasta: ultimoDia(anio, mes - 1) };
    case 'ultimos_3': return { desde: primerDia(anio, mes - 2), hasta: hoy };
    case 'este_anio': return { desde: `${anio}-01-01`, hasta: hoy };
    default: return null;
  }
}

export const ETIQUETA_ORIGEN_MATERNIDAD: Record<string, string> = {
  CHATBOT: 'WhatsApp',
  SISTEMA: 'Sistema',
  BITACORA: 'Bitácora histórica',
};
