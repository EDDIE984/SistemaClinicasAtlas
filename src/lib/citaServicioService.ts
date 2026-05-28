// Servicio CRUD para cita_servicio — completamente independiente de citasService.ts
import { supabaseAdmin } from './supabase';
import type { CitaServicio, CitaServicioCompleta } from './configuracionesService';

// Columnas explícitas para excluir foto_pedido_base64 (TEXT pesado).
// La foto se obtiene on-demand con getFotoPedido().
const SELECT_COMPLETO = `
  id_cita_servicio,
  id_horario_servicio,
  id_servicio,
  id_paciente,
  id_sucursal,
  fecha_cita,
  hora_inicio,
  hora_fin,
  motivo,
  estado_cita,
  precio_cita,
  forma_pago,
  estado_pago,
  notas_cita,
  medico_solicitante,
  numero_registro_medico,
  fecha_confirmada,
  fecha_inicio_atencion,
  fecha_atendida,
  fecha_cancelada,
  fecha_no_asistio,
  created_at,
  updated_at,
  servicio(*, sucursal(*)),
  paciente(id_paciente, nombres, apellidos, cedula, telefono, email, direccion),
  sucursal(*),
  horario_servicio(*)
`;

export async function getCitasServicio(params: {
  fechaDesde: string;
  fechaHasta: string;
  idSucursal?: number;
  idServicio?: number;
  estadoCita?: CitaServicio['estado_cita'];
}): Promise<CitaServicioCompleta[]> {
  try {
    let query = (supabaseAdmin.from('cita_servicio') as any)
      .select(SELECT_COMPLETO)
      .gte('fecha_cita', params.fechaDesde)
      .lte('fecha_cita', params.fechaHasta)
      .order('fecha_cita', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (params.idSucursal) {
      query = query.eq('id_sucursal', params.idSucursal);
    }

    if (params.idServicio) {
      query = query.eq('id_servicio', params.idServicio);
    }

    if (params.estadoCita) {
      query = query.eq('estado_cita', params.estadoCita);
    }

    const { data, error } = await query;
    if (error) {
      console.error('❌ Error al obtener citas de servicio:', error);
      return [];
    }
    return (data as CitaServicioCompleta[]) || [];
  } catch (error) {
    console.error('❌ Error inesperado en getCitasServicio:', error);
    return [];
  }
}

export async function createCitaServicio(
  cita: Omit<CitaServicio, 'id_cita_servicio' | 'created_at' | 'updated_at' | 'servicio' | 'horario_servicio'>
): Promise<CitaServicio | null> {
  try {
    const { data, error } = await (supabaseAdmin.from('cita_servicio') as any)
      .insert([cita])
      .select(SELECT_COMPLETO)
      .single();

    if (error) {
      console.error('❌ Error al crear cita de servicio:', error);
      return null;
    }
    return data as CitaServicio;
  } catch (error) {
    console.error('❌ Error inesperado en createCitaServicio:', error);
    return null;
  }
}

export async function updateCitaServicio(
  id: number,
  updates: Partial<Omit<CitaServicio, 'id_cita_servicio' | 'created_at' | 'updated_at' | 'servicio' | 'horario_servicio'>>
): Promise<CitaServicio | null> {
  try {
    const { data, error } = await (supabaseAdmin.from('cita_servicio') as any)
      .update(updates)
      .eq('id_cita_servicio', id)
      .select(SELECT_COMPLETO)
      .single();

    if (error) {
      console.error('❌ Error al actualizar cita de servicio:', error);
      return null;
    }
    return data as CitaServicio;
  } catch (error) {
    console.error('❌ Error inesperado en updateCitaServicio:', error);
    return null;
  }
}

export async function cancelarCitaServicio(id: number): Promise<boolean> {
  const result = await updateCitaServicio(id, {
    estado_cita: 'cancelada',
    fecha_cancelada: new Date().toISOString(),
  });
  return result !== null;
}

export async function deleteCitaServicio(id: number): Promise<boolean> {
  try {
    const { error } = await (supabaseAdmin.from('cita_servicio') as any)
      .delete()
      .eq('id_cita_servicio', id);

    if (error) {
      console.error('❌ Error al eliminar cita de servicio:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ Error inesperado en deleteCitaServicio:', error);
    return false;
  }
}

export async function confirmarCitaServicio(
  id: number,
  datos: {
    medico_solicitante: string;
    numero_registro_medico: string;
    foto_pedido_base64: string;
  }
): Promise<import('./configuracionesService').CitaServicio | null> {
  return updateCitaServicio(id, {
    ...datos,
    estado_cita: 'confirmada',
    fecha_confirmada: new Date().toISOString(),
  });
}

export async function getFotoPedido(id: number): Promise<string | null> {
  try {
    const { data, error } = await (supabaseAdmin.from('cita_servicio') as any)
      .select('foto_pedido_base64')
      .eq('id_cita_servicio', id)
      .single();

    if (error) {
      console.error('❌ Error al obtener foto de pedido:', error);
      return null;
    }
    return (data as { foto_pedido_base64: string | null })?.foto_pedido_base64 ?? null;
  } catch (error) {
    console.error('❌ Error inesperado en getFotoPedido:', error);
    return null;
  }
}
