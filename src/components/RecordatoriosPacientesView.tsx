import { useMemo, useState } from 'react';
import { BellRing, Loader2, RefreshCw, Search, Send, Stethoscope, RotateCcw, StopCircle, History, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import { useRecordatorios } from '../hooks/useRecordatorios';
import {
  useEnvioProgresivoWhatsApp,
  estimarSegundosEnvio,
  MAX_MENSAJES_POR_DIA,
  type ElementoColaWhatsApp,
} from '../hooks/useEnvioProgresivoWhatsApp';
import {
  contarMensajesEnviadosHoy,
  getHistorialRecordatorios,
  type CitaRecordatorio,
  type EstadoUltimoRecordatorio,
  type RecordatorioHistorial,
} from '../lib/recordatoriosService';
import { construirMensajeRecordatorioPaciente, construirMensajeResumenMedico } from '../lib/whatsappService';

interface RecordatoriosPacientesViewProps {
  currentUser: { id_sucursal?: number; tipo_usuario?: string } | null;
}

type FiltroTipo = 'todas' | 'CONSULTA_EXTERNA' | 'SERVICIO';
type FiltroEstado = 'todos' | 'pendiente' | 'enviado' | 'fallido';

const COLOR_MODULO = '#ea580c';

const fechaLocal = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const sumarDias = (dias: number) => { const d = new Date(); d.setDate(d.getDate() + dias); return fechaLocal(d); };
const formatearFechaCorta = (fecha: string) => { const [a, m, d] = fecha.split('-'); return `${d}/${m}/${a}`; };
const formatearFechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatearDuracion = (segundos: number) => {
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `${minutos} min ${segundos % 60} s`;
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
};

// ---------- Armado de la cola de mensajes ----------
function elementosPacientes(citas: CitaRecordatorio[]): ElementoColaWhatsApp[] {
  return citas.map(cita => ({
    etiqueta: cita.paciente.nombre,
    telefono: cita.paciente.telefono,
    mensaje: construirMensajeRecordatorioPaciente({
      nombrePaciente: cita.paciente.nombre,
      atencion: cita.atencion,
      fecha: cita.fecha,
      horaInicio: cita.hora,
      profesional: cita.medico?.nombre,
      sucursal: cita.sucursal,
    }),
    filas: [{
      tipo_destinatario: 'PACIENTE',
      tipo_cita: cita.tipoCita,
      id_cita: cita.idCita,
      id_cita_servicio: cita.idCitaServicio,
      id_usuario_sucursal: cita.medico?.idUsuarioSucursal ?? null,
      fecha_cita: cita.fecha,
    }],
  }));
}

/** Un resumen por médico y fecha (solo consulta externa). */
function elementosMedicos(citas: CitaRecordatorio[]): ElementoColaWhatsApp[] {
  const grupos = new Map<string, CitaRecordatorio[]>();
  citas
    .filter(cita => cita.tipoCita === 'CONSULTA_EXTERNA' && cita.medico)
    .forEach(cita => {
      const clave = `${cita.medico!.idUsuarioSucursal}|${cita.fecha}`;
      grupos.set(clave, [...(grupos.get(clave) || []), cita]);
    });

  return [...grupos.values()].map(grupo => {
    const { medico, fecha, sucursal } = grupo[0];
    return {
      etiqueta: `Dr./Dra. ${medico!.nombre} (${formatearFechaCorta(fecha)})`,
      telefono: medico!.telefono,
      mensaje: construirMensajeResumenMedico({
        medico: medico!.nombre,
        fecha,
        sucursal,
        citas: grupo.map(cita => ({ hora: cita.hora, paciente: cita.paciente.nombre })),
      }),
      filas: grupo.map(cita => ({
        tipo_destinatario: 'MEDICO' as const,
        tipo_cita: cita.tipoCita,
        id_cita: cita.idCita,
        id_cita_servicio: null,
        id_usuario_sucursal: medico!.idUsuarioSucursal,
        fecha_cita: cita.fecha,
      })),
    };
  });
}

function EstadoRecordatorio({ estado }: { estado?: EstadoUltimoRecordatorio }) {
  if (!estado) return <span className="text-xs text-gray-400">Pendiente</span>;
  if (estado.estado === 'ENVIADO') {
    return <span className="text-xs text-green-600">Enviado {formatearFechaHora(estado.fecha)}</span>;
  }
  return (
    <span className="text-xs text-red-600" title={estado.detalle || undefined}>
      Fallido {formatearFechaHora(estado.fecha)}
    </span>
  );
}

export function RecordatoriosPacientesView({ currentUser }: RecordatoriosPacientesViewProps) {
  const idSucursal = currentUser?.id_sucursal || parseInt(localStorage.getItem('currentSucursalId') || '0') || null;
  const hoy = fechaLocal(new Date());

  const [vista, setVista] = useState<'citas' | 'historial'>('citas');
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(sumarDias(7));
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todas');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [envioPorConfirmar, setEnvioPorConfirmar] = useState<{
    titulo: string;
    elementos: ElementoColaWhatsApp[];
    yaEnviados: number;
    recortados: number;
  } | null>(null);
  const [preparando, setPreparando] = useState(false);

  // Historial
  const [historialDesde, setHistorialDesde] = useState(sumarDias(-7));
  const [historialHasta, setHistorialHasta] = useState(hoy);
  const [historial, setHistorial] = useState<RecordatorioHistorial[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const { citas, ultimos, isLoading, recargar } = useRecordatorios(idSucursal, desde, hasta);
  const envio = useEnvioProgresivoWhatsApp();

  const citasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return citas.filter(cita => {
      if (filtroTipo !== 'todas' && cita.tipoCita !== filtroTipo) return false;
      const estadoPaciente = ultimos.get(cita.clave)?.paciente?.estado;
      if (filtroEstado === 'pendiente' && estadoPaciente) return false;
      if (filtroEstado === 'enviado' && estadoPaciente !== 'ENVIADO') return false;
      if (filtroEstado === 'fallido' && estadoPaciente !== 'FALLIDO') return false;
      if (!termino) return true;
      return cita.paciente.nombre.toLowerCase().includes(termino) || cita.paciente.cedula.includes(termino);
    });
  }, [citas, ultimos, filtroTipo, filtroEstado, busqueda]);

  const citasSeleccionadas = citasFiltradas.filter(cita => seleccion.has(cita.clave));
  const todasSeleccionadas = citasFiltradas.length > 0 && citasSeleccionadas.length === citasFiltradas.length;
  const resumenesMedico = elementosMedicos(citasSeleccionadas).length;
  const citasConFallo = citas.filter(cita => {
    const ultimo = ultimos.get(cita.clave);
    return ultimo?.paciente?.estado === 'FALLIDO' || ultimo?.medico?.estado === 'FALLIDO';
  });

  const toggleCita = (clave: string) => setSeleccion(prev => {
    const nueva = new Set(prev);
    if (nueva.has(clave)) nueva.delete(clave); else nueva.add(clave);
    return nueva;
  });
  const toggleTodas = () => setSeleccion(todasSeleccionadas ? new Set() : new Set(citasFiltradas.map(cita => cita.clave)));

  // Revisa el límite diario y abre la confirmación
  const prepararEnvio = async (titulo: string, elementos: ElementoColaWhatsApp[], yaEnviados: number) => {
    if (elementos.length === 0) { toast.error('No hay mensajes para enviar'); return; }
    setPreparando(true);
    try {
      const enviadosHoy = await contarMensajesEnviadosHoy();
      const disponibles = Math.max(MAX_MENSAJES_POR_DIA - enviadosHoy, 0);
      if (disponibles === 0) {
        toast.error(`Se alcanzó el límite diario de seguridad (${MAX_MENSAJES_POR_DIA} mensajes). Continúe mañana.`);
        return;
      }
      setEnvioPorConfirmar({
        titulo,
        elementos: elementos.slice(0, disponibles),
        yaEnviados,
        recortados: Math.max(elementos.length - disponibles, 0),
      });
    } catch {
      toast.error('No se pudo verificar el límite diario de envíos');
    } finally {
      setPreparando(false);
    }
  };

  const handleRecordarPacientes = () => {
    const yaEnviados = citasSeleccionadas.filter(cita => ultimos.get(cita.clave)?.paciente?.estado === 'ENVIADO').length;
    void prepararEnvio('Recordatorio a pacientes', elementosPacientes(citasSeleccionadas), yaEnviados);
  };

  const handleRecordarMedicos = () => {
    const yaEnviados = citasSeleccionadas.filter(cita =>
      cita.tipoCita === 'CONSULTA_EXTERNA' && ultimos.get(cita.clave)?.medico?.estado === 'ENVIADO').length;
    void prepararEnvio('Recordatorio a médicos (resumen por día)', elementosMedicos(citasSeleccionadas), yaEnviados);
  };

  const handleReintentarFallidos = () => {
    const pacientes = citasConFallo.filter(cita => ultimos.get(cita.clave)?.paciente?.estado === 'FALLIDO');
    const medicos = citasConFallo.filter(cita => ultimos.get(cita.clave)?.medico?.estado === 'FALLIDO');
    void prepararEnvio('Reintentar recordatorios fallidos', [...elementosPacientes(pacientes), ...elementosMedicos(medicos)], 0);
  };

  const handleConfirmarEnvio = async () => {
    if (!envioPorConfirmar) return;
    const { elementos } = envioPorConfirmar;
    setEnvioPorConfirmar(null);
    const resumen = await envio.iniciar(elementos);
    const texto = `${resumen.enviados} enviados, ${resumen.fallidos} fallidos`;
    if (resumen.cancelado) toast.warning(`Envío detenido: ${texto}`);
    else if (resumen.fallidos > 0) toast.warning(`Envío terminado: ${texto}. Revise los fallidos.`);
    else toast.success(`Envío terminado: ${texto}`);
    setSeleccion(new Set());
    await recargar();
  };

  const cargarHistorial = async () => {
    setCargandoHistorial(true);
    try {
      setHistorial(await getHistorialRecordatorios(historialDesde, historialHasta));
    } catch {
      toast.error('No se pudo cargar el historial de recordatorios');
    } finally {
      setCargandoHistorial(false);
    }
  };

  const cambiarVista = (nueva: 'citas' | 'historial') => {
    setVista(nueva);
    if (nueva === 'historial') void cargarHistorial();
  };

  if (!idSucursal) {
    return <Card className="p-6"><p className="text-sm text-red-600">No se encontró la sucursal del usuario.</p></Card>;
  }

  const textoEspera = envio.espera
    ? envio.espera.motivo === 'lote'
      ? `Pausa de seguridad: se reanuda en ${formatearDuracion(envio.espera.segundos)}`
      : envio.espera.motivo === 'limite'
        ? `WhatsApp pidió esperar: se reanuda en ${formatearDuracion(envio.espera.segundos)}`
        : `Próximo envío en ${envio.espera.segundos} s`
    : envio.actual ? `Enviando a ${envio.actual}…` : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className="size-5" style={{ color: COLOR_MODULO }} />
            <h1 className="text-2xl font-semibold text-gray-900">Recordatorio Pacientes</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Envíe recordatorios de cita por WhatsApp a pacientes y médicos. Los mensajes salen de forma progresiva para proteger el número.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={vista === 'citas' ? 'default' : 'outline'} onClick={() => cambiarVista('citas')} className="gap-2">
            <ListChecks className="size-4" /> Citas
          </Button>
          <Button variant={vista === 'historial' ? 'default' : 'outline'} onClick={() => cambiarVista('historial')} className="gap-2">
            <History className="size-4" /> Historial
          </Button>
        </div>
      </div>

      {/* Panel de progreso del envío */}
      {envio.enProceso && (
        <Card className="p-4 space-y-3" style={{ borderColor: COLOR_MODULO }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" style={{ color: COLOR_MODULO }} />
              <span className="font-medium text-gray-900">
                {envio.enviados + envio.fallidos} de {envio.total} procesados · {envio.enviados} enviados · {envio.fallidos} fallidos
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={envio.cancelar} className="gap-2 text-red-600">
              <StopCircle className="size-4" /> Detener
            </Button>
          </div>
          <div className="w-full rounded-full bg-gray-200" style={{ height: 8 }}>
            <div
              className="rounded-full"
              style={{
                height: 8,
                backgroundColor: COLOR_MODULO,
                width: `${envio.total ? ((envio.enviados + envio.fallidos) / envio.total) * 100 : 0}%`,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {textoEspera} · Tiempo restante aprox.: {formatearDuracion(envio.segundosRestantesEstimados)}
          </p>
          <p className="text-xs text-gray-500">No cierre ni recargue esta pestaña hasta que termine el envío.</p>
        </Card>
      )}

      {vista === 'citas' ? (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1" style={{ minWidth: 150 }}>
                <Label className="text-xs text-gray-500">Desde</Label>
                <Input type="date" value={desde} min={hoy} onChange={e => setDesde(e.target.value < hoy ? hoy : e.target.value)} />
              </div>
              <div className="space-y-1" style={{ minWidth: 150 }}>
                <Label className="text-xs text-gray-500">Hasta</Label>
                <Input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} />
              </div>
              <div className="space-y-1" style={{ minWidth: 170 }}>
                <Label className="text-xs text-gray-500">Tipo</Label>
                <Select value={filtroTipo} onValueChange={v => setFiltroTipo(v as FiltroTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="CONSULTA_EXTERNA">Consulta externa</SelectItem>
                    <SelectItem value="SERVICIO">Servicios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1" style={{ minWidth: 170 }}>
                <Label className="text-xs text-gray-500">Recordatorio al paciente</Label>
                <Select value={filtroEstado} onValueChange={v => setFiltroEstado(v as FiltroEstado)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendiente">No enviado</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="fallido">Fallido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1" style={{ minWidth: 200 }}>
                <Label className="text-xs text-gray-500">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 size-4 text-gray-400" />
                  <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Paciente o cédula" className="pl-9" />
                </div>
              </div>
              <Button variant="outline" onClick={() => void recargar()} disabled={isLoading} className="gap-2">
                <RefreshCw className={isLoading ? 'size-4 animate-spin' : 'size-4'} /> Actualizar
              </Button>
            </div>
          </Card>

          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">{citasSeleccionadas.length} de {citasFiltradas.length} seleccionadas</span>
            <div className="flex-1" />
            <Button
              onClick={handleRecordarPacientes}
              disabled={envio.enProceso || preparando || citasSeleccionadas.length === 0}
              className="gap-2"
            >
              <Send className="size-4" /> Recordar a pacientes ({citasSeleccionadas.length})
            </Button>
            <Button
              variant="outline"
              onClick={handleRecordarMedicos}
              disabled={envio.enProceso || preparando || resumenesMedico === 0}
              className="gap-2"
              title="Solo citas de consulta externa: un resumen por médico y día"
            >
              <Stethoscope className="size-4" /> Recordar a médicos ({resumenesMedico})
            </Button>
            {citasConFallo.length > 0 && (
              <Button variant="outline" onClick={handleReintentarFallidos} disabled={envio.enProceso || preparando} className="gap-2 text-red-600">
                <RotateCcw className="size-4" /> Reintentar fallidos ({citasConFallo.length})
              </Button>
            )}
          </div>

          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
            ) : citasFiltradas.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500">No hay citas en el rango seleccionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead style={{ width: 40 }}>
                        <Checkbox checked={todasSeleccionadas} onCheckedChange={toggleTodas} aria-label="Seleccionar todas" />
                      </TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Atención / Médico</TableHead>
                      <TableHead>Recordatorio paciente</TableHead>
                      <TableHead>Recordatorio médico</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {citasFiltradas.map(cita => {
                      const ultimo = ultimos.get(cita.clave);
                      return (
                        <TableRow key={cita.clave} className="cursor-pointer" onClick={() => toggleCita(cita.clave)}>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox checked={seleccion.has(cita.clave)} onCheckedChange={() => toggleCita(cita.clave)} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatearFechaCorta(cita.fecha)} <span className="text-gray-500">{cita.hora.slice(0, 5)}</span>
                          </TableCell>
                          <TableCell>
                            {cita.tipoCita === 'SERVICIO'
                              ? <Badge className="bg-purple-100 text-purple-600">Servicio</Badge>
                              : <Badge className="bg-blue-100 text-blue-600">Consulta externa</Badge>}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-gray-900">{cita.paciente.nombre}</p>
                            <p className="text-xs text-gray-500">{cita.paciente.cedula}</p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{cita.paciente.telefono || <span className="text-red-600">Sin teléfono</span>}</TableCell>
                          <TableCell>
                            <p>{cita.atencion}</p>
                            {cita.medico && <p className="text-xs text-gray-500">Dr./Dra. {cita.medico.nombre}</p>}
                          </TableCell>
                          <TableCell><EstadoRecordatorio estado={ultimo?.paciente} /></TableCell>
                          <TableCell>
                            {cita.tipoCita === 'CONSULTA_EXTERNA'
                              ? <EstadoRecordatorio estado={ultimo?.medico} />
                              : <span className="text-xs text-gray-400">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1" style={{ minWidth: 150 }}>
                <Label className="text-xs text-gray-500">Enviados desde</Label>
                <Input type="date" value={historialDesde} onChange={e => setHistorialDesde(e.target.value)} />
              </div>
              <div className="space-y-1" style={{ minWidth: 150 }}>
                <Label className="text-xs text-gray-500">Hasta</Label>
                <Input type="date" value={historialHasta} min={historialDesde} onChange={e => setHistorialHasta(e.target.value)} />
              </div>
              <Button variant="outline" onClick={() => void cargarHistorial()} disabled={cargandoHistorial} className="gap-2">
                <RefreshCw className={cargandoHistorial ? 'size-4 animate-spin' : 'size-4'} /> Consultar
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {cargandoHistorial ? (
              <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
            ) : historial.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500">No hay recordatorios en el rango seleccionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha de envío</TableHead>
                      <TableHead>Destinatario</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Cita</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historial.map(fila => {
                      const paciente = fila.cita?.paciente || fila.cita_servicio?.paciente;
                      const medico = fila.usuario_sucursal?.usuario;
                      return (
                        <TableRow key={fila.id_recordatorio}>
                          <TableCell className="whitespace-nowrap">{formatearFechaHora(fila.fecha_envio)}</TableCell>
                          <TableCell>
                            {fila.tipo_destinatario === 'PACIENTE'
                              ? 'Paciente'
                              : `Médico${medico ? `: Dr./Dra. ${medico.nombre} ${medico.apellido}` : ''}`}
                          </TableCell>
                          <TableCell>
                            {paciente ? `${paciente.nombres} ${paciente.apellidos}` : '—'}
                            {paciente && <p className="text-xs text-gray-500">{paciente.cedula}</p>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatearFechaCorta(fila.fecha_cita)} · {fila.tipo_cita === 'SERVICIO' ? 'Servicio' : 'Consulta externa'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{fila.telefono}</TableCell>
                          <TableCell>
                            {fila.estado === 'ENVIADO'
                              ? <span className="text-xs text-green-600">Enviado</span>
                              : <span className="text-xs text-red-600" title={fila.detalle_error || undefined}>
                                  Fallido{fila.detalle_error ? `: ${fila.detalle_error}` : ''}
                                </span>}
                            {fila.intentos > 1 && <p className="text-xs text-gray-500">{fila.intentos} intentos</p>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Confirmación de envío */}
      <AlertDialog open={!!envioPorConfirmar} onOpenChange={abierto => !abierto && setEnvioPorConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{envioPorConfirmar?.titulo}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  Se enviarán <strong>{envioPorConfirmar?.elementos.length}</strong> mensajes de WhatsApp de forma progresiva.
                  Tiempo estimado: <strong>{formatearDuracion(estimarSegundosEnvio(envioPorConfirmar?.elementos.length || 0))}</strong>.
                </p>
                {!!envioPorConfirmar?.yaEnviados && (
                  <p>{envioPorConfirmar.yaEnviados} de las citas ya tenían un recordatorio enviado y lo recibirán de nuevo.</p>
                )}
                {!!envioPorConfirmar?.recortados && (
                  <p className="text-red-600">
                    Por el límite diario de seguridad ({MAX_MENSAJES_POR_DIA} mensajes) quedan fuera {envioPorConfirmar.recortados} mensajes.
                    Envíelos mañana.
                  </p>
                )}
                <p>Mantenga esta pestaña abierta hasta que termine el envío.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmarEnvio()}>Enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
