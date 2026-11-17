import { promises as dns } from 'dns';

// Validación instantánea de un correo (sin enviar nada): formato, dominio mal escrito y registros MX.
// La usan /api/validar-correo (modo rápido y como primer paso del modo completo) y /api/maternidad-correos
// para marcar como inválidos los envíos a direcciones como "outloook.es", que aceptan correo y nunca rebotan.

export type MotivoCorreo =
  | 'FORMATO_INVALIDO'
  | 'DOMINIO_MAL_ESCRITO'
  | 'DOMINIO_NO_EXISTE'
  | 'DOMINIO_SIN_CORREO'
  | 'BUZON_NO_EXISTE'
  | 'NO_VERIFICADO';

export interface ResultadoValidacion {
  valido: boolean;
  motivo: MotivoCorreo | null;
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

const MENSAJES: Record<MotivoCorreo | 'VALIDO', (correo: string, sugerencia?: string | null) => string> = {
  VALIDO: () => 'Correo válido',
  FORMATO_INVALIDO: () => 'El correo no tiene un formato válido. Escríbelo así: nombre@dominio.com',
  DOMINIO_MAL_ESCRITO: (_c, sugerencia) => `¿Quisiste decir ${sugerencia}?`,
  DOMINIO_NO_EXISTE: (c) => `El dominio @${c.split('@')[1]} no existe, ¿puedes revisar tu correo y escribirlo de nuevo?`,
  DOMINIO_SIN_CORREO: (c) => `El dominio @${c.split('@')[1]} no recibe correos, ¿puedes revisar tu correo y escribirlo de nuevo?`,
  BUZON_NO_EXISTE: () => 'No pudimos entregar un correo a esa dirección, ¿puedes revisarla y escribirla de nuevo?',
  NO_VERIFICADO: () => 'No se pudo verificar el correo en este momento',
};

/** Texto en español para mostrar o responder por WhatsApp */
export const mensajeCorreo = (correo: string, r: ResultadoValidacion) =>
  MENSAJES[r.motivo ?? 'VALIDO'](correo, r.sugerencia);

export const normalizarCorreo = (valor: unknown) =>
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

async function revisarMx(dominio: string): Promise<MotivoCorreo | null> {
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
    return null; // DNS con problemas: no se marca como inválido
  }
}

/**
 * Formato, dominio mal escrito y MX (<1 s). `valido: true` solo dice que el dominio recibe correo,
 * no que el buzón exista. `cacheMx` evita repetir la consulta DNS del mismo dominio.
 */
export async function validarCorreoRapido(
  correoBruto: unknown,
  cacheMx?: Map<string, Promise<MotivoCorreo | null>>,
): Promise<ResultadoValidacion> {
  const correo = normalizarCorreo(correoBruto);
  const [local, dominio = ''] = correo.split('@');
  const sugerido = correo.split('@').length === 2 && local ? corregirDominio(dominio) : null;
  if (sugerido) return { valido: false, motivo: 'DOMINIO_MAL_ESCRITO', sugerencia: `${local}@${sugerido}` };
  if (!formatoValido(correo)) return { valido: false, motivo: 'FORMATO_INVALIDO' };

  let mx = cacheMx?.get(dominio);
  if (!mx) {
    mx = revisarMx(dominio);
    cacheMx?.set(dominio, mx);
  }
  const problemaMx = await mx;
  return problemaMx ? { valido: false, motivo: problemaMx } : { valido: true, motivo: null };
}
