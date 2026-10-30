// Plantillas PDF del módulo Maternidad: presupuesto, checklist y boletín.
// El presupuesto usa la hoja membretada con los valores de maternidad_aseguradora.config_cotizacion.presupuesto
// (presupuestoMembretado.ts); si la aseguradora aún no tiene valores configurados se usa un presupuesto genérico.
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { generarPresupuestoMembretado, tienePresupuestoConfigurado, type ConfigPresupuestoMaternidad } from './presupuestoMembretado';

export interface DatosPlantillaMaternidad {
  idSolicitud: number;
  /** COT-MAT-AAAA-NNNNNN, impreso en los 3 documentos */
  numeroCotizacion: string;
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

const CHECKLIST_GENERICO: NonNullable<NonNullable<ConfigCotizacion['checklist']>['secciones']> = [
  {
    titulo: 'Documentos',
    items: [
      'Cédula de identidad de la mamá y del acompañante',
      'Carnet o credencial de la aseguradora',
      'Carné prenatal / control de embarazo',
      'Ecografías y exámenes de laboratorio recientes',
      'Orden de ingreso del médico ginecólogo (si aplica)',
    ],
  },
  {
    titulo: 'Para la mamá',
    items: [
      'Ropa cómoda y bata de apertura frontal',
      'Brasieres de lactancia y protectores mamarios',
      'Toallas sanitarias de posparto',
      'Artículos de aseo personal',
      'Pantuflas y ropa para la salida',
    ],
  },
  {
    titulo: 'Para el bebé',
    items: [
      'Pañales para recién nacido',
      'Pañitos húmedos y crema antipañalitis',
      '3 a 4 mudas de ropa (bodies, pijamas, gorro, medias)',
      'Cobija o manta',
      'Silla de auto para la salida',
    ],
  },
];

const BOLETIN_GENERICO = [
  'Gracias por considerar a Clínica Atlas para el nacimiento de su bebé. Nuestro equipo de maternidad la acompañará en cada etapa: controles, parto y posparto.',
  'Durante el tour conocerá las salas de parto, quirófanos, habitaciones, el área de neonatología y resolverá sus dudas con nuestro personal.',
  'Recomendaciones para el tour: llegar 10 minutos antes, asistir con un máximo de un acompañante y traer su cédula de identidad.',
  'Horarios de tours: lunes a viernes de 09h00 a 12h30 y de 15h30 a 17h00; sábados a las 09h00, 10h00, 11h00, 12h00 y 13h00.',
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
      `Cotización N.º ${datos.numeroCotizacion} · ${new Date().toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: 'long', year: 'numeric' })}`,
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

async function generarChecklist(datos: DatosPlantillaMaternidad): Promise<Uint8Array> {
  const { doc, escritor } = await crearDocumento('Checklist de maternidad');
  escritor.encabezado('Checklist para el día del parto', datos);
  escritor.datosPaciente(datos);
  const secciones = datos.config.checklist?.secciones?.length ? datos.config.checklist.secciones : CHECKLIST_GENERICO;
  for (const seccion of secciones) {
    escritor.texto(seccion.titulo, { tamano: 13, negrita: true, color: COLOR_PRIMARIO, espacio: 2 });
    for (const item of seccion.items) escritor.texto(`[  ]  ${item}`, { sangria: 6, espacio: 0 });
    escritor.y -= 10;
  }
  escritor.pie();
  return doc.save();
}

async function generarBoletin(datos: DatosPlantillaMaternidad): Promise<Uint8Array> {
  const { doc, escritor } = await crearDocumento('Boletín de maternidad');
  escritor.encabezado('Boletín informativo de maternidad', datos);
  escritor.texto(`Estimada ${datos.nombreMadre}:`, { tamano: 12, negrita: true, espacio: 8 });
  if (datos.tour) {
    escritor.texto(`Su tour de maternidad está agendado para el ${datos.tour}.`, { negrita: true, color: COLOR_PRIMARIO, espacio: 8 });
  } else {
    escritor.texto('Aún no ha agendado su tour de maternidad. Escríbanos por WhatsApp para reservar el horario que más le convenga.', {
      negrita: true,
      color: COLOR_PRIMARIO,
      espacio: 8,
    });
  }
  const parrafos = datos.config.boletin?.parrafos?.length ? datos.config.boletin.parrafos : BOLETIN_GENERICO;
  for (const parrafo of parrafos) escritor.texto(parrafo, { espacio: 8 });
  escritor.y -= 10;
  escritor.pie();
  return doc.save();
}

export async function generarDocumentosMaternidad(
  datos: DatosPlantillaMaternidad,
): Promise<{ tipo: TipoDocumentoMaternidad; nombre: string; contenido: Uint8Array }[]> {
  const sufijo = datos.numeroCotizacion.replace(/[^A-Za-z0-9-]/g, '');
  const [presupuesto, checklist, boletin] = await Promise.all([
    generarPresupuesto(datos),
    generarChecklist(datos),
    generarBoletin(datos),
  ]);
  return [
    { tipo: 'presupuesto', nombre: `Presupuesto-Maternidad-${sufijo}.pdf`, contenido: presupuesto },
    { tipo: 'checklist', nombre: `Checklist-Maternidad-${sufijo}.pdf`, contenido: checklist },
    { tipo: 'boletin', nombre: `Boletin-Maternidad-${sufijo}.pdf`, contenido: boletin },
  ];
}
