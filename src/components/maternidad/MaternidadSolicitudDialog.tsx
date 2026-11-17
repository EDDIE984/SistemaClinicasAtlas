// Detalle de una solicitud de maternidad: datos, estado, parto, cotizaciones, correos e historial
import { useEffect, useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Loader2, Send, CalendarCheck, FileText, Mail, Printer, RotateCcw, Receipt, X, Pencil, Search,
  History, Baby, RefreshCw, UserPlus, Calendar, Flag, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAseguradorasMaternidad } from '../../hooks/useMaternidad';
import {
  consultarNombreRegistroCivil,
  formatearTipoParto,
  enviarCotizacionMaternidad,
  getCotizacionesBySolicitud,
  getEnviosCorreoBySolicitud,
  getHistorialBySolicitud,
  getSolicitudVistaMaternidad,
  generarPdfCotizacionMaternidad,
  mensajeErrorMaternidad,
  updateDatosSolicitudMaternidad,
} from '../../lib/maternidadService';
import type {
  MaternidadCotizacion,
  MaternidadEnvioCorreo,
  MaternidadHistorial,
  MaternidadSolicitud,
  MaternidadSolicitudVista,
} from '../../lib/supabaseTypes';
import {
  ESTADO_BADGE_MATERNIDAD,
  PARTO_BADGE_MATERNIDAD,
  formatFechaCorta,
  formatFechaHora,
  formatFechaLarga,
  formatHorario,
  formatearUSD,
  SEGUIMIENTO_TOUR,
  enAlerta,
  formatSemanas,
  semanasHoy,
  seguroDe,
  ESTADO_CORREO_MATERNIDAD,
} from './maternidadUtils';
import { MaternidadEstadoDialog } from './MaternidadEstadoDialog';
import { MaternidadPartoDialog } from './MaternidadPartoDialog';

interface MaternidadSolicitudDialogProps {
  solicitud: MaternidadSolicitudVista | null;
  onOpenChange: (open: boolean) => void;
  usuarioNombre: string;
  onAgendarTour: (solicitud: MaternidadSolicitudVista) => void;
  onActualizado: () => void;
}

const ETIQUETA_ADJUNTO: Record<string, string> = {
  presupuesto: 'Presupuesto',
  checklist: 'Checklist',
  boletin: 'Boletín',
};

const ICONO_HISTORIAL: Record<MaternidadHistorial['tipo'], typeof History> = {
  registro: UserPlus,
  estado: Flag,
  tour: Calendar,
  parto: Baby,
  datos: Pencil,
  cotizacion: Receipt,
  correo: Mail,
};

// Campos guardados desde la ficha (de la tabla, sin las columnas calculadas de la vista)
const camposGuardados = (s: MaternidadSolicitud): Partial<MaternidadSolicitudVista> => ({
  nombre_madre: s.nombre_madre,
  cedula: s.cedula,
  correo: s.correo,
  semanas_gestacion: s.semanas_gestacion,
  medico_ginecologo: s.medico_ginecologo,
  id_aseguradora_mat: s.id_aseguradora_mat,
  notas: s.notas,
  estado: s.estado,
  motivo_estado: s.motivo_estado,
  resultado_parto: s.resultado_parto,
  fecha_parto: s.fecha_parto,
  tipo_parto: s.tipo_parto,
  observacion_parto: s.observacion_parto,
  actualizado_por: s.actualizado_por,
  updated_at: s.updated_at,
  numero_bitacora: s.numero_bitacora,
  asesor: s.asesor,
  hora_inicio_real: s.hora_inicio_real,
  hora_fin_real: s.hora_fin_real,
  firma_paciente: s.firma_paciente,
});

const formEdicionVacio = {
  nombre_madre: '',
  cedula: '',
  correo: '',
  semanas_gestacion: '',
  medico_ginecologo: '',
  id_aseguradora_mat: '',
  notas: '',
  // Tour realizado (bitácora)
  asesor: '',
  hora_inicio_real: '',
  hora_fin_real: '',
  firma_paciente: '',
};

const textoFirma = (firma: boolean | null | undefined) => (firma === true ? 'Sí' : firma === false ? 'No' : null);

export function MaternidadSolicitudDialog({
  solicitud: solicitudProp,
  onOpenChange,
  usuarioNombre,
  onAgendarTour,
  onActualizado,
}: MaternidadSolicitudDialogProps) {
  const { aseguradoras } = useAseguradorasMaternidad(true);
  const [envios, setEnvios] = useState<MaternidadEnvioCorreo[]>([]);
  const [cotizaciones, setCotizaciones] = useState<MaternidadCotizacion[]>([]);
  const [reenviandoId, setReenviandoId] = useState<number | null>(null);
  const [imprimiendoId, setImprimiendoId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnviando, setIsEnviando] = useState(false);
  const [historial, setHistorial] = useState<MaternidadHistorial[]>([]);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [registrandoParto, setRegistrandoParto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(formEdicionVacio);
  const [isGuardando, setIsGuardando] = useState(false);
  const [isConsultandoRC, setIsConsultandoRC] = useState(false);
  // Datos guardados en esta sesión del diálogo: el padre recarga su lista, pero la solicitud abierta es la copia anterior
  const [editados, setEditados] = useState<{ id: number; datos: Partial<MaternidadSolicitudVista> } | null>(null);

  const idSolicitud = solicitudProp?.id_solicitud_mat;
  const solicitud = solicitudProp && editados?.id === solicitudProp.id_solicitud_mat
    ? { ...solicitudProp, ...editados.datos }
    : solicitudProp;

  const cargarDetalle = useCallback(async () => {
    if (!idSolicitud) return;
    setIsLoading(true);
    try {
      const [correos, cots, eventos] = await Promise.all([
        getEnviosCorreoBySolicitud(idSolicitud),
        getCotizacionesBySolicitud(idSolicitud),
        getHistorialBySolicitud(idSolicitud),
      ]);
      setEnvios(correos);
      setCotizaciones(cots);
      setHistorial(eventos);
    } catch {
      toast.error('Error al cargar el detalle de la solicitud');
    } finally {
      setIsLoading(false);
    }
  }, [idSolicitud]);

  useEffect(() => {
    if (!solicitudProp) setEditados(null);
    setEditando(false);
  }, [solicitudProp]);

  useEffect(() => {
    cargarDetalle();
  }, [cargarDetalle]);

  if (!solicitud) return null;

  // Guarda en la copia local lo que se cambió (estado, parto, datos) y recarga el historial
  const aplicarCambios = async (guardada: MaternidadSolicitud, extra: Partial<MaternidadSolicitudVista> = {}) => {
    setEditados(prev => ({
      id: guardada.id_solicitud_mat,
      datos: { ...(prev?.id === guardada.id_solicitud_mat ? prev.datos : {}), ...camposGuardados(guardada), ...extra },
    }));
    onActualizado();
    cargarDetalle();
    // La vista recalcula semanas actuales, fecha probable de parto y estado de seguimiento
    try {
      const vista = await getSolicitudVistaMaternidad(guardada.id_solicitud_mat);
      if (vista) setEditados({ id: vista.id_solicitud_mat, datos: vista });
    } catch {
      // Se mantiene la copia local con lo guardado
    }
  };

  // Aseguradoras activas de maternidad_aseguradora; la actual se agrega si está inactiva para no dejarla en blanco
  const opcionesAseguradora = solicitud.id_aseguradora_mat && !aseguradoras.some(a => a.id_aseguradora_mat === solicitud.id_aseguradora_mat)
    ? [...aseguradoras, { id_aseguradora_mat: solicitud.id_aseguradora_mat, nombre: `${solicitud.aseguradora || 'Aseguradora actual'} (inactiva)` }]
    : aseguradoras;

  const setCampo = (campo: keyof typeof formEdicionVacio, valor: string) => setForm(prev => ({ ...prev, [campo]: valor }));

  const handleEditar = () => {
    setForm({
      nombre_madre: solicitud.nombre_madre,
      cedula: solicitud.cedula || '',
      correo: solicitud.correo || '',
      semanas_gestacion: solicitud.semanas_gestacion?.toString() || '',
      medico_ginecologo: solicitud.medico_ginecologo || '',
      id_aseguradora_mat: solicitud.id_aseguradora_mat?.toString() || '',
      notas: solicitud.notas || '',
      asesor: solicitud.asesor || '',
      hora_inicio_real: solicitud.hora_inicio_real?.slice(0, 5) || '',
      hora_fin_real: solicitud.hora_fin_real?.slice(0, 5) || '',
      firma_paciente: solicitud.firma_paciente === true ? 'si' : solicitud.firma_paciente === false ? 'no' : '',
    });
    setEditando(true);
  };

  const handleConsultarRegistroCivil = async () => {
    const cedula = form.cedula.replace(/\s/g, '');
    if (!/^\d{10}$/.test(cedula)) {
      toast.warning('La cédula debe tener 10 dígitos para consultar los datos');
      return;
    }
    setIsConsultandoRC(true);
    try {
      const nombre = await consultarNombreRegistroCivil(cedula);
      if (nombre) {
        setCampo('nombre_madre', nombre);
        toast.success('Datos cargados');
      } else {
        toast.info('Error al traer los datos, complételos manualmente');
      }
    } catch {
      toast.error('Error al traer los datos, complételos manualmente');
    } finally {
      setIsConsultandoRC(false);
    }
  };

  const handleGuardarDatos = async () => {
    const cedula = form.cedula.replace(/\s/g, '');
    const correo = form.correo.trim();
    // La bitácora histórica (Excel) no tiene cédula, correo ni siempre aseguradora: ahí son opcionales
    if (!form.nombre_madre.trim()) return toast.error('Ingrese el nombre de la mamá');
    if ((cedula || !esBitacora) && !/^\d{10}$/.test(cedula) && !/^[A-Za-z0-9]{5,20}$/.test(cedula)) {
      return toast.error('Ingrese una cédula o pasaporte válido');
    }
    if ((correo || !esBitacora) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return toast.error('Ingrese un correo válido');
    if (!form.id_aseguradora_mat && !esBitacora) return toast.error('Seleccione la aseguradora');
    if (tourRealizado && !form.asesor.trim()) return toast.error('Indique el asesor que dio el tour');
    if (tourRealizado && form.hora_inicio_real && form.hora_fin_real && form.hora_fin_real <= form.hora_inicio_real) {
      return toast.error('La hora de fin debe ser posterior a la de inicio');
    }
    const semanas = form.semanas_gestacion.trim() ? Number(form.semanas_gestacion) : null;
    if (semanas !== null && (!Number.isInteger(semanas) || semanas < 1 || semanas > 45)) {
      return toast.error('Las semanas de gestación deben ser un número entero entre 1 y 45');
    }

    setIsGuardando(true);
    try {
      const idAseguradora = form.id_aseguradora_mat ? parseInt(form.id_aseguradora_mat) : null;
      const guardada = await updateDatosSolicitudMaternidad(solicitud.id_solicitud_mat, {
        nombre_madre: form.nombre_madre,
        cedula: cedula || null,
        correo: correo || null,
        semanas_gestacion: semanas,
        medico_ginecologo: form.medico_ginecologo || null,
        id_aseguradora_mat: idAseguradora,
        notas: form.notas || null,
        tour: tourRealizado ? {
          asesor: form.asesor,
          hora_inicio_real: form.hora_inicio_real || null,
          hora_fin_real: form.hora_fin_real || null,
          firma_paciente: form.firma_paciente === 'si' ? true : form.firma_paciente === 'no' ? false : null,
        } : null,
      }, usuarioNombre);
      aplicarCambios(guardada, {
        aseguradora: idAseguradora
          ? aseguradoras.find(a => a.id_aseguradora_mat === idAseguradora)?.nombre ?? solicitud.aseguradora
          : null,
      });
      setEditando(false);
      toast.success('Datos actualizados');
    } catch (error) {
      toast.error(`No se pudieron guardar los datos: ${mensajeErrorMaternidad(error)}`);
    } finally {
      setIsGuardando(false);
    }
  };

  const tieneTour = !!solicitud.fecha_tour && solicitud.estado !== 'solo_cotizacion';
  const esBitacora = solicitud.origen === 'BITACORA';
  const tourRealizado = solicitud.estado === 'asistio';

  // Reenvía la última cotización (mismo número). Si aún no hay ninguna, o si la aseguradora cambió
  // (sus valores quedaron fijos en la cotización emitida), emite una nueva con la aseguradora actual.
  const ultimaCotizacion = cotizaciones[0] || null;
  const cambioAseguradora = !!ultimaCotizacion && ultimaCotizacion.id_aseguradora_mat !== solicitud.id_aseguradora_mat;
  const reenviaMisma = !!ultimaCotizacion && !cambioAseguradora;
  const handleReenviar = async () => {
    setIsEnviando(true);
    try {
      const envio = reenviaMisma
        ? await enviarCotizacionMaternidad(solicitud.id_solicitud_mat, usuarioNombre, ultimaCotizacion.tipo, ultimaCotizacion.id_cotizacion_mat)
        : await enviarCotizacionMaternidad(solicitud.id_solicitud_mat, usuarioNombre, tieneTour ? 'confirmacion_tour' : 'cotizacion');
      toast.success(`Cotización ${envio.numero_cotizacion || ''} ${reenviaMisma ? 'reenviada' : 'enviada'} a ${solicitud.correo}`);
      onActualizado();
    } catch (error) {
      toast.error(`No se pudo enviar el correo: ${mensajeErrorMaternidad(error)}`);
    } finally {
      setIsEnviando(false);
      cargarDetalle();
    }
  };

  // Reenvía una cotización ya emitida: mismos PDF, mismo número
  const handleReenviarExistente = async (cotizacion: MaternidadCotizacion) => {
    setReenviandoId(cotizacion.id_cotizacion_mat);
    try {
      await enviarCotizacionMaternidad(solicitud.id_solicitud_mat, usuarioNombre, cotizacion.tipo, cotizacion.id_cotizacion_mat);
      toast.success(`Cotización ${cotizacion.numero_cotizacion} reenviada a ${solicitud.correo}`);
      onActualizado();
    } catch (error) {
      toast.error(`No se pudo reenviar: ${mensajeErrorMaternidad(error)}`);
    } finally {
      setReenviandoId(null);
      cargarDetalle();
    }
  };

  const numeroDeCotizacion = (id: number | null) =>
    cotizaciones.find(c => c.id_cotizacion_mat === id)?.numero_cotizacion || '—';

  // El presupuesto no se guarda: se vuelve a armar con el número, la fecha y los valores de la cotización
  const handleImprimir = async (cotizacion: MaternidadCotizacion) => {
    if (!solicitud) return;
    setImprimiendoId(cotizacion.id_cotizacion_mat);
    try {
      window.open(await generarPdfCotizacionMaternidad(solicitud, cotizacion), '_blank', 'noopener');
    } catch {
      toast.error('No se pudo generar el presupuesto');
    } finally {
      setImprimiendoId(null);
    }
  };

  const dato = (etiqueta: string, valor?: string | number | null) => (
    <div className="min-w-0">
      <Label className="text-xs text-gray-500">{etiqueta}</Label>
      <p className="text-sm font-medium break-words">{valor ?? '—'}</p>
    </div>
  );

  return (
    <Dialog open={!!solicitud} onOpenChange={onOpenChange}>
      <DialogContent className="maternidad-dialog-ancho">
        <Tabs defaultValue="datos">
          {/* Nombre y pestañas quedan fijos arriba al desplazar tablas largas */}
          <div className="maternidad-dialog-cabecera">
            <DialogClose className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100" aria-label="Cerrar">
              <X className="size-4" />
            </DialogClose>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {solicitud.nombre_madre}
                <Badge variant="outline" className={ESTADO_BADGE_MATERNIDAD[solicitud.estado].className}>
                  {ESTADO_BADGE_MATERNIDAD[solicitud.estado].label}
                </Badge>
                {solicitud.resultado_parto && solicitud.resultado_parto !== 'pendiente' && (
                  <Badge variant="outline" className={PARTO_BADGE_MATERNIDAD[solicitud.resultado_parto].className}>
                    <Baby className="size-3 mr-1" />{PARTO_BADGE_MATERNIDAD[solicitud.resultado_parto].label}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {esBitacora
                  ? <>Bitácora #{solicitud.numero_bitacora} · tour del {formatFechaCorta(solicitud.fecha_tour)} · cargado desde la bitácora histórica (Excel)</>
                  : <>Solicitud #{solicitud.id_solicitud_mat} · registrada el {formatFechaHora(solicitud.created_at)} · origen {solicitud.origen === 'CHATBOT' ? 'WhatsApp' : 'Sistema'}</>}
              </DialogDescription>
            </DialogHeader>
            <TabsList>
              <TabsTrigger value="datos"><FileText className="size-4 mr-1" />Datos</TabsTrigger>
              <TabsTrigger value="cotizaciones"><Receipt className="size-4 mr-1" />Cotizaciones ({cotizaciones.length})</TabsTrigger>
              <TabsTrigger value="correos"><Mail className="size-4 mr-1" />Correos ({envios.length})</TabsTrigger>
              <TabsTrigger value="historial"><History className="size-4 mr-1" />Historial ({historial.length})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="datos" className="space-y-4 pt-2">
            {editando ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Nombre de la mamá *</Label>
                    <div className="flex gap-2">
                      <Input value={form.nombre_madre} maxLength={200} onChange={e => setCampo('nombre_madre', e.target.value)} />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleConsultarRegistroCivil}
                        disabled={isConsultandoRC}
                        title="Consultar los datos con la cédula"
                      >
                        {isConsultandoRC ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Search className="size-4 mr-1" />}
                        Consultar
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cédula {esBitacora ? '' : '*'}</Label>
                    <Input value={form.cedula} maxLength={20} onChange={e => setCampo('cedula', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Semanas de gestación</Label>
                    <Input type="number" min="1" max="45" value={form.semanas_gestacion} onChange={e => setCampo('semanas_gestacion', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Aseguradora {esBitacora ? '' : '*'}</Label>
                    {esBitacora && solicitud.seguro_texto && !form.id_aseguradora_mat && (
                      <p className="text-xs text-gray-500">En la bitácora: {solicitud.seguro_texto}</p>
                    )}
                    <Select value={form.id_aseguradora_mat} onValueChange={v => setCampo('id_aseguradora_mat', v)}>
                      <SelectTrigger><SelectValue placeholder="Seleccione la aseguradora" /></SelectTrigger>
                      <SelectContent>
                        {opcionesAseguradora.map(a => (
                          <SelectItem key={a.id_aseguradora_mat} value={a.id_aseguradora_mat.toString()}>{a.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Correo {esBitacora ? '' : '*'}</Label>
                    <Input type="email" value={form.correo} maxLength={200} onChange={e => setCampo('correo', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Médico ginecólogo</Label>
                    <Input value={form.medico_ginecologo} maxLength={200} onChange={e => setCampo('medico_ginecologo', e.target.value)} />
                  </div>
                  {dato('Teléfono', solicitud.telefono)}
                  {dato('Fecha del tour', solicitud.fecha_tour ? formatFechaLarga(solicitud.fecha_tour) : 'Sin tour agendado')}
                  {dato('Turno', formatHorario(solicitud.hora_inicio, solicitud.hora_fin))}
                  {dato('Registrado por', solicitud.creado_por || (solicitud.origen === 'CHATBOT' ? 'Chatbot' : null))}
                </div>
                {tourRealizado && (
                  <div className="space-y-3 rounded-lg border p-3">
                    <p className="text-sm font-medium">Tour realizado (bitácora #{solicitud.numero_bitacora ?? '—'})</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Asesor *</Label>
                        <Input value={form.asesor} maxLength={100} onChange={e => setCampo('asesor', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hora de inicio</Label>
                        <Input type="time" value={form.hora_inicio_real} onChange={e => setCampo('hora_inicio_real', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hora de fin</Label>
                        <Input type="time" value={form.hora_fin_real} onChange={e => setCampo('hora_fin_real', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">¿Firmó?</Label>
                        <Select value={form.firma_paciente || 'sin_dato'} onValueChange={v => setCampo('firma_paciente', v === 'sin_dato' ? '' : v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="si">Sí</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="sin_dato">Sin dato</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Observaciones</Label>
                  <Textarea rows={2} value={form.notas} onChange={e => setCampo('notas', e.target.value)} />
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={() => setEditando(false)} disabled={isGuardando}>Cancelar</Button>
                  <Button onClick={handleGuardarDatos} disabled={isGuardando}>
                    {isGuardando && <Loader2 className="size-4 mr-2 animate-spin" />}
                    Guardar
                  </Button>
                </div>
              </div>
            ) : (
            <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {dato('Cédula', solicitud.cedula)}
              {dato(
                'Semanas de gestación',
                solicitud.semanas_gestacion
                  ? `${solicitud.semanas_gestacion}${solicitud.fecha_semanas ? ` (al ${formatFechaCorta(solicitud.fecha_semanas)})` : ''}`
                  : null,
              )}
              <div className="min-w-0">
                <Label className="text-xs text-gray-500">Semanas actuales</Label>
                <p className={`text-sm font-medium ${enAlerta(solicitud.estado_seguimiento) ? 'text-red-700' : ''}`}>
                  {formatSemanas(semanasHoy(solicitud))}
                  {solicitud.fecha_probable_parto && <span className="text-xs font-normal text-gray-500"> · FPP {formatFechaCorta(solicitud.fecha_probable_parto)}</span>}
                </p>
                {solicitud.estado_seguimiento && solicitud.estado_seguimiento !== 'sin_semanas' && (
                  <Badge variant="outline" className={`mt-1 ${SEGUIMIENTO_TOUR[solicitud.estado_seguimiento].className}`}>
                    {SEGUIMIENTO_TOUR[solicitud.estado_seguimiento].label}
                  </Badge>
                )}
              </div>
              {dato('Aseguradora', seguroDe(solicitud) || null)}
              {dato('Correo', solicitud.correo)}
              {dato('Teléfono', solicitud.telefono)}
              {dato('Médico ginecólogo', solicitud.medico_ginecologo)}
              {dato('Fecha del tour', solicitud.fecha_tour ? formatFechaLarga(solicitud.fecha_tour) : 'Sin tour agendado')}
              {dato('Turno', formatHorario(solicitud.hora_inicio, solicitud.hora_fin))}
              {dato('Registrado por', solicitud.creado_por || (solicitud.origen === 'CHATBOT' ? 'Chatbot' : null))}
            </div>
            {solicitud.notas && dato('Observaciones', solicitud.notas)}

            {tourRealizado && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-lg border bg-gray-50 p-3">
                {dato('N.º bitácora', solicitud.numero_bitacora ? `#${solicitud.numero_bitacora}` : null)}
                {dato('Asesor', solicitud.asesor)}
                {dato('Hora real del tour', solicitud.hora_inicio_real ? formatHorario(solicitud.hora_inicio_real, solicitud.hora_fin_real) : null)}
                {dato('Firmó', textoFirma(solicitud.firma_paciente))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-4">
              {/* Estado del tour: se cambia en un diálogo con confirmación y motivo */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-gray-500">Estado del tour</Label>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setCambiandoEstado(true)}>
                    <RefreshCw className="size-3 mr-1" />Cambiar estado
                  </Button>
                </div>
                <Badge variant="outline" className={ESTADO_BADGE_MATERNIDAD[solicitud.estado].className}>
                  {ESTADO_BADGE_MATERNIDAD[solicitud.estado].label}
                </Badge>
                {solicitud.motivo_estado && <p className="text-xs text-gray-600">Motivo: {solicitud.motivo_estado}</p>}
                <p className="text-xs text-gray-500">
                  Actualizado el {formatFechaHora(solicitud.updated_at)}{solicitud.actualizado_por ? ` por ${solicitud.actualizado_por}` : ''}
                </p>
              </div>

              {/* Seguimiento del parto (independiente del tour) */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-gray-500">Parto</Label>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setRegistrandoParto(true)}>
                    <Baby className="size-3 mr-1" />
                    {solicitud.resultado_parto && solicitud.resultado_parto !== 'pendiente' ? 'Editar parto' : 'Registrar parto'}
                  </Button>
                </div>
                <Badge variant="outline" className={PARTO_BADGE_MATERNIDAD[solicitud.resultado_parto || 'pendiente'].className}>
                  {PARTO_BADGE_MATERNIDAD[solicitud.resultado_parto || 'pendiente'].label}
                </Badge>
                {solicitud.resultado_parto === 'clinica' && (
                  <p className="text-xs text-gray-600">
                    {formatearTipoParto(solicitud.tipo_parto) || 'Tipo sin registrar'} · {formatFechaCorta(solicitud.fecha_parto)}
                  </p>
                )}
                {solicitud.observacion_parto && <p className="text-xs text-gray-600">{solicitud.observacion_parto}</p>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {solicitud.estado !== 'cancelada' && !esBitacora && (
                <Button variant="outline" onClick={() => onAgendarTour(solicitud)}>
                  <CalendarCheck className="size-4 mr-1" />
                  {tieneTour ? 'Reagendar tour' : 'Agendar tour'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleReenviar}
                disabled={isEnviando || isLoading || !solicitud.correo}
                title={
                  !solicitud.correo
                    ? 'Sin correo registrado: agréguelo en Editar datos'
                    : reenviaMisma
                    ? `Reenvía la cotización ${ultimaCotizacion.numero_cotizacion} a ${solicitud.correo}`
                    : cambioAseguradora
                      ? `La aseguradora cambió: emite una cotización nueva con ${solicitud.aseguradora || 'la aseguradora actual'}`
                      : 'Emite y envía la primera cotización'
                }
              >
                {isEnviando ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Send className="size-4 mr-1" />}
                {reenviaMisma ? 'Reenviar cotización' : cambioAseguradora ? 'Enviar nueva cotización' : 'Enviar cotización'}
              </Button>
              <Button variant="outline" onClick={handleEditar}>
                <Pencil className="size-4 mr-1" />
                Editar datos
              </Button>
            </div>
            </>
            )}
          </TabsContent>

          <TabsContent value="cotizaciones" className="pt-2">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-blue-600" /></div>
            ) : cotizaciones.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Aún no se ha emitido ninguna cotización numerada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N.º cotización</TableHead>
                    <TableHead>Emisión</TableHead>
                    <TableHead>Envío</TableHead>
                    <TableHead>Aseguradora</TableHead>
                    <TableHead>Totales</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cotizaciones.map(c => {
                    return (
                      <TableRow key={c.id_cotizacion_mat}>
                        <TableCell className="font-mono text-xs font-semibold whitespace-nowrap">{c.numero_cotizacion}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatFechaHora(c.fecha_emision)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {c.fecha_envio ? formatFechaHora(c.fecha_envio) : '—'}
                          {c.veces_enviada > 1 && <p className="text-gray-500">{c.veces_enviada} envíos</p>}
                        </TableCell>
                        <TableCell className="text-xs">{c.aseguradora || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {(c.resumen || []).length === 0
                            ? 'Genérica'
                            : c.resumen.map(r => (
                              <p key={r.procedimiento} className="whitespace-nowrap">
                                {r.procedimiento}: <strong>{formatearUSD(r.total)}</strong>
                              </p>
                            ))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.estado === 'enviada' ? 'default' : c.estado === 'error' ? 'destructive' : 'secondary'}>
                            {c.estado === 'enviada' ? 'Enviada' : c.estado === 'error' ? 'Error de envío' : 'Generada'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {c.valores && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                disabled={imprimiendoId !== null}
                                onClick={() => handleImprimir(c)}
                                title="Ver / imprimir el presupuesto"
                              >
                                {imprimiendoId === c.id_cotizacion_mat
                                  ? <Loader2 className="size-3 mr-1 animate-spin" />
                                  : <Printer className="size-3 mr-1" />}
                                Imprimir
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              disabled={reenviandoId !== null}
                              onClick={() => handleReenviarExistente(c)}
                              title="Reenviar esta misma cotización (mismo número)"
                            >
                              {reenviandoId === c.id_cotizacion_mat
                                ? <Loader2 className="size-3 mr-1 animate-spin" />
                                : <RotateCcw className="size-3 mr-1" />}
                              Reenviar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="historial" className="pt-2">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-blue-600" /></div>
            ) : historial.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Aún no hay movimientos registrados.</p>
            ) : (
              <ol className="space-y-3">
                {historial.map(h => {
                  const Icono = ICONO_HISTORIAL[h.tipo] || AlertCircle;
                  const esError = h.tipo === 'correo' && h.descripcion.startsWith('Error');
                  return (
                    <li key={h.id_historial_mat} className="flex gap-3">
                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${esError ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                        <Icono className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1 border-b pb-3">
                        <p className="text-sm break-words">{h.descripcion}</p>
                        <p className="text-xs text-gray-500">
                          {formatFechaHora(h.created_at)}{h.usuario ? ` · ${h.usuario}` : ''}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="correos" className="pt-2">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-blue-600" /></div>
            ) : envios.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Aún no se ha enviado ningún correo.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>N.º cotización</TableHead>
                    <TableHead>Destinatario</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Adjuntos</TableHead>
                    <TableHead>Enviado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {envios.map(e => (
                    <TableRow key={e.id_envio_mat}>
                      <TableCell className="text-xs whitespace-nowrap">{formatFechaHora(e.created_at)}</TableCell>
                      <TableCell className="text-xs">{e.tipo === 'confirmacion_tour' ? 'Confirmación tour' : 'Cotización'}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{numeroDeCotizacion(e.id_cotizacion_mat)}</TableCell>
                      <TableCell className="text-xs">{e.destinatario}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ESTADO_CORREO_MATERNIDAD[e.estado].className}>
                          {ESTADO_CORREO_MATERNIDAD[e.estado].label}
                        </Badge>
                        {(e.rebote_detalle || e.error_mensaje) && (
                          <p className="text-xs text-red-600 mt-1">{e.rebote_detalle || e.error_mensaje}</p>
                        )}
                        {e.correo_sugerido && <p className="text-xs text-purple-800 mt-1">¿Quisiste decir {e.correo_sugerido}?</p>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(e.adjuntos || []).map(a => (
                            <Badge key={`${a.tipo}-${a.nombre}`} variant="outline" className="text-xs font-normal">
                              <FileText className="size-3 mr-1" />{ETIQUETA_ADJUNTO[a.tipo] || a.nombre}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{e.enviado_por}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>

        <MaternidadEstadoDialog
          solicitud={cambiandoEstado ? solicitud : null}
          usuarioNombre={usuarioNombre}
          onOpenChange={open => { if (!open) setCambiandoEstado(false); }}
          onGuardado={guardada => aplicarCambios(guardada)}
        />
        <MaternidadPartoDialog
          solicitud={registrandoParto ? solicitud : null}
          usuarioNombre={usuarioNombre}
          onOpenChange={open => { if (!open) setRegistrandoParto(false); }}
          onGuardado={guardada => aplicarCambios(guardada)}
        />
      </DialogContent>
    </Dialog>
  );
}
