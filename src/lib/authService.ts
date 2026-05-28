// Servicio de autenticación con Supabase
import { supabase } from './supabase';

// Interfaz de Usuario (exportada para uso en toda la app)
export interface Usuario {
  id_usuario: number;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  tipo_usuario: 'medico' | 'administrativo' | 'enfermera' | 'secretaria' | 'USUARIO_IMANGE' | 'GESTOR_IMAGEN';
  telefono: string;
  cedula_profesional: string;
  estado: 'activo' | 'inactivo';
  created_at?: string;
}

// Interfaz de Asignación Completa (exportada para uso en toda la app)
export interface AsignacionCompleta {
  id_usuario_sucursal: number;
  id_usuario: number;
  id_sucursal: number;
  id_servicio: number | null;
  id_especialidad: number | null;
  especialidad: string;
  cargo: string | null;
  estado: 'activo' | 'inactivo';
  usuario?: {
    id_usuario: number;
    nombre: string;
    apellido: string;
    email: string;
    tipo_usuario: string;
  };
  sucursal: {
    id_sucursal: number;
    nombre: string;
    direccion: string;
    telefono: string;
    id_compania: number;
    estado: 'activo' | 'inactivo';
  };
  servicio?: {
    id_servicio: number;
    descripcion: string;
    area: string;
    estado: 'activo' | 'inactivo';
  } | null;
  compania: {
    id_compania: number;
    nombre: string;
    direccion: string;
    telefono: string;
    estado: 'activo' | 'inactivo';
  };
}

// Interfaz de respuesta del usuario desde Supabase
interface UsuarioSupabase {
  id_usuario: number;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  tipo_usuario: 'medico' | 'administrativo' | 'enfermera' | 'secretaria' | 'USUARIO_IMANGE' | 'GESTOR_IMAGEN';
  telefono: string | null;
  cedula_profesional: string | null;
  activo: boolean;
  created_at: string;
}

// Interfaz de asignación desde Supabase
interface AsignacionSupabase {
  id_usuario_sucursal: number;
  id_usuario: number;
  id_sucursal: number;
  id_servicio: number | null;
  especialidad: string | null;
  id_especialidad: number | null;
  activo: boolean;
  sucursal: {
    id_sucursal: number;
    nombre: string;
    direccion: string;
    telefono: string | null;
    id_compania: number;
    activo: boolean;
    compania: {
      id_compania: number;
      nombre: string;
      direccion: string;
      telefono: string | null;
      activo: boolean;
    };
  };
  servicio?: {
    id_servicio: number;
    descripcion: string;
    area: string;
    estado: 'activo' | 'inactivo';
  } | null;
}

async function getServiciosByIds(ids: number[]): Promise<Map<number, AsignacionCompleta['servicio']>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const serviciosPorId = new Map<number, AsignacionCompleta['servicio']>();

  if (uniqueIds.length === 0) return serviciosPorId;

  const { data, error } = await supabase
    .from('servicio' as any)
    .select('id_servicio, descripcion, area, estado')
    .in('id_servicio', uniqueIds);

  if (error) {
    console.error('❌ Error al buscar servicios:', error);
    return serviciosPorId;
  }

  (data || []).forEach((servicio: any) => {
    serviciosPorId.set(servicio.id_servicio, {
      id_servicio: servicio.id_servicio,
      descripcion: servicio.descripcion,
      area: servicio.area,
      estado: servicio.estado
    });
  });

  return serviciosPorId;
}

function mapServicio(
  idServicio: number | null | undefined,
  serviciosPorId: Map<number, AsignacionCompleta['servicio']>
) {
  return idServicio ? serviciosPorId.get(idServicio) || null : null;
}

/**
 * Buscar usuario por email en Supabase
 */
export async function getUsuarioByEmail(email: string): Promise<Usuario | null> {
  try {
    const { data, error } = await (supabase
      .from('usuario')
      .select('*')
      .eq('email', email)
      .eq('estado', 'activo')
      .maybeSingle() as any);

    if (error) {
      return null;
    }

    if (!data) {
      console.log('❌ Usuario no encontrado');
      return null;
    }

    // Convertir a formato esperado por la aplicación
    const usuario: Usuario = {
      id_usuario: data.id_usuario,
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      password: data.password,
      tipo_usuario: data.tipo_usuario,
      telefono: data.telefono || '',
      cedula_profesional: data.cedula || '',
      estado: data.estado,
      created_at: data.created_at
    };

    return usuario;
  } catch (error) {
    console.error('❌ Error inesperado al buscar usuario:', error);
    return null;
  }
}

/**
 * Obtener todas las asignaciones completas de un usuario
 */
export async function getAsignacionesCompletasByUsuario(
  id_usuario: number
): Promise<AsignacionCompleta[]> {
  try {
    console.log('🔍 Buscando asignaciones para usuario ID:', id_usuario);

    const { data, error } = await (supabase
      .from('usuario_sucursal')
      .select(`
        id_usuario_sucursal,
        id_usuario,
        id_sucursal,
        id_servicio,
        id_especialidad,
        especialidad,
        cargo,
        estado,
        sucursal:sucursal!inner (
          id_sucursal,
          nombre,
          direccion,
          telefono,
          id_compania,
          estado,
          compania:compania!inner (
            id_compania,
            nombre,
            direccion,
            telefono,
            estado
          )
        )
      `)
      .eq('id_usuario', id_usuario)
      .eq('estado', 'activo') as any);

    if (error) {
      console.error('❌ Error al buscar asignaciones:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('⚠️ No se encontraron asignaciones para el usuario');
      return [];
    }

    console.log(`✅ Se encontraron ${data.length} asignaciones`);
    const serviciosPorId = await getServiciosByIds(
      data.map((asig: any) => asig.id_servicio).filter(Boolean)
    );

    // Convertir al formato esperado
    const asignaciones: AsignacionCompleta[] = data.map((asig: any) => ({
      id_usuario_sucursal: asig.id_usuario_sucursal,
      id_usuario: asig.id_usuario,
      id_sucursal: asig.id_sucursal,
      id_servicio: asig.id_servicio ?? null,
      id_especialidad: asig.id_especialidad,
      especialidad: asig.especialidad || 'Sin especialidad',
      cargo: asig.cargo || null,
      estado: asig.estado,
      sucursal: {
        id_sucursal: asig.sucursal.id_sucursal,
        nombre: asig.sucursal.nombre,
        direccion: asig.sucursal.direccion,
        telefono: asig.sucursal.telefono || '',
        id_compania: asig.sucursal.id_compania,
        estado: asig.sucursal.estado
      },
      servicio: mapServicio(asig.id_servicio, serviciosPorId),
      compania: {
        id_compania: asig.sucursal.compania.id_compania,
        nombre: asig.sucursal.compania.nombre,
        direccion: asig.sucursal.compania.direccion,
        telefono: asig.sucursal.compania.telefono || '',
        estado: asig.sucursal.compania.estado
      }
    }));

    return asignaciones;
  } catch (error) {
    console.error('❌ Error inesperado al buscar asignaciones:', error);
    return [];
  }
}

/**
 * Obtener todos los servicios como opciones de ingreso para usuarios administrativos.
 */
export async function getOpcionesIngresoAdministrador(
  usuario: Usuario,
  asignacionesBase: AsignacionCompleta[]
): Promise<AsignacionCompleta[]> {
  try {
    const asignacionBase = asignacionesBase[0];

    if (!asignacionBase) {
      return [];
    }

    const { data, error } = await (supabase
      .from('servicio' as any)
      .select(`
        id_servicio,
        id_sucursal,
        descripcion,
        area,
        estado,
        sucursal:sucursal!inner (
          id_sucursal,
          nombre,
          direccion,
          telefono,
          id_compania,
          estado,
          compania:compania!inner (
            id_compania,
            nombre,
            direccion,
            telefono,
            estado
          )
        )
      `)
      .eq('estado', 'activo')
      .order('area', { ascending: true })
      .order('descripcion', { ascending: true }) as any);

    if (error) {
      console.error('❌ Error al buscar servicios para administrador:', error);
      return asignacionesBase;
    }

    if (!data || data.length === 0) {
      return asignacionesBase;
    }

    const asignacionesPorSucursal = new Map<number, AsignacionCompleta>();
    asignacionesBase.forEach(asignacion => {
      asignacionesPorSucursal.set(asignacion.id_sucursal, asignacion);
    });

    return data.map((servicio: any) => {
      const asignacionSucursal = asignacionesPorSucursal.get(servicio.id_sucursal) || asignacionBase;

      return {
        id_usuario_sucursal: asignacionSucursal.id_usuario_sucursal,
        id_usuario: usuario.id_usuario,
        id_sucursal: servicio.id_sucursal,
        id_servicio: servicio.id_servicio,
        id_especialidad: asignacionSucursal.id_especialidad,
        especialidad: asignacionSucursal.especialidad || 'Sin especialidad',
        cargo: asignacionSucursal.cargo,
        estado: 'activo',
        sucursal: {
          id_sucursal: servicio.sucursal.id_sucursal,
          nombre: servicio.sucursal.nombre,
          direccion: servicio.sucursal.direccion,
          telefono: servicio.sucursal.telefono || '',
          id_compania: servicio.sucursal.id_compania,
          estado: servicio.sucursal.estado
        },
        servicio: {
          id_servicio: servicio.id_servicio,
          descripcion: servicio.descripcion,
          area: servicio.area,
          estado: servicio.estado
        },
        compania: {
          id_compania: servicio.sucursal.compania.id_compania,
          nombre: servicio.sucursal.compania.nombre,
          direccion: servicio.sucursal.compania.direccion,
          telefono: servicio.sucursal.compania.telefono || '',
          estado: servicio.sucursal.compania.estado
        }
      };
    });
  } catch (error) {
    console.error('❌ Error inesperado al buscar servicios para administrador:', error);
    return asignacionesBase;
  }
}

/**
 * Validar credenciales de usuario
 */
export async function validateCredentials(
  email: string,
  password: string
): Promise<{ success: boolean; usuario?: Usuario; message?: string }> {
  try {
    // Buscar usuario
    const usuario = await getUsuarioByEmail(email);

    if (!usuario) {
      return {
        success: false,
        message: 'Usuario no encontrado'
      };
    }

    // Validar contraseña (en producción deberías usar hash)
    if (usuario.password !== password) {
      return {
        success: false,
        message: 'Contraseña incorrecta'
      };
    }

    return {
      success: true,
      usuario
    };
  } catch (error) {
    console.error('❌ Error al validar credenciales:', error);
    return {
      success: false,
      message: 'Error al validar credenciales'
    };
  }
}

/**
 * Obtener todas las sucursales de una compañía
 */
export async function getSucursalesByCompania(id_compania: number) {
  try {
    console.log('🔍 Buscando sucursales para compañía ID:', id_compania);

    const { data, error } = await (supabase
      .from('sucursal')
      .select('*')
      .eq('id_compania', id_compania)
      .eq('estado', 'activo')
      .order('nombre') as any);

    if (error) {
      console.error('❌ Error al buscar sucursales:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} sucursales`);
    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado al buscar sucursales:', error);
    return [];
  }
}

/**
 * Obtener médicos (usuarios con asignaciones) de una sucursal específica
 */
export async function getMedicosBySucursal(id_sucursal: number): Promise<AsignacionCompleta[]> {
  try {
    console.log('🔍 Buscando médicos para sucursal ID:', id_sucursal);

    const { data, error } = await (supabase
      .from('usuario_sucursal')
      .select(`
        id_usuario_sucursal,
        id_usuario,
        id_sucursal,
        id_servicio,
        id_especialidad,
        especialidad,
        cargo,
        estado,
        usuario:usuario!inner (
          id_usuario,
          nombre,
          apellido,
          email,
          tipo_usuario,
          telefono,
          cedula,
          estado
        ),
        sucursal:sucursal!inner (
          id_sucursal,
          nombre,
          direccion,
          telefono,
          id_compania,
          estado,
          compania:compania!inner (
            id_compania,
            nombre,
            direccion,
            telefono,
            estado
          )
        )
      `)
      .eq('id_sucursal', id_sucursal)
      .eq('estado', 'activo')
      .eq('usuario.tipo_usuario', 'medico')
      .eq('usuario.estado', 'activo') as any);

    if (error) {
      console.error('❌ Error al buscar médicos:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('⚠️ No se encontraron médicos para la sucursal');
      return [];
    }

    console.log(`✅ Se encontraron ${data.length} médicos`);
    const serviciosPorId = await getServiciosByIds(
      data.map((asig: any) => asig.id_servicio).filter(Boolean)
    );

    const idsEspecialidad = [
      ...new Set(
        data
          .map((asig: any) => asig.id_especialidad)
          .filter((id: number | null): id is number => Boolean(id))
      ),
    ];

    const especialidadesPorId = new Map<number, string>();
    if (idsEspecialidad.length > 0) {
      const { data: especialidadesData, error: especialidadesError } = await supabase
        .from('especialidad')
        .select('id_especialidad, nombre')
        .in('id_especialidad', idsEspecialidad);

      if (especialidadesError) {
        console.error('❌ Error al buscar nombres de especialidades:', especialidadesError);
      } else {
        (especialidadesData || []).forEach((esp: any) => {
          especialidadesPorId.set(esp.id_especialidad, esp.nombre);
        });
      }
    }

    // Convertir al formato esperado
    const medicos: AsignacionCompleta[] = data.map((asig: any) => ({
      id_usuario_sucursal: asig.id_usuario_sucursal,
      id_usuario: asig.id_usuario,
      id_sucursal: asig.id_sucursal,
      id_servicio: asig.id_servicio ?? null,
      id_especialidad: asig.id_especialidad,
      especialidad: asig.especialidad || especialidadesPorId.get(asig.id_especialidad) || 'Sin especialidad',
      cargo: asig.cargo || null,
      estado: asig.estado,
      usuario: {
        id_usuario: asig.usuario.id_usuario,
        nombre: asig.usuario.nombre,
        apellido: asig.usuario.apellido,
        email: asig.usuario.email,
        tipo_usuario: asig.usuario.tipo_usuario
      },
      servicio: mapServicio(asig.id_servicio, serviciosPorId),
      sucursal: {
        id_sucursal: asig.sucursal.id_sucursal,
        nombre: asig.sucursal.nombre,
        direccion: asig.sucursal.direccion,
        telefono: asig.sucursal.telefono || '',
        id_compania: asig.sucursal.id_compania,
        estado: asig.sucursal.estado
      },
      compania: {
        id_compania: asig.sucursal.compania.id_compania,
        nombre: asig.sucursal.compania.nombre,
        direccion: asig.sucursal.compania.direccion,
        telefono: asig.sucursal.compania.telefono || '',
        estado: asig.sucursal.compania.estado
      }
    }));

    return medicos;
  } catch (error) {
    console.error('❌ Error inesperado al buscar médicos:', error);
    return [];
  }
}
