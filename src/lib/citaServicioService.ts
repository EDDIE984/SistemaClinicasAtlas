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
  tiene_seguro_medico,
  fecha_confirmada,
  fecha_inicio_atencion,
  fecha_atendida,
  fecha_cancelada,
  fecha_no_asistio,
  url_pdf_resultado,
  fecha_finalizada,
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

    const citas = (data as CitaServicioCompleta[]) || [];
    if (citas.length === 0) return citas;

    let fotosQuery = (supabaseAdmin.from('cita_servicio') as any)
      .select('id_cita_servicio, foto_pedido_base64')
      .gte('fecha_cita', params.fechaDesde)
      .lte('fecha_cita', params.fechaHasta)
      .not('foto_pedido_base64', 'is', null)
      .neq('foto_pedido_base64', '');

    if (params.idSucursal) {
      fotosQuery = fotosQuery.eq('id_sucursal', params.idSucursal);
    }

    if (params.idServicio) {
      fotosQuery = fotosQuery.eq('id_servicio', params.idServicio);
    }

    if (params.estadoCita) {
      fotosQuery = fotosQuery.eq('estado_cita', params.estadoCita);
    }

    const { data: citasConFoto, error: fotosError } = await fotosQuery;
    if (fotosError) {
      console.error('❌ Error al verificar fotos de pedido:', fotosError);
      return citas.map(cita => ({ ...cita, tiene_foto_pedido: false }));
    }

    const idsConFoto = new Set(
      ((citasConFoto as Array<{ id_cita_servicio: number; foto_pedido_base64: string | null }> | null) || [])
        .filter(cita => normalizarFotoPedidoBase64(cita.foto_pedido_base64) !== null)
        .map(cita => cita.id_cita_servicio)
    );

    return citas.map(cita => ({
      ...cita,
      tiene_foto_pedido: idsConFoto.has(cita.id_cita_servicio),
    }));
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
    const { data: cita } = await (supabaseAdmin.from('cita_servicio') as any)
      .select('url_pdf_resultado')
      .eq('id_cita_servicio', id)
      .single();

    if (cita?.url_pdf_resultado) {
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([cita.url_pdf_resultado]);
    }

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
    tiene_seguro_medico: string;
    foto_pedido_base64: string;
  }
): Promise<import('./configuracionesService').CitaServicio | null> {
  return updateCitaServicio(id, {
    ...datos,
    estado_cita: 'confirmada',
    fecha_confirmada: new Date().toISOString(),
  });
}

const STORAGE_BUCKET = 'resultados-servicios';

function normalizarFotoPedidoBase64(foto: string | null | undefined): string | null {
  const valor = foto?.trim();
  if (!valor) return null;

  if (valor.startsWith('data:') && !valor.startsWith('data:image/')) {
    return null;
  }

  const base64Limpio = (valor.includes(',') ? valor.split(',')[1] : valor).replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Limpio)) return null;

  if (base64Limpio.startsWith('/9j/')) return `data:image/jpeg;base64,${base64Limpio}`;
  if (base64Limpio.startsWith('iVBOR')) return `data:image/png;base64,${base64Limpio}`;
  if (base64Limpio.startsWith('UklGR')) return `data:image/webp;base64,${base64Limpio}`;
  if (base64Limpio.startsWith('R0lGOD')) return `data:image/gif;base64,${base64Limpio}`;
  if (base64Limpio.startsWith('Qk')) return `data:image/bmp;base64,${base64Limpio}`;

  return null;
}

export async function finalizarCitaServicio(
  idCita: number,
  file: File,
  idCompania: number
): Promise<CitaServicio | null> {
  try {
    const path = `${idCompania}/${idCita}/${Date.now()}-resultado.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      console.error('❌ Error al subir PDF al storage:', uploadError);
      return null;
    }

    return updateCitaServicio(idCita, {
      estado_cita: 'finalizado',
      url_pdf_resultado: path,
      fecha_finalizada: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error inesperado en finalizarCitaServicio:', error);
    return null;
  }
}

export async function reemplazarPdfCitaServicio(
  idCita: number,
  urlAnterior: string,
  file: File,
  idCompania: number
): Promise<CitaServicio | null> {
  try {
    await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([urlAnterior]);

    const path = `${idCompania}/${idCita}/${Date.now()}-resultado.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      console.error('❌ Error al subir nuevo PDF al storage:', uploadError);
      return null;
    }

    return updateCitaServicio(idCita, {
      url_pdf_resultado: path,
      fecha_finalizada: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error inesperado en reemplazarPdfCitaServicio:', error);
    return null;
  }
}

export async function generarUrlFirmadaPdf(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (error) {
      console.error('❌ Error al generar URL firmada:', error);
      return null;
    }
    return data?.signedUrl ?? null;
  } catch (error) {
    console.error('❌ Error inesperado en generarUrlFirmadaPdf:', error);
    return null;
  }
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

    const fotoNormalizada = normalizarFotoPedidoBase64(
      (data as { foto_pedido_base64: string | null })?.foto_pedido_base64
    );

    if (!fotoNormalizada) {
      console.error('❌ La foto de pedido no tiene un formato de imagen válido');
      return null;
    }

    return fotoNormalizada;
  } catch (error) {
    console.error('❌ Error inesperado en getFotoPedido:', error);
    return null;
  }
}
