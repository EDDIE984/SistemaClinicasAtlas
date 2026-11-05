// Presupuesto de maternidad sobre la hoja membretada (formato de docs/formatos-cotizaciones/MATERNIDAD-PARTICULAR.xlsx).
// Dibuja una página por procedimiento (p. ej. Cesárea y Parto normal) con los datos de la paciente.
// Los valores NO están en el código: vienen de maternidad_aseguradora.config_cotizacion.presupuesto
// (se editan en la pantalla Aseguradoras Maternidad → Cotización).
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { FONDO_MEMBRETADO_MATERNIDAD_JPG, ICONO_TELEFONO_PNG, LOGO_CLINICAS_ATLAS_PNG } from './maternidadImagenes';

export interface DatosPresupuestoMaternidad {
  /** COT-MAT-AAAA-NNNNNN (en la vista previa: "VISTA PREVIA") */
  numeroCotizacion?: string;
  nombreMadre: string;
  cedula: string;
  semanasGestacion: number | null;
  correo: string;
  telefono: string;
  medicoGinecologo: string | null;
  /** Fecha de emisión (ISO) al volver a armar una cotización existente; sin ella se usa la de hoy */
  fechaEmision?: string | null;
}

// Misma estructura que ConfigPresupuestoMaternidad en src/lib/supabaseTypes.ts (la UI la edita)
export interface ProcedimientoPresupuesto {
  procedimiento: string;
  internacion: string;
  clinica: number;
  incluye: string[];
  /** valor null = "A CONVENIR" (no suma al total) */
  honorarios: { concepto: string; valor: number | null }[];
  notas: string[];
  /** Abono requerido para el ingreso; null = no se muestra */
  abono: number | null;
}

export interface ConfigPresupuestoMaternidad {
  procedimientos: ProcedimientoPresupuesto[];
  /** concepto con salto de línea = varias líneas con un solo valor; grupo = subtítulo previo (p. ej. "Laboratorios:") */
  adicionales: { concepto: string; valor: number; grupo?: string | null }[];
  firma: { nombre: string; cargo: string; telefono: string };
  especialidad?: string;
  /** Formato de convenio: se imprime "Seguro Privado : …" (vacío = particular, no se imprime) */
  seguro?: string | null;
}

const PIE = 'Clínicas Atlas  •  Quito, Ecuador  •  Este presupuesto es informativo y no constituye un contrato.';

const NEGRO = rgb(0, 0, 0);
const AZUL_LINEA = rgb(0.11, 0.23, 0.42);
const GRIS = rgb(0.4, 0.4, 0.4);
const ANCHO = 595.28;
const ALTO = 841.89;
const X0 = 45;
const X_VALOR = 150;
const X_DER = 318;
const X_DER_VALOR = 440;
const X_PRECIO = 400;
const X_PRECIO_DER = 470;

/** $ 1,130.00 (formato del presupuesto de la clínica) */
export const formatearUSD = (valor: number) =>
  `$ ${valor.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

// Helvetica (WinAnsi) no soporta emojis ni algunos símbolos
const limpiar = (texto: string) => texto.replace(/[^\x20-\x7E -ÿ–—•]/g, '').trim();

/** "OCTUBRE 21, 2026" de la fecha indicada (fecha de emisión de la cotización) o de hoy */
function fechaLarga(fecha?: string | null): string {
  const partes = new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', day: 'numeric', month: 'long', year: 'numeric' })
    .formatToParts(fecha ? new Date(fecha) : new Date());
  const dia = partes.find(p => p.type === 'day')?.value;
  const mes = partes.find(p => p.type === 'month')?.value?.toUpperCase();
  const anio = partes.find(p => p.type === 'year')?.value;
  return `${mes} ${dia}, ${anio}`;
}

interface Fuentes {
  normal: PDFFont;
  negrita: PDFFont;
  cursivaNegrita: PDFFont;
}

class Hoja {
  y = ALTO - 40;

  constructor(private page: PDFPage, private f: Fuentes) {}

  texto(texto: string, x: number, opciones: { tamano?: number; fuente?: PDFFont; color?: ReturnType<typeof rgb>; anchoMax?: number } = {}) {
    let tamano = opciones.tamano ?? 10;
    const fuente = opciones.fuente ?? this.f.normal;
    const limpio = limpiar(texto);
    // Reduce la letra si no cabe en el ancho disponible (p. ej. correos largos)
    if (opciones.anchoMax) {
      while (tamano > 7.5 && fuente.widthOfTextAtSize(limpio, tamano) > opciones.anchoMax) tamano -= 0.25;
    }
    this.page.drawText(limpio, { x, y: this.y - tamano, size: tamano, font: fuente, color: opciones.color ?? NEGRO });
    return fuente.widthOfTextAtSize(limpio, tamano);
  }

  centrado(texto: string, tamano: number, fuente: PDFFont) {
    const ancho = fuente.widthOfTextAtSize(limpiar(texto), tamano);
    this.texto(texto, (ANCHO - ancho) / 2, { tamano, fuente });
    return ancho;
  }

  derecha(texto: string, xDerecha: number, opciones: { tamano?: number; fuente?: PDFFont } = {}) {
    const fuente = opciones.fuente ?? this.f.normal;
    const tamano = opciones.tamano ?? 10;
    const ancho = fuente.widthOfTextAtSize(limpiar(texto), tamano);
    this.texto(texto, xDerecha - ancho, opciones);
  }

  subrayar(x: number, ancho: number, tamano: number, grosor = 0.8) {
    const yLinea = this.y - tamano - 2;
    this.page.drawLine({ start: { x, y: yLinea }, end: { x: x + ancho, y: yLinea }, thickness: grosor, color: NEGRO });
  }

  linea(desde: number, hasta: number, grosor = 1.2) {
    this.page.drawLine({ start: { x: desde, y: this.y }, end: { x: hasta, y: this.y }, thickness: grosor, color: AZUL_LINEA });
  }

  bajar(puntos: number) {
    this.y -= puntos;
  }

  /** Párrafo con sangría francesa (viñeta "*") */
  vineta(texto: string, x: number, ancho: number, tamano: number) {
    const palabras = limpiar(texto).split(/\s+/);
    let linea = '';
    let primera = true;
    const escribir = (contenido: string) => {
      if (primera) this.texto('*', x, { tamano });
      this.texto(contenido, x + 14, { tamano });
      this.bajar(tamano + 3);
      primera = false;
    };
    for (const palabra of palabras) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (this.f.normal.widthOfTextAtSize(prueba, tamano) > ancho - 14 && linea) {
        escribir(linea);
        linea = palabra;
      } else {
        linea = prueba;
      }
    }
    if (linea) escribir(linea);
  }
}

function dibujarPagina(
  page: PDFPage,
  f: Fuentes,
  img: { fondo: PDFImage; logo: PDFImage; telefono: PDFImage },
  datos: DatosPresupuestoMaternidad,
  config: ConfigPresupuestoMaternidad,
  proc: ProcedimientoPresupuesto,
) {
  // Hoja membretada (fondo a página completa) y logo centrado
  page.drawImage(img.fondo, { x: 0, y: 0, width: ANCHO, height: ALTO });
  const anchoLogo = 175;
  const altoLogo = (img.logo.height / img.logo.width) * anchoLogo;
  page.drawImage(img.logo, { x: (ANCHO - anchoLogo) / 2, y: ALTO - 28 - altoLogo, width: anchoLogo, height: altoLogo });

  const h = new Hoja(page, f);
  h.y = ALTO - 36 - altoLogo;
  h.centrado('PRESUPUESTO', 24, f.negrita);
  h.bajar(27);
  if (datos.numeroCotizacion) {
    h.centrado(`Cotización N.º ${datos.numeroCotizacion}`, 10, f.negrita);
    h.bajar(16);
  } else {
    h.bajar(5);
  }

  // Datos de la paciente (dos columnas, como el formato)
  const nombre = limpiar(datos.nombreMadre).toUpperCase();
  const medico = limpiar(datos.medicoGinecologo || '').toUpperCase();
  const filas: [string, string, string, string][] = [
    ['FECHA:', fechaLarga(datos.fechaEmision),'Semanas de gestación:', datos.semanasGestacion ? String(datos.semanasGestacion) : ''],
    ['Paciente:', nombre ? `SRA. ${nombre}` : '', 'Correo electrónico :', datos.correo.toLowerCase()],
    ['Médico:', medico, 'Contacto :', datos.telefono],
    ['Especialidad:', config.especialidad || 'GINECÓLOGO', 'C.I:', datos.cedula],
  ];
  for (const [etiqueta, valor, etiquetaDer, valorDer] of filas) {
    h.texto(etiqueta, X0, { tamano: 10, fuente: f.negrita });
    h.texto(valor, X_VALOR, { tamano: 10.5, anchoMax: X_DER - X_VALOR - 8 });
    h.texto(etiquetaDer, X_DER, { tamano: 10, fuente: f.negrita });
    h.texto(valorDer, X_DER_VALOR, { tamano: 10, anchoMax: ANCHO - 22 - X_DER_VALOR });
    h.bajar(15);
  }
  h.bajar(6);
  h.texto('Servicio:', X0, { tamano: 10, fuente: f.negrita });
  h.texto('HOSPITALIZACIÓN', X_VALOR, { tamano: 10 });
  h.texto(`INTERNACIÓN:  ${proc.internacion}`, 285, { tamano: 12, fuente: f.negrita });
  h.bajar(22);
  h.texto('Procedimiento:', X0, { tamano: 12, fuente: f.negrita });
  h.texto(proc.procedimiento, X_VALOR, { tamano: 12, fuente: f.negrita });
  h.bajar(20);
  if (config.seguro) {
    h.texto('Seguro Privado :', X0, { tamano: 10, fuente: f.negrita });
    h.texto(config.seguro, X_VALOR, { tamano: 10.5, fuente: f.negrita });
    h.bajar(18);
  }

  // Clínica e "incluye"
  const anchoClinica = h.texto('CLÍNICA', X0 + 55, { tamano: 13, fuente: f.negrita });
  h.subrayar(X0 + 55, anchoClinica, 13);
  h.derecha(formatearUSD(Number(proc.clinica) || 0), X_PRECIO_DER + 50, { tamano: 10, fuente: f.negrita });
  h.bajar(19);
  h.texto('INCLUYE :', X0, { tamano: 10, fuente: f.cursivaNegrita });
  h.bajar(14);
  for (const item of proc.incluye || []) {
    h.texto(item, X0, { tamano: 9 });
    h.bajar(12.5);
  }

  // Honorarios médicos
  h.bajar(10);
  h.texto('HONORARIOS MÉDICOS', X0 + 5, { tamano: 12, fuente: f.negrita });
  h.bajar(24);
  for (const honorario of proc.honorarios || []) {
    h.texto(honorario.concepto, X0, { tamano: 10, fuente: f.negrita });
    if (honorario.valor === null || honorario.valor === undefined) h.texto('A CONVENIR', X_PRECIO - 5, { tamano: 10, fuente: f.negrita });
    else h.derecha(formatearUSD(honorario.valor).replace('$ ', '$  '),X_PRECIO + 55, { tamano: 10, fuente: f.negrita });
    h.bajar(16);
  }

  const total = totalProcedimiento(proc);
  h.texto('TOTAL PRESUPUESTO', 165, { tamano: 11, fuente: f.negrita });
  const textoTotal = formatearUSD(total);
  const anchoTotal = f.negrita.widthOfTextAtSize(textoTotal, 12);
  h.texto(textoTotal, X_PRECIO_DER + 55 - anchoTotal, { tamano: 12, fuente: f.negrita });
  h.subrayar(X_PRECIO_DER + 55 - anchoTotal, anchoTotal, 12);
  h.bajar(17);
  h.linea(X0 - 5, X_PRECIO_DER + 75);
  h.bajar(3);

  // Valores adicionales fuera del paquete
  h.centrado('VALORES ADICIONALES FUERA DEL PAQUETE', 11, f.negrita);
  h.bajar(15);
  for (const adicional of config.adicionales || []) {
    if (adicional.grupo) {
      h.texto(adicional.grupo, X0, { tamano: 11, fuente: f.cursivaNegrita });
      h.bajar(15);
    }
    const lineas = adicional.concepto.split('\n').map(l => l.trim()).filter(Boolean);
    const precio = formatearUSD(Number(adicional.valor) || 0).replace('$ ', '$  ');
    lineas.forEach((linea, i) => {
      h.texto(linea, X0, { tamano: 9, fuente: lineas.length > 1 ? f.normal : f.negrita });
      if (i === Math.floor((lineas.length - 1) / 2)) h.derecha(precio, X_PRECIO + 55, { tamano: 10, fuente: f.negrita });
      h.bajar(12.5);
    });
  }

  // Notas
  h.bajar(3);
  h.texto('NOTA :', X0, { tamano: 11, fuente: f.negrita });
  h.bajar(15);
  for (const nota of proc.notas || []) h.vineta(nota, X0 + 35, ANCHO - X0 - 70, 9.5);
  // Última nota con el abono resaltado en negrita, como en el formato
  if (proc.abono) {
    h.texto('*', X0 + 35, { tamano: 9 });
    const espacio = f.normal.widthOfTextAtSize(' ', 9);
    let x = X0 + 49;
    x += h.texto('Como requisito para el ingreso, se deberá dejar un abono de', x, { tamano: 9 }) + espacio;
    x += h.texto(`USD ${formatearUSD(Number(proc.abono)).replace('$ ', '')}`,x, { tamano: 9, fuente: f.negrita }) + espacio;
    h.texto('a cuenta del procedimiento.', x, { tamano: 9 });
    h.bajar(12);
  }
  h.bajar(5);

  // Firma
  h.texto('Cualquier inquietud estoy a las órdenes,', X0, { tamano: 10 });
  h.bajar(13);
  h.texto('Cordiales saludos', X0, { tamano: 10 });
  h.bajar(15);
  h.texto(config.firma.nombre, X0, { tamano: 11, fuente: f.negrita });
  h.bajar(13);
  h.texto(config.firma.cargo, X0, { tamano: 9.5, color: GRIS });
  h.bajar(13);
  if (config.firma.telefono) {
    page.drawImage(img.telefono, { x: X0, y: h.y - 10, width: 10, height: 10 });
    h.texto(config.firma.telefono, X0 + 14, { tamano: 9.5 });
  }

  // Pie de página
  const anchoPie = f.normal.widthOfTextAtSize(limpiar(PIE), 7.5);
  page.drawText(limpiar(PIE), { x: (ANCHO - anchoPie) / 2, y: 22, size: 7.5, font: f.normal, color: GRIS });
}

/** Total = clínica + honorarios con valor (los "A CONVENIR" no suman) */
export const totalProcedimiento = (proc: ProcedimientoPresupuesto) =>
  (Number(proc.clinica) || 0) + (proc.honorarios || []).reduce((suma, x) => suma + (typeof x.valor === 'number' ? x.valor : 0), 0);

/** true si la configuración tiene al menos un procedimiento para armar el presupuesto membretado */
export const tienePresupuestoConfigurado = (config?: Partial<ConfigPresupuestoMaternidad> | null): config is ConfigPresupuestoMaternidad =>
  Array.isArray(config?.procedimientos) && config.procedimientos.length > 0;

export async function generarPresupuestoMembretado(
  datos: DatosPresupuestoMaternidad,
  config: ConfigPresupuestoMaternidad,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Presupuesto de maternidad');
  doc.setAuthor('Clínicas Atlas');
  const fuentes: Fuentes = {
    normal: await doc.embedFont(StandardFonts.Helvetica),
    negrita: await doc.embedFont(StandardFonts.HelveticaBold),
    cursivaNegrita: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const imagenes = {
    // pdf-lib acepta base64 directamente: el módulo funciona igual en Vercel y en el navegador
    fondo: await doc.embedJpg(FONDO_MEMBRETADO_MATERNIDAD_JPG),
    logo: await doc.embedPng(LOGO_CLINICAS_ATLAS_PNG),
    telefono: await doc.embedPng(ICONO_TELEFONO_PNG),
  };
  const firma = { nombre: '', cargo: '', telefono: '', ...(config.firma || {}) };
  for (const procedimiento of config.procedimientos) {
    dibujarPagina(doc.addPage([ANCHO, ALTO]), fuentes, imagenes, datos, { ...config, firma }, procedimiento);
  }
  return doc.save();
}
