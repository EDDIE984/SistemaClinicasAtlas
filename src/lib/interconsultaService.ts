import { supabaseAdmin } from './supabase';
import { Interconsulta, InterconsultaCompleta } from './supabaseTypes';

export interface FiltrosInterconsulta {
  estado?: 'ATENDIDO' | 'PENDIENTE_AGENDAR' | 'AGENDADA' | 'RECHAZADA' | 'todos'
  urgencia?: 'normal' | 'urgente' | 'todos'
  fechaDesde?: string
  fechaHasta?: string
  busquedaPaciente?: string
  idUsuarioMedico?: number
}

async function completarInterconsultas(rows: Interconsulta[]): Promise<InterconsultaCompleta[]> {
  if (rows.length === 0) return [];

  const pacienteIds = [...new Set(rows.map((i) => i.id_paciente).filter((id): id is number => Boolean(id)))];
  const usuarioIds = [
    ...new Set(
      rows
        .flatMap((i) => [i.id_usuario_solicitante, i.id_usuario_destino])
        .filter((id): id is number => Boolean(id))
    ),
  ];
  const especialidadIds = [...new Set(rows.map((i) => i.id_especialidad_destino).filter((id): id is number => Boolean(id)))];

  const [pacientesRes, usuariosRes, especialidadesRes] = await Promise.all([
    pacienteIds.length
      ? supabaseAdmin.from('paciente').select('id_paciente, nombres, apellidos, cedula, telefono').in('id_paciente', pacienteIds)
      : Promise.resolve({ data: [], error: null }),
    usuarioIds.length
      ? supabaseAdmin.from('usuario').select('id_usuario, nombre, apellido, tipo_usuario, telefono').in('id_usuario', usuarioIds)
      : Promise.resolve({ data: [], error: null }),
    especialidadIds.length
      ? supabaseAdmin.from('especialidad').select('id_especialidad, nombre').in('id_especialidad', especialidadIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (pacientesRes.error) console.error('❌ Error al completar pacientes de interconsulta:', pacientesRes.error);
  if (usuariosRes.error) console.error('❌ Error al completar usuarios de interconsulta:', usuariosRes.error);
  if (especialidadesRes.error) console.error('❌ Error al completar especialidades de interconsulta:', especialidadesRes.error);

  const pacientes = new Map((pacientesRes.data || []).map((p) => [p.id_paciente, p]));
  const usuarios = new Map((usuariosRes.data || []).map((u) => [u.id_usuario, u]));
  const especialidades = new Map((especialidadesRes.data || []).map((e) => [e.id_especialidad, e]));

  return rows.map((interconsulta) => ({
    ...interconsulta,
    paciente: interconsulta.id_paciente ? pacientes.get(interconsulta.id_paciente) : undefined,
    usuario_solicitante: interconsulta.id_usuario_solicitante ? usuarios.get(interconsulta.id_usuario_solicitante) : undefined,
    usuario_destino: interconsulta.id_usuario_destino ? usuarios.get(interconsulta.id_usuario_destino) ?? null : null,
    especialidad: interconsulta.id_especialidad_destino ? especialidades.get(interconsulta.id_especialidad_destino) ?? null : null,
  })) as InterconsultaCompleta[];
}

export async function getInterconsultas(filtros: FiltrosInterconsulta = {}): Promise<InterconsultaCompleta[]> {
  try {
    let query = supabaseAdmin
      .from('interconsulta')
      .select('*')
      .order('created_at', { ascending: false });

    if (filtros.estado && filtros.estado !== 'todos') {
      query = query.eq('estado', filtros.estado);
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

    let resultado = await completarInterconsultas((data || []) as Interconsulta[]);

    if (filtros.idUsuarioMedico) {
      resultado = resultado.filter(
        (i) =>
          i.id_usuario_solicitante === filtros.idUsuarioMedico ||
          i.id_usuario_destino === filtros.idUsuarioMedico ||
          (i.tipo_destino === 'interno' && !i.id_usuario_destino)
      );
    }

    if (filtros.busquedaPaciente) {
      const termino = filtros.busquedaPaciente.toLowerCase();
      resultado = resultado.filter((i) => {
        const nombres = i.paciente?.nombres ?? i.paciente?.nombre ?? '';
        const apellidos = i.paciente?.apellidos ?? i.paciente?.apellido ?? '';
        const nombre = `${nombres} ${apellidos}`.toLowerCase();
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
      .select('*')
      .eq('id_consulta_medica', idConsultaMedica)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error al obtener interconsultas de consulta:', error);
      return [];
    }

    return completarInterconsultas((data || []) as Interconsulta[]);
  } catch (error) {
    console.error('❌ Error inesperado al obtener interconsultas de consulta:', error);
    return [];
  }
}

export async function getInterconsultaByCita(idCita: number): Promise<Interconsulta | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('interconsulta')
      .select('*')
      .eq('id_cita_generada', idCita)
      .maybeSingle();

    if (error) {
      console.error('❌ Error al buscar interconsulta por cita:', error);
      return null;
    }

    return data as Interconsulta | null;
  } catch (error) {
    console.error('❌ Error inesperado al buscar interconsulta por cita:', error);
    return null;
  }
}

export async function createInterconsulta(
  datos: Omit<Interconsulta, 'id_interconsulta' | 'numero_interconsulta' | 'created_at' | 'updated_at'>
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

export async function updateInterconsultaGestion(
  idInterconsulta: number,
  data: {
    id_usuario_destino?: number | null;
    observaciones_gestor?: string | null;
  }
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('interconsulta')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id_interconsulta', idInterconsulta);

    if (error) {
      console.error('❌ Error al actualizar gestión de interconsulta:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error inesperado al actualizar gestión:', error);
    return false;
  }
}

export async function rechazarInterconsulta(idInterconsulta: number): Promise<boolean> {
  return updateEstadoInterconsulta(idInterconsulta, 'RECHAZADA');
}

export async function deleteInterconsulta(idInterconsulta: number): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('interconsulta')
      .delete()
      .eq('id_interconsulta', idInterconsulta)
      .eq('estado', 'PENDIENTE_AGENDAR');

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
      .update({ id_cita_generada: idCita, estado: 'AGENDADA', updated_at: new Date().toISOString() })
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
