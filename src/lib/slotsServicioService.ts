// ============================================
// SERVICIO DE SLOTS PARA SERVICIOS
// Genera disponibilidad de horarios por servicio.
// Completamente independiente del slotsService.ts de médicos.
// ============================================

import { supabaseAdmin } from './supabase';
import type { HorarioServicio } from './configuracionesService';

// ============================================
// INTERFACES
// ============================================

export interface SlotServicio {
  hora_inicio: string;
  hora_fin: string;
  disponible: boolean;
  cupos_disponibles: number;
}

export interface HorarioServicioConSlots {
  id_horario_servicio: number;
  servicio: {
    id_servicio: number;
    descripcion: string;
    area: string;
  };
  horario_general: {
    hora_inicio: string;
    hora_fin: string;
    duracion_consulta: number;
    capacidad: number;
    dia_semana: number;
  };
  slots: SlotServicio[];
  total_slots: number;
  slots_disponibles: number;
  slots_ocupados: number;
}

export interface RespuestaSlotsServicio {
  fecha: string;
  dia_semana: string;
  id_servicio: number;
  horarios: HorarioServicioConSlots[];
  total_slots_disponibles: number;
}

interface CitaServicioSlot {
  hora_inicio: string;
  hora_fin: string;
}

// ============================================
// UTILIDADES DE TIEMPO
// ============================================

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getDiaSemana(fecha: string): number {
  // JS: 0=dom, 1=lun... Convertir a 1=lun...7=dom
  const date = new Date(fecha + 'T00:00:00');
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function getDiaSemanaTexto(dia: number): string {
  const dias: Record<number, string> = {
    1: 'Lunes', 2: 'Martes', 3: 'Miércoles',
    4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo'
  };
  return dias[dia] || '';
}

// ============================================
// GENERACIÓN DE SLOTS
// ============================================

function generarSlots(
  horaInicio: string,
  horaFin: string,
  duracion: number,
  capacidad: number,
  citasExistentes: CitaServicioSlot[]
): SlotServicio[] {
  const slots: SlotServicio[] = [];
  let current = timeToMinutes(horaInicio);
  const end = timeToMinutes(horaFin);

  while (current + duracion <= end) {
    const slotInicio = minutesToTime(current);
    const slotFin = minutesToTime(current + duracion);

    const solapados = citasExistentes.filter(c => {
      const citaInicio = timeToMinutes(c.hora_inicio.slice(0, 5));
      const citaFin = timeToMinutes(c.hora_fin.slice(0, 5));
      const sInicio = current;
      const sFin = current + duracion;
      return citaInicio < sFin && citaFin > sInicio;
    }).length;

    const cuposDisponibles = Math.max(0, capacidad - solapados);

    slots.push({
      hora_inicio: slotInicio,
      hora_fin: slotFin,
      disponible: cuposDisponibles > 0,
      cupos_disponibles: cuposDisponibles
    });

    current += duracion;
  }

  return slots;
}

// ============================================
// FUNCIÓN PRINCIPAL: SLOTS POR SERVICIO
// ============================================

export async function obtenerSlotsServicio(
  fecha: string,
  idServicio: number
): Promise<RespuestaSlotsServicio> {
  try {
    const diaSemana = getDiaSemana(fecha);

    // 1. Horarios del servicio para ese día
    const { data: horarios, error: errorHorarios } = await (supabaseAdmin
      .from('horario_servicio') as any)
      .select('*, servicio(id_servicio, descripcion, area)')
      .eq('id_servicio', idServicio)
      .eq('dia_semana', diaSemana)
      .eq('estado', 'activo');

    if (errorHorarios) throw errorHorarios;

    if (!horarios || horarios.length === 0) {
      return {
        fecha,
        dia_semana: getDiaSemanaTexto(diaSemana),
        id_servicio: idServicio,
        horarios: [],
        total_slots_disponibles: 0
      };
    }

    // 2. Citas ya agendadas para ese servicio y fecha
    const { data: citasExistentes, error: errorCitas } = await (supabaseAdmin
      .from('cita_servicio') as any)
      .select('hora_inicio, hora_fin')
      .eq('id_servicio', idServicio)
      .eq('fecha_cita', fecha)
      .not('estado_cita', 'in', '(cancelada,no_asistio)');

    if (errorCitas) throw errorCitas;

    const citas: CitaServicioSlot[] = citasExistentes || [];

    // 3. Generar slots para cada horario
    const horariosConSlots: HorarioServicioConSlots[] = (horarios as HorarioServicio[]).map((h: any) => {
      const slots = generarSlots(
        h.hora_inicio,
        h.hora_fin,
        h.duracion_consulta,
        h.capacidad,
        citas
      );

      const disponibles = slots.filter(s => s.disponible).length;

      return {
        id_horario_servicio: h.id_horario_servicio,
        servicio: {
          id_servicio: h.servicio?.id_servicio ?? idServicio,
          descripcion: h.servicio?.descripcion ?? '',
          area: h.servicio?.area ?? ''
        },
        horario_general: {
          hora_inicio: h.hora_inicio,
          hora_fin: h.hora_fin,
          duracion_consulta: h.duracion_consulta,
          capacidad: h.capacidad,
          dia_semana: h.dia_semana
        },
        slots,
        total_slots: slots.length,
        slots_disponibles: disponibles,
        slots_ocupados: slots.length - disponibles
      };
    });

    const totalDisponibles = horariosConSlots.reduce((acc, h) => acc + h.slots_disponibles, 0);

    return {
      fecha,
      dia_semana: getDiaSemanaTexto(diaSemana),
      id_servicio: idServicio,
      horarios: horariosConSlots,
      total_slots_disponibles: totalDisponibles
    };
  } catch (error) {
    console.error('❌ Error en obtenerSlotsServicio:', error);
    throw error;
  }
}

// ============================================
// VERIFICAR DISPONIBILIDAD DE UN SLOT
// ============================================

export async function verificarSlotServicioDisponible(
  fecha: string,
  idHorarioServicio: number,
  horaInicio: string
): Promise<boolean> {
  try {
    const { data: horario, error: errorHorario } = await (supabaseAdmin
      .from('horario_servicio') as any)
      .select('id_servicio, hora_inicio, hora_fin, duracion_consulta, capacidad')
      .eq('id_horario_servicio', idHorarioServicio)
      .single();

    if (errorHorario || !horario) return false;

    const respuesta = await obtenerSlotsServicio(fecha, horario.id_servicio);

    const horarioConSlots = respuesta.horarios.find(
      h => h.id_horario_servicio === idHorarioServicio
    );

    if (!horarioConSlots) return false;

    const slot = horarioConSlots.slots.find(s => s.hora_inicio === horaInicio);
    return slot?.disponible ?? false;
  } catch (error) {
    console.error('❌ Error en verificarSlotServicioDisponible:', error);
    return false;
  }
}

// ============================================
// SERVICIOS CON DISPONIBILIDAD EN UNA FECHA
// ============================================

export async function obtenerServiciosConDisponibilidad(
  fecha: string,
  idSucursal: number
): Promise<Array<{ id_servicio: number; descripcion: string; area: string; slots_disponibles: number }>> {
  try {
    const diaSemana = getDiaSemana(fecha);

    // Obtener servicios activos de la sucursal que tienen horario ese día
    const { data: horarios, error } = await (supabaseAdmin
      .from('horario_servicio') as any)
      .select('id_servicio, servicio!inner(id_servicio, descripcion, area, id_sucursal, estado)')
      .eq('servicio.id_sucursal', idSucursal)
      .eq('servicio.estado', 'activo')
      .eq('dia_semana', diaSemana)
      .eq('estado', 'activo');

    if (error) throw error;
    if (!horarios || horarios.length === 0) return [];

    // Obtener ids únicos de servicio
    const serviciosIds: number[] = [...new Set((horarios as any[]).map((h: any) => h.id_servicio as number))];

    // Consultar slots para cada servicio
    const resultados = await Promise.all(
      serviciosIds.map(async (idServicio) => {
        const horario = (horarios as any[]).find((h: any) => h.id_servicio === idServicio);
        const respuesta = await obtenerSlotsServicio(fecha, idServicio);
        return {
          id_servicio: idServicio,
          descripcion: horario?.servicio?.descripcion ?? '',
          area: horario?.servicio?.area ?? '',
          slots_disponibles: respuesta.total_slots_disponibles
        };
      })
    );

    return resultados.filter(r => r.slots_disponibles > 0);
  } catch (error) {
    console.error('❌ Error en obtenerServiciosConDisponibilidad:', error);
    return [];
  }
}
