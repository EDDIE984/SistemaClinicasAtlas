// Consulta al Registro Civil del lado del servidor (CEDULA_API_BASE_URL / CEDULA_API_KEY).
// El mapeo es el mismo de src/lib/registroCivilService.ts (el api no importa de src/).

export interface FichaRegistroCivil {
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  fecha_nacimiento: string | null;
  sexo: 'M' | 'F' | 'Otro';
}

// Formato del Registro Civil: APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2
const parsearNombre = (nombreCompleto: string): { nombres: string; apellidos: string } => {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length < 2) return { nombres: nombreCompleto.trim(), apellidos: '' };
  return { apellidos: partes.slice(0, 2).join(' '), nombres: partes.slice(2).join(' ') };
};

// DD/MM/YYYY → YYYY-MM-DD
const parsearFecha = (fecha: string | undefined): string | null => {
  const partes = (fecha || '').split('/');
  if (partes.length !== 3) return null;
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
};

const parsearGenero = (genero: string | undefined): 'M' | 'F' | 'Otro' => {
  const g = (genero || '').toUpperCase();
  if (g.includes('MUJER') || g.includes('FEMENINO')) return 'F';
  if (g.includes('HOMBRE') || g.includes('MASCULINO')) return 'M';
  return 'Otro';
};

/**
 * Ficha básica desde el Registro Civil; null si no está configurado, no hay datos o falla.
 * El servicio es lento (~30 s con una cédula válida; las inexistentes devuelven 500 tras 15–35 s),
 * por eso el límite es alto: la función que lo use necesita maxDuration ≥ 60 en vercel.json.
 */
export async function consultarRegistroCivil(cedula: string, timeoutMs = 50000): Promise<FichaRegistroCivil | null> {
  const base = process.env.CEDULA_API_BASE_URL;
  const apiKey = process.env.CEDULA_API_KEY;
  if (!base || !apiKey) {
    console.error('❌ Registro Civil no configurado (CEDULA_API_BASE_URL / CEDULA_API_KEY)');
    return null;
  }

  try {
    const respuesta = await fetch(
      `${base}?Cedula=${encodeURIComponent(cedula)}&Apikey=${encodeURIComponent(apiKey)}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) },
    );
    if (!respuesta.ok) {
      console.error(`❌ Registro Civil respondió ${respuesta.status}:`, await respuesta.text());
      return null;
    }

    const data = await respuesta.json();
    // Soporta camelCase y PascalCase
    const nombreCompleto: string = String(data?.nombre || data?.Nombre || '').trim();
    const fechaNacimiento: string | undefined = data?.fechaNacimiento || data?.FechaNacimiento;
    if (!nombreCompleto) return null;

    const { nombres, apellidos } = parsearNombre(nombreCompleto);
    return {
      nombres,
      apellidos,
      nombre_completo: nombreCompleto,
      fecha_nacimiento: parsearFecha(fechaNacimiento),
      sexo: parsearGenero(data?.genero || data?.Genero),
    };
  } catch (error) {
    console.error('❌ Error al consultar el Registro Civil:', error);
    return null;
  }
}
