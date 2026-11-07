// Seguimiento de proformas: mamás que recibieron la proforma y no agendaron tour, y si dieron a luz en la clínica
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Baby, ClipboardCheck, Download, Eye, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAseguradorasMaternidad, useSolicitudesMaternidad } from '../../hooks/useMaternidad';
import {
  RESULTADOS_PARTO_MATERNIDAD,
  formatearEstadoSolicitudMaternidad,
  formatearResultadoParto,
  formatearTipoParto,
  getHistorialBySolicitudes,
} from '../../lib/maternidadService';
import type { MaternidadSolicitudVista, ResultadoPartoMaternidad } from '../../lib/supabaseTypes';
import { MaternidadSolicitudDialog } from './MaternidadSolicitudDialog';
import { MaternidadSolicitudModal } from './MaternidadSolicitudModal';
import { MaternidadPartoDialog } from './MaternidadPartoDialog';
import {
  ESTADO_BADGE_MATERNIDAD,
  PARTO_BADGE_MATERNIDAD,
  fechaHoyEcuadorISO,
  SEGUIMIENTO_TOUR,
  enAlerta,
  formatSemanas,
  semanasHoy,
  formatFechaCorta,
  formatFechaHora,
  seguroDe,
  toISOFechaLocal,
} from './maternidadUtils';

interface MaternidadSeguimientoViewProps {
  currentUser: { name: string } | null;
}

const haceTresMeses = () => {
  const d = new Date(`${fechaHoyEcuadorISO()}T00:00:00`);
  d.setMonth(d.getMonth() - 3);
  return toISOFechaLocal(d);
};

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0);

export function MaternidadSeguimientoView({ currentUser }: MaternidadSeguimientoViewProps) {
  const [desde, setDesde] = useState(haceTresMeses);
  const [hasta, setHasta] = useState(fechaHoyEcuadorISO);
  const [aseguradora, setAseguradora] = useState<string>('todas');
  const [parto, setParto] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<MaternidadSolicitudVista | null>(null);
  const [partoDe, setPartoDe] = useState<MaternidadSolicitudVista | null>(null);
  const [solicitudTour, setSolicitudTour] = useState<MaternidadSolicitudVista | null>(null);
  const [exportando, setExportando] = useState(false);
  const usuarioNombre = currentUser?.name || 'Sistema';
  const hoy = fechaHoyEcuadorISO();

  const { aseguradoras } = useAseguradorasMaternidad();
  const { solicitudes, isLoading, loadSolicitudes } = useSolicitudesMaternidad({
    sinTour: true,
    conProformaEnviada: true,
    envioDesde: desde || undefined,
    envioHasta: hasta || undefined,
    idAseguradora: aseguradora !== 'todas' ? parseInt(aseguradora) : undefined,
    resultadoParto: parto !== 'todos' ? (parto as ResultadoPartoMaternidad) : undefined,
    busqueda: busqueda.trim().length >= 3 ? busqueda : undefined,
  });

  // Pendientes primero y, dentro de cada grupo, por fecha probable de parto (las sin semanas al final)
  const filas = useMemo(() => {
    // Fecha probable de parto calculada por la base desde las semanas registradas (082)
    const conFpp = solicitudes.map(s => ({ s, fpp: s.fecha_probable_parto }));
    return conFpp.sort((a, b) => {
      const pa = a.s.resultado_parto === 'pendiente' ? 0 : 1;
      const pb = b.s.resultado_parto === 'pendiente' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (a.fpp && b.fpp) return a.fpp.localeCompare(b.fpp);
      return a.fpp ? -1 : b.fpp ? 1 : 0;
    });
  }, [solicitudes]);

  const clinica = solicitudes.filter(s => s.resultado_parto === 'clinica').length;
  const cerradas = solicitudes.filter(s => s.resultado_parto === 'perdida').length;
  const pendientes = solicitudes.length - clinica - cerradas;
  const enAlertaRoja = solicitudes.filter(s => enAlerta(s.estado_seguimiento)).length;

  const handleLimpiar = () => {
    setDesde(haceTresMeses());
    setHasta(fechaHoyEcuadorISO());
    setAseguradora('todas');
    setParto('todos');
    setBusqueda('');
  };

  const handleExportar = async () => {
    if (filas.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    setExportando(true);
    try {
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas.map(({ s, fpp }) => ({
        'ID': s.id_solicitud_mat,
        'Nombre de la mamá': s.nombre_madre,
        'Cédula': s.cedula,
        'Teléfono': s.telefono,
        'Correo': s.correo,
        'Aseguradora': seguroDe(s),
        'Semanas al registrarse': s.semanas_gestacion ?? '',
        'Semanas actuales': semanasHoy(s) ?? '',
        'Fecha probable de parto': fpp ? formatFechaCorta(fpp) : '',
        'Seguimiento': SEGUIMIENTO_TOUR[s.estado_seguimiento || 'sin_semanas'].label,
        'Fecha registro': formatFechaHora(s.created_at),
        'Última proforma': s.ultima_cotizacion ?? '',
        'Fecha proforma': s.ultima_cotizacion_fecha ? formatFechaHora(s.ultima_cotizacion_fecha) : '',
        'Proformas enviadas': s.correos_enviados,
        'Estado': formatearEstadoSolicitudMaternidad(s.estado),
        'Parto': formatearResultadoParto(s.resultado_parto),
        'Fecha parto': s.fecha_parto ? formatFechaCorta(s.fecha_parto) : '',
        'Tipo parto': formatearTipoParto(s.tipo_parto),
        'Observación parto': s.observacion_parto ?? '',
      }))), 'Seguimiento');

      const historial = await getHistorialBySolicitudes(solicitudes.map(s => s.id_solicitud_mat));
      if (historial.length > 0) {
        const porId = new Map(solicitudes.map(s => [s.id_solicitud_mat, s]));
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(historial.map(h => ({
          'ID solicitud': h.id_solicitud_mat,
          'Mamá': porId.get(h.id_solicitud_mat)?.nombre_madre ?? '',
          'Fecha': formatFechaHora(h.created_at),
          'Tipo': h.tipo,
          'Descripción': h.descripcion,
          'Usuario': h.usuario ?? '',
        }))), 'Historial');
      }
      XLSX.writeFile(libro, `maternidad-seguimiento-${desde || 'inicio'}-a-${hasta || 'hoy'}.xlsx`);
      toast.success(`Descarga completada: ${filas.length} mamás`);
    } catch {
      toast.error('No se pudo generar el Excel');
    } finally {
      setExportando(false);
    }
  };

  const kpi = (titulo: string, valor: string | number, detalleTexto?: string, color = '') => (
    <Card className="p-3">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className={`text-2xl font-semibold ${color}`}>{valor}</p>
      {detalleTexto && <p className="text-xs text-gray-400">{detalleTexto}</p>}
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="flex items-center gap-2">
            <ClipboardCheck className="size-5" />
            Seguimiento de proformas
          </h2>
          <p className="text-sm text-gray-600">Mamás que recibieron la proforma y no agendaron tour: registre si dieron a luz en la clínica</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadSolicitudes}><RefreshCw className="size-4" /></Button>
          <Button size="sm" onClick={handleExportar} disabled={isLoading || exportando}>
            {exportando ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Download className="size-4 mr-1" />} Exportar a Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Proforma enviada desde</Label>
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Seguimiento de parto</Label>
            <Select value={parto} onValueChange={setParto}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {RESULTADOS_PARTO_MATERNIDAD.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Aseguradora</Label>
            <Select value={aseguradora} onValueChange={setAseguradora}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las aseguradoras</SelectItem>
                {aseguradoras.map(a => (
                  <SelectItem key={a.id_aseguradora_mat} value={a.id_aseguradora_mat.toString()}>{a.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Buscar (nombre, cédula, correo o N.º cotización)</Label>
            <div className="flex gap-2">
              <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Mínimo 3 caracteres" />
              <Button variant="outline" onClick={handleLimpiar}>Limpiar</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpi('Proformas sin tour', solicitudes.length, 'Con proforma enviada en el período')}
        {kpi('Pendientes de seguimiento', pendientes, enAlertaRoja > 0 ? `${enAlertaRoja} en alerta (20–40 semanas)` : undefined, 'text-red-600')}
        {kpi('Dieron a luz en la clínica', clinica, `${porcentaje(clinica, solicitudes.length)}% de las proformas sin tour · ${cerradas} cerradas`, 'text-green-700')}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mamá</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Aseguradora</TableHead>
                  <TableHead>Semanas hoy</TableHead>
                  <TableHead>Fecha probable de parto</TableHead>
                  <TableHead>Última proforma</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Parto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      No hay proformas enviadas sin tour con los filtros seleccionados
                    </TableCell>
                  </TableRow>
                ) : (
                  filas.map(({ s, fpp }) => {
                    const pendiente = (s.resultado_parto || 'pendiente') === 'pendiente';
                    const vencida = pendiente && !!fpp && fpp < hoy;
                    const alerta = enAlerta(s.estado_seguimiento);
                    const badgeParto = PARTO_BADGE_MATERNIDAD[s.resultado_parto || 'pendiente'];
                    return (
                      <TableRow key={s.id_solicitud_mat} className={alerta ? 'bg-red-50' : undefined}>
                        <TableCell>
                          <p className="font-medium">{s.nombre_madre}</p>
                          <p className="text-xs text-gray-500">{s.cedula}</p>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{s.telefono}</TableCell>
                        <TableCell className="text-xs">{seguroDe(s) || '—'}</TableCell>
                        <TableCell className={`whitespace-nowrap ${alerta ? 'font-semibold text-red-700' : ''}`}>
                          {formatSemanas(semanasHoy(s))}
                          {s.semanas_gestacion && <p className="text-xs font-normal text-gray-500">{s.semanas_gestacion} al registrarse</p>}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {fpp ? (
                            <span className={vencida ? 'font-medium text-red-600' : ''}>
                              {formatFechaCorta(fpp)}{vencida && ' · ya pasó'}
                            </span>
                          ) : <span className="text-gray-400">Sin semanas</span>}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          <p className="font-mono">{s.ultima_cotizacion || '—'}</p>
                          {s.ultima_cotizacion_fecha && <p className="text-gray-500">{formatFechaHora(s.ultima_cotizacion_fecha)}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ESTADO_BADGE_MATERNIDAD[s.estado].className}>
                            {ESTADO_BADGE_MATERNIDAD[s.estado].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={badgeParto.className}>{badgeParto.label}</Badge>
                          {s.resultado_parto === 'clinica' && (
                            <p className="text-xs text-gray-500 mt-1">
                              {formatearTipoParto(s.tipo_parto)} · {formatFechaCorta(s.fecha_parto)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPartoDe(s)}>
                              <Baby className="size-3 mr-1" />{pendiente ? 'Registrar parto' : 'Editar parto'}
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
