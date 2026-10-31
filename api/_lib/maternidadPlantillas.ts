// Documentos PDF del módulo Maternidad. El presupuesto se genera por paciente; el checklist y el boletín
// son los diseños fijos de la clínica (api/_assets/maternidad). El presupuesto usa la hoja membretada con los valores de maternidad_aseguradora.config_cotizacion.presupuesto
// (presupuestoMembretado.ts); si la aseguradora aún no tiene valores configurados se usa un presupuesto genérico.
import { readFileSync } from 'fs';
import path from 'path';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { generarPresupuestoMembretado, tienePresupuestoConfigurado, type ConfigPresupuestoMaternidad } from './presupuestoMembretado';

export interface DatosPlantillaMaternidad {
  idSolicitud: number;
  /** COT-MAT-AAAA-NNNNNN, impreso en el presupuesto */
  numeroCotizacion: string;
  /** Fecha de emisión (ISO) al volver a armar una cotización existente; sin ella se usa la de hoy */
  fechaEmision?: string | null;
  nombreMadre: string;
  cedula: string;
  semanasGestacion: number | null;
  correo: string;
  telefono: string;
  medicoGinecologo: string | null;
  aseguradora: string;
  /** Texto ya formateado, p. ej. "martes, 3 de noviembre de 2026 · 10:00 - 11:00" */
  tour: string | null;
  config: ConfigCotizacion;
}

/** Estructura opcional de maternidad_aseguradora.config_cotizacion */
export interface ConfigCotizacion {
  presupuesto?: ConfigPresupuestoMaternidad;
  checklist?: { secciones?: { titulo: string; items: string[] }[] };
  boletin?: { parrafos?: string[] };
}

export type TipoDocumentoMaternidad = 'presupuesto' | 'checklist' | 'boletin';

const COLOR_PRIMARIO = rgb(0.58, 0.2, 0.92);
const COLOR_TEXTO = rgb(0.15, 0.15, 0.15);
const COLOR_SUAVE = rgb(0.45, 0.45, 0.45);
const MARGEN = 50;

const PRESUPUESTO_GENERICO: { concepto: string; detalle: string }[] = [
  { concepto: 'Parto normal', detalle: 'Honorarios, sala de parto, hospitalización 24 h' },
  { concepto: 'Cesárea programada', detalle: 'Honorarios, quirófano, hospitalización 48 h' },
  { concepto: 'Atención del recién nacido', detalle: 'Pediatra en sala, valoración y vacunas iniciales' },
  { concepto: 'Habitación y alimentación', detalle: 'Por día de hospitalización' },
];

class Escritor {
  y: number;
  page: PDFPage;

  constructor(
    private doc: PDFDocument,
    private fuente: PDFFont,
    private negrita: PDFFont,
  ) {
    this.page = doc.addPage([595, 842]);
    this.y = 842 - MARGEN;
  }

  private asegurarEspacio(alto: number) {
    if (this.y - alto < MARGEN) {
      this.page = this.doc.addPage([595, 842]);
      this.y = 842 - MARGEN;
    }
  }

  // WinAnsi (Helvetica) no soporta emojis ni algunos símbolos: se reemplazan para no romper el PDF
  private limpiar(texto: string) {
    return texto.replace(/[^\x20-\x7E -ÿ–—•]/g, '');
  }

  private envolver(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
    const lineas: string[] = [];
    for (const parrafo of this.limpiar(texto).split('\n')) {
      let actual = '';
      for (const palabra of parrafo.split(' ')) {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (fuente.widthOfTextAtSize(prueba, tamano) > ancho && actual) {
          lineas.push(actual);
          actual = palabra;
        } else {
          actual = prueba;
        }
      }
      lineas.push(actual);
    }
    return lineas;
  }

  texto(texto: string, opciones: { tamano?: number; negrita?: boolean; color?: ReturnType<typeof rgb>; sangria?: number; espacio?: number } = {}) {
    const tamano = opciones.tamano ?? 11;
    const fuente = opciones.negrita ? this.negrita : this.fuente;
    const x = MARGEN + (opciones.sangria ?? 0);
    for (const linea of this.envolver(texto, fuente, tamano, 595 - x - MARGEN)) {
      this.asegurarEspacio(tamano + 4);
      this.page.drawText(linea, { x, y: this.y - tamano, size: tamano, font: fuente, color: opciones.color ?? COLOR_TEXTO });
      this.y -= tamano + 4;
    }
    this.y -= opciones.espacio ?? 4;
  }

  linea() {
    this.asegurarEspacio(10);
    this.page.drawLine({
      start: { x: MARGEN, y: this.y },
      end: { x: 595 - MARGEN, y: this.y },
      thickness: 1,
      color: COLOR_PRIMARIO,
    });
    this.y -= 12;
  }

  encabezado(titulo: string, datos: DatosPlantillaMaternidad) {
    this.texto('CLÍNICA ATLAS · MATERNIDAD', { tamano: 10, negrita: true, color: COLOR_PRIMARIO, espacio: 2 });
    this.texto(titulo, { tamano: 20, negrita: true, espacio: 2 });
    this.texto(
      `Cotización N.º ${datos.numeroCotizacion} · ${(datos.fechaEmision ? new Date(datos.fechaEmision) : new Date()).toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: 'long', year: 'numeric' })}`,
      { tamano: 9, color: COLOR_SUAVE },
    );
    this.linea();
  }

  datosPaciente(datos: DatosPlantillaMaternidad) {
    const filas: [string, string][] = [
      ['Paciente', datos.nombreMadre],
      ['Cédula', datos.cedula],
      ['Semanas de gestación', datos.semanasGestacion ? String(datos.semanasGestacion) : '—'],
      ['Médico ginecólogo', datos.medicoGinecologo || '—'],
      ['Aseguradora', datos.aseguradora],
      ['Teléfono / correo', `${datos.telefono} · ${datos.correo}`],
    ];
    if (datos.tour) filas.push(['Tour agendado', datos.tour]);
    for (const [etiqueta, valor] of filas) {
      this.asegurarEspacio(16);
      this.page.drawText(this.limpiar(`${etiqueta}:`), { x: MARGEN, y: this.y - 10, size: 10, font: this.negrita, color: COLOR_SUAVE });
      this.page.drawText(this.limpiar(valor).slice(0, 80), { x: MARGEN + 140, y: this.y - 10, size: 10, font: this.fuente, color: COLOR_TEXTO });
      this.y -= 16;
    }
    this.y -= 6;
    this.linea();
  }

  pie() {
    this.texto('Clínica Atlas · Ecuador · Este documento es informativo y no constituye una factura.', {
      tamano: 8,
      color: COLOR_SUAVE,
    });
  }
}

async function crearDocumento(titulo: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(titulo);
  doc.setAuthor('Clínica Atlas');
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, escritor: new Escritor(doc, fuente, negrita) };
}

async function generarPresupuesto(datos: DatosPlantillaMaternidad): Promise<Uint8Array> {
  if (tienePresupuestoConfigurado(datos.config.presupuesto)) {
    return generarPresupuestoMembretado({
      numeroCotizacion: datos.numeroCotizacion,
      nombreMadre: datos.nombreMadre,
      cedula: datos.cedula,
      semanasGestacion: datos.semanasGestacion,
      correo: datos.correo,
      telefono: datos.telefono,
      medicoGinecologo: datos.medicoGinecologo,
      fechaEmision: datos.fechaEmision,
    }, datos.config.presupuesto);
  }
  const { doc, escritor } = await crearDocumento('Presupuesto de maternidad');
  escritor.encabezado('Presupuesto de maternidad', datos);
  escritor.datosPaciente(datos);

  // Aseguradora sin valores configurados todavía
  escritor.texto(`Plan de maternidad con ${datos.aseguradora}`, { tamano: 13, negrita: true, espacio: 6 });
  for (const item of PRESUPUESTO_GENERICO) {
    escritor.texto(`• ${item.concepto}: Según cobertura`, { negrita: true, espacio: 0 });
    escritor.texto(item.detalle, { tamano: 9, color: COLOR_SUAVE, sangria: 10 });
  }
  escritor.y -= 8;
  const notas = [
    'Los valores finales dependen de la cobertura de su póliza y de la evolución clínica.',
    'Un asesor de Clínica Atlas confirmará los montos con su aseguradora.',
  ];
  for (const nota of notas) escritor.texto(nota, { tamano: 9, color: COLOR_SUAVE });
  escritor.y -= 10;
  escritor.pie();
  return doc.save();
}

/** Presupuesto de la paciente: es el único documento que se genera y se guarda por cotización */
export async function generarDocumentosMaternidad(
  datos: DatosPlantillaMaternidad,
): Promise<{ tipo: TipoDocumentoMaternidad; nombre: string; contenido: Uint8Array }[]> {
  const sufijo = datos.numeroCotizacion.replace(/[^A-Za-z0-9-]/g, '');
  const presupuesto = await generarPresupuesto(datos);
  return [{ tipo: 'presupuesto', nombre: `Presupuesto-Maternidad-${sufijo}.pdf`, contenido: presupuesto }];
}

// ── Documentos fijos: diseños del cliente que se adjuntan tal cual en cada correo ──
// Viven en api/_assets/maternidad (vercel.json → functions.includeFiles). Para cambiarlos se reemplaza el archivo.
const CARPETA_ASSETS = path.join(process.cwd(), 'api', '_assets', 'maternidad');
const cacheAssets = new Map<string, Buffer>();

export function leerAssetMaternidad(archivo: string): Buffer {
  let contenido = cacheAssets.get(archivo);
  if (!contenido) {
    contenido = readFileSync(path.join(CARPETA_ASSETS, archivo));
    cacheAssets.set(archivo, contenido);
  }
  return contenido;
}

/** Checklist y boletín de maternidad (PDF diseñados por la clínica) */
export function documentosFijosMaternidad(): { tipo: TipoDocumentoMaternidad; nombre: string; contenido: Buffer }[] {
  return [
    { tipo: 'checklist', nombre: 'Check list maternal - Clinicas Atlas.pdf', contenido: leerAssetMaternidad('checklist-maternal.pdf') },
    { tipo: 'boletin', nombre: 'Boletin - Clinicas Atlas.pdf', contenido: leerAssetMaternidad('boletin-clinicas-atlas.pdf') },
  ];
}
