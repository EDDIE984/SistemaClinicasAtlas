import { supabaseAdmin } from './supabase';  // ⚡ Cambio: usar supabaseAdmin para bypasear RLS

export interface ConsultaMedica {
  id_consulta_medica: number;
  id_cita: number;
  id_paciente: number;
  id_usuario: number;
  fecha_consulta: string;
  historial_clinico: string | null;
  diagnostico: string | null;
  diagnostico_ia: string | null;
  receta_medica: string | null;
  receta_rp: string | null;
  receta_indicaciones: string | null;
  pedido_examenes: string | null;
  observaciones: string | null;
  fecha_seguimiento: string | null;
  pedido_hospitalizacion: string | null;
  numero_receta?: number | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Crear una nueva consulta médica
 */
export async function crearConsultaMedica(
  consulta: Omit<ConsultaMedica, 'id_consulta_medica' | 'created_at' | 'updated_at' | 'fecha_consulta'>
): Promise<ConsultaMedica | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('consulta_medica')
      .insert({
        ...consulta,
        fecha_consulta: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return null;
    }

    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Obtener consulta médica por ID de cita
 */
export async function getConsultaMedicaByCita(idCita: number): Promise<ConsultaMedica | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('consulta_medica')
      .select('*')
      .eq('id_cita', idCita)
      .maybeSingle();

    if (error) {
      console.error('❌ Error al obtener consulta médica:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Error al obtener consulta médica:', error);
    return null;
  }
}

/**
 * Obtener todas las consultas médicas de un paciente
 */
export async function getConsultasMedicasByPaciente(idPaciente: number): Promise<ConsultaMedica[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('consulta_medica')
      .select('*')
      .eq('id_paciente', idPaciente)
      .order('fecha_consulta', { ascending: false });

    if (error) {
      console.error('❌ Error al obtener consultas médicas del paciente:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado al obtener consultas médicas:', error);
    return [];
  }
}

/**
 * Actualizar una consulta médica existente
 */
export async function actualizarConsultaMedica(
  idConsultaMedica: number,
  cambios: Partial<Omit<ConsultaMedica, 'id_consulta_medica' | 'id_cita' | 'id_paciente' | 'id_usuario' | 'created_at' | 'updated_at'>>
): Promise<ConsultaMedica | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('consulta_medica')
      .update(cambios)
      .eq('id_consulta_medica', idConsultaMedica)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al actualizar consulta médica:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Error inesperado al actualizar consulta médica:', error);
    return null;
  }
}

/**
 * Obtiene o asigna el número de receta para una consulta.
 * Si ya tiene número, lo devuelve. Si no, genera el siguiente de la secuencia y lo persiste.
 */
export async function getOrAssignNumeroReceta(idConsultaMedica: number): Promise<number | null> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('get_or_assign_numero_receta', { p_id_consulta: idConsultaMedica });

    if (error) {
      console.error('❌ Error al obtener/asignar número de receta:', error);
      return null;
    }

    return data as number;
  } catch (error) {
    console.error('❌ Error inesperado al obtener/asignar número de receta:', error);
    return null;
  }
}