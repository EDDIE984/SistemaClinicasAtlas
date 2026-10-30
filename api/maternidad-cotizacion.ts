import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { generarDocumentosMaternidad, type ConfigCotizacion } from './_lib/maternidadPlantillas';
import { generarPresupuestoMembretado, tienePresupuestoConfigurado, totalProcedimiento } from './_lib/presupuestoMembretado';

// Genera una cotización numerada (maternidad_cotizacion: COT-MAT-AAAA-NNNNNN) con los 3 PDF
// (presupuesto, checklist, boletín), los guarda en Storage, los envía por correo a la paciente
// y registra la auditoría en maternidad_envio_correo.
// Con id_cotizacion_mat reenvía esa misma cotización (mismos PDF y número) sin generar otra.
// Con `datos` (sin id_solicitud_mat) primero registra la solicitud con fn_maternidad_registrar
// (con o sin tour) y después envía la cotización: es el modo que usa el flujo de WhatsApp en n8n.
// La web lo llama con id_solicitud_mat (registro, "Reenviar cotización" y el historial).
// Siempre envía al correo guardado en la solicitud, nunca a uno recibido en la petición.

const BUCKET = 'maternidad-cotizaciones';
const MAX_ENVIOS_POR_HORA = 5;

function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  return { url, key };
}

function formatearTour(fecha: string | null, inicio: string | null, fin: string | null): string | null {
  if (!fecha || !inicio) return null;
  const dia = new Date(`${fecha}T00:00:00`).toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${dia} · ${inicio.slice(0, 5)}${fin ? ` - ${fin.slice(0, 5)}` : ''}`;
}

// Datos que envía un flujo externo (n8n) que no tiene id_solicitud_mat: se registra la solicitud y luego se envía
interface DatosRegistro {
  cedula?: string;
  nombre?: string | null;
  correo?: string;
  telefono?: string;
  aseguradora?: string | null;
  medico_ginecologo?: string | null;
  semanas_gestacion?: number | string | null;
  remote_jid?: string | null;
  fecha_tour?: string | null;
  hora_inicio?: string | null;
}

const ASEGURADORA_PARTICULAR = 'OTRA / PARTICULAR';

const limpiar = (valor: unknown): string | null => {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === '' || texto.toLowerCase() === 'null' ? null : texto;
};

// "AIG METROPOLITANA" y "AIGMETROPOLITANA" → misma clave
const normalizarClave = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Nombre exacto de la aseguradora activa; si no coincide (o es particular) usa OTRA / PARTICULAR */
async function resolverAseguradora(supabase: SupabaseClient, texto: string | null): Promise<string> {
  const { data } = await supabase.from('maternidad_aseguradora').select('nombre').eq('estado', 'activo');
  const clave = texto ? normalizarClave(texto) : '';
  const encontrada = clave
    ? (data || []).find((a: { nombre: string }) => normalizarClave(a.nombre) === clave)
    : undefined;
  return encontrada?.nombre || ASEGURADORA_PARTICULAR;
}

/** Nombre completo desde el Registro Civil; null si no está configurado o falla */
async function consultarNombreRegistroCivil(cedula: string): Promise<string | null> {
  const base = process.env.CEDULA_API_BASE_URL;
  const apiKey = process.env.CEDULA_API_KEY;
  if (!base || !apiKey) return null;
  try {
    const respuesta = await fetch(
      `${base}?Cedula=${encodeURIComponent(cedula)}&Apikey=${encodeURIComponent(apiKey)}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
    );
    if (!respuesta.ok) return null;
    const data = await respuesta.json();
    return limpiar(data?.nombre);
  } catch (error) {
    console.error('❌ Error al consultar el Registro Civil:', error);
    return null;
  }
}

const CODIGOS_RPC = ['DATOS_INCOMPLETOS', 'CORREO_INVALIDO', 'ASEGURADORA_INVALIDA', 'HORARIO_INVALIDO', 'FECHA_PASADA', 'SIN_CUPO'];

const escaparHtml = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function construirCorreo(nombre: string, aseguradora: string, tour: string | null) {
  const nombreHtml = escaparHtml(nombre);
  const bloqueTour = tour
    ? `<p style="background:#f5f3ff;border-left:4px solid #9333ea;padding:12px;margin:16px 0">
         <strong>Su tour de maternidad está agendado:</strong><br>${escaparHtml(tour)}
       </p>
       <p>Le recomendamos llegar 10 minutos antes y traer su cédula de identidad.</p>`
    : `<p style="background:#fffbeb;border-left:4px solid #d97706;padding:12px;margin:16px 0">
         <strong>¿Ya conoce nuestras instalaciones?</strong><br>
         Agende su tour de maternidad respondiendo a nuestro WhatsApp y conozca salas de parto, habitaciones y neonatología.
       </p>`;
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:600px;margin:auto">
    <h2 style="color:#9333ea;margin-bottom:4px">Clínica Atlas · Maternidad</h2>
    <p>Estimada <strong>${nombreHtml}</strong>:</p>
    <p>Gracias por su interés en el plan de maternidad de Clínica Atlas. Adjuntamos la cotización para su aseguradora
       <strong>${escaparHtml(aseguradora)}</strong> junto con el checklist para el día del parto y nuestro boletín informativo.</p>
    ${bloqueTour}
    <p>Si tiene preguntas, responda a este correo o escríbanos por WhatsApp.</p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px">Clínica Atlas · Ecuador</p>
  </div>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  const body = (req.body || {}) as {
    id_solicitud_mat?: number | string;
    enviado_por?: string;
    tipo?: string;
    id_cotizacion_mat?: number | string;
    vista_previa?: boolean;
    config?: ConfigCotizacion;
    datos?: DatosRegistro;
  };

  // Vista previa desde la pantalla de configuración: arma el presupuesto con datos de ejemplo, sin guardar ni enviar
  if (body.vista_previa) {
    if (!tienePresupuestoConfigurado(body.config?.presupuesto)) {
      return res.status(400).json({ ok: false, error: 'Agregue al menos un procedimiento al presupuesto' });
    }
    try {
      const pdf = await generarPresupuestoMembretado({
        nombreMadre: 'María José Pérez',
        cedula: '0912345678',
        semanasGestacion: 30,
        correo: 'paciente@correo.com',
        telefono: '0991234567',
        medicoGinecologo: 'Dra. Ana López',
        numeroCotizacion: 'VISTA PREVIA',
      }, body.config.presupuesto);
      return res.status(200).json({ ok: true, pdf_base64: Buffer.from(pdf).toString('base64') });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const enviadoPor = (body.enviado_por || 'n8n').toString().slice(0, 200);

  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return res.status(500).json({ ok: false, error: 'Supabase no está configurado. Configure SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.' });
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({ ok: false, error: 'SMTP no configurado. Configure SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS.' });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // ── Registro desde un flujo externo: crea/actualiza la solicitud y continúa con el envío ──
  let registro: Record<string, unknown> | null = null;
  if (!body.id_solicitud_mat && body.datos) {
    const d = body.datos;
    const cedula = limpiar(d.cedula)?.replace(/\s/g, '') || null;
    if (!cedula) {
      return res.status(400).json({ ok: false, error: 'DATOS_INCOMPLETOS', mensaje: 'La cédula es obligatoria' });
    }
    const fechaTour = limpiar(d.fecha_tour);
    const horaInicio = limpiar(d.hora_inicio);
    const semanas = limpiar(d.semanas_gestacion);
    const nombre = limpiar(d.nombre) || (await consultarNombreRegistroCivil(cedula)) || `Paciente ${cedula}`;
    const aseguradora = await resolverAseguradora(supabase, limpiar(d.aseguradora));

    const { data, error } = await supabase.rpc('fn_maternidad_registrar', {
      p_nombre_madre: nombre,
      p_cedula: cedula,
      p_correo: limpiar(d.correo),
      p_telefono: limpiar(d.telefono),
      p_semanas_gestacion: semanas && Number.isInteger(Number(semanas)) ? Number(semanas) : null,
      p_medico_ginecologo: limpiar(d.medico_ginecologo),
      p_aseguradora: aseguradora,
      p_fecha_tour: fechaTour,
      p_hora_inicio: fechaTour && horaInicio ? horaInicio.slice(0, 5) : null,
      p_remote_jid: limpiar(d.remote_jid),
      p_origen: 'CHATBOT',
      p_creado_por: 'Chatbot WhatsApp',
    });
    if (error || !data) {
      const mensaje = error?.message || 'No se pudo registrar la solicitud';
      const codigo = CODIGOS_RPC.find(c => mensaje.includes(c)) || 'ERROR_REGISTRO';
      console.error('❌ Error al registrar solicitud de maternidad:', error);
      return res.status(400).json({ ok: false, error: codigo, mensaje });
    }
    registro = data as Record<string, unknown>;
    body.id_solicitud_mat = registro.id_solicitud_mat as number;
    if (!body.tipo && registro.tour_nuevo) body.tipo = 'confirmacion_tour';
  }

  const idSolicitud = Number(body.id_solicitud_mat);
  if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
    return res.status(400).json({ ok: false, error: 'id_solicitud_mat o datos es requerido' });
  }
  const extraRegistro = registro
    ? { id_solicitud_mat: idSolicitud, nombre_madre: registro.nombre_madre, aseguradora: registro.aseguradora, estado_solicitud: registro.estado }
    : {};

  const { data: solicitud, error: errorSolicitud } = await supabase
    .from('maternidad_solicitud')
    .select('*, aseguradora:maternidad_aseguradora(nombre, config_cotizacion)')
    .eq('id_solicitud_mat', idSolicitud)
    .single();

  if (errorSolicitud || !solicitud) {
    return res.status(404).json({ ok: false, error: 'La solicitud no existe' });
  }

  // Límite anti-abuso: el endpoint es público, se restringe por solicitud
  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('maternidad_envio_correo')
    .select('id_envio_mat', { count: 'exact', head: true })
    .eq('id_solicitud_mat', idSolicitud)
    .gte('created_at', haceUnaHora);
  if ((count || 0) >= MAX_ENVIOS_POR_HORA) {
    return res.status(429).json({ ok: false, error: `Se alcanzó el límite de ${MAX_ENVIOS_POR_HORA} envíos por hora para esta solicitud` });
  }

  const puerto = Number(SMTP_PORT || 465);
  const transporte = nodemailer.createTransport({
    host: SMTP_HOST,
    port: puerto,
    secure: puerto === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  const aseguradoraSolicitud: string = solicitud.aseguradora?.nombre || 'su aseguradora';

  const asuntoDe = (tipo: string, numero: string) =>
    `${tipo === 'confirmacion_tour'
      ? 'Clínica Atlas · Confirmación de tour de maternidad y cotización'
      : 'Clínica Atlas · Cotización de maternidad'} ${numero}`;

  const registrarAuditoria = (fila: Record<string, unknown>) =>
    supabase.from('maternidad_envio_correo').insert({
      id_solicitud_mat: idSolicitud,
      destinatario: solicitud.correo,
      enviado_por: enviadoPor,
      ...fila,
    });

  const enviarCorreo = (asunto: string, aseguradora: string, tour: string | null, archivos: { nombre: string; contenido: Buffer }[]) =>
    transporte.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to: solicitud.correo,
      subject: asunto,
      html: construirCorreo(solicitud.nombre_madre, aseguradora, tour),
      attachments: archivos.map(a => ({ filename: a.nombre, content: a.contenido, contentType: 'application/pdf' })),
    });

  // ── Reenvío de una cotización existente: mismos PDF y mismo número ─────────
  if (body.id_cotizacion_mat) {
    const { data: cot } = await supabase
      .from('maternidad_cotizacion')
      .select('*')
      .eq('id_cotizacion_mat', Number(body.id_cotizacion_mat))
      .eq('id_solicitud_mat', idSolicitud)
      .single();
    if (!cot) return res.status(404).json({ ok: false, error: 'La cotización no existe para esta solicitud' });

    const asunto = asuntoDe(cot.tipo, cot.numero_cotizacion);
    try {
      const archivos: { nombre: string; contenido: Buffer }[] = [];
      for (const archivo of (cot.archivos || []) as { nombre: string; path: string }[]) {
        const { data, error } = await supabase.storage.from(BUCKET).download(archivo.path);
        if (error || !data) throw new Error(`No se encontró el archivo ${archivo.nombre}`);
        archivos.push({ nombre: archivo.nombre, contenido: Buffer.from(await data.arrayBuffer()) });
      }
      if (archivos.length === 0) throw new Error('La cotización no tiene archivos guardados');
      const tour = cot.tipo === 'confirmacion_tour'
        ? formatearTour(solicitud.fecha_tour, solicitud.hora_inicio, solicitud.hora_fin)
        : null;
      const info = await enviarCorreo(asunto, cot.aseguradora || aseguradoraSolicitud, tour, archivos);
      await supabase.from('maternidad_cotizacion').update({
        estado: 'enviada',
        fecha_envio: new Date().toISOString(),
        veces_enviada: (cot.veces_enviada || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id_cotizacion_mat', cot.id_cotizacion_mat);
      await registrarAuditoria({
        id_cotizacion_mat: cot.id_cotizacion_mat, tipo: cot.tipo, asunto, adjuntos: cot.archivos,
        estado: 'enviado', message_id: info.messageId || null,
      });
      return res.status(200).json({ ok: true, numero_cotizacion: cot.numero_cotizacion, destinatario: solicitud.correo, reenvio: true });
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      console.error('❌ Error al reenviar cotización de maternidad:', error);
      await registrarAuditoria({
        id_cotizacion_mat: cot.id_cotizacion_mat, tipo: cot.tipo, asunto, adjuntos: cot.archivos,
        estado: 'error', error_mensaje: mensaje.slice(0, 1000),
      });
      return res.status(502).json({ ok: false, error: mensaje });
    }
  }

  // ── Cotización nueva ────────────────────────────────────────────────────────
  const tieneTour = !!solicitud.fecha_tour && ['agendada', 'confirmada'].includes(solicitud.estado);
  const tipo = body.tipo === 'confirmacion_tour' || body.tipo === 'cotizacion'
    ? body.tipo
    : tieneTour ? 'confirmacion_tour' : 'cotizacion';
  const tour = tieneTour ? formatearTour(solicitud.fecha_tour, solicitud.hora_inicio, solicitud.hora_fin) : null;
  const config = (solicitud.aseguradora?.config_cotizacion || {}) as ConfigCotizacion;
  const valores = tienePresupuestoConfigurado(config.presupuesto) ? config.presupuesto : null;

  // Reserva el número correlativo antes de generar los PDF (va impreso en ellos)
  const { data: cotizacion, error: errorCotizacion } = await supabase
    .from('maternidad_cotizacion')
    .insert({
      id_solicitud_mat: idSolicitud,
      id_aseguradora_mat: solicitud.id_aseguradora_mat,
      aseguradora: aseguradoraSolicitud,
      tipo,
      valores,
      resumen: (valores?.procedimientos || []).map(p => ({ procedimiento: p.procedimiento, total: totalProcedimiento(p) })),
      generado_por: enviadoPor,
    })
    .select('id_cotizacion_mat, numero_cotizacion')
    .single();
  if (errorCotizacion || !cotizacion) {
    return res.status(500).json({ ok: false, error: `No se pudo crear la cotización: ${errorCotizacion?.message || ''}` });
  }
  const numero: string = cotizacion.numero_cotizacion;
  const asunto = asuntoDe(tipo, numero);

  const adjuntos: { tipo: string; nombre: string; path: string }[] = [];
  try {
    const documentos = await generarDocumentosMaternidad({
      idSolicitud,
      numeroCotizacion: numero,
      nombreMadre: solicitud.nombre_madre,
      cedula: solicitud.cedula,
      semanasGestacion: solicitud.semanas_gestacion,
      correo: solicitud.correo,
      telefono: solicitud.telefono,
      medicoGinecologo: solicitud.medico_ginecologo,
      aseguradora: aseguradoraSolicitud,
      tour,
      config,
    });

    for (const documento of documentos) {
      const path = `${idSolicitud}/${numero}-${documento.tipo}.pdf`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, Buffer.from(documento.contenido), { contentType: 'application/pdf', upsert: true });
      if (error) throw new Error(`No se pudo guardar ${documento.nombre}: ${error.message}`);
      adjuntos.push({ tipo: documento.tipo, nombre: documento.nombre, path });
    }
    // Los PDF quedan guardados aunque luego falle el correo (se pueden reimprimir o reenviar)
    await supabase.from('maternidad_cotizacion')
      .update({ archivos: adjuntos, updated_at: new Date().toISOString() })
      .eq('id_cotizacion_mat', cotizacion.id_cotizacion_mat);

    const info = await enviarCorreo(
      asunto,
      aseguradoraSolicitud,
      tour,
      documentos.map(d => ({ nombre: d.nombre, contenido: Buffer.from(d.contenido) })),
    );

    await supabase.from('maternidad_cotizacion').update({
      estado: 'enviada',
      fecha_envio: new Date().toISOString(),
      veces_enviada: 1,
      updated_at: new Date().toISOString(),
    }).eq('id_cotizacion_mat', cotizacion.id_cotizacion_mat);
    await registrarAuditoria({
      id_cotizacion_mat: cotizacion.id_cotizacion_mat, tipo, asunto, adjuntos,
      estado: 'enviado', message_id: info.messageId || null,
    });
    return res.status(200).json({ ok: true, tipo, numero_cotizacion: numero, destinatario: solicitud.correo, message_id: info.messageId, adjuntos, ...extraRegistro });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error('❌ Error al enviar cotización de maternidad:', error);
    await supabase.from('maternidad_cotizacion')
      .update({ estado: 'error', updated_at: new Date().toISOString() })
      .eq('id_cotizacion_mat', cotizacion.id_cotizacion_mat);
    await registrarAuditoria({
      id_cotizacion_mat: cotizacion.id_cotizacion_mat, tipo, asunto, adjuntos,
      estado: 'error', error_mensaje: mensaje.slice(0, 1000),
    });
    return res.status(502).json({ ok: false, numero_cotizacion: numero, error: mensaje, ...extraRegistro });
  }
}
