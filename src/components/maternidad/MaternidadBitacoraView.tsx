// Bitácora de tours de maternidad: tours realizados (histórico del Excel + tours del sistema marcados "Asistió"),
// con el seguimiento de la bitácora original y su reportería
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { AlertTriangle, Baby, BarChart3, BookOpen, Download, Eye, List, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useIndicadoresBitacora, useSolicitudesMaternidad } from '../../hooks/useMaternidad';
import { contarToursSinMarcarMaternidad, formatearTipoParto } from '../../lib/maternidadService';
import type { MaternidadSolicitudVista } from '../../lib/supabaseTypes';
import { MaternidadSolicitudDialog } from './MaternidadSolicitudDialog';
import { MaternidadPartoDialog } from './MaternidadPartoDialog';
import { MaternidadSolicitudModal } from './MaternidadSolicitudModal';
import { BitacoraIndicadoresPrincipales, agregarHojasBitacora } from './MaternidadBitacoraReportes';
import { FiltroPeriodoMaternidad, periodoInicial, type PeriodoMaternidad } from './FiltroPeriodoMaternidad';
import {
  FILTROS_SEGUIMIENTO,
  SEGUIMIENTO_TOUR,
  enAlerta,
  formatSemanas,
  fechaHoyEcuadorISO,
  formatFechaCorta,
  formatHorario,
  nombreMes,
  seguimientoTour,
  semanasHoy,
  seguroDe,
} from './maternidadUtils';

interface MaternidadBitacoraViewProps {
  currentUser: { name: string } | null;
  /** Navega a Reportes Maternidad (los indicadores y gráficas viven allí) */
  onVerReportes?: () => void;
}

/** El panel de alertas puede abrir la bitácora con un filtro de seguimiento ya aplicado */
export const CLAVE_FILTRO_BITACORA = 'maternidad-bitacora-filtro';
const filtroInicial = () => {
  try {
    const valor = sessionStorage.getItem(CLAVE_FILTRO_BITACORA);
    sessionStorage.removeItem(CLAVE_FILTRO_BITACORA);
    return FILTROS_SEGUIMIENTO.some(f => f.value === valor) ? (valor as string) : 'todos';
  } catch {
    return 'todos';
  }
};

const textoFirma = (firma: boolean | null) => (firma === true ? 'SI' : firma === false ? 'NO' : '');

export function MaternidadBitacoraView({ currentUser, onVerReportes }: MaternidadBitacoraViewProps) {
  const [periodo, setPeriodo] = useState<PeriodoMaternidad>(() => periodoInicial('este_anio'));
  const { desde, hasta } = periodo;
  const [asesor, setAsesor] = useState('todos');
  const [medico, setMedico] = useState('todos');
  const [seguro, setSeguro] = useState('todos');
  const [seguimiento, setSeguimiento] = useState(filtroInicial);
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<MaternidadSolicitudVista | null>(null);
  const [partoDe, setPartoDe] = useState<MaternidadSolicitudVista | null>(null);
  const [solicitudTour, setSolicitudTour] = useState<MaternidadSolicitudVista | null>(null);
  const [sinMarcar, setSinMarcar] = useState(0);
  const usuarioNombre = currentUser?.name || 'Sistema';

  // La bitácora = tours realizados (estado "asistio"), del Excel histórico y del sistema
  const { solicitudes, isLoading, loadSolicitudes } = useSolicitudesMaternidad({
    estado: 'asistio',
    fechaTourDesde: desde || undefined,
    fechaTourHasta: hasta || undefined,
    busqueda: busqueda.trim().length >= 3 ? busqueda : undefined,
  });

  useEffect(() => {
    contarToursSinMarcarMaternidad(fechaHoyEcuadorISO()).then(setSinMarcar).catch(() => setSinMarcar(0));
  }, [solicitudes]);

  // Opciones de los filtros a partir de los datos cargados
  const asesores = useMemo(() => [...new Set(solicitudes.map(s => s.asesor || 'Sin asesor'))].sort(), [solicitudes]);
  const seguros = useMemo(() => [...new Set(solicitudes.map(s => seguroDe(s) || 'Sin seguro'))].sort(), [solicitudes]);
  const medicos = useMemo(() => [...new Set(solicitudes.map(s => s.medico_ginecologo?.toUpperCase() || 'Sin médico'))].sort(), [solicitudes]);

  // Más recientes primero (el Excel exportado va en orden ascendente, como la bitácora original)
  const tours = useMemo(() => solicitudes
    .filter(s => asesor === 'todos' || (s.asesor || 'Sin asesor') === asesor)
    .filter(s => seguro === 'todos' || (seguroDe(s) || 'Sin seguro') === seguro)
    .filter(s => medico === 'todos' || (s.medico_ginecologo?.toUpperCase() || 'Sin médico') === medico)
    .filter(s => seguimiento === 'todos'
      || !!FILTROS_SEGUIMIENTO.find(f => f.value === seguimiento)?.estados.includes(seguimientoTour(s)))
    .sort((a, b) => (b.fecha_tour || '').localeCompare(a.fecha_tour || '') || (b.numero_bitacora || 0) - (a.numero_bitacora || 0)),
  [solicitudes, asesor, seguro, medico, seguimiento]);

  const ind = useIndicadoresBitacora(tours);

  const handleLimpiar = () => {
    setPeriodo(periodoInicial('este_anio'));
    setAsesor('todos');
    setMedico('todos');
    setSeguro('todos');
    setSeguimiento('todos');
    setBusqueda('');
  };

  const handleExportar = () => {
    if (tours.length === 0) {
      toast.error('No hay tours para exportar');
      return;
    }
    const libro = XLSX.utils.book_new();
    agregarHojasBitacora(libro, tours, ind, `${formatFechaCorta(desde)} – ${formatFechaCorta(hasta)}`);
    XLSX.writeFile(libro, `bitacora-tours-maternidad-${desde || 'inicio'}-a-${hasta || 'hoy'}.xlsx`);
    toast.success(`Descarga completada: ${tours.length} tours`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="flex items-center gap-2">
            <BookOpen className="size-5" />
            Bitácora de Tours
          </h2>
          <p className="text-sm text-gray-600">Tours de maternidad realizados: histórico de la bitácora y tours marcados como "Asistió"</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadSolicitudes}><RefreshCw className="size-4" /></Button>
          {onVerReportes && (
            <Button size="sm" variant="outline" onClick={onVerReportes}>
              <BarChart3 className="size-4 mr-1" /> Ver reportes
            </Button>
          )}
          <Button size="sm" onClick={handleExportar} disabled={isLoading}>
            <Download className="size-4 mr-1" /> Exportar bitácora
          </Button>
        </div>
      </div>

      {sinMarcar > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <p>
            Hay <strong>{sinMarcar}</strong> {sinMarcar === 1 ? 'tour agendado' : 'tours agendados'} con fecha pasada sin marcar asistencia.
            Márquelos como "Asistió" o "No asistió" en Tours Maternidad para que la bitácora quede completa.
          </p>
        </div>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FiltroPeriodoMaternidad periodo={periodo} onChange={setPeriodo} etiqueta="Período (fecha del tour)" />
          <div className="space-y-1">
            <Label className="text-xs">Seguimiento</Label>
            <Select value={seguimiento} onValueChange={setSeguimiento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {FILTROS_SEGUIMIENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Asesor</Label>
            <Select value={asesor} onValueChange={setAsesor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los asesores</SelectItem>
                {asesores.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Seguro</Label>
            <Select value={seguro} onValueChange={setSeguro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los seguros</SelectItem>
                {seguros.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Médico tratante</Label>
            <Select value={medico} onValueChange={setMedico}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los médicos</SelectItem>
                {medicos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Buscar (nombre, teléfono, cédula o médico)</Label>
            <div className="flex gap-2">
              <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Mínimo 3 caracteres" />
              <Button variant="outline" onClick={handleLimpiar}>Limpiar</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Indicadores */}
      <BitacoraIndicadoresPrincipales ind={ind} />

      <div className="space-y-2">
        <h3 className="flex items-center gap-2 font-medium"><List className="size-4" />Registro ({tours.length})</h3>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Nombres</TableHead>
                      <TableHead>Médico tratante</TableHead>
                      <TableHead>Semanas</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Horario</TableHead>
                      <TableHead>Asesor</TableHead>
                      <TableHead>Seguro</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Semanas hoy</TableHead>
                      <TableHead>Seguimiento</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tours.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-8 text-gray-500">No hay tours con los filtros seleccionados</TableCell>
                      </TableRow>
                    ) : (
                      tours.map(s => {
                        const estado = seguimientoTour(s);
                        const semanas = semanasHoy(s);
                        const alerta = enAlerta(estado);
                        const parto = s.resultado_parto === 'clinica';
                        return (
                          <TableRow key={s.id_solicitud_mat} className={alerta ? 'bg-red-50' : undefined}>
                            <TableCell className="font-mono text-xs">{s.numero_bitacora ?? '—'}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {formatFechaCorta(s.fecha_tour)}
                              <p className="text-gray-500 capitalize">{nombreMes(s.fecha_tour)}</p>
                            </TableCell>
                            <TableCell className="font-medium">{s.nombre_madre}</TableCell>
                            <TableCell className="text-xs">{s.medico_ginecologo || '—'}</TableCell>
                            <TableCell>{s.semanas_gestacion ?? '—'}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{s.telefono || '—'}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {s.hora_inicio_real ? formatHorario(s.hora_inicio_real, s.hora_fin_real) : '—'}
                            </TableCell>
                            <TableCell className="text-xs">{s.asesor || '—'}</TableCell>
                            <TableCell className="text-xs">{seguroDe(s) || '—'}</TableCell>
                            <TableCell className="text-xs">{textoFirma(s.firma_paciente) || '—'}</TableCell>
                            <TableCell className={`whitespace-nowrap ${alerta ? 'font-semibold text-red-700' : ''}`}>
                              {formatSemanas(semanas)}
                              {s.fecha_probable_parto && <p className="text-xs font-normal text-gray-500">FPP {formatFechaCorta(s.fecha_probable_parto)}</p>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={SEGUIMIENTO_TOUR[estado].className}>{SEGUIMIENTO_TOUR[estado].label}</Badge>
                              {parto && s.fecha_parto && (
                                <p className="text-xs text-gray-500 mt-1">{formatearTipoParto(s.tipo_parto)} · {formatFechaCorta(s.fecha_parto)}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPartoDe(s)}>
                                  <Baby className="size-3 mr-1" />{parto ? 'Editar parto' : 'Registrar parto'}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDetalle(s)}>
                                  <Eye className="size-3 mr-1" />Detalle
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
      </div>

      <MaternidadPartoDialog
        solicitud={partoDe}
        usuarioNombre={usuarioNombre}
        onOpenChange={open => { if (!open) setPartoDe(null); }}
        onGuardado={loadSolicitudes}
      />
      <MaternidadSolicitudDialog
        solicitud={detalle}
        onOpenChange={open => { if (!open) setDetalle(null); }}
        usuarioNombre={usuarioNombre}
        onAgendarTour={s => { setDetalle(null); setSolicitudTour(s); }}
        onActualizado={loadSolicitudes}
      />
      <MaternidadSolicitudModal
        open={!!solicitudTour}
        onOpenChange={open => { if (!open) setSolicitudTour(null); }}
        solicitudBase={solicitudTour}
        usuarioNombre={usuarioNombre}
        onGuardado={loadSolicitudes}
      />
    </div>
  );
}
