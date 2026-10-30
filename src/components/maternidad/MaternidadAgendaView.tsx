// Agenda de tours de maternidad: calendario semanal por turnos con ocupación, y cotizaciones pendientes de tour
import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Baby, CalendarDays, ChevronLeft, ChevronRight, List, Loader2, Plus, RefreshCw, FileText, XCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { toast } from 'sonner';
import { useHorariosMaternidad, useSolicitudesMaternidad } from '../../hooks/useMaternidad';
import { ESTADOS_CON_TOUR, mensajeErrorMaternidad, updateEstadoSolicitudMaternidad } from '../../lib/maternidadService';
import type { MaternidadSolicitud, MaternidadSolicitudVista } from '../../lib/supabaseTypes';
import { MaternidadSolicitudModal } from './MaternidadSolicitudModal';
import { MaternidadSolicitudDialog } from './MaternidadSolicitudDialog';
import {
  ESTADO_BADGE_MATERNIDAD,
  diaSemanaISO,
  fechaHoyEcuadorISO,
  formatFechaHora,
  formatHorario,
  getDiasSemana,
  getLunesDeSemana,
  toISOFechaLocal,
  turnoYaPaso,
} from './maternidadUtils';

interface MaternidadAgendaViewProps {
  currentUser: { name: string } | null;
}

interface ModalState {
  open: boolean;
  solicitudBase?: MaternidadSolicitud | null;
  fecha?: string;
  idHorario?: number;
}

export function MaternidadAgendaView({ currentUser }: MaternidadAgendaViewProps) {
  const [lunes, setLunes] = useState(() => getLunesDeSemana(new Date()));
  const [vistaActual, setVistaActual] = useState<'semana' | 'lista'>('semana');
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [detalle, setDetalle] = useState<MaternidadSolicitudVista | null>(null);
  const [aCancelar, setACancelar] = useState<MaternidadSolicitudVista | null>(null);

  const diasSemana = useMemo(() => getDiasSemana(lunes), [lunes]);
  const desde = toISOFechaLocal(diasSemana[0]);
  const hasta = toISOFechaLocal(diasSemana[6]);
  const hoy = fechaHoyEcuadorISO();
  const usuarioNombre = currentUser?.name || 'Sistema';

  const { horarios, loadHorarios } = useHorariosMaternidad();
  const { solicitudes, isLoading, loadSolicitudes } = useSolicitudesMaternidad({ fechaTourDesde: desde, fechaTourHasta: hasta });
  const { solicitudes: pendientesTour, loadSolicitudes: loadPendientes } = useSolicitudesMaternidad({ estado: 'solo_cotizacion' });

  const tours = solicitudes.filter(s => s.estado !== 'solo_cotizacion');
  const toursActivos = tours.filter(s => ESTADOS_CON_TOUR.includes(s.estado));

  const recargar = () => {
    loadHorarios();
    loadSolicitudes();
    loadPendientes();
  };

  // Cancelar no elimina: cambia el estado a 'cancelada' y libera el turno
  const handleCancelarTour = async () => {
    if (!aCancelar) return;
    try {
      await updateEstadoSolicitudMaternidad(aCancelar.id_solicitud_mat, 'cancelada');
      toast.success(`Tour de ${aCancelar.nombre_madre} cancelado. El turno quedó libre.`);
      recargar();
    } catch (error) {
      toast.error(mensajeErrorMaternidad(error));
    } finally {
      setACancelar(null);
    }
  };

  const moverSemana = (semanas: number) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + semanas * 7);
    setLunes(d);
  };

  const semanaLabel = `${diasSemana[0].toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })} al ${diasSemana[6].toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const abrirAgendarTour = (solicitud: MaternidadSolicitud) => {
    setDetalle(null);
    setModal({ open: true, solicitudBase: solicitud });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="flex items-center gap-2">
            <Baby className="size-5" />
            Agenda de Tours de Maternidad
          </h2>
          <p className="text-sm text-gray-600">Tours agendados por WhatsApp y desde la plataforma</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={vistaActual === 'semana' ? 'default' : 'outline'} onClick={() => setVistaActual('semana')}>
            <CalendarDays className="size-4 mr-1" /> Semana
          </Button>
          <Button size="sm" variant={vistaActual === 'lista' ? 'default' : 'outline'} onClick={() => setVistaActual('lista')}>
            <List className="size-4 mr-1" /> Lista
          </Button>
          <Button size="sm" variant="outline" onClick={recargar}>
            <RefreshCw className="size-4" />
          </Button>
          <Button size="sm" onClick={() => setModal({ open: true })}>
            <Plus className="size-4 mr-1" /> Nueva solicitud
          </Button>
        </div>
      </div>

      {/* Resumen de la semana */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-gray-500">Tours de la semana</p>
          <p className="text-2xl font-semibold">{toursActivos.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Asistieron</p>
          <p className="text-2xl font-semibold text-green-700">{tours.filter(s => s.estado === 'asistio').length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Canceladas / no asistió</p>
          <p className="text-2xl font-semibold text-red-600">{tours.filter(s => s.estado === 'cancelada' || s.estado === 'no_asistio').length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Cotizaciones sin tour</p>
          <p className="text-2xl font-semibold text-amber-600">{pendientesTour.length}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => moverSemana(-1)}><ChevronLeft className="size-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setLunes(getLunesDeSemana(new Date()))}>Hoy</Button>
          <Button size="sm" variant="outline" onClick={() => moverSemana(1)}><ChevronRight className="size-4" /></Button>
        </div>
        <span className="text-sm font-medium text-gray-700">Semana del {semanaLabel}</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
      ) : vistaActual === 'semana' ? (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 min-h-[400px] min-w-[900px]">
            {diasSemana.map(dia => {
              const iso = toISOFechaLocal(dia);
              const esHoy = iso === hoy;
              const turnosDia = horarios.filter(h => h.estado === 'activo' && h.dia_semana === diaSemanaISO(dia));
              const toursDia = tours.filter(s => s.fecha_tour === iso);
              // Tours cuyo turno ya no está activo (horario editado o desactivado)
              const huerfanos = toursDia.filter(s => !turnosDia.some(t => t.id_horario_mat === s.id_horario_mat));

              return (
                <div key={iso} className="flex flex-col min-h-[300px]">
                  <div className={`p-2 rounded-t-lg text-center text-xs font-semibold border-b ${esHoy ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {dia.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  <div className="flex-1 bg-white border border-t-0 rounded-b-lg p-1 space-y-1 overflow-y-auto">
                    {turnosDia.length === 0 && huerfanos.length === 0 && (
                      <p className="text-xs text-gray-300 text-center pt-4">Sin turnos</p>
                    )}
                    {turnosDia.map(turno => {
                      const enTurno = toursDia.filter(s => s.id_horario_mat === turno.id_horario_mat);
                      const ocupados = enTurno.filter(s => ESTADOS_CON_TOUR.includes(s.estado)).length;
                      const pasado = turnoYaPaso(iso, turno.hora_inicio);
                      const lleno = ocupados >= turno.cupo;
                      return (
                        <div key={turno.id_horario_mat} className={`rounded border p-1 text-xs ${lleno ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-blue-800">{turno.hora_inicio.slice(0, 5)}</span>
                            <span className={lleno ? 'text-red-600 font-semibold' : 'text-gray-600'}>{ocupados}/{turno.cupo}</span>
                          </div>
                          {enTurno.map(s => {
                            const cancelable = !pasado && (s.estado === 'agendada' || s.estado === 'confirmada');
                            return (
                              <div key={s.id_solicitud_mat} className="flex items-center gap-1 mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => setDetalle(s)}
                                  className={`flex-1 text-left truncate rounded px-1 hover:bg-white ${s.estado === 'cancelada' ? 'line-through text-gray-400' : 'text-gray-700'}`}
                                  title={`${s.nombre_madre} · ${ESTADO_BADGE_MATERNIDAD[s.estado].label}`}
                                >
                                  {s.nombre_madre}
                                </button>
                                {cancelable && (
                                  <button
                                    type="button"
                                    onClick={() => setACancelar(s)}
                                    className="text-red-600 hover:bg-red-100 rounded"
                                    title="Cancelar tour"
                                  >
                                    <XCircle className="size-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {!pasado && !lleno && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full mt-1 h-5 text-xs px-0 text-gray-500 hover:bg-gray-200"
                              onClick={() => setModal({ open: true, fecha: iso, idHorario: turno.id_horario_mat })}
                            >
                              <Plus className="size-3 mr-0.5" /> Agregar
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {huerfanos.map(s => (
                      <button
                        key={s.id_solicitud_mat}
                        type="button"
                        onClick={() => setDetalle(s)}
                        className="block w-full text-left rounded border bg-gray-50 p-1 text-xs truncate"
                      >
                        {s.hora_inicio?.slice(0, 5)} · {s.nombre_madre}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Mamá</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Aseguradora</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tours.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">No hay tours en esta semana</TableCell>
                </TableRow>
              ) : (
                [...tours]
                  .sort((a, b) => `${a.fecha_tour}${a.hora_inicio}`.localeCompare(`${b.fecha_tour}${b.hora_inicio}`))
                  .map(s => (
                    <TableRow key={s.id_solicitud_mat} className="cursor-pointer" onClick={() => setDetalle(s)}>
                      <TableCell>{s.dia_nombre} {s.fecha_tour_formato}</TableCell>
                      <TableCell className="font-mono text-sm">{formatHorario(s.hora_inicio, s.hora_fin)}</TableCell>
                      <TableCell className="font-medium">{s.nombre_madre}</TableCell>
                      <TableCell>{s.cedula}</TableCell>
                      <TableCell>{s.telefono}</TableCell>
                      <TableCell>{s.aseguradora}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ESTADO_BADGE_MATERNIDAD[s.estado].className}>{ESTADO_BADGE_MATERNIDAD[s.estado].label}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Cotizaciones que aún no agendan el tour */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-amber-600" />
          <h3 className="font-medium">Cotizaciones pendientes de tour ({pendientesTour.length})</h3>
        </div>
        {pendientesTour.length === 0 ? (
          <p className="text-sm text-gray-500">No hay cotizaciones pendientes.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registrada</TableHead>
                <TableHead>Mamá</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Aseguradora</TableHead>
                <TableHead>Semanas</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendientesTour.slice(0, 20).map(s => (
                <TableRow key={s.id_solicitud_mat}>
                  <TableCell className="text-xs whitespace-nowrap">{formatFechaHora(s.created_at)}</TableCell>
                  <TableCell>
                    <button type="button" className="font-medium hover:underline" onClick={() => setDetalle(s)}>{s.nombre_madre}</button>
                  </TableCell>
                  <TableCell>{s.telefono}</TableCell>
                  <TableCell>{s.aseguradora}</TableCell>
                  <TableCell>{s.semanas_gestacion ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => abrirAgendarTour(s)}>Agendar tour</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <MaternidadSolicitudModal
        open={modal.open}
        onOpenChange={open => setModal(prev => ({ ...prev, open }))}
        solicitudBase={modal.solicitudBase}
        fechaInicial={modal.fecha}
        idHorarioInicial={modal.idHorario}
        usuarioNombre={usuarioNombre}
        onGuardado={recargar}
      />

      <AlertDialog open={!!aCancelar} onOpenChange={open => { if (!open) setACancelar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar el tour?</AlertDialogTitle>
            <AlertDialogDescription>
              El tour de <strong>{aCancelar?.nombre_madre}</strong> del {aCancelar?.dia_nombre} {aCancelar?.fecha_tour_formato} a las{' '}
              <strong>{aCancelar?.hora_inicio?.slice(0, 5)}</strong> quedará en estado <strong>Cancelada</strong> (no se elimina)
              y el turno quedará libre para otra reserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelarTour} className="bg-red-600 hover:bg-red-700">Cancelar tour</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MaternidadSolicitudDialog
        solicitud={detalle}
        onOpenChange={open => { if (!open) setDetalle(null); }}
        usuarioNombre={usuarioNombre}
        onAgendarTour={abrirAgendarTour}
        onActualizado={recargar}
      />
    </div>
  );
}
