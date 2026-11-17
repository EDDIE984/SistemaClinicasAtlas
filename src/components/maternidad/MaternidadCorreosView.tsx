// Registro de los correos de maternidad con su estado real: enviados, rebotados (el servidor destino los
// devolvió), inválidos (dirección mal escrita, p. ej. outloook.es) y con error (falla del SMTP, se reintentan
// solos). Desde aquí se ven los adjuntos, se reenvía y se corrige la dirección.
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { AlertTriangle, Eye, FileText, Loader2, Mail, PencilLine, RefreshCw, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCorreosMaternidad, useIntentosFallidosMaternidad } from '../../hooks/useMaternidad';
import {
  completarIntentoMaternidad,
  descartarIntentoMaternidad,
  enviarCotizacionMaternidad,
  generarPdfCotizacionMaternidad,
  getDatosPresupuestoMaternidad,
  getSolicitudVistaMaternidad,
  mensajeErrorMaternidad,
  updateCorreoSolicitudMaternidad,
  validarCorreoRapido,
  type ValidacionCorreoRapida,
} from '../../lib/maternidadService';
import type {
  EstadoEnvioCorreoMaternidad,
  MaternidadCorreoVista,
  MaternidadIntentoFallido,
  MaternidadSolicitudVista,
} from '../../lib/supabaseTypes';
import { FiltroPeriodoMaternidad, periodoInicial, type PeriodoMaternidad } from './FiltroPeriodoMaternidad';
import { MaternidadSolicitudDialog } from './MaternidadSolicitudDialog';
import { MaternidadSolicitudModal } from './MaternidadSolicitudModal';
import { ESTADO_CORREO_MATERNIDAD, formatFechaHora } from './maternidadUtils';

interface MaternidadCorreosViewProps {
  currentUser: { name: string } | null;
}

const BADGE_RESUELTO = 'bg-gray-100 text-gray-600 border-gray-200';

const ETIQUETA_ADJUNTO: Record<string, string> = {
  presupuesto: 'Presupuesto',
  checklist: 'Checklist',
  boletin: 'Boletín',
};

type FiltroEstado = 'todos' | 'pendientes' | EstadoEnvioCorreoMaternidad;

export function MaternidadCorreosView({ currentUser }: MaternidadCorreosViewProps) {
  const usuarioNombre = currentUser?.name || 'Sistema';
  const [periodo, setPeriodo] = useState<PeriodoMaternidad>(() => periodoInicial('este_anio'));
  const [estado, setEstado] = useState<FiltroEstado>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [enviandoId, setEnviandoId] = useState<number | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [corrigiendo, setCorrigiendo] = useState<MaternidadCorreoVista | null>(null);
  const [detalle, setDetalle] = useState<MaternidadSolicitudVista | null>(null);
  const [solicitudTour, setSolicitudTour] = useState<MaternidadSolicitudVista | null>(null);
  const [completando, setCompletando] = useState<MaternidadIntentoFallido | null>(null);
  const [descartandoId, setDescartandoId] = useState<number | null>(null);
  const { intentos, loadIntentos } = useIntentosFallidosMaternidad();

  const { correos, isLoading, revisando, ultimaRevision, loadCorreos, revisarAhora } = useCorreosMaternidad({
    desde: periodo.desde || undefined,
    hasta: periodo.hasta || undefined,
  });

  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return correos.filter(c => {
      if (estado === 'pendientes' && !c.pendiente) return false;
      if (estado !== 'todos' && estado !== 'pendientes' && c.estado !== estado) return false;
      if (!texto) return true;
      return [c.nombre_madre, c.cedula, c.destinatario, c.correo_actual, c.numero_cotizacion, c.telefono]
        .some(v => (v || '').toLowerCase().includes(texto));
    });
  }, [correos, estado, busqueda]);

  const indicadores = useMemo(() => ({
    enviados: correos.filter(c => c.estado === 'enviado').length,
    rebotados: correos.filter(c => c.estado === 'rebotado' && c.pendiente).length,
    invalidos: correos.filter(c => c.estado === 'invalido' && c.pendiente).length,
    errores: correos.filter(c => c.estado === 'error' && c.pendiente).length,
    reintentos: correos.filter(c => c.enviado_por === 'Reintento automático').length,
  }), [correos]);

  const handleReenviar = async (c: MaternidadCorreoVista) => {
    if (!c.id_cotizacion_mat) return;
    setEnviandoId(c.id_envio_mat);
    try {
      await enviarCotizacionMaternidad(c.id_solicitud_mat, usuarioNombre, c.tipo, c.id_cotizacion_mat);
      toast.success(`Cotización ${c.numero_cotizacion ?? ''} reenviada a ${c.correo_actual}`);
      await loadCorreos();
    } catch (error) {
      toast.error(`No se pudo reenviar: ${mensajeErrorMaternidad(error)}`);
    } finally {
      setEnviandoId(null);
    }
  };

  const handleAbrirAdjunto = async (c: MaternidadCorreoVista, tipo: string) => {
    if (tipo !== 'presupuesto') {
      window.open(`/api/maternidad-adjunto?tipo=${tipo}`, '_blank', 'noopener');
      return;
    }
    if (!c.id_cotizacion_mat) return;
    const clave = `${c.id_envio_mat}-${tipo}`;
    setAbriendo(clave);
    try {
      const { solicitud, cotizacion } = await getDatosPresupuestoMaternidad(c.id_solicitud_mat, c.id_cotizacion_mat);
      window.open(await generarPdfCotizacionMaternidad(solicitud, cotizacion), '_blank', 'noopener');
    } catch (error) {
      toast.error(`No se pudo abrir el presupuesto: ${mensajeErrorMaternidad(error)}`);
    } finally {
      setAbriendo(null);
    }
  };

  const handleDescartar = async (intento: MaternidadIntentoFallido) => {
    if (!window.confirm(`¿Descartar el pedido de ${intento.nombre_madre || intento.cedula || 'esta mamá'}? No se enviará la cotización.`)) return;
    setDescartandoId(intento.id_intento_mat);
    try {
      await descartarIntentoMaternidad(intento.id_intento_mat, usuarioNombre);
      toast.success('Pedido descartado');
      await loadIntentos();
    } catch (error) {
      toast.error(`No se pudo descartar: ${mensajeErrorMaternidad(error)}`);
    } finally {
      setDescartandoId(null);
    }
  };

  const handleVerSolicitud = async (c: MaternidadCorreoVista) => {
    try {
      const solicitud = await getSolicitudVistaMaternidad(c.id_solicitud_mat);
      if (solicitud) setDetalle(solicitud);
      else toast.error('La solicitud ya no existe');
    } catch (error) {
      toast.error(`No se pudo abrir la solicitud: ${mensajeErrorMaternidad(error)}`);
    }
  };

  const kpi = (titulo: string, valor: number, detalleTexto: string, color: string, filtro: FiltroEstado) => (
    <Card className="p-3 cursor-pointer" onClick={() => setEstado(filtro)}>
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className={`text-2xl font-semibold ${color}`}>{valor}</p>
      <p className="text-xs text-gray-400">{detalleTexto}</p>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="flex items-center gap-2">
            <Mail className="size-5" />
            Correos Maternidad
          </h2>
          <p className="text-sm text-gray-600">
            Estado real de las cotizaciones enviadas: rebotes, correos mal escritos y reintentos automáticos
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button size="sm" onClick={async () => { await revisarAhora(); await loadIntentos(); }} disabled={revisando}>
            {revisando ? <Loader2 className="size-4 mr-1 animate-spin" /> : <RefreshCw className="size-4 mr-1" />}
            Revisar ahora
          </Button>
          <p className="text-xs text-gray-500">
            {revisando ? 'Revisando la casilla de correo…'
              : ultimaRevision ? `Última revisión: ${ultimaRevision.fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                : 'Se revisa automáticamente cada 10 minutos'}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FiltroPeriodoMaternidad periodo={periodo} onChange={setPeriodo} etiqueta="Fecha de envío" />
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select value={estado} onValueChange={v => setEstado(v as FiltroEstado)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendientes">Pendientes de atender</SelectItem>
                {(Object.keys(ESTADO_CORREO_MATERNIDAD) as EstadoEnvioCorreoMaternidad[]).map(e => (
                  <SelectItem key={e} value={e}>{ESTADO_CORREO_MATERNIDAD[e].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Buscar (mamá, cédula, correo, teléfono o N.º cotización)</Label>
            <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Escriba para filtrar" />
          </div>
        </div>
      </Card>

      {/* Indicadores (clic = filtrar) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpi('Enviados', indicadores.enviados, 'Sin rebote ni problema', 'text-green-700', 'enviado')}
        {kpi('Rebotados', indicadores.rebotados, 'El buzón no existe', 'text-amber-800', 'rebotado')}
        {kpi('Correo inválido', indicadores.invalidos, 'Dirección mal escrita', 'text-purple-800', 'invalido')}
        {kpi('Con error', indicadores.errores, 'Se reintentan solos', 'text-red-600', 'error')}
        {kpi('Reintentos automáticos', indicadores.reintentos, 'Reenviados por el sistema', 'text-gray-600', 'todos')}
      </div>

      {/* Pedidos por WhatsApp que no llegaron a registrarse (sin solicitud ni correo) */}
      {intentos.length > 0 && (
        <Card className="p-4 border-red-200">
          <h3 className="flex items-center gap-2 text-red-700 font-semibold">
            <AlertTriangle className="size-4" />
            Solicitudes no registradas ({intentos.length})
          </h3>
          <p className="text-xs text-gray-600 mb-2">
            Pedidos de cotización que llegaron por WhatsApp y no se pudieron registrar: la mamá no recibió su proforma.
            Complete los datos que faltan y envíela, o descarte el pedido.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Mamá</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intentos.map(i => (
                  <TableRow key={i.id_intento_mat} className="bg-red-50">
                    <TableCell className="text-xs whitespace-nowrap">{formatFechaHora(i.created_at)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{i.nombre_madre || '—'}</p>
                      <p className="text-xs text-gray-500">{i.cedula || 'Sin cédula'}</p>
                    </TableCell>
                    <TableCell className="text-xs break-words">{i.correo || <span className="text-red-600">Vacío</span>}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{i.telefono || <span className="text-red-600">Vacío</span>}</TableCell>
                    <TableCell className="text-xs max-w-xs">
                      <p className="text-red-700">{mensajeErrorMaternidad({ message: i.error_codigo })}</p>
                      {i.intentos > 1 && <p className="text-gray-500 mt-1">{i.intentos} intentos</p>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setCompletando(i)}>
                          <Send className="size-3 mr-1" />Completar y enviar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={descartandoId === i.id_intento_mat}
                          onClick={() => handleDescartar(i)}
                        >
                          <Trash2 className="size-3 mr-1" />Descartar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {isLoading && correos.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Mamá</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Cotización</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Adjuntos</TableHead>
                  <TableHead>Enviado por</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No hay correos con los filtros seleccionados
                    </TableCell>
                  </TableRow>
                ) : (
                  filas.map(c => {
                    const badge = ESTADO_CORREO_MATERNIDAD[c.estado];
                    const conProblema = c.estado !== 'enviado';
                    const resuelto = conProblema && !c.pendiente;
                    const direccionMala = (c.estado === 'rebotado' || c.estado === 'invalido') && !c.correo_cambiado;
                    return (
                      <TableRow key={c.id_envio_mat} className={c.pendiente ? 'bg-red-50' : undefined}>
                        <TableCell className="text-xs whitespace-nowrap">{formatFechaHora(c.created_at)}</TableCell>
                        <TableCell>
                          <p className="font-medium">{c.nombre_madre}</p>
                          <p className="text-xs text-gray-500">{[c.cedula, c.telefono].filter(Boolean).join(' · ')}</p>
                        </TableCell>
                        <TableCell className="text-xs">
                          <p className="break-words">{c.destinatario}</p>
                          {c.correo_cambiado && c.correo_actual && (
                            <p className="text-blue-700 mt-1">Correo actual: {c.correo_actual}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          <p className="font-mono">{c.numero_cotizacion || '—'}</p>
                          <p className="text-gray-500">{c.tipo === 'confirmacion_tour' ? 'Confirmación tour' : 'Cotización'}</p>
                        </TableCell>
                        <TableCell className="text-xs max-w-xs">
                          <Badge variant="outline" className={resuelto ? BADGE_RESUELTO : badge.className}>
                            {badge.label}{resuelto ? ' · resuelto' : ''}
                          </Badge>
                          {(c.rebote_detalle || c.error_mensaje) && (
                            <p className="text-gray-600 mt-1 break-words">{c.rebote_detalle || c.error_mensaje}</p>
                          )}
                          {c.correo_sugerido && c.pendiente && (
                            <p className="text-purple-800 mt-1">¿Quisiste decir {c.correo_sugerido}?</p>
                          )}
                          {c.reintentos_auto > 0 && (
                            <p className="text-gray-500 mt-1">{c.reintentos_auto} reintento(s) automático(s)</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(c.adjuntos || []).map(a => {
                              const clave = `${c.id_envio_mat}-${a.tipo}`;
                              return (
                                <Button
                                  key={clave}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  disabled={abriendo === clave || (a.tipo === 'presupuesto' && !c.id_cotizacion_mat)}
                                  onClick={() => handleAbrirAdjunto(c, a.tipo)}
                                  title={`Ver ${a.nombre}`}
                                >
                                  {abriendo === clave
                                    ? <Loader2 className="size-3 mr-1 animate-spin" />
                                    : <FileText className="size-3 mr-1" />}
                                  {ETIQUETA_ADJUNTO[a.tipo] || a.nombre}
                                </Button>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{c.enviado_por}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {(direccionMala || c.pendiente) && (
                              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setCorrigiendo(c)}>
                                <PencilLine className="size-3 mr-1" />Corregir correo
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={!c.id_cotizacion_mat || enviandoId === c.id_envio_mat}
                              onClick={() => handleReenviar(c)}
                              title={`Reenviar la misma cotización a ${c.correo_actual || 'el correo de la solicitud'}`}
                            >
                              {enviandoId === c.id_envio_mat
                                ? <Loader2 className="size-3 mr-1 animate-spin" />
                                : <Send className="size-3 mr-1" />}
                              Reenviar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleVerSolicitud(c)}>
                              <Eye className="size-3 mr-1" />Solicitud
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

      <CompletarIntentoDialog
        intento={completando}
        usuarioNombre={usuarioNombre}
        onOpenChange={open => { if (!open) setCompletando(null); }}
        onListo={() => { loadIntentos(); loadCorreos(); }}
      />
      <CorregirCorreoDialog
        envio={corrigiendo}
        usuarioNombre={usuarioNombre}
        onOpenChange={open => { if (!open) setCorrigiendo(null); }}
        onListo={loadCorreos}
      />
      <MaternidadSolicitudDialog
        solicitud={detalle}
        onOpenChange={open => { if (!open) setDetalle(null); }}
        usuarioNombre={usuarioNombre}
        onAgendarTour={s => { setDetalle(null); setSolicitudTour(s); }}
        onActualizado={loadCorreos}
      />
      <MaternidadSolicitudModal
        open={!!solicitudTour}
        onOpenChange={open => { if (!open) setSolicitudTour(null); }}
        solicitudBase={solicitudTour}
        usuarioNombre={usuarioNombre}
        onGuardado={loadCorreos}
      />
    </div>
  );
}

interface CorregirCorreoDialogProps {
  envio: MaternidadCorreoVista | null;
  usuarioNombre: string;
  onOpenChange: (open: boolean) => void;
  onListo: () => void;
}

/** Corrige el correo de la solicitud (validado al instante) y reenvía la misma cotización */
function CorregirCorreoDialog({ envio, usuarioNombre, onOpenChange, onListo }: CorregirCorreoDialogProps) {
  const [correo, setCorreo] = useState('');
  const [validacion, setValidacion] = useState<ValidacionCorreoRapida | null>(null);
  const [validando, setValidando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!envio) return;
    setCorreo(envio.correo_sugerido || (envio.correo_cambiado ? envio.correo_actual : envio.destinatario) || '');
    setValidacion(null);
  }, [envio]);

  // Validación rápida mientras se escribe (formato, dominio mal escrito, dominio inexistente)
  useEffect(() => {
    const valor = correo.trim();
    if (!envio || !valor.includes('@')) {
      setValidacion(null);
      return;
    }
    let vigente = true;
    setValidando(true);
    const temporizador = setTimeout(async () => {
      try {
        const resultado = await validarCorreoRapido(valor);
        if (vigente) setValidacion(resultado);
      } catch {
        if (vigente) setValidacion(null); // si el servicio falla no se bloquea el guardado
      } finally {
        if (vigente) setValidando(false);
      }
    }, 500);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [correo, envio]);

  if (!envio) return null;
  const nuevo = correo.trim().toLowerCase();
  const igualAlRebotado = nuevo === envio.destinatario.toLowerCase() && envio.estado !== 'error';
  const puedeGuardar = !!nuevo && !validando && !guardando && validacion?.valido !== false && !igualAlRebotado;

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await updateCorreoSolicitudMaternidad(envio.id_solicitud_mat, nuevo, usuarioNombre);
      if (envio.id_cotizacion_mat) {
        await enviarCotizacionMaternidad(envio.id_solicitud_mat, usuarioNombre, envio.tipo, envio.id_cotizacion_mat);
        toast.success(`Correo corregido y cotización ${envio.numero_cotizacion ?? ''} reenviada a ${nuevo}`);
      } else {
        toast.success('Correo corregido');
      }
      onOpenChange(false);
      onListo();
    } catch (error) {
      toast.error(`No se pudo completar: ${mensajeErrorMaternidad(error)}`);
      onListo();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={!!envio} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corregir correo y reenviar</DialogTitle>
          <DialogDescription>
            {envio.nombre_madre} · {envio.numero_cotizacion || 'sin cotización'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm">
            <p className="text-xs text-gray-500">Correo al que se envió</p>
            <p className="font-medium break-words">{envio.destinatario}</p>
            {(envio.rebote_detalle || envio.error_mensaje) && (
              <p className="text-xs text-red-600 mt-1 break-words">{envio.rebote_detalle || envio.error_mensaje}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Correo correcto</Label>
            <Input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="nombre@dominio.com" />
            {validando ? (
              <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="size-3 animate-spin" />Validando…</p>
            ) : igualAlRebotado ? (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="size-3" />Es el mismo correo que falló; escriba la dirección correcta
              </p>
            ) : validacion && !validacion.valido ? (
              <div className="text-xs text-red-600 flex flex-wrap items-center gap-1">
                <AlertTriangle className="size-3" />{validacion.mensaje}
                {validacion.sugerencia && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setCorreo(validacion.sugerencia!)}>
                    Usar {validacion.sugerencia}
                  </Button>
                )}
              </div>
            ) : validacion?.valido ? (
              <p className="text-xs text-green-700">El dominio recibe correos</p>
            ) : null}
          </div>
          <p className="text-xs text-gray-500">
            Se actualiza el correo de la solicitud y se reenvía la misma cotización (mismo número y valores).
            Si vuelve a rebotar, aparecerá aquí en la siguiente revisión.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={!puedeGuardar}>
            {guardando ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Send className="size-4 mr-1" />}
            Guardar y reenviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CompletarIntentoDialogProps {
  intento: MaternidadIntentoFallido | null;
  usuarioNombre: string;
  onOpenChange: (open: boolean) => void;
  onListo: () => void;
}

/** Completa los datos de un pedido no registrado y lo envía por el mismo camino que WhatsApp */
function CompletarIntentoDialog({ intento, usuarioNombre, onOpenChange, onListo }: CompletarIntentoDialogProps) {
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [validacion, setValidacion] = useState<ValidacionCorreoRapida | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!intento) return;
    setNombre(intento.nombre_madre || '');
    setCedula(intento.cedula || '');
    setCorreo(intento.correo || '');
    setTelefono(intento.telefono || '');
    setValidacion(null);
  }, [intento]);

  useEffect(() => {
    const valor = correo.trim();
    if (!intento || !valor.includes('@')) {
      setValidacion(null);
      return;
    }
    let vigente = true;
    const temporizador = setTimeout(async () => {
      try {
        const resultado = await validarCorreoRapido(valor);
        if (vigente) setValidacion(resultado);
      } catch {
        if (vigente) setValidacion(null);
      }
    }, 500);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [correo, intento]);

  if (!intento) return null;
  const completo = !!(nombre.trim() && cedula.trim() && correo.trim() && telefono.trim());
  const puedeEnviar = completo && !guardando && validacion?.valido !== false;

  const handleEnviar = async () => {
    setGuardando(true);
    try {
      const resultado = await completarIntentoMaternidad(intento, {
        nombre: nombre.trim(),
        cedula: cedula.replace(/\s/g, ''),
        correo: correo.trim().toLowerCase(),
        telefono: telefono.trim(),
      }, usuarioNombre);
      toast.success(`Solicitud #${resultado.id_solicitud_mat} registrada y cotización ${resultado.numero_cotizacion} enviada`);
      onOpenChange(false);
      onListo();
    } catch (error) {
      toast.error(`No se pudo registrar: ${mensajeErrorMaternidad(error)}`);
      onListo();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={!!intento} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Completar y enviar cotización</DialogTitle>
          <DialogDescription>
            Pedido recibido el {formatFechaHora(intento.created_at)} · {mensajeErrorMaternidad({ message: intento.error_codigo })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Nombre de la mamá</Label>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cédula</Label>
            <Input value={cedula} onChange={e => setCedula(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Teléfono</Label>
            <Input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="593…" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Correo</Label>
            <Input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="nombre@dominio.com" />
            {validacion && !validacion.valido && (
              <div className="text-xs text-red-600 flex flex-wrap items-center gap-1">
                <AlertTriangle className="size-3" />{validacion.mensaje}
                {validacion.sugerencia && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setCorreo(validacion.sugerencia!)}>
                    Usar {validacion.sugerencia}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Se usan también la aseguradora, el médico, las semanas y el tour que llegaron por WhatsApp. Se registra la
          solicitud y se envía la cotización igual que desde el chat.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button onClick={handleEnviar} disabled={!puedeEnviar}>
            {guardando ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Send className="size-4 mr-1" />}
            Registrar y enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
