// Reporte único de maternidad: bitácora de tours (histórico + tours del sistema), seguimiento de parto,
// proformas enviadas con sus valores y embudo comercial. Un solo juego de filtros y un Excel con lo filtrado.
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { BarChart3, Download, Filter, List, Loader2, Receipt, RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  useEmbudoComercial,
  useIndicadoresBitacora,
  useIndicadoresProformas,
  useProformasMaternidad,
  useSolicitudesMaternidad,
} from '../../hooks/useMaternidad';
import {
  RESULTADOS_PARTO_MATERNIDAD,
  formatearResultadoParto,
  generarPdfCotizacionMaternidad,
  getEnviosCorreoBySolicitudes,
  getHistorialBySolicitudes,
  getSolicitudVistaMaternidad,
} from '../../lib/maternidadService';
import type {
  MaternidadEnvioCorreo,
  MaternidadProforma,
  MaternidadSolicitudVista,
  OrigenSolicitudMaternidad,
  ResultadoPartoMaternidad,
} from '../../lib/supabaseTypes';
import { MaternidadSolicitudDialog } from './MaternidadSolicitudDialog';
import { MaternidadSolicitudModal } from './MaternidadSolicitudModal';
import {
  BitacoraIndicadoresPrincipales,
  BitacoraReportes,
  EmbudoComercialCard,
  agregarHojaEmbudo,
  agregarHojasBitacora,
} from './MaternidadBitacoraReportes';
import { ProformasReporte, agregarHojasProformas, primerEnvioPorProforma } from './MaternidadProformasReporte';
import { FiltroPeriodoMaternidad, periodoInicial, type PeriodoMaternidad } from './FiltroPeriodoMaternidad';
import {
  ETIQUETA_ORIGEN_MATERNIDAD,
  FILTROS_SEGUIMIENTO,
  SEGUIMIENTO_TOUR,
  enAlerta,
  formatFechaCorta,
  formatSemanas,
  seguimientoTour,
  semanasHoy,
  seguroDe,
} from './maternidadUtils';

interface MaternidadReportesViewProps {
  currentUser: { name: string } | null;
}

const TODOS = 'todos';
const POR_PAGINA = 50;

const filtrosVacios = {
  asesor: TODOS,
  seguro: TODOS,
  medico: TODOS,
  origen: TODOS,
  seguimiento: TODOS,
  parto: TODOS,
  firma: TODOS,
  semanasMin: '',
  semanasMax: '',
  busqueda: '',
};

export function MaternidadReportesView({ currentUser }: MaternidadReportesViewProps) {
  const [periodo, setPeriodo] = useState<PeriodoMaternidad>(() => periodoInicial('este_anio'));
  const [f, setF] = useState(filtrosVacios);
  const [pagina, setPagina] = useState(0);
  const [detalle, setDetalle] = useState<MaternidadSolicitudVista | null>(null);
  const [solicitudTour, setSolicitudTour] = useState<MaternidadSolicitudVista | null>(null);
  const [exportando, setExportando] = useState(false);
  const [imprimiendoId, setImprimiendoId] = useState<number | null>(null);
  const [envios, setEnvios] = useState<MaternidadEnvioCorreo[]>([]);
  const usuarioNombre = currentUser?.name || 'Sistema';
  const set = (campo: keyof typeof filtrosVacios, valor: string) => {
    setF(prev => ({ ...prev, [campo]: valor }));
    setPagina(0);
  };
  const busqueda = f.busqueda.trim().length >= 3 ? f.busqueda.trim() : undefined;

  // ── Datos ───────────────────────────────────────────────────────────────────
  // Tours realizados (bitácora): el período se aplica a la fecha del tour
  const { solicitudes: tours, isLoading: cargandoTours, loadSolicitudes: loadTours } = useSolicitudesMaternidad({
    estado: 'asistio',
    fechaTourDesde: periodo.desde || undefined,
    fechaTourHasta: periodo.hasta || undefined,
    origen: f.origen !== TODOS ? (f.origen as OrigenSolicitudMaternidad) : undefined,
    resultadoParto: f.parto !== TODOS ? (f.parto as ResultadoPartoMaternidad) : undefined,
    busqueda,
  });
  // Embudo: solicitudes de WhatsApp / plataforma registradas en el período
  const { solicitudes: solicitudesEmbudo, loadSolicitudes: loadEmbudo } = useSolicitudesMaternidad({
    registroDesde: periodo.desde || undefined,
    registroHasta: periodo.hasta || undefined,
    excluirOrigen: 'BITACORA',
    busqueda,
  });
  // Proformas enviadas en el período (por fecha de envío)
  const { proformas, isLoading: cargandoProformas, loadProformas } = useProformasMaternidad(
    periodo.desde || undefined,
    periodo.hasta || undefined,
  );

  // Filtros que se aplican en el navegador
  const toursFiltrados = useMemo(() => {
    const min = f.semanasMin ? Number(f.semanasMin) : null;
    const max = f.semanasMax ? Number(f.semanasMax) : null;
    const estadosSeguimiento = FILTROS_SEGUIMIENTO.find(x => x.value === f.seguimiento)?.estados;
    return tours
      .filter(s => f.asesor === TODOS || (s.asesor || 'Sin asesor') === f.asesor)
      .filter(s => f.seguro === TODOS || (seguroDe(s) || 'Sin seguro') === f.seguro)
      .filter(s => f.medico === TODOS || (s.medico_ginecologo?.toUpperCase() || 'Sin médico') === f.medico)
      .filter(s => !estadosSeguimiento || estadosSeguimiento.includes(seguimientoTour(s)))
      .filter(s => f.firma === TODOS
        || (f.firma === 'si' && s.firma_paciente === true)
        || (f.firma === 'no' && s.firma_paciente === false)
        || (f.firma === 'sin_dato' && s.firma_paciente === null))
      .filter(s => min === null || (s.semanas_gestacion !== null && s.semanas_gestacion >= min))
      .filter(s => max === null || (s.semanas_gestacion !== null && s.semanas_gestacion <= max))
      .sort((a, b) => (b.fecha_tour || '').localeCompare(a.fecha_tour || '') || (b.numero_bitacora || 0) - (a.numero_bitacora || 0));
  }, [tours, f]);

  const proformasFiltradas = useMemo(() => {
    const texto = busqueda?.toLowerCase();
    return proformas
      .filter(p => f.seguro === TODOS || (p.aseguradora || 'Sin seguro') === f.seguro)
      .filter(p => !texto
        || p.numero_cotizacion.toLowerCase().includes(texto)
        || (p.solicitud?.nombre_madre || '').toLowerCase().includes(texto)
        || (p.solicitud?.cedula || '').includes(texto)
        || (p.solicitud?.telefono || '').includes(texto));
  }, [proformas, f.seguro, busqueda]);

  const indBitacora = useIndicadoresBitacora(toursFiltrados);
  const indProformas = useIndicadoresProformas(proformasFiltradas);
  const embudo = useEmbudoComercial(solicitudesEmbudo);

  // Fechas de cada envío de las proformas (primer envío, hoja Envíos)
  useEffect(() => {
    const ids = [...new Set(proformasFiltradas.map(p => p.id_solicitud_mat))];
    if (ids.length === 0) {
      setEnvios([]);
      return;
    }
    let cancelado = false;
    getEnviosCorreoBySolicitudes(ids).then(r => { if (!cancelado) setEnvios(r); }).catch(() => setEnvios([]));
    return () => { cancelado = true; };
  }, [proformasFiltradas]);
  const primerEnvio = useMemo(() => primerEnvioPorProforma(envios), [envios]);

  // Opciones de los filtros a partir de los datos del período
  const opciones = useMemo(() => ({
    asesores: [...new Set(tours.map(s => s.asesor || 'Sin asesor'))].sort(),
    seguros: [...new Set([...tours.map(s => seguroDe(s) || 'Sin seguro'), ...proformas.map(p => p.aseguradora || 'Sin seguro')])].sort(),
    medicos: [...new Set(tours.map(s => s.medico_ginecologo?.toUpperCase() || 'Sin médico'))].sort(),
  }), [tours, proformas]);

  // Resumen de lo aplicado (pantalla y hoja Resumen del Excel)
  const filtrosAplicados = useMemo(() => {
    const lista: { Filtro: string; Valor: string }[] = [];
    const agregar = (nombre: string, valor: string, etiqueta?: string) => {
      if (valor && valor !== TODOS) lista.push({ Filtro: nombre, Valor: etiqueta || valor });
    };
    agregar('Asesor', f.asesor);
    agregar('Seguro', f.seguro);
    agregar('Médico tratante', f.medico);
    agregar('Origen', f.origen, ETIQUETA_ORIGEN_MATERNIDAD[f.origen]);
    agregar('Seguimiento', f.seguimiento, FILTROS_SEGUIMIENTO.find(x => x.value === f.seguimiento)?.label);
    agregar('Parto', f.parto, formatearResultadoParto(f.parto as ResultadoPartoMaternidad));
    agregar('Firma', f.firma, f.firma === 'si' ? 'Sí' : f.firma === 'no' ? 'No' : 'Sin dato');
    if (f.semanasMin || f.semanasMax) lista.push({ Filtro: 'Semanas al tour', Valor: `${f.semanasMin || '—'} a ${f.semanasMax || '—'}` });
    if (busqueda) lista.push({ Filtro: 'Búsqueda', Valor: busqueda });
    return lista;
  }, [f, busqueda]);

  const textoPeriodo = `${formatFechaCorta(periodo.desde)} – ${formatFechaCorta(periodo.hasta)}`;
  const paginas = Math.max(1, Math.ceil(toursFiltrados.length / POR_PAGINA));
  const visibles = toursFiltrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  const recargarTodo = () => {
    loadTours();
    loadEmbudo();
    loadProformas();
  };

  const handleLimpiar = () => {
    setPeriodo(periodoInicial('este_anio'));
    setF(filtrosVacios);
    setPagina(0);
  };

  // ── Acciones ────────────────────────────────────────────────────────────────
  const handleExportar = async () => {
    if (toursFiltrados.length === 0 && proformasFiltradas.length === 0 && solicitudesEmbudo.length === 0) {
      toast.error('No hay datos para exportar con los filtros aplicados');
      return;
    }
    setExportando(true);
    try {
      const libro = XLSX.utils.book_new();
      agregarHojasBitacora(libro, toursFiltrados, indBitacora, textoPeriodo, '', filtrosAplicados);
      agregarHojaEmbudo(libro, embudo, textoPeriodo);
      agregarHojasProformas(libro, proformasFiltradas, envios, indProformas);
      const historial = await getHistorialBySolicitudes(toursFiltrados.map(s => s.id_solicitud_mat)).catch(() => []);
      if (historial.length > 0) {
        const porId = new Map(toursFiltrados.map(s => [s.id_solicitud_mat, s]));
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(historial.map(h => ({
          '# bitácora': porId.get(h.id_solicitud_mat)?.numero_bitacora ?? '',
          'Mamá': porId.get(h.id_solicitud_mat)?.nombre_madre ?? '',
          'Fecha': new Date(h.created_at).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }),
          'Tipo': h.tipo,
          'Descripción': h.descripcion,
          'Usuario': h.usuario ?? '',
        }))), 'Historial');
      }
      XLSX.writeFile(libro, `reporte-maternidad-${periodo.desde || 'inicio'}-a-${periodo.hasta || 'hoy'}.xlsx`);
      toast.success(`Descarga completada: ${toursFiltrados.length} tours y ${proformasFiltradas.length} proformas`);
    } catch {
      toast.error('No se pudo generar el Excel');
    } finally {
      setExportando(false);
    }
  };

  const handleImprimir = async (proforma: MaternidadProforma) => {
    if (!proforma.solicitud) return;
    setImprimiendoId(proforma.id_cotizacion_mat);
    try {
      window.open(await generarPdfCotizacionMaternidad(proforma.solicitud, proforma), '_blank', 'noopener');
    } catch {
      toast.error('No se pudo generar el presupuesto');
    } finally {
      setImprimiendoId(null);
    }
  };

  const abrirDetalle = async (idSolicitud: number) => {
    try {
      const vista = await getSolicitudVistaMaternidad(idSolicitud);
      if (vista) setDetalle(vista);
    } catch {
      toast.error('No se pudo abrir la solicitud');
    }
  };

  // ── Pantalla ────────────────────────────────────────────────────────────────
  const selector = (etiqueta: string, campo: keyof typeof filtrosVacios, opcionesLista: { value: string; label: string }[], todos: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{etiqueta}</Label>
      <Select value={f[campo]} onValueChange={v => set(campo, v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>{todos}</SelectItem>
          {opcionesLista.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
  const comoOpciones = (lista: string[]) => lista.map(v => ({ value: v, label: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="flex items-center gap-2">
            <BarChart3 className="size-5" />
            Reportes de Maternidad
          </h2>
          <p className="text-sm text-gray-600">Tours realizados, seguimiento de parto, proformas enviadas y embudo comercial</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={recargarTodo}><RefreshCw className="size-4" /></Button>
          <Button size="sm" onClick={handleExportar} disabled={cargandoTours || exportando}>
            {exportando ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Download className="size-4 mr-1" />} Exportar a Excel
          </Button>
        </div>
      </div>

      {/* Filtros: un solo juego para todo el reporte */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FiltroPeriodoMaternidad periodo={periodo} onChange={p => { setPeriodo(p); setPagina(0); }} etiqueta="Período (fecha del tour / envío)" />
          {selector('Origen', 'origen', [
            { value: 'BITACORA', label: 'Bitácora histórica' },
            { value: 'CHATBOT', label: 'WhatsApp' },
            { value: 'SISTEMA', label: 'Sistema' },
          ], 'Todos los orígenes')}
          {selector('Asesor', 'asesor', comoOpciones(opciones.asesores), 'Todos los asesores')}
          {selector('Seguro', 'seguro', comoOpciones(opciones.seguros), 'Todos los seguros')}
          {selector('Médico tratante', 'medico', comoOpciones(opciones.medicos), 'Todos los médicos')}
          {selector('Seguimiento', 'seguimiento', FILTROS_SEGUIMIENTO.map(x => ({ value: x.value, label: x.label })), 'Todos')}
          {selector('Parto', 'parto', RESULTADOS_PARTO_MATERNIDAD.map(r => ({
            value: r.value,
            label: r.value === 'perdida' ? 'Seguimiento cerrado' : r.label,
          })), 'Todos')}
          {selector('Firma', 'firma', [
            { value: 'si', label: 'Firmó' },
            { value: 'no', label: 'No firmó' },
            { value: 'sin_dato', label: 'Sin dato' },
          ], 'Todas')}
          <div className="space-y-1">
            <Label className="text-xs">Semanas al tour</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min="1" max="45" placeholder="Desde" value={f.semanasMin} onChange={e => set('semanasMin', e.target.value)} />
              <Input type="number" min="1" max="45" placeholder="Hasta" value={f.semanasMax} onChange={e => set('semanasMax', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Buscar (nombre, teléfono, cédula, médico o N.º de proforma)</Label>
            <div className="flex gap-2">
              <Input value={f.busqueda} onChange={e => set('busqueda', e.target.value)} placeholder="Mínimo 3 caracteres" />
              <Button variant="outline" onClick={handleLimpiar}>Limpiar</Button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-gray-600">
          <Filter className="size-3" />
          <span><strong>{toursFiltrados.length}</strong> tours · {proformasFiltradas.length} proformas · {textoPeriodo}</span>
          {filtrosAplicados.map(x => (
            <Badge key={x.Filtro} variant="outline" className="font-normal">{x.Filtro}: {x.Valor}</Badge>
          ))}
        </div>
      </Card>

      {cargandoTours ? (
        <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <BitacoraIndicadoresPrincipales ind={indBitacora} />

          <Tabs defaultValue="tours">
            <TabsList>
              <TabsTrigger value="tours"><BarChart3 className="size-4 mr-1" />Tours y seguimiento</TabsTrigger>
              <TabsTrigger value="proformas"><Receipt className="size-4 mr-1" />Proformas ({proformasFiltradas.length})</TabsTrigger>
              <TabsTrigger value="embudo"><TrendingUp className="size-4 mr-1" />Embudo comercial</TabsTrigger>
              <TabsTrigger value="detalle"><List className="size-4 mr-1" />Detalle de tours ({toursFiltrados.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="tours" className="pt-2">
              {toursFiltrados.length === 0
                ? <p className="text-sm text-gray-500 text-center py-12">No hay tours con los filtros aplicados.</p>
                : <BitacoraReportes ind={indBitacora} />}
            </TabsContent>

            <TabsContent value="proformas" className="pt-2 space-y-2">
              <p className="text-xs text-gray-500">Proformas enviadas por WhatsApp o la plataforma en el período (fecha de envío). Aplican los filtros Seguro y Búsqueda.</p>
              <ProformasReporte
                key={`${periodo.desde}-${periodo.hasta}-${f.seguro}-${busqueda || ''}`}
                proformas={proformasFiltradas}
                ind={indProformas}
                primerEnvio={primerEnvio}
                isLoading={cargandoProformas}
                imprimiendoId={imprimiendoId}
                onImprimir={handleImprimir}
                onDetalle={p => abrirDetalle(p.id_solicitud_mat)}
              />
            </TabsContent>

            <TabsContent value="embudo" className="pt-2">
              <EmbudoComercialCard embudo={embudo} />
            </TabsContent>

            <TabsContent value="detalle" className="pt-2">
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Fecha tour</TableHead>
                        <TableHead>Mamá</TableHead>
                        <TableHead>Médico tratante</TableHead>
                        <TableHead>Semanas hoy</TableHead>
                        <TableHead>Asesor</TableHead>
                        <TableHead>Seguro</TableHead>
                        <TableHead>Seguimiento</TableHead>
                        <TableHead>Parto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-gray-500">No hay tours con los filtros aplicados</TableCell>
                        </TableRow>
                      ) : visibles.map(s => {
                        const estado = seguimientoTour(s);
                        return (
                          <TableRow
                            key={s.id_solicitud_mat}
                            className={`cursor-pointer ${enAlerta(estado) ? 'bg-red-50' : ''}`}
                            onClick={() => setDetalle(s)}
                          >
                            <TableCell className="font-mono text-xs">{s.numero_bitacora ?? '—'}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{formatFechaCorta(s.fecha_tour)}</TableCell>
                            <TableCell className="font-medium">{s.nombre_madre}</TableCell>
                            <TableCell className="text-xs">{s.medico_ginecologo || '—'}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{formatSemanas(semanasHoy(s))}</TableCell>
                            <TableCell className="text-xs">{s.asesor || '—'}</TableCell>
                            <TableCell className="text-xs">{seguroDe(s) || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={SEGUIMIENTO_TOUR[estado].className}>{SEGUIMIENTO_TOUR[estado].label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{formatearResultadoParto(s.resultado_parto)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {paginas > 1 && (
                  <div className="flex items-center justify-end gap-2 p-3 text-sm">
                    <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</Button>
                    <span>Página {pagina + 1} de {paginas}</span>
                    <Button size="sm" variant="outline" disabled={pagina >= paginas - 1} onClick={() => setPagina(p => p + 1)}>Siguiente</Button>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <MaternidadSolicitudDialog
        solicitud={detalle}
        onOpenChange={open => { if (!open) setDetalle(null); }}
        usuarioNombre={usuarioNombre}
        onAgendarTour={s => { setDetalle(null); setSolicitudTour(s); }}
        onActualizado={recargarTodo}
      />
      <MaternidadSolicitudModal
        open={!!solicitudTour}
        onOpenChange={open => { if (!open) setSolicitudTour(null); }}
        solicitudBase={solicitudTour}
        usuarioNombre={usuarioNombre}
        onGuardado={recargarTodo}
      />
    </div>
  );
}
