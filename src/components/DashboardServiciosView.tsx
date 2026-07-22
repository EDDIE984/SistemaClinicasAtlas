// Dashboard de Servicios para GESTOR_IMAGEN y administrativo
import { useState, useMemo, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import {
  LayoutDashboard, Loader2, CheckCircle, XCircle, Pencil, ClipboardList,
  Calendar, Clock, User, Stethoscope, Image, AlertCircle, RefreshCw, Eye,
  FileText, BookOpen, IdCard, Phone, Mail, MapPin, Cake, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCitasServicio } from '../hooks/useCitasServicio';
import { useSucursales, useServicios } from '../hooks/useConfiguraciones';
import { AgendarCitaServicioModal } from './AgendarCitaServicioModal';
import { getFotoPedido, generarUrlFirmadaPdf } from '../lib/citaServicioService';
import type { CitaServicioCompleta } from '../lib/configuracionesService';
import { FinalizarCitaServicioModal } from './FinalizarCitaServicioModal';
import { calcularEdad, getPacienteById, updatePaciente, type Paciente } from '../lib/pacientesService';

interface DashboardServiciosViewProps {
  currentUser: {
    name: string;
    tipo_usuario?: string;
    sucursal?: string;
  } | null;
}

type PacienteEditForm = Pick<Paciente,
  | 'cedula'
  | 'nombres'
  | 'apellidos'
  | 'fecha_nacimiento'
  | 'sexo'
  | 'estado_civil'
  | 'telefono'
  | 'telefono_fijo'
  | 'email'
  | 'direccion'
  | 'contacto_emergencia_nombre'
  | 'contacto_emergencia_parentesco'
  | 'contacto_emergencia_telefono'
>;

// ─── Utilidades de fecha ──────────────────────────────────────────────────────
// ─── Configuración de estados ─────────────────────────────────────────────────
const ESTADO_CONFIG: Record<string, {
  label: string;
  className: string;
}> = {
  agendada:    { label: 'Agendada',       className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  confirmada:  { label: 'Confirmada',     className: 'bg-blue-100 text-blue-800 border-blue-300' },
  en_atencion: { label: 'Inicio Atención',className: 'bg-purple-100 text-purple-800 border-purple-300' },
  atendida:    { label: 'Atendida',       className: 'bg-green-100 text-green-800 border-green-300' },
  finalizado:  { label: 'Finalizado',     className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  cancelada:   { label: 'Cancelada',      className: 'bg-red-100 text-red-800 border-red-300' },
  no_asistio:  { label: 'No asistió',     className: 'bg-red-100 text-red-800 border-red-300' },
};

const PUEDE_ACCIONAR = (estado: string) =>
  !['cancelada', 'atendida', 'no_asistio', 'finalizado'].includes(estado);

const normalizarTexto = (valor?: string | null) => (valor ?? '').trim().toUpperCase();

const MIME_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;
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

function fechaEcuadorMasISO(dias: number): string {
  const [year, month, day] = fechaHoyEcuadorISO().split('-').map(Number);
  const fecha = new Date(Date.UTC(year, month - 1, day + dias));
  return fecha.toISOString().slice(0, 10);
}

function permiteAccionesDashboardServicio(cita: CitaServicioCompleta): boolean {
  return cita.fecha_cita >= fechaHoyEcuadorISO();
}

function calcularBytesBase64(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.floor(base64.length * 0.75);
}

function dataUrlTieneFirmaImagen(dataUrl: string): boolean {
  const base64 = dataUrl.split(',')[1] ?? '';
  return (
    base64.startsWith('/9j/') ||
    base64.startsWith('iVBOR') ||
    base64.startsWith('UklGR') ||
    base64.startsWith('R0lGOD') ||
    base64.startsWith('Qk')
  );
}

function extensionDesdeDataUrl(dataUrl: string): string {
  const mime = dataUrl.match(/^data:([^;]+);base64,/)?.[1];
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/bmp') return 'bmp';
  return 'jpg';
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/^data:([^;]+);base64$/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function DashboardServiciosView({ currentUser }: DashboardServiciosViewProps) {
  const { sucursales } = useSucursales();

  // ─── Filtros ─────────────────────────────────────────────────────────────
  const [filtroSucursal, setFiltroSucursal] = useState('todas');
  const [filtroServicio, setFiltroServicio]  = useState('todos');
  const [desde, setDesde] = useState(fechaHoyEcuadorISO);
  const [hasta, setHasta] = useState(() => fechaEcuadorMasISO(30));

  const idSucursalNum = filtroSucursal !== 'todas' ? parseInt(filtroSucursal) : undefined;
  const idServicioNum = filtroServicio !== 'todos'  ? parseInt(filtroServicio) : undefined;

  const { servicios } = useServicios(idSucursalNum);
  const serviciosActivos = servicios.filter(
    s => s.estado === 'activo' && normalizarTexto(s.descripcion) !== 'CONSULTA EXTERNA'
  );

  // ─── Citas ───────────────────────────────────────────────────────────────
  const { citas, isLoading, loadCitas, crearCita, actualizarCita, cancelarCita, confirmarCita } = useCitasServicio({
    fechaDesde: desde,
    fechaHasta: hasta,
    idSucursal: idSucursalNum,
    idServicio: idServicioNum,
  });

  // ─── Detalle del paciente ────────────────────────────────────────────────
  const [pacienteDetalle, setPacienteDetalle] = useState<Paciente | null>(null);
  const [isPacienteDetalleOpen, setIsPacienteDetalleOpen] = useState(false);
  const [isLoadingPaciente, setIsLoadingPaciente] = useState(false);
  const [isEditandoPaciente, setIsEditandoPaciente] = useState(false);
  const [isGuardandoPaciente, setIsGuardandoPaciente] = useState(false);
  const [pacienteForm, setPacienteForm] = useState<PacienteEditForm | null>(null);

  const handleVerPaciente = async (cita: CitaServicioCompleta) => {
    setIsPacienteDetalleOpen(true);
    setIsLoadingPaciente(true);
    setIsEditandoPaciente(false);
    setPacienteForm(null);
    setPacienteDetalle(null);

    try {
      const paciente = await getPacienteById(cita.id_paciente);
      if (!paciente) {
        toast.error('No se pudo obtener la información del paciente');
        setIsPacienteDetalleOpen(false);
        return;
      }
      setPacienteDetalle(paciente);
    } finally {
      setIsLoadingPaciente(false);
    }
  };

  const iniciarEdicionPaciente = () => {
    if (!pacienteDetalle) return;
    setPacienteForm({
      cedula: pacienteDetalle.cedula,
      nombres: pacienteDetalle.nombres,
      apellidos: pacienteDetalle.apellidos,
      fecha_nacimiento: pacienteDetalle.fecha_nacimiento,
      sexo: pacienteDetalle.sexo,
      estado_civil: pacienteDetalle.estado_civil ?? '',
      telefono: pacienteDetalle.telefono ?? '',
      telefono_fijo: pacienteDetalle.telefono_fijo ?? '',
      email: pacienteDetalle.email ?? '',
      direccion: pacienteDetalle.direccion ?? '',
      contacto_emergencia_nombre: pacienteDetalle.contacto_emergencia_nombre ?? '',
      contacto_emergencia_parentesco: pacienteDetalle.contacto_emergencia_parentesco ?? '',
      contacto_emergencia_telefono: pacienteDetalle.contacto_emergencia_telefono ?? '',
    });
    setIsEditandoPaciente(true);
  };

  const actualizarCampoPaciente = <K extends keyof PacienteEditForm>(campo: K, valor: PacienteEditForm[K]) => {
    setPacienteForm(actual => actual ? { ...actual, [campo]: valor } : actual);
  };

  const handleGuardarPaciente = async () => {
    if (!pacienteDetalle || !pacienteForm || isGuardandoPaciente) return;

    const obligatoriosCompletos = pacienteForm.cedula.trim()
      && pacienteForm.nombres.trim()
      && pacienteForm.apellidos.trim()
      && pacienteForm.fecha_nacimiento;
    if (!obligatoriosCompletos) {
      toast.error('Completa cédula, nombres, apellidos y fecha de nacimiento');
      return;
    }
    if (pacienteForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pacienteForm.email)) {
      toast.error('Ingresa un correo electrónico válido');
      return;
    }

    setIsGuardandoPaciente(true);
    try {
      const updates: Partial<Paciente> = {
        ...pacienteForm,
        cedula: pacienteForm.cedula.trim().toUpperCase(),
        nombres: pacienteForm.nombres.trim().toUpperCase(),
        apellidos: pacienteForm.apellidos.trim().toUpperCase(),
        estado_civil: pacienteForm.estado_civil?.trim() || null,
        telefono: pacienteForm.telefono?.trim() || null,
        telefono_fijo: pacienteForm.telefono_fijo?.trim() || null,
        email: pacienteForm.email?.trim().toUpperCase() || null,
        direccion: pacienteForm.direccion?.trim().toUpperCase() || null,
        contacto_emergencia_nombre: pacienteForm.contacto_emergencia_nombre?.trim().toUpperCase() || null,
        contacto_emergencia_parentesco: pacienteForm.contacto_emergencia_parentesco?.trim().toUpperCase() || null,
        contacto_emergencia_telefono: pacienteForm.contacto_emergencia_telefono?.trim() || null,
      };

      await updatePaciente(pacienteDetalle.id_paciente, updates);
      const pacienteActualizado = { ...pacienteDetalle, ...updates } as Paciente;
      setPacienteDetalle(pacienteActualizado);
      setIsEditandoPaciente(false);
      setPacienteForm(null);
      await loadCitas();
      toast.success('Datos del paciente actualizados');
    } catch (error) {
      console.error('Error al actualizar el paciente desde el dashboard:', error);
      toast.error('No se pudieron actualizar los datos del paciente');
    } finally {
      setIsGuardandoPaciente(false);
    }
  };

  const citasOrdenadas = useMemo(() =>
    [...citas].sort((a, b) =>
      a.fecha_cita.localeCompare(b.fecha_cita) ||
      (a.servicio?.descripcion ?? '').localeCompare(
        b.servicio?.descripcion ?? '',
        'es',
        { sensitivity: 'base' }
      ) ||
      (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? '') ||
      a.id_cita_servicio - b.id_cita_servicio
    ),
  [citas]);

  // ─── Estadísticas ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:       citas.length,
    agendadas:   citas.filter(c => c.estado_cita === 'agendada').length,
    confirmadas: citas.filter(c => c.estado_cita === 'confirmada').length,
    atendidas:   citas.filter(c => c.estado_cita === 'atendida').length,
    canceladas:  citas.filter(c => c.estado_cita === 'cancelada').length,
  }), [citas]);

  // ─── Modal agendar/editar ─────────────────────────────────────────────────
  const [isModalAgendarOpen, setIsModalAgendarOpen] = useState(false);
  const [citaParaEditar, setCitaParaEditar]         = useState<CitaServicioCompleta | null>(null);

  const handleEditar = (cita: CitaServicioCompleta) => {
    if (!permiteAccionesDashboardServicio(cita)) {
      toast.error('Solo puedes editar citas de hoy o fechas futuras');
      return;
    }
    setCitaParaEditar(cita);
    setIsModalAgendarOpen(true);
  };

  // ─── Cancelación ─────────────────────────────────────────────────────────
  const [citaACancelar, setCitaACancelar] = useState<CitaServicioCompleta | null>(null);

  const handleCancelarConfirmar = async () => {
    if (!citaACancelar) return;
    if (!permiteAccionesDashboardServicio(citaACancelar)) {
      toast.error('Solo puedes cancelar citas de hoy o fechas futuras');
      setCitaACancelar(null);
      return;
    }
    const ok = await cancelarCita(citaACancelar.id_cita_servicio);
    if (ok) { toast.success('Cita cancelada'); setCitaACancelar(null); }
    else toast.error('Error al cancelar la cita');
  };

  const abrirCancelacion = (cita: CitaServicioCompleta) => {
    if (!permiteAccionesDashboardServicio(cita)) {
      toast.error('Solo puedes cancelar citas de hoy o fechas futuras');
      return;
    }
    setCitaACancelar(cita);
  };

  // ─── Confirmación ─────────────────────────────────────────────────────────
  const [citaAConfirmar, setCitaAConfirmar]       = useState<CitaServicioCompleta | null>(null);
  const [medicoSolicitante, setMedicoSolicitante] = useState('');
  const [numRegistro, setNumRegistro]             = useState('');
  const [tieneSeguroMedico, setTieneSeguroMedico] = useState('');
  const [fotoBase64, setFotoBase64]               = useState('');
  const [fotoNombre, setFotoNombre]               = useState('');
  const [isDraggingFoto, setIsDraggingFoto] = useState(false);
  const [isUploadingFoto, setIsUploadingFoto]     = useState(false);
  const [isConfirmando, setIsConfirmando]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const abrirConfirmacion = (cita: CitaServicioCompleta) => {
    if (!permiteAccionesDashboardServicio(cita)) {
      toast.error('Solo puedes confirmar citas de hoy o fechas futuras');
      return;
    }
    setCitaAConfirmar(cita);
    setMedicoSolicitante('');
    setNumRegistro('');
    setTieneSeguroMedico(cita.tiene_seguro_medico || '');
    setFotoBase64('');
    setFotoNombre('');
    setIsDraggingFoto(false);
  };

  const procesarFotoPedido = (file: File) => {
    if (!MIME_IMAGEN_PERMITIDOS.includes(file.type.toLowerCase())) {
      toast.error('Solo se permiten imágenes');
      return;
    }
    if (file.size > MAX_IMAGEN_BYTES) {
      toast.error('La imagen no puede superar 5 MB');
      return;
    }

    setIsUploadingFoto(true);
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64Raw = ev.target?.result as string;
        if (!base64Raw?.startsWith('data:image/')) {
          toast.error('Formato de imagen inválido');
          setIsUploadingFoto(false);
          return;
        }

        if (!dataUrlTieneFirmaImagen(base64Raw)) {
          toast.error('El archivo seleccionado no contiene una imagen válida');
          setIsUploadingFoto(false);
          return;
        }

        const bytes = calcularBytesBase64(base64Raw);
        if (bytes > MAX_IMAGEN_BYTES) {
          toast.error('Imagen demasiado grande (máximo 5 MB)');
          setIsUploadingFoto(false);
          return;
        }

        setFotoBase64(base64Raw);
        setFotoNombre(file.name);
        setIsUploadingFoto(false);
        toast.success(`Imagen cargada (${Math.round(bytes / 1024)} KB)`);
      };
      reader.onerror = () => {
        setIsUploadingFoto(false);
        toast.error('Error al leer el archivo');
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploadingFoto(false);
      toast.error('Error al leer el archivo');
    }
  };

  const handleSeleccionarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) procesarFotoPedido(file);
    e.target.value = '';
  };

  const handleDropFoto = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFoto(false);
    const file = e.dataTransfer.files?.[0];
    if (file) procesarFotoPedido(file);
  };

  const handleConfirmar = async () => {
    if (!citaAConfirmar || !puedeConfirmar) return;
    setIsConfirmando(true);
    try {
      const ok = await confirmarCita(citaAConfirmar.id_cita_servicio, {
        medico_solicitante:     medicoSolicitante.toUpperCase(),
        numero_registro_medico: numRegistro,
        tiene_seguro_medico:    tieneSeguroMedico.trim(),
        ...(fotoBase64 ? { foto_pedido_base64: fotoBase64 } : {}),
      });
      if (ok) {
        toast.success('Cita confirmada exitosamente');
        setCitaAConfirmar(null);
      } else {
        toast.error('Error al confirmar la cita');
      }
    } finally {
      setIsConfirmando(false);
    }
  };

  const puedeConfirmar =
    medicoSolicitante.trim() !== '' &&
    numRegistro.trim() !== '' &&
    tieneSeguroMedico.trim() !== '';

  // ─── Visor de foto ────────────────────────────────────────────────────────
  const [citaFoto, setCitaFoto]             = useState<CitaServicioCompleta | null>(null);
  const [fotoVisualizando, setFotoVisualizando] = useState<string | null>(null);
  const [isLoadingFoto, setIsLoadingFoto]   = useState(false);

  const handleVerFoto = async (cita: CitaServicioCompleta) => {
    setCitaFoto(cita);
    setFotoVisualizando(null);
    setIsLoadingFoto(true);
    try {
      const foto = await getFotoPedido(cita.id_cita_servicio);
      setFotoVisualizando(foto);
    } finally {
      setIsLoadingFoto(false);
    }
  };

  const handleVerFotoDesdeConfirmacion = () => {
    if (!citaAConfirmar) return;
    if (fotoBase64) {
      setCitaFoto(citaAConfirmar);
      setFotoVisualizando(fotoBase64);
      setIsLoadingFoto(false);
      return;
    }
    handleVerFoto(citaAConfirmar);
  };

  const handleDescargarFoto = () => {
    if (!fotoVisualizando || !citaFoto) return;

    try {
      const blob = dataUrlToBlob(fotoVisualizando);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pedido_${citaFoto.id_cita_servicio}.${extensionDesdeDataUrl(fotoVisualizando)}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('❌ Error al descargar foto de pedido:', error);
      toast.error('No se pudo descargar la fotografía del pedido');
    }
  };

  // ─── Finalizar con PDF ────────────────────────────────────────────────────
  const [citaParaFinalizar, setCitaParaFinalizar] = useState<CitaServicioCompleta | null>(null);
  const [modalFinalizarMode, setModalFinalizarMode] = useState<'finalizar' | 'reemplazar'>('finalizar');
  const [modalFinalizarOpen, setModalFinalizarOpen] = useState(false);

  const puedeFinalizarCitas = ['GESTOR_IMAGEN', 'administrativo'].includes(currentUser?.tipo_usuario || '');

  const abrirModalFinalizar = (cita: CitaServicioCompleta, mode: 'finalizar' | 'reemplazar') => {
    if (mode === 'finalizar' && !permiteAccionesDashboardServicio(cita)) {
      toast.error('Solo puedes finalizar citas de hoy o fechas futuras');
      return;
    }
    setCitaParaFinalizar(cita);
    setModalFinalizarMode(mode);
    setModalFinalizarOpen(true);
  };

  const abrirPdf = async (storagePath: string) => {
    const ventanaPdf = window.open('about:blank', '_blank');

    if (!ventanaPdf) {
      toast.error('El navegador bloqueó la ventana del PDF. Habilita las ventanas emergentes para este sitio.');
      return;
    }

    ventanaPdf.opener = null;
    ventanaPdf.document.title = 'Cargando informe PDF...';
    ventanaPdf.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 24px;">Cargando informe PDF...</p>';

    const url = await generarUrlFirmadaPdf(storagePath);
    if (url) {
      ventanaPdf.location.replace(url);
      return;
    }

    ventanaPdf.close();
    toast.error('No se pudo abrir el PDF. Verifica los permisos del almacenamiento.');
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <LayoutDashboard className="size-6 text-blue-600" />
            Dashboard de Servicios
          </h1>
          <p className="text-sm text-gray-500">Gestión y confirmación de citas de imagen y laboratorio</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/manual-servicio-imagen.html', '_blank')}
          >
            <BookOpen className="size-4 mr-1" /> Manual
          </Button>
          <Button variant="outline" size="sm" onClick={() => void loadCitas()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-gray-200 bg-white">
        <CardContent className="p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <p className="text-sm font-semibold text-gray-900">Filtros de búsqueda</p>
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Sucursal</Label>
              <Select value={filtroSucursal} onValueChange={v => { setFiltroSucursal(v); setFiltroServicio('todos'); }}>
                <SelectTrigger className="h-10 bg-gray-50 border-gray-200"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las sucursales</SelectItem>
                  {sucursales.map(s => (
                    <SelectItem key={s.id_sucursal} value={s.id_sucursal.toString()}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Servicio</Label>
              <Select value={filtroServicio} onValueChange={setFiltroServicio}>
                <SelectTrigger className="h-10 bg-gray-50 border-gray-200"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los servicios</SelectItem>
                  {serviciosActivos.map(s => (
                    <SelectItem key={s.id_servicio} value={s.id_servicio.toString()}>{s.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Desde</Label>
              <Input
                type="date"
                value={desde}
                onChange={e => setDesde(e.target.value)}
                className="h-10 bg-gray-50 border-gray-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Hasta</Label>
              <Input
                type="date"
                value={hasta}
                onChange={e => setHasta(e.target.value)}
                className="h-10 bg-gray-50 border-gray-200"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de citas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4" />
            Citas ({citasOrdenadas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-blue-600" />
            </div>
          ) : citasOrdenadas.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ClipboardList className="size-10 mx-auto mb-2 opacity-30" />
              <p>No hay citas en el rango seleccionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Médico solicitante</TableHead>
                    <TableHead>Tiene seguro médico</TableHead>
                    <TableHead>Foto pedido</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {citasOrdenadas.map(cita => {
                    const cfg = ESTADO_CONFIG[cita.estado_cita] ?? { label: cita.estado_cita, className: 'bg-gray-100 text-gray-700' };
                    const accionable = PUEDE_ACCIONAR(cita.estado_cita);
                    const accionesPermitidas = permiteAccionesDashboardServicio(cita);
                    const accionableEnFechaPermitida = accionable && accionesPermitidas;
                    const tieneFotoPedido = cita.tiene_foto_pedido === true;
                    return (
                      <TableRow key={cita.id_cita_servicio}>
                        <TableCell className="text-sm whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="size-3 text-gray-400" />
                            {new Date(cita.fecha_cita + 'T00:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="size-3 text-gray-400" />
                            {cita.hora_inicio?.slice(0, 5)} – {cita.hora_fin?.slice(0, 5)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{cita.servicio?.descripcion}</div>
                          <div className="text-xs text-gray-500">{cita.servicio?.area}</div>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => handleVerPaciente(cita)}
                            className="group min-w-[170px] rounded-md px-2 py-1.5 text-left transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                            aria-label={`Ver datos de ${cita.paciente?.nombres} ${cita.paciente?.apellidos}`}
                          >
                            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 group-hover:text-blue-700">
                              <User className="size-3.5 flex-shrink-0 text-blue-500" />
                              <span>{cita.paciente?.nombres} {cita.paciente?.apellidos}</span>
                            </span>
                            <span className="ml-5 flex items-center gap-1 text-xs text-gray-500">
                              {cita.paciente?.cedula}
                              <Eye className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                            </span>
                          </button>
                        </TableCell>

                        {/* Médico solicitante */}
                        <TableCell>
                          {cita.medico_solicitante ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Stethoscope className="size-3 text-gray-400 flex-shrink-0" />
                              <span className="font-medium">{cita.medico_solicitante}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </TableCell>

                        {/* Tiene seguro médico */}
                        <TableCell>
                          {cita.tiene_seguro_medico ? (
                            <span className="text-sm">{cita.tiene_seguro_medico}</span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </TableCell>

                        {/* Foto pedido */}
                        <TableCell>
                          {tieneFotoPedido ? (
                            <button
                              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 border border-green-200 text-green-700 text-xs hover:bg-green-100 transition-colors"
                              onClick={() => handleVerFoto(cita)}
                            >
                              <Image className="size-3.5" />
                              Ver foto
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-300">
                              <Image className="size-3.5" />
                              Sin foto
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
                            {cfg.label}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="flex flex-nowrap justify-end gap-1">
                            {/* "Ver foto" ya está en la columna Foto pedido */}
                            {cita.estado_cita === 'agendada' && (
                              <Button
                                size="icon"
                                variant="outline"
                                className="size-8 border-blue-300 text-blue-600 hover:bg-blue-50"
                                disabled={!accionableEnFechaPermitida}
                                title={accionableEnFechaPermitida ? 'Confirmar cita' : 'Confirmar no disponible para citas pasadas'}
                                aria-label="Confirmar cita"
                                onClick={() => abrirConfirmacion(cita)}
                              >
                                <CheckCircle className="size-4" />
                              </Button>
                            )}
                            {accionable && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-8"
                                  disabled={!accionableEnFechaPermitida}
                                  title={accionableEnFechaPermitida ? 'Editar cita' : 'Editar no disponible para citas pasadas'}
                                  aria-label="Editar cita"
                                  onClick={() => handleEditar(cita)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  disabled={!accionableEnFechaPermitida}
                                  title={accionableEnFechaPermitida ? 'Cancelar cita' : 'Cancelar no disponible para citas pasadas'}
                                  aria-label="Cancelar cita"
                                  onClick={() => abrirCancelacion(cita)}
                                >
                                  <XCircle className="size-4" />
                                </Button>
                              </>
                            )}
                            {puedeFinalizarCitas && !['cancelada', 'no_asistio', 'finalizado'].includes(cita.estado_cita) && (
                              <Button
                                size="icon"
                                variant="outline"
                                className="size-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                disabled={!accionesPermitidas}
                                title={accionesPermitidas ? 'Finalizar cita' : 'Finalizar no disponible para citas pasadas'}
                                aria-label="Finalizar cita"
                                onClick={() => abrirModalFinalizar(cita, 'finalizar')}
                              >
                                <FileText className="size-4" />
                              </Button>
                            )}
                            {cita.estado_cita === 'finalizado' && (
                              <>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="size-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                  title="Ver PDF del resultado"
                                  aria-label="Ver PDF del resultado"
                                  onClick={() => abrirPdf(cita.url_pdf_resultado!)}
                                >
                                  <Eye className="size-4" />
                                </Button>
                                {puedeFinalizarCitas && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-8"
                                    title="Reemplazar PDF del resultado"
                                    aria-label="Reemplazar PDF del resultado"
                                    onClick={() => abrirModalFinalizar(cita, 'reemplazar')}
                                  >
                                    <RefreshCw className="size-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de información del paciente */}
      <Dialog
        open={isPacienteDetalleOpen}
        onOpenChange={open => {
          setIsPacienteDetalleOpen(open);
          if (!open) {
            setPacienteDetalle(null);
            setPacienteForm(null);
            setIsEditandoPaciente(false);
          }
        }}
      >
        <DialogContent
          className="flex flex-col gap-0 overflow-hidden p-0"
          style={{
            top: '1rem',
            right: '1rem',
            bottom: '1rem',
            left: '1rem',
            width: 'auto',
            height: 'auto',
            maxWidth: '42rem',
            maxHeight: 'none',
            margin: '0 auto',
            translate: 'none',
          }}
        >
          <DialogHeader className="shrink-0 border-b bg-gray-50 px-6 py-5 pr-12">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <User className="size-4" />
              </span>
              Información del paciente
            </DialogTitle>
            <DialogDescription>
              Datos personales y de contacto registrados en la historia clínica.
            </DialogDescription>
          </DialogHeader>

          {isLoadingPaciente ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-blue-600">
              <Loader2 className="size-8 animate-spin" />
              <span className="text-sm">Cargando datos del paciente...</span>
            </div>
          ) : pacienteDetalle && isEditandoPaciente && pacienteForm ? (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
              <div>
                <p className="text-lg font-semibold text-gray-950">Editar datos del paciente</p>
                <p className="mt-1 text-sm text-gray-500">Los campos marcados con * son obligatorios.</p>
              </div>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Datos personales</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="paciente-cedula">Cédula *</Label>
                    <Input id="paciente-cedula" value={pacienteForm.cedula} onChange={e => actualizarCampoPaciente('cedula', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="paciente-fecha-nacimiento">Fecha de nacimiento *</Label>
                    <Input id="paciente-fecha-nacimiento" type="date" value={pacienteForm.fecha_nacimiento} onChange={e => actualizarCampoPaciente('fecha_nacimiento', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="paciente-nombres">Nombres *</Label>
                    <Input id="paciente-nombres" className="uppercase" value={pacienteForm.nombres} onChange={e => actualizarCampoPaciente('nombres', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="paciente-apellidos">Apellidos *</Label>
                    <Input id="paciente-apellidos" className="uppercase" value={pacienteForm.apellidos} onChange={e => actualizarCampoPaciente('apellidos', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="paciente-sexo">Sexo *</Label>
                    <Select value={pacienteForm.sexo} onValueChange={value => actualizarCampoPaciente('sexo', value as Paciente['sexo'])}>
                      <SelectTrigger id="paciente-sexo"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Femenino</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="paciente-estado-civil">Estado civil</Label>
                    <Input id="paciente-estado-civil" value={pacienteForm.estado_civil ?? ''} onChange={e => actualizarCampoPaciente('estado_civil', e.target.value)} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Contacto</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="paciente-telefono">Teléfono celular</Label>
                    <Input id="paciente-telefono" type="tel" value={pacienteForm.telefono ?? ''} onChange={e => actualizarCampoPaciente('telefono', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="paciente-telefono-fijo">Teléfono fijo</Label>
                    <Input id="paciente-telefono-fijo" type="tel" value={pacienteForm.telefono_fijo ?? ''} onChange={e => actualizarCampoPaciente('telefono_fijo', e.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="paciente-email">Correo electrónico</Label>
                    <Input id="paciente-email" type="email" value={pacienteForm.email ?? ''} onChange={e => actualizarCampoPaciente('email', e.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="paciente-direccion">Dirección</Label>
                    <Input id="paciente-direccion" value={pacienteForm.direccion ?? ''} onChange={e => actualizarCampoPaciente('direccion', e.target.value)} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Contacto de emergencia</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="paciente-emergencia-nombre">Nombre</Label>
                    <Input id="paciente-emergencia-nombre" value={pacienteForm.contacto_emergencia_nombre ?? ''} onChange={e => actualizarCampoPaciente('contacto_emergencia_nombre', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="paciente-emergencia-parentesco">Parentesco</Label>
                    <Input id="paciente-emergencia-parentesco" value={pacienteForm.contacto_emergencia_parentesco ?? ''} onChange={e => actualizarCampoPaciente('contacto_emergencia_parentesco', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="paciente-emergencia-telefono">Teléfono</Label>
                    <Input id="paciente-emergencia-telefono" type="tel" value={pacienteForm.contacto_emergencia_telefono ?? ''} onChange={e => actualizarCampoPaciente('contacto_emergencia_telefono', e.target.value)} />
                  </div>
                </div>
              </section>
            </div>
          ) : pacienteDetalle ? (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
              <div>
                <p className="text-xl font-semibold text-gray-950">
                  {pacienteDetalle.nombres} {pacienteDetalle.apellidos}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  <Badge variant="outline" className="font-normal">
                    Historia clínica #{pacienteDetalle.id_paciente}
                  </Badge>
                  <span>{pacienteDetalle.estado === 'activo' ? 'Paciente activo' : 'Paciente inactivo'}</span>
                </div>
              </div>

              <section aria-labelledby="datos-personales-title">
                <h3 id="datos-personales-title" className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Datos personales
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: IdCard, label: 'Cédula', value: pacienteDetalle.cedula },
                    { icon: Cake, label: 'Fecha de nacimiento', value: `${new Date(`${pacienteDetalle.fecha_nacimiento}T00:00:00`).toLocaleDateString('es-EC')} · ${calcularEdad(pacienteDetalle.fecha_nacimiento)} años` },
                    { icon: User, label: 'Sexo', value: pacienteDetalle.sexo === 'M' ? 'Masculino' : pacienteDetalle.sexo === 'F' ? 'Femenino' : pacienteDetalle.sexo },
                    { icon: Users, label: 'Estado civil', value: pacienteDetalle.estado_civil },
                  ].map(({ icon: Icono, label, value }) => (
                    <div key={label} className="flex gap-3 rounded-lg border border-gray-200 p-3">
                      <Icono className="mt-0.5 size-4 flex-shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="break-words text-sm font-medium text-gray-900">{value || 'No registrado'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-labelledby="contacto-title">
                <h3 id="contacto-title" className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Contacto
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: Phone, label: 'Teléfono celular', value: pacienteDetalle.telefono },
                    { icon: Phone, label: 'Teléfono fijo', value: pacienteDetalle.telefono_fijo },
                    { icon: Mail, label: 'Correo electrónico', value: pacienteDetalle.email },
                    { icon: MapPin, label: 'Dirección', value: pacienteDetalle.direccion },
                  ].map(({ icon: Icono, label, value }) => (
                    <div key={label} className="flex gap-3 rounded-lg border border-gray-200 p-3">
                      <Icono className="mt-0.5 size-4 flex-shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="break-words text-sm font-medium text-gray-900">{value || 'No registrado'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-labelledby="emergencia-title">
                <h3 id="emergencia-title" className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Contacto de emergencia
                </h3>
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                  <p className="font-medium text-gray-900">{pacienteDetalle.contacto_emergencia_nombre || 'No registrado'}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {[pacienteDetalle.contacto_emergencia_parentesco, pacienteDetalle.contacto_emergencia_telefono]
                      .filter(Boolean)
                      .join(' · ') || 'Sin parentesco ni teléfono registrados'}
                  </p>
                </div>
              </section>
            </div>
          ) : null}

          <DialogFooter className="shrink-0 border-t bg-gray-50 px-6 py-4">
            {isEditandoPaciente ? (
              <>
                <Button
                  variant="outline"
                  disabled={isGuardandoPaciente}
                  onClick={() => { setIsEditandoPaciente(false); setPacienteForm(null); }}
                >
                  Cancelar
                </Button>
                <Button disabled={isGuardandoPaciente} onClick={handleGuardarPaciente}>
                  {isGuardandoPaciente ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                  Guardar cambios
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsPacienteDetalleOpen(false)}>Cerrar</Button>
                <Button onClick={iniciarEdicionPaciente} disabled={!pacienteDetalle || isLoadingPaciente}>
                  <Pencil className="size-4" />
                  Editar datos
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tarjetas estadísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total citas',  value: stats.total,       color: 'text-gray-800',  bg: 'bg-gray-50',   border: 'border-gray-200' },
          { label: 'Agendadas',    value: stats.agendadas,   color: 'text-yellow-700',bg: 'bg-yellow-50', border: 'border-yellow-200' },
          { label: 'Confirmadas',  value: stats.confirmadas, color: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-200' },
          { label: 'Atendidas',    value: stats.atendidas,   color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200' },
          { label: 'Canceladas',   value: stats.canceladas,  color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200' },
        ].map(stat => (
          <Card key={stat.label} className={`${stat.bg} border ${stat.border}`}>
            <CardContent className="pt-4 pb-3 text-center">
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-gray-600 mt-1">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog de confirmación */}
      <Dialog open={!!citaAConfirmar} onOpenChange={open => {
        if (!open) {
          setCitaAConfirmar(null);
          setFotoBase64('');
          setFotoNombre('');
        }
      }}>
        <DialogContent className="top-4 bottom-4 translate-y-0 max-h-none max-w-md overflow-y-auto p-6">
          <DialogHeader className="pr-8">
            <DialogTitle>Confirmar cita</DialogTitle>
            <DialogDescription>
              Registra el médico solicitante, número de registro y seguro médico para confirmar la cita. La fotografía del pedido es opcional.
            </DialogDescription>
          </DialogHeader>
          {citaAConfirmar && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <div className="font-medium text-blue-900">
                  {citaAConfirmar.paciente?.nombres} {citaAConfirmar.paciente?.apellidos}
                </div>
                <div className="text-blue-700 mt-0.5">
                  {citaAConfirmar.servicio?.descripcion} — {new Date(citaAConfirmar.fecha_cita + 'T00:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'long' })} a las {citaAConfirmar.hora_inicio?.slice(0, 5)}
                </div>
              </div>

              {/* Médico solicitante */}
              <div className="space-y-1.5">
                <Label>Médico solicitante *</Label>
                <Input
                  placeholder="NOMBRE DEL MÉDICO"
                  value={medicoSolicitante}
                  onChange={e => setMedicoSolicitante(e.target.value)}
                  className="uppercase"
                />
              </div>

              {/* Número de registro */}
              <div className="space-y-1.5">
                <Label>Número de registro *</Label>
                <Input
                  placeholder="Ej: 123456"
                  value={numRegistro}
                  onChange={e => setNumRegistro(e.target.value)}
                />
              </div>

              {/* Tiene seguro médico */}
              <div className="space-y-1.5">
                <Label>Tiene seguro médico *</Label>
                <Input
                  placeholder="Ej: Sí, IESS / No / Particular"
                  value={tieneSeguroMedico}
                  onChange={e => setTieneSeguroMedico(e.target.value)}
                />
              </div>

              {/* Fotografía del pedido */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>Fotografía del pedido</Label>
                  {(fotoBase64 || citaAConfirmar.tiene_foto_pedido) && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1.5"
                      title="Visualizar fotografía"
                      onClick={handleVerFotoDesdeConfirmacion}
                    >
                      <Eye className="size-3.5" />
                      Ver foto
                    </Button>
                  )}
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={(fotoBase64 || citaAConfirmar.tiene_foto_pedido) ? 'Reemplazar fotografía del pedido' : 'Seleccionar fotografía del pedido'}
                  className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                    isDraggingFoto ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragEnter={e => { e.preventDefault(); setIsDraggingFoto(true); }}
                  onDragOver={e => { e.preventDefault(); setIsDraggingFoto(true); }}
                  onDragLeave={e => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDraggingFoto(false);
                  }}
                  onDrop={handleDropFoto}
                >
                  {isUploadingFoto ? (
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                      <Loader2 className="size-5 animate-spin" />
                      <span className="text-sm">Procesando imagen...</span>
                    </div>
                  ) : fotoBase64 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-center gap-2 text-blue-700">
                        <Image className="size-5" />
                        <span className="max-w-full truncate text-sm font-medium">{fotoNombre}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {isDraggingFoto ? 'Suelta la imagen para reemplazarla' : 'Nueva fotografía seleccionada · haz clic o arrastra otra para cambiarla'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-gray-500">
                      <Image className="size-8 mx-auto opacity-40" />
                      <p className="text-sm">
                        {isDraggingFoto
                          ? 'Suelta la imagen para cargarla'
                          : citaAConfirmar.tiene_foto_pedido
                            ? 'Haz clic o arrastra una nueva fotografía para reemplazar la registrada'
                            : 'Haz clic o arrastra aquí la fotografía del pedido'}
                      </p>
                      <p className="text-xs">JPG, PNG, WEBP — máximo 5 MB</p>
                    </div>
                  )}
                </div>
                {fotoBase64 && (
                  <button
                    type="button"
                    className="text-xs text-gray-600 underline underline-offset-2 hover:text-gray-900"
                    onClick={() => { setFotoBase64(''); setFotoNombre(''); }}
                  >
                    {citaAConfirmar.tiene_foto_pedido
                      ? 'Descartar reemplazo y conservar la fotografía registrada'
                      : 'Quitar fotografía seleccionada'}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSeleccionarFoto}
                />
              </div>

              {/* Aviso */}
              {!puedeConfirmar && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
                  <span>Completa los campos obligatorios para confirmar. Sin esos datos la cita permanecerá en estado <strong>Agendada</strong>.</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setCitaAConfirmar(null)}>Cancelar</Button>
            <Button
              onClick={handleConfirmar}
              disabled={!puedeConfirmar || isConfirmando}
              className="gap-1.5"
            >
              {isConfirmando && <Loader2 className="size-4 animate-spin" />}
              <CheckCircle className="size-4" />
              Confirmar cita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog cancelación */}
      <AlertDialog open={!!citaACancelar} onOpenChange={open => !open && setCitaACancelar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
            <AlertDialogDescription>
              Se cancelará la cita de{' '}
              <strong>{citaACancelar?.paciente?.nombres} {citaACancelar?.paciente?.apellidos}</strong>{' '}
              para <strong>{citaACancelar?.servicio?.descripcion}</strong>{' '}
              el {citaACancelar?.fecha_cita} a las {citaACancelar?.hora_inicio?.slice(0, 5)}.
              Esta acción libera el cupo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleCancelarConfirmar}>
              Cancelar cita
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog visor de foto del pedido */}
      <Dialog open={!!citaFoto} onOpenChange={open => { if (!open) { setCitaFoto(null); setFotoVisualizando(null); } }}>
        <DialogContent
          className="flex flex-col gap-0 overflow-hidden p-0"
          style={{
            top: '1rem',
            right: '1rem',
            bottom: '1rem',
            left: '1rem',
            width: 'auto',
            height: 'auto',
            maxWidth: '48rem',
            maxHeight: 'none',
            margin: '0 auto',
            translate: 'none',
          }}
        >
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
            <DialogTitle className="flex items-center gap-2">
              <Image className="size-4 text-indigo-600" />
              Fotografía del pedido
            </DialogTitle>
            <DialogDescription>
              Visualiza la fotografía registrada para esta cita de servicio.
            </DialogDescription>
          </DialogHeader>
          {citaFoto && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-4">
              <div className="grid shrink-0 grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-xs text-gray-500">Paciente</div>
                  <div className="font-medium">{citaFoto.paciente?.nombres} {citaFoto.paciente?.apellidos}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Servicio</div>
                  <div className="font-medium">{citaFoto.servicio?.descripcion}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Médico solicitante</div>
                  <div className="font-medium">{citaFoto.medico_solicitante}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">N.º de registro</div>
                  <div className="font-medium">{citaFoto.numero_registro_medico || '—'}</div>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border bg-gray-50 p-2">
                {isLoadingFoto ? (
                  <div className="flex flex-col items-center gap-2 text-blue-600">
                    <Loader2 className="size-8 animate-spin" />
                    <span className="text-sm">Cargando fotografía...</span>
                  </div>
                ) : fotoVisualizando ? (
                  <img
                    src={fotoVisualizando}
                    alt="Pedido médico"
                    className="h-full max-h-full w-full object-contain rounded"
                    onError={() => {
                      setFotoVisualizando(null);
                      toast.error('La fotografía guardada no se puede visualizar. Revisa el formato de la imagen.');
                    }}
                  />
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <Image className="size-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No hay fotografía registrada</p>
                  </div>
                )}
              </div>
              {fotoVisualizando && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={handleDescargarFoto}
                    className="text-xs text-indigo-600 underline hover:text-indigo-800"
                  >
                    Descargar imagen
                  </button>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="shrink-0 border-t bg-gray-50 px-6 py-4">
            <Button variant="outline" onClick={() => { setCitaFoto(null); setFotoVisualizando(null); }}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal editar cita */}
      <AgendarCitaServicioModal
        isOpen={isModalAgendarOpen}
        onClose={() => { setIsModalAgendarOpen(false); setCitaParaEditar(null); }}
        onCitaAgendada={() => {}}
        onCrearCita={crearCita}
        onActualizarCita={actualizarCita}
        citaEditar={citaParaEditar}
        currentUserName={currentUser?.name}
        onSolicitarCancelacion={() => {
          const cita = citaParaEditar;
          setIsModalAgendarOpen(false);
          setCitaParaEditar(null);
          if (cita) setCitaACancelar(cita);
        }}
      />

      {/* Modal finalizar / reemplazar PDF */}
      {citaParaFinalizar && (
        <FinalizarCitaServicioModal
          isOpen={modalFinalizarOpen}
          onClose={() => setModalFinalizarOpen(false)}
          onSuccess={() => { setModalFinalizarOpen(false); loadCitas(); }}
          cita={citaParaFinalizar}
          mode={modalFinalizarMode}
        />
      )}
    </div>
  );
}
