// Servicio de configuraciones del sistema con Supabase
import { supabaseAdmin } from './supabase';  // ⚡ Cambio: usar supabaseAdmin para bypasear RLS

// ========================================
// INTERFACES - COMPAÑÍAS
// ========================================

export interface Compania {
  id_compania: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  logo_url: string | null;
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
}

// ========================================
// INTERFACES - SUCURSALES
// ========================================

export interface Sucursal {
  id_sucursal: number;
  id_compania: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
  compania?: Compania;
}

// ========================================
// INTERFACES - CONSULTORIOS
// ========================================

export interface Consultorio {
  id_consultorio: number;
  id_sucursal: number;
  nombre: string;
  piso: string | null;
  numero: string | null;
  capacidad: number | null;
  equipamiento: string | null;
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
  sucursal?: Sucursal;
}

// ========================================
// INTERFACES - SERVICIOS
// ========================================

export interface Servicio {
  id_servicio: number;
  id_sucursal: number;
  descripcion: string;
  area: string;
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
  sucursal?: Sucursal;
}

// ========================================
// INTERFACES - USUARIOS
// ========================================

export type TipoUsuario = 'medico' | 'administrativo' | 'enfermera' | 'secretaria' | 'USUARIO_IMANGE' | 'GESTOR_IMAGEN';

export interface Usuario {
  id_usuario: number;
  nombre: string;
  apellido: string;
  cedula: string;
  email: string;
  telefono: string | null;
  password: string;
  tipo_usuario: TipoUsuario;
  fecha_ingreso: string;
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
}

// ========================================
// INTERFACES - USUARIO_SUCURSAL
// ========================================

export interface UsuarioSucursal {
  id_usuario_sucursal: number;
  id_usuario: number;
  id_sucursal: number;
  id_servicio?: number | null;
  id_especialidad: number | null;
  especialidad: string | null; // Deprecated
  cargo: string | null;
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
  usuario?: Usuario;
  sucursal?: Sucursal;
  servicio?: Servicio;
  especialidad_data?: Especialidad;
}

// ========================================
// INTERFACES - PRECIOS
// ========================================

export interface PrecioBase {
  id_precio_base: number;
  id_compania: number;
  cargo: string;
  precio_consulta: number;
  precio_control: number;
  precio_emergencia: number;
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
}

export interface PrecioUsuario {
  id_precio: number;
  id_usuario_sucursal: number;
  precio_consulta: number;
  precio_control: number;
  precio_emergencia: number;
  tipo_ajuste: string;
  valor_ajuste: number;
  duracion_consulta: number;
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
  usuario_sucursal?: UsuarioSucursal;
}

// ========================================
// INTERFACES - HORARIOS Y ASIGNACIONES
// ========================================

export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

export interface AsignacionConsultorio {
  id_asignacion: number;
  id_usuario_sucursal: number;
  id_consultorio: number;
  dia_semana: number; // Revertido a number (0=domingo, 1=lunes, 2=martes, etc.)
  hora_inicio: string;
  hora_fin: string;
  duracion_consulta: number; // Duración de la consulta en minutos
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
  usuario_sucursal?: UsuarioSucursal;
  consultorio?: Consultorio;
}

// ========================================
// INTERFACES - ESPECIALIDADES
// ========================================

export interface Especialidad {
  id_especialidad: number;
  nombre: string;
  descripcion: string | null;
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
}

// ========================================
// INTERFACES - ASEGURADORAS
// ========================================

export interface Aseguradora {
  id_aseguradora: number;
  nombre: string;
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
}

// ========================================
// FUNCIONES - COMPAÑÍAS
// ========================================

export async function getAllCompanias(): Promise<Compania[]> {
  try {
    console.log('🏢 Obteniendo compañías...');
    const { data, error } = await supabaseAdmin
      .from('compania')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener compañías:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} compañías`);
    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function createCompania(compania: Omit<Compania, 'id_compania' | 'created_at'>): Promise<Compania | null> {
  try {
    console.log('➕ Creando compañía:', compania.nombre);
    const { data, error } = await (supabaseAdmin
      .from('compania') as any)
      .insert(compania as any)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear compañía:', error);
      return null;
    }

    console.log('✅ Compañía creada exitosamente');
    return data;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return null;
  }
}

export async function updateCompania(idCompania: number, updates: Partial<Compania>): Promise<boolean> {
  try {
    console.log('✏️ Actualizando compañía ID:', idCompania);
    const { error } = await (supabaseAdmin
      .from('compania') as any)
      .update(updates as any)
      .eq('id_compania', idCompania);

    if (error) {
      console.error('❌ Error al actualizar compañía:', error);
      return false;
    }

    console.log('✅ Compañía actualizada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

export async function deleteCompania(idCompania: number): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando compañía ID:', idCompania);
    const { error } = await (supabaseAdmin
      .from('compania') as any)
      .delete()
      .eq('id_compania', idCompania);

    if (error) {
      console.error('❌ Error al eliminar compañía:', error);
      return false;
    }

    console.log('✅ Compañía eliminada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// ========================================
// FUNCIONES - SUCURSALES
// ========================================

export async function getAllSucursales(): Promise<Sucursal[]> {
  try {
    console.log('🏥 Obteniendo sucursales...');
    const { data, error } = await (supabaseAdmin
      .from('sucursal') as any)
      .select(`
        *,
        compania:compania!inner(*)
      `)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener sucursales:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} sucursales`);
    return data as any || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function getSucursalesByCompania(idCompania: number): Promise<Sucursal[]> {
  try {
    console.log('🏥 Obteniendo sucursales de compañía:', idCompania);
    const { data, error } = await (supabaseAdmin
      .from('sucursal') as any)
      .select(`
        *,
        compania:compania!inner(*)
      `)
      .eq('id_compania', idCompania)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener sucursales:', error);
      return [];
    }

    return data as any || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function createSucursal(sucursal: Omit<Sucursal, 'id_sucursal' | 'created_at'>): Promise<Sucursal | null> {
  try {
    console.log('➕ Creando sucursal:', sucursal.nombre);
    const { data, error } = await (supabaseAdmin
      .from('sucursal') as any)
      .insert(sucursal as any)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear sucursal:', error);
      return null;
    }

    console.log('✅ Sucursal creada exitosamente');
    return data;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return null;
  }
}

export async function updateSucursal(idSucursal: number, updates: Partial<Sucursal>): Promise<boolean> {
  try {
    console.log('✏️ Actualizando sucursal ID:', idSucursal);
    const { error } = await (supabaseAdmin
      .from('sucursal') as any)
      .update(updates as any)
      .eq('id_sucursal', idSucursal);

    if (error) {
      console.error('❌ Error al actualizar sucursal:', error);
      return false;
    }

    console.log('✅ Sucursal actualizada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

export async function deleteSucursal(idSucursal: number): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando sucursal ID:', idSucursal);
    const { error } = await (supabaseAdmin
      .from('sucursal') as any)
      .delete()
      .eq('id_sucursal', idSucursal);

    if (error) {
      console.error('❌ Error al eliminar sucursal:', error);
      return false;
    }

    console.log('✅ Sucursal eliminada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// ========================================
// FUNCIONES - CONSULTORIOS
// ========================================

export async function getAllConsultorios(): Promise<Consultorio[]> {
  try {
    console.log('🚪 Obteniendo consultorios...');
    const { data, error } = await (supabaseAdmin
      .from('consultorio') as any)
      .select(`
        *,
        sucursal:sucursal!inner(
          *,
          compania:compania(*)
        )
      `)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener consultorios:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} consultorios`);
    return data as any || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function getConsultoriosBySucursal(idSucursal: number): Promise<Consultorio[]> {
  try {
    console.log('🚪 Obteniendo consultorios de sucursal:', idSucursal);
    const { data, error } = await (supabaseAdmin
      .from('consultorio') as any)
      .select('*')
      .eq('id_sucursal', idSucursal)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener consultorios:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function createConsultorio(consultorio: Omit<Consultorio, 'id_consultorio' | 'created_at'>): Promise<Consultorio | null> {
  try {
    console.log('➕ Creando consultorio:', consultorio.nombre);
    const { data, error } = await (supabaseAdmin
      .from('consultorio') as any)
      .insert(consultorio as any)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear consultorio:', error);
      return null;
    }

    console.log('✅ Consultorio creado exitosamente');
    return data;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return null;
  }
}

export async function updateConsultorio(idConsultorio: number, updates: Partial<Consultorio>): Promise<boolean> {
  try {
    console.log('✏️ Actualizando consultorio ID:', idConsultorio);
    const { error } = await (supabaseAdmin
      .from('consultorio') as any)
      .update(updates as any)
      .eq('id_consultorio', idConsultorio);

    if (error) {
      console.error('❌ Error al actualizar consultorio:', error);
      return false;
    }

    console.log('✅ Consultorio actualizado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

export async function deleteConsultorio(idConsultorio: number): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando consultorio ID:', idConsultorio);
    const { error } = await (supabaseAdmin
      .from('consultorio') as any)
      .delete()
      .eq('id_consultorio', idConsultorio);

    if (error) {
      console.error('❌ Error al eliminar consultorio:', error);
      return false;
    }

    console.log('✅ Consultorio eliminado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// ========================================
// FUNCIONES - SERVICIOS
// ========================================

export async function getAllServicios(): Promise<Servicio[]> {
  try {
    console.log('🧾 Obteniendo servicios...');
    const { data, error } = await (supabaseAdmin
      .from('servicio') as any)
      .select(`
        *,
        sucursal:sucursal!inner(
          *,
          compania:compania(*)
        )
      `)
      .order('area', { ascending: true })
      .order('descripcion', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener servicios:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} servicios`);
    return data as any || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function getServiciosBySucursal(idSucursal: number): Promise<Servicio[]> {
  try {
    console.log('🧾 Obteniendo servicios de sucursal:', idSucursal);
    const { data, error } = await (supabaseAdmin
      .from('servicio') as any)
      .select('*')
      .eq('id_sucursal', idSucursal)
      .order('area', { ascending: true })
      .order('descripcion', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener servicios:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function createServicio(servicio: Omit<Servicio, 'id_servicio' | 'created_at'>): Promise<Servicio | null> {
  try {
    console.log('➕ Creando servicio:', servicio.descripcion);
    const { data, error } = await (supabaseAdmin
      .from('servicio') as any)
      .insert(servicio as any)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear servicio:', error);
      return null;
    }

    console.log('✅ Servicio creado exitosamente');
    return data;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return null;
  }
}

export async function updateServicio(idServicio: number, updates: Partial<Servicio>): Promise<boolean> {
  try {
    console.log('✏️ Actualizando servicio ID:', idServicio);
    const { error } = await (supabaseAdmin
      .from('servicio') as any)
      .update(updates as any)
      .eq('id_servicio', idServicio);

    if (error) {
      console.error('❌ Error al actualizar servicio:', error);
      return false;
    }

    console.log('✅ Servicio actualizado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

export async function deleteServicio(idServicio: number): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando servicio ID:', idServicio);
    const { error } = await (supabaseAdmin
      .from('servicio') as any)
      .delete()
      .eq('id_servicio', idServicio);

    if (error) {
      console.error('❌ Error al eliminar servicio:', error);
      return false;
    }

    console.log('✅ Servicio eliminado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// ========================================
// FUNCIONES - ESPECIALIDADES
// ========================================

export async function getAllEspecialidades(): Promise<Especialidad[]> {
  try {
    console.log('🩺 Obteniendo especialidades...');
    const { data, error } = await (supabaseAdmin
      .from('especialidad') as any)
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener especialidades:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} especialidades`);
    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function createEspecialidad(especialidad: Omit<Especialidad, 'id_especialidad' | 'created_at'>): Promise<Especialidad | null> {
  try {
    console.log('➕ Creando especialidad:', especialidad.nombre);
    const { data, error } = await (supabaseAdmin
      .from('especialidad') as any)
      .insert(especialidad as any)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear especialidad:', error);
      return null;
    }

    console.log('✅ Especialidad creada exitosamente');
    return data;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return null;
  }
}

export async function updateEspecialidad(idEspecialidad: number, updates: Partial<Especialidad>): Promise<boolean> {
  try {
    console.log('✏️ Actualizando especialidad ID:', idEspecialidad);
    const { error } = await (supabaseAdmin
      .from('especialidad') as any)
      .update(updates as any)
      .eq('id_especialidad', idEspecialidad);

    if (error) {
      console.error('❌ Error al actualizar especialidad:', error);
      return false;
    }

    console.log('✅ Especialidad actualizada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

export async function deleteEspecialidad(idEspecialidad: number): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando especialidad ID:', idEspecialidad);
    const { error } = await (supabaseAdmin
      .from('especialidad') as any)
      .delete()
      .eq('id_especialidad', idEspecialidad);

    if (error) {
      console.error('❌ Error al eliminar especialidad:', error);
      return false;
    }

    console.log('✅ Especialidad eliminada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// ========================================
// FUNCIONES - ASEGURADORAS
// ========================================

export async function getAllAseguradoras(): Promise<Aseguradora[]> {
  try {
    console.log('🛡️ Obteniendo aseguradoras...');
    const { data, error } = await supabaseAdmin
      .from('aseguradora' as any)
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener aseguradoras:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} aseguradoras`);
    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

// ========================================
// FUNCIONES - USUARIOS
// ========================================

export async function getAllUsuarios(): Promise<Usuario[]> {
  try {
    console.log('👥 Obteniendo usuarios...');
    const { data, error } = await (supabaseAdmin
      .from('usuario') as any)
      .select('*')
      .order('apellido', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener usuarios:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} usuarios`);
    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function getUsuariosByTipo(tipoUsuario: TipoUsuario): Promise<Usuario[]> {
  try {
    console.log('👥 Obteniendo usuarios tipo:', tipoUsuario);
    const { data, error } = await (supabaseAdmin
      .from('usuario') as any)
      .select('*')
      .eq('tipo_usuario', tipoUsuario)
      .order('apellido', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener usuarios:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function createUsuario(usuario: Omit<Usuario, 'id_usuario' | 'created_at'>): Promise<Usuario | null> {
  try {
    console.log('➕ Creando usuario:', usuario.email);
    const { data, error } = await (supabaseAdmin
      .from('usuario') as any)
      .insert(usuario as any)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear usuario:', error);

      // Manejo específico de errores
      if (error.code === '23505') {
        // Constraint único violado
        if (error.message.includes('cedula')) {
          throw new Error('La cédula ya está registrada en el sistema');
        } else if (error.message.includes('email')) {
          throw new Error('El email ya está registrado en el sistema');
        } else {
          throw new Error('Ya existe un registro con estos datos');
        }
      }

      throw new Error('Error al crear el usuario');
    }

    console.log('✅ Usuario creado exitosamente');
    return data;
  } catch (error: any) {
    console.error('❌ Error inesperado:', error);
    throw error; // Re-lanzar el error para que sea manejado en el componente
  }
}

export async function updateUsuario(idUsuario: number, updates: Partial<Usuario>): Promise<boolean> {
  try {
    console.log('✏️ Actualizando usuario ID:', idUsuario);
    const { error } = await (supabaseAdmin
      .from('usuario') as any)
      .update(updates as any)
      .eq('id_usuario', idUsuario);

    if (error) {
      console.error('❌ Error al actualizar usuario:', error);
      return false;
    }

    console.log('✅ Usuario actualizado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

export async function deleteUsuario(idUsuario: number): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando usuario ID:', idUsuario);
    const { error } = await (supabaseAdmin
      .from('usuario') as any)
      .delete()
      .eq('id_usuario', idUsuario);

    if (error) {
      console.error('❌ Error al eliminar usuario:', error);
      return false;
    }

    console.log('✅ Usuario eliminado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// ========================================
// FUNCIONES - USUARIO_SUCURSAL (Asignaciones)
// ========================================

export async function getAllUsuarioSucursales(): Promise<UsuarioSucursal[]> {
  try {
    console.log('🔗 Obteniendo asignaciones usuario-sucursal...');
    let { data, error } = await (supabaseAdmin
      .from('usuario_sucursal') as any)
      .select(`
        *,
        usuario:usuario!inner(*),
        sucursal:sucursal!inner(
          *,
          compania:compania(*)
        ),
        servicio:servicio(*),
        especialidad_data:especialidad(*)
      `)
      .order('id_usuario_sucursal', { ascending: false });

    if (error) {
      console.warn('⚠️ Error al obtener asignaciones con servicio, reintentando sin relación servicio:', error);
      const fallback = await (supabaseAdmin
        .from('usuario_sucursal') as any)
        .select(`
          *,
          usuario:usuario!inner(*),
          sucursal:sucursal!inner(
            *,
            compania:compania(*)
          ),
          especialidad_data:especialidad(*)
        `)
        .order('id_usuario_sucursal', { ascending: false });

      data = fallback.data;
      error = fallback.error;

      if (error) {
        console.error('❌ Error al obtener asignaciones:', error);
        return [];
      }
    }

    console.log(`✅ Se encontraron ${data?.length || 0} asignaciones`);
    return data as any || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function getUsuarioSucursalesByUsuario(idUsuario: number): Promise<UsuarioSucursal[]> {
  try {
    console.log('🔗 Obteniendo asignaciones del usuario:', idUsuario);
    let { data, error } = await (supabaseAdmin
      .from('usuario_sucursal') as any)
      .select(`
        *,
        sucursal:sucursal!inner(*),
        servicio:servicio(*),
        especialidad_data:especialidad(*)
      `)
      .eq('id_usuario', idUsuario);

    if (error) {
      console.warn('⚠️ Error al obtener asignaciones del usuario con servicio, reintentando sin relación servicio:', error);
      const fallback = await (supabaseAdmin
        .from('usuario_sucursal') as any)
        .select(`
          *,
          sucursal:sucursal!inner(*),
          especialidad_data:especialidad(*)
        `)
        .eq('id_usuario', idUsuario);

      data = fallback.data;
      error = fallback.error;

      if (error) {
        console.error('❌ Error al obtener asignaciones:', error);
        return [];
      }
    }

    return data as any || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function createUsuarioSucursal(asignacion: Omit<UsuarioSucursal, 'id_usuario_sucursal' | 'created_at'>): Promise<UsuarioSucursal | null> {
  try {
    console.log('➕ Creando asignación usuario-sucursal');
    const { data, error } = await (supabaseAdmin
      .from('usuario_sucursal') as any)
      .insert(asignacion as any)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear asignación:', error);
      return null;
    }

    console.log('✅ Asignación creada exitosamente');
    return data;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return null;
  }
}

export async function updateUsuarioSucursal(idUsuarioSucursal: number, updates: Partial<UsuarioSucursal>): Promise<boolean> {
  try {
    console.log('✏️ Actualizando asignación ID:', idUsuarioSucursal);
    const { error } = await (supabaseAdmin
      .from('usuario_sucursal') as any)
      .update(updates as any)
      .eq('id_usuario_sucursal', idUsuarioSucursal);

    if (error) {
      console.error('❌ Error al actualizar asignación:', error);
      return false;
    }

    console.log('✅ Asignación actualizada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

export async function updateUsuarioSucursalOrThrow(idUsuarioSucursal: number, updates: Partial<UsuarioSucursal>): Promise<void> {
  console.log('✏️ Actualizando asignación ID:', idUsuarioSucursal);
  const { error } = await (supabaseAdmin
    .from('usuario_sucursal') as any)
    .update(updates as any)
    .eq('id_usuario_sucursal', idUsuarioSucursal);

  if (error) {
    console.error('❌ Error al actualizar asignación:', error);
    throw new Error(error.message || 'Error al actualizar la asignación');
  }

  console.log('✅ Asignación actualizada exitosamente');
}

export async function deleteUsuarioSucursal(idUsuarioSucursal: number): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando asignación ID:', idUsuarioSucursal);
    const { error } = await (supabaseAdmin
      .from('usuario_sucursal') as any)
      .delete()
      .eq('id_usuario_sucursal', idUsuarioSucursal);

    if (error) {
      console.error('❌ Error al eliminar asignación:', error);
      return false;
    }

    console.log('✅ Asignación eliminada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// ========================================
// FUNCIONES - PRECIOS BASE
// ========================================

export async function getAllPreciosBase(): Promise<PrecioBase[]> {
  try {
    console.log('💰 Obteniendo precios base...');
    const { data, error } = await (supabaseAdmin
      .from('precio_base_especialidad') as any)
      .select('*')
      .order('cargo', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener precios base:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} precios base`);
    return data as any || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function createPrecioBase(precio: Omit<PrecioBase, 'id_precio_base' | 'created_at'>): Promise<PrecioBase | null> {
  try {
    console.log('➕ Creando precio base:', precio.cargo);
    const { data, error } = await (supabaseAdmin
      .from('precio_base_especialidad') as any)
      .insert(precio as any)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear precio base:', error);
      return null;
    }

    console.log('✅ Precio base creado exitosamente');
    return data;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return null;
  }
}

export async function updatePrecioBase(idPrecioBase: number, updates: Partial<PrecioBase>): Promise<boolean> {
  try {
    console.log('✏️ Actualizando precio base ID:', idPrecioBase);
    const { error } = await (supabaseAdmin
      .from('precio_base_especialidad') as any)
      .update(updates as any)
      .eq('id_precio_base', idPrecioBase);

    if (error) {
      console.error('❌ Error al actualizar precio base:', error);
      return false;
    }

    console.log('✅ Precio base actualizado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

export async function deletePrecioBase(idPrecioBase: number): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando precio base ID:', idPrecioBase);
    const { error } = await (supabaseAdmin
      .from('precio_base_especialidad') as any)
      .delete()
      .eq('id_precio_base', idPrecioBase);

    if (error) {
      console.error('❌ Error al eliminar precio base:', error);
      return false;
    }

    console.log('✅ Precio base eliminado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// ========================================
// FUNCIONES - PRECIOS USUARIO
// ========================================

export async function getAllPreciosUsuario(): Promise<PrecioUsuario[]> {
  try {
    console.log('💵 Obteniendo precios por usuario...');
    const { data, error } = await (supabaseAdmin
      .from('precio_usuario_sucursal') as any)
      .select(`
        *,
        usuario_sucursal:usuario_sucursal!inner(
          *,
          usuario:usuario(*),
          sucursal:sucursal(
            *,
            compania:compania(*)
          )
        )
      `);

    if (error) {
      console.error('❌ Error al obtener precios usuario:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} precios usuario`);
    return data as any || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function getDuracionByUsuarioSucursal(idUsuarioSucursal: number): Promise<number | null> {
  try {
    const { data, error } = await (supabaseAdmin
      .from('precio_usuario_sucursal') as any)
      .select('duracion_consulta')
      .eq('id_usuario_sucursal', idUsuarioSucursal)
      .eq('estado', 'activo')
      .maybeSingle();
    if (error || !data) return null;
    return data.duracion_consulta ?? null;
  } catch (error) {
    console.error('❌ Error al obtener duración del médico:', error);
    return null;
  }
}

export async function createPrecioUsuario(precio: Omit<PrecioUsuario, 'id_precio_usuario' | 'created_at'>): Promise<PrecioUsuario | null> {
  try {
    console.log('➕ Creando precio usuario');
    const { data, error } = await (supabaseAdmin
      .from('precio_usuario_sucursal') as any)
      .insert(precio as any)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear precio usuario:', error);
      return null;
    }

    console.log('✅ Precio usuario creado exitosamente');
    return data;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return null;
  }
}

export async function updatePrecioUsuario(idPrecioUsuario: number, updates: Partial<PrecioUsuario>): Promise<boolean> {
  try {
    console.log('✏️ Actualizando precio usuario ID:', idPrecioUsuario);
    const { error } = await (supabaseAdmin
      .from('precio_usuario_sucursal') as any)
      .update(updates as any)
      .eq('id_precio_usuario', idPrecioUsuario);

    if (error) {
      console.error('❌ Error al actualizar precio usuario:', error);
      return false;
    }

    console.log('✅ Precio usuario actualizado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

export async function deletePrecioUsuario(idPrecioUsuario: number): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando precio usuario ID:', idPrecioUsuario);
    const { error } = await supabaseAdmin
      .from('precio_usuario_sucursal')
      .delete()
      .eq('id_precio_usuario', idPrecioUsuario);

    if (error) {
      console.error('❌ Error al eliminar precio usuario:', error);
      return false;
    }

    console.log('✅ Precio usuario eliminado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// ========================================
// FUNCIONES - ASIGNACIÓN CONSULTORIOS
// ========================================

export async function getAllAsignacionesConsultorio(): Promise<AsignacionConsultorio[]> {
  try {
    console.log('📅 Obteniendo asignaciones de consultorio...');
    const { data, error } = await (supabaseAdmin
      .from('asignacion_consultorio') as any)
      .select(`
        *,
        usuario_sucursal:usuario_sucursal!inner(
          *,
          usuario:usuario(*),
          sucursal:sucursal(*)
        ),
        consultorio:consultorio!inner(*)
      `)
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener asignaciones:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} asignaciones`);
    return data as any || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function getAsignacionesByUsuarioSucursal(idUsuarioSucursal: number): Promise<AsignacionConsultorio[]> {
  try {
    console.log('📅 Obteniendo asignaciones del usuario-sucursal:', idUsuarioSucursal);
    const { data, error } = await (supabaseAdmin
      .from('asignacion_consultorio') as any)
      .select(`
        *,
        consultorio:consultorio!inner(*)
      `)
      .eq('id_usuario_sucursal', idUsuarioSucursal)
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener asignaciones:', error);
      return [];
    }

    return data as any || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function createAsignacionConsultorio(asignacion: Omit<AsignacionConsultorio, 'id_asignacion' | 'created_at'>): Promise<AsignacionConsultorio | null> {
  try {
    console.log('➕ Creando asignación de consultorio:', asignacion);
    const { data, error } = await (supabaseAdmin
      .from('asignacion_consultorio') as any)
      .insert(asignacion as any)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear asignación:', error);
      return null;
    }

    console.log('✅ Asignación creada exitosamente:', data);
    return data;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return null;
  }
}

export async function updateAsignacionConsultorio(idAsignacion: number, updates: Partial<AsignacionConsultorio>): Promise<boolean> {
  try {
    console.log('✏️ Actualizando asignación ID:', idAsignacion);
    const { error } = await (supabaseAdmin
      .from('asignacion_consultorio') as any)
      .update(updates as any)
      .eq('id_asignacion', idAsignacion);

    if (error) {
      console.error('❌ Error al actualizar asignación:', error);
      return false;
    }

    console.log('✅ Asignación actualizada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

export async function deleteAsignacionConsultorio(idAsignacion: number): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando asignación ID:', idAsignacion);
    const { error } = await supabaseAdmin
      .from('asignacion_consultorio')
      .delete()
      .eq('id_asignacion', idAsignacion);

    if (error) {
      console.error('❌ Error al eliminar asignación:', error);
      return false;
    }

    console.log('✅ Asignación eliminada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// ========================================
// FUNCIONES AUXILIARES
// ========================================

export function formatearTipoUsuario(tipo: TipoUsuario): string {
  const tipos = {
    medico: 'Médico',
    administrativo: 'Administrativo',
    enfermera: 'Enfermera',
    secretaria: 'Secretaria',
    USUARIO_IMANGE: 'Usuario Imagen',
    GESTOR_IMAGEN: 'Gestor Imagen'
  };
  return tipos[tipo] || tipo;
}

export function formatearDiaSemana(dia: number | DiaSemana): string {
  // Si es número, convertir a texto
  if (typeof dia === 'number') {
    const numerosADias: { [key: number]: string } = {
      0: 'Domingo',
      1: 'Lunes',
      2: 'Martes',
      3: 'Miércoles',
      4: 'Jueves',
      5: 'Viernes',
      6: 'Sábado'
    };
    return numerosADias[dia] || dia.toString();
  }

  // Si es texto, formatear
  const dias = {
    lunes: 'Lunes',
    martes: 'Martes',
    miercoles: 'Miércoles',
    jueves: 'Jueves',
    viernes: 'Viernes',
    sabado: 'Sábado',
    domingo: 'Domingo'
  };
  return dias[dia] || dia;
}

export function formatearMoneda(monto: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(monto);
}

// ========================================
// INTERFACES - PLANIFICACIÓN HORARIO SUPLENTES
// ========================================

export interface PlanificacionHorario {
  id_planificacion: number;
  id_usuario_sucursal: number;
  id_consultorio: number;
  fecha_inicio: string; // "YYYY-MM-DD"
  fecha_fin: string;    // "YYYY-MM-DD"
  dia_semana: number;   // 1=Lunes ... 7=Domingo
  hora_inicio: string;
  hora_fin: string;
  duracion_consulta: number;
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
  // Relations (vía JOIN)
  usuario_sucursal?: {
    cargo: string;
    usuario: { nombre: string; apellido: string };
    especialidad_data: { nombre: string } | null;
  };
  consultorio?: { nombre: string; piso: string | null; numero: string | null };
}

const PLANIFICACION_SELECT = `
  *,
  usuario_sucursal!inner(
    cargo,
    usuario!inner(nombre, apellido),
    especialidad_data:especialidad(nombre)
  ),
  consultorio(nombre, piso, numero)
`;

// ========================================
// FUNCIONES - PLANIFICACIÓN HORARIO SUPLENTES
// ========================================

export async function getPlanificacionesByUsuarioSucursal(
  idUsuarioSucursal: number,
  fechaInicio: string,
  fechaFin: string
): Promise<PlanificacionHorario[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('planificacion_horario_suplente')
      .select(PLANIFICACION_SELECT)
      .eq('id_usuario_sucursal', idUsuarioSucursal)
      .eq('fecha_inicio', fechaInicio)
      .eq('fecha_fin', fechaFin)
      .order('dia_semana')
      .order('hora_inicio');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error al obtener planificaciones:', error);
    return [];
  }
}

export async function getPlanificacionesBySucursal(
  idSucursal: number,
  fechaInicio: string,
  fechaFin: string
): Promise<PlanificacionHorario[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('planificacion_horario_suplente')
      .select(`${PLANIFICACION_SELECT}, usuario_sucursal!inner(id_sucursal)`)
      .eq('usuario_sucursal.id_sucursal', idSucursal)
      .eq('fecha_inicio', fechaInicio)
      .eq('fecha_fin', fechaFin)
      .order('dia_semana')
      .order('hora_inicio');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error al obtener planificaciones por sucursal:', error);
    return [];
  }
}

export async function createPlanificacion(
  planificacion: Omit<PlanificacionHorario, 'id_planificacion' | 'created_at' | 'updated_at' | 'usuario_sucursal' | 'consultorio'>
): Promise<PlanificacionHorario | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('planificacion_horario_suplente')
      .insert(planificacion)
      .select(PLANIFICACION_SELECT)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error al crear planificación:', error);
    return null;
  }
}

export async function updatePlanificacion(
  idPlanificacion: number,
  updates: Partial<Omit<PlanificacionHorario, 'id_planificacion' | 'created_at' | 'updated_at' | 'usuario_sucursal' | 'consultorio'>>
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('planificacion_horario_suplente')
      .update(updates)
      .eq('id_planificacion', idPlanificacion);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('❌ Error al actualizar planificación:', error);
    return false;
  }
}

export async function deletePlanificacion(idPlanificacion: number): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('planificacion_horario_suplente')
      .delete()
      .eq('id_planificacion', idPlanificacion);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar planificación:', error);
    return false;
  }
}

export async function getMedicosSuplentesYRespaldoBySucursal(
  idSucursal: number
): Promise<UsuarioSucursal[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('usuario_sucursal')
      .select('*, usuario!inner(nombre, apellido, tipo_usuario), sucursal!inner(nombre), especialidad_data:especialidad(nombre)')
      .eq('id_sucursal', idSucursal)
      .eq('estado', 'activo')
      .in('cargo', ['MEDICO SUPLENTE', 'MEDICO RESPALDO']);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error al obtener médicos suplentes y respaldo:', error);
    return [];
  }
}

// ========================================
// INTERFACES - HORARIO SERVICIO
// ========================================

export interface HorarioServicio {
  id_horario_servicio: number;
  id_servicio: number;
  dia_semana: number; // 1=Lunes, 2=Martes, ..., 7=Domingo
  hora_inicio: string;
  hora_fin: string;
  duracion_consulta: number; // minutos
  capacidad: number; // pacientes simultáneos por slot
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
  servicio?: Servicio;
}

export interface CitaServicio {
  id_cita_servicio: number;
  id_horario_servicio: number;
  id_servicio: number;
  id_paciente: number;
  id_sucursal: number;
  fecha_cita: string;
  hora_inicio: string;
  hora_fin: string;
  motivo?: string;
  estado_cita: 'agendada' | 'confirmada' | 'en_atencion' | 'atendida' | 'cancelada' | 'no_asistio' | 'finalizado';
  precio_cita?: number;
  forma_pago?: 'efectivo' | 'tarjeta' | 'transferencia' | 'seguro';
  estado_pago?: 'pendiente' | 'pagado' | 'parcial';
  notas_cita?: string;
  medico_solicitante?: string;
  numero_registro_medico?: string;
  tiene_seguro_medico?: string;
  foto_pedido_base64?: string | null;
  tiene_foto_pedido?: boolean;
  fecha_confirmada?: string | null;
  fecha_inicio_atencion?: string | null;
  fecha_atendida?: string | null;
  fecha_cancelada?: string | null;
  fecha_no_asistio?: string | null;
  url_pdf_resultado?: string | null;
  fecha_finalizada?: string | null;
  created_at?: string;
  updated_at?: string;
  servicio?: Servicio;
  horario_servicio?: HorarioServicio;
}

export interface CitaServicioCompleta extends CitaServicio {
  servicio: Servicio & { sucursal?: Sucursal };
  paciente: {
    id_paciente: number;
    nombres: string;
    apellidos: string;
    cedula: string;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
  };
  sucursal: Sucursal;
  horario_servicio: HorarioServicio;
}

// ========================================
// FUNCIONES - HORARIO SERVICIO
// ========================================

export async function getAllHorariosServicio(): Promise<HorarioServicio[]> {
  try {
    const { data, error } = await (supabaseAdmin
      .from('horario_servicio') as any)
      .select('*, servicio(id_servicio, descripcion, area, id_sucursal)')
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener todos los horarios de servicios:', error);
      return [];
    }

    return data as HorarioServicio[] || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function getHorariosByServicio(idServicio: number): Promise<HorarioServicio[]> {
  try {
    console.log('📅 Obteniendo horarios del servicio:', idServicio);
    const { data, error } = await (supabaseAdmin
      .from('horario_servicio') as any)
      .select('*, servicio(id_servicio, descripcion, area, id_sucursal)')
      .eq('id_servicio', idServicio)
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener horarios del servicio:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} horarios`);
    return data as HorarioServicio[] || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function getHorariosBySucursal(idSucursal: number): Promise<HorarioServicio[]> {
  try {
    console.log('📅 Obteniendo horarios de servicios por sucursal:', idSucursal);
    const { data, error } = await (supabaseAdmin
      .from('horario_servicio') as any)
      .select('*, servicio!inner(id_servicio, descripcion, area, id_sucursal, estado)')
      .eq('servicio.id_sucursal', idSucursal)
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener horarios por sucursal:', error);
      return [];
    }

    console.log(`✅ Se encontraron ${data?.length || 0} horarios`);
    return data as HorarioServicio[] || [];
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return [];
  }
}

export async function createHorarioServicio(
  horario: Omit<HorarioServicio, 'id_horario_servicio' | 'created_at' | 'updated_at' | 'servicio'>
): Promise<HorarioServicio | null> {
  try {
    console.log('➕ Creando horario de servicio:', horario);
    const { data, error } = await (supabaseAdmin
      .from('horario_servicio') as any)
      .insert(horario)
      .select('*, servicio(id_servicio, descripcion, area, id_sucursal)')
      .single();

    if (error) {
      console.error('❌ Error al crear horario de servicio:', error);
      return null;
    }

    console.log('✅ Horario de servicio creado exitosamente:', data);
    return data as HorarioServicio;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return null;
  }
}

export async function updateHorarioServicio(
  idHorario: number,
  updates: Partial<Omit<HorarioServicio, 'id_horario_servicio' | 'created_at' | 'updated_at' | 'servicio'>>
): Promise<boolean> {
  try {
    console.log('✏️ Actualizando horario de servicio ID:', idHorario);
    const { error } = await (supabaseAdmin
      .from('horario_servicio') as any)
      .update(updates)
      .eq('id_horario_servicio', idHorario);

    if (error) {
      console.error('❌ Error al actualizar horario de servicio:', error);
      return false;
    }

    console.log('✅ Horario de servicio actualizado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

export async function deleteHorarioServicio(idHorario: number): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando horario de servicio ID:', idHorario);
    const { error } = await (supabaseAdmin
      .from('horario_servicio') as any)
      .delete()
      .eq('id_horario_servicio', idHorario);

    if (error) {
      console.error('❌ Error al eliminar horario de servicio:', error);
      return false;
    }

    console.log('✅ Horario de servicio eliminado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}
