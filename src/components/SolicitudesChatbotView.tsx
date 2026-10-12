import { useMemo, useState } from 'react';
import { CalendarPlus, Loader2, RefreshCw, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import { AgendarCitaServicioModal } from './AgendarCitaServicioModal';
import { AgendarCitaModalSupabase } from './AgendarCitaModalSupabase';
import { useSolicitudesChatbot } from '../hooks/useSolicitudesChatbot';
import { createCitaServicio } from '../lib/citaServicioService';
import type { SolicitudChatbot } from '../lib/supabaseTypes';

interface SolicitudesChatbotViewProps {
  currentUser: {
    name: string;
    email: string;
    compania?: string;
    id_sucursal?: number;
    sucursal?: string;
    id_servicio?: number;
    especialidad?: string;
    servicio?: string;
    servicio_area?: string;
    tipo_usuario?: string;
  } | null;
}

type FiltroTipo = 'todas' | 'servicio' | 'consulta_externa';

function formatearFecha(fecha: string): string {
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return fecha;
  return date.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Fecha y hora de la cita que pidió el paciente (datos del mensaje del chatbot)
function formatearCitaSolicitada(solicitud: SolicitudChatbot): string {
  const { fecha, hora, fechaTexto, horaTexto } = solicitud.datos;
  let textoFecha = fechaTexto || 'fecha no indicada';
  if (fecha) {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const diaSemana = DIAS_SEMANA[new Date(anio, mes - 1, dia).getDay()];
    textoFecha = `${diaSemana} ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
  }
  const textoHora = hora || horaTexto;
  return textoHora ? `${textoFecha} · ${textoHora}` : textoFecha;
}

export function SolicitudesChatbotView({ currentUser }: SolicitudesChatbotViewProps) {
  const { solicitudes, isLoading, loadSolicitudes, marcarAtendida, descartar } = useSolicitudesChatbot();
  const [filtro, setFiltro] = useState<FiltroTipo>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<SolicitudChatbot | null>(null);
  const [solicitudADescartar, setSolicitudADescartar] = useState<SolicitudChatbot | null>(null);
  const [descartando, setDescartando] = useState(false);

  const idUsuarioActual = useMemo(() => {
    const id = localStorage.getItem('currentUserId');
    return id ? Number(id) : null;
  }, []);

  const solicitudesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase();
    return solicitudes.filter(solicitud => {
      if (filtro !== 'todas' && solicitud.datos.tipo !== filtro) return false;
      if (!termino) return true;
      return [solicitud.datos.cedula, solicitud.datos.pacienteNombre]
        .some(valor => valor?.toLocaleLowerCase().includes(termino));
    });
  }, [solicitudes, filtro, busqueda]);

  const handleCitaServicioCreada = async (solicitud: SolicitudChatbot, idCitaServicio: number) => {
    const ok = await marcarAtendida(solicitud.id_conversacion, { id_cita_servicio: idCitaServicio });
    if (!ok) toast.warning('La cita se creó, pero no se pudo cerrar la solicitud del chatbot');
  };

  const handleCitaConsultaCreada = async (solicitud: SolicitudChatbot, idCita: number) => {
    const ok = await marcarAtendida(solicitud.id_conversacion, { id_cita: idCita });
    if (!ok) toast.warning('La cita se creó, pero no se pudo cerrar la solicitud del chatbot');
  };

  const handleDescartar = async () => {
    if (!solicitudADescartar) return;
    setDescartando(true);
    const ok = await descartar(solicitudADescartar.id_conversacion);
    if (ok) {
      toast.success('Solicitud descartada');
      setSolicitudADescartar(null);
    } else {
      toast.error('No se pudo descartar la solicitud');
    }
    setDescartando(false);
  };

  const solicitudNoAgendable = (solicitud: SolicitudChatbot) =>
    solicitud.datos.tipo === 'desconocido' || !solicitud.datos.cedula;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">Solicitudes del Chat Bot</h1>
            <Badge className="bg-blue-100 text-blue-600">{solicitudes.length} pendientes</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">Solicitudes de cita recibidas por WhatsApp.</p>
        </div>
        <Button variant="outline" onClick={() => void loadSolicitudes()} disabled={isLoading} className="gap-2 self-start">
          <RefreshCw className={isLoading ? 'size-4 animate-spin' : 'size-4'} />
          Actualizar
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {([
              ['todas', 'Todas'], ['servicio', 'Servicios'], ['consulta_externa', 'Consulta externa'],
            ] as Array<[FiltroTipo, string]>).map(([valor, etiqueta]) => (
              <Button key={valor} type="button" size="sm" variant={filtro === valor ? 'default' : 'outline'} onClick={() => setFiltro(valor)}>
                {etiqueta}
              </Button>
            ))}
          </div>
          <div className="relative w-full">
            <Search className="absolute left-3 top-3 size-4 text-gray-400" />
            <Input value={busqueda} onChange={evento => setBusqueda(evento.target.value)} placeholder="Buscar por cédula o nombre" className="pl-9" />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
      ) : solicitudesFiltradas.length === 0 ? (
        <Card className="p-6 text-center text-gray-500">No hay solicitudes pendientes del chatbot</Card>
      ) : (
        <div className="space-y-3">
          {solicitudesFiltradas.map(solicitud => {
            const noAgendable = solicitudNoAgendable(solicitud);
            const detalleTipo = solicitud.datos.tipo === 'servicio' ? solicitud.datos.servicio : solicitud.datos.especialidad;
            return (
              <Card key={solicitud.id_detalle} className="overflow-hidden" style={{ gap: 0 }}>
                <div className="flex flex-col gap-3 border-b bg-gray-50 px-4 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-800">Cita solicitada: {formatearCitaSolicitada(solicitud)}</span>
                      {solicitud.datos.tipo === 'servicio' && <Badge className="bg-purple-100 text-purple-600">Servicio</Badge>}
                      {solicitud.datos.tipo === 'consulta_externa' && <Badge className="bg-blue-100 text-blue-600">Consulta externa</Badge>}
                      {solicitud.datos.tipo === 'desconocido' && <Badge variant="outline">Sin tipo identificable</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {solicitud.datos.pacienteNombre || 'Paciente no registrado'}{solicitud.datos.cedula ? ` · ${solicitud.datos.cedula}` : ''}{detalleTipo ? ` · ${detalleTipo}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Mensaje recibido: {formatearFecha(solicitud.fecha_mensaje)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span title={noAgendable ? 'Se requiere cédula y un tipo de solicitud reconocido para agendar.' : undefined}>
                      <Button size="sm" onClick={() => setSolicitudSeleccionada(solicitud)} disabled={noAgendable} className="gap-2">
                        <CalendarPlus className="size-4" /> Agendar
                      </Button>
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setSolicitudADescartar(solicitud)} className="gap-2 text-red-600 hover:text-red-700">
                      <XCircle className="size-4" /> Descartar
                    </Button>
                  </div>
                </div>
                <details className="group px-4 py-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">Último mensaje del chatbot</summary>
                  <pre className="mt-3 overflow-auto rounded-lg bg-blue-50 p-3 text-sm text-gray-700" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                    {solicitud.mensajeAgente}
                  </pre>
                </details>
              </Card>
            );
          })}
        </div>
      )}

      {solicitudSeleccionada?.datos.tipo === 'servicio' && (
        <AgendarCitaServicioModal
          isOpen
          onClose={() => setSolicitudSeleccionada(null)}
          onCitaAgendada={() => void loadSolicitudes()}
          onCrearCita={createCitaServicio}
          currentUserName={currentUser?.name}
          prefill={{
            cedula: solicitudSeleccionada.datos.cedula,
            telefono: solicitudSeleccionada.datos.telefono,
            correo: solicitudSeleccionada.datos.correo,
            servicioTexto: solicitudSeleccionada.datos.servicio,
            fecha: solicitudSeleccionada.datos.fecha,
            hora: solicitudSeleccionada.datos.hora,
            seguro: solicitudSeleccionada.datos.seguro,
          }}
          onCitaCreada={cita => void handleCitaServicioCreada(solicitudSeleccionada, cita.id_cita_servicio)}
          enviarConfirmacionWhatsApp
        />
      )}

      {solicitudSeleccionada?.datos.tipo === 'consulta_externa' && (
        <AgendarCitaModalSupabase
          isOpen
          onClose={() => setSolicitudSeleccionada(null)}
          onCitaAgendada={() => void loadSolicitudes()}
          idUsuarioActual={idUsuarioActual}
          tipoUsuario={currentUser?.tipo_usuario}
          currentUserName={currentUser?.name}
          prefill={{
            cedula: solicitudSeleccionada.datos.cedula,
            telefono: solicitudSeleccionada.datos.telefono,
            correo: solicitudSeleccionada.datos.correo,
            especialidadTexto: solicitudSeleccionada.datos.especialidad,
            fecha: solicitudSeleccionada.datos.fecha,
            hora: solicitudSeleccionada.datos.hora,
            seguro: solicitudSeleccionada.datos.seguro,
          }}
          onCitaCreada={idCita => void handleCitaConsultaCreada(solicitudSeleccionada, idCita)}
          enviarConfirmacionWhatsApp
        />
      )}

      <AlertDialog open={!!solicitudADescartar} onOpenChange={abierto => !abierto && setSolicitudADescartar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar esta solicitud?</AlertDialogTitle>
            <AlertDialogDescription>La solicitud dejará de aparecer como pendiente y no se creará una cita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={descartando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={evento => { evento.preventDefault(); void handleDescartar(); }} disabled={descartando} className="bg-red-600 hover:bg-red-700">
              {descartando ? 'Descartando...' : 'Descartar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
