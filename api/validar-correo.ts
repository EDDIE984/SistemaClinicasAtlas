import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, timingSafeEqual } from 'crypto';
import { promises as dns } from 'dns';
import { ImapFlow } from 'imapflow';
import { crearTransporteSmtp, getConfigCorreo, type ConfigCorreo } from './_lib/smtp';

// Valida que un correo realmente reciba mensajes, para el flujo de WhatsApp en n8n.
//   POST /api/validar-correo   body { "correo": "...", "nombre"?: "..." }
//   (header x-api-key solo si N8N_API_KEY está configurada en Vercel)
// 1. Formato, dominio mal escrito (gmial.com, outloook.es) y registros MX: responde al instante.
// 2. Envía un correo corto de confirmación desde la casilla de la clínica y revisa por IMAP esa misma
//    casilla: si llega el rebote (Gmail "550 5.1.1", Hotmail "550 5.5.0 mailbox unavailable") el correo
//    no existe. Si pasan ESPERA_REBOTE_MS sin rebote se da por válido (o antes, si llega el aviso DSN de éxito).
// Una falla propia (SMTP/IMAP) no bloquea a la persona: valido = true con motivo NO_VERIFICADO.

const ESPERA_REBOTE_MS = 60_000;
const INTERVALO_REVISION_MS = 4_000;

type Motivo =
  | 'FORMATO_INVALIDO'
  | 'DOMINIO_MAL_ESCRITO'
  | 'DOMINIO_NO_EXISTE'
  | 'DOMINIO_SIN_CORREO'
  | 'BUZON_NO_EXISTE'
  | 'NO_VERIFICADO';

interface Resultado {
  valido: boolean;
  motivo: Motivo | null;
  sugerencia?: string | null;
  detalle?: string | null;
}

// Dominios frecuentes contra los que se buscan errores de tipeo
const DOMINIOS_COMUNES = [
  'gmail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es',
  'live.com', 'yahoo.com', 'yahoo.es', 'icloud.com',
];
// Dominios reales que se parecen a los comunes y no deben corregirse
const DOMINIOS_LEGITIMOS = new Set([
  ...DOMINIOS_COMUNES,
  'mail.com', 'email.com', 'ymail.com', 'gmx.com', 'gmx.es', 'aol.com', 'me.com', 'msn.com',
  'live.es', 'live.com.mx', 'hotmail.com.ar', 'yahoo.com.mx', 'yahoo.com.ar', 'outlook.com.ar',
  'protonmail.com', 'proton.me',
]);

const MENSAJES: Record<Motivo | 'VALIDO', (correo: string, sugerencia?: string | null) => string> = {
  VALIDO: () => 'Correo válido',
  FORMATO_INVALIDO: () => 'El correo no tiene un formato válido. Escríbelo así: nombre@dominio.com',
  DOMINIO_MAL_ESCRITO: (_c, sugerencia) => `¿Quisiste decir ${sugerencia}?`,
  DOMINIO_NO_EXISTE: (c) => `El dominio @${c.split('@')[1]} no existe, ¿puedes revisar tu correo y escribirlo de nuevo?`,
  DOMINIO_SIN_CORREO: (c) => `El dominio @${c.split('@')[1]} no recibe correos, ¿puedes revisar tu correo y escribirlo de nuevo?`,
  BUZON_NO_EXISTE: () => 'No pudimos entregar un correo a esa dirección, ¿puedes revisarla y escribirla de nuevo?',
  NO_VERIFICADO: () => 'No se pudo verificar el correo en este momento',
};

const normalizar = (valor: unknown) =>
  String(valor ?? '').trim().toLowerCase().replace(/^mailto:/, '').replace(/\s+/g, '').replace(/\.+$/, '');

const FORMATO_LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const FORMATO_DOMINIO = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

function formatoValido(correo: string): boolean {
  if (correo.length > 254) return false;
  const partes = correo.split('@');
  if (partes.length !== 2) return false;
  const [local, dominio] = partes;
  return local.length >= 1 && local.length <= 64 && FORMATO_LOCAL.test(local) && FORMATO_DOMINIO.test(dominio);
}

function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = arriba;
    }
  }
  return fila[b.length];
}

/** Dominio común más parecido (distancia 1–2), o null si el dominio está bien o no se parece a ninguno */
function corregirDominio(dominio: string): string | null {
  if (DOMINIOS_LEGITIMOS.has(dominio)) return null;
  if (!dominio.includes('.') && DOMINIOS_COMUNES.includes(`${dominio}.com`)) return `${dominio}.com`;
  let mejor: { dominio: string; d: number } | null = null;
  for (const comun of DOMINIOS_COMUNES) {
    const d = distancia(dominio, comun);
    if (d <= 2 && (!mejor || d < mejor.d)) mejor = { dominio: comun, d };
  }
  return mejor?.dominio ?? null;
}

async function revisarMx(dominio: string): Promise<Motivo | null> {
  const resolver = new dns.Resolver({ timeout: 3000, tries: 2 });
  try {
    const registros = await resolver.resolveMx(dominio);
    const utiles = registros.filter((r) => r.exchange && r.exchange !== '.');
    return utiles.length ? null : 'DOMINIO_SIN_CORREO';
  } catch (error) {
    const codigo = (error as NodeJS.ErrnoException).code;
    if (codigo === 'ENOTFOUND') return 'DOMINIO_NO_EXISTE';
    if (codigo === 'ENODATA') return 'DOMINIO_SIN_CORREO';
    console.error('❌ No se pudo consultar el MX de', dominio, codigo);
    return null; // DNS con problemas: que decida el envío de prueba
  }
}

/** Lee un aviso de entrega (DSN): 'rebote' (5.x.x / failed), 'entregado' (2.x.x / delivered|relayed) o null */
function leerAviso(fuente: string): { tipo: 'rebote' | 'entregado'; detalle: string | null } | null {
  const accion = fuente.match(/^Action:\s*(\S+)/im)?.[1]?.toLowerCase();
  const estado = fuente.match(/^Status:\s*(\d)\.\d{1,3}\.\d{1,3}/im)?.[1];
  const diagnostico = fuente.match(/^Diagnostic-Code:\s*(.+(?:\r?\n[ \t]+.+)*)/im)?.[1];
  const detalle = diagnostico ? diagnostico.replace(/^smtp;\s*/i, '').replace(/\s+/g, ' ').trim().slice(0, 300) : null;
  if (accion === 'failed' || estado === '5') return { tipo: 'rebote', detalle };
  if (accion === 'delivered' || accion === 'relayed' || estado === '2') return { tipo: 'entregado', detalle };
  return null; // demora temporal (4.x.x) o un mensaje que no es aviso de entrega
}

async function verificarConEnvio(correo: string, nombre: string | null, config: ConfigCorreo): Promise<Resultado> {
  const codigo = `ATL-${randomBytes(6).toString('hex')}`;
  const dominioRemitente = config.usuario.split('@')[1];
  const imap = new ImapFlow({
    host: config.host,
    port: 993,
    secure: true,
    auth: { user: config.usuario, pass: config.clave },
    logger: false,
  });

  // Primero IMAP: si no se puede leer la casilla no tiene sentido enviar
  try {
    await imap.connect();
  } catch (error) {
    console.error('❌ No se pudo conectar por IMAP para leer rebotes:', error);
    return { valido: true, motivo: 'NO_VERIFICADO', detalle: 'IMAP no disponible' };
  }

  try {
    const bloqueo = await imap.getMailboxLock('INBOX');
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
          dsn: { envid: codigo, ret: 'HDRS', notify: ['SUCCESS', 'FAILURE'], orcpt: correo },
        });
      } catch (error) {
        const e = error as { code?: string; responseCode?: number; response?: string };
        if (e.code === 'EENVELOPE' && (e.responseCode ?? 0) >= 500) {
          return { valido: false, motivo: 'BUZON_NO_EXISTE', detalle: e.response?.slice(0, 300) ?? null };
        }
        console.error('❌ No se pudo enviar el correo de verificación:', error);
        return { valido: true, motivo: 'NO_VERIFICADO', detalle: 'SMTP no disponible' };
      }

      // Esperar el aviso de entrega o el rebote en la casilla de la clínica
      const desde = new Date(Date.now() - 24 * 60 * 60 * 1000); // SINCE es por día
      const revisados = new Set<number>();
      const limite = Date.now() + ESPERA_REBOTE_MS;
      while (Date.now() < limite) {
        await new Promise((r) => setTimeout(r, INTERVALO_REVISION_MS));
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
  const body = (req.body || {}) as { correo?: unknown; nombre?: unknown };
  const correo = normalizar(body.correo);
  const nombre = String(body.nombre ?? '').trim().slice(0, 100) || null;
  if (!correo) return res.status(400).json({ ok: false, error: 'Falta el correo' });

  const responder = (r: Resultado) =>
    res.status(200).json({
      ok: true,
      correo,
      valido: r.valido,
      motivo: r.motivo,
      sugerencia: r.sugerencia ?? null,
      mensaje: MENSAJES[r.motivo ?? 'VALIDO'](correo, r.sugerencia),
      detalle: r.detalle ?? null,
      segundos: Math.round((Date.now() - inicio) / 100) / 10,
    });

  const [local, dominio = ''] = correo.split('@');
  const sugerido = correo.split('@').length === 2 && local ? corregirDominio(dominio) : null;
  if (sugerido) {
    return responder({ valido: false, motivo: 'DOMINIO_MAL_ESCRITO', sugerencia: `${local}@${sugerido}` });
  }
  if (!formatoValido(correo)) return responder({ valido: false, motivo: 'FORMATO_INVALIDO' });

  const problemaMx = await revisarMx(dominio);
  if (problemaMx) return responder({ valido: false, motivo: problemaMx });

  const config = getConfigCorreo();
  if (!config) {
    console.error('❌ SMTP no configurado (SMTP_HOST, SMTP_USER, SMTP_PASS)');
    return responder({ valido: true, motivo: 'NO_VERIFICADO', detalle: 'SMTP no configurado' });
  }

  return responder(await verificarConEnvio(correo, nombre, config));
}
