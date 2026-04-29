import { useState, useEffect, type CSSProperties } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { X, Stethoscope, MessageCircle, Calendar, XCircle, User, ClipboardList, AlertTriangle, Save } from 'lucide-react';
import type { InterconsultaCompleta } from '../lib/supabaseTypes';
import { asignarCitaInterconsulta, rechazarInterconsulta, updateInterconsultaGestion } from '../lib/interconsultaService';
import { getMedicosBySucursal, type AsignacionCompleta } from '../lib/authService';
import { useHorarios } from '../hooks/useCitas';
import { createCita, generarHorariosDisponibles, updateCita } from '../lib/citasService';

interface GestionInterconsultaPanelProps {
  interconsulta: InterconsultaCompleta;
  currentUser: { email: string; tipo_usuario?: string; name?: string } | null;
  idUsuarioActual: number | null;
  onActualizado: () => void;
  onCerrar: () => void;
}

const COLOR_ESTADO: Record<string, CSSProperties> = {
  PENDIENTE_AGENDAR: { backgroundColor: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' },
  AGENDADA: { backgroundColor: '#fef3c7', color: '#b45309', borderColor: '#fde68a' },
  RECHAZADA: { backgroundColor: '#f3f4f6', color: '#4b5563', borderColor: '#d1d5db' },
  ATENDIDO: { backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' },
  pendiente: { backgroundColor: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' },
  en_proceso: { backgroundColor: '#fef3c7', color: '#b45309', borderColor: '#fde68a' },
  cancelada: { backgroundColor: '#f3f4f6', color: '#4b5563', borderColor: '#d1d5db' },
  atendida: { backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' },
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

const getNombrePaciente = (interconsulta: InterconsultaCompleta): string => {
  if (!interconsulta.paciente) return 'Paciente';
  return `${interconsulta.paciente.nombres ?? interconsulta.paciente.nombre ?? ''} ${interconsulta.paciente.apellidos ?? interconsulta.paciente.apellido ?? ''}`.trim() || 'Paciente';
};

export function GestionInterconsultaPanel({ interconsulta, currentUser, idUsuarioActual, onActualizado, onCerrar }: GestionInterconsultaPanelProps) {
  const [medicos, setMedicos] = useState<AsignacionCompleta[]>([]);
  const [selectedMedicoUsId, setSelectedMedicoUsId] = useState<string>('');
  const [observaciones, setObservaciones] = useState(interconsulta.observaciones_gestor || '');
  const [telefonoPaciente, setTelefonoPaciente] = useState(interconsulta.paciente?.telefono || '');
  const [mensajePaciente, setMensajePaciente] = useState('');
  const [telefonoMedico, setTelefonoMedico] = useState(interconsulta.usuario_destino?.telefono || '');
  const [mensajeMedico, setMensajeMedico] = useState('');
  const [isSendingWAPaciente, setIsSendingWAPaciente] = useState(false);
  const [isSendingWAMedico, setIsSendingWAMedico] = useState(false);
  const [confirmRechazar, setConfirmRechazar] = useState(false);
  const [isRechazando, setIsRechazando] = useState(false);
  const [isGuardandoGestion, setIsGuardandoGestion] = useState(false);
  const [accionFinalizada, setAccionFinalizada] = useState(false);
  const [fechaCita, setFechaCita] = useState('');
  const [horaInicioCita, setHoraInicioCita] = useState('');
  const [citasDelDia, setCitasDelDia] = useState<any[]>([]);

  const nombrePaciente = getNombrePaciente(interconsulta);
  const selectedMedico = selectedMedicoUsId
    ? medicos.find((m) => String(m.id_usuario_sucursal) === selectedMedicoUsId) ?? null
    : null;
  const idUsuarioSucursalSeleccionado = selectedMedicoUsId ? parseInt(selectedMedicoUsId) : null;
  const { diasSemana, precio, isLoading: isLoadingHorarios, verificarDisponibilidadHorario, getCitasDelDia } = useHorarios(
    idUsuarioSucursalSeleccionado,
    selectedMedico?.cargo,
    selectedMedico?.sucursal.id_compania
  );
  const nombreMedico = interconsulta.usuario_destino
    ? `Dr./Dra. ${interconsulta.usuario_destino.nombre} ${interconsulta.usuario_destino.apellido}`
    : '';
  const nombreMedicoSeleccionado = selectedMedico?.usuario
    ? `Dr./Dra. ${selectedMedico.usuario.nombre} ${selectedMedico.usuario.apellido}`
    : nombreMedico;
  const especialidad = interconsulta.especialidad?.nombre || interconsulta.especialidad_destino_texto || '';
  const especialidadMedicoSeleccionado = selectedMedico?.especialidad && selectedMedico.especialidad !== 'Sin especialidad'
    ? selectedMedico.especialidad
    : especialidad;
  const medicoSolicitante = interconsulta.usuario_solicitante
    ? `Dr./Dra. ${interconsulta.usuario_solicitante.nombre} ${interconsulta.usuario_solicitante.apellido}`
    : 'No registrado';
  const fechaSolicitud = interconsulta.created_at
    ? new Date(interconsulta.created_at).toLocaleString('es-ES')
    : 'No registrada';
  const destinoSolicitado = especialidad || (
    interconsulta.tipo_destino === 'externo'
      ? interconsulta.medico_destino_externo || 'Destino externo'
      : 'Especialidad no registrada'
  );
  const tipoDestino = interconsulta.tipo_destino === 'interno' ? 'Interno' : 'Externo';
  const esPendienteAgendar = interconsulta.estado === 'PENDIENTE_AGENDAR' || interconsulta.estado === 'pendiente';
  const esRechazada = interconsulta.estado === 'RECHAZADA' || interconsulta.estado === 'cancelada';
  const esAtendida = interconsulta.estado === 'ATENDIDO' || interconsulta.estado === 'atendida';
  const puedeAgendar = interconsulta.tipo_destino === 'interno' && (esPendienteAgendar || !interconsulta.id_cita_generada);
  const puedeModificarCita = interconsulta.tipo_destino === 'interno' && Boolean(interconsulta.id_cita_generada);
  const puedeGestionarCita = puedeAgendar || puedeModificarCita;
  const puedeRechazar = !esRechazada && !esAtendida;

  useEffect(() => {
    setAccionFinalizada(false);
    setConfirmRechazar(false);
  }, [interconsulta.id_interconsulta]);

  // Cargar médicos de la sucursal actual, filtrados por especialidad
  useEffect(() => {
    const cargarMedicos = async () => {
      const sucursalId = parseInt(localStorage.getItem('currentSucursalId') || '0');
      if (!sucursalId) return;
      const lista = await getMedicosBySucursal(sucursalId);
      const filtrados = interconsulta.id_especialidad_destino
        ? lista.filter(m => m.id_especialidad === interconsulta.id_especialidad_destino)
        : lista;
      setMedicos(filtrados);
      // Pre-seleccionar si ya tiene médico asignado
      if (interconsulta.id_usuario_destino) {
        const asig = filtrados.find(m => m.id_usuario === interconsulta.id_usuario_destino);
        if (asig) setSelectedMedicoUsId(String(asig.id_usuario_sucursal));
      }
    };
    if (interconsulta.tipo_destino === 'interno') cargarMedicos();
  }, [interconsulta.id_especialidad_destino, interconsulta.id_usuario_destino, interconsulta.tipo_destino]);

  useEffect(() => {
    const cargarCitasDia = async () => {
      if (!fechaCita || !selectedMedicoUsId) {
        setCitasDelDia([]);
        return;
      }
      const citas = await getCitasDelDia(fechaCita);
      setCitasDelDia(citas);
    };

    cargarCitasDia();
  }, [fechaCita, selectedMedicoUsId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generar mensajes por defecto
  useEffect(() => {
    const num = interconsulta.numero_interconsulta;
    const esp = especialidadMedicoSeleccionado || especialidad;
    const fechaLimite = interconsulta.fecha_limite || '';
    const doctorNombre = nombreMedicoSeleccionado || esp;
    const fechaAgendada = fechaCita
      ? new Date(`${fechaCita}T00:00:00`).toLocaleDateString('es-ES')
      : '';
    const horaFin = horaInicioCita
      ? (() => {
          const diaConfig = diasSemana.find((d) => {
            if (!fechaCita) return false;
            const fecha = new Date(`${fechaCita}T00:00:00`);
            const diaSemanaNumero = fecha.getDay();
            return d.dia_semana === diaSemanaNumero;
          });
          const duracion = diaConfig?.duracion_consulta || 30;
          const [horas, minutos] = horaInicioCita.split(':').map(Number);
          const totalMinutos = horas * 60 + minutos + duracion;
          return `${Math.floor(totalMinutos / 60).toString().padStart(2, '0')}:${(totalMinutos % 60).toString().padStart(2, '0')}`;
        })()
      : '';
    const horarioAgendado = horaInicioCita ? `${horaInicioCita}${horaFin ? ` - ${horaFin}` : ''}` : '';
    const detalleAgenda = fechaAgendada && horarioAgendado
      ? ` para el ${fechaAgendada} en el horario ${horarioAgendado}`
      : fechaAgendada
        ? ` para el ${fechaAgendada}`
        : '';

    setMensajePaciente(
      `Estimado/a ${nombrePaciente}, le informamos que Clínicas Atlas ha generado una interconsulta #${num}${esp ? ` para la especialidad de ${esp}` : ''}${doctorNombre ? ` con ${doctorNombre}` : ''}${detalleAgenda}.${fechaLimite && !fechaAgendada ? ` Esta interconsulta debe ser gestionada antes del ${fechaLimite}.` : ''} Por favor acercarse a Clínicas Atlas en la fecha y hora indicadas.`
    );
    setMensajeMedico(
      `${nombreMedico || 'Estimado/a Dr./Dra.'}, tiene una interconsulta #${num} asignada. Paciente: ${nombrePaciente}. Especialidad: ${esp}. Motivo: ${interconsulta.motivo}${fechaLimite ? `. Fecha límite: ${fechaLimite}` : ''}. Clínica Atlas.`
    );
  }, [interconsulta, nombrePaciente, nombreMedico, nombreMedicoSeleccionado, especialidad, especialidadMedicoSeleccionado, fechaCita, horaInicioCita, diasSemana]);

  const getEspecialidadMedico = (medico: AsignacionCompleta): string => {
    if (medico.especialidad && medico.especialidad !== 'Sin especialidad') return medico.especialidad;
    if (medico.id_especialidad && medico.id_especialidad === interconsulta.id_especialidad_destino && especialidad) return especialidad;
    return 'Sin especialidad';
  };

  const calcularHoraFin = (inicio: string, duracionMinutos: number): string => {
    if (!inicio) return '';
    const [horas, minutos] = inicio.split(':').map(Number);
    const totalMinutos = horas * 60 + minutos + duracionMinutos;
    const horasFin = Math.floor(totalMinutos / 60);
    const minutosFin = totalMinutos % 60;
    return `${horasFin.toString().padStart(2, '0')}:${minutosFin.toString().padStart(2, '0')}`;
  };

  const getDiaConfig = () => {
    if (!fechaCita) return null;
    const fecha = new Date(`${fechaCita}T00:00:00`);
    const diaSemanaNumero = fecha.getDay();
    return diasSemana.find((d) =>
      d.dia_semana === diaSemanaNumero &&
      (!d.fecha_inicio || fechaCita >= d.fecha_inicio) &&
      (!d.fecha_fin || fechaCita <= d.fecha_fin)
    ) ?? null;
  };

  const isDiaDisponible = () => Boolean(getDiaConfig());

  const getHorariosDisponibles = () => {
    const diaConfig = getDiaConfig();
    if (!diaConfig) return [];

    const duracionConsulta = diaConfig.duracion_consulta || 30;
    const horariosBase = generarHorariosDisponibles(diaConfig.hora_inicio, diaConfig.hora_fin, duracionConsulta);

    return horariosBase.filter((horaInicio) => {
      const horaFin = calcularHoraFin(horaInicio, duracionConsulta);
      const conflicto = citasDelDia.some((cita) => {
        if (interconsulta.id_cita_generada && cita.id_cita === interconsulta.id_cita_generada) {
          return false;
        }

        const citaInicio = cita.hora_inicio.substring(0, 5);
        const citaFin = cita.hora_fin.substring(0, 5);

        return (
          (horaInicio >= citaInicio && horaInicio < citaFin) ||
          (horaFin > citaInicio && horaFin <= citaFin) ||
          (horaInicio <= citaInicio && horaFin >= citaFin)
        );
      });

      return !conflicto;
    });
  };

  const getDuracionConfigurada = () => getDiaConfig()?.duracion_consulta || 30;
  const horariosDisponibles = getHorariosDisponibles();

  const validarGestionCita = () => {
    if (!selectedMedico) {
      toast.error('Seleccione el médico que atenderá la interconsulta');
      return false;
    }
    if (!fechaCita) {
      toast.error('Seleccione la fecha de la cita');
      return false;
    }
    if (!horaInicioCita) {
      toast.error('Seleccione el horario de la cita');
      return false;
    }
    const diaConfig = getDiaConfig();
    if (!diaConfig) {
      toast.error('El médico no tiene horario configurado para la fecha seleccionada');
      return false;
    }
    if (!diaConfig.id_consultorio) {
      toast.error('No hay consultorio asignado para el horario seleccionado');
      return false;
    }
    if (!interconsulta.id_paciente) {
      toast.error('La interconsulta no tiene paciente asociado');
      return false;
    }
    return true;
  };

  const handleGuardarOActualizarCita = async () => {
    if (accionFinalizada || isGuardandoGestion) return;
    if (!validarGestionCita() || !selectedMedico) return;

    const diaConfig = getDiaConfig();
    if (!diaConfig) return;

    const duracion = diaConfig.duracion_consulta || 30;
    const horaFin = calcularHoraFin(horaInicioCita, duracion);

    setIsGuardandoGestion(true);
    try {
      const disponible = await verificarDisponibilidadHorario(
        fechaCita,
        horaInicioCita,
        horaFin,
        interconsulta.id_cita_generada || undefined
      );

      if (!disponible) {
        toast.error('El horario seleccionado ya no está disponible');
        setIsGuardandoGestion(false);
        return;
      }

      const interconsultaActualizada = await updateInterconsultaGestion(interconsulta.id_interconsulta, {
        id_usuario_destino: selectedMedico.id_usuario,
        observaciones_gestor: observaciones || null,
      });

      if (!interconsultaActualizada) {
        toast.error('No se pudo guardar la gestión de la interconsulta');
        setIsGuardandoGestion(false);
        return;
      }

      const citaData = {
        id_paciente: interconsulta.id_paciente,
        id_usuario_sucursal: selectedMedico.id_usuario_sucursal,
        id_especialidad: interconsulta.id_especialidad_destino || selectedMedico.id_especialidad || 2,
        id_sucursal: selectedMedico.id_sucursal,
        id_consultorio: diaConfig.id_consultorio,
        fecha_cita: fechaCita,
        hora_inicio: horaInicioCita,
        hora_fin: horaFin,
        duracion_minutos: duracion,
        tipo_cita: 'consulta' as const,
        motivo_consulta: `Interconsulta #${interconsulta.numero_interconsulta}: ${interconsulta.motivo}`,
        estado_cita: 'agendada' as const,
        precio_cita: precio,
        id_aseguradora: 1,
        referencia: `Interconsulta #${interconsulta.numero_interconsulta}`,
        id_interconsulta: interconsulta.id_interconsulta,
      };

      if (interconsulta.id_cita_generada) {
        const ok = await updateCita(interconsulta.id_cita_generada, citaData);
        if (!ok) {
          toast.error('No se pudo modificar la cita de interconsulta');
          setIsGuardandoGestion(false);
          return;
        }
        toast.success('Cita de interconsulta modificada correctamente');
      } else {
        const nuevaCita = await createCita(citaData);
        if (!nuevaCita) {
          toast.error('No se pudo agendar la cita de interconsulta');
          setIsGuardandoGestion(false);
          return;
        }
        await asignarCitaInterconsulta(interconsulta.id_interconsulta, nuevaCita.id_cita);
        toast.success('Interconsulta agendada correctamente');
      }

      setAccionFinalizada(true);
      onActualizado();
    } catch (error) {
      console.error('❌ Error al gestionar cita de interconsulta:', error);
      toast.error('Error al gestionar la cita de interconsulta');
    } finally {
      setIsGuardandoGestion(false);
    }
  };

  const enviarWhatsApp = async (
    telefono: string,
    mensaje: string,
    setSending: (v: boolean) => void
  ) => {
    if (!telefono.trim()) { toast.error('Ingrese un número de teléfono'); return; }
    if (!mensaje.trim()) { toast.error('Ingrese un mensaje'); return; }
    setSending(true);
    try {
      const numero = telefono.startsWith('+') ? telefono : `+593${telefono.replace(/^0/, '')}`;
      const res = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: numero, text: mensaje }),
      });
      if (res.ok) toast.success('Mensaje enviado por WhatsApp');
      else {
        const err = await res.json().catch(() => ({}));
        toast.error(`Error al enviar: ${err.error || res.statusText}`);
      }
    } catch {
      toast.error('Error de conexión al enviar WhatsApp');
    } finally {
      setSending(false);
    }
  };

  const handleRechazar = async () => {
    if (accionFinalizada || isRechazando) return;
    setIsRechazando(true);
    const ok = await rechazarInterconsulta(interconsulta.id_interconsulta);
    setIsRechazando(false);
    if (ok) { setAccionFinalizada(true); toast.success('Interconsulta rechazada'); onActualizado(); setConfirmRechazar(false); }
    else toast.error('Error al rechazar interconsulta');
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-start justify-between p-4 border-b bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: DOT_ESTADO[interconsulta.estado] || '#9ca3af' }}
            />
            <Badge
              variant="outline"
              className="text-xs border"
              style={COLOR_ESTADO[interconsulta.estado] || COLOR_ESTADO.RECHAZADA}
            >
              {LABEL_ESTADO[interconsulta.estado] || interconsulta.estado}
            </Badge>
            <span className="text-xs text-gray-400 font-mono">#{interconsulta.numero_interconsulta}</span>
          </div>
          <p className="font-semibold text-gray-900 text-sm truncate">{nombrePaciente}</p>
          <p className="text-xs text-gray-500">{especialidad || (interconsulta.tipo_destino === 'externo' ? `Externo: ${interconsulta.medico_destino_externo || ''}` : '')}</p>
          {interconsulta.urgencia === 'urgente' && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium mt-0.5">
              <AlertTriangle className="size-3" /> Urgente
            </span>
          )}
        </div>
        <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0">
          <X className="size-4" />
        </button>
      </div>

      {/* Cuerpo scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Solicitud médica */}
        <div className="space-y-3 rounded-lg border border-purple-100 bg-purple-50/60 p-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="size-4 text-purple-700" />
            <h3 className="text-sm font-semibold text-purple-950">Solicitud médica</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-purple-700 font-medium">Médico solicitante</p>
              <p className="text-gray-900">{medicoSolicitante}</p>
            </div>
            <div>
              <p className="text-purple-700 font-medium">Fecha de solicitud</p>
              <p className="text-gray-900">{fechaSolicitud}</p>
            </div>
            <div>
              <p className="text-purple-700 font-medium">Especialidad requerida</p>
              <p className="text-gray-900 font-semibold">{destinoSolicitado}</p>
            </div>
            <div>
              <p className="text-purple-700 font-medium">Tipo / urgencia</p>
              <p className="text-gray-900">
                {tipoDestino} · {interconsulta.urgencia === 'urgente' ? 'Urgente' : 'Normal'}
              </p>
            </div>
            {interconsulta.fecha_limite && (
              <div className="col-span-2">
                <p className="text-purple-700 font-medium">Fecha límite</p>
                <p className="text-gray-900">{interconsulta.fecha_limite}</p>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-purple-100 pt-3 text-xs">
            <div>
              <p className="text-purple-700 font-medium">Motivo indicado por el médico</p>
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-white p-2 text-gray-900 border border-purple-100">
                {interconsulta.motivo || 'Sin motivo registrado'}
              </p>
            </div>
            <div>
              <p className="text-purple-700 font-medium">Resumen clínico indicado por el médico</p>
              <p className="mt-1 min-h-10 whitespace-pre-wrap rounded-md bg-white p-2 text-gray-900 border border-purple-100">
                {interconsulta.resumen_clinico || 'Sin resumen clínico registrado'}
              </p>
            </div>
          </div>
        </div>

        {/* Asignación de médico */}
        {interconsulta.tipo_destino === 'interno' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="size-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-800">Asignar Médico</h3>
            </div>
            <Select
              value={selectedMedicoUsId}
              onValueChange={(value) => {
                setSelectedMedicoUsId(value);
                setFechaCita('');
                setHoraInicioCita('');
                setCitasDelDia([]);
              }}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={medicos.length === 0 ? 'Sin médicos disponibles para esta especialidad' : 'Seleccionar médico...'} />
              </SelectTrigger>
              <SelectContent>
                {medicos.map(m => (
                  <SelectItem key={m.id_usuario_sucursal} value={String(m.id_usuario_sucursal)}>
                    Dr. {m.usuario?.nombre} {m.usuario?.apellido} — {getEspecialidadMedico(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedMedicoUsId && (
              <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-purple-600" />
                  <h4 className="text-sm font-semibold text-gray-800">Disponibilidad del médico</h4>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-gray-600">Fecha</Label>
                  <Input
                    type="date"
                    value={fechaCita}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      setFechaCita(e.target.value);
                      setHoraInicioCita('');
                    }}
                    className="text-sm bg-white"
                  />
                  {fechaCita && !isLoadingHorarios && !isDiaDisponible() && (
                    <p className="text-xs text-red-600">
                      El doctor seleccionado no tiene horarios configurados para este día.
                    </p>
                  )}
                </div>

                {fechaCita && isDiaDisponible() && (
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-600">Horario disponible</Label>
                    <Select
                      value={horaInicioCita}
                      onValueChange={setHoraInicioCita}
                      disabled={horariosDisponibles.length === 0}
                    >
                      <SelectTrigger className="text-sm bg-white">
                        <SelectValue placeholder={horariosDisponibles.length === 0 ? 'Sin horarios disponibles' : 'Seleccione hora'} />
                      </SelectTrigger>
                      <SelectContent>
                        {horariosDisponibles.map((hora) => {
                          const duracion = getDuracionConfigurada();
                          return (
                            <SelectItem key={hora} value={hora}>
                              {hora} - {calcularHoraFin(hora, duracion)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {horariosDisponibles.length === 0 && (
                      <p className="text-xs text-amber-700">
                        No hay horarios libres para la fecha seleccionada.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Observaciones del gestor */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-800">Observaciones del Gestor</h3>
          </div>
          <Textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            placeholder="Agregar observaciones de gestión..."
            className="text-sm min-h-[80px] resize-none"
          />
        </div>

        {/* WhatsApp al paciente */}
        <div className="space-y-2 border border-green-100 rounded-lg p-3 bg-green-50">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-800">WhatsApp al Paciente</h3>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Número de teléfono</Label>
            <Input
              value={telefonoPaciente}
              onChange={e => setTelefonoPaciente(e.target.value)}
              placeholder="+593999999999 ó 0999999999"
              className="text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Mensaje</Label>
            <Textarea
              value={mensajePaciente}
              onChange={e => setMensajePaciente(e.target.value)}
              className="text-sm mt-1 min-h-[80px] resize-none"
            />
          </div>
        </div>

        {/* WhatsApp al médico */}
        {interconsulta.usuario_destino && (
          <div className="space-y-2 border border-blue-100 rounded-lg p-3 bg-blue-50">
            <div className="flex items-center gap-2">
              <Stethoscope className="size-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-800">WhatsApp al Médico</h3>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Número del médico</Label>
              <Input
                value={telefonoMedico}
                onChange={e => setTelefonoMedico(e.target.value)}
                placeholder="+593999999999 ó 0999999999"
                className="text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Mensaje</Label>
              <Textarea
                value={mensajeMedico}
                onChange={e => setMensajeMedico(e.target.value)}
                className="text-sm mt-1 min-h-[80px] resize-none"
              />
            </div>
            <Button
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => enviarWhatsApp(telefonoMedico, mensajeMedico, setIsSendingWAMedico)}
              disabled={isSendingWAMedico}
            >
              <MessageCircle className="size-3 mr-2" />
              {isSendingWAMedico ? 'Enviando...' : 'Enviar WhatsApp al médico'}
            </Button>
          </div>
        )}

      </div>

      <div className="relative z-20 flex-shrink-0 space-y-2 border-t bg-white p-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
        {puedeGestionarCita && (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-purple-200 bg-white text-purple-700 hover:bg-purple-50 hover:text-purple-800"
            onClick={handleGuardarOActualizarCita}
            disabled={accionFinalizada || isGuardandoGestion || !selectedMedicoUsId || !fechaCita || !horaInicioCita}
          >
            <Save className="size-3.5 mr-2 text-purple-700" />
            {accionFinalizada
              ? 'Guardado'
              : isGuardandoGestion
              ? 'Guardando...'
              : interconsulta.id_cita_generada
                ? 'Modificar cita'
                : 'Guardar y agendar cita'}
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="w-full border-green-200 bg-white text-green-700 hover:bg-green-50 hover:text-green-800"
          onClick={() => enviarWhatsApp(telefonoPaciente, mensajePaciente, setIsSendingWAPaciente)}
          disabled={isSendingWAPaciente || !telefonoPaciente.trim() || !mensajePaciente.trim()}
        >
          <MessageCircle className="size-3.5 mr-2 text-green-700" />
          {isSendingWAPaciente ? 'Enviando...' : 'Enviar WhatsApp al paciente'}
        </Button>

        {puedeGestionarCita && (!selectedMedicoUsId || !fechaCita || !horaInicioCita) && (
          <p className="text-xs text-gray-500">
            Seleccione médico, fecha y horario para habilitar el guardado.
          </p>
        )}

        {puedeRechazar && (
          !confirmRechazar ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setConfirmRechazar(true)}
              disabled={accionFinalizada || isRechazando}
            >
              <XCircle className="size-3.5 mr-2 text-red-600" />
              {accionFinalizada ? 'Acción completada' : 'Rechazar interconsulta'}
            </Button>
          ) : (
            <div className="space-y-2 rounded-md border border-red-100 bg-red-50 p-2">
              <p className="text-xs text-red-700 font-medium text-center">¿Confirmar rechazo de la interconsulta?</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setConfirmRechazar(false)} disabled={accionFinalizada || isRechazando}>
                  Cancelar
                </Button>
                <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleRechazar} disabled={accionFinalizada || isRechazando}>
                  {isRechazando ? 'Rechazando...' : 'Sí, rechazar'}
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
