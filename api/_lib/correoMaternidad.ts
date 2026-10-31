// Correo de cotización de maternidad con el formato de servicio al cliente de Clínicas Atlas
// (docs/formatos-cotizaciones/correoDocumentos/ImpresionCorreoCliente.pdf).
// HTML en tablas de 600 px con estilos inline para que se vea igual en Gmail, Outlook y celulares.
// El banner y el logo de la firma van incrustados por CID (no dependen de imágenes externas).
import { leerAssetMaternidad } from './maternidadPlantillas';
import { LOGO_CLINICAS_ATLAS_PNG } from './maternidadImagenes';

export interface DatosCorreoMaternidad {
  nombreMadre: string;
  numeroCotizacion: string;
  aseguradora: string;
  /** Texto ya formateado, p. ej. "lunes, 2 de noviembre de 2026 · 12:00 - 12:30"; null si no agendó tour */
  tour: string | null;
}

const WHATSAPP_MATERNIDAD = 'https://wa.me/593988400810';
const FIRMA = {
  nombre: 'VALERIA QUEZADA',
  cargo: 'SERVICIO AL CLIENTE',
  telefono: '098 840 0810',
  telefonoLink: '+593988400810',
  correo: 'servicioalcliente1@clinicasatlas.med.ec',
  web: 'www.clinicas-atlas.com',
  direccion: 'Av. Francisco Hernández de Girón N35-50 y Av. América',
};
const CORREO_DERECHOS = 'servicioalcliente@clinicasatlas.med.ec';
const RAZON_SOCIAL = 'CLÍNICAS ATLAS CENTROS AMBULATORIOS Y MATERNO INFANTIL AMBUMAT S.A.';

const LILA = '#7c3aed';
const LILA_SUAVE = '#f5f3ff';
const TEXTO = '#1f2937';
const GRIS = '#6b7280';
const FUENTE = "Arial, Helvetica, sans-serif";

const escaparHtml = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function asuntoCorreoMaternidad(tipo: string, numero: string): string {
  return tipo === 'confirmacion_tour'
    ? `Su tour de maternidad y presupuesto · Clínicas Atlas · ${numero}`
    : `Presupuesto de maternidad · Clínicas Atlas · ${numero}`;
}

const parrafo = (html: string, extra = '') =>
  `<p style="margin:0 0 14px;font-family:${FUENTE};font-size:15px;line-height:1.6;color:${TEXTO};${extra}">${html}</p>`;

const titulo = (html: string) =>
  `<p style="margin:22px 0 8px;font-family:${FUENTE};font-size:16px;font-weight:bold;color:${LILA};">${html}</p>`;

const vineta = (html: string) =>
  `<tr><td style="padding:3px 8px 3px 0;vertical-align:top;font-family:${FUENTE};font-size:15px;color:${LILA};">•</td>` +
  `<td style="padding:3px 0;font-family:${FUENTE};font-size:15px;line-height:1.5;color:${TEXTO};">${html}</td></tr>`;

const filaDato = (etiqueta: string, valor: string) =>
  `<tr><td style="padding:4px 12px 4px 0;font-family:${FUENTE};font-size:14px;color:${GRIS};white-space:nowrap;vertical-align:top;">${etiqueta}</td>` +
  `<td style="padding:4px 0;font-family:${FUENTE};font-size:14px;font-weight:bold;color:${TEXTO};">${valor}</td></tr>`;

export function construirCorreoMaternidad(datos: DatosCorreoMaternidad) {
  const nombre = escaparHtml(datos.nombreMadre);
  const aseguradora = escaparHtml(datos.aseguradora);
  const numero = escaparHtml(datos.numeroCotizacion);
  const tour = datos.tour ? escaparHtml(datos.tour) : null;

  const recuadro = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LILA_SUAVE};border-left:4px solid ${LILA};border-radius:8px;margin:6px 0 18px;">
    <tr><td style="padding:16px 18px;">
      <p style="margin:0 0 8px;font-family:${FUENTE};font-size:13px;font-weight:bold;letter-spacing:.5px;color:${LILA};text-transform:uppercase;">Su solicitud</p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        ${filaDato('Futura mamá', nombre)}
        ${filaDato('Cotización N°', numero)}
        ${filaDato('Aseguradora / plan', aseguradora)}
        ${tour ? filaDato('Tour de maternidad', tour) : ''}
      </table>
      ${tour ? `<p style="margin:10px 0 0;font-family:${FUENTE};font-size:13px;line-height:1.5;color:${TEXTO};">📍 Le recomendamos llegar <b>10 minutos antes</b> y traer su <b>cédula de identidad</b>. ¡Les esperamos con mucho cariño!</p>` : ''}
    </td></tr>
  </table>`;

  const invitacionTour = tour ? '' : `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf2f8;border-radius:8px;margin:18px 0 6px;">
    <tr><td style="padding:16px 18px;text-align:center;">
      <p style="margin:0 0 6px;font-family:${FUENTE};font-size:16px;font-weight:bold;color:#be185d;">🏥 ¡Conozca nuestra maternidad antes del gran día!</p>
      <p style="margin:0 0 14px;font-family:${FUENTE};font-size:14px;line-height:1.5;color:${TEXTO};">Le invitamos a un tour guiado para conocer nuestras salas de parto, habitaciones y el área de neonatología, y resolver todas sus dudas con nuestro equipo.</p>
      <a href="${WHATSAPP_MATERNIDAD}" style="display:inline-block;background:#16a34a;color:#ffffff;font-family:${FUENTE};font-size:15px;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:24px;">Agendar mi tour por WhatsApp</a>
    </td></tr>
  </table>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Presupuesto de maternidad · Clínicas Atlas</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
  <tr><td align="center" style="padding:20px 10px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;">
      <tr><td align="center" style="padding:24px 24px 4px;">
        <img src="cid:banner-maternidad" width="520" alt="Clínicas Atlas · Maternidad" style="display:block;width:100%;max-width:520px;height:auto;border:0;">
      </td></tr>
      <tr><td style="padding:12px 32px 8px;">
        ${parrafo('<b style="font-size:17px;">Estimados futuros papitos: 🤰👶💕</b>', 'margin-bottom:10px;')}
        ${parrafo('Reciban un cordial y afectuoso saludo de parte de <b>Clínicas Atlas</b>. Agradecemos su confianza y el interés en nuestra institución para acompañarlos en uno de los momentos más hermosos de sus vidas: <b>¡la llegada de su bebé!</b> 💗')}
        ${recuadro}
        ${parrafo('Nos complace contarles que disponemos de nuevas y modernas instalaciones, con <b>25 habitaciones confortables, quirófanos equipados, Unidad de Cuidados Intensivos para adultos y Servicio de Neonatología</b> con atención en cuidados mínimos, intermedios e intensivos, además de un equipo de profesionales comprometidos con el bienestar de mamá y bebé.')}

        ${titulo('🌸 Paquetes promocionales de maternidad')}
        ${parrafo('Pensando en la tranquilidad de nuestras futuras mamitas, contamos con <b>paquetes promocionales de maternidad con tarifas preferenciales y beneficios especiales</b>.')}

        ${titulo('📎 Documentos adjuntos')}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
          ${vineta('<b>Presupuesto</b>: valores y servicios incluidos en su paquete de maternidad.')}
          ${vineta('<b>Check list maternal</b>: todo lo que mamá y bebé necesitan llevar el día del parto.')}
          ${vineta('<b>Boletín Clínicas Atlas</b>: conozca nuestras instalaciones y servicios.')}
        </table>

        ${titulo('💳 Formas de pago')}
        ${parrafo('Para su comodidad, contamos con las siguientes alternativas:', 'margin-bottom:6px;')}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
          ${vineta('💵 Efectivo.')}
          ${vineta('🏦 Transferencia bancaria.')}
          ${vineta('💳 Tarjeta de crédito corriente o diferida.')}
          ${vineta('✨ <b>Hasta 3 meses sin intereses.</b>')}
          ${vineta('✨ <b>Hasta 12 meses con intereses.</b>')}
        </table>
        ${parrafo('Las promociones y opciones de financiamiento están sujetas a las condiciones establecidas y a las restricciones de cada entidad financiera.', `font-size:13px;font-style:italic;color:${GRIS};`)}

        ${invitacionTour}

        ${parrafo('💕 Será un verdadero placer acompañarlos en esta hermosa etapa, brindándoles la seguridad, confianza y tranquilidad que ustedes y su bebé merecen. Quedamos atentos a cualquier inquietud y estaremos encantados de brindarles asesoría personalizada.', 'margin-top:20px;')}
        ${parrafo('<b>Clínicas Atlas, creciendo para cuidar de ustedes y de quienes más aman.</b> 🌷', 'margin-bottom:4px;')}
        ${parrafo('Saludos cordiales,')}
      </td></tr>
      <tr><td style="padding:4px 32px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="background:linear-gradient(90deg,#eef6fb,#f6f2fb);background-color:#f1f5fa;border-radius:10px;">
          <tr>
            <td style="padding:14px 18px 14px 16px;vertical-align:middle;border-right:2px solid #c7d7ea;">
              <img src="cid:logo-clinicas-atlas" width="130" alt="Clínicas Atlas" style="display:block;width:130px;height:auto;border:0;">
            </td>
            <td style="padding:12px 18px;vertical-align:middle;font-family:${FUENTE};">
              <p style="margin:0;font-size:17px;font-weight:bold;letter-spacing:.5px;color:#2f4a9a;">${FIRMA.nombre}</p>
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:1px;color:#374151;">${FIRMA.cargo}</p>
              <p style="margin:0;font-size:12.5px;line-height:1.7;color:#374151;">
                📞 <a href="tel:${FIRMA.telefonoLink}" style="color:#374151;text-decoration:none;">${FIRMA.telefono}</a><br>
                ✉️ <a href="mailto:${FIRMA.correo}" style="color:#374151;text-decoration:none;">${FIRMA.correo}</a><br>
                🌐 <a href="https://${FIRMA.web}" style="color:#2f4a9a;text-decoration:none;font-weight:bold;">${FIRMA.web}</a><br>
                📍 ${FIRMA.direccion}
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-family:${FUENTE};font-size:11px;line-height:1.5;color:#9ca3af;font-style:italic;">
          Este mensaje y la información que contiene están dirigidos exclusivamente a sus destinatarios. Contiene información producida por ${RAZON_SOCIAL}, que es confidencial. Si usted no es el destinatario, no puede examinar, usar, copiar o distribuir este mensaje o la información que este contiene. Si lo recibe por error, por favor reenvíelo inmediatamente a la persona que se lo envió y elimínelo. Los datos proporcionados se conservarán mientras se mantenga la relación establecida con ${RAZON_SOCIAL}, y en el desarrollo de los servicios prestados o durante los años necesarios para cumplir con las obligaciones legales. Los datos no se cederán a terceros, salvo en los casos en que exista una obligación legal. Asimismo, de conformidad con la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP), le informamos de la posibilidad de ejercer los siguientes derechos sobre sus datos personales: derecho de acceso, rectificación, eliminación, suspensión, oposición, portabilidad y a retirar el consentimiento prestado. Para ello, podrá enviar un correo electrónico a: <a href="mailto:${CORREO_DERECHOS}" style="color:#9ca3af;">${CORREO_DERECHOS}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  // Versión en texto plano: mejora la entrega (filtros antispam) y se lee en clientes sin HTML
  const text = [
    'Estimados futuros papitos:',
    '',
    'Reciban un cordial y afectuoso saludo de parte de Clínicas Atlas. Agradecemos su confianza y el interés en nuestra institución para acompañarlos en uno de los momentos más hermosos de sus vidas: ¡la llegada de su bebé!',
    '',
    'SU SOLICITUD',
    `- Futura mamá: ${datos.nombreMadre}`,
    `- Cotización N°: ${datos.numeroCotizacion}`,
    `- Aseguradora / plan: ${datos.aseguradora}`,
    ...(datos.tour ? [`- Tour de maternidad: ${datos.tour}`, '  Le recomendamos llegar 10 minutos antes y traer su cédula de identidad.'] : []),
    '',
    'Nos complace contarles que disponemos de nuevas y modernas instalaciones, con 25 habitaciones confortables, quirófanos equipados, Unidad de Cuidados Intensivos para adultos y Servicio de Neonatología, además de un equipo de profesionales comprometidos con el bienestar de mamá y bebé.',
    '',
    'PAQUETES PROMOCIONALES DE MATERNIDAD',
    'Contamos con paquetes promocionales de maternidad con tarifas preferenciales y beneficios especiales.',
    '',
    'DOCUMENTOS ADJUNTOS',
    '- Presupuesto: valores y servicios incluidos en su paquete de maternidad.',
    '- Check list maternal: todo lo que mamá y bebé necesitan llevar el día del parto.',
    '- Boletín Clínicas Atlas: conozca nuestras instalaciones y servicios.',
    '',
    'FORMAS DE PAGO',
    '- Efectivo.',
    '- Transferencia bancaria.',
    '- Tarjeta de crédito corriente o diferida.',
    '- Hasta 3 meses sin intereses.',
    '- Hasta 12 meses con intereses.',
    'Las promociones y opciones de financiamiento están sujetas a las condiciones establecidas y a las restricciones de cada entidad financiera.',
    '',
    ...(datos.tour ? [] : ['¿Desea conocer nuestra maternidad? Agende su tour por WhatsApp: ' + WHATSAPP_MATERNIDAD, '']),
    'Será un verdadero placer acompañarlos en esta hermosa etapa. Quedamos atentos a cualquier inquietud.',
    '',
    'Clínicas Atlas, creciendo para cuidar de ustedes y de quienes más aman.',
    'Saludos cordiales,',
    '',
    'Valeria Quezada',
    'Servicio al Cliente · Clínicas Atlas',
    `${FIRMA.telefono} · ${FIRMA.correo}`,
    FIRMA.web,
    FIRMA.direccion,
  ].join('\n');

  const imagenes = [
    { filename: 'banner-maternidad.png', content: leerAssetMaternidad('banner-maternidad.png'), contentType: 'image/png', cid: 'banner-maternidad' },
    { filename: 'logo-clinicas-atlas.png', content: Buffer.from(LOGO_CLINICAS_ATLAS_PNG, 'base64'), contentType: 'image/png', cid: 'logo-clinicas-atlas' },
  ];

  return { html, text, imagenes };
}
