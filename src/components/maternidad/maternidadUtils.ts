// Utilidades compartidas por las pantallas del módulo Maternidad
import type { EstadoSolicitudMaternidad } from '../../lib/supabaseTypes';

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
