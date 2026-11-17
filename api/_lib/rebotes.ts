// Lectura de los avisos de entrega (DSN) que el servidor de correo de la clínica (Exim) deja en la
// casilla SMTP_USER cuando un envío no se puede entregar. El aviso trae el código del servidor destino
// (Gmail "550 5.1.1", Hotmail "550 5.5.0 mailbox unavailable", "550 No Such User Here"…) y las
// cabeceras del correo original, con su Message-ID: así se sabe a qué envío corresponde.

export interface AvisoEntrega {
  tipo: 'rebote' | 'entregado';
  detalle: string | null;
}

/** 'rebote' (5.x.x / failed), 'entregado' (2.x.x / delivered|relayed) o null (demora 4.x.x u otro mensaje) */
export function leerAviso(fuente: string): AvisoEntrega | null {
  const accion = fuente.match(/^Action:\s*(\S+)/im)?.[1]?.toLowerCase();
  const estado = fuente.match(/^Status:\s*(\d)\.\d{1,3}\.\d{1,3}/im)?.[1];
  const diagnostico = fuente.match(/^Diagnostic-Code:\s*(.+(?:\r?\n[ \t]+.+)*)/im)?.[1];
  const detalle = diagnostico ? diagnostico.replace(/^smtp;\s*/i, '').replace(/\s+/g, ' ').trim().slice(0, 300) : null;
  if (accion === 'failed' || estado === '5') return { tipo: 'rebote', detalle };
  if (accion === 'delivered' || accion === 'relayed' || estado === '2') return { tipo: 'entregado', detalle };
  return null;
}

/** Todos los Message-ID que aparecen en el aviso (el propio y el del correo original devuelto) */
export function extraerMessageIds(fuente: string): string[] {
  return Array.from(fuente.matchAll(/^Message-ID:\s*(<[^>\s]+>)/gim), (m) => m[1]);
}
