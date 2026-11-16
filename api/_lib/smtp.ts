import nodemailer from 'nodemailer';

// Configuración del correo de la clínica (mail.clinicasatlas.med.ec). La misma casilla recibe los
// rebotes, que se leen por IMAP (puerto 993) con las mismas credenciales.

export interface ConfigCorreo {
  host: string;
  puerto: number;
  usuario: string;
  clave: string;
  remitente: string;
}

/** null si faltan SMTP_HOST, SMTP_USER o SMTP_PASS */
export function getConfigCorreo(): ConfigCorreo | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return {
    host: SMTP_HOST,
    puerto: Number(SMTP_PORT || 465),
    usuario: SMTP_USER,
    clave: SMTP_PASS,
    remitente: SMTP_FROM || SMTP_USER,
  };
}

export function crearTransporteSmtp(config: ConfigCorreo) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.puerto,
    secure: config.puerto === 465,
    auth: { user: config.usuario, pass: config.clave },
  });
}
