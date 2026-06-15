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
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCitasServicio } from '../hooks/useCitasServicio';
import { useSucursales, useServicios } from '../hooks/useConfiguraciones';
import { AgendarCitaServicioModal } from './AgendarCitaServicioModal';
import { getFotoPedido, generarUrlFirmadaPdf } from '../lib/citaServicioService';
import type { CitaServicioCompleta } from '../lib/configuracionesService';
import { FinalizarCitaServicioModal } from './FinalizarCitaServicioModal';

interface DashboardServiciosViewProps {
  currentUser: {
    name: string;
    tipo_usuario?: string;
    sucursal?: string;
  } | null;
}

// ─── Utilidades de fecha ──────────────────────────────────────────────────────
function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function fechaMas(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return toISO(d);
}

// ─── Configuración de estados ─────────────────────────────────────────────────
const ORDEN_ESTADO = ['agendada', 'confirmada', 'en_atencion', 'atendida', 'finalizado', 'cancelada', 'no_asistio'];

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

const MIME_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;

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
  const [desde, setDesde] = useState(toISO(new Date()));
  const [hasta, setHasta] = useState(fechaMas(30));

  const idSucursalNum = filtroSucursal !== 'todas' ? parseInt(filtroSucursal) : undefined;
  const idServicioNum = filtroServicio !== 'todos'  ? parseInt(filtroServicio) : undefined;

  const { servicios } = useServicios(idSucursalNum);
  const serviciosActivos = servicios.filter(
    s => s.estado === 'activo' && s.descripcion.toUpperCase() !== 'CONSULTA EXTERNA'
  );

  // ─── Citas ───────────────────────────────────────────────────────────────
  const { citas, isLoading, loadCitas, crearCita, actualizarCita, cancelarCita, confirmarCita } = useCitasServicio({
    fechaDesde: desde,
    fechaHasta: hasta,
    idSucursal: idSucursalNum,
    idServicio: idServicioNum,
  });

  const citasOrdenadas = useMemo(() =>
    [...citas].sort((a, b) =>
      ORDEN_ESTADO.indexOf(a.estado_cita) - ORDEN_ESTADO.indexOf(b.estado_cita) ||
      a.fecha_cita.localeCompare(b.fecha_cita) ||
      (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? '')
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
    setCitaParaEditar(cita);
    setIsModalAgendarOpen(true);
  };

  // ─── Cancelación ─────────────────────────────────────────────────────────
  const [citaACancelar, setCitaACancelar] = useState<CitaServicioCompleta | null>(null);

  const handleCancelarConfirmar = async () => {
    if (!citaACancelar) return;
    const ok = await cancelarCita(citaACancelar.id_cita_servicio);
    if (ok) { toast.success('Cita cancelada'); setCitaACancelar(null); }
    else toast.error('Error al cancelar la cita');
  };

  // ─── Confirmación ─────────────────────────────────────────────────────────
  const [citaAConfirmar, setCitaAConfirmar]       = useState<CitaServicioCompleta | null>(null);
  const [medicoSolicitante, setMedicoSolicitante] = useState('');
  const [numRegistro, setNumRegistro]             = useState('');
  const [tieneSeguroMedico, setTieneSeguroMedico] = useState('');
  const [fotoBase64, setFotoBase64]               = useState('');
  const [fotoNombre, setFotoNombre]               = useState('');
  const [isUploadingFoto, setIsUploadingFoto]     = useState(false);
  const [isConfirmando, setIsConfirmando]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const abrirConfirmacion = (cita: CitaServicioCompleta) => {
    setCitaAConfirmar(cita);
    setMedicoSolicitante('');
    setNumRegistro('');
    setTieneSeguroMedico('');
    setFotoBase64('');
    setFotoNombre('');
  };

  const handleSeleccionarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  const handleConfirmar = async () => {
    if (!citaAConfirmar || !puedeConfirmar) return;
    setIsConfirmando(true);
    try {
      const ok = await confirmarCita(citaAConfirmar.id_cita_servicio, {
        medico_solicitante:     medicoSolicitante.toUpperCase(),
        numero_registro_medico: numRegistro,
        tiene_seguro_medico:    tieneSeguroMedico.trim(),
        foto_pedido_base64:     fotoBase64,
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
    tieneSeguroMedico.trim() !== '' &&
    fotoBase64 !== '';

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

  const puedeFinalizarCitas = ['GESTOR_IMAGEN', 'ADMINISTRADOR'].includes(currentUser?.tipo_usuario || '');

  const abrirModalFinalizar = (cita: CitaServicioCompleta, mode: 'finalizar' | 'reemplazar') => {
    setCitaParaFinalizar(cita);
    setModalFinalizarMode(mode);
    setModalFinalizarOpen(true);
  };

  const abrirPdf = async (storagePath: string) => {
    const url = await generarUrlFirmadaPdf(storagePath);
    if (url) window.open(url, '_blank');
    else toast.error('No se pudo generar el enlace del PDF');
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
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="size-4 mr-1" /> Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
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
                    <TableHead>N° Registro</TableHead>
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
                          <div className="flex items-center gap-1 text-sm">
                            <User className="size-3 text-gray-400 flex-shrink-0" />
                            <span>{cita.paciente?.nombres} {cita.paciente?.apellidos}</span>
                          </div>
                          <div className="text-xs text-gray-500 ml-4">{cita.paciente?.cedula}</div>
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

                        {/* N° Registro */}
                        <TableCell>
                          {cita.numero_registro_medico ? (
                            <span className="text-sm font-mono">{cita.numero_registro_medico}</span>
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
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                            {/* "Ver foto" ya está en la columna Foto pedido */}
                            {cita.estado_cita === 'agendada' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-blue-600 border-blue-300 hover:bg-blue-50 text-xs"
                                onClick={() => abrirConfirmacion(cita)}
                              >
                                <CheckCircle className="size-3" /> Confirmar
                              </Button>
                            )}
                            {accionable && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1 text-xs"
                                  onClick={() => handleEditar(cita)}
                                >
                                  <Pencil className="size-3" /> Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1 text-xs text-red-600 hover:bg-red-50"
                                  onClick={() => setCitaACancelar(cita)}
                                >
                                  <XCircle className="size-3" /> Cancelar
                                </Button>
                              </>
                            )}
                            {puedeFinalizarCitas && !['cancelada', 'no_asistio', 'finalizado'].includes(cita.estado_cita) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs"
                                onClick={() => abrirModalFinalizar(cita, 'finalizar')}
                              >
                                <FileText className="size-3" /> Finalizar
                              </Button>
                            )}
                            {cita.estado_cita === 'finalizado' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs"
                                  onClick={() => abrirPdf(cita.url_pdf_resultado!)}
                                >
                                  <Eye className="size-3" /> Ver PDF
                                </Button>
                                {puedeFinalizarCitas && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="gap-1 text-xs"
                                    onClick={() => abrirModalFinalizar(cita, 'reemplazar')}
                                  >
                                    <FileText className="size-3" /> Reemplazar
                                  </Button>
                                )}
                              </>
                            )}
                            {!accionable && cita.estado_cita !== 'finalizado' && (
                              <span className="text-xs text-gray-400 italic pr-2">{cfg.label}</span>
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
      <Dialog open={!!citaAConfirmar} onOpenChange={open => !open && setCitaAConfirmar(null)}>
        <DialogContent className="top-4 bottom-4 translate-y-0 max-h-none max-w-md overflow-y-auto p-6">
          <DialogHeader className="pr-8">
            <DialogTitle>Confirmar cita</DialogTitle>
            <DialogDescription>
              Registra el médico solicitante, número de registro, seguro médico y fotografía del pedido para confirmar la cita.
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
                <Label>Fotografía del pedido *</Label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingFoto ? (
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                      <Loader2 className="size-5 animate-spin" />
                      <span className="text-sm">Procesando imagen...</span>
                    </div>
                  ) : fotoNombre ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-center gap-2 text-blue-700">
                        <Image className="size-5" />
                        <span className="max-w-full truncate text-sm font-medium">{fotoNombre}</span>
                      </div>
                      <p className="text-xs text-gray-500">Haz clic para cambiar el archivo</p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-gray-500">
                      <Image className="size-8 mx-auto opacity-40" />
                      <p className="text-sm">Haz clic para seleccionar la fotografía del pedido</p>
                      <p className="text-xs">JPG, PNG, WEBP — máximo 5 MB</p>
                    </div>
                  )}
                </div>
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
                  <span>Completa todos los campos obligatorios y carga la fotografía del pedido para confirmar. Sin esos datos la cita permanecerá en estado <strong>Agendada</strong>.</span>
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="size-4 text-indigo-600" />
              Fotografía del pedido
            </DialogTitle>
            <DialogDescription>
              Visualiza la fotografía registrada para esta cita de servicio.
            </DialogDescription>
          </DialogHeader>
          {citaFoto && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm grid grid-cols-2 gap-2">
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
              <div className="flex items-center justify-center min-h-[200px] bg-gray-50 border rounded-lg">
                {isLoadingFoto ? (
                  <div className="flex flex-col items-center gap-2 text-blue-600">
                    <Loader2 className="size-8 animate-spin" />
                    <span className="text-sm">Cargando fotografía...</span>
                  </div>
                ) : fotoVisualizando ? (
                  <img
                    src={fotoVisualizando}
                    alt="Pedido médico"
                    className="max-h-[55vh] max-w-full object-contain rounded"
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
          <DialogFooter>
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
