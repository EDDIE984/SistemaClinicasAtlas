// Carga la bitácora histórica de tours de maternidad (Excel) en maternidad_solicitud como origen 'BITACORA'.
//
// Uso (después de ejecutar src/supabase/081_maternidad_bitacora.sql):
//   node scripts/importar-bitacora-maternidad.mjs --dry-run      → solo muestra el resumen
//   node scripts/importar-bitacora-maternidad.mjs                → inserta
//   node scripts/importar-bitacora-maternidad.mjs --archivo "otra/ruta.xlsx"
//
// Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env. Se puede volver a ejecutar: salta los
// números de bitácora ya cargados. El Excel tiene datos de pacientes: no se sube al repositorio.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const ARCHIVO_DEFECTO = 'docs/formatos-cotizaciones/BITACORA TOUR MATERNIDAD SEGUIMIENTO-3.xlsx';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const iArchivo = args.indexOf('--archivo');
const archivo = iArchivo >= 0 ? args[iArchivo + 1] : ARCHIVO_DEFECTO;

// Iniciales del Excel → nombre completo (las demás se cargan como están y se pueden renombrar después)
const ASESORES = { VQ: 'VALERIA QUEZADA' };

// Seguros del Excel que se escriben distinto al catálogo maternidad_aseguradora (claves normalizadas)
const ALIAS_SEGURO = {
  PALIG: 'PANAMERICANLIFE',
  AIG: 'AIGMETROPOLITANA',
  NO: 'OTRAPARTICULAR',
  PARTICULAR: 'OTRAPARTICULAR',
};

// ── Utilidades ────────────────────────────────────────────────────────────────
function leerEnv() {
  const env = {};
  for (const linea of readFileSync('.env', 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const clave = texto => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const texto = valor => {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).trim();
  return t === '' || t === '-' ? null : t;
};

/** Serial de Excel (días desde 1899-12-30) → YYYY-MM-DD */
function fechaISO(serial) {
  if (typeof serial !== 'number') return null;
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return d.toISOString().slice(0, 10);
}

/** Fracción de día de Excel o texto "17h00" / "17:00" → HH:MM */
function hora(valor) {
  if (typeof valor === 'number') {
    const minutos = Math.round((valor % 1) * 24 * 60);
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
  }
  const m = texto(valor)?.match(/^(\d{1,2})\s*[h:]\s*(\d{2})/i);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

/** Teléfono numérico del Excel → texto con el 0 inicial; 0 o inválido → null */
function telefono(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number' && (!Number.isSafeInteger(valor) || valor <= 0)) return null;
  const digitos = String(valor).replace(/\D/g, '');
  if (!digitos || /^0+$/.test(digitos) || digitos.length > 10) return null;
  return digitos.startsWith('9') && digitos.length <= 9 ? `0${digitos}` : digitos;
}

// ── Lectura del Excel ─────────────────────────────────────────────────────────
const libro = XLSX.read(readFileSync(archivo), { type: 'buffer' });
const hoja = libro.Sheets[libro.SheetNames[0]];
const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null });

const encabezado = (filas[1] || []).map(v => clave(v ?? ''));
const col = nombre => {
  const i = encabezado.indexOf(clave(nombre));
  if (i < 0) throw new Error(`No se encontró la columna "${nombre}" en la fila 2 del Excel`);
  return i;
};
const C = {
  numero: col('#'),
  fecha: col('FECHA'),
  nombre: col('NOMBRES'),
  medico: col('MÉDICO TRATANTE'),
  semanas: col('SEMANAS DE GESTACIÓN'),
  telefono: col('TELF'),
  inicio: col('HORA DE INICIO'),
  fin: col('HORA FIN'),
  asesor: col('ASESOR'),
  seguro: col('SEGURO'),
  firma: col('FIRMA PACIENTE'),
};

const env = leerEnv();
const URL_SB = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !KEY) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
const cabeceras = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(ruta, opciones = {}) {
  const res = await fetch(`${URL_SB}/rest/v1/${ruta}`, { ...opciones, headers: { ...cabeceras, ...(opciones.headers || {}) } });
  if (!res.ok) throw new Error(`${res.status} ${ruta}: ${await res.text()}`);
  return res.status === 204 || res.headers.get('content-length') === '0' ? null : res.json().catch(() => null);
}

const catalogo = await api('maternidad_aseguradora?select=id_aseguradora_mat,nombre');
const idPorClave = new Map(catalogo.map(a => [clave(a.nombre), a.id_aseguradora_mat]));
const nombrePorId = new Map(catalogo.map(a => [a.id_aseguradora_mat, a.nombre]));
let existentes = new Set();
try {
  existentes = new Set(
    (await api('maternidad_solicitud?select=numero_bitacora&origen=eq.BITACORA&numero_bitacora=not.is.null&limit=100000'))
      .map(r => r.numero_bitacora),
  );
} catch (error) {
  if (!dryRun) throw new Error(`Ejecute primero src/supabase/081_maternidad_bitacora.sql (${error.message})`);
  console.log('Aviso: la migración 081 aún no está ejecutada; el resumen asume que no hay nada cargado.\n');
}

// ── Transformación ────────────────────────────────────────────────────────────
const resumen = { filas: 0, insertar: 0, yaCargadas: 0, omitidas: [], sinSemanas: 0, sinTelefono: 0, conHora: 0 };
const porAseguradora = new Map();
const sinCatalogo = new Map();
const porAsesor = new Map();
const registros = [];
const sumar = (mapa, k) => mapa.set(k, (mapa.get(k) || 0) + 1);

for (const fila of filas.slice(2)) {
  if (!fila || fila.every(v => v === null || v === '')) continue;
  resumen.filas += 1;
  const numero = Number(fila[C.numero]);
  const fecha = fechaISO(fila[C.fecha]);
  const nombre = texto(fila[C.nombre])?.toUpperCase() || null;

  if (!Number.isInteger(numero) || !fecha) {
    resumen.omitidas.push(`#${fila[C.numero]}: sin número o fecha válidos`);
    continue;
  }
  if (nombre && /REPE/.test(nombre)) {
    resumen.omitidas.push(`#${numero}: marcada como repetida (${nombre})`);
    continue;
  }
  if (existentes.has(numero)) {
    resumen.yaCargadas += 1;
    continue;
  }

  const semanasTexto = texto(fila[C.semanas]);
  const semanasNum = Number(semanasTexto);
  const semanas = Number.isInteger(semanasNum) && semanasNum >= 1 && semanasNum <= 45 ? semanasNum : null;
  if (semanas === null) resumen.sinSemanas += 1;

  const seguro = texto(fila[C.seguro])?.toUpperCase() || null;
  const claveSeguro = seguro ? ALIAS_SEGURO[clave(seguro)] || clave(seguro) : null;
  const idAseguradora = claveSeguro ? idPorClave.get(claveSeguro) ?? null : null;
  if (seguro && idAseguradora) sumar(porAseguradora, `${seguro} → ${nombrePorId.get(idAseguradora)}`);
  if (seguro && !idAseguradora) sumar(sinCatalogo, seguro);

  const asesorCodigo = texto(fila[C.asesor])?.toUpperCase() || null;
  const asesor = asesorCodigo ? ASESORES[asesorCodigo] || asesorCodigo : null;
  sumar(porAsesor, asesor || '(sin asesor)');

  const tel = telefono(fila[C.telefono]);
  if (!tel) resumen.sinTelefono += 1;
  const inicio = hora(fila[C.inicio]);
  if (inicio) resumen.conHora += 1;
  const firmaTexto = texto(fila[C.firma])?.toUpperCase();

  const notas = [
    semanas === null && semanasTexto ? `Semanas en la bitácora: ${semanasTexto}` : null,
  ].filter(Boolean).join('. ') || null;

  registros.push({
    numero_bitacora: numero,
    nombre_madre: nombre || '(SIN NOMBRE)',
    medico_ginecologo: texto(fila[C.medico])?.toUpperCase() || null,
    semanas_gestacion: semanas,
    telefono: tel,
    fecha_tour: fecha,
    hora_inicio_real: inicio,
    hora_fin_real: hora(fila[C.fin]),
    asesor,
    id_aseguradora_mat: idAseguradora,
    seguro_texto: idAseguradora ? null : seguro,
    firma_paciente: firmaTexto === 'SI' ? true : firmaTexto === 'NO' ? false : null,
    estado: 'asistio',
    origen: 'BITACORA',
    notas,
    creado_por: 'Bitácora (Excel)',
    actualizado_por: 'Bitácora (Excel)',
    created_at: `${fecha}T00:00:00-05:00`,
    updated_at: `${fecha}T00:00:00-05:00`,
  });
}
resumen.insertar = registros.length;

const lista = mapa => [...mapa.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `    ${k}: ${v}`).join('\n') || '    —';
console.log(`Archivo: ${archivo}`);
console.log(`Filas con datos: ${resumen.filas} · a insertar: ${resumen.insertar} · ya cargadas: ${resumen.yaCargadas} · omitidas: ${resumen.omitidas.length}`);
resumen.omitidas.forEach(o => console.log(`  omitida ${o}`));
console.log(`Sin semanas válidas: ${resumen.sinSemanas} · sin teléfono: ${resumen.sinTelefono} · con hora de inicio: ${resumen.conHora}`);
console.log(`Seguros con aseguradora del catálogo:\n${lista(porAseguradora)}`);
console.log(`Seguros sin catálogo (quedan en seguro_texto):\n${lista(sinCatalogo)}`);
console.log(`Asesores:\n${lista(porAsesor)}`);
if (registros.length) {
  console.log('Primera:', JSON.stringify(registros[0]));
  console.log('Última:', JSON.stringify(registros[registros.length - 1]));
}

if (dryRun) {
  console.log('\n--dry-run: no se escribió nada.');
} else {
  for (let i = 0; i < registros.length; i += 100) {
    await api('maternidad_solicitud', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(registros.slice(i, i + 100)),
    });
    console.log(`  insertadas ${Math.min(i + 100, registros.length)} / ${registros.length}`);
  }
  console.log('Importación terminada.');
}
