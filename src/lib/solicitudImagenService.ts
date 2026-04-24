import { supabaseAdmin } from './supabase';

export interface SolicitudImagen {
  id_solicitud_imagen: number;
  numero_solicitud_imagen: number;
  id_cita: number;
  id_paciente: number;
  id_sucursal: number;
  id_usuario_solicitante: number;
  fecha_solicitud: string;
  nombre_paciente: string;
  edad_paciente: number | null;
  procedimiento: string | null;
  antecedentes_clinico_quirurgico: string | null;
  cuadro_clinico: string | null;
  medicamentos: string | null;
  alergias: string | null;
  firma: string | null;
  sello: string | null;
  estado: 'activa' | 'anulada';
  created_at?: string;
  updated_at?: string;
}

interface UpsertSolicitudImagenInput {
  id_cita: number;
  id_paciente: number;
  id_sucursal: number;
  id_usuario_solicitante: number;
  fecha_solicitud: string;
  nombre_paciente: string;
  edad_paciente?: number | null;
  procedimiento?: string | null;
  antecedentes_clinico_quirurgico?: string | null;
  cuadro_clinico?: string | null;
  medicamentos?: string | null;
  alergias?: string | null;
  firma?: string | null;
  sello?: string | null;
}

export async function getSolicitudImagenByCita(idCita: number): Promise<SolicitudImagen | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('solicitud_imagen')
      .select('*')
      .eq('id_cita', idCita)
      .maybeSingle();

    if (error) {
      console.error('❌ Error al obtener solicitud de imagen por cita:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Error inesperado al obtener solicitud de imagen:', error);
    return null;
  }
}

export async function upsertSolicitudImagen(input: UpsertSolicitudImagenInput): Promise<SolicitudImagen | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('solicitud_imagen')
      .upsert(
        {
          id_cita: input.id_cita,
          id_paciente: input.id_paciente,
          id_sucursal: input.id_sucursal,
          id_usuario_solicitante: input.id_usuario_solicitante,
          fecha_solicitud: input.fecha_solicitud,
          nombre_paciente: input.nombre_paciente,
          edad_paciente: input.edad_paciente ?? null,
          procedimiento: input.procedimiento || null,
          antecedentes_clinico_quirurgico: input.antecedentes_clinico_quirurgico || null,
          cuadro_clinico: input.cuadro_clinico || null,
          medicamentos: input.medicamentos || null,
          alergias: input.alergias || null,
          firma: input.firma || null,
          sello: input.sello || null,
          estado: 'activa',
        },
        {
          onConflict: 'id_cita',
        }
      )
      .select('*')
      .single();

    if (error) {
      console.error('❌ Error al guardar solicitud de imagen:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Error inesperado al guardar solicitud de imagen:', error);
    return null;
  }
}
