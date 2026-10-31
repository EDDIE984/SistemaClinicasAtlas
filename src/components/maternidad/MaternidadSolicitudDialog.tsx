// Detalle de una solicitud de maternidad: datos, cotizaciones numeradas y auditoría de correos
import { useEffect, useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Loader2, Send, CalendarCheck, FileText, Mail, Printer, RotateCcw, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import {
  ESTADOS_SOLICITUD_MATERNIDAD,
  enviarCotizacionMaternidad,
  getCotizacionesBySolicitud,
  getEnviosCorreoBySolicitud,
  generarPdfCotizacionMaternidad,
  mensajeErrorMaternidad,
  updateEstadoSolicitudMaternidad,
} from '../../lib/maternidadService';
import type {
  EstadoSolicitudMaternidad,
  MaternidadCotizacion,
  MaternidadEnvioCorreo,
  MaternidadSolicitudVista,
} from '../../lib/supabaseTypes';
import { ESTADO_BADGE_MATERNIDAD, formatFechaHora, formatFechaLarga, formatHorario } from './maternidadUtils';

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

export function MaternidadSolicitudDialog({
  solicitud,
  onOpenChange,
  usuarioNombre,
  onAgendarTour,
  onActualizado,
}: MaternidadSolicitudDialogProps) {
  const [envios, setEnvios] = useState<MaternidadEnvioCorreo[]>([]);
  const [cotizaciones, setCotizaciones] = useState<MaternidadCotizacion[]>([]);
  const [reenviandoId, setReenviandoId] = useState<number | null>(null);
  const [imprimiendoId, setImprimiendoId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnviando, setIsEnviando] = useState(false);
  const [estado, setEstado] = useState<EstadoSolicitudMaternidad>('solo_cotizacion');

  const cargarDetalle = useCallback(async () => {
    if (!solicitud) return;
    setIsLoading(true);
    try {
      const [correos, cots] = await Promise.all([
        getEnviosCorreoBySolicitud(solicitud.id_solicitud_mat),
        getCotizacionesBySolicitud(solicitud.id_solicitud_mat),
      ]);
      setEnvios(correos);
      setCotizaciones(cots);
    } catch {
      toast.error('Error al cargar el detalle de la solicitud');
    } finally {
      setIsLoading(false);
    }
  }, [solicitud]);

  useEffect(() => {
    if (solicitud) setEstado(solicitud.estado);
    cargarDetalle();
  }, [solicitud, cargarDetalle]);

  if (!solicitud) return null;

  const tieneTour = !!solicitud.fecha_tour && solicitud.estado !== 'solo_cotizacion';

  const handleCambiarEstado = async (nuevo: EstadoSolicitudMaternidad) => {
    if (nuevo === 'solo_cotizacion' && tieneTour) {
      toast.error('Para quitar el tour cambie el estado a Cancelada');
      return;
    }
    if (['agendada', 'confirmada', 'asistio', 'no_asistio'].includes(nuevo) && !solicitud.fecha_tour) {
      toast.error('Primero agende el tour');
      return;
    }
    try {
      await updateEstadoSolicitudMaternidad(solicitud.id_solicitud_mat, nuevo);
      setEstado(nuevo);
      toast.success('Estado actualizado');
      onActualizado();
    } catch (error) {
      toast.error(mensajeErrorMaternidad(error));
    }
  };

  // Reenvía la última cotización (mismo número); si la solicitud aún no tiene ninguna, emite la primera
  const ultimaCotizacion = cotizaciones[0] || null;
  const handleReenviar = async () => {
    setIsEnviando(true);
    try {
      const envio = ultimaCotizacion
        ? await enviarCotizacionMaternidad(solicitud.id_solicitud_mat, usuarioNombre, ultimaCotizacion.tipo, ultimaCotizacion.id_cotizacion_mat)
        : await enviarCotizacionMaternidad(solicitud.id_solicitud_mat, usuarioNombre, tieneTour ? 'confirmacion_tour' : 'cotizacion');
      toast.success(`Cotización ${envio.numero_cotizacion || ''} ${ultimaCotizacion ? 'reenviada' : 'enviada'} a ${solicitud.correo}`);
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
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {solicitud.nombre_madre}
            <Badge variant="outline" className={ESTADO_BADGE_MATERNIDAD[estado].className}>
              {ESTADO_BADGE_MATERNIDAD[estado].label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Solicitud #{solicitud.id_solicitud_mat} · registrada el {formatFechaHora(solicitud.created_at)} · origen {solicitud.origen === 'CHATBOT' ? 'WhatsApp' : 'Sistema'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="datos">
          <TabsList>
            <TabsTrigger value="datos"><FileText className="size-4 mr-1" />Datos</TabsTrigger>
            <TabsTrigger value="cotizaciones"><Receipt className="size-4 mr-1" />Cotizaciones ({cotizaciones.length})</TabsTrigger>
            <TabsTrigger value="correos"><Mail className="size-4 mr-1" />Correos ({envios.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="datos" className="space-y-4 pt-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {dato('Cédula', solicitud.cedula)}
              {dato('Semanas de gestación', solicitud.semanas_gestacion)}
              {dato('Aseguradora', solicitud.aseguradora)}
              {dato('Correo', solicitud.correo)}
              {dato('Teléfono', solicitud.telefono)}
              {dato('Médico ginecólogo', solicitud.medico_ginecologo)}
              {dato('Fecha del tour', solicitud.fecha_tour ? formatFechaLarga(solicitud.fecha_tour) : 'Sin tour agendado')}
              {dato('Turno', formatHorario(solicitud.hora_inicio, solicitud.hora_fin))}
              {dato('Registrado por', solicitud.creado_por || (solicitud.origen === 'CHATBOT' ? 'Chatbot' : null))}
            </div>
            {solicitud.notas && dato('Observaciones', solicitud.notas)}

            <div className="flex flex-wrap items-end gap-3 border-t pt-4">
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Select value={estado} onValueChange={v => handleCambiarEstado(v as EstadoSolicitudMaternidad)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_SOLICITUD_MATERNIDAD.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {estado !== 'cancelada' && (
                <Button variant="outline" onClick={() => onAgendarTour(solicitud)}>
                  <CalendarCheck className="size-4 mr-1" />
                  {tieneTour ? 'Reagendar tour' : 'Agendar tour'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleReenviar}
                disabled={isEnviando || isLoading}
                title={ultimaCotizacion ? `Reenvía la cotización ${ultimaCotizacion.numero_cotizacion} a ${solicitud.correo}` : 'Emite y envía la primera cotización'}
              >
                {isEnviando ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Send className="size-4 mr-1" />}
                {ultimaCotizacion ? 'Reenviar cotización' : 'Enviar cotización'}
              </Button>
            </div>
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
                                {r.procedimiento}: <strong>${r.total.toLocaleString('es-EC', { minimumFractionDigits: 2 })}</strong>
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
                        <Badge variant={e.estado === 'enviado' ? 'default' : 'destructive'}>
                          {e.estado === 'enviado' ? 'Enviado' : 'Error'}
                        </Badge>
                        {e.error_mensaje && <p className="text-xs text-red-600 mt-1">{e.error_mensaje}</p>}
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
      </DialogContent>
    </Dialog>
  );
}
