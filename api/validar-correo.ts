import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, timingSafeEqual } from 'crypto';
import { ImapFlow } from 'imapflow';
import { leerAviso } from './_lib/rebotes';
import { crearTransporteSmtp, getConfigCorreo, type ConfigCorreo } from './_lib/smtp';
import { mensajeCorreo, normalizarCorreo, validarCorreoRapido, type ResultadoValidacion } from './_lib/validacionCorreo';

// Valida que un correo realmente reciba mensajes, para el flujo de WhatsApp en n8n.
//   POST /api/validar-correo   body { "correo": "...", "nombre"?: "...", "rapida"?: true }
//   (header x-api-key solo si N8N_API_KEY está configurada en Vercel)
// 1. Formato, dominio mal escrito (gmial.com, outloook.es) y registros MX: responde al instante.
//    Con rapida: true termina aquí (<1 s, sin enviar nada); lo usa la pantalla Correos Maternidad.
// 2. Envía un correo corto de confirmación desde la casilla de la clínica y revisa por IMAP esa misma
//    casilla: si llega el rebote (Gmail "550 5.1.1", Hotmail "550 5.5.0 mailbox unavailable") el correo
//    no existe. Si pasan ESPERA_REBOTE_MS sin rebote se da por válido.
// Una falla propia (SMTP/IMAP) no bloquea a la persona: valido = true con motivo NO_VERIFICADO.

// Rebotes medidos: 7, 10, 10, 11, 33, 43 (onewayec.com) y 79 s. Con 60 s solo se escapa el de 79 s
// (pasa como válido). El servidor no soporta DSN: no hay aviso de éxito, un correo válido espera los 60 s.
const ESPERA_REBOTE_MS = 60_000;
const INTERVALO_REVISION_MS = 2_000;

async function verificarConEnvio(correo: string, nombre: string | null, config: ConfigCorreo): Promise<ResultadoValidacion> {
  const codigo = `ATL-${randomBytes(6).toString('hex')}`;
  const dominioRemitente = config.usuario.split('@')[1];
  const imap = new ImapFlow({
    host: config.host,
    port: 993,
    secure: true,
    auth: { user: config.usuario, pass: config.clave },
    logger: false,
  });

  // IMAP se conecta mientras se envía el correo de prueba, para no sumar los dos tiempos
  const conexionImap = imap.connect().then(
    () => true,
    (error) => {
      console.error('❌ No se pudo conectar por IMAP para leer rebotes:', error);
      return false;
    },
  );

  try {
    try {
      const saludo = nombre ? `Hola ${nombre},` : 'Hola,';
      await crearTransporteSmtp(config).sendMail({
        from: config.remitente,
        to: correo,
        subject: 'Confirmación de tu correo – Clínica Atlas',
        messageId: `<${codigo}@${dominioRemitente}>`,
        headers: { 'X-Atlas-Verificacion': codigo },
        text: `${saludo}\n\nConfirmamos que este correo está registrado para recibir información de Clínica Atlas. No necesitas responder este mensaje.\n\nClínica Atlas\nwww.clinicas-atlas.com\n\nRef. ${codigo}`,
        html: `<p>${saludo.replace(/[<>&]/g, '')}</p><p>Confirmamos que este correo está registrado para recibir información de <b>Clínica Atlas</b>. No necesitas responder este mensaje.</p><p>Clínica Atlas<br>www.clinicas-atlas.com</p><p style="color:#999;font-size:11px">Ref. ${codigo}</p>`,
      });
    } catch (error) {
      const e = error as { code?: string; responseCode?: number; response?: string };
      if (e.code === 'EENVELOPE' && (e.responseCode ?? 0) >= 500) {
        return { valido: false, motivo: 'BUZON_NO_EXISTE', detalle: e.response?.slice(0, 300) ?? null };
      }
      console.error('❌ No se pudo enviar el correo de verificación:', error);
      return { valido: true, motivo: 'NO_VERIFICADO', detalle: 'SMTP no disponible' };
    }
    const limite = Date.now() + ESPERA_REBOTE_MS;

    if (!(await conexionImap)) return { valido: true, motivo: 'NO_VERIFICADO', detalle: 'IMAP no disponible' };

    // Esperar el rebote en la casilla de la clínica
    const bloqueo = await imap.getMailboxLock('INBOX');
    try {
      const desde = new Date(Date.now() - 24 * 60 * 60 * 1000); // SINCE es por día
      const revisados = new Set<number>();
      while (Date.now() < limite) {
        await new Promise((r) => setTimeout(r, Math.min(INTERVALO_REVISION_MS, Math.max(0, limite - Date.now()))));
        await imap.noop(); // que el servidor informe los mensajes nuevos
        const uids = (await imap.search({ since: desde, text: codigo }, { uid: true })) || [];
        for (const uid of uids) {
          if (revisados.has(uid)) continue;
          revisados.add(uid);
          const mensaje = await imap.fetchOne(String(uid), { source: true }, { uid: true });
          const aviso = mensaje && mensaje.source ? leerAviso(mensaje.source.toString('utf8')) : null;
          if (!aviso) continue;
          await imap.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
          return aviso.tipo === 'rebote'
            ? { valido: false, motivo: 'BUZON_NO_EXISTE', detalle: aviso.detalle }
            : { valido: true, motivo: null };
        }
      }
      return { valido: true, motivo: null }; // sin rebote en el tiempo de espera
    } finally {
      bloqueo.release();
    }
  } catch (error) {
    console.error('❌ Error al revisar los rebotes por IMAP:', error);
    return { valido: true, motivo: 'NO_VERIFICADO', detalle: 'Error al leer la casilla' };
  } finally {
    await conexionImap;
    await imap.logout().catch(() => undefined);
  }
}

function claveValida(recibida: unknown): boolean {
  const esperada = process.env.N8N_API_KEY || '';
  const valor = Array.isArray(recibida) ? recibida[0] : String(recibida ?? '');
  const a = Buffer.from(valor);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  // La clave es opcional: solo se exige si N8N_API_KEY está configurada en Vercel
  if (process.env.N8N_API_KEY && !claveValida(req.headers['x-api-key'])) {
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }

  const inicio = Date.now();
  const body = (req.body || {}) as { correo?: unknown; nombre?: unknown; rapida?: unknown };
  const correo = normalizarCorreo(body.correo);
  const nombre = String(body.nombre ?? '').trim().slice(0, 100) || null;
  if (!correo) return res.status(400).json({ ok: false, error: 'Falta el correo' });

  const responder = (r: ResultadoValidacion) =>
    res.status(200).json({
      ok: true,
      correo,
      valido: r.valido,
      motivo: r.motivo,
      sugerencia: r.sugerencia ?? null,
      mensaje: mensajeCorreo(correo, r),
      detalle: r.detalle ?? null,
      segundos: Math.round((Date.now() - inicio) / 100) / 10,
    });

  const rapida = await validarCorreoRapido(correo);
  if (!rapida.valido || body.rapida === true) return responder(rapida);

  const config = getConfigCorreo();
  if (!config) {
    console.error('❌ SMTP no configurado (SMTP_HOST, SMTP_USER, SMTP_PASS)');
    return responder({ valido: true, motivo: 'NO_VERIFICADO', detalle: 'SMTP no configurado' });
  }

  return responder(await verificarConEnvio(correo, nombre, config));
}
