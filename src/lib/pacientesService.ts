// Servicio de gestión de pacientes con Supabase
import { supabaseAdmin } from './supabase';  // ⚡ Cambio: usar supabaseAdmin en lugar de supabase

// ========================================
// INTERFACES Y TIPOS
// ========================================

export interface Paciente {
  id_paciente: number;
  id_compania: number;  // Agregado: campo de compañía
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  sexo: 'M' | 'F' | 'Otro';
  cedula: string;  // Cambio: era "identificacion"
  email: string | null;  // Cambio: era "correo"
  telefono: string | null;
  direccion: string | null;
  fecha_registro: string;
  estado: 'activo' | 'inactivo';
  created_at?: string;
}

export interface SignoVital {
  id_signo_vital: number;
  id_paciente: number;
  fecha_registro: string;
  estatura_cm: number | null;
  peso_kg: number | null;
  imc: number | null;
  perimetro_cefalico_cm: number | null;
  temperatura_c: number | null;
  frecuencia_respiratoria: number | null;
  frecuencia_cardiaca: number | null;
  presion_sistolica: number | null;
  presion_diastolica: number | null;
  saturacion_oxigeno: number | null;
  glucosa_mg_dl: number | null;
  glasgow_ocular: number | null;
  glasgow_verbal: number | null;
  glasgow_motora: number | null;
  reaccion_pupilar: string | null;
  tiempo_llenado_capilar_seg: number | null;
  notas: string | null;
  created_at?: string;
}

export interface AlertaSignoVital {
  id_alerta: number;
  id_signo_vital: number;
  campo: string;
  valor: number | null;
  rango_min: number | null;
  rango_max: number | null;
  nivel: 'advertencia' | 'critico';
  descripcion: string | null;
  created_at?: string;
}

export interface Antecedente {
  id_antecedente: number;
  id_paciente: number;
  tipo_antecedente: string;
  descripcion: string;
  fecha_diagnostico: string | null;
  estado: 'activo' | 'inactivo';  // Cambio: era "activo: boolean"
  created_at?: string;
}

export interface ArchivoMedico {
  id_archivo: number;
  id_paciente: number;
  nombre_archivo: string;
  descripcion: string | null;
  tipo_archivo: string;
  url_archivo: string | null;
  fecha_carga: string;
  created_at?: string;
}

// ========================================
// FUNCIONES DE PACIENTES
// ========================================

/**
 * Obtener todos los pacientes activos
 */
export async function getAllPacientes(): Promise<Paciente[]> {
  try {
    console.log('📋 Obteniendo lista de pacientes...');

    const { data, error } = await supabaseAdmin
      .from('paciente')
      .select('*')
      .eq('estado', 'activo')
      .order('apellidos', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener pacientes:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} pacientes`);
    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado al obtener pacientes:', error);
    return [];
  }
}

/**
 * Obtener todos los pacientes activos filtrados por compañía
 */
export async function getPacientesByCompania(idCompania: number): Promise<Paciente[]> {
  try {
    console.log('📋 Obteniendo pacientes de la compañía:', idCompania);

    const { data, error } = await supabaseAdmin
      .from('paciente')
      .select('*')
      .eq('estado', 'activo')
      .eq('id_compania', idCompania)
      .order('apellidos', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener pacientes:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} pacientes de la compañía ${idCompania}`);
    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado al obtener pacientes:', error);
    return [];
  }
}

/**
 * Buscar pacientes por nombre, apellido o identificación
 */
export async function searchPacientes(query: string): Promise<Paciente[]> {
  try {
    console.log('🔍 Buscando pacientes:', query);

    const searchTerm = `%${query}%`;

    const { data, error } = await supabaseAdmin
      .from('paciente')
      .select('*')
      .eq('activo', true)
      .or(`nombres.ilike.${searchTerm},apellidos.ilike.${searchTerm},cedula.ilike.${searchTerm}`)
      .order('apellidos', { ascending: true });

    if (error) {
      console.error('❌ Error al buscar pacientes:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} pacientes`);
    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado al buscar pacientes:', error);
    return [];
  }
}

/**
 * Buscar pacientes por nombre, apellido o identificación filtrado por compañía
 */
export async function searchPacientesByCompania(query: string, idCompania: number): Promise<Paciente[]> {
  try {
    console.log('🔍 Buscando pacientes:', query, 'en compañía:', idCompania);

    const searchTerm = `%${query}%`;

    const { data, error } = await supabaseAdmin
      .from('paciente')
      .select('*')
      .eq('estado', 'activo')
      .eq('id_compania', idCompania)
      .or(`nombres.ilike.${searchTerm},apellidos.ilike.${searchTerm},cedula.ilike.${searchTerm}`)
      .order('apellidos', { ascending: true });

    if (error) {
      console.error('❌ Error al buscar pacientes:', error);
      return [];
    }

    if (!data) return [];
    console.log(`✅ Se encontraron ${data.length} pacientes de la compañía ${idCompania}`);
    return data;
  } catch (error) {
    console.error('❌ Error inesperado al buscar pacientes:', error);
    return [];
  }
}

/**
 * Obtener un paciente por ID
 */
export async function getPacienteById(id_paciente: number): Promise<Paciente | null> {
  try {
    console.log('🔍 Obteniendo paciente ID:', id_paciente);

    const { data, error } = await supabaseAdmin
      .from('paciente' as any)
      .select('*')
      .eq('id_paciente', id_paciente)
      .maybeSingle(); // Cambiado de .single() a .maybeSingle()

    if (error) {
      console.error('❌ Error al obtener paciente:', error);
      return null;
    }

    if (!data) {
      console.log('ℹ️ No se encontró el paciente con ID:', id_paciente);
      return null;
    }

    const p = data as Paciente;
    console.log('✅ Paciente encontrado:', p.nombres, p.apellidos);
    return p;
  } catch (error) {
    console.error('❌ Error inesperado al obtener paciente:', error);
    return null;
  }
}

/**
 * Buscar paciente por cédula y compañía
 */
export async function getPacienteByCedula(cedula: string, id_compania?: number): Promise<Paciente | null> {
  try {
    console.log('🔍 Buscando paciente por cédula:', cedula, id_compania ? `en compañía ${id_compania}` : '');

    let query = supabaseAdmin
      .from('paciente')
      .select('*')
      .eq('cedula', cedula)
      .eq('estado', 'activo');

    // Si se proporciona id_compania, filtrar por compañía
    if (id_compania) {
      query = query.eq('id_compania', id_compania);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('❌ Error al buscar paciente por cédula:', error);
      return null;
    }

    if (data) {
      console.log('✅ Paciente encontrado con cédula:', cedula);
    } else {
      console.log('ℹ️ No se encontró paciente con cédula:', cedula);
    }

    return data as Paciente | null;
  } catch (error) {
    console.error('❌ Error inesperado al buscar paciente por cédula:', error);
    return null;
  }
}

/**
 * Crear un nuevo paciente
 */
export async function createPaciente(paciente: Omit<Paciente, 'id_paciente' | 'created_at' | 'estado'>): Promise<Paciente | null> {
  try {
    console.log('➕ Creando nuevo paciente:', paciente.nombres, paciente.apellidos);

    const { data, error } = await (supabaseAdmin
      .from('paciente') as any)
      .insert({
        ...paciente,
        estado: 'activo'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear paciente:', error);

      // Si es error de cédula duplicada, retornar null con mensaje específico
      if (error.code === '23505' && error.message.includes('cedula')) {
        throw new Error('CEDULA_DUPLICADA');
      }

      return null;
    }

    console.log('✅ Paciente creado exitosamente');
    return data;
  } catch (error) {
    console.error('❌ Error inesperado al crear paciente:', error);

    // Re-lanzar error de cédula duplicada
    if (error instanceof Error && error.message === 'CEDULA_DUPLICADA') {
      throw error;
    }

    return null;
  }
}

/**
 * Actualizar datos de un paciente
 */
export async function updatePaciente(id_paciente: number, updates: Partial<Paciente>): Promise<boolean> {
  try {
    console.log('✏️ Actualizando paciente ID:', id_paciente);

    const { error } = await (supabaseAdmin
      .from('paciente') as any)
      .update(updates as any)
      .eq('id_paciente', id_paciente);

    if (error) {
      console.error('❌ Error al actualizar paciente:', error);
      return false;
    }

    console.log('✅ Paciente actualizado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado al actualizar paciente:', error);
    return false;
  }
}

/**
 * Desactivar un paciente (soft delete)
 */
export async function deletePaciente(id_paciente: number): Promise<boolean> {
  try {
    console.log('🗑️ Desactivando paciente ID:', id_paciente);

    const { error } = await (supabaseAdmin
      .from('paciente') as any)
      .update({ estado: 'inactivo' } as any)
      .eq('id_paciente', id_paciente);

    if (error) {
      console.error('❌ Error al desactivar paciente:', error);
      return false;
    }

    console.log('✅ Paciente desactivado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado al desactivar paciente:', error);
    return false;
  }
}

// ========================================
// RANGOS CLÍNICOS NORMALES DE SIGNOS VITALES
// ========================================

interface RangoSignoVital {
  etiqueta: string;
  unidad: string;
  normalMin: number;
  normalMax: number;
  advertenciaMin: number;
  advertenciaMax: number;
  criticoMin: number;
  criticoMax: number;
  soloMin?: boolean; // Para saturación de O2 (solo límite inferior)
}

export const RANGOS_SIGNOS_VITALES: Record<string, RangoSignoVital> = {
  temperatura_c: {
    etiqueta: 'Temperatura',
    unidad: '°C',
    normalMin: 36.1, normalMax: 37.2,
    advertenciaMin: 36.0, advertenciaMax: 37.5,
    criticoMin: 35.0, criticoMax: 38.5,
  },
  frecuencia_cardiaca: {
    etiqueta: 'Frecuencia Cardíaca',
    unidad: 'bpm',
    normalMin: 60, normalMax: 100,
    advertenciaMin: 55, advertenciaMax: 105,
    criticoMin: 50, criticoMax: 120,
  },
  frecuencia_respiratoria: {
    etiqueta: 'Frecuencia Respiratoria',
    unidad: 'rpm',
    normalMin: 12, normalMax: 20,
    advertenciaMin: 11, advertenciaMax: 22,
    criticoMin: 10, criticoMax: 25,
  },
  presion_sistolica: {
    etiqueta: 'Presión Sistólica',
    unidad: 'mmHg',
    normalMin: 90, normalMax: 120,
    advertenciaMin: 85, advertenciaMax: 140,
    criticoMin: 80, criticoMax: 160,
  },
  presion_diastolica: {
    etiqueta: 'Presión Diastólica',
    unidad: 'mmHg',
    normalMin: 60, normalMax: 80,
    advertenciaMin: 55, advertenciaMax: 90,
    criticoMin: 50, criticoMax: 100,
  },
  saturacion_oxigeno: {
    etiqueta: 'Saturación de Oxígeno',
    unidad: '%',
    normalMin: 95, normalMax: 100,
    advertenciaMin: 91, advertenciaMax: 100,
    criticoMin: 90, criticoMax: 100,
    soloMin: true,
  },
  glucosa_mg_dl: {
    etiqueta: 'Glucemia capilar',
    unidad: 'mg/dL',
    normalMin: 70, normalMax: 140,
    advertenciaMin: 60, advertenciaMax: 180,
    criticoMin: 55, criticoMax: 250,
  },
  tiempo_llenado_capilar_seg: {
    etiqueta: 'Tiempo de llenado capilar',
    unidad: 'seg',
    normalMin: 0, normalMax: 2,
    advertenciaMin: 0, advertenciaMax: 3,
    criticoMin: 0, criticoMax: 4,
  },
  glasgow_total: {
    etiqueta: 'Glasgow total',
    unidad: 'pts',
    normalMin: 15, normalMax: 15,
    advertenciaMin: 13, advertenciaMax: 15,
    criticoMin: 3, criticoMax: 12,
  },
  imc: {
    etiqueta: 'IMC',
    unidad: 'kg/m²',
    normalMin: 18.5, normalMax: 24.9,
    advertenciaMin: 17.0, advertenciaMax: 29.9,
    criticoMin: 16.0, criticoMax: 40.0,
  },
};

/**
 * Evalúa un registro de signos vitales y retorna las alertas generadas
 */
export function evaluarSignosVitales(
  signo: SignoVital
): Omit<AlertaSignoVital, 'id_alerta' | 'created_at'>[] {
  const alertas: Omit<AlertaSignoVital, 'id_alerta' | 'created_at'>[] = [];

  const evaluarCampo = (campo: string, valor: number | null | undefined, rango: RangoSignoVital) => {
    if (valor === null || valor === undefined) return;

    let nivel: 'advertencia' | 'critico' | null = null;
    let descripcion = '';

    if (valor < rango.criticoMin || (!rango.soloMin && valor > rango.criticoMax)) {
      nivel = 'critico';
      descripcion = valor < rango.criticoMin
        ? `${rango.etiqueta} muy baja: ${valor} ${rango.unidad} (mín. normal: ${rango.normalMin})`
        : `${rango.etiqueta} muy alta: ${valor} ${rango.unidad} (máx. normal: ${rango.normalMax})`;
    } else if (valor < rango.advertenciaMin || (!rango.soloMin && valor > rango.advertenciaMax)) {
      nivel = 'advertencia';
      descripcion = valor < rango.advertenciaMin
        ? `${rango.etiqueta} baja: ${valor} ${rango.unidad} (mín. normal: ${rango.normalMin})`
        : `${rango.etiqueta} alta: ${valor} ${rango.unidad} (máx. normal: ${rango.normalMax})`;
    }

    if (!nivel) return;

    alertas.push({
      id_signo_vital: signo.id_signo_vital,
      campo,
      valor,
      rango_min: rango.normalMin,
      rango_max: rango.soloMin ? null : rango.normalMax,
      nivel,
      descripcion,
    });
  };

  for (const [campo, rango] of Object.entries(RANGOS_SIGNOS_VITALES)) {
    if (campo === 'glasgow_total') continue;
    const valor = signo[campo as keyof SignoVital] as number | null;
    evaluarCampo(campo, valor, rango);
  }

  if (
    signo.glasgow_ocular != null &&
    signo.glasgow_verbal != null &&
    signo.glasgow_motora != null
  ) {
    const glasgowTotal = signo.glasgow_ocular + signo.glasgow_verbal + signo.glasgow_motora;
    evaluarCampo('glasgow_total', glasgowTotal, RANGOS_SIGNOS_VITALES.glasgow_total);
  }

  return alertas;
}

/**
 * Guarda (reemplaza) las alertas de un registro de signos vitales
 */
export async function saveAlertasSignoVital(
  id_signo_vital: number,
  alertas: Omit<AlertaSignoVital, 'id_alerta' | 'created_at'>[]
): Promise<void> {
  try {
    // Borrar alertas previas del registro
    await (supabaseAdmin.from('alerta_signo_vital') as any)
      .delete()
      .eq('id_signo_vital', id_signo_vital);

    if (alertas.length === 0) return;

    const { error } = await (supabaseAdmin.from('alerta_signo_vital') as any)
      .insert(alertas);

    if (error) {
      console.error('❌ Error al guardar alertas de signos vitales:', error);
    } else {
      console.log(`✅ ${alertas.length} alerta(s) guardada(s) para signo vital ${id_signo_vital}`);
    }
  } catch (error) {
    console.error('❌ Error inesperado al guardar alertas:', error);
  }
}

/**
 * Obtener alertas de un registro de signos vitales
 */
export async function getAlertasBySignoVital(id_signo_vital: number): Promise<AlertaSignoVital[]> {
  try {
    const { data, error } = await (supabaseAdmin.from('alerta_signo_vital') as any)
      .select('*')
      .eq('id_signo_vital', id_signo_vital)
      .order('nivel', { ascending: false });

    if (error) {
      console.error('❌ Error al obtener alertas:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado al obtener alertas:', error);
    return [];
  }
}

// ========================================
// FUNCIONES DE SIGNOS VITALES
// ========================================

/**
 * Obtener todos los signos vitales de un paciente
 */
export async function getSignosVitalesByPaciente(id_paciente: number): Promise<SignoVital[]> {
  try {
    console.log('🔍 Obteniendo signos vitales del paciente:', id_paciente);

    const { data, error } = await supabaseAdmin
      .from('signo_vital' as any)
      .select('*')
      .eq('id_paciente', id_paciente)
      .order('fecha_registro', { ascending: false });

    if (error) {
      console.error('❌ Error al obtener signos vitales:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} registros de signos vitales`);
    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado al obtener signos vitales:', error);
    return [];
  }
}

/**
 * Crear un nuevo registro de signos vitales
 */
export async function createSignoVital(signo: Omit<SignoVital, 'id_signo_vital' | 'created_at'>): Promise<SignoVital | null> {
  try {
    console.log('➕ Creando nuevo registro de signos vitales para paciente:', signo.id_paciente);
    console.log('📊 Datos a insertar:', JSON.stringify(signo, null, 2));

    // Asegurar que todos los valores numéricos estén en el formato correcto
    const signoLimpio = {
      ...signo,
      estatura_cm: signo.estatura_cm !== null ? Math.min(999.99, Math.max(0, Number(signo.estatura_cm))) : null,
      peso_kg: signo.peso_kg !== null ? Math.min(999.99, Math.max(0, Number(signo.peso_kg))) : null,
      imc: signo.imc !== null ? Math.min(999.99, Math.max(0, Number(signo.imc))) : null,
      perimetro_cefalico_cm: signo.perimetro_cefalico_cm !== null ? Math.min(999.99, Math.max(0, Number(signo.perimetro_cefalico_cm))) : null,
      temperatura_c: signo.temperatura_c !== null ? Math.min(999.99, Math.max(0, Number(signo.temperatura_c))) : null,
      frecuencia_respiratoria: signo.frecuencia_respiratoria !== null ? Math.min(999, Math.max(0, Number(signo.frecuencia_respiratoria))) : null,
      frecuencia_cardiaca: signo.frecuencia_cardiaca !== null ? Math.min(999, Math.max(0, Number(signo.frecuencia_cardiaca))) : null,
      presion_sistolica: signo.presion_sistolica !== null ? Math.min(999, Math.max(0, Number(signo.presion_sistolica))) : null,
      presion_diastolica: signo.presion_diastolica !== null ? Math.min(999, Math.max(0, Number(signo.presion_diastolica))) : null,
      saturacion_oxigeno: signo.saturacion_oxigeno !== null ? Math.min(100, Math.max(0, Number(signo.saturacion_oxigeno))) : null,
      glucosa_mg_dl: signo.glucosa_mg_dl !== null ? Math.min(999, Math.max(0, Number(signo.glucosa_mg_dl))) : null,
      glasgow_ocular: signo.glasgow_ocular !== null ? Math.min(4, Math.max(1, Number(signo.glasgow_ocular))) : null,
      glasgow_verbal: signo.glasgow_verbal !== null ? Math.min(5, Math.max(1, Number(signo.glasgow_verbal))) : null,
      glasgow_motora: signo.glasgow_motora !== null ? Math.min(6, Math.max(1, Number(signo.glasgow_motora))) : null,
      reaccion_pupilar: signo.reaccion_pupilar ? String(signo.reaccion_pupilar) : null,
      tiempo_llenado_capilar_seg: signo.tiempo_llenado_capilar_seg !== null ? Math.min(99.99, Math.max(0, Number(signo.tiempo_llenado_capilar_seg))) : null,
    };

    console.log('📊 Datos limpiados:', JSON.stringify(signoLimpio, null, 2));

    const { data, error } = await (supabaseAdmin
      .from('signo_vital') as any)
      .insert(signoLimpio)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear signos vitales:', error);
      return null;
    }

    console.log('✅ Signos vitales guardados exitosamente');

    // Evaluar y guardar alertas automáticamente
    const alertas = evaluarSignosVitales(data as SignoVital);
    await saveAlertasSignoVital(data.id_signo_vital, alertas);

    return data;
  } catch (error) {
    console.error('❌ Error inesperado al crear signos vitales:', error);
    return null;
  }
}

/**
 * Actualizar un registro de signos vitales
 */
export async function updateSignoVital(id_signo_vital: number, updates: Partial<SignoVital>): Promise<boolean> {
  try {
    console.log('✏️ Actualizando signos vitales ID:', id_signo_vital);

    const { error } = await (supabaseAdmin
      .from('signo_vital') as any)
      .update(updates as any)
      .eq('id_signo_vital', id_signo_vital);

    if (error) {
      console.error('❌ Error al actualizar signos vitales:', error);
      return false;
    }

    console.log('✅ Signos vitales actualizados exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado al actualizar signos vitales:', error);
    return false;
  }
}

// ========================================
// FUNCIONES DE ANTECEDENTES MÉDICOS
// ========================================

const ANTECEDENTE_TIPO_JSON = 'json';

function parseAntecedenteDescripcion(descripcion: string): any {
  try {
    return JSON.parse(descripcion);
  } catch {
    return descripcion;
  }
}

/**
 * Obtener todos los antecedentes de un paciente
 */
export async function getAntecedentesByPaciente(id_paciente: number): Promise<any> {
  try {
    console.log('🔍 Obteniendo antecedentes del paciente:', id_paciente);

    const { data, error } = await (supabaseAdmin
      .from('antecedente') as any)
      .select('categoria, tipo, descripcion, updated_at')
      .eq('id_paciente', id_paciente)
      .eq('estado', 'activo')
      .order('updated_at', { ascending: false })
      .order('id_antecedente', { ascending: false });

    if (error) {
      console.error('❌ Error al obtener antecedentes desde BD:', error);
      return {};
    }

    const antecedentes: Record<string, any> = {};
    for (const row of data || []) {
      const categoria = row.categoria as string;
      // Mantener el registro más reciente de cada categoría.
      if (antecedentes[categoria] !== undefined) continue;
      antecedentes[categoria] = parseAntecedenteDescripcion(row.descripcion as string);
    }

    console.log(`✅ Antecedentes cargados para paciente ${id_paciente}`);
    return antecedentes;
  } catch (error) {
    console.error('❌ Error inesperado al obtener antecedentes:', error);
    return {};
  }
}

/**
 * Guardar o actualizar antecedente de un paciente
 */
export async function saveAntecedente(id_paciente: number, tipo: string, datos: any): Promise<boolean> {
  try {
    console.log('💾 Guardando antecedente:', { id_paciente, tipo });

    const descripcion = JSON.stringify(datos ?? null);

    const { error: updateError } = await (supabaseAdmin
      .from('antecedente') as any)
      .update({ estado: 'inactivo' })
      .eq('id_paciente', id_paciente)
      .eq('categoria', tipo)
      .eq('tipo', ANTECEDENTE_TIPO_JSON)
      .eq('estado', 'activo');

    if (updateError) {
      console.error('❌ Error al desactivar antecedente previo:', updateError);
      return false;
    }

    const { error: insertError } = await (supabaseAdmin
      .from('antecedente') as any)
      .insert({
        id_paciente,
        categoria: tipo,
        tipo: ANTECEDENTE_TIPO_JSON,
        descripcion,
        estado: 'activo'
      });

    if (insertError) {
      console.error('❌ Error al guardar antecedente en BD:', insertError);
      return false;
    }

    console.log('✅ Antecedente guardado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado al guardar antecedente:', error);
    return false;
  }
}

/**
 * Funciones legacy para compatibilidad
 */
export async function createAntecedente(antecedente: Omit<Antecedente, 'id_antecedente' | 'created_at' | 'estado'>): Promise<Antecedente | null> {
  try {
    const categoria = antecedente.tipo_antecedente || 'general';
    const { data, error } = await (supabaseAdmin
      .from('antecedente') as any)
      .insert({
        id_paciente: antecedente.id_paciente,
        categoria,
        tipo: categoria,
        descripcion: antecedente.descripcion,
        fecha_diagnostico: antecedente.fecha_diagnostico,
        estado: 'activo'
      })
      .select()
      .single();

    if (error || !data) {
      console.error('❌ Error al crear antecedente:', error);
      return null;
    }

    return {
      id_antecedente: data.id_antecedente,
      id_paciente: data.id_paciente,
      tipo_antecedente: data.categoria,
      descripcion: data.descripcion,
      fecha_diagnostico: data.fecha_diagnostico,
      estado: data.estado,
      created_at: data.created_at
    } as Antecedente;
  } catch (error) {
    console.error('❌ Error inesperado al crear antecedente:', error);
    return null;
  }
}

export async function updateAntecedente(id_antecedente: number, updates: Partial<Antecedente>): Promise<boolean> {
  try {
    const payload: Record<string, any> = {};
    if (typeof updates.descripcion === 'string') payload.descripcion = updates.descripcion;
    if (updates.fecha_diagnostico !== undefined) payload.fecha_diagnostico = updates.fecha_diagnostico;
    if (updates.estado) payload.estado = updates.estado;
    if (updates.tipo_antecedente) {
      payload.categoria = updates.tipo_antecedente;
      payload.tipo = updates.tipo_antecedente;
    }

    const { error } = await (supabaseAdmin
      .from('antecedente') as any)
      .update(payload)
      .eq('id_antecedente', id_antecedente);

    if (error) {
      console.error('❌ Error al actualizar antecedente:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error inesperado al actualizar antecedente:', error);
    return false;
  }
}

export async function deleteAntecedente(id_antecedente: number): Promise<boolean> {
  try {
    const { error } = await (supabaseAdmin
      .from('antecedente') as any)
      .update({ estado: 'inactivo' })
      .eq('id_antecedente', id_antecedente);

    if (error) {
      console.error('❌ Error al eliminar antecedente:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error inesperado al eliminar antecedente:', error);
    return false;
  }
}

// ========================================
// FUNCIONES DE ARCHIVOS MÉDICOS
// ========================================

/**
 * Obtener todos los archivos de un paciente
 */
export async function getArchivosByPaciente(id_paciente: number): Promise<ArchivoMedico[]> {
  try {
    console.log('🔍 Obteniendo archivos del paciente:', id_paciente);

    const { data, error } = await supabaseAdmin
      .from('archivo_medico' as any)
      .select('*')
      .eq('id_paciente', id_paciente)
      .order('fecha_carga', { ascending: false });

    if (error) {
      console.error('❌ Error al obtener archivos:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} archivos`);
    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado al obtener archivos:', error);
    return [];
  }
}

/**
 * Crear un registro de archivo (metadata)
 */
export async function createArchivoMedico(archivo: Omit<ArchivoMedico, 'id_archivo' | 'created_at'>): Promise<ArchivoMedico | null> {
  try {
    console.log('➕ Creando nuevo archivo para paciente:', archivo.id_paciente);

    const { data, error } = await (supabaseAdmin
      .from('archivo_medico') as any)
      .insert(archivo)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear archivo:', error);
      return null;
    }

    console.log('✅ Archivo registrado exitosamente');
    return data;
  } catch (error) {
    console.error('❌ Error inesperado al crear archivo:', error);
    return null;
  }
}

/**
 * Eliminar un archivo médico
 */
export async function deleteArchivoMedico(id_archivo: number): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando archivo ID:', id_archivo);

    const { error } = await supabaseAdmin
      .from('archivo_medico')
      .delete()
      .eq('id_archivo', id_archivo);

    if (error) {
      console.error('❌ Error al eliminar archivo:', error);
      return false;
    }

    console.log('✅ Archivo eliminado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado al eliminar archivo:', error);
    return false;
  }
}

// ========================================
// FUNCIONES AUXILIARES
// ========================================

/**
 * Calcular IMC a partir de peso y estatura
 */
export function calcularIMC(peso_kg: number | null, estatura_cm: number | null): number | null {
  if (!peso_kg || !estatura_cm || estatura_cm === 0) {
    return null;
  }

  const estaturaMetros = estatura_cm / 100;
  const imc = peso_kg / (estaturaMetros * estaturaMetros);

  // Limitar a 999.99 para cumplir con NUMERIC(5,2)
  const imcRedondeado = Math.round(imc * 100) / 100;
  return Math.min(999.99, imcRedondeado);
}

/**
 * Calcular edad a partir de fecha de nacimiento
 */
export function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);

  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();

  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }

  return edad;
}

/**
 * Obtener iniciales de un nombre completo
 */
export function getIniciales(nombres: string, apellidos: string): string {
  const primeraLetraNombre = nombres.charAt(0).toUpperCase();
  const primeraLetraApellido = apellidos.charAt(0).toUpperCase();
  return `${primeraLetraNombre}${primeraLetraApellido}`;
}