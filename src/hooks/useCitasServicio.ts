import { useState, useEffect, useCallback } from 'react';
import type { CitaServicioCompleta, CitaServicio } from '../lib/configuracionesService';
import {
  getCitasServicio,
  createCitaServicio,
  updateCitaServicio,
  cancelarCitaServicio,
  confirmarCitaServicio,
} from '../lib/citaServicioService';

interface UseCitasServicioParams {
  fechaDesde: string;
  fechaHasta: string;
  idSucursal?: number;
  idServicio?: number;
  estadoCita?: CitaServicio['estado_cita'];
}

export function useCitasServicio(params: UseCitasServicioParams) {
  const [citas, setCitas] = useState<CitaServicioCompleta[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadCitas = useCallback(async () => {
    if (!params.fechaDesde || !params.fechaHasta) return;
    setIsLoading(true);
    try {
      const data = await getCitasServicio(params);
      setCitas(data);
    } finally {
      setIsLoading(false);
    }
  }, [params.fechaDesde, params.fechaHasta, params.idSucursal, params.idServicio, params.estadoCita]);

  useEffect(() => {
    loadCitas();
  }, [loadCitas]);

  const crearCita = async (
    data: Omit<CitaServicio, 'id_cita_servicio' | 'created_at' | 'updated_at' | 'servicio' | 'horario_servicio'>
  ): Promise<CitaServicio | null> => {
    const result = await createCitaServicio(data);
    if (result) await loadCitas();
    return result;
  };

  const actualizarCita = async (
    id: number,
    updates: Partial<Omit<CitaServicio, 'id_cita_servicio' | 'created_at' | 'updated_at' | 'servicio' | 'horario_servicio'>>
  ): Promise<CitaServicio | null> => {
    const result = await updateCitaServicio(id, updates);
    if (result) await loadCitas();
    return result;
  };

  const cancelarCita = async (id: number): Promise<boolean> => {
    const ok = await cancelarCitaServicio(id);
    if (ok) await loadCitas();
    return ok;
  };

  const confirmarCita = async (
    id: number,
    datos: { medico_solicitante: string; numero_registro_medico: string; tiene_seguro_medico: string; foto_pedido_base64: string }
  ): Promise<CitaServicio | null> => {
    const result = await confirmarCitaServicio(id, datos);
    if (result) await loadCitas();
    return result;
  };

  return { citas, isLoading, loadCitas, crearCita, actualizarCita, cancelarCita, confirmarCita };
}
