// Módulo Maternidad: aseguradoras, horarios, solicitudes (cotización / tour) y auditoría de correos
import { supabaseAdmin } from './supabase';
import { getPacienteByCedula } from './pacientesService';
import { consultarCedulaRegistroCivil } from './registroCivilService';
import type {
  ConfigCotizacionMaternidad,
  EstadoSolicitudMaternidad,
  MaternidadAseguradora,
  MaternidadCotizacion,
  MaternidadEnvioCorreo,
  MaternidadHorario,
  MaternidadHorarioDisponible,
  MaternidadSolicitud,
  MaternidadSolicitudVista,
} from './supabaseTypes';

// Las tablas de maternidad no están en el tipo Database generado
const tabla = (nombre: string) => (supabaseAdmin.from(nombre as any) as any);


export const ESTADOS_SOLICITUD_MATERNIDAD: { value: EstadoSolicitudMaternidad; label: string }[] = [
  { value: 'solo_cotizacion', label: 'Solo cotización' },
  { value: 'agendada', label: 'Tour agendado' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'asistio', label: 'Asistió' },
  { value: 'no_asistio', label: 'No asistió' },
  { value: 'cancelada', label: 'Cancelada' },
];

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
  origen?: 'CHATBOT' | 'SISTEMA';
  busqueda?: string;
}

export async function getSolicitudesMaternidad(filtros: FiltrosSolicitudesMaternidad = {}): Promise<MaternidadSolicitudVista[]> {
  try {
    let query = tabla('vista_maternidad_solicitudes').select('*');
    if (filtros.fechaTourDesde) query = query.gte('fecha_tour', filtros.fechaTourDesde);
    if (filtros.fechaTourHasta) query = query.lte('fecha_tour', filtros.fechaTourHasta);
    if (filtros.registroDesde) query = query.gte('created_at', `${filtros.registroDesde}T00:00:00-05:00`);
    if (filtros.registroHasta) query = query.lte('created_at', `${filtros.registroHasta}T23:59:59.999-05:00`);
    if (filtros.estado) query = query.eq('estado', filtros.estado);
    if (filtros.idAseguradora) query = query.eq('id_aseguradora_mat', filtros.idAseguradora);
    if (filtros.origen) query = query.eq('origen', filtros.origen);
    const busqueda = filtros.busqueda?.trim().replace(/[,()]/g, ' ');
    if (busqueda) {
      query = query.or(`nombre_madre.ilike.%${busqueda}%,cedula.ilike.%${busqueda}%,correo.ilike.%${busqueda}%,ultima_cotizacion.ilike.%${busqueda}%`);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
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

export async function updateEstadoSolicitudMaternidad(id: number, estado: EstadoSolicitudMaternidad): Promise<void> {
  try {
    const { error } = await tabla('maternidad_solicitud')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id_solicitud_mat', id);
    if (error) throw error;
  } catch (error) {
    console.error('❌ Error al actualizar estado de solicitud de maternidad:', error);
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
      cedula: solicitud.cedula,
      semanasGestacion: solicitud.semanas_gestacion,
      correo: solicitud.correo,
      telefono: solicitud.telefono,
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
