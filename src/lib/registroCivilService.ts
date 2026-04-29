export interface DatosRegistroCivil {
    cedula: string;
    nombre: string;
    genero: string;
    fechaNacimiento: string;
    estadoCivil: string;
    conyuge: string;
    nacionalidad: string;
    fechaCedulacion: string;
    lugarDomicilio: string;
    calleDomicilio: string;
    numeracionDomicilio: string;
    nombreMadre: string;
    nombrePadre: string;
    lugarNacimiento: string;
    instruccion: string;
    profesion: string;
}

export interface PersonaMapeada {
    nombres: string;
    apellidos: string;
    fecha_nacimiento: string;
    sexo: 'M' | 'F' | 'Otro';
    direccion: string;
    estado_civil: string;
    nacionalidad: string;
    lugar_nacimiento: string;
    nivel_educacion: string;
    ocupacion_profesion: string;
    provincia: string;
    canton: string;
    parroquia: string;
    barrio_sector: string;
    calle_principal: string;
    referencia_domicilio: string;
}

// Parsear nombre completo (Asumiendo formato: APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2)
const parsearNombre = (nombreCompleto: string): { nombres: string, apellidos: string } => {
    if (!nombreCompleto) return { nombres: '', apellidos: '' };

    const partes = nombreCompleto.trim().split(/\s+/);

    // Si tiene menos de 2 partes, asumimos que es nombre o apellido
    if (partes.length < 2) {
        return { nombres: nombreCompleto, apellidos: '' };
    }

    // Comúnmente los dos primeros son apellidos
    // Ejemplo: ESPIN PAREDES ZOILA ROSA XIMENA
    // Apellidos: ESPIN PAREDES
    // Nombres: ZOILA ROSA XIMENA

    const apellidos = partes.slice(0, 2).join(' ');
    const nombres = partes.slice(2).join(' ');

    return { nombres, apellidos };
};

// Formatear fecha de DD/MM/YYYY a YYYY-MM-DD
const parsearFecha = (fecha: string): string => {
    if (!fecha) return '';
    // entrada: 21/06/1960
    const partes = fecha.split('/');
    if (partes.length !== 3) return '';

    // salida: 1960-06-21
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
};

// Mapear género
const parsearGenero = (genero: string): 'M' | 'F' | 'Otro' => {
    if (!genero) return 'Otro';
    const g = genero.toUpperCase();
    if (g.includes('MUJER') || g.includes('FEMENINO')) return 'F';
    if (g.includes('HOMBRE') || g.includes('MASCULINO')) return 'M';
    return 'Otro';
};

const parsearEstadoCivil = (estadoCivil: string): string => {
    const estado = (estadoCivil || '').toUpperCase();
    if (estado.includes('SOLTER')) return 'SOL';
    if (estado.includes('CASAD')) return 'CAS';
    if (estado.includes('DIVORCI')) return 'DIV';
    if (estado.includes('VIUD')) return 'VIU';
    if (estado.includes('UNION') || estado.includes('UNIÓN')) return 'U';
    return '';
};

const parsearUbicacion = (ubicacion: string): { provincia: string; canton: string; parroquia: string } => {
    const partes = (ubicacion || '').split('/').map((parte) => parte.trim()).filter(Boolean);
    return {
        provincia: partes[0] || '',
        canton: partes[1] || '',
        parroquia: partes[2] || '',
    };
};

// Función principal para consultar cédula
export const consultarCedulaRegistroCivil = async (cedula: string): Promise<PersonaMapeada | null> => {
    if (!cedula || cedula.length < 10) return null;

    try {
        // Usar proxy serverless interno para evitar CORS y mantener el API key fuera del navegador.
        const proxyUrl = `/api/consulta-cedula?Cedula=${encodeURIComponent(cedula)}`;

        console.log('Fetching via Internal Proxy:', proxyUrl);

        const response = await fetch(proxyUrl);

        console.log('Response status:', response.status);

        if (!response.ok) {
            let detalle = response.statusText;
            try {
                const errorData = await response.json();
                detalle = errorData?.error || errorData?.details || detalle;
            } catch {
                // Mantener statusText si el cuerpo no es JSON.
            }
            throw new Error(`No se pudo consultar la API de cédula (${response.status}): ${detalle}`);
        }

        const data: any = await response.json();
        console.log('Respuesta API Registro Civil:', data);

        // Soportar tanto camelCase como PascalCase (que es común en APIs .NET)
        const nombreCompleto = data.nombre || data.Nombre;
        const fechaNacimiento = data.fechaNacimiento || data.FechaNacimiento;
        const genero = data.genero || data.Genero;
        const estadoCivil = data.estadoCivil || data.EstadoCivil;
        const nacionalidad = data.nacionalidad || data.Nacionalidad;
        const lugarNacimiento = data.lugarNacimiento || data.LugarNacimiento;
        const instruccion = data.instruccion || data.Instruccion;
        const profesion = data.profesion || data.Profesion;
        const lugarDomicilio = data.lugarDomicilio || data.LugarDomicilio;
        const calleDomicilio = data.calleDomicilio || data.CalleDomicilio;
        const numeracionDomicilio = data.numeracionDomicilio || data.NumeracionDomicilio;

        if (!nombreCompleto && !fechaNacimiento) {
            // Respuesta vacía o inválida
            console.warn('Datos vacíos en respuesta API', data);
            return null;
        }

        const { nombres, apellidos } = parsearNombre(nombreCompleto);

        // Construir dirección
        const direccionPartes = [lugarDomicilio, calleDomicilio, numeracionDomicilio].filter(Boolean);
        const direccion = direccionPartes.join(', ');
        const residencia = parsearUbicacion(lugarDomicilio);

        return {
            nombres,
            apellidos,
            fecha_nacimiento: parsearFecha(fechaNacimiento),
            sexo: parsearGenero(genero),
            direccion,
            estado_civil: parsearEstadoCivil(estadoCivil),
            nacionalidad: nacionalidad || '',
            lugar_nacimiento: lugarNacimiento || '',
            nivel_educacion: instruccion || '',
            ocupacion_profesion: profesion || '',
            provincia: residencia.provincia,
            canton: residencia.canton,
            parroquia: residencia.parroquia,
            barrio_sector: residencia.parroquia,
            calle_principal: calleDomicilio || '',
            referencia_domicilio: numeracionDomicilio || ''
        };

    } catch (error) {
        console.error('Error al consultar registro civil:', error);
        throw error;
    }
};
