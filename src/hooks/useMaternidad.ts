import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import type {
  EstadoSolicitudMaternidad,
  MaternidadAseguradora,
  MaternidadHorario,
  MaternidadHorarioDisponible,
  MaternidadSolicitudVista,
} from '../lib/supabaseTypes';
import {
  getAseguradorasMaternidad,
  createAseguradoraMaternidad,
  updateAseguradoraMaternidad,
  deleteAseguradoraMaternidad,
  getHorariosMaternidad,
  createHorarioMaternidad,
  updateHorarioMaternidad,
  deleteHorarioMaternidad,
  getHorariosDisponiblesMaternidad,
  getSolicitudesMaternidad,
  ESTADOS_CON_TOUR,
  type FiltrosSolicitudesMaternidad,
} from '../lib/maternidadService';

export function useAseguradorasMaternidad(soloActivas = false) {
  const [aseguradoras, setAseguradoras] = useState<MaternidadAseguradora[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadAseguradoras = useCallback(async () => {
    setIsLoading(true);
    try {
      setAseguradoras(await getAseguradorasMaternidad(soloActivas));
    } catch {
      toast.error('Error al cargar las aseguradoras');
    } finally {
      setIsLoading(false);
    }
  }, [soloActivas]);

  useEffect(() => {
    loadAseguradoras();
  }, [loadAseguradoras]);

  return {
    aseguradoras,
    isLoading,
    loadAseguradoras,
    crearAseguradora: createAseguradoraMaternidad,
    actualizarAseguradora: updateAseguradoraMaternidad,
    eliminarAseguradora: deleteAseguradoraMaternidad,
  };
}

export function useHorariosMaternidad() {
  const [horarios, setHorarios] = useState<MaternidadHorario[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadHorarios = useCallback(async () => {
    setIsLoading(true);
    try {
      setHorarios(await getHorariosMaternidad());
    } catch {
      toast.error('Error al cargar los horarios');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHorarios();
  }, [loadHorarios]);

  return {
    horarios,
    isLoading,
    loadHorarios,
    crearHorario: createHorarioMaternidad,
    actualizarHorario: updateHorarioMaternidad,
    eliminarHorario: deleteHorarioMaternidad,
  };
}

export function useHorariosDisponiblesMaternidad(desde?: string, hasta?: string) {
  const [turnos, setTurnos] = useState<MaternidadHorarioDisponible[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTurnos = useCallback(async () => {
    setIsLoading(true);
    try {
      setTurnos(await getHorariosDisponiblesMaternidad(desde, hasta));
    } catch {
      toast.error('Error al cargar los horarios disponibles');
    } finally {
      setIsLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    loadTurnos();
  }, [loadTurnos]);

  return { turnos, isLoading, loadTurnos };
}

export function useSolicitudesMaternidad(filtros: FiltrosSolicitudesMaternidad) {
  const [solicitudes, setSolicitudes] = useState<MaternidadSolicitudVista[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const claveFiltros = JSON.stringify(filtros);

  const loadSolicitudes = useCallback(async () => {
    setIsLoading(true);
    try {
      setSolicitudes(await getSolicitudesMaternidad(JSON.parse(claveFiltros)));
    } catch {
      toast.error('Error al cargar las solicitudes de maternidad');
    } finally {
      setIsLoading(false);
    }
  }, [claveFiltros]);

  useEffect(() => {
    loadSolicitudes();
  }, [loadSolicitudes]);

  return { solicitudes, isLoading, loadSolicitudes };
}

export interface IndicadoresMaternidad {
  total: number;
  soloCotizacion: number;
  conTour: number;
  /** % de solicitudes que llegaron a agendar tour */
  conversion: number;
  asistieron: number;
  noAsistieron: number;
  /** % de asistencia sobre tours ya realizados (asistió + no asistió) */
  tasaAsistencia: number;
  canceladas: number;
  correosEnviados: number;
  correosError: number;
  porEstado: { estado: EstadoSolicitudMaternidad; total: number }[];
  porAseguradora: { aseguradora: string; total: number; tours: number }[];
  porOrigen: { origen: string; total: number }[];
  porDia: { fecha: string; solicitudes: number; tours: number }[];
  porHorario: { horario: string; tours: number }[];
}

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0);

/** Indicadores estadísticos calculados sobre las solicitudes ya filtradas */
export function useIndicadoresMaternidad(solicitudes: MaternidadSolicitudVista[]): IndicadoresMaternidad {
  return useMemo(() => {
    const contar = <K extends string>(claves: K[]) => {
      const mapa = new Map<K, number>();
      claves.forEach(c => mapa.set(c, (mapa.get(c) || 0) + 1));
      return mapa;
    };
    const conTourLista = solicitudes.filter(s => s.fecha_tour && s.estado !== 'solo_cotizacion');
    const asistieron = solicitudes.filter(s => s.estado === 'asistio').length;
    const noAsistieron = solicitudes.filter(s => s.estado === 'no_asistio').length;

    const estados = contar(solicitudes.map(s => s.estado));

    const aseguradoras = new Map<string, { total: number; tours: number }>();
    solicitudes.forEach(s => {
      const clave = s.aseguradora || 'Sin aseguradora';
      const actual = aseguradoras.get(clave) || { total: 0, tours: 0 };
      actual.total += 1;
      if (s.fecha_tour && s.estado !== 'solo_cotizacion') actual.tours += 1;
      aseguradoras.set(clave, actual);
    });

    const dias = new Map<string, { solicitudes: number; tours: number }>();
    solicitudes.forEach(s => {
      const fecha = new Date(s.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
      const actual = dias.get(fecha) || { solicitudes: 0, tours: 0 };
      actual.solicitudes += 1;
      if (s.fecha_tour && s.estado !== 'solo_cotizacion') actual.tours += 1;
      dias.set(fecha, actual);
    });

    const horarios = contar(
      conTourLista.filter(s => ESTADOS_CON_TOUR.includes(s.estado)).map(s => s.hora_inicio?.slice(0, 5) || '—'),
    );

    return {
      total: solicitudes.length,
      soloCotizacion: estados.get('solo_cotizacion') || 0,
      conTour: conTourLista.length,
      conversion: porcentaje(conTourLista.length, solicitudes.length),
      asistieron,
      noAsistieron,
      tasaAsistencia: porcentaje(asistieron, asistieron + noAsistieron),
      canceladas: estados.get('cancelada') || 0,
      correosEnviados: solicitudes.reduce((suma, s) => suma + (s.correos_enviados || 0), 0),
      correosError: solicitudes.reduce((suma, s) => suma + (s.correos_error || 0), 0),
      porEstado: [...estados.entries()].map(([estado, total]) => ({ estado, total })),
      porAseguradora: [...aseguradoras.entries()]
        .map(([aseguradora, v]) => ({ aseguradora, ...v }))
        .sort((a, b) => b.total - a.total),
      porOrigen: [...contar(solicitudes.map(s => s.origen)).entries()].map(([origen, total]) => ({ origen, total })),
      porDia: [...dias.entries()]
        .map(([fecha, v]) => ({ fecha, ...v }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
      porHorario: [...horarios.entries()]
        .map(([horario, tours]) => ({ horario, tours }))
        .sort((a, b) => a.horario.localeCompare(b.horario)),
    };
  }, [solicitudes]);
}
