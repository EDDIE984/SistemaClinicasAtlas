// Cambio de estado del tour con confirmación y motivo (queda en maternidad_historial).
// Al marcar "Asistió" pide los datos del tour realizado: la solicitud entra a la bitácora.
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { ArrowRight, Check, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  ESTADOS_CON_MOTIVO,
  ESTADOS_SOLICITUD_MATERNIDAD,
  formatearEstadoSolicitudMaternidad,
  getAsesoresMaternidad,
  mensajeErrorMaternidad,
  updateEstadoSolicitudMaternidad,
} from '../../lib/maternidadService';
import type { EstadoSolicitudMaternidad, MaternidadSolicitud } from '../../lib/supabaseTypes';
import { ESTADO_BADGE_MATERNIDAD } from './maternidadUtils';

interface MaternidadEstadoDialogProps {
  solicitud: Pick<
    MaternidadSolicitud,
    'id_solicitud_mat' | 'nombre_madre' | 'estado' | 'fecha_tour' | 'hora_inicio' | 'hora_fin'
    | 'asesor' | 'hora_inicio_real' | 'hora_fin_real' | 'firma_paciente'
  > | null;
  /** Estado preseleccionado al abrir (p. ej. Cancelada desde la agenda) */
  estadoInicial?: EstadoSolicitudMaternidad;
  usuarioNombre: string;
  onOpenChange: (open: boolean) => void;
  onGuardado: (solicitud: MaternidadSolicitud) => void;
}

const ESTADOS_REQUIEREN_TOUR: EstadoSolicitudMaternidad[] = ['agendada', 'confirmada', 'asistio', 'no_asistio'];

export function MaternidadEstadoDialog({
  solicitud,
  estadoInicial,
  usuarioNombre,
  onOpenChange,
  onGuardado,
}: MaternidadEstadoDialogProps) {
  const [nuevo, setNuevo] = useState<EstadoSolicitudMaternidad | null>(null);
  const [motivo, setMotivo] = useState('');
  const [isGuardando, setIsGuardando] = useState(false);
  // Datos del tour realizado (bitácora)
  const [asesor, setAsesor] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [firma, setFirma] = useState<boolean | null>(null);
  const [asesores, setAsesores] = useState<string[]>([]);

  // Se reinicia solo al abrir (la solicitud del padre puede cambiar de referencia en cada render)
  const idAbierta = solicitud?.id_solicitud_mat;
  const estadoActual = solicitud?.estado;
  useEffect(() => {
    setNuevo(estadoInicial && estadoInicial !== estadoActual ? estadoInicial : null);
    setMotivo('');
    if (!solicitud) return;
    // Por defecto: el asesor ya registrado o el usuario conectado, y el horario del turno agendado
    setAsesor(solicitud.asesor || usuarioNombre.toUpperCase());
    setHoraInicio((solicitud.hora_inicio_real || solicitud.hora_inicio || '').slice(0, 5));
    setHoraFin((solicitud.hora_fin_real || solicitud.hora_fin || '').slice(0, 5));
    setFirma(solicitud.firma_paciente ?? null);
    getAsesoresMaternidad().then(setAsesores).catch(() => setAsesores([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAbierta, estadoActual, estadoInicial]);

  if (!solicitud) return null;

  const tieneTour = !!solicitud.fecha_tour && solicitud.estado !== 'solo_cotizacion';

  // Motivo por el que un estado no se puede elegir (null = disponible)
  const bloqueo = (estado: EstadoSolicitudMaternidad): string | null => {
    if (estado === solicitud.estado) return 'Estado actual';
    if (estado === 'solo_cotizacion' && tieneTour) return 'Para quitar el tour use Cancelada';
    if (ESTADOS_REQUIEREN_TOUR.includes(estado) && !solicitud.fecha_tour) return 'Primero agende el tour';
    return null;
  };

  const requiereMotivo = !!nuevo && ESTADOS_CON_MOTIVO.includes(nuevo);
  const marcaAsistencia = nuevo === 'asistio';

  const handleGuardar = async () => {
    if (!nuevo) return toast.error('Seleccione el nuevo estado');
    if (requiereMotivo && !motivo.trim()) return toast.error('Indique el motivo del cambio');
    if (marcaAsistencia) {
      if (!asesor.trim()) return toast.error('Indique el asesor que dio el tour');
      if (horaInicio && horaFin && horaFin <= horaInicio) return toast.error('La hora de fin debe ser posterior a la de inicio');
      if (firma === null) return toast.error('Indique si la paciente firmó');
    }
    setIsGuardando(true);
    try {
      const guardada = await updateEstadoSolicitudMaternidad(
        solicitud.id_solicitud_mat,
        nuevo,
        usuarioNombre,
        motivo,
        marcaAsistencia ? { asesor, hora_inicio_real: horaInicio || null, hora_fin_real: horaFin || null, firma_paciente: firma } : null,
      );
      toast.success(
        marcaAsistencia && guardada.numero_bitacora
          ? `Asistencia registrada: tour #${guardada.numero_bitacora} en la bitácora`
          : `Estado cambiado a ${formatearEstadoSolicitudMaternidad(nuevo)}`,
      );
      onGuardado(guardada);
      onOpenChange(false);
    } catch (error) {
      toast.error(`No se pudo cambiar el estado: ${mensajeErrorMaternidad(error)}`);
    } finally {
      setIsGuardando(false);
    }
  };

  return (
    <Dialog open={!!solicitud} onOpenChange={onOpenChange}>
      <DialogContent className="maternidad-dialog-medio maternidad-dialog-secundario">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <RefreshCw className="size-4" />
            </span>
            Cambiar estado
          </DialogTitle>
          <DialogDescription>
            {solicitud.nombre_madre} · el cambio queda registrado en el historial de la paciente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500">Estado actual:</span>
            <Badge variant="outline" className={ESTADO_BADGE_MATERNIDAD[solicitud.estado].className}>
              {ESTADO_BADGE_MATERNIDAD[solicitud.estado].label}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label>Nuevo estado *</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {ESTADOS_SOLICITUD_MATERNIDAD.map(e => {
                const motivoBloqueo = bloqueo(e.value);
                const seleccionado = nuevo === e.value;
                return (
                  <button
                    key={e.value}
                    type="button"
                    disabled={!!motivoBloqueo}
                    onClick={() => setNuevo(e.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      seleccionado
                        ? 'border-blue-600 bg-blue-50'
                        : motivoBloqueo
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{e.label}</span>
                      {seleccionado && <Check className="size-4 text-blue-600" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{motivoBloqueo || e.descripcion}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {marcaAsistencia && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Datos del tour realizado (bitácora)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Asesor *</Label>
                  <Input list="maternidad-asesores" value={asesor} onChange={e => setAsesor(e.target.value)} />
                  <datalist id="maternidad-asesores">
                    {asesores.map(a => <option key={a} value={a} />)}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hora de inicio</Label>
                  <Input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hora de fin</Label>
                  <Input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">¿La paciente firmó? *</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={firma === true ? 'default' : 'outline'} onClick={() => setFirma(true)}>Sí firmó</Button>
                  <Button type="button" size="sm" variant={firma === false ? 'default' : 'outline'} onClick={() => setFirma(false)}>No firmó</Button>
                </div>
              </div>
            </div>
          )}

          {nuevo && (
            <>
              <div className="space-y-2">
                <Label>Motivo {requiereMotivo ? '*' : '(opcional)'}</Label>
                <Textarea
                  rows={2}
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder={nuevo === 'cancelada' ? 'Ej.: la mamá decidió no realizar el tour' : 'Detalle del cambio'}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-gray-50 p-3 text-sm">
                <Badge variant="outline" className={ESTADO_BADGE_MATERNIDAD[solicitud.estado].className}>
                  {ESTADO_BADGE_MATERNIDAD[solicitud.estado].label}
                </Badge>
                <ArrowRight className="size-4 text-gray-500" />
                <Badge variant="outline" className={ESTADO_BADGE_MATERNIDAD[nuevo].className}>
                  {ESTADO_BADGE_MATERNIDAD[nuevo].label}
                </Badge>
                {nuevo === 'cancelada' && tieneTour && <span className="text-xs text-gray-500">Se libera el cupo del turno.</span>}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGuardando}>Volver</Button>
          <Button
            onClick={handleGuardar}
            disabled={isGuardando || !nuevo}
            className={nuevo === 'cancelada' ? 'bg-red-600 hover:bg-red-700' : undefined}
          >
            {isGuardando && <Loader2 className="size-4 mr-2 animate-spin" />}
            Guardar cambio de estado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
