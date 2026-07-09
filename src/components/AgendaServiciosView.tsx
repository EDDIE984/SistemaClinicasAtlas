// Vista de Agenda de Servicios (Tomografía, Rayos X, Laboratorio, etc.)
import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import {
  Stethoscope,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  Loader2,
  Clock,
  XCircle,
  Pencil,
  PlayCircle,
  User,
  Phone,
  Image,
  ExternalLink,
  Mail,
  MapPin,
  ArrowLeft,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCitasServicio } from '../hooks/useCitasServicio';
import { useSucursales, useServicios } from '../hooks/useConfiguraciones';
import { AgendarCitaServicioModal } from './AgendarCitaServicioModal';
import { getFotoPedido } from '../lib/citaServicioService';
import type { CitaServicioCompleta } from '../lib/configuracionesService';

interface AgendaServiciosViewProps {
  currentUser: {
    name: string;
    id_sucursal?: number;
    tipo_usuario?: string;
    id_servicio?: number;
    sucursal?: string;
    servicio?: string;
  } | null;
  modoUsuarioServicio?: boolean;
}

// ─── Utilidades de fecha ───────────────────────────────────────────────────────
function getLunesDeSemana(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay();
  const diff = (dia === 0 ? -6 : 1 - dia);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(lunes: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

const ECUADOR_TIME_ZONE = 'America/Guayaquil';

function fechaHoyEcuadorISO(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ECUADOR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = partes.find(parte => parte.type === 'year')?.value;
  const month = partes.find(parte => parte.type === 'month')?.value;
  const day = partes.find(parte => parte.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function esFechaPasadaEnEcuador(fecha: string): boolean {
  return fecha < fechaHoyEcuadorISO();
}

function permiteAccionesAgendaServicio(cita?: CitaServicioCompleta | null): boolean {
  return !!cita?.fecha_cita && !esFechaPasadaEnEcuador(cita.fecha_cita);
}

function formatFechaCorta(d: Date): string {
  return d.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatFechaLabel(d: Date): string {
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
}

function formatFechaCompleta(fecha: string): string {
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getInicioAtencionDesdeNotas(notas?: string | null): string | null {
  const match = notas?.match(/Inicio de atención:\s*([^\n]+)/i);
  return match?.[1]?.trim() || null;
}

function formatFechaHora(fecha?: string | null): string {
  if (!fecha) return 'No registrado';
  return new Date(fecha).toLocaleString('es-EC', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function esUrlValida(url: string): boolean {
  if (!url.trim()) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Colores por estado ────────────────────────────────────────────────────────
const ESTADO_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  agendada:    { label: 'Agendada',    variant: 'default' },
  confirmada:  { label: 'Confirmada',  variant: 'default' },
  en_atencion: { label: 'En atención', variant: 'secondary' },
  atendida:    { label: 'Atendida',    variant: 'outline' },
  cancelada:   { label: 'Cancelada',   variant: 'destructive' },
  no_asistio:  { label: 'No asistió',  variant: 'destructive' },
};

type EstadoFiltroServicio = 'todas' | 'agendada' | 'confirmada' | 'en_atencion' | 'atendida' | 'cancelada';
const normalizarTexto = (valor?: string | null) => (valor ?? '').trim().toUpperCase();

export function AgendaServiciosView({ currentUser, modoUsuarioServicio = false }: AgendaServiciosViewProps) {
  const { sucursales } = useSucursales();

  // ─── Filtros ─────────────────────────────────────────────────────────────────
  const [filtroSucursal, setFiltroSucursal] = useState<string>('todas');
  const [filtroServicio, setFiltroServicio]  = useState<string>('todos');
  const [filtroEstadoServicio, setFiltroEstadoServicio] = useState<EstadoFiltroServicio>('confirmada');
  const idSucursalNum = modoUsuarioServicio
    ? currentUser?.id_sucursal
    : filtroSucursal !== 'todas' ? parseInt(filtroSucursal) : undefined;
  const idServicioNum = modoUsuarioServicio
    ? currentUser?.id_servicio
    : filtroServicio !== 'todos' ? parseInt(filtroServicio) : undefined;

  const { servicios } = useServicios(idSucursalNum);
  const serviciosActivos = servicios.filter(
    s => s.estado === 'activo' && normalizarTexto(s.descripcion) !== 'CONSULTA EXTERNA'
  );

  // ─── Vista ───────────────────────────────────────────────────────────────────
  const [vistaActual, setVistaActual] = useState<'semana' | 'lista'>('semana');
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);

  // ─── Semana ──────────────────────────────────────────────────────────────────
  const [currentWeekBase, setCurrentWeekBase] = useState<Date>(new Date());
  const lunes = useMemo(() => getLunesDeSemana(currentWeekBase), [currentWeekBase]);
  const diasSemana = useMemo(() => getWeekDays(lunes), [lunes]);
  const semanaDesde = toISO(diasSemana[0]);
  const semanaHasta = toISO(diasSemana[6]);

  const semanaLabel = `${formatFechaLabel(diasSemana[0])} – ${formatFechaLabel(diasSemana[6])} ${diasSemana[0].getFullYear()}`;

  // ─── Lista ───────────────────────────────────────────────────────────────────
  const [listaDesde, setListaDesde] = useState<string>(toISO(new Date()));
  const [listaHasta, setListaHasta] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return toISO(d);
  });

  // ─── Hook de citas ───────────────────────────────────────────────────────────
  const fechaDesde = vistaActual === 'semana' ? semanaDesde : listaDesde;
  const fechaHasta = vistaActual === 'semana' ? semanaHasta : listaHasta;

  const { citas, isLoading, crearCita, actualizarCita, cancelarCita } = useCitasServicio({
    fechaDesde,
    fechaHasta,
    idSucursal: idSucursalNum,
    idServicio: idServicioNum,
  });

  const citasFiltradas = modoUsuarioServicio
    ? citas.filter(c => filtroEstadoServicio === 'todas' ? c.estado_cita !== 'no_asistio' : c.estado_cita === filtroEstadoServicio)
    : mostrarCanceladas
      ? citas
      : citas.filter(c => c.estado_cita !== 'cancelada' && c.estado_cita !== 'no_asistio');

  // ─── Modal ───────────────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [citaParaEditar, setCitaParaEditar]   = useState<CitaServicioCompleta | null>(null);
  const [fechaPreseleccionada, setFechaPresel] = useState<string | null>(null);

  const handleNuevaCita = (fecha?: string) => {
    if (fecha && esFechaPasadaEnEcuador(fecha)) {
      toast.error('No puedes agendar citas en fechas pasadas');
      return;
    }
    setCitaParaEditar(null);
    setFechaPresel(fecha || null);
    setIsModalOpen(true);
  };

  const handleEditarCita = (cita: CitaServicioCompleta) => {
    if (!permiteAccionesAgendaServicio(cita)) {
      toast.error('Solo puedes editar citas de hoy o fechas futuras');
      return;
    }
    setCitaParaEditar(cita);
    setFechaPresel(null);
    setIsModalOpen(true);
  };

  // ─── Cancelar ────────────────────────────────────────────────────────────────
  const [citaACancelar, setCitaACancelar] = useState<CitaServicioCompleta | null>(null);
  const [citaDetalle, setCitaDetalle] = useState<CitaServicioCompleta | null>(null);
  const [mostrarCancelacionServicio, setMostrarCancelacionServicio] = useState(false);
  const [observacionCancelacion, setObservacionCancelacion] = useState('');
  const [isProcesandoAccion, setIsProcesandoAccion] = useState(false);
  const [isAbriendoFoto, setIsAbriendoFoto] = useState(false);
  const [citaAtencion, setCitaAtencion] = useState<CitaServicioCompleta | null>(null);
  const [urlInforme, setUrlInforme] = useState('');
  const [observacionesAtencion, setObservacionesAtencion] = useState('');

  const handleCancelarConfirmar = async () => {
    if (!citaACancelar) return;
    if (!permiteAccionesAgendaServicio(citaACancelar)) {
      toast.error('Solo puedes cancelar citas de hoy o fechas futuras');
      setCitaACancelar(null);
      return;
    }
    const ok = await cancelarCita(citaACancelar.id_cita_servicio);
    if (ok) {
      toast.success('Cita cancelada');
      setCitaACancelar(null);
    } else {
      toast.error('Error al cancelar la cita');
    }
  };

  const abrirCancelacion = (cita: CitaServicioCompleta) => {
    if (!permiteAccionesAgendaServicio(cita)) {
      toast.error('Solo puedes cancelar citas de hoy o fechas futuras');
      return;
    }
    setCitaACancelar(cita);
  };

  const abrirDetalleServicio = (cita: CitaServicioCompleta) => {
    setCitaDetalle(cita);
    setMostrarCancelacionServicio(false);
    setObservacionCancelacion('');
  };

  const cerrarDetalleServicio = () => {
    setCitaDetalle(null);
    setMostrarCancelacionServicio(false);
    setObservacionCancelacion('');
  };

  const abrirPantallaAtencion = (cita: CitaServicioCompleta) => {
    if (!permiteAccionesAgendaServicio(cita)) {
      toast.error('Solo puedes atender citas de hoy o fechas futuras');
      return;
    }

    if (cita.estado_cita !== 'confirmada' && cita.estado_cita !== 'en_atencion') {
      toast.error('Solo puedes ingresar a atención desde citas confirmadas o en atención');
      return;
    }

    setCitaAtencion(cita);
    setUrlInforme('');
    setObservacionesAtencion('');
    cerrarDetalleServicio();
  };

  const handleIniciarAtencionServicio = async () => {
    if (!citaDetalle) return;
    if (!permiteAccionesAgendaServicio(citaDetalle)) {
      toast.error('Solo puedes iniciar atención en citas de hoy o fechas futuras');
      return;
    }

    setIsProcesandoAccion(true);
    try {
      const inicioAtencion = new Date().toLocaleString('es-EC', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const notasPrevias = citaDetalle.notas_cita?.trim();
      const nuevaNota = `Inicio de atención: ${inicioAtencion}`;
      const result = await actualizarCita(citaDetalle.id_cita_servicio, {
        estado_cita: 'en_atencion',
        fecha_inicio_atencion: new Date().toISOString(),
        notas_cita: notasPrevias ? `${notasPrevias}\n${nuevaNota}` : nuevaNota,
      });
      if (result) {
        toast.success('Atención iniciada');
        abrirPantallaAtencion({ ...citaDetalle, ...result } as CitaServicioCompleta);
      } else {
        toast.error('No se pudo iniciar la atención');
      }
    } finally {
      setIsProcesandoAccion(false);
    }
  };

  const handleGuardarAtencion = async () => {
    if (!citaAtencion) return;
    if (!permiteAccionesAgendaServicio(citaAtencion)) {
      toast.error('Solo puedes guardar atención en citas de hoy o fechas futuras');
      return;
    }

    if (!esUrlValida(urlInforme)) {
      toast.error('Ingresa una URL válida para el informe');
      return;
    }

    const fechaAtendida = new Date().toLocaleString('es-EC', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const notasPrevias = citaAtencion.notas_cita?.trim();
    const nuevasNotas = [
      `Cambio a estado atendida: ${fechaAtendida}`,
      urlInforme.trim() ? `URL informe: ${urlInforme.trim()}` : '',
      observacionesAtencion.trim() ? `Observaciones atención: ${observacionesAtencion.trim()}` : '',
    ].filter(Boolean).join('\n');

    setIsProcesandoAccion(true);
    try {
      const result = await actualizarCita(citaAtencion.id_cita_servicio, {
        estado_cita: 'atendida',
        fecha_atendida: new Date().toISOString(),
        notas_cita: notasPrevias ? `${notasPrevias}\n${nuevasNotas}` : nuevasNotas,
      });
      if (result) {
        toast.success('Atención guardada');
        setCitaAtencion(null);
        setUrlInforme('');
        setObservacionesAtencion('');
      } else {
        toast.error('No se pudo guardar la atención');
      }
    } finally {
      setIsProcesandoAccion(false);
    }
  };

  const handleCancelarServicioConObservacion = async () => {
    if (!citaDetalle) return;
    if (!permiteAccionesAgendaServicio(citaDetalle)) {
      toast.error('Solo puedes cancelar citas de hoy o fechas futuras');
      return;
    }

    const observacion = observacionCancelacion.trim();
    if (!observacion) {
      toast.error('Ingresa una observación para cancelar la cita');
      return;
    }

    const notasPrevias = citaDetalle.notas_cita?.trim();
    const nuevaNota = `Cancelada por ${currentUser?.name || 'usuario del servicio'}: ${observacion}`;

    setIsProcesandoAccion(true);
    try {
      const result = await actualizarCita(citaDetalle.id_cita_servicio, {
        estado_cita: 'cancelada',
        fecha_cancelada: new Date().toISOString(),
        notas_cita: notasPrevias ? `${notasPrevias}\n${nuevaNota}` : nuevaNota,
      });
      if (result) {
        toast.success('Cita cancelada');
        cerrarDetalleServicio();
      } else {
        toast.error('No se pudo cancelar la cita');
      }
    } finally {
      setIsProcesandoAccion(false);
    }
  };

  const handleAbrirFotoPedido = async () => {
    if (!citaDetalle) return;

    const nuevaVentana = window.open('', '_blank');
    if (!nuevaVentana) {
      toast.error('El navegador bloqueó la nueva pestaña');
      return;
    }

    setIsAbriendoFoto(true);
    try {
      const foto = await getFotoPedido(citaDetalle.id_cita_servicio);
      if (!foto) {
        nuevaVentana.close();
        toast.error('Esta cita no tiene fotografía del pedido registrada');
        return;
      }

      nuevaVentana.document.title = `Pedido ${citaDetalle.id_cita_servicio}`;
      nuevaVentana.document.body.style.margin = '0';
      nuevaVentana.document.body.style.background = '#111827';
      nuevaVentana.document.body.innerHTML = `
        <img
          src="${foto}"
          alt="Fotografía del pedido"
          style="display:block;max-width:100vw;max-height:100vh;margin:auto;object-fit:contain;"
        />
      `;
    } catch {
      nuevaVentana.close();
      toast.error('No se pudo abrir la fotografía del pedido');
    } finally {
      setIsAbriendoFoto(false);
    }
  };

  // ─── Navegación de semana ─────────────────────────────────────────────────────
  const irSemanaPrev = () => {
    setCurrentWeekBase(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
  };
  const irSemanaSig = () => {
    setCurrentWeekBase(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });
  };
  const irHoy = () => setCurrentWeekBase(new Date());

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (modoUsuarioServicio && citaAtencion) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <Button
              variant="ghost"
              className="mb-2 px-0 gap-2 text-gray-600 hover:text-gray-900"
              onClick={() => setCitaAtencion(null)}
              disabled={isProcesandoAccion}
            >
              <ArrowLeft className="size-4" />
              Volver a agenda
            </Button>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <Stethoscope className="size-6 text-blue-600" />
              Atención de servicio
            </h1>
            <p className="text-sm text-gray-500">Registra el informe y las observaciones para completar la atención.</p>
          </div>
          <Badge variant={ESTADO_CONFIG[citaAtencion.estado_cita]?.variant || 'outline'}>
            {ESTADO_CONFIG[citaAtencion.estado_cita]?.label || citaAtencion.estado_cita}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <CalendarDays className="size-4 text-blue-600" />
              Datos de la cita
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Fecha</p>
                <p className="font-medium capitalize">{formatFechaCompleta(citaAtencion.fecha_cita)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Horario</p>
                <p className="font-medium">{citaAtencion.hora_inicio?.slice(0, 5)} - {citaAtencion.hora_fin?.slice(0, 5)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Servicio</p>
                <p className="font-medium">{citaAtencion.servicio?.descripcion}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Inicio de atención</p>
                <p className="font-medium">{formatFechaHora(citaAtencion.fecha_inicio_atencion) !== 'No registrado' ? formatFechaHora(citaAtencion.fecha_inicio_atencion) : getInicioAtencionDesdeNotas(citaAtencion.notas_cita) || 'Registrado ahora'}</p>
              </div>
            </div>
            <div className="text-sm">
              <p className="text-xs text-gray-500">Médico solicitante</p>
              <p className="font-medium">{citaAtencion.medico_solicitante || 'No registrado'}</p>
              <p className="text-xs text-gray-500 mt-2">Registro médico</p>
              <p className="font-medium">{citaAtencion.numero_registro_medico || 'No registrado'}</p>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <User className="size-4 text-blue-600" />
              Datos del cliente
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Paciente</p>
                <p className="font-medium">{citaAtencion.paciente?.nombres} {citaAtencion.paciente?.apellidos}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Cédula</p>
                  <p className="font-medium">{citaAtencion.paciente?.cedula || 'No registrada'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Teléfono</p>
                  <p className="font-medium">{citaAtencion.paciente?.telefono || 'No registrado'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Correo</p>
                <p className="font-medium break-all">{citaAtencion.paciente?.email || 'No registrado'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Dirección</p>
                <p className="font-medium">{citaAtencion.paciente?.direccion || 'No registrada'}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="url-informe">URL del informe</Label>
              <Input
                id="url-informe"
                value={urlInforme}
                onChange={e => setUrlInforme(e.target.value)}
                placeholder="https://..."
                type="url"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="observaciones-atencion">Observaciones</Label>
              <Textarea
                id="observaciones-atencion"
                value={observacionesAtencion}
                onChange={e => setObservacionesAtencion(e.target.value)}
                placeholder="Ingresa observaciones de la atención"
                rows={5}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCitaAtencion(null)} disabled={isProcesandoAccion}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarAtencion} disabled={isProcesandoAccion}>
              {isProcesandoAccion ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              Guardar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Stethoscope className="size-6 text-blue-600" />
            {modoUsuarioServicio ? 'Agenda' : 'Agenda de Servicios'}
          </h1>
          <p className="text-sm text-gray-500">
            {modoUsuarioServicio
              ? 'Citas confirmadas para tu servicio asignado'
              : 'Gestión de citas para servicios de imagen y laboratorio'}
          </p>
        </div>
        {!modoUsuarioServicio && (
          <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMostrarCanceladas(v => !v)}
          >
            {mostrarCanceladas ? 'Ocultar canceladas' : 'Mostrar canceladas'}
          </Button>
          <Button onClick={() => handleNuevaCita()}>
            <Plus className="size-4 mr-2" />
            Nueva Cita
          </Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className={`grid grid-cols-1 ${modoUsuarioServicio ? 'md:grid-cols-3' : 'md:grid-cols-3'} gap-4 items-end`}>
          {modoUsuarioServicio ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Sucursal</Label>
                <div className="h-10 flex items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm">
                  {currentUser?.sucursal || 'Sucursal asignada'}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Servicio</Label>
                <div className="h-10 flex items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm">
                  {currentUser?.servicio || 'Servicio asignado'}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Sucursal</Label>
                <Select value={filtroSucursal} onValueChange={v => { setFiltroSucursal(v); setFiltroServicio('todos'); }}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las sucursales</SelectItem>
                    {sucursales.map(s => (
                      <SelectItem key={s.id_sucursal} value={s.id_sucursal.toString()}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Servicio</Label>
                <Select value={filtroServicio} onValueChange={setFiltroServicio}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los servicios</SelectItem>
                    {serviciosActivos.map(s => (
                      <SelectItem key={s.id_servicio} value={s.id_servicio.toString()}>{s.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="flex gap-2 justify-end">
            {modoUsuarioServicio && (
              <Select value={filtroEstadoServicio} onValueChange={(value: EstadoFiltroServicio) => setFiltroEstadoServicio(value)}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="agendada">Agendadas</SelectItem>
                  <SelectItem value="confirmada">Confirmadas</SelectItem>
                  <SelectItem value="en_atencion">En atención</SelectItem>
                  <SelectItem value="atendida">Atendidas</SelectItem>
                  <SelectItem value="cancelada">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              variant={vistaActual === 'semana' ? 'default' : 'outline'}
              onClick={() => setVistaActual('semana')}
            >
              <CalendarDays className="size-4 mr-1" />
              Semana
            </Button>
            <Button
              size="sm"
              variant={vistaActual === 'lista' ? 'default' : 'outline'}
              onClick={() => setVistaActual('lista')}
            >
              <List className="size-4 mr-1" />
              Lista
            </Button>
          </div>
        </div>
      </Card>

      {/* ── VISTA SEMANA ─────────────────────────────────────────────────────── */}
      {vistaActual === 'semana' && (
        <>
          {/* Navegación */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={irSemanaPrev}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={irHoy}>Hoy</Button>
              <Button size="sm" variant="outline" onClick={irSemanaSig}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <span className="text-sm font-medium text-gray-700">Semana del {semanaLabel}</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
          ) : (
            <div className="grid grid-cols-7 gap-1 min-h-[400px]">
              {diasSemana.map(dia => {
                const iso = toISO(dia);
                const citasDia = citasFiltradas.filter(c => c.fecha_cita === iso);
                const esHoy = iso === toISO(new Date());
                const esDiaPasado = esFechaPasadaEnEcuador(iso);

                return (
                  <div key={iso} className="flex flex-col min-h-[300px]">
                    {/* Cabecera del día */}
                    <div className={`p-2 rounded-t-lg text-center text-xs font-semibold border-b ${esHoy ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <div>{formatFechaCorta(dia)}</div>
                      {!modoUsuarioServicio && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`w-full mt-1 h-5 text-xs px-0 ${esHoy ? 'text-white hover:bg-blue-700' : 'text-gray-500 hover:bg-gray-200'}`}
                          disabled={esDiaPasado}
                          title={esDiaPasado ? 'No disponible para fechas pasadas' : undefined}
                          onClick={() => handleNuevaCita(iso)}
                        >
                          <Plus className="size-3 mr-0.5" /> Agregar
                        </Button>
                      )}
                    </div>

                    {/* Cards de citas */}
                    <div className="flex-1 bg-white border border-t-0 rounded-b-lg p-1 space-y-1 overflow-y-auto">
                      {citasDia.length === 0 ? (
                        <p className="text-xs text-gray-300 text-center pt-4">—</p>
                      ) : (
                        citasDia.map(cita => {
                          const cancelable = !modoUsuarioServicio && cita.estado_cita !== 'cancelada' && cita.estado_cita !== 'atendida' && cita.estado_cita !== 'no_asistio';
                          const accionesPermitidas = permiteAccionesAgendaServicio(cita);
                          return (
                          <div
                            key={cita.id_cita_servicio}
                            className={`relative p-1.5 bg-blue-50 border border-blue-200 rounded text-xs transition-colors group cursor-pointer hover:bg-blue-100`}
                            onClick={() => {
                              if (modoUsuarioServicio) abrirDetalleServicio(cita);
                              else handleEditarCita(cita);
                            }}
                            title={!accionesPermitidas ? 'Las acciones no están disponibles para citas pasadas' : undefined}
                          >
                            {/* Botón cancelar — visible al hacer hover */}
                            {cancelable && (
                              <button
                                className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center size-4 rounded-full bg-red-100 hover:bg-red-200 text-red-600 disabled:cursor-not-allowed disabled:opacity-40 z-10"
                                title={accionesPermitidas ? 'Cancelar cita' : 'No disponible para citas pasadas'}
                                disabled={!accionesPermitidas}
                                onClick={e => { e.stopPropagation(); abrirCancelacion(cita); }}
                              >
                                <XCircle className="size-3" />
                              </button>
                            )}
                            <div className="flex items-center gap-1 text-blue-800 font-medium">
                              <Clock className="size-2.5 flex-shrink-0" />
                              {cita.hora_inicio?.slice(0, 5)}
                            </div>
                            <div className="truncate text-gray-700 mt-0.5">
                              {cita.paciente?.nombres} {cita.paciente?.apellidos}
                            </div>
                            <div className="truncate text-gray-500">
                              {cita.servicio?.descripcion}
                            </div>
                            <Badge
                              variant={ESTADO_CONFIG[cita.estado_cita]?.variant || 'outline'}
                              className="text-[10px] px-1 py-0 mt-0.5"
                            >
                              {ESTADO_CONFIG[cita.estado_cita]?.label || cita.estado_cita}
                            </Badge>
                          </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── VISTA LISTA ──────────────────────────────────────────────────────── */}
      {vistaActual === 'lista' && (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Desde</Label>
                <Input type="date" value={listaDesde} onChange={e => setListaDesde(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hasta</Label>
                <Input type="date" value={listaHasta} onChange={e => setListaHasta(e.target.value)} />
              </div>
            </div>
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Pago</TableHead>
                    {!modoUsuarioServicio && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {citasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={modoUsuarioServicio ? 6 : 7} className="text-center py-8 text-gray-400">
                        No hay citas en el rango seleccionado
                      </TableCell>
                    </TableRow>
                  ) : (
                    citasFiltradas.map(cita => (
                      <TableRow
                        key={cita.id_cita_servicio}
                        className={modoUsuarioServicio ? 'cursor-pointer hover:bg-blue-50' : ''}
                        onClick={() => {
                          if (modoUsuarioServicio) abrirDetalleServicio(cita);
                        }}
                      >
                        <TableCell className="text-sm">
                          {new Date(cita.fecha_cita + 'T00:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {cita.hora_inicio?.slice(0, 5)} – {cita.hora_fin?.slice(0, 5)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{cita.servicio?.descripcion}</div>
                          <div className="text-xs text-gray-500">{cita.servicio?.area}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{cita.paciente?.nombres} {cita.paciente?.apellidos}</div>
                          <div className="text-xs text-gray-500">{cita.paciente?.cedula}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ESTADO_CONFIG[cita.estado_cita]?.variant || 'outline'}>
                            {ESTADO_CONFIG[cita.estado_cita]?.label || cita.estado_cita}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {cita.precio_cita && (
                            <div className="text-sm">${cita.precio_cita.toFixed(2)}</div>
                          )}
                          {cita.forma_pago && (
                            <div className="text-xs text-gray-500 capitalize">{cita.forma_pago}</div>
                          )}
                        </TableCell>
                        {!modoUsuarioServicio && (
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {cita.estado_cita !== 'cancelada' && cita.estado_cita !== 'atendida' && cita.estado_cita !== 'no_asistio' ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="gap-1"
                                    disabled={!permiteAccionesAgendaServicio(cita)}
                                    title={!permiteAccionesAgendaServicio(cita) ? 'No disponible para citas pasadas' : undefined}
                                    onClick={() => handleEditarCita(cita)}
                                  >
                                    <Pencil className="size-3" /> Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    disabled={!permiteAccionesAgendaServicio(cita)}
                                    title={!permiteAccionesAgendaServicio(cita) ? 'No disponible para citas pasadas' : undefined}
                                    onClick={() => abrirCancelacion(cita)}
                                  >
                                    <XCircle className="size-4" /> Cancelar
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400 italic">
                                  {ESTADO_CONFIG[cita.estado_cita]?.label ?? cita.estado_cita}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Detalle para usuario del servicio */}
      {modoUsuarioServicio && (
        <Dialog open={!!citaDetalle} onOpenChange={open => { if (!open) cerrarDetalleServicio(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalle de la cita</DialogTitle>
              <DialogDescription>
                Revisa los datos de la cita y registra el inicio de atención o cancelación.
              </DialogDescription>
            </DialogHeader>

            {citaDetalle && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <CalendarDays className="size-4 text-blue-600" />
                      Datos de la cita
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Fecha</p>
                        <p className="font-medium capitalize">{formatFechaCompleta(citaDetalle.fecha_cita)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Horario</p>
                        <p className="font-medium">{citaDetalle.hora_inicio?.slice(0, 5)} - {citaDetalle.hora_fin?.slice(0, 5)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Servicio</p>
                        <p className="font-medium">{citaDetalle.servicio?.descripcion}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Estado</p>
                        <Badge variant={ESTADO_CONFIG[citaDetalle.estado_cita]?.variant || 'outline'}>
                          {ESTADO_CONFIG[citaDetalle.estado_cita]?.label || citaDetalle.estado_cita}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Inicio de atención</p>
                        <p className="font-medium">
                          {formatFechaHora(citaDetalle.fecha_inicio_atencion) !== 'No registrado'
                            ? formatFechaHora(citaDetalle.fecha_inicio_atencion)
                            : getInicioAtencionDesdeNotas(citaDetalle.notas_cita) || 'No iniciado'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Atendida</p>
                        <p className="font-medium">{formatFechaHora(citaDetalle.fecha_atendida)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Cancelada</p>
                        <p className="font-medium">{formatFechaHora(citaDetalle.fecha_cancelada)}</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <User className="size-4 text-blue-600" />
                      Datos del cliente
                    </div>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Paciente</p>
                        <p className="font-medium">{citaDetalle.paciente?.nombres} {citaDetalle.paciente?.apellidos}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">Cédula</p>
                          <p className="font-medium">{citaDetalle.paciente?.cedula || 'No registrada'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Teléfono</p>
                          <p className="font-medium flex items-center gap-1">
                            <Phone className="size-3 text-gray-400" />
                            {citaDetalle.paciente?.telefono || 'No registrado'}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Correo</p>
                        <p className="font-medium flex items-center gap-1 break-all">
                          <Mail className="size-3 text-gray-400 flex-shrink-0" />
                          {citaDetalle.paciente?.email || 'No registrado'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Dirección</p>
                        <p className="font-medium flex items-start gap-1">
                          <MapPin className="size-3 text-gray-400 flex-shrink-0 mt-1" />
                          <span>{citaDetalle.paciente?.direccion || 'No registrada'}</span>
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>

                <Card className="p-4 text-sm">
                  <p className="text-xs text-gray-500">Motivo / notas</p>
                  <p className="mt-1 whitespace-pre-wrap">{citaDetalle.motivo || citaDetalle.notas_cita || 'Sin observaciones registradas'}</p>
                </Card>

                <Card className="p-4 space-y-3 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                    <Stethoscope className="size-4 text-blue-600" />
                    Datos de confirmación médica
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Médico solicitante</p>
                      <p className="font-medium">{citaDetalle.medico_solicitante || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Registro médico</p>
                      <p className="font-medium">{citaDetalle.numero_registro_medico || 'No registrado'}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center gap-2"
                    onClick={handleAbrirFotoPedido}
                    disabled={isAbriendoFoto}
                  >
                    {isAbriendoFoto ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Image className="size-4" />
                    )}
                    Ver fotografía del pedido
                    <ExternalLink className="size-3" />
                  </Button>
                </Card>

                {mostrarCancelacionServicio && (
                  <Card className="p-4 border-red-200 bg-red-50">
                    <Label htmlFor="observacion-cancelacion" className="text-sm font-medium text-red-900">
                      Observación de cancelación *
                    </Label>
                    <Textarea
                      id="observacion-cancelacion"
                      value={observacionCancelacion}
                      onChange={e => setObservacionCancelacion(e.target.value)}
                      placeholder="Describe el motivo de la cancelación"
                      className="mt-2 bg-white"
                      rows={3}
                    />
                  </Card>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={cerrarDetalleServicio} disabled={isProcesandoAccion}>
                Cerrar
              </Button>

              {mostrarCancelacionServicio ? (
                <Button
                  variant="destructive"
                  onClick={handleCancelarServicioConObservacion}
                  disabled={isProcesandoAccion || observacionCancelacion.trim() === ''}
                >
                  {isProcesandoAccion && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Confirmar cancelación
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setMostrarCancelacionServicio(true)}
                    disabled={isProcesandoAccion || !permiteAccionesAgendaServicio(citaDetalle)}
                    title={!permiteAccionesAgendaServicio(citaDetalle) ? 'No disponible para citas pasadas' : undefined}
                  >
                    <XCircle className="size-4 mr-2" />
                    Cancelar cita
                  </Button>
                  {citaDetalle?.estado_cita === 'confirmada' && (
                    <Button
                      onClick={handleIniciarAtencionServicio}
                      disabled={isProcesandoAccion || !permiteAccionesAgendaServicio(citaDetalle)}
                      title={!permiteAccionesAgendaServicio(citaDetalle) ? 'No disponible para citas pasadas' : undefined}
                    >
                      {isProcesandoAccion ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <PlayCircle className="size-4 mr-2" />
                      )}
                      Inicio de atención
                    </Button>
                  )}
                  {citaDetalle?.estado_cita === 'en_atencion' && (
                    <Button
                      onClick={() => abrirPantallaAtencion(citaDetalle)}
                      disabled={isProcesandoAccion || !permiteAccionesAgendaServicio(citaDetalle)}
                      title={!permiteAccionesAgendaServicio(citaDetalle) ? 'No disponible para citas pasadas' : undefined}
                    >
                      <PlayCircle className="size-4 mr-2" />
                      Continuar atención
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de agendar/editar */}
      {!modoUsuarioServicio && (
        <AgendarCitaServicioModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setCitaParaEditar(null); }}
          onCitaAgendada={() => {}}
          onCrearCita={crearCita}
          onActualizarCita={actualizarCita}
          citaEditar={citaParaEditar}
          fechaInicial={fechaPreseleccionada}
          idServicioInicial={idServicioNum}
          currentUserName={currentUser?.name}
          onSolicitarCancelacion={() => {
            const cita = citaParaEditar;
            setIsModalOpen(false);
            setCitaParaEditar(null);
            if (cita) setCitaACancelar(cita);
          }}
        />
      )}

      {/* Confirmar cancelación */}
      <AlertDialog open={!!citaACancelar} onOpenChange={open => !open && setCitaACancelar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
            <AlertDialogDescription>
              Se cancelará la cita de{' '}
              <strong>{citaACancelar?.paciente?.nombres} {citaACancelar?.paciente?.apellidos}</strong>{' '}
              para{' '}
              <strong>{citaACancelar?.servicio?.descripcion}</strong>{' '}
              el {citaACancelar?.fecha_cita} a las {citaACancelar?.hora_inicio?.slice(0, 5)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleCancelarConfirmar}
            >
              Cancelar cita
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
