import { supabaseAdmin } from './supabase';

export interface ExamenLaboratorio {
  id_examen_laboratorio: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
}

export interface PedidoLaboratorio {
  id_pedido_laboratorio: number;
  numero_pedido_laboratorio: number;
  id_cita: number;
  id_paciente: number;
  id_sucursal: number;
  id_usuario_solicitante: number;
  id_usuario_sucursal_medico: number;
  fecha_pedido: string;
  estado: 'pendiente' | 'procesado' | 'cancelado';
  observaciones: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PedidoLaboratorioDetalle {
  id_pedido_laboratorio_detalle: number;
  id_pedido_laboratorio: number;
  id_examen_laboratorio: number;
  created_at?: string;
  examen_laboratorio?: ExamenLaboratorio;
}

export interface PedidoLaboratorioCompleto extends PedidoLaboratorio {
  detalle: PedidoLaboratorioDetalle[];
  medico_asignacion?: {
    id_usuario_sucursal: number;
    especialidad: string | null;
    cargo: string | null;
    usuario?: {
      id_usuario: number;
      nombre: string;
      apellido: string;
      email: string;
      tipo_usuario: string;
    };
  } | null;
}

interface CrearPedidoLaboratorioInput {
  id_cita: number;
  id_paciente: number;
  id_sucursal: number;
  id_usuario_solicitante: number;
  id_usuario_sucursal_medico: number;
  observaciones?: string | null;
  examenes: number[];
}

export async function getExamenesLaboratorioActivos(): Promise<ExamenLaboratorio[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('examen_laboratorio')
      .select('*')
      .eq('estado', 'activo')
      .order('categoria', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener exámenes de laboratorio:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado al obtener exámenes de laboratorio:', error);
    return [];
  }
}

export async function getPedidoLaboratorioByCita(idCita: number): Promise<PedidoLaboratorioCompleto | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('pedido_laboratorio')
      .select(`
        *,
        medico_asignacion:usuario_sucursal (
          id_usuario_sucursal,
          especialidad,
          cargo,
          usuario:usuario (
            id_usuario,
            nombre,
            apellido,
            email,
            tipo_usuario
          )
        ),
        detalle:pedido_laboratorio_detalle (
          id_pedido_laboratorio_detalle,
          id_pedido_laboratorio,
          id_examen_laboratorio,
          created_at,
          examen_laboratorio:examen_laboratorio (
            id_examen_laboratorio,
            categoria,
            nombre,
            descripcion,
            estado,
            created_at,
            updated_at
          )
        )
      `)
      .eq('id_cita', idCita)
      .order('created_at', { ascending: true, referencedTable: 'pedido_laboratorio_detalle' })
      .maybeSingle();

    if (error) {
      console.error('❌ Error al obtener pedido de laboratorio:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      ...data,
      detalle: data.detalle || []
    } as PedidoLaboratorioCompleto;
  } catch (error) {
    console.error('❌ Error inesperado al obtener pedido de laboratorio:', error);
    return null;
  }
}

export async function createPedidoLaboratorio(input: CrearPedidoLaboratorioInput): Promise<PedidoLaboratorioCompleto | null> {
  try {
    const examenesUnicos = [...new Set(input.examenes.filter(Boolean))];
    if (examenesUnicos.length === 0) {
      return null;
    }

    const pedidoExistente = await getPedidoLaboratorioByCita(input.id_cita);
    if (pedidoExistente) {
      return pedidoExistente;
    }

    const { data: pedidoData, error: pedidoError } = await supabaseAdmin
      .from('pedido_laboratorio')
      .insert({
        id_cita: input.id_cita,
        id_paciente: input.id_paciente,
        id_sucursal: input.id_sucursal,
        id_usuario_solicitante: input.id_usuario_solicitante,
        id_usuario_sucursal_medico: input.id_usuario_sucursal_medico,
        observaciones: input.observaciones || null
      })
      .select('*')
      .single();

    if (pedidoError || !pedidoData) {
      console.error('❌ Error al crear pedido de laboratorio:', pedidoError);
      return null;
    }

    const { error: detalleError } = await supabaseAdmin
      .from('pedido_laboratorio_detalle')
      .insert(
        examenesUnicos.map((idExamen) => ({
          id_pedido_laboratorio: pedidoData.id_pedido_laboratorio,
          id_examen_laboratorio: idExamen
        }))
      );

    if (detalleError) {
      console.error('❌ Error al crear detalle del pedido de laboratorio:', detalleError);
      await supabaseAdmin
        .from('pedido_laboratorio')
        .delete()
        .eq('id_pedido_laboratorio', pedidoData.id_pedido_laboratorio);
      return null;
    }

    return getPedidoLaboratorioByCita(input.id_cita);
  } catch (error) {
    console.error('❌ Error inesperado al crear pedido de laboratorio:', error);
    return null;
  }
}