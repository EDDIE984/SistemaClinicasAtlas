import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ImapFlow } from 'imapflow';
import { extraerMessageIds, leerAviso } from './_lib/rebotes';
import { getConfigCorreo } from './_lib/smtp';
import { crearClienteSupabaseServidor } from './_lib/supabaseServidor';
import { validarCorreoRapido, type MotivoCorreo } from './_lib/validacionCorreo';

// Revisión del estado real de los correos de maternidad. La llaman n8n (cada 10 min) y la pantalla
// Correos Maternidad (al abrirse y con "Revisar ahora").
//   POST /api/maternidad-correos   { "accion": "revisar", "dry_run"?: true, "historico"?: true }
// 1. Rebotes: lee por IMAP los avisos de Exim en la casilla de la clínica y, por el Message-ID del
//    correo original, marca el envío como 'rebotado' con el código del servidor destino.
// 2. Correos inválidos: los envíos a direcciones mal escritas o a dominios inexistentes (outloook.es)
//    no rebotan nunca; se marcan como 'invalido' con el correo sugerido.
// 3. Reintento automático: los envíos con 'error' (falla del SMTP) se reenvían solos (misma cotización),
//    hasta REINTENTOS_MAXIMOS veces. Los rebotados e inválidos esperan a que se corrija la dirección.
// Por defecto revisa la bandeja de entrada de los últimos DIAS_REVISION días; con historico revisa todas las
// carpetas y todas las fechas. dry_run informa lo que haría sin modificar nada ni reenviar.

const DIAS_REVISION = 10;
const DIAS_REINTENTO = 3;
const REINTENTOS_MAXIMOS = 3;
const REINTENTOS_POR_CORRIDA = 5;
const TAMANO_PAGINA = 1000;
const MAX_BYTES_AVISO = 300_000; // el aviso trae las cabeceras del original; no hace falta bajar los adjuntos

const mensajeDe = (error: unknown) =>
  error instanceof Error ? error.message : (error as { message?: string })?.message || String(error);

const MOTIVOS_INVALIDO: Partial<Record<MotivoCorreo, string>> = {
  FORMATO_INVALIDO: 'Formato de correo inválido',
  DOMINIO_MAL_ESCRITO: 'Dominio mal escrito',
  DOMINIO_NO_EXISTE: 'El dominio no existe',
  DOMINIO_SIN_CORREO: 'El dominio no recibe correos',
};

interface EnvioEnviado {
  id_envio_mat: number;
  id_solicitud_mat: number;
  destinatario: string;
  message_id: string | null;
  created_at: string;
}

async function cargarEnviados(supabase: SupabaseClient, desde: string | null): Promise<EnvioEnviado[]> {
  const filas: EnvioEnviado[] = [];
  for (let inicio = 0; ; inicio += TAMANO_PAGINA) {
    let query = supabase
      .from('maternidad_envio_correo')
      .select('id_envio_mat, id_solicitud_mat, destinatario, message_id, created_at')
      .eq('estado', 'enviado');
    if (desde) query = query.gte('created_at', desde);
    const { data, error } = await query.order('id_envio_mat').range(inicio, inicio + TAMANO_PAGINA - 1);
    if (error) throw error;
    filas.push(...((data || []) as EnvioEnviado[]));
    if (!data || data.length < TAMANO_PAGINA) break;
  }
  return filas;
}

/** Avisos de rebote (5.x.x) de la casilla: Message-IDs que contienen y el código del servidor destino */
async function leerRebotes(historico: boolean): Promise<{
  carpetas: string[];
  avisos: number;
  rebotes: { messageIds: string[]; detalle: string | null }[];
}> {
  const config = getConfigCorreo();
  if (!config) throw new Error('SMTP/IMAP no configurado (SMTP_HOST, SMTP_USER, SMTP_PASS)');
  const imap = new ImapFlow({
    host: config.host,
    port: 993,
    secure: true,
    auth: { user: config.usuario, pass: config.clave },
    logger: false,
  });
  await imap.connect();
  try {
    const carpetas = historico
      ? (await imap.list()).filter((c) => !c.flags.has('\\Noselect')).map((c) => c.path)
      : ['INBOX'];
    const criterio = {
      or: [{ from: 'mailer-daemon' }, { from: 'postmaster' }],
      ...(historico ? {} : { since: new Date(Date.now() - DIAS_REVISION * 24 * 60 * 60 * 1000) }),
    };
    let avisos = 0;
    const rebotes: { messageIds: string[]; detalle: string | null }[] = [];
    for (const carpeta of carpetas) {
      const bloqueo = await imap.getMailboxLock(carpeta, { readOnly: true });
      try {
        const uids = (await imap.search(criterio, { uid: true })) || [];
        if (!uids.length) continue;
        for await (const mensaje of imap.fetch(uids.join(','), { source: { maxLength: MAX_BYTES_AVISO } }, { uid: true })) {
          avisos++;
          const fuente = mensaje.source?.toString('utf8') || '';
          const aviso = leerAviso(fuente);
          if (aviso?.tipo !== 'rebote') continue; // demoras temporales (4.x.x) u otros mensajes
          rebotes.push({ messageIds: extraerMessageIds(fuente), detalle: aviso.detalle });
        }
      } finally {
        bloqueo.release();
      }
    }
    return { carpetas, avisos, rebotes };
  } finally {
    await imap.logout().catch(() => undefined);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  const body = (req.body || {}) as { accion?: string; dry_run?: boolean; historico?: boolean };
  if (body.accion !== 'revisar') return res.status(400).json({ ok: false, error: 'accion debe ser "revisar"' });
  const dryRun = body.dry_run === true;
  const historico = body.historico === true;

  const supabase = crearClienteSupabaseServidor();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: 'Supabase no está configurado. Configure SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.' });
  }

  try {
    const desde = historico ? null : new Date(Date.now() - (DIAS_REVISION + 5) * 24 * 60 * 60 * 1000).toISOString();
    const enviados = await cargarEnviados(supabase, desde);
    const porMessageId = new Map(enviados.filter((e) => e.message_id).map((e) => [e.message_id as string, e]));
    const ahora = new Date().toISOString();

    // ── 1. Rebotes ──
    const rebotesDetectados: { id_envio_mat: number; id_solicitud_mat: number; destinatario: string; detalle: string | null }[] = [];
    let infoImap: { carpetas: string[]; avisos: number } | { error: string };
    try {
      const { carpetas, avisos, rebotes } = await leerRebotes(historico);
      infoImap = { carpetas, avisos };
      for (const rebote of rebotes) {
        const envio = rebote.messageIds.map((id) => porMessageId.get(id)).find(Boolean);
        if (!envio || rebotesDetectados.some((r) => r.id_envio_mat === envio.id_envio_mat)) continue;
        rebotesDetectados.push({ ...envio, detalle: rebote.detalle });
      }
    } catch (error) {
      console.error('❌ No se pudieron leer los rebotes por IMAP:', error);
      infoImap = { error: mensajeDe(error) };
    }
    if (!dryRun) {
      for (const r of rebotesDetectados) {
        const { error } = await supabase
          .from('maternidad_envio_correo')
          .update({ estado: 'rebotado', rebote_detalle: r.detalle, rebote_fecha: ahora })
          .eq('id_envio_mat', r.id_envio_mat)
          .eq('estado', 'enviado');
        if (error) throw error;
      }
    }

    // ── 2. Correos mal escritos o de dominios inexistentes ──
    const yaRebotados = new Set(rebotesDetectados.map((r) => r.id_envio_mat));
    const cacheMx = new Map();
    const invalidosDetectados: { id_envio_mat: number; id_solicitud_mat: number; destinatario: string; detalle: string; sugerido: string | null }[] = [];
    for (const envio of enviados) {
      if (yaRebotados.has(envio.id_envio_mat)) continue;
      const resultado = await validarCorreoRapido(envio.destinatario, cacheMx);
      const motivo = resultado.motivo ? MOTIVOS_INVALIDO[resultado.motivo] : undefined;
      if (resultado.valido || !motivo) continue;
      invalidosDetectados.push({
        id_envio_mat: envio.id_envio_mat,
        id_solicitud_mat: envio.id_solicitud_mat,
        destinatario: envio.destinatario,
        detalle: `${motivo}: ${envio.destinatario.split('@')[1] || envio.destinatario}`,
        sugerido: resultado.sugerencia ?? null,
      });
    }
    if (!dryRun) {
      for (const i of invalidosDetectados) {
        const { error } = await supabase
          .from('maternidad_envio_correo')
          .update({ estado: 'invalido', rebote_detalle: i.detalle, correo_sugerido: i.sugerido, rebote_fecha: ahora })
          .eq('id_envio_mat', i.id_envio_mat)
          .eq('estado', 'enviado');
        if (error) throw error;
      }
    }

    // ── 3. Reintento automático de los envíos con error ──
    // Si este paso falla, igual se informa lo detectado en los pasos 1 y 2
    const reintentos: { id_envio_mat: number; id_solicitud_mat: number; ok: boolean; error?: string }[] = [];
    let errorReintentos: string | null = null;
    let pendientes: number | null = null;
    try {
      const { data: conError, error: errorPendientes } = await supabase
        .from('vista_maternidad_correos')
        .select('id_envio_mat, id_solicitud_mat, id_cotizacion_mat, reintentos_auto')
        .eq('estado', 'error')
        .eq('pendiente', true)
        .lt('reintentos_auto', REINTENTOS_MAXIMOS)
        .not('id_cotizacion_mat', 'is', null)
        .gte('created_at', new Date(Date.now() - DIAS_REINTENTO * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at')
        .limit(REINTENTOS_POR_CORRIDA);
      if (errorPendientes) throw errorPendientes;

      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const protocolo = req.headers['x-forwarded-proto'] || (String(host).startsWith('localhost') ? 'http' : 'https');
      for (const envio of conError || []) {
        if (dryRun) {
          reintentos.push({ id_envio_mat: envio.id_envio_mat, id_solicitud_mat: envio.id_solicitud_mat, ok: false, error: 'dry_run' });
          continue;
        }
        // Se cuenta el intento antes de enviar: si la función se corta, no se reintenta sin límite
        await supabase
          .from('maternidad_envio_correo')
          .update({ reintentos_auto: (envio.reintentos_auto || 0) + 1 })
          .eq('id_envio_mat', envio.id_envio_mat);
        try {
          const respuesta = await fetch(`${protocolo}://${host}/api/maternidad-cotizacion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_solicitud_mat: envio.id_solicitud_mat,
              id_cotizacion_mat: envio.id_cotizacion_mat,
              enviado_por: 'Reintento automático',
            }),
          });
          const datos = await respuesta.json().catch(() => ({}));
          reintentos.push({
            id_envio_mat: envio.id_envio_mat,
            id_solicitud_mat: envio.id_solicitud_mat,
            ok: respuesta.ok && datos.ok === true,
            ...(respuesta.ok && datos.ok ? {} : { error: String(datos.error || respuesta.statusText).slice(0, 300) }),
          });
        } catch (error) {
          reintentos.push({
            id_envio_mat: envio.id_envio_mat,
            id_solicitud_mat: envio.id_solicitud_mat,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const { count, error: errorConteo } = await supabase
        .from('vista_maternidad_correos')
        .select('id_envio_mat', { count: 'exact', head: true })
        .eq('pendiente', true);
      if (errorConteo) throw errorConteo;
      pendientes = count ?? null;
    } catch (error) {
      console.error('❌ Error en el reintento automático de correos de maternidad:', error);
      errorReintentos = mensajeDe(error);
    }

    return res.status(200).json({
      ok: true,
      dry_run: dryRun,
      historico,
      envios_revisados: enviados.length,
      imap: infoImap,
      rebotes_detectados: rebotesDetectados,
      invalidos_detectados: invalidosDetectados,
      reintentos,
      error_reintentos: errorReintentos,
      pendientes,
    });
  } catch (error) {
    console.error('❌ Error al revisar los correos de maternidad:', error);
    return res.status(500).json({ ok: false, error: mensajeDe(error) });
  }
}
