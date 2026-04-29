import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { getInterconsultas, type FiltrosInterconsulta } from '../lib/interconsultaService';
import type { InterconsultaCompleta } from '../lib/supabaseTypes';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  Search,
  RefreshCw,
  Calendar,
  User,
  Printer,
} from 'lucide-react';
import logoClinicaAtlas from '../assets/535c4fa3c95ae864b14ba302621119ba18d73bbc.png';
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
import { GestionInterconsultaPanel } from './GestionInterconsultaPanel';

interface InterconsultasViewProps {
  currentUser?: {
    email: string;
    tipo_usuario?: string;
    name?: string;
  } | null;
}

const ORDEN_ESTADO: Record<string, number> = {
  PENDIENTE_AGENDAR: 0,
  AGENDADA: 1,
  RECHAZADA: 2,
  ATENDIDO: 3,
};

const DOT_ESTADO: Record<string, string> = {
  PENDIENTE_AGENDAR: '#ef4444',
  AGENDADA: '#f59e0b',
  RECHAZADA: '#6b7280',
  ATENDIDO: '#22c55e',
  pendiente: '#ef4444',
  en_proceso: '#f59e0b',
  cancelada: '#6b7280',
  atendida: '#22c55e',
};

const BADGE_ESTADO: Record<string, CSSProperties> = {
  PENDIENTE_AGENDAR: { backgroundColor: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' },
  AGENDADA: { backgroundColor: '#fef3c7', color: '#b45309', borderColor: '#fde68a' },
  RECHAZADA: { backgroundColor: '#f3f4f6', color: '#4b5563', borderColor: '#d1d5db' },
  ATENDIDO: { backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' },
  pendiente: { backgroundColor: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' },
  en_proceso: { backgroundColor: '#fef3c7', color: '#b45309', borderColor: '#fde68a' },
  cancelada: { backgroundColor: '#f3f4f6', color: '#4b5563', borderColor: '#d1d5db' },
  atendida: { backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' },
};

const LABEL_ESTADO: Record<string, string> = {
  PENDIENTE_AGENDAR: 'Pendiente Agendar',
  AGENDADA: 'Agendada',
  RECHAZADA: 'Rechazada',
  ATENDIDO: 'Atendida',
  pendiente: 'Pendiente Agendar',
  en_proceso: 'Agendada',
  cancelada: 'Rechazada',
  atendida: 'Atendida',
};

const escapeHtml = (value: string | number | null | undefined): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getNombrePaciente = (ic: InterconsultaCompleta): string => {
  if (!ic.paciente) return '';
  return `${ic.paciente.nombres ?? ic.paciente.nombre ?? ''} ${ic.paciente.apellidos ?? ic.paciente.apellido ?? ''}`.trim();
};

const getNombrePacienteInvertido = (ic: InterconsultaCompleta): string => {
  if (!ic.paciente) return '';
  return `${ic.paciente.apellidos ?? ic.paciente.apellido ?? ''} ${ic.paciente.nombres ?? ic.paciente.nombre ?? ''}`.trim();
};

export function InterconsultasView({ currentUser }: InterconsultasViewProps) {
  const tipoUsuario = currentUser?.tipo_usuario ?? '';
  const esMedico = tipoUsuario === 'medico';

  const [interconsultas, setInterconsultas] = useState<InterconsultaCompleta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [interconsultaSeleccionada, setInterconsultaSeleccionada] = useState<InterconsultaCompleta | null>(null);
  const [idUsuarioActual, setIdUsuarioActual] = useState<number | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  useEffect(() => {
    const userId = localStorage.getItem('currentUserId');
    if (userId) setIdUsuarioActual(parseInt(userId));
  }, []);

  const cargarInterconsultas = useCallback(async () => {
    setIsLoading(true);
    try {
      const filtros: FiltrosInterconsulta = {
        estado: filtroEstado as FiltrosInterconsulta['estado'],
        busquedaPaciente: busqueda || undefined,
        idUsuarioMedico: esMedico && idUsuarioActual ? idUsuarioActual : undefined,
      };
      const data = await getInterconsultas(filtros);
      // Ordenar por prioridad de estado
      data.sort((a, b) => (ORDEN_ESTADO[a.estado] ?? 99) - (ORDEN_ESTADO[b.estado] ?? 99));
      setInterconsultas(data);
      // Actualizar el panel si la interconsulta seleccionada cambió
      if (interconsultaSeleccionada) {
        const actualizada = data.find(i => i.id_interconsulta === interconsultaSeleccionada.id_interconsulta);
        setInterconsultaSeleccionada(actualizada ?? null);
      }
    } catch {
      toast.error('No se pudieron cargar las interconsultas');
    } finally {
      setIsLoading(false);
    }
  }, [filtroEstado, busqueda, esMedico, idUsuarioActual]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cargarInterconsultas();
  }, [cargarInterconsultas]);

  const getDestinoLabel = (ic: InterconsultaCompleta): string => {
    if (ic.tipo_destino === 'interno') {
      const medico = ic.usuario_destino ? `${ic.usuario_destino.apellido} ${ic.usuario_destino.nombre}` : '';
      const esp = ic.especialidad?.nombre ?? '';
      if (!medico) return esp || 'Interno';
      return esp ? `${medico} · ${esp}` : medico;
    }
    const medico = ic.medico_destino_externo ?? '';
    const esp = ic.especialidad_destino_texto ?? 'Externo';
    return medico ? `${medico} · ${esp}` : esp;
  };

  const handleImprimirInterconsulta = (ic: InterconsultaCompleta) => {
    const numeroInterconsulta = ic.numero_interconsulta ? String(ic.numero_interconsulta).padStart(7, '0') : '';
    const paciente = getNombrePaciente(ic) || 'PACIENTE SIN NOMBRE';
    const especialidadDestino = ic.tipo_destino === 'interno'
      ? ic.especialidad?.nombre || getDestinoLabel(ic) || ''
      : ic.especialidad_destino_texto || '';
    const fechaSolicitud = ic.created_at ? new Date(ic.created_at).toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES');

    const contenido = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; margin: 18px; color: #3f3f46; }
    .doc { border: 1px solid #e4e4e7; padding: 14px 18px 22px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #d4d4d8; padding-bottom: 10px; margin-bottom: 16px; }
    .titulo { font-style: italic; font-size: 42px; letter-spacing: 0.4px; color: #71717a; margin: 0; line-height: 1.05; }
    .numero { color: #3f3f46; font-size: 34px; margin-left: 14px; font-weight: 700; }
    .logo { width: 200px; object-fit: contain; }
    .fila { display: flex; gap: 16px; margin: 12px 0; }
    .campo { flex: 1; }
    .label { font-style: italic; font-size: 26px; color: #71717a; margin-right: 8px; }
    .linea { border-bottom: 1px solid #c4c4c7; min-height: 38px; padding: 4px 0 2px; font-size: 23px; color: #27272a; white-space: pre-wrap; }
    .linea.inline { display: inline-block; width: calc(100% - 165px); vertical-align: bottom; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .linea.corta { min-width: 170px; }
    .fila-datos { display: flex; gap: 16px; margin: 12px 0; }
    .campo-fecha { max-width: 320px; }
    @page { margin: 8mm; }
    @media print { body { margin: 0; } .doc { border: none; padding: 8px 10px; } }
  </style>
</head>
<body>
  <div class="doc">
    <div class="header">
      <div>
        <span class="titulo">INTERCONSULTA</span>
        ${numeroInterconsulta ? `<span class="numero">N° ${escapeHtml(numeroInterconsulta)}</span>` : ''}
      </div>
      <img src="${logoClinicaAtlas}" alt="Clinicas Atlas" class="logo" />
    </div>
    <div class="fila"><div class="campo"><span class="label">Nombre:</span><span class="linea inline">${escapeHtml(paciente)}</span></div></div>
    <div class="fila-datos"><div class="campo campo-fecha"><span class="label">Fecha:</span><span class="linea inline corta">${escapeHtml(fechaSolicitud)}</span></div></div>
    <div class="fila"><div class="campo"><span class="label">Especialidad destino:</span><div class="linea">${escapeHtml(especialidadDestino)}</div></div></div>
    <div class="fila"><div class="campo"><span class="label">Motivo:</span><div class="linea">${escapeHtml(ic.motivo)}</div></div></div>
    <div class="fila"><div class="campo"><span class="label">Resumen Clinico:</span><div class="linea">${escapeHtml(ic.resumen_clinico || '')}</div></div></div>
    <div class="fila">
      <div class="campo"><span class="label">Urgencia:</span><div class="linea">${escapeHtml(ic.urgencia === 'urgente' ? 'URGENTE' : 'NORMAL')}</div></div>
      <div class="campo"><span class="label">Estado:</span><div class="linea">${escapeHtml(LABEL_ESTADO[ic.estado] || ic.estado)}</div></div>
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) { toast.error('No se pudo abrir la ventana de impresión. Verifica el bloqueador de popups.'); return; }
    printWindow.document.open();
    printWindow.document.write(contenido);
    printWindow.document.close();
    const imprimir = () => { printWindow.focus(); printWindow.print(); };
    const logo = printWindow.document.querySelector('img.logo') as HTMLImageElement | null;
    if (logo && !logo.complete) { logo.onload = imprimir; logo.onerror = imprimir; return; }
    imprimir();
  };

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden">

      {/* Header + filtros */}
      <div className="flex-shrink-0 p-4 pb-3 space-y-3 border-b bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="size-5 text-purple-700" />
            <h1 className="text-xl font-semibold text-gray-900">Interconsultas</h1>
            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
              {interconsultas.length}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={cargarInterconsultas} disabled={isLoading}>
            <RefreshCw className={`size-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px] space-y-1">
            <Label className="text-xs text-gray-500">Buscar paciente</Label>
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
          <div className="w-44 space-y-1">
            <Label className="text-xs text-gray-500">Estado</Label>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="PENDIENTE_AGENDAR">
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                    Pendiente Agendar
                  </span>
                </SelectItem>
                <SelectItem value="AGENDADA">
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />
                    Agendada
                  </span>
                </SelectItem>
                <SelectItem value="RECHAZADA">
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
                    Rechazada
                  </span>
                </SelectItem>
                <SelectItem value="ATENDIDO">
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                    Atendida
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Leyenda de estados */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {(['PENDIENTE_AGENDAR', 'AGENDADA', 'RECHAZADA', 'ATENDIDO'] as const).map((key) => (
            <span key={key} className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DOT_ESTADO[key] }} />
              {LABEL_ESTADO[key]}
            </span>
          ))}
        </div>
      </div>

      {/* Cuerpo: lista + panel gestión */}
      <div className="flex flex-1 overflow-hidden">

        {/* Lista */}
        <div className={`flex flex-col overflow-hidden border-r bg-white transition-all ${interconsultaSeleccionada ? 'w-[55%]' : 'w-full'}`}>
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500 gap-2">
              <RefreshCw className="size-4 animate-spin" />
              Cargando...
            </div>
          ) : interconsultas.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-gray-400">
              <ArrowLeftRight className="size-8 opacity-30" />
              <p>No hay interconsultas con los filtros seleccionados</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-gray-50 text-xs text-gray-500 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                    <th className="px-3 py-2 text-left font-medium">Paciente</th>
                    <th className="px-3 py-2 text-left font-medium">Especialidad / Destino</th>
                    <th className="px-3 py-2 text-left font-medium">Fecha límite</th>
                    <th className="px-3 py-2 text-left font-medium w-16">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {interconsultas.map((ic) => {
                    const isSelected = interconsultaSeleccionada?.id_interconsulta === ic.id_interconsulta;
                    return (
                      <tr
                        key={ic.id_interconsulta}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-purple-50 border-l-2 border-purple-500' : 'hover:bg-gray-50'}`}
                        onClick={() => setInterconsultaSeleccionada(isSelected ? null : ic)}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: DOT_ESTADO[ic.estado] || '#9ca3af' }}
                            />
                            <Badge
                              variant="outline"
                              className="text-xs border"
                              style={BADGE_ESTADO[ic.estado] || BADGE_ESTADO.RECHAZADA}
                            >
                              {LABEL_ESTADO[ic.estado] || ic.estado}
                            </Badge>
                          </div>
                          {ic.urgencia === 'urgente' && (
                            <span className="text-xs text-red-600 font-medium ml-4">Urgente</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <User className="size-3 text-gray-400 flex-shrink-0" />
                            <span className="font-medium text-gray-800 text-xs">
                              {getNombrePacienteInvertido(ic) || '—'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 ml-4">{ic.paciente?.cedula}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-xs text-gray-700">{getDestinoLabel(ic)}</p>
                          <span className={`text-xs ${ic.tipo_destino === 'interno' ? 'text-blue-500' : 'text-orange-500'}`}>
                            {ic.tipo_destino === 'interno' ? 'Interno' : 'Externo'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">
                          {ic.fecha_limite ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="size-3 text-gray-400" />
                              {new Date(ic.fecha_limite + 'T00:00:00').toLocaleDateString('es-ES')}
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-purple-600 hover:bg-purple-50"
                            title="Imprimir interconsulta"
                            onClick={() => handleImprimirInterconsulta(ic)}
                          >
                            <Printer className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panel de gestión */}
        {interconsultaSeleccionada ? (
          <div className="w-[45%] flex flex-col overflow-hidden">
            <GestionInterconsultaPanel
              key={interconsultaSeleccionada.id_interconsulta}
              interconsulta={interconsultaSeleccionada}
              currentUser={currentUser ?? null}
              idUsuarioActual={idUsuarioActual}
              onActualizado={cargarInterconsultas}
              onCerrar={() => setInterconsultaSeleccionada(null)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
