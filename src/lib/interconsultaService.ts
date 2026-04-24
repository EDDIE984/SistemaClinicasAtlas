import { supabaseAdmin } from './supabase';
import { Interconsulta, InterconsultaCompleta } from './supabaseTypes';

export interface FiltrosInterconsulta {
  estado?: 'pendiente' | 'en_proceso' | 'atendida' | 'cancelada' | 'todos'
  urgencia?: 'normal' | 'urgente' | 'todos'
  fechaDesde?: string
  fechaHasta?: string
  busquedaPaciente?: string
  idUsuarioMedico?: number // si rol = médico, filtrar por solicitante o destino
}

const SELECT_COMPLETO = `
  *,
  paciente:id_paciente(id_paciente, nombre, apellido, cedula),
  usuario_solicitante:id_usuario_solicitante(id_usuario, nombre, apellido, tipo_usuario),
  usuario_destino:id_usuario_destino(id_usuario, nombre, apellido, tipo_usuario),
  especialidad:id_especialidad_destino(id_especialidad, nombre)
`.trim();

export async function getInterconsultas(filtros: FiltrosInterconsulta = {}): Promise<InterconsultaCompleta[]> {
  try {
    let query = supabaseAdmin
      .from('interconsulta')
      .select(SELECT_COMPLETO)
      .order('created_at', { ascending: false });

    if (filtros.estado && filtros.estado !== 'todos') {
      query = query.eq('estado', filtros.estado);
    }
    if (filtros.urgencia && filtros.urgencia !== 'todos') {
      query = query.eq('urgencia', filtros.urgencia);
    }
    if (filtros.fechaDesde) {
      query = query.gte('created_at', filtros.fechaDesde);
    }
    if (filtros.fechaHasta) {
      query = query.lte('created_at', filtros.fechaHasta + 'T23:59:59');
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error al obtener interconsultas:', error);
      return [];
    }

    let resultado = (data || []) as InterconsultaCompleta[];

    // Filtro de médico: solo las que él solicitó o le dirigen
    if (filtros.idUsuarioMedico) {
      resultado = resultado.filter(
        (i) =>
          i.id_usuario_solicitante === filtros.idUsuarioMedico ||
          i.id_usuario_destino === filtros.idUsuarioMedico
      );
    }

    // Filtro por nombre de paciente (client-side porque es join)
    if (filtros.busquedaPaciente) {
      const termino = filtros.busquedaPaciente.toLowerCase();
      resultado = resultado.filter((i) => {
        const nombre = `${i.paciente?.nombre ?? ''} ${i.paciente?.apellido ?? ''}`.toLowerCase();
        const cedula = i.paciente?.cedula ?? '';
        return nombre.includes(termino) || cedula.includes(termino);
      });
    }

    return resultado;
  } catch (error) {
    console.error('❌ Error inesperado al obtener interconsultas:', error);
    return [];
  }
}

export async function getInterconsultasByConsulta(idConsultaMedica: number): Promise<InterconsultaCompleta[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('interconsulta')
      .select(SELECT_COMPLETO)
      .eq('id_consulta_medica', idConsultaMedica)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error al obtener interconsultas de consulta:', error);
      return [];
    }

    return (data || []) as InterconsultaCompleta[];
  } catch (error) {
    console.error('❌ Error inesperado al obtener interconsultas de consulta:', error);
    return [];
  }
}

export async function createInterconsulta(
  datos: Omit<Interconsulta, 'id_interconsulta' | 'created_at' | 'updated_at'>
): Promise<Interconsulta | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('interconsulta')
      .insert(datos)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear interconsulta:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Error inesperado al crear interconsulta:', error);
    return null;
  }
}

export async function updateEstadoInterconsulta(
  idInterconsulta: number,
  estado: Interconsulta['estado']
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('interconsulta')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id_interconsulta', idInterconsulta);

    if (error) {
      console.error('❌ Error al actualizar estado de interconsulta:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error inesperado al actualizar interconsulta:', error);
    return false;
  }
}

export async function deleteInterconsulta(idInterconsulta: number): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('interconsulta')
      .delete()
      .eq('id_interconsulta', idInterconsulta)
      .eq('estado', 'pendiente');

    if (error) {
      console.error('❌ Error al eliminar interconsulta:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error inesperado al eliminar interconsulta:', error);
    return false;
  }
}

export async function asignarCitaInterconsulta(
  idInterconsulta: number,
  idCita: number
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('interconsulta')
      .update({ id_cita_generada: idCita, estado: 'en_proceso', updated_at: new Date().toISOString() })
      .eq('id_interconsulta', idInterconsulta);

    if (error) {
      console.error('❌ Error al asignar cita a interconsulta:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error inesperado al asignar cita:', error);
    return false;
  }
}
