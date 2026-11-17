import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import type {
  MaternidadCorreoVista,
  MaternidadProforma,
  MaternidadAseguradora,
  MaternidadHorario,
  MaternidadHorarioDisponible,
  MaternidadSolicitudVista,
} from '../lib/supabaseTypes';
import {
  ETIQUETA_ORIGEN_MATERNIDAD,
  MESES,
  duracionMinutos,
  seguimientoTour,
  seguroDe,
  type SeguimientoTour,
} from '../components/maternidad/maternidadUtils';
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
  getProformasMaternidad,
  getAlertasSeguimientoMaternidad,
  contarSinSemanasMaternidad,
  cerrarSeguimientosVencidosMaternidad,
  getCorreosMaternidad,
  revisarCorreosMaternidad,
  type FiltrosCorreosMaternidad,
  type FiltrosSolicitudesMaternidad,
  type ResultadoRevisionCorreos,
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

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0);

// ========================================
// Bitácora de tours
// ========================================

export interface IndicadoresBitacora {
  total: number;
  firmaron: number;
  tasaFirma: number;
  /** Alerta roja: 37–40 semanas */
  llamar: number;
  /** Alerta roja: 20–36 semanas */
  enSeguimiento: number;
  /** Superaron 40 semanas o se cerró el seguimiento */
  perdidas: number;
  /** Menos de 20 semanas */
  pendientes: number;
  sinSemanas: number;
  partosClinica: number;
  /** % de tours que terminaron en parto en la clínica */
  tasaParto: number;
  promedioSemanas: number | null;
  duracionPromedio: number | null;
  porMes: { mes: string; etiqueta: string; tours: number; partos: number }[];
  porAsesor: { asesor: string; tours: number }[];
  porSeguro: { seguro: string; tours: number }[];
  porMedico: { medico: string; tours: number }[];
  porSemanas: { rango: string; tours: number }[];
  porSeguimiento: { estado: SeguimientoTour; total: number }[];
  porDiaSemana: { dia: string; tours: number }[];
  /** Hora real de inicio del tour (solo tours con hora registrada) */
  porHora: { hora: string; tours: number }[];
  porOrigen: { origen: string; tours: number }[];
}

const RANGOS_SEMANAS = [
  { rango: '< 20', min: 1, max: 19 },
  { rango: '20 – 27', min: 20, max: 27 },
  { rango: '28 – 32', min: 28, max: 32 },
  { rango: '33 – 36', min: 33, max: 36 },
  { rango: '37 +', min: 37, max: 45 },
];
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Indicadores de la bitácora (tours realizados) calculados sobre los tours ya filtrados */
export function useIndicadoresBitacora(tours: MaternidadSolicitudVista[]): IndicadoresBitacora {
  return useMemo(() => {
    const top = (mapa: Map<string, number>, n?: number) =>
      [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, n ?? mapa.size);
    const sumar = (mapa: Map<string, number>, clave: string) => mapa.set(clave, (mapa.get(clave) || 0) + 1);

    const seguimientos = new Map<SeguimientoTour, number>();
    const asesores = new Map<string, number>();
    const seguros = new Map<string, number>();
    const medicos = new Map<string, number>();
    const meses = new Map<string, { tours: number; partos: number }>();
    const dias = new Map<string, number>();
    const horas = new Map<string, number>();
    const origenes = new Map<string, number>();
    const semanas: number[] = [];
    const duraciones: number[] = [];

    tours.forEach(t => {
      // "vencida" (> 40 sin cerrar aún) se agrupa con las cerradas como "Ya está perdida"
      const estado = seguimientoTour(t);
      sumar(seguimientos as Map<string, number>, estado === 'vencida' ? 'perdida' : estado);
      sumar(asesores, t.asesor || 'Sin asesor');
      sumar(seguros, seguroDe(t) || 'Sin seguro');
      if (t.medico_ginecologo) sumar(medicos, t.medico_ginecologo.toUpperCase());
      if (t.semanas_gestacion) semanas.push(t.semanas_gestacion);
      if (t.hora_inicio_real) sumar(horas, `${t.hora_inicio_real.slice(0, 2)}:00`);
      sumar(origenes, ETIQUETA_ORIGEN_MATERNIDAD[t.origen] || t.origen);
      const duracion = duracionMinutos(t.hora_inicio_real, t.hora_fin_real);
      if (duracion !== null && duracion <= 240) duraciones.push(duracion);
      if (t.fecha_tour) {
        const mes = t.fecha_tour.slice(0, 7);
        const actual = meses.get(mes) || { tours: 0, partos: 0 };
        actual.tours += 1;
        if (t.resultado_parto === 'clinica') actual.partos += 1;
        meses.set(mes, actual);
        const dia = new Date(`${t.fecha_tour}T00:00:00`).getDay();
        sumar(dias, DIAS[dia === 0 ? 6 : dia - 1]);
      }
    });

    const firmaron = tours.filter(t => t.firma_paciente === true).length;
    const conFirma = tours.filter(t => t.firma_paciente !== null).length;
    const partosClinica = tours.filter(t => t.resultado_parto === 'clinica').length;
    const promedio = (valores: number[]) =>
      valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10 : null;

    return {
      total: tours.length,
      firmaron,
      tasaFirma: porcentaje(firmaron, conFirma),
      llamar: seguimientos.get('llamar') || 0,
      enSeguimiento: seguimientos.get('seguimiento') || 0,
      perdidas: seguimientos.get('perdida') || 0,
      pendientes: seguimientos.get('temprana') || 0,
      sinSemanas: seguimientos.get('sin_semanas') || 0,
      partosClinica,
      tasaParto: porcentaje(partosClinica, tours.length),
      promedioSemanas: promedio(semanas),
      duracionPromedio: promedio(duraciones),
      porMes: [...meses.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mes, v]) => ({ mes, etiqueta: `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(2, 4)}`, ...v })),
      porAsesor: top(asesores).map(([asesor, n]) => ({ asesor, tours: n })),
      porSeguro: top(seguros, 10).map(([seguro, n]) => ({ seguro, tours: n })),
      porMedico: top(medicos, 10).map(([medico, n]) => ({ medico, tours: n })),
      porSemanas: RANGOS_SEMANAS.map(r => ({
        rango: r.rango,
        tours: semanas.filter(s => s >= r.min && s <= r.max).length,
      })),
      porSeguimiento: [...seguimientos.entries()].map(([estado, total]) => ({ estado, total })),
      porDiaSemana: DIAS.map(dia => ({ dia, tours: dias.get(dia) || 0 })).filter(d => d.tours > 0),
      porHora: [...horas.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([hora, n]) => ({ hora, tours: n })),
      porOrigen: top(origenes).map(([origen, n]) => ({ origen, tours: n })),
    };
  }, [tours]);
}

// ========================================
// Alertas de seguimiento (perfil maternidad)
// ========================================

const REFRESCO_ALERTAS_MS = 5 * 60 * 1000;

/**
 * Alertas rojas de seguimiento: mamás entre 20 y 40 semanas sin parto registrado.
 * Antes de cargar cierra las que superaron 40 semanas (también corre a diario con pg_cron).
 * Se refresca cada 5 minutos y cuando cambia `refresco` (p. ej. al navegar).
 */
export function useAlertasMaternidad(activo: boolean, refresco?: unknown) {
  const [alertas, setAlertas] = useState<MaternidadSolicitudVista[]>([]);
  const [sinSemanas, setSinSemanas] = useState(0);

  const recargar = useCallback(async () => {
    if (!activo) return;
    try {
      await cerrarSeguimientosVencidosMaternidad().catch(() => 0);
      const [lista, sin] = await Promise.all([getAlertasSeguimientoMaternidad(), contarSinSemanasMaternidad()]);
      setAlertas(lista);
      setSinSemanas(sin);
    } catch {
      // El servicio ya registra el error; el banner no debe interrumpir la pantalla
    }
  }, [activo]);

  useEffect(() => {
    if (!activo) {
      setAlertas([]);
      return;
    }
    recargar();
    const intervalo = setInterval(recargar, REFRESCO_ALERTAS_MS);
    return () => clearInterval(intervalo);
  }, [activo, recargar, refresco]);

  return {
    alertas,
    total: alertas.length,
    proximas: alertas.filter(a => a.estado_seguimiento === 'llamar').length,
    sinSemanas,
    recargar,
  };
}

// ========================================
// Embudo comercial y proformas (reporte de maternidad)
// ========================================

export interface EmbudoComercial {
  etapas: { etapa: string; total: number; conversion: number | null }[];
  porCanal: { canal: string; solicitudes: number; proformas: number; tours: number; asistieron: number; partos: number }[];
}

/** Solicitudes de WhatsApp / plataforma: proforma enviada → tour agendado → asistió → parto en la clínica */
export function useEmbudoComercial(solicitudes: MaternidadSolicitudVista[]): EmbudoComercial {
  return useMemo(() => {
    const contar = (lista: MaternidadSolicitudVista[]) => {
      const proformas = lista.filter(s => (s.correos_enviados || 0) > 0);
      const tours = lista.filter(s => !!s.fecha_tour);
      const asistieron = lista.filter(s => s.estado === 'asistio');
      const partos = lista.filter(s => s.resultado_parto === 'clinica');
      return { solicitudes: lista.length, proformas: proformas.length, tours: tours.length, asistieron: asistieron.length, partos: partos.length };
    };
    const total = contar(solicitudes);
    const valores = [
      { etapa: 'Solicitudes', total: total.solicitudes },
      { etapa: 'Proformas enviadas', total: total.proformas },
      { etapa: 'Tours agendados', total: total.tours },
      { etapa: 'Asistieron al tour', total: total.asistieron },
      { etapa: 'Partos en la clínica', total: total.partos },
    ];
    return {
      etapas: valores.map((v, i) => ({ ...v, conversion: i === 0 ? null : porcentaje(v.total, valores[i - 1].total) })),
      porCanal: (['CHATBOT', 'SISTEMA'] as const).map(origen => ({
        canal: ETIQUETA_ORIGEN_MATERNIDAD[origen],
        ...contar(solicitudes.filter(s => s.origen === origen)),
      })),
    };
  }, [solicitudes]);
}

export function useProformasMaternidad(envioDesde?: string, envioHasta?: string) {
  const [proformas, setProformas] = useState<MaternidadProforma[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadProformas = useCallback(async () => {
    setIsLoading(true);
    try {
      setProformas(await getProformasMaternidad(envioDesde, envioHasta));
    } catch {
      toast.error('Error al cargar las proformas de maternidad');
    } finally {
      setIsLoading(false);
    }
  }, [envioDesde, envioHasta]);

  useEffect(() => {
    loadProformas();
  }, [loadProformas]);

  return { proformas, isLoading, loadProformas };
}

/**
 * Correos de maternidad con su estado real. Al abrir la pantalla muestra lo guardado y, en segundo plano,
 * revisa rebotes, correos inválidos y reintentos (/api/maternidad-correos); luego vuelve a cargar.
 */
export function useCorreosMaternidad(filtros: FiltrosCorreosMaternidad) {
  const [correos, setCorreos] = useState<MaternidadCorreoVista[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [ultimaRevision, setUltimaRevision] = useState<{ fecha: Date; resultado: ResultadoRevisionCorreos } | null>(null);
  const { desde, hasta } = filtros;

  const loadCorreos = useCallback(async () => {
    setIsLoading(true);
    try {
      setCorreos(await getCorreosMaternidad({ desde, hasta }));
    } catch {
      toast.error('Error al cargar los correos de maternidad');
    } finally {
      setIsLoading(false);
    }
  }, [desde, hasta]);

  const revisar = useCallback(async (avisar = true) => {
    setRevisando(true);
    try {
      const resultado = await revisarCorreosMaternidad();
      setUltimaRevision({ fecha: new Date(), resultado });
      const nuevos = resultado.rebotes_detectados.length + resultado.invalidos_detectados.length;
      const reenviados = resultado.reintentos.filter(r => r.ok).length;
      if ('error' in resultado.imap) toast.error(`No se pudo leer la casilla de correo: ${resultado.imap.error}`);
      if (nuevos > 0) toast.warning(`${nuevos} correo(s) nuevo(s) con problema de entrega`);
      if (reenviados > 0) toast.success(`${reenviados} correo(s) con error reenviado(s) automáticamente`);
      if (avisar && nuevos === 0 && reenviados === 0 && !('error' in resultado.imap)) toast.success('Revisión completa: sin novedades');
      return resultado;
    } catch (error) {
      toast.error(`No se pudieron revisar los correos: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      setRevisando(false);
    }
  }, []);

  useEffect(() => {
    loadCorreos();
  }, [loadCorreos]);

  // Una revisión silenciosa al abrir la pantalla
  useEffect(() => {
    revisar(false).then(resultado => { if (resultado) loadCorreos(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revisarAhora = useCallback(async () => {
    if (await revisar(true)) await loadCorreos();
  }, [revisar, loadCorreos]);

  return { correos, isLoading, revisando, ultimaRevision, loadCorreos, revisarAhora };
}

export interface IndicadoresProformas {
  enviadas: number;
  reenvios: number;
  mamas: number;
  conError: number;
  /** Valor promedio, mínimo, máximo y total cotizado por procedimiento */
  porProcedimiento: { procedimiento: string; cotizaciones: number; promedio: number; minimo: number; maximo: number; total: number }[];
  porMes: { mes: string; etiqueta: string; proformas: number }[];
  /** Valor promedio por aseguradora (una columna por procedimiento) */
  porAseguradora: Record<string, string | number>[];
  procedimientos: string[];
}

export function useIndicadoresProformas(proformas: MaternidadProforma[]): IndicadoresProformas {
  return useMemo(() => {
    const procedimientos = new Map<string, number[]>();
    const meses = new Map<string, number>();
    const aseguradoras = new Map<string, Map<string, number[]>>();
    proformas.forEach(p => {
      (p.resumen || []).forEach(r => {
        const lista = procedimientos.get(r.procedimiento) || [];
        lista.push(Number(r.total) || 0);
        procedimientos.set(r.procedimiento, lista);
        const clave = p.aseguradora || 'Sin aseguradora';
        const porProc = aseguradoras.get(clave) || new Map<string, number[]>();
        porProc.set(r.procedimiento, [...(porProc.get(r.procedimiento) || []), Number(r.total) || 0]);
        aseguradoras.set(clave, porProc);
      });
      if (p.fecha_envio) {
        const mes = new Date(p.fecha_envio).toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' }).slice(0, 7);
        meses.set(mes, (meses.get(mes) || 0) + 1);
      }
    });
    const redondear = (n: number) => Math.round(n * 100) / 100;
    const nombresProc = [...procedimientos.keys()].sort();
    return {
      enviadas: proformas.length,
      reenvios: proformas.reduce((suma, p) => suma + Math.max((p.veces_enviada || 0) - 1, 0), 0),
      mamas: new Set(proformas.map(p => p.id_solicitud_mat)).size,
      conError: proformas.filter(p => p.estado === 'error').length,
      porProcedimiento: nombresProc.map(procedimiento => {
        const valores = procedimientos.get(procedimiento) || [];
        const total = valores.reduce((a, b) => a + b, 0);
        return {
          procedimiento,
          cotizaciones: valores.length,
          promedio: redondear(total / (valores.length || 1)),
          minimo: Math.min(...valores),
          maximo: Math.max(...valores),
          total: redondear(total),
        };
      }),
      porMes: [...meses.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mes, n]) => ({ mes, etiqueta: `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(2, 4)}`, proformas: n })),
      porAseguradora: [...aseguradoras.entries()].map(([aseguradora, porProc]) => {
        const fila: Record<string, string | number> = { aseguradora };
        porProc.forEach((valores, proc) => { fila[proc] = redondear(valores.reduce((a, b) => a + b, 0) / valores.length); });
        return fila;
      }),
      procedimientos: nombresProc,
    };
  }, [proformas]);
}
