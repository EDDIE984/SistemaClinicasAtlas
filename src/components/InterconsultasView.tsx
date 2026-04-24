import { useState, useEffect, useCallback } from 'react';
import { getInterconsultas, updateEstadoInterconsulta, type FiltrosInterconsulta } from '../lib/interconsultaService';
import type { InterconsultaCompleta } from '../lib/supabaseTypes';
import { AgendarCitaModalSupabase } from './AgendarCitaModalSupabase';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  Search,
  RefreshCw,
  Calendar,
  User,
  ChevronDown,
  Eye,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface InterconsultasViewProps {
  currentUser?: {
    email: string;
    tipo_usuario?: string;
  } | null;
}

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  pendiente:  { label: 'Pendiente',  className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  en_proceso: { label: 'En proceso', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  atendida:   { label: 'Atendida',   className: 'bg-green-100 text-green-800 border-green-200' },
  cancelada:  { label: 'Cancelada',  className: 'bg-red-100 text-red-800 border-red-200' },
};

export function InterconsultasView({ currentUser }: InterconsultasViewProps) {
  const tipoUsuario = currentUser?.tipo_usuario ?? '';
  const esMedico = tipoUsuario === 'medico';
  const esSecretariaOAdmin = tipoUsuario === 'secretaria' || tipoUsuario === 'administrativo';

  const [interconsultas, setInterconsultas] = useState<InterconsultaCompleta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [interconsultaDetalle, setInterconsultaDetalle] = useState<InterconsultaCompleta | null>(null);
  const [interconsultaParaCita, setInterconsultaParaCita] = useState<InterconsultaCompleta | null>(null);
  const [idUsuarioActual, setIdUsuarioActual] = useState<number | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroUrgencia, setFiltroUrgencia] = useState('todos');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');

  useEffect(() => {
    const userId = localStorage.getItem('currentUserId');
    if (userId) setIdUsuarioActual(parseInt(userId));
  }, []);

  const cargarInterconsultas = useCallback(async () => {
    setIsLoading(true);
    try {
      const filtros: FiltrosInterconsulta = {
        estado: filtroEstado as FiltrosInterconsulta['estado'],
        urgencia: filtroUrgencia as FiltrosInterconsulta['urgencia'],
        fechaDesde: filtroFechaDesde || undefined,
        fechaHasta: filtroFechaHasta || undefined,
        busquedaPaciente: busqueda || undefined,
        idUsuarioMedico: esMedico && idUsuarioActual ? idUsuarioActual : undefined,
      };
      const data = await getInterconsultas(filtros);
      setInterconsultas(data);
    } catch (error) {
      console.error('❌ Error al cargar interconsultas:', error);
      toast.error('No se pudieron cargar las interconsultas');
    } finally {
      setIsLoading(false);
    }
  }, [filtroEstado, filtroUrgencia, filtroFechaDesde, filtroFechaHasta, busqueda, esMedico, idUsuarioActual]);

  useEffect(() => {
    cargarInterconsultas();
  }, [cargarInterconsultas]);

  const handleCambiarEstado = async (ic: InterconsultaCompleta, nuevoEstado: InterconsultaCompleta['estado']) => {
    const ok = await updateEstadoInterconsulta(ic.id_interconsulta, nuevoEstado);
    if (ok) {
      toast.success('Estado actualizado');
      setInterconsultas((prev) =>
        prev.map((i) => (i.id_interconsulta === ic.id_interconsulta ? { ...i, estado: nuevoEstado } : i))
      );
      if (interconsultaDetalle?.id_interconsulta === ic.id_interconsulta) {
        setInterconsultaDetalle({ ...interconsultaDetalle, estado: nuevoEstado });
      }
    } else {
      toast.error('No se pudo actualizar el estado');
    }
  };

  const puedeModificarEstado = (ic: InterconsultaCompleta): boolean => {
    if (esSecretariaOAdmin) return ic.estado !== 'atendida';
    if (esMedico) return ic.id_usuario_destino === idUsuarioActual && ic.estado !== 'cancelada' && ic.estado !== 'atendida';
    return false;
  };

  const estadosDisponibles = (ic: InterconsultaCompleta): InterconsultaCompleta['estado'][] => {
    const todos: InterconsultaCompleta['estado'][] = ['pendiente', 'en_proceso', 'atendida', 'cancelada'];
    return todos.filter((e) => e !== ic.estado);
  };

  const getDestinoLabel = (ic: InterconsultaCompleta): string => {
    if (ic.tipo_destino === 'interno') {
      const medico = ic.usuario_destino ? `${ic.usuario_destino.apellido} ${ic.usuario_destino.nombre}` : '—';
      const esp = ic.especialidad?.nombre ?? '';
      return esp ? `${medico} · ${esp}` : medico;
    }
    const medico = ic.medico_destino_externo ?? '';
    const esp = ic.especialidad_destino_texto ?? 'Externo';
    return medico ? `${medico} · ${esp}` : esp;
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="size-5 text-purple-700" />
          <h1 className="text-xl font-semibold text-gray-900">Interconsultas</h1>
          <Badge className="bg-purple-100 text-purple-800 border-purple-200">
            {interconsultas.length}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={cargarInterconsultas} disabled={isLoading}>
          <RefreshCw className={`size-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="rounded-lg border bg-white p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {/* Búsqueda */}
          <div className="col-span-2 md:col-span-1 space-y-1">
            <Label className="text-xs text-gray-600">Buscar paciente</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o cédula..."
                className="pl-7 text-sm h-8"
              />
            </div>
          </div>

          {/* Estado */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Estado</Label>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_proceso">En proceso</SelectItem>
                <SelectItem value="atendida">Atendida</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Urgencia */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Urgencia</Label>
            <Select value={filtroUrgencia} onValueChange={setFiltroUrgencia}>
              <SelectTrigger className="text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fechas */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Desde</Label>
            <Input
              type="date"
              value={filtroFechaDesde}
              onChange={(e) => setFiltroFechaDesde(e.target.value)}
              className="text-sm h-8"
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto rounded-lg border bg-white shadow-sm">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-500">
            <RefreshCw className="size-4 mr-2 animate-spin" />
            Cargando interconsultas...
          </div>
        ) : interconsultas.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-gray-400">
            <ArrowLeftRight className="size-8 opacity-30" />
            <p>No hay interconsultas con los filtros seleccionados</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Paciente</th>
                <th className="px-3 py-2 text-left font-medium">Solicitante</th>
                <th className="px-3 py-2 text-left font-medium">Destino</th>
                <th className="px-3 py-2 text-left font-medium">Urgencia</th>
                <th className="px-3 py-2 text-left font-medium">Fecha límite</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-left font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {interconsultas.map((ic) => {
                const cfg = ESTADO_CONFIG[ic.estado];
                return (
                  <tr key={ic.id_interconsulta} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <User className="size-3 text-gray-400" />
                        <span className="font-medium text-gray-800">
                          {ic.paciente ? `${ic.paciente.apellido} ${ic.paciente.nombre}` : '—'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{ic.paciente?.cedula}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {ic.usuario_solicitante
                        ? `${ic.usuario_solicitante.apellido} ${ic.usuario_solicitante.nombre}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      <div>{getDestinoLabel(ic)}</div>
                      <span className={`text-xs ${ic.tipo_destino === 'interno' ? 'text-blue-500' : 'text-orange-500'}`}>
                        {ic.tipo_destino === 'interno' ? 'Interno' : 'Externo'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {ic.urgencia === 'urgente' ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">URGENTE</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Normal</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {ic.fecha_limite ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3 text-gray-400" />
                          {new Date(ic.fecha_limite + 'T00:00:00').toLocaleDateString('es-ES')}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={`border text-xs ${cfg.className}`}>{cfg.label}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {/* Ver detalle */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setInterconsultaDetalle(ic)}
                        >
                          <Eye className="size-3 mr-1" />
                          Ver
                        </Button>

                        {/* Convertir a cita — secretaria/admin, internos pendientes o en_proceso */}
                        {esSecretariaOAdmin && ic.tipo_destino === 'interno' && (ic.estado === 'pendiente' || ic.estado === 'en_proceso') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                            onClick={() => setInterconsultaParaCita(ic)}
                          >
                            <Calendar className="size-3 mr-1" />
                            Agendar
                          </Button>
                        )}

                        {/* Cambiar estado */}
                        {puedeModificarEstado(ic) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                <ChevronDown className="size-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {estadosDisponibles(ic).map((estado) => (
                                <DropdownMenuItem
                                  key={estado}
                                  onClick={() => handleCambiarEstado(ic, estado)}
                                  className="text-sm"
                                >
                                  Marcar: {ESTADO_CONFIG[estado].label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialog de detalle */}
      <Dialog open={!!interconsultaDetalle} onOpenChange={(open) => { if (!open) setInterconsultaDetalle(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="size-4 text-purple-700" />
              Detalle de interconsulta
            </DialogTitle>
          </DialogHeader>
          {interconsultaDetalle && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Paciente</p>
                  <p className="font-medium">
                    {interconsultaDetalle.paciente
                      ? `${interconsultaDetalle.paciente.apellido} ${interconsultaDetalle.paciente.nombre}`
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-400">{interconsultaDetalle.paciente?.cedula}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Solicitante</p>
                  <p className="font-medium">
                    {interconsultaDetalle.usuario_solicitante
                      ? `${interconsultaDetalle.usuario_solicitante.apellido} ${interconsultaDetalle.usuario_solicitante.nombre}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Destino</p>
                  <p className="font-medium">{getDestinoLabel(interconsultaDetalle)}</p>
                  <span className={`text-xs ${interconsultaDetalle.tipo_destino === 'interno' ? 'text-blue-500' : 'text-orange-500'}`}>
                    {interconsultaDetalle.tipo_destino === 'interno' ? 'Interno' : 'Externo'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Estado</p>
                  <Badge className={`border text-xs mt-0.5 ${ESTADO_CONFIG[interconsultaDetalle.estado].className}`}>
                    {ESTADO_CONFIG[interconsultaDetalle.estado].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Urgencia</p>
                  <p className={interconsultaDetalle.urgencia === 'urgente' ? 'font-medium text-red-700' : 'text-gray-600'}>
                    {interconsultaDetalle.urgencia === 'urgente' ? 'URGENTE' : 'Normal'}
                  </p>
                </div>
                {interconsultaDetalle.fecha_limite && (
                  <div>
                    <p className="text-xs text-gray-500">Fecha límite</p>
                    <p className="text-gray-700">
                      {new Date(interconsultaDetalle.fecha_limite + 'T00:00:00').toLocaleDateString('es-ES')}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Motivo</p>
                <p className="text-gray-700 rounded bg-gray-50 p-2 text-sm">{interconsultaDetalle.motivo}</p>
              </div>
              {interconsultaDetalle.resumen_clinico && (
                <div>
                  <p className="text-xs text-gray-500">Resumen clínico</p>
                  <p className="text-gray-700 rounded bg-gray-50 p-2 text-sm">{interconsultaDetalle.resumen_clinico}</p>
                </div>
              )}
              <p className="text-xs text-gray-400">
                Registrada: {new Date(interconsultaDetalle.created_at).toLocaleString('es-ES')}
              </p>

              {/* Acciones desde detalle */}
              {puedeModificarEstado(interconsultaDetalle) && (
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {estadosDisponibles(interconsultaDetalle).map((estado) => (
                    <Button
                      key={estado}
                      variant="outline"
                      size="sm"
                      onClick={() => handleCambiarEstado(interconsultaDetalle, estado)}
                      className="text-xs h-7"
                    >
                      Marcar: {ESTADO_CONFIG[estado].label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal agendar cita para interconsulta interna */}
      {interconsultaParaCita && (
        <AgendarCitaModalSupabase
          isOpen={!!interconsultaParaCita}
          onClose={() => setInterconsultaParaCita(null)}
          onCitaAgendada={async () => {
            toast.success('Cita agendada. Actualizando interconsulta...');
            await handleCambiarEstado(interconsultaParaCita, 'en_proceso');
            setInterconsultaParaCita(null);
          }}
          idUsuarioActual={idUsuarioActual}
          tipoUsuario={tipoUsuario}
        />
      )}
    </div>
  );
}
