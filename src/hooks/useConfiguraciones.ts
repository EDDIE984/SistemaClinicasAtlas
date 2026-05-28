// Hooks personalizados para configuraciones del sistema
import { useState, useEffect } from 'react';
import {
  getAllCompanias,
  createCompania,
  updateCompania,
  deleteCompania,
  getAllSucursales,
  getSucursalesByCompania,
  createSucursal,
  updateSucursal,
  deleteSucursal,
  getAllConsultorios,
  getConsultoriosBySucursal,
  createConsultorio,
  updateConsultorio,
  deleteConsultorio,
  getAllServicios,
  getServiciosBySucursal,
  createServicio,
  updateServicio,
  deleteServicio,
  getAllUsuarios,
  getUsuariosByTipo,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  getAllUsuarioSucursales,
  getUsuarioSucursalesByUsuario,
  createUsuarioSucursal,
  updateUsuarioSucursal,
  deleteUsuarioSucursal,
  getAllPreciosBase,
  createPrecioBase,
  updatePrecioBase,
  deletePrecioBase,
  getAllAsignacionesConsultorio,
  getAsignacionesByUsuarioSucursal,
  createAsignacionConsultorio,
  updateAsignacionConsultorio,
  deleteAsignacionConsultorio,
  getAllEspecialidades,
  createEspecialidad,
  updateEspecialidad,
  deleteEspecialidad,
  getPlanificacionesByUsuarioSucursal,
  createPlanificacion,
  updatePlanificacion,
  deletePlanificacion,
  getMedicosSuplentesYRespaldoBySucursal,
  getAllHorariosServicio,
  getHorariosBySucursal,
  getHorariosByServicio,
  createHorarioServicio,
  updateHorarioServicio,
  deleteHorarioServicio,
  type Compania,
  type Sucursal,
  type Consultorio,
  type Servicio,
  type Usuario,
  type TipoUsuario,
  type UsuarioSucursal,
  type PrecioBase,
  type AsignacionConsultorio,
  type Especialidad,
  type PlanificacionHorario,
  type HorarioServicio,
  type CitaServicio
} from '../lib/configuracionesService';

export type { PlanificacionHorario };
export { getMedicosSuplentesYRespaldoBySucursal };

// ========================================
// HOOK: COMPAÑÍAS
// ========================================

export function useCompanias() {
  const [companias, setCompanias] = useState<Compania[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompanias();
  }, []);

  const loadCompanias = async () => {
    setIsLoading(true);
    setError(null);
    const data = await getAllCompanias();
    setCompanias(data);
    setIsLoading(false);
  };

  const agregarCompania = async (compania: Omit<Compania, 'id_compania' | 'created_at'>) => {
    const nueva = await createCompania(compania);
    if (nueva) {
      await loadCompanias();
      return nueva;
    }
    return null;
  };

  const actualizarCompania = async (id: number, updates: Partial<Compania>) => {
    const success = await updateCompania(id, updates);
    if (success) {
      await loadCompanias();
    }
    return success;
  };

  const eliminarCompania = async (id: number) => {
    const success = await deleteCompania(id);
    if (success) {
      await loadCompanias();
    }
    return success;
  };

  return {
    companias,
    isLoading,
    error,
    loadCompanias,
    agregarCompania,
    actualizarCompania,
    eliminarCompania
  };
}

// ========================================
// HOOK: SUCURSALES
// ========================================

export function useSucursales(idCompania?: number) {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSucursales();
  }, [idCompania]);

  const loadSucursales = async () => {
    setIsLoading(true);
    const data = idCompania
      ? await getSucursalesByCompania(idCompania)
      : await getAllSucursales();
    setSucursales(data);
    setIsLoading(false);
  };

  const agregarSucursal = async (sucursal: Omit<Sucursal, 'id_sucursal' | 'created_at'>) => {
    const nueva = await createSucursal(sucursal);
    if (nueva) {
      await loadSucursales();
      return nueva;
    }
    return null;
  };

  const actualizarSucursal = async (id: number, updates: Partial<Sucursal>) => {
    const success = await updateSucursal(id, updates);
    if (success) {
      await loadSucursales();
    }
    return success;
  };

  const eliminarSucursal = async (id: number) => {
    const success = await deleteSucursal(id);
    if (success) {
      await loadSucursales();
    }
    return success;
  };

  return {
    sucursales,
    isLoading,
    loadSucursales,
    agregarSucursal,
    actualizarSucursal,
    eliminarSucursal
  };
}

// ========================================
// HOOK: CONSULTORIOS
// ========================================

export function useConsultorios(idSucursal?: number) {
  const [consultorios, setConsultorios] = useState<Consultorio[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConsultorios();
  }, [idSucursal]);

  const loadConsultorios = async () => {
    setIsLoading(true);
    const data = idSucursal
      ? await getConsultoriosBySucursal(idSucursal)
      : await getAllConsultorios();
    setConsultorios(data);
    setIsLoading(false);
  };

  const agregarConsultorio = async (consultorio: Omit<Consultorio, 'id_consultorio' | 'created_at'>) => {
    const nuevo = await createConsultorio(consultorio);
    if (nuevo) {
      await loadConsultorios();
      return nuevo;
    }
    return null;
  };

  const actualizarConsultorio = async (id: number, updates: Partial<Consultorio>) => {
    const success = await updateConsultorio(id, updates);
    if (success) {
      await loadConsultorios();
    }
    return success;
  };

  const eliminarConsultorio = async (id: number) => {
    const success = await deleteConsultorio(id);
    if (success) {
      await loadConsultorios();
    }
    return success;
  };

  return {
    consultorios,
    isLoading,
    loadConsultorios,
    agregarConsultorio,
    actualizarConsultorio,
    eliminarConsultorio
  };
}

// ========================================
// HOOK: SERVICIOS
// ========================================

export function useServicios(idSucursal?: number) {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadServicios();
  }, [idSucursal]);

  const loadServicios = async () => {
    setIsLoading(true);
    const data = idSucursal
      ? await getServiciosBySucursal(idSucursal)
      : await getAllServicios();
    setServicios(data);
    setIsLoading(false);
  };

  const agregarServicio = async (servicio: Omit<Servicio, 'id_servicio' | 'created_at'>) => {
    const nuevo = await createServicio(servicio);
    if (nuevo) {
      await loadServicios();
      return nuevo;
    }
    return null;
  };

  const actualizarServicio = async (id: number, updates: Partial<Servicio>) => {
    const success = await updateServicio(id, updates);
    if (success) {
      await loadServicios();
    }
    return success;
  };

  const eliminarServicio = async (id: number) => {
    const success = await deleteServicio(id);
    if (success) {
      await loadServicios();
    }
    return success;
  };

  return {
    servicios,
    isLoading,
    loadServicios,
    agregarServicio,
    actualizarServicio,
    eliminarServicio
  };
}

// ========================================
// HOOK: USUARIOS
// ========================================

export function useUsuarios(tipoUsuario?: TipoUsuario) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUsuarios();
  }, [tipoUsuario]);

  const loadUsuarios = async () => {
    setIsLoading(true);
    const data = tipoUsuario
      ? await getUsuariosByTipo(tipoUsuario)
      : await getAllUsuarios();
    setUsuarios(data);
    setIsLoading(false);
  };

  const agregarUsuario = async (usuario: Omit<Usuario, 'id_usuario' | 'created_at'>) => {
    try {
      const nuevo = await createUsuario(usuario);
      await loadUsuarios();
      return nuevo;
    } catch (error: any) {
      // Re-lanzar el error para que el componente lo maneje
      throw error;
    }
  };

  const actualizarUsuario = async (id: number, updates: Partial<Usuario>) => {
    const success = await updateUsuario(id, updates);
    if (success) {
      await loadUsuarios();
    }
    return success;
  };

  const eliminarUsuario = async (id: number) => {
    const success = await deleteUsuario(id);
    if (success) {
      await loadUsuarios();
    }
    return success;
  };

  return {
    usuarios,
    isLoading,
    loadUsuarios,
    agregarUsuario,
    actualizarUsuario,
    eliminarUsuario
  };
}

// ========================================
// HOOK: USUARIO-SUCURSAL (Asignaciones)
// ========================================

export function useUsuarioSucursales(idUsuario?: number) {
  const [asignaciones, setAsignaciones] = useState<UsuarioSucursal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAsignaciones();
  }, [idUsuario]);

  const loadAsignaciones = async () => {
    setIsLoading(true);
    const data = idUsuario
      ? await getUsuarioSucursalesByUsuario(idUsuario)
      : await getAllUsuarioSucursales();
    setAsignaciones(data);
    setIsLoading(false);
  };

  const agregarAsignacion = async (asignacion: Omit<UsuarioSucursal, 'id_usuario_sucursal' | 'created_at'>) => {
    const nueva = await createUsuarioSucursal(asignacion);
    if (nueva) {
      await loadAsignaciones();
      return nueva;
    }
    return null;
  };

  const actualizarAsignacion = async (id: number, updates: Partial<UsuarioSucursal>) => {
    const success = await updateUsuarioSucursal(id, updates);
    if (success) {
      await loadAsignaciones();
    }
    return success;
  };

  const eliminarAsignacion = async (id: number) => {
    const success = await deleteUsuarioSucursal(id);
    if (success) {
      await loadAsignaciones();
    }
    return success;
  };

  return {
    asignaciones,
    isLoading,
    loadAsignaciones,
    agregarAsignacion,
    actualizarAsignacion,
    eliminarAsignacion
  };
}

// ========================================
// HOOK: PRECIOS BASE
// ========================================

export function usePreciosBase() {
  const [preciosBase, setPreciosBase] = useState<PrecioBase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPreciosBase();
  }, []);

  const loadPreciosBase = async () => {
    setIsLoading(true);
    const data = await getAllPreciosBase();
    setPreciosBase(data);
    setIsLoading(false);
  };

  const agregarPrecioBase = async (precio: Omit<PrecioBase, 'id_precio_base' | 'created_at'>) => {
    const nuevo = await createPrecioBase(precio);
    if (nuevo) {
      await loadPreciosBase();
      return nuevo;
    }
    return null;
  };

  const actualizarPrecioBase = async (id: number, updates: Partial<PrecioBase>) => {
    const success = await updatePrecioBase(id, updates);
    if (success) {
      await loadPreciosBase();
    }
    return success;
  };

  const eliminarPrecioBase = async (id: number) => {
    const success = await deletePrecioBase(id);
    if (success) {
      await loadPreciosBase();
    }
    return success;
  };

  return {
    preciosBase,
    isLoading,
    loadPreciosBase,
    agregarPrecioBase,
    actualizarPrecioBase,
    eliminarPrecioBase
  };
}

// ========================================
// HOOK: ASIGNACIONES CONSULTORIO
// ========================================

export function useAsignacionesConsultorio(idUsuarioSucursal?: number) {
  const [asignaciones, setAsignaciones] = useState<AsignacionConsultorio[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAsignaciones();
  }, [idUsuarioSucursal]);

  const loadAsignaciones = async () => {
    setIsLoading(true);
    const data = idUsuarioSucursal
      ? await getAsignacionesByUsuarioSucursal(idUsuarioSucursal)
      : await getAllAsignacionesConsultorio();
    setAsignaciones(data);
    setIsLoading(false);
  };

  const agregarAsignacion = async (asignacion: Omit<AsignacionConsultorio, 'id_asignacion' | 'created_at'>) => {
    const nueva = await createAsignacionConsultorio(asignacion);
    if (nueva) {
      await loadAsignaciones();
      return nueva;
    }
    return null;
  };

  const actualizarAsignacion = async (id: number, updates: Partial<AsignacionConsultorio>) => {
    const success = await updateAsignacionConsultorio(id, updates);
    if (success) {
      await loadAsignaciones();
    }
    return success;
  };

  const eliminarAsignacion = async (id: number) => {
    const success = await deleteAsignacionConsultorio(id);
    if (success) {
      await loadAsignaciones();
    }
    return success;
  };

  return {
    asignaciones,
    isLoading,
    loadAsignaciones,
    agregarAsignacion,
    actualizarAsignacion,
    eliminarAsignacion
  };
}

// ========================================
// HOOK: ESPECIALIDADES
// ========================================

export function useEspecialidades() {
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEspecialidades();
  }, []);

  const loadEspecialidades = async () => {
    setIsLoading(true);
    const data = await getAllEspecialidades();
    setEspecialidades(data);
    setIsLoading(false);
  };

  const agregarEspecialidad = async (especialidad: Omit<Especialidad, 'id_especialidad' | 'created_at'>) => {
    const nueva = await createEspecialidad(especialidad);
    if (nueva) {
      await loadEspecialidades();
      return nueva;
    }
    return null;
  };

  const actualizarEspecialidad = async (id: number, updates: Partial<Especialidad>) => {
    const success = await updateEspecialidad(id, updates);
    if (success) {
      await loadEspecialidades();
    }
    return success;
  };

  const eliminarEspecialidad = async (id: number) => {
    const success = await deleteEspecialidad(id);
    if (success) {
      await loadEspecialidades();
    }
    return success;
  };

  return {
    especialidades,
    isLoading,
    loadEspecialidades,
    agregarEspecialidad,
    actualizarEspecialidad,
    eliminarEspecialidad
  };
}

// ========================================
// HOOK - PLANIFICACIÓN HORARIO SUPLENTES
// ========================================

export function usePlanificacionHorario(
  idUsuarioSucursal?: number,
  fechaInicio?: string,
  fechaFin?: string
) {
  const [planificaciones, setPlanificaciones] = useState<PlanificacionHorario[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (idUsuarioSucursal && fechaInicio && fechaFin) {
      loadPlanificaciones();
    } else {
      setPlanificaciones([]);
    }
  }, [idUsuarioSucursal, fechaInicio, fechaFin]);

  const loadPlanificaciones = async () => {
    if (!idUsuarioSucursal || !fechaInicio || !fechaFin) return;
    setIsLoading(true);
    const data = await getPlanificacionesByUsuarioSucursal(idUsuarioSucursal, fechaInicio, fechaFin);
    setPlanificaciones(data);
    setIsLoading(false);
  };

  const agregarPlanificacion = async (
    planificacion: Omit<PlanificacionHorario, 'id_planificacion' | 'created_at' | 'updated_at' | 'usuario_sucursal' | 'consultorio'>
  ) => {
    const nueva = await createPlanificacion(planificacion);
    if (nueva) await loadPlanificaciones();
    return nueva;
  };

  const actualizarPlanificacion = async (
    id: number,
    updates: Partial<Omit<PlanificacionHorario, 'id_planificacion' | 'created_at' | 'updated_at' | 'usuario_sucursal' | 'consultorio'>>
  ) => {
    const success = await updatePlanificacion(id, updates);
    if (success) await loadPlanificaciones();
    return success;
  };

  const eliminarPlanificacion = async (id: number) => {
    const success = await deletePlanificacion(id);
    if (success) await loadPlanificaciones();
    return success;
  };

  return {
    planificaciones,
    isLoading,
    loadPlanificaciones,
    agregarPlanificacion,
    actualizarPlanificacion,
    eliminarPlanificacion
  };
}

// ========================================
// HOOK: HORARIOS DE SERVICIOS
// ========================================

export function useHorariosServicio(idSucursal?: number, idServicio?: number) {
  const [horarios, setHorarios] = useState<HorarioServicio[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHorarios();
  }, [idSucursal, idServicio]);

  const loadHorarios = async () => {
    setIsLoading(true);
    let data: HorarioServicio[] = [];
    if (idServicio) {
      data = await getHorariosByServicio(idServicio);
    } else if (idSucursal) {
      data = await getHorariosBySucursal(idSucursal);
    } else {
      data = await getAllHorariosServicio();
    }
    setHorarios(data);
    setIsLoading(false);
  };

  // Las operaciones solo ejecutan la mutación; el componente llama loadHorarios() al finalizar
  const agregarHorario = async (
    horario: Omit<HorarioServicio, 'id_horario_servicio' | 'created_at' | 'updated_at' | 'servicio'>
  ) => {
    return await createHorarioServicio(horario);
  };

  const actualizarHorario = async (
    id: number,
    updates: Partial<Omit<HorarioServicio, 'id_horario_servicio' | 'created_at' | 'updated_at' | 'servicio'>>
  ) => {
    return await updateHorarioServicio(id, updates);
  };

  const eliminarHorario = async (id: number) => {
    return await deleteHorarioServicio(id);
  };

  return {
    horarios,
    isLoading,
    loadHorarios,
    agregarHorario,
    actualizarHorario,
    eliminarHorario
  };
}

export type { HorarioServicio, CitaServicio };

// Exportar funciones auxiliares
export {
  formatearTipoUsuario,
  formatearDiaSemana,
  formatearMoneda
} from '../lib/configuracionesService';
