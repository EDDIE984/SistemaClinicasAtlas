// Recordatorios de cita por WhatsApp: citas próximas (consulta externa + servicios) e historial de envíos
import { supabaseAdmin } from './supabase';
import { getCitasServicio } from './citaServicioService';
import type { RecordatorioWhatsApp } from './supabaseTypes';

export type TipoCitaRecordatorio = 'CONSULTA_EXTERNA' | 'SERVICIO';

export interface CitaRecordatorio {
  clave: string; // 'C-101' (consulta externa) | 'S-54' (servicio)
  tipoCita: TipoCitaRecordatorio;
  idCita: number | null;
  idCitaServicio: number | null;
  fecha: string; // YYYY-MM-DD
  hora: string;  // HH:MM:SS
  sucursal: string | null;
  paciente: { nombre: string; cedula: string; telefono: string | null };
  atencion: string; // especialidad o servicio
  medico: { idUsuarioSucursal: number; nombre: string; telefono: string | null } | null;
}

export interface EstadoUltimoRecordatorio {
  fecha: string;
  estado: 'ENVIADO' | 'FALLIDO';
  detalle: string | null;
}

export interface UltimosRecordatorios {
  paciente?: EstadoUltimoRecordatorio;
  medico?: EstadoUltimoRecordatorio;
}

export type FilaRegistroRecordatorio = Omit<RecordatorioWhatsApp, 'id_recordatorio' | 'fecha_envio' | 'id_usuario_envio'>;

export interface RecordatorioHistorial extends RecordatorioWhatsApp {
  cita?: { paciente?: { nombres: string; apellidos: string; cedula: string } | null } | null;
  cita_servicio?: { paciente?: { nombres: string; apellidos: string; cedula: string } | null } | null;
  usuario_sucursal?: { usuario?: { nombre: string; apellido: string } | null } | null;
}

export const claveCita = (tipo: TipoCitaRecordatorio, id: number) => `${tipo === 'CONSULTA_EXTERNA' ? 'C' : 'S'}-${id}`;

const ESTADOS_EXCLUIDOS_CONSULTA = ['cancelada', 'no_asistio', 'atendida'];
const ESTADOS_EXCLUIDOS_SERVICIO = ['cancelada', 'no_asistio', 'atendida', 'finalizado'];

/** Citas de consulta externa y de servicios de la sucursal entre dos fechas, pendientes de atender. */
export async function getCitasParaRecordatorio(idSucursal: number, desde: string, hasta: string): Promise<CitaRecordatorio[]> {
  try {
    const [consultaRes, citasServicio] = await Promise.all([
      (supabaseAdmin.from('cita') as any)
        .select(`
          id_cita, fecha_cita, hora_inicio, estado_cita, consulta_realizada,
          paciente:paciente!inner(nombres, apellidos, cedula, telefono),
          especialidad(nombre),
          usuario_sucursal:usuario_sucursal!inner(
            id_usuario_sucursal, id_sucursal, especialidad,
            usuario(nombre, apellido, telefono),
            sucursal(nombre)
          )
        `)
        .eq('usuario_sucursal.id_sucursal', idSucursal)
        .gte('fecha_cita', desde)
        .lte('fecha_cita', hasta)
        .eq('consulta_realizada', false)
        .order('fecha_cita', { ascending: true })
        .order('hora_inicio', { ascending: true }),
      getCitasServicio({ fechaDesde: desde, fechaHasta: hasta, idSucursal }),
    ]);

    if (consultaRes.error) throw consultaRes.error;

    const consultas: CitaRecordatorio[] = (consultaRes.data || [])
      .filter((cita: any) => !ESTADOS_EXCLUIDOS_CONSULTA.includes(cita.estado_cita))
      .map((cita: any) => {
        const usuario = cita.usuario_sucursal?.usuario;
        return {
          clave: claveCita('CONSULTA_EXTERNA', cita.id_cita),
          tipoCita: 'CONSULTA_EXTERNA' as const,
          idCita: cita.id_cita,
          idCitaServicio: null,
          fecha: cita.fecha_cita,
          hora: cita.hora_inicio,
          sucursal: cita.usuario_sucursal?.sucursal?.nombre || null,
          paciente: {
            nombre: `${cita.paciente.nombres} ${cita.paciente.apellidos}`,
            cedula: cita.paciente.cedula,
            telefono: cita.paciente.telefono,
          },
          atencion: cita.especialidad?.nombre || cita.usuario_sucursal?.especialidad || 'Consulta externa',
          medico: usuario
            ? {
                idUsuarioSucursal: cita.usuario_sucursal.id_usuario_sucursal,
                nombre: `${usuario.nombre} ${usuario.apellido}`,
                telefono: usuario.telefono,
              }
            : null,
        };
      });

    const servicios: CitaRecordatorio[] = citasServicio
      .filter(cita => !ESTADOS_EXCLUIDOS_SERVICIO.includes(cita.estado_cita))
      .map(cita => ({
        clave: claveCita('SERVICIO', cita.id_cita_servicio),
        tipoCita: 'SERVICIO' as const,
        idCita: null,
        idCitaServicio: cita.id_cita_servicio,
        fecha: cita.fecha_cita,
        hora: cita.hora_inicio,
        sucursal: cita.sucursal?.nombre || cita.servicio?.sucursal?.nombre || null,
        paciente: {
          nombre: `${cita.paciente.nombres} ${cita.paciente.apellidos}`,
          cedula: cita.paciente.cedula,
          telefono: cita.paciente.telefono,
        },
        atencion: cita.servicio?.descripcion || 'Servicio',
        medico: null,
      }));

    return [...consultas, ...servicios].sort((a, b) =>
      a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
  } catch (error) {
    console.error('❌ Error al obtener citas para recordatorio:', error);
    throw error;
  }
}

const dividirEnBloques = <T,>(lista: T[], tamano: number) =>
  Array.from({ length: Math.ceil(lista.length / tamano) }, (_, i) => lista.slice(i * tamano, (i + 1) * tamano));

/** Último recordatorio (enviado o fallido) por cita y destinatario. */
export async function getUltimosRecordatorios(
  idsCita: number[],
  idsCitaServicio: number[],
): Promise<Map<string, UltimosRecordatorios>> {
  const resultado = new Map<string, UltimosRecordatorios>();
  try {
    const consultas = [
      ...dividirEnBloques(idsCita, 150).map(ids => ({ columna: 'id_cita', ids })),
      ...dividirEnBloques(idsCitaServicio, 150).map(ids => ({ columna: 'id_cita_servicio', ids })),
    ];

    const respuestas = await Promise.all(consultas.map(({ columna, ids }) =>
      (supabaseAdmin.from('recordatorio_whatsapp' as any) as any)
        .select('id_cita, id_cita_servicio, tipo_destinatario, estado, detalle_error, fecha_envio')
        .in(columna, ids)
        .order('fecha_envio', { ascending: false })
    ));

    for (const { data, error } of respuestas) {
      if (error) throw error;
      for (const fila of (data || []) as RecordatorioWhatsApp[]) {
        const clave = fila.id_cita
          ? claveCita('CONSULTA_EXTERNA', fila.id_cita)
          : claveCita('SERVICIO', fila.id_cita_servicio as number);
        const actual = resultado.get(clave) || {};
        const destino = fila.tipo_destinatario === 'PACIENTE' ? 'paciente' : 'medico';
        // Las filas vienen ordenadas de más reciente a más antigua: quedarse con la primera
        if (!actual[destino]) {
          actual[destino] = { fecha: fila.fecha_envio, estado: fila.estado, detalle: fila.detalle_error };
          resultado.set(clave, actual);
        }
      }
    }
    return resultado;
  } catch (error) {
    console.error('❌ Error al obtener últimos recordatorios:', error);
    throw error;
  }
}

/** Guarda en el historial el resultado de un envío (una fila por cita). */
export async function registrarRecordatorios(filas: FilaRegistroRecordatorio[]): Promise<boolean> {
  if (filas.length === 0) return true;
  try {
    const idUsuario = parseInt(localStorage.getItem('currentUserId') || '0') || null;
    const { error } = await (supabaseAdmin.from('recordatorio_whatsapp' as any) as any)
      .insert(filas.map(fila => ({ ...fila, id_usuario_envio: idUsuario })));
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('❌ Error al registrar recordatorios:', error);
    return false;
  }
}

/** Mensajes de WhatsApp ENVIADOS hoy (hora local), para el límite diario de seguridad. */
export async function contarMensajesEnviadosHoy(): Promise<number> {
  try {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    // El resumen al médico guarda una fila por cita: contar mensajes distintos (teléfono + texto)
    const { data, error } = await (supabaseAdmin.from('recordatorio_whatsapp' as any) as any)
      .select('telefono, mensaje')
      .eq('estado', 'ENVIADO')
      .gte('fecha_envio', inicioDia.toISOString());
    if (error) throw error;
    return new Set((data || []).map((fila: any) => `${fila.telefono}|${fila.mensaje}`)).size;
  } catch (error) {
    console.error('❌ Error al contar mensajes enviados hoy:', error);
    throw error;
  }
}

/** Historial de recordatorios entre dos fechas de envío (inclusive). */
export async function getHistorialRecordatorios(desde: string, hasta: string): Promise<RecordatorioHistorial[]> {
  try {
    const inicio = new Date(`${desde}T00:00:00`);
    const fin = new Date(`${hasta}T23:59:59.999`);
    const { data, error } = await (supabaseAdmin.from('recordatorio_whatsapp' as any) as any)
      .select(`
        *,
        cita(paciente(nombres, apellidos, cedula)),
        cita_servicio(paciente(nombres, apellidos, cedula)),
        usuario_sucursal(usuario(nombre, apellido))
      `)
      .gte('fecha_envio', inicio.toISOString())
      .lte('fecha_envio', fin.toISOString())
      .order('fecha_envio', { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data || []) as RecordatorioHistorial[];
  } catch (error) {
    console.error('❌ Error al obtener historial de recordatorios:', error);
    throw error;
  }
}
