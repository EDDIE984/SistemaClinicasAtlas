// Reportes del módulo Maternidad: filtros, indicadores estadísticos, gráficas y exportación a Excel
import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { BarChart3, Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAseguradorasMaternidad, useIndicadoresMaternidad, useSolicitudesMaternidad } from '../../hooks/useMaternidad';
import { ESTADOS_SOLICITUD_MATERNIDAD, formatearEstadoSolicitudMaternidad } from '../../lib/maternidadService';
import type { EstadoSolicitudMaternidad, MaternidadSolicitudVista } from '../../lib/supabaseTypes';
import { MaternidadSolicitudDialog } from './MaternidadSolicitudDialog';
import { MaternidadSolicitudModal } from './MaternidadSolicitudModal';
import { ESTADO_BADGE_MATERNIDAD, fechaHoyEcuadorISO, formatFechaHora, formatHorario } from './maternidadUtils';

interface MaternidadReportesViewProps {
  currentUser: { name: string } | null;
}

const COLORES_ESTADO: Record<EstadoSolicitudMaternidad, string> = {
  solo_cotizacion: '#d97706',
  agendada: '#2563eb',
  confirmada: '#9333ea',
  asistio: '#16a34a',
  no_asistio: '#dc2626',
  cancelada: '#6b7280',
};

const primerDiaMes = () => `${fechaHoyEcuadorISO().slice(0, 8)}01`;

export function MaternidadReportesView({ currentUser }: MaternidadReportesViewProps) {
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(fechaHoyEcuadorISO);
  const [estado, setEstado] = useState<string>('todos');
  const [aseguradora, setAseguradora] = useState<string>('todas');
  const [origen, setOrigen] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<MaternidadSolicitudVista | null>(null);
  const [solicitudTour, setSolicitudTour] = useState<MaternidadSolicitudVista | null>(null);
  const usuarioNombre = currentUser?.name || 'Sistema';

  const { aseguradoras } = useAseguradorasMaternidad();
  const { solicitudes, isLoading, loadSolicitudes } = useSolicitudesMaternidad({
    registroDesde: desde || undefined,
    registroHasta: hasta || undefined,
    estado: estado !== 'todos' ? (estado as EstadoSolicitudMaternidad) : undefined,
    idAseguradora: aseguradora !== 'todas' ? parseInt(aseguradora) : undefined,
    origen: origen !== 'todos' ? (origen as 'CHATBOT' | 'SISTEMA') : undefined,
    busqueda: busqueda.trim().length >= 3 ? busqueda : undefined,
  });
  const ind = useIndicadoresMaternidad(solicitudes);

  const handleLimpiar = () => {
    setDesde(primerDiaMes());
    setHasta(fechaHoyEcuadorISO());
    setEstado('todos');
    setAseguradora('todas');
    setOrigen('todos');
    setBusqueda('');
  };

  const handleExportar = () => {
    if (solicitudes.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    const filas = solicitudes.map(s => ({
      'ID': s.id_solicitud_mat,
      'Fecha registro': formatFechaHora(s.created_at),
      'Nombre de la mamá': s.nombre_madre,
      'Cédula': s.cedula,
      'Semanas de gestación': s.semanas_gestacion ?? '',
      'Correo': s.correo,
      'Teléfono': s.telefono,
      'Médico ginecólogo': s.medico_ginecologo ?? '',
      'Aseguradora': s.aseguradora ?? '',
      'Estado': formatearEstadoSolicitudMaternidad(s.estado),
      'Fecha tour': s.fecha_tour_formato ?? '',
      'Día': s.dia_nombre ?? '',
      'Turno': s.horario ?? '',
      'Origen': s.origen === 'CHATBOT' ? 'WhatsApp' : 'Sistema',
      'Registrado por': s.creado_por ?? '',
      'Última cotización': s.ultima_cotizacion ?? '',
      'Fecha última cotización': s.ultima_cotizacion_fecha ? formatFechaHora(s.ultima_cotizacion_fecha) : '',
      'Cotizaciones emitidas': s.cotizaciones_emitidas ?? 0,
      'Correos enviados': s.correos_enviados,
      'Correos con error': s.correos_error,
      'Último correo': s.ultimo_correo_estado ?? '',
      'Observaciones': s.notas ?? '',
    }));
    const resumen = [
      { Indicador: 'Período', Valor: `${desde || '—'} a ${hasta || '—'}` },
      { Indicador: 'Total solicitudes', Valor: ind.total },
      { Indicador: 'Solo cotización', Valor: ind.soloCotizacion },
      { Indicador: 'Con tour agendado', Valor: ind.conTour },
      { Indicador: 'Conversión cotización → tour (%)', Valor: ind.conversion },
      { Indicador: 'Asistieron', Valor: ind.asistieron },
      { Indicador: 'No asistieron', Valor: ind.noAsistieron },
      { Indicador: 'Tasa de asistencia (%)', Valor: ind.tasaAsistencia },
      { Indicador: 'Canceladas', Valor: ind.canceladas },
      { Indicador: 'Correos enviados', Valor: ind.correosEnviados },
      { Indicador: 'Correos con error', Valor: ind.correosError },
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Solicitudes');
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resumen), 'Indicadores');
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.json_to_sheet(ind.porAseguradora.map(a => ({ Aseguradora: a.aseguradora, Solicitudes: a.total, Tours: a.tours }))),
      'Por aseguradora',
    );
    XLSX.writeFile(libro, `maternidad-${desde || 'inicio'}-a-${hasta || 'hoy'}.xlsx`);
    toast.success(`Descarga completada: ${solicitudes.length} solicitudes`);
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
            <BarChart3 className="size-5" />
            Reportes de Maternidad
          </h2>
          <p className="text-sm text-gray-600">Solicitudes de cotización y tours por fecha de registro</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadSolicitudes}><RefreshCw className="size-4" /></Button>
          <Button size="sm" onClick={handleExportar} disabled={isLoading}>
            <Download className="size-4 mr-1" /> Exportar a Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS_SOLICITUD_MATERNIDAD.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
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
          <div className="space-y-1">
            <Label className="text-xs">Origen</Label>
            <Select value={origen} onValueChange={setOrigen}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="CHATBOT">WhatsApp</SelectItem>
                <SelectItem value="SISTEMA">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Buscar (nombre, cédula, correo o N.º cotización)</Label>
            <div className="flex gap-2">
              <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Mínimo 3 caracteres" />
              <Button variant="outline" onClick={handleLimpiar}>Limpiar</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpi('Total solicitudes', ind.total)}
        {kpi('Solo cotización', ind.soloCotizacion, 'Pendientes de agendar tour', 'text-amber-600')}
        {kpi('Tours agendados', ind.conTour, `${ind.conversion}% de conversión`, 'text-blue-600')}
        {kpi('Tasa de asistencia', `${ind.tasaAsistencia}%`, `${ind.asistieron} asistieron · ${ind.noAsistieron} no asistieron`, 'text-green-700')}
        {kpi('Canceladas', ind.canceladas, undefined, 'text-gray-600')}
        {kpi('Por WhatsApp', ind.porOrigen.find(o => o.origen === 'CHATBOT')?.total || 0)}
        {kpi('Desde el sistema', ind.porOrigen.find(o => o.origen === 'SISTEMA')?.total || 0)}
        {kpi('Correos', ind.correosEnviados, `${ind.correosError} con error`, ind.correosError > 0 ? 'text-red-600' : '')}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          {/* Gráficas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-medium mb-2">Solicitudes por día</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ind.porDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickFormatter={(f: string) => f.slice(5)} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="solicitudes" name="Solicitudes" fill="#d97706" />
                  <Bar dataKey="tours" name="Con tour" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4">
              <h3 className="font-medium mb-2">Solicitudes por estado</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={ind.porEstado.map(e => ({ ...e, nombre: formatearEstadoSolicitudMaternidad(e.estado) }))}
                    dataKey="total"
                    nameKey="nombre"
                    outerRadius={90}
                    label
                  >
                    {ind.porEstado.map(e => <Cell key={e.estado} fill={COLORES_ESTADO[e.estado]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4">
              <h3 className="font-medium mb-2">Solicitudes por aseguradora</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ind.porAseguradora} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="aseguradora" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" name="Solicitudes" fill="#9333ea" />
                  <Bar dataKey="tours" name="Tours" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4">
              <h3 className="font-medium mb-2">Ocupación por turno</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ind.porHorario}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="horario" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="tours" name="Tours" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Detalle */}
          <Card>
            <div className="p-4 pb-0">
              <h3 className="font-medium">Detalle ({solicitudes.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registro</TableHead>
                    <TableHead>Mamá</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Semanas</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Aseguradora</TableHead>
                    <TableHead>Tour</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Cotización</TableHead>
                    <TableHead>Correo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitudes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-gray-500">No hay solicitudes con los filtros seleccionados</TableCell>
                    </TableRow>
                  ) : (
                    solicitudes.map(s => (
                      <TableRow key={s.id_solicitud_mat} className="cursor-pointer" onClick={() => setDetalle(s)}>
                        <TableCell className="text-xs whitespace-nowrap">{formatFechaHora(s.created_at)}</TableCell>
                        <TableCell className="font-medium">{s.nombre_madre}</TableCell>
                        <TableCell>{s.cedula}</TableCell>
                        <TableCell>{s.semanas_gestacion ?? '—'}</TableCell>
                        <TableCell>{s.telefono}</TableCell>
                        <TableCell>{s.aseguradora}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {s.fecha_tour ? `${s.fecha_tour_formato} ${formatHorario(s.hora_inicio)}` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ESTADO_BADGE_MATERNIDAD[s.estado].className}>{ESTADO_BADGE_MATERNIDAD[s.estado].label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{s.origen === 'CHATBOT' ? 'WhatsApp' : 'Sistema'}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{s.ultima_cotizacion || '—'}</TableCell>
                        <TableCell>
                          {s.ultimo_correo_estado ? (
                            <Badge variant={s.ultimo_correo_estado === 'enviado' ? 'default' : 'destructive'}>
                              {s.ultimo_correo_estado === 'enviado' ? 'Enviado' : 'Error'}
                            </Badge>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

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
