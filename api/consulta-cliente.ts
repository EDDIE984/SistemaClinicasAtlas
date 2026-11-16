import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { consultarRegistroCivil } from './_lib/registroCivil';

// Consulta de datos de una persona por cédula para flujos externos (n8n).
// Orden: paciente → maternidad_solicitud → Registro Civil → "no disponible".
// Lo que viene del Registro Civil no se guarda en la base.
//   GET  /api/consulta-cliente?cedula=0912345678
//   POST /api/consulta-cliente   { "cedula": "0912345678" }

type Fuente = 'paciente' | 'maternidad' | 'registro_civil';

interface FichaCliente {
  fuente: Fuente;
  nombres: string | null;
  apellidos: string | null;
  nombre_completo: string;
  fecha_nacimiento: string | null;
  sexo: string | null;
  telefono: string | null;
  correo: string | null;
}

function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  return { url, key };
}

const texto = (valor: unknown): string | null => {
  if (valor === undefined || valor === null) return null;
  const limpio = String(valor).trim();
  return limpio === '' ? null : limpio;
};

async function buscarEnPacientes(supabase: SupabaseClient, cedula: string): Promise<FichaCliente | null> {
  try {
    const { data, error } = await supabase
      .from('paciente')
      .select('cedula, nombres, apellidos, fecha_nacimiento, sexo, email, telefono, estado')
      .eq('cedula', cedula)
      .order('estado', { ascending: true }) // 'activo' antes que 'inactivo'
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const nombres = texto(data.nombres);
    const apellidos = texto(data.apellidos);
    return {
      fuente: 'paciente',
      nombres,
      apellidos,
      nombre_completo: [nombres, apellidos].filter(Boolean).join(' '),
      fecha_nacimiento: texto(data.fecha_nacimiento),
      sexo: texto(data.sexo),
      telefono: texto(data.telefono),
      correo: texto(data.email),
    };
  } catch (error) {
    console.error('❌ Error al buscar la cédula en paciente:', error);
    return null;
  }
}

async function buscarEnMaternidad(supabase: SupabaseClient, cedula: string): Promise<FichaCliente | null> {
  try {
    const { data, error } = await supabase
      .from('maternidad_solicitud')
      .select('cedula, nombre_madre, correo, telefono')
      .eq('cedula', cedula)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const nombre = texto(data?.nombre_madre);
    if (!data || !nombre) return null;

    // El nombre lo escribe la persona en orden libre: no se separa en nombres/apellidos
    return {
      fuente: 'maternidad',
      nombres: null,
      apellidos: null,
      nombre_completo: nombre,
      fecha_nacimiento: null,
      sexo: 'F',
      telefono: texto(data.telefono),
      correo: texto(data.correo),
    };
  } catch (error) {
    console.error('❌ Error al buscar la cédula en maternidad_solicitud:', error);
    return null;
  }
}

async function buscarEnRegistroCivil(cedula: string): Promise<FichaCliente | null> {
  const ficha = await consultarRegistroCivil(cedula);
  if (!ficha) return null;
  return {
    fuente: 'registro_civil',
    nombres: ficha.nombres || null,
    apellidos: ficha.apellidos || null,
    nombre_completo: ficha.nombre_completo,
    fecha_nacimiento: ficha.fecha_nacimiento,
    sexo: ficha.sexo,
    telefono: null,
    correo: null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  const parametro = req.method === 'GET'
    ? (Array.isArray(req.query.cedula) ? req.query.cedula[0] : req.query.cedula)
    : (req.body || {}).cedula;
  const cedula = String(parametro ?? '').replace(/\D/g, '');

  if (cedula.length !== 10) {
    return res.status(400).json({ ok: false, error: 'CEDULA_INVALIDA', mensaje: 'La cédula debe tener 10 dígitos' });
  }

  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return res.status(500).json({ ok: false, error: 'Supabase no está configurado. Configure SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.' });
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const ficha =
    (await buscarEnPacientes(supabase, cedula)) ||
    (await buscarEnMaternidad(supabase, cedula)) ||
    (await buscarEnRegistroCivil(cedula));

  if (!ficha) {
    return res.status(200).json({
      ok: true,
      encontrado: false,
      fuente: 'no_disponible',
      cedula,
      mensaje: 'Datos no disponibles',
    });
  }

  return res.status(200).json({ ok: true, encontrado: true, cedula, ...ficha });
}
