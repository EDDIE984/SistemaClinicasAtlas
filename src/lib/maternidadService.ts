// Módulo Maternidad: aseguradoras, horarios, solicitudes (cotización / tour) y auditoría de correos
import { supabaseAdmin } from './supabase';
import { getPacienteByCedula } from './pacientesService';
import { consultarCedulaRegistroCivil } from './registroCivilService';
import type {
  ConfigCotizacionMaternidad,
  EstadoSolicitudMaternidad,
  MaternidadAseguradora,
  MaternidadCorreoVista,
  MaternidadCotizacion,
  MaternidadEnvioCorreo,
  MaternidadHistorial,
  MaternidadHorario,
  MaternidadHorarioDisponible,
  MaternidadProforma,
  MaternidadSolicitud,
  MaternidadSolicitudVista,
  OrigenSolicitudMaternidad,
  ResultadoPartoMaternidad,
  TipoPartoMaternidad,
} from './supabaseTypes';

// Las tablas de maternidad no están en el tipo Database generado
const tabla = (nombre: string) => (supabaseAdmin.from(nombre as any) as any);


export const ESTADOS_SOLICITUD_MATERNIDAD: { value: EstadoSolicitudMaternidad; label: string; descripcion: string }[] = [
  { value: 'solo_cotizacion', label: 'Solo cotización', descripcion: 'Recibió la proforma y aún no agenda el tour' },
  { value: 'agendada', label: 'Tour agendado', descripcion: 'Tiene fecha y turno reservados para el tour' },
  { value: 'confirmada', label: 'Confirmada', descripcion: 'La mamá confirmó que asistirá al tour' },
  { value: 'asistio', label: 'Asistió', descripcion: 'Realizó el tour por la clínica' },
  { value: 'no_asistio', label: 'No asistió', descripcion: 'No se presentó al tour agendado' },
  { value: 'cancelada', label: 'Cancelada', descripcion: 'Se cancela la solicitud y se libera el cupo del turno' },
];

/** Estados que exigen un motivo al cambiar */
export const ESTADOS_CON_MOTIVO: EstadoSolicitudMaternidad[] = ['cancelada', 'no_asistio'];

export const RESULTADOS_PARTO_MATERNIDAD: { value: ResultadoPartoMaternidad; label: string; descripcion: string }[] = [
  { value: 'pendiente', label: 'Pendiente', descripcion: 'Aún no se registra el parto en la clínica' },
  { value: 'clinica', label: 'Dio a luz en la clínica', descripcion: 'El parto se realizó en Clínicas Atlas' },
  {
    value: 'perdida',
    label: 'Cerrar seguimiento',
    descripcion: 'No dará a luz en la clínica, no se pudo contactar o superó las 40 semanas',
  },
];

export const TIPOS_PARTO_MATERNIDAD: { value: TipoPartoMaternidad; label: string }[] = [
  { value: 'normal', label: 'Parto normal' },
  { value: 'cesarea', label: 'Cesárea' },
];

export const formatearResultadoParto = (resultado: ResultadoPartoMaternidad | null | undefined) =>
  resultado === 'perdida' ? 'Seguimiento cerrado'
    : RESULTADOS_PARTO_MATERNIDAD.find(r => r.value === resultado)?.label || 'Pendiente';

export const formatearTipoParto = (tipo: TipoPartoMaternidad | null | undefined) =>
  TIPOS_PARTO_MATERNIDAD.find(t => t.value === tipo)?.label || '';

export const formatearEstadoSolicitudMaternidad = (estado: EstadoSolicitudMaternidad) =>
  ESTADOS_SOLICITUD_MATERNIDAD.find(e => e.value === estado)?.label || estado;

/** Estados que ocupan cupo en un turno de tour */
export const ESTADOS_CON_TOUR: EstadoSolicitudMaternidad[] = ['agendada', 'confirmada', 'asistio'];

// Traduce los errores con prefijo lanzados por fn_maternidad_registrar
const MENSAJES_ERROR_RPC: Record<string, string> = {
  DATOS_INCOMPLETOS: 'Nombre, cédula, correo y teléfono son obligatorios',
  CORREO_INVALIDO: 'El correo electrónico no es válido',
  ASEGURADORA_INVALIDA: 'Seleccione una aseguradora activa',
  HORARIO_INVALIDO: 'El turno seleccionado no es válido para esa fecha',
  FECHA_PASADA: 'El turno seleccionado ya pasó',
  SIN_CUPO: 'El turno seleccionado ya no tiene cupos disponibles',
  SOLICITUD_NO_EXISTE: 'La solicitud no existe',
};

export function mensajeErrorMaternidad(error: unknown): string {
  const texto = (error as { message?: string })?.message || String(error);
  const codigo = Object.keys(MENSAJES_ERROR_RPC).find(c => texto.includes(c));
  return codigo ? MENSAJES_ERROR_RPC[codigo] : texto;
}

// ========================================
// Aseguradoras
// ========================================

export async function getAseguradorasMaternidad(soloActivas = false): Promise<MaternidadAseguradora[]> {
  try {
    let query = tabla('maternidad_aseguradora').select('*').order('orden').order('nombre');
    if (soloActivas) query = query.eq('estado', 'activo');
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error al obtener aseguradoras de maternidad:', error);
    throw error;
  }
}

export async function getAseguradoraMaternidadById(id: number): Promise<MaternidadAseguradora> {
  try {
    const { data, error } = await tabla('maternidad_aseguradora').select('*').eq('id_aseguradora_mat', id).single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error al obtener aseguradora de maternidad:', error);
    throw error;
  }
}

export async function createAseguradoraMaternidad(
  datos: Pick<MaternidadAseguradora, 'nombre' | 'orden' | 'estado'>,
): Promise<MaternidadAseguradora> {
  try {
    const { data, error } = await tabla('maternidad_aseguradora')
      .insert({ ...datos, nombre: datos.nombre.trim() })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error al crear aseguradora de maternidad:', error);
    throw error;
  }
}

export async function updateAseguradoraMaternidad(
  id: number,
  datos: Partial<Pick<MaternidadAseguradora, 'nombre' | 'orden' | 'estado' | 'config_cotizacion'>>,
): Promise<MaternidadAseguradora> {
  try {
    const { data, error } = await tabla('maternidad_aseguradora')
      .update({ ...datos, ...(datos.nombre ? { nombre: datos.nombre.trim() } : {}), updated_at: new Date().toISOString() })
      .eq('id_aseguradora_mat', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error al actualizar aseguradora de maternidad:', error);
    throw error;
  }
}

export async function deleteAseguradoraMaternidad(id: number): Promise<void> {
  try {
    const { error } = await tabla('maternidad_aseguradora').delete().eq('id_aseguradora_mat', id);
    if (error) throw error;
  } catch (error) {
    console.error('❌ Error al eliminar aseguradora de maternidad:', error);
    throw error;
  }
}

/** Genera el presupuesto con datos de ejemplo (sin guardar ni enviar) y devuelve una URL para abrir el PDF */
export async function vistaPreviaPresupuestoMaternidad(config: ConfigCotizacionMaternidad): Promise<string> {
  try {
    const res = await fetch('/api/maternidad-cotizacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vista_previa: true, config }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.pdf_base64) throw new Error(data.error || res.statusText || 'No se pudo generar la vista previa');
    const bytes = Uint8Array.from(atob(data.pdf_base64), c => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  } catch (error) {
    console.error('❌ Error al generar vista previa del presupuesto:', error);
    throw error;
  }
}

// ========================================
// Horarios
// ========================================

export async function getHorariosMaternidad(): Promise<MaternidadHorario[]> {
  try {
    const { data, error } = await tabla('maternidad_horario')
      .select('*')
      .order('dia_semana')
      .order('hora_inicio');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error al obtener horarios de maternidad:', error);
    throw error;
  }
}

export async function createHorarioMaternidad(
  datos: Pick<MaternidadHorario, 'dia_semana' | 'hora_inicio' | 'hora_fin' | 'cupo' | 'estado'>,
): Promise<MaternidadHorario> {
  try {
    const { data, error } = await tabla('maternidad_horario').insert(datos).select().single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error al crear horario de maternidad:', error);
    throw error;
  }
}

export async function updateHorarioMaternidad(
  id: number,
  datos: Partial<Pick<MaternidadHorario, 'hora_inicio' | 'hora_fin' | 'cupo' | 'estado'>>,
): Promise<MaternidadHorario> {
  try {
    const { data, error } = await tabla('maternidad_horario')
      .update({ ...datos, updated_at: new Date().toISOString() })
      .eq('id_horario_mat', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error al actualizar horario de maternidad:', error);
    throw error;
  }
}

export async function deleteHorarioMaternidad(id: number): Promise<void> {
  try {
    const { error } = await tabla('maternidad_horario').delete().eq('id_horario_mat', id);
    if (error) throw error;
  } catch (error) {
    console.error('❌ Error al eliminar horario de maternidad:', error);
    throw error;
  }
}

/** Turnos de los próximos 30 días (incluye los llenos) desde vista_maternidad_horarios_disponibles */
export async function getHorariosDisponiblesMaternidad(desde?: string, hasta?: string): Promise<MaternidadHorarioDisponible[]> {
  try {
    let query = tabla('vista_maternidad_horarios_disponibles').select('*');
    if (desde) query = query.gte('fecha', desde);
    if (hasta) query = query.lte('fecha', hasta);
    const { data, error } = await query.order('fecha').order('hora_inicio');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error al obtener horarios disponibles de maternidad:', error);
    throw error;
  }
}

// ========================================
// Solicitudes
// ========================================

export interface FiltrosSolicitudesMaternidad {
  /** Rango sobre la fecha del tour (calendario) */
  fechaTourDesde?: string;
  fechaTourHasta?: string;
  /** Rango sobre la fecha de registro (reportes) — YYYY-MM-DD en hora de Ecuador */
  registroDesde?: string;
  registroHasta?: string;
  estado?: EstadoSolicitudMaternidad;
  idAseguradora?: number;
  origen?: OrigenSolicitudMaternidad;
  /** Excluye un origen (la agenda no muestra los tours de la bitácora histórica) */
  excluirOrigen?: OrigenSolicitudMaternidad;
  busqueda?: string;
  resultadoParto?: ResultadoPartoMaternidad;
  /** Solo solicitudes que nunca agendaron tour */
  sinTour?: boolean;
  /** Solo solicitudes con al menos una proforma enviada */
  conProformaEnviada?: boolean;
  /** Rango sobre la fecha de la última cotización — YYYY-MM-DD en hora de Ecuador */
  envioDesde?: string;
  envioHasta?: string;
}

/** Supabase devuelve como máximo 1000 filas por consulta: se pide por páginas */
const TAMANO_PAGINA = 1000;

export async function getSolicitudesMaternidad(filtros: FiltrosSolicitudesMaternidad = {}): Promise<MaternidadSolicitudVista[]> {
  // El constructor de consultas se modifica al filtrar: se arma uno nuevo por página
  const construir = () => {
    let query = tabla('vista_maternidad_solicitudes').select('*');
    if (filtros.fechaTourDesde) query = query.gte('fecha_tour', filtros.fechaTourDesde);
    if (filtros.fechaTourHasta) query = query.lte('fecha_tour', filtros.fechaTourHasta);
    if (filtros.registroDesde) query = query.gte('created_at', `${filtros.registroDesde}T00:00:00-05:00`);
    if (filtros.registroHasta) query = query.lte('created_at', `${filtros.registroHasta}T23:59:59.999-05:00`);
    if (filtros.estado) query = query.eq('estado', filtros.estado);
    if (filtros.idAseguradora) query = query.eq('id_aseguradora_mat', filtros.idAseguradora);
    if (filtros.origen) query = query.eq('origen', filtros.origen);
    if (filtros.excluirOrigen) query = query.neq('origen', filtros.excluirOrigen);
    if (filtros.resultadoParto) query = query.eq('resultado_parto', filtros.resultadoParto);
    if (filtros.sinTour) query = query.is('fecha_tour', null);
    if (filtros.conProformaEnviada) query = query.gt('correos_enviados', 0);
    if (filtros.envioDesde) query = query.gte('ultima_cotizacion_fecha', `${filtros.envioDesde}T00:00:00-05:00`);
    if (filtros.envioHasta) query = query.lte('ultima_cotizacion_fecha', `${filtros.envioHasta}T23:59:59.999-05:00`);
    const busqueda = filtros.busqueda?.trim().replace(/[,()]/g, ' ');
    if (busqueda) {
      query = query.or(
        `nombre_madre.ilike.%${busqueda}%,cedula.ilike.%${busqueda}%,correo.ilike.%${busqueda}%,ultima_cotizacion.ilike.%${busqueda}%,`
        + `telefono.ilike.%${busqueda}%,medico_ginecologo.ilike.%${busqueda}%`,
      );
    }
    return query.order('created_at', { ascending: false }).order('id_solicitud_mat', { ascending: false });
  };

  try {
    const resultado: MaternidadSolicitudVista[] = [];
    for (let desde = 0; ; desde += TAMANO_PAGINA) {
      const { data, error } = await construir().range(desde, desde + TAMANO_PAGINA - 1);
      if (error) throw error;
      resultado.push(...(data || []));
      if (!data || data.length < TAMANO_PAGINA) break;
    }
    return resultado;
  } catch (error) {
    console.error('❌ Error al obtener solicitudes de maternidad:', error);
    throw error;
  }
}

export interface DatosRegistroMaternidad {
  nombre_madre: string;
  cedula: string;
  correo: string;
  telefono: string;
  semanas_gestacion?: number | null;
  medico_ginecologo?: string | null;
  id_aseguradora_mat: number;
  /** Sin fecha = solo cotización */
  fecha_tour?: string | null;
  id_horario_mat?: number | null;
  notas?: string | null;
  creado_por?: string | null;
  /** Para agendar el tour sobre una solicitud existente */
  id_solicitud_mat?: number | null;
}

export interface ResultadoRegistroMaternidad extends MaternidadSolicitud {
  accion: 'creada' | 'actualizada';
  aseguradora: string;
  tour_agendado: boolean;
  tour_nuevo: boolean;
  tenia_tour: boolean;
}

/** Registra la solicitud desde la web mediante fn_maternidad_registrar (valida cupo y aseguradora). */
export async function registrarSolicitudMaternidad(datos: DatosRegistroMaternidad): Promise<ResultadoRegistroMaternidad> {
  try {
    const { data, error } = await (supabaseAdmin.rpc as any)('fn_maternidad_registrar', {
      p_nombre_madre: datos.nombre_madre,
      p_cedula: datos.cedula,
      p_correo: datos.correo,
      p_telefono: datos.telefono,
      p_semanas_gestacion: datos.semanas_gestacion ?? null,
      p_medico_ginecologo: datos.medico_ginecologo ?? null,
      p_id_aseguradora_mat: datos.id_aseguradora_mat,
      p_fecha_tour: datos.fecha_tour || null,
      p_id_horario_mat: datos.fecha_tour ? datos.id_horario_mat ?? null : null,
      p_origen: 'SISTEMA',
      p_notas: datos.notas ?? null,
      p_creado_por: datos.creado_por ?? null,
      p_id_solicitud_mat: datos.id_solicitud_mat ?? null,
    });
    if (error) throw error;
    return data as ResultadoRegistroMaternidad;
  } catch (error) {
    console.error('❌ Error al registrar solicitud de maternidad:', error);
    throw error;
  }
}

/** Datos del tour realizado (bitácora): se piden al marcar "Asistió" */
export interface DatosTourRealizado {
  asesor: string;
  hora_inicio_real: string | null;
  hora_fin_real: string | null;
  firma_paciente: boolean | null;
}

/**
 * Cambia el estado del tour; el motivo y el usuario quedan en maternidad_historial (trigger).
 * Al pasar a "asistio" se guardan los datos del tour y la base asigna el número de bitácora.
 */
export async function updateEstadoSolicitudMaternidad(
  id: number,
  estado: EstadoSolicitudMaternidad,
  usuario: string,
  motivo?: string | null,
  datosTour?: DatosTourRealizado | null,
): Promise<MaternidadSolicitud> {
  try {
    const { data, error } = await tabla('maternidad_solicitud')
      .update({
        estado,
        motivo_estado: motivo?.trim() || null,
        ...(datosTour ? {
          asesor: datosTour.asesor.trim().toUpperCase(),
          hora_inicio_real: datosTour.hora_inicio_real || null,
          hora_fin_real: datosTour.hora_fin_real || null,
          firma_paciente: datosTour.firma_paciente,
        } : {}),
        actualizado_por: usuario,
        updated_at: new Date().toISOString(),
      })
      .eq('id_solicitud_mat', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error al actualizar estado de solicitud de maternidad:', error);
    throw error;
  }
}

/** Asesores ya usados en la bitácora (para sugerirlos al marcar "Asistió") */
export async function getAsesoresMaternidad(): Promise<string[]> {
  try {
    const { data, error } = await tabla('maternidad_solicitud')
      .select('asesor')
      .not('asesor', 'is', null)
      .limit(5000);
    if (error) throw error;
    return [...new Set((data || []).map((r: { asesor: string }) => r.asesor.trim().toUpperCase()))].sort() as string[];
  } catch (error) {
    console.error('❌ Error al obtener asesores de maternidad:', error);
    throw error;
  }
}

/** Tours agendados o confirmados cuya fecha ya pasó y aún no se marcan como asistió / no asistió */
export async function contarToursSinMarcarMaternidad(hoy: string): Promise<number> {
  try {
    const { count, error } = await tabla('maternidad_solicitud')
      .select('id_solicitud_mat', { count: 'exact', head: true })
      .in('estado', ['agendada', 'confirmada'])
      .lt('fecha_tour', hoy);
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('❌ Error al contar tours sin marcar de maternidad:', error);
    throw error;
  }
}

// ========================================
// Alertas de seguimiento (perfil maternidad)
// ========================================

/** Mamás en alerta roja: tour realizado o proforma sin tour, entre 20 y 40 semanas, sin parto registrado */
export async function getAlertasSeguimientoMaternidad(): Promise<MaternidadSolicitudVista[]> {
  try {
    const resultado: MaternidadSolicitudVista[] = [];
    for (let desde = 0; ; desde += TAMANO_PAGINA) {
      const { data, error } = await tabla('vista_maternidad_solicitudes')
        .select('*')
        .eq('en_seguimiento', true)
        .in('estado_seguimiento', ['llamar', 'seguimiento'])
        .order('semanas_actuales', { ascending: false })
        .order('id_solicitud_mat')
        .range(desde, desde + TAMANO_PAGINA - 1);
      if (error) throw error;
      resultado.push(...(data || []));
      if (!data || data.length < TAMANO_PAGINA) break;
    }
    return resultado;
  } catch (error) {
    console.error('❌ Error al obtener alertas de seguimiento de maternidad:', error);
    throw error;
  }
}

/** Mamás en seguimiento sin semanas registradas (no se puede calcular la alerta) */
export async function contarSinSemanasMaternidad(): Promise<number> {
  try {
    const { count, error } = await tabla('vista_maternidad_solicitudes')
      .select('id_solicitud_mat', { count: 'exact', head: true })
      .eq('en_seguimiento', true)
      .eq('estado_seguimiento', 'sin_semanas');
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('❌ Error al contar mamás sin semanas de maternidad:', error);
    throw error;
  }
}

/** Cierra como "perdida" lo que superó 40 semanas sin parto (también corre a diario con pg_cron) */
export async function cerrarSeguimientosVencidosMaternidad(): Promise<number> {
  try {
    const { data, error } = await (supabaseAdmin.rpc as any)('fn_maternidad_cerrar_seguimientos_vencidos');
    if (error) throw error;
    return Number(data) || 0;
  } catch (error) {
    console.error('❌ Error al cerrar seguimientos vencidos de maternidad:', error);
    throw error;
  }
}

/** Actualiza las semanas de gestación: la base toma hoy como nueva fecha de referencia */
export async function updateSemanasMaternidad(id: number, semanas: number, usuario: string): Promise<MaternidadSolicitud> {
  try {
    const { data, error } = await tabla('maternidad_solicitud')
      .update({ semanas_gestacion: semanas, actualizado_por: usuario, updated_at: new Date().toISOString() })
      .eq('id_solicitud_mat', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error al actualizar semanas de gestación de maternidad:', error);
    throw error;
  }
}

export interface DatosPartoMaternidad {
  resultado_parto: ResultadoPartoMaternidad;
  fecha_parto: string | null;
  tipo_parto: TipoPartoMaternidad | null;
  observacion_parto: string | null;
}

/** Seguimiento del parto (independiente del estado del tour) */
export async function updatePartoSolicitudMaternidad(
  id: number,
  datos: DatosPartoMaternidad,
  usuario: string,
): Promise<MaternidadSolicitud> {
  try {
    const enClinica = datos.resultado_parto === 'clinica';
    const { data, error } = await tabla('maternidad_solicitud')
      .update({
        resultado_parto: datos.resultado_parto,
        fecha_parto: enClinica ? datos.fecha_parto : null,
        tipo_parto: enClinica ? datos.tipo_parto : null,
        observacion_parto: datos.resultado_parto === 'pendiente' ? null : datos.observacion_parto?.trim() || null,
        actualizado_por: usuario,
        updated_at: new Date().toISOString(),
      })
      .eq('id_solicitud_mat', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error al actualizar el parto de la solicitud de maternidad:', error);
    throw error;
  }
}

export async function getHistorialBySolicitud(idSolicitud: number): Promise<MaternidadHistorial[]> {
  try {
    const { data, error } = await tabla('maternidad_historial')
      .select('*')
      .eq('id_solicitud_mat', idSolicitud)
      .order('created_at', { ascending: false })
      .order('id_historial_mat', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error al obtener el historial de maternidad:', error);
    throw error;
  }
}

/** Historial de varias solicitudes (Excel), en bloques para no exceder el largo de la URL */
export async function getHistorialBySolicitudes(ids: number[]): Promise<MaternidadHistorial[]> {
  try {
    const resultado: MaternidadHistorial[] = [];
    // Bloques de 100 solicitudes: cada uno queda por debajo del máximo de 1000 filas por consulta
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await tabla('maternidad_historial')
        .select('*')
        .in('id_solicitud_mat', ids.slice(i, i + 100))
        .order('created_at');
      if (error) throw error;
      resultado.push(...(data || []));
    }
    return resultado.sort((a, b) => a.id_solicitud_mat - b.id_solicitud_mat || a.created_at.localeCompare(b.created_at));
  } catch (error) {
    console.error('❌ Error al obtener el historial de maternidad:', error);
    throw error;
  }
}

/** Una solicitud con los campos calculados de la vista (semanas actuales, seguimiento, aseguradora) */
export async function getSolicitudVistaMaternidad(id: number): Promise<MaternidadSolicitudVista | null> {
  try {
    const { data, error } = await tabla('vista_maternidad_solicitudes').select('*').eq('id_solicitud_mat', id).maybeSingle();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error al obtener la solicitud de maternidad:', error);
    throw error;
  }
}

/** Datos de la mamá que se pueden corregir desde el detalle (no incluye teléfono, tour ni creado_por) */
export interface DatosEditablesSolicitudMaternidad {
  nombre_madre: string;
  /** Opcionales solo en tours de la bitácora histórica */
  cedula: string | null;
  correo: string | null;
  semanas_gestacion: number | null;
  medico_ginecologo: string | null;
  id_aseguradora_mat: number | null;
  notas: string | null;
  /** Solo para tours realizados (bitácora) */
  tour?: DatosTourRealizado | null;
}

export async function updateDatosSolicitudMaternidad(
  id: number,
  datos: DatosEditablesSolicitudMaternidad,
  usuario: string,
): Promise<MaternidadSolicitud> {
  try {
    const { data, error } = await tabla('maternidad_solicitud')
      .update({
        nombre_madre: datos.nombre_madre.trim(),
        cedula: datos.cedula?.replace(/\s/g, '') || null,
        correo: datos.correo?.trim().toLowerCase() || null,
        semanas_gestacion: datos.semanas_gestacion,
        medico_ginecologo: datos.medico_ginecologo?.trim() || null,
        id_aseguradora_mat: datos.id_aseguradora_mat,
        notas: datos.notas?.trim() || null,
        ...(datos.tour ? {
          asesor: datos.tour.asesor.trim().toUpperCase() || null,
          hora_inicio_real: datos.tour.hora_inicio_real || null,
          hora_fin_real: datos.tour.hora_fin_real || null,
          firma_paciente: datos.tour.firma_paciente,
        } : {}),
        actualizado_por: usuario,
        updated_at: new Date().toISOString(),
      })
      .eq('id_solicitud_mat', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error al actualizar datos de la solicitud de maternidad:', error);
    throw error;
  }
}

/** Nombre completo según el Registro Civil, en su orden (APELLIDOS NOMBRES, como llegan los registros de WhatsApp) */
export async function consultarNombreRegistroCivil(cedula: string): Promise<string | null> {
  try {
    const persona = await consultarCedulaRegistroCivil(cedula);
    const nombre = persona ? `${persona.apellidos} ${persona.nombres}`.trim() : '';
    return nombre || null;
  } catch (error) {
    console.error('❌ Error al consultar el nombre en el Registro Civil:', error);
    throw error;
  }
}

export interface DatosMadreEncontrados {
  fuente: 'maternidad' | 'paciente' | 'registro_civil';
  nombre_madre: string;
  correo?: string | null;
  telefono?: string | null;
  semanas_gestacion?: number | null;
  medico_ginecologo?: string | null;
  id_aseguradora_mat?: number | null;
}

/**
 * Busca los datos de la mamá por cédula. Si ya existe en el sistema (solicitud de maternidad previa
 * o paciente registrado) devuelve esos datos SIN consultar el Registro Civil; solo si no existe consulta el webservice.
 */
export async function buscarDatosMadrePorCedula(cedula: string): Promise<DatosMadreEncontrados | null> {
  try {
    const { data: previa, error } = await tabla('maternidad_solicitud')
      .select('nombre_madre, correo, telefono, semanas_gestacion, medico_ginecologo, id_aseguradora_mat')
      .eq('cedula', cedula)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (previa) return { fuente: 'maternidad', ...previa };

    const paciente = await getPacienteByCedula(cedula);
    if (paciente) {
      return {
        fuente: 'paciente',
        nombre_madre: `${paciente.nombres} ${paciente.apellidos}`.trim(),
        correo: paciente.email,
        telefono: paciente.telefono,
      };
    }

    const persona = await consultarCedulaRegistroCivil(cedula);
    if (persona && (persona.nombres || persona.apellidos)) {
      return { fuente: 'registro_civil', nombre_madre: `${persona.nombres} ${persona.apellidos}`.trim() };
    }
    return null;
  } catch (error) {
    console.error('❌ Error al buscar datos de la mamá por cédula:', error);
    throw error;
  }
}

// ========================================
// Correos
// ========================================

export async function getEnviosCorreoBySolicitud(idSolicitud: number): Promise<MaternidadEnvioCorreo[]> {
  try {
    const { data, error } = await tabla('maternidad_envio_correo')
      .select('*')
      .eq('id_solicitud_mat', idSolicitud)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error al obtener envíos de correo de maternidad:', error);
    throw error;
  }
}

export async function getCotizacionesBySolicitud(idSolicitud: number): Promise<MaternidadCotizacion[]> {
  try {
    const { data, error } = await tabla('maternidad_cotizacion')
      .select('*')
      .eq('id_solicitud_mat', idSolicitud)
      .order('fecha_emision', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error al obtener cotizaciones de maternidad:', error);
    throw error;
  }
}

/** Proformas enviadas (con fecha de envío) dentro del período, con los datos de su solicitud */
export async function getProformasMaternidad(envioDesde?: string, envioHasta?: string): Promise<MaternidadProforma[]> {
  try {
    const resultado: MaternidadProforma[] = [];
    for (let desde = 0; ; desde += TAMANO_PAGINA) {
      let query = tabla('maternidad_cotizacion')
        .select('*, solicitud:maternidad_solicitud(id_solicitud_mat, nombre_madre, cedula, telefono, correo, origen, estado, fecha_tour, resultado_parto, semanas_gestacion, medico_ginecologo)')
        .not('fecha_envio', 'is', null);
      if (envioDesde) query = query.gte('fecha_envio', `${envioDesde}T00:00:00-05:00`);
      if (envioHasta) query = query.lte('fecha_envio', `${envioHasta}T23:59:59.999-05:00`);
      const { data, error } = await query
        .order('fecha_envio', { ascending: false })
        .order('id_cotizacion_mat', { ascending: false })
        .range(desde, desde + TAMANO_PAGINA - 1);
      if (error) throw error;
      resultado.push(...(data || []));
      if (!data || data.length < TAMANO_PAGINA) break;
    }
    return resultado;
  } catch (error) {
    console.error('❌ Error al obtener proformas de maternidad:', error);
    throw error;
  }
}

/** Todos los envíos de correo de varias solicitudes (fechas de envío de cada proforma) */
export async function getEnviosCorreoBySolicitudes(ids: number[]): Promise<MaternidadEnvioCorreo[]> {
  try {
    const resultado: MaternidadEnvioCorreo[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await tabla('maternidad_envio_correo')
        .select('*')
        .in('id_solicitud_mat', ids.slice(i, i + 100))
        .order('created_at');
      if (error) throw error;
      resultado.push(...(data || []));
    }
    return resultado;
  } catch (error) {
    console.error('❌ Error al obtener envíos de correo de maternidad:', error);
    throw error;
  }
}

// ========================================
// Pantalla Correos Maternidad (083: rebotes, correos inválidos y reintentos)
// ========================================

export interface FiltrosCorreosMaternidad {
  desde?: string;
  hasta?: string;
}

/** Envíos de correo con los datos de la solicitud y su estado real (vista_maternidad_correos) */
export async function getCorreosMaternidad(filtros: FiltrosCorreosMaternidad = {}): Promise<MaternidadCorreoVista[]> {
  try {
    const resultado: MaternidadCorreoVista[] = [];
    for (let desde = 0; ; desde += TAMANO_PAGINA) {
      let query = tabla('vista_maternidad_correos').select('*');
      if (filtros.desde) query = query.gte('created_at', `${filtros.desde}T00:00:00-05:00`);
      if (filtros.hasta) query = query.lte('created_at', `${filtros.hasta}T23:59:59.999-05:00`);
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .order('id_envio_mat', { ascending: false })
        .range(desde, desde + TAMANO_PAGINA - 1);
      if (error) throw error;
      resultado.push(...(data || []));
      if (!data || data.length < TAMANO_PAGINA) break;
    }
    return resultado;
  } catch (error) {
    console.error('❌ Error al obtener los correos de maternidad:', error);
    throw error;
  }
}

export interface ResultadoRevisionCorreos {
  rebotes_detectados: { id_envio_mat: number; destinatario: string; detalle: string | null }[];
  invalidos_detectados: { id_envio_mat: number; destinatario: string; detalle: string; sugerido: string | null }[];
  reintentos: { id_envio_mat: number; ok: boolean; error?: string }[];
  pendientes: number | null;
  imap: { carpetas: string[]; avisos: number } | { error: string };
}

/** Lee los rebotes de la casilla, marca los correos inválidos y reintenta los envíos con error (Vercel) */
export async function revisarCorreosMaternidad(): Promise<ResultadoRevisionCorreos> {
  try {
    const res = await fetch('/api/maternidad-correos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'revisar' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || res.statusText || 'No se pudieron revisar los correos');
    return data;
  } catch (error) {
    console.error('❌ Error al revisar los correos de maternidad:', error);
    throw error;
  }
}

export interface ValidacionCorreoRapida {
  valido: boolean;
  motivo: string | null;
  sugerencia: string | null;
  mensaje: string;
}

/** Formato, dominio mal escrito (outloook.es → outlook.es) y dominio inexistente, en menos de 1 s */
export async function validarCorreoRapido(correo: string): Promise<ValidacionCorreoRapida> {
  try {
    const res = await fetch('/api/validar-correo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, rapida: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || res.statusText || 'No se pudo validar el correo');
    return { valido: data.valido, motivo: data.motivo, sugerencia: data.sugerencia, mensaje: data.mensaje };
  } catch (error) {
    console.error('❌ Error al validar el correo:', error);
    throw error;
  }
}

/** Corrige solo el correo de la solicitud (el historial registra el cambio con el usuario) */
export async function updateCorreoSolicitudMaternidad(id: number, correo: string, usuario: string): Promise<MaternidadSolicitud> {
  try {
    const { data, error } = await tabla('maternidad_solicitud')
      .update({
        correo: correo.trim().toLowerCase(),
        actualizado_por: usuario,
        updated_at: new Date().toISOString(),
      })
      .eq('id_solicitud_mat', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error al corregir el correo de la solicitud de maternidad:', error);
    throw error;
  }
}

/** Datos para volver a armar el presupuesto de un envío (cotización + datos actuales de la solicitud) */
export async function getDatosPresupuestoMaternidad(idSolicitud: number, idCotizacion: number): Promise<{
  solicitud: MaternidadSolicitud;
  cotizacion: MaternidadCotizacion;
}> {
  try {
    const [{ data: solicitud, error: errorSolicitud }, { data: cotizacion, error: errorCotizacion }] = await Promise.all([
      tabla('maternidad_solicitud').select('*').eq('id_solicitud_mat', idSolicitud).single(),
      tabla('maternidad_cotizacion').select('*').eq('id_cotizacion_mat', idCotizacion).single(),
    ]);
    if (errorSolicitud) throw errorSolicitud;
    if (errorCotizacion) throw errorCotizacion;
    return { solicitud, cotizacion };
  } catch (error) {
    console.error('❌ Error al obtener los datos del presupuesto de maternidad:', error);
    throw error;
  }
}

/**
 * Vuelve a armar en el navegador el presupuesto de una cotización (los PDF no se guardan):
 * mismo número, fecha de emisión y valores, con los datos actuales de la solicitud. Devuelve una URL blob.
 */
export async function generarPdfCotizacionMaternidad(
  solicitud: Pick<MaternidadSolicitud, 'nombre_madre' | 'cedula' | 'semanas_gestacion' | 'correo' | 'telefono' | 'medico_ginecologo'>,
  cotizacion: Pick<MaternidadCotizacion, 'numero_cotizacion' | 'fecha_emision' | 'valores'>,
): Promise<string> {
  try {
    if (!cotizacion.valores) throw new Error('La cotización no tiene valores de presupuesto');
    // Import dinámico: el logo y la hoja membretada solo se descargan al imprimir
    const { generarPresupuestoMembretado } = await import('../../api/_lib/presupuestoMembretado');
    const pdf = await generarPresupuestoMembretado({
      numeroCotizacion: cotizacion.numero_cotizacion,
      fechaEmision: cotizacion.fecha_emision,
      nombreMadre: solicitud.nombre_madre,
      cedula: solicitud.cedula ?? '',
      semanasGestacion: solicitud.semanas_gestacion,
      correo: solicitud.correo ?? '',
      telefono: solicitud.telefono ?? '',
      medicoGinecologo: solicitud.medico_ginecologo,
    }, cotizacion.valores);
    return URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  } catch (error) {
    console.error('❌ Error al generar el PDF de la cotización de maternidad:', error);
    throw error;
  }
}

/**
 * Genera los 3 PDF (presupuesto, checklist, boletín) y envía el correo desde Vercel.
 * El endpoint siempre envía al correo registrado en la solicitud y deja la auditoría.
 */
export async function enviarCotizacionMaternidad(
  idSolicitud: number,
  enviadoPor: string,
  tipo: 'cotizacion' | 'confirmacion_tour' = 'cotizacion',
  /** Reenvía esa cotización (mismos PDF y número) en lugar de generar una nueva */
  idCotizacion?: number,
): Promise<{ ok: boolean; numero_cotizacion?: string; error?: string }> {
  try {
    const res = await fetch('/api/maternidad-cotizacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_solicitud_mat: idSolicitud, enviado_por: enviadoPor, tipo, id_cotizacion_mat: idCotizacion }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || res.statusText || 'No se pudo enviar el correo');
    }
    return { ok: true, numero_cotizacion: data.numero_cotizacion };
  } catch (error) {
    console.error('❌ Error al enviar cotización de maternidad:', error);
    throw error;
  }
}
