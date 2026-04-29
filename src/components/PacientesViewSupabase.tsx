// Vista de Pacientes integrada con Supabase
import { useState, useEffect, useRef } from 'react';
import { usePacientes, useSignosVitales, calcularIMC, calcularEdad, getIniciales } from '../hooks/usePacientes';
import type { Paciente, SignoVital, ArchivoMedico } from '../lib/pacientesService';
import { AlertasSignosVitalesPanel } from './AlertasSignosVitalesPanel';
import { RANGOS_SIGNOS_VITALES } from '../lib/pacientesService';
import { getArchivosByPaciente, createArchivoMedico, deleteArchivoMedico, getAntecedentesByPaciente, saveAntecedente } from '../lib/pacientesService';
import { getCitasByPaciente, getCitasByUsuarioYFechas, getCitasBySucursalYFechas, formatearFecha, formatearHora, getColorEstado, marcarCitaCompletada, updateCita, type CitaCompleta } from '../lib/citasService';
import { actualizarConsultaMedica, crearConsultaMedica, getConsultaMedicaByCita, getOrAssignNumeroReceta, type ConsultaMedica } from '../lib/consultasService.ts';
import { createInterconsulta, getInterconsultasByConsulta, deleteInterconsulta, getInterconsultaByCita, updateEstadoInterconsulta } from '../lib/interconsultaService';
import type { InterconsultaCompleta } from '../lib/supabaseTypes';
import { getAllEspecialidades, type Especialidad } from '../lib/configuracionesService';
import { createPedidoLaboratorio, getExamenesLaboratorioActivos, getPedidoLaboratorioByCita, type ExamenLaboratorio, type PedidoLaboratorioCompleto } from '../lib/laboratorioService';
import { getSolicitudImagenByCita, upsertSolicitudImagen, type SolicitudImagen } from '../lib/solicitudImagenService';
import { getMedicosBySucursal, type AsignacionCompleta } from '../lib/authService';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { consultarCedulaRegistroCivil } from '../lib/registroCivilService';
import logoClinicaAtlas from '../assets/535c4fa3c95ae864b14ba302621119ba18d73bbc.png';


import { Card, CardContent, CardHeader } from './ui/card';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  User,
  Search,
  Activity,
  Ruler,
  Weight,
  Thermometer,
  Heart,
  Wind,
  Droplet,
  Plus,
  FileText,
  Calendar,
  Loader2,
  Clock,
  Pencil,
  Stethoscope,
  AlertTriangle,
  Brain,
  Printer,
  RefreshCw,
  XCircle,
  X,
  Eye,
  ArrowLeftRight,
  Trash2
} from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { AntecedentesView } from './AntecedentesView';
import { ArchivosMedicosSection } from './ArchivosMedicosSection';
import { SupabaseIndicator } from './SupabaseIndicator';
import { CancelarCitaModalSupabase } from './CancelarCitaModalSupabase';
import { DetalleCitaDialog } from './DetalleCitaDialog';
import { AgendarCitaModalSupabase } from './AgendarCitaModalSupabase';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "./ui/utils";

// Helper para formatear fecha local YYYY-MM-DD
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ECUADOR_TIMEZONE = 'America/Guayaquil';

const formatDateInEcuador = (date: Date, options: Intl.DateTimeFormatOptions): string => {
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: ECUADOR_TIMEZONE,
    ...options,
  }).format(date);
};

const getDateKeyInEcuador = (date: Date): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ECUADOR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const formatCalendarDateFromIsoInEcuador = (fechaIso: string, options: Intl.DateTimeFormatOptions): string => {
  const [year, month, day] = fechaIso.split('-').map(Number);
  const utcEquivalent = new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
  return formatDateInEcuador(utcEquivalent, options);
};

// Helper para formatear el sexo
const formatearSexo = (sexo: 'M' | 'F' | 'Otro'): string => {
  switch (sexo) {
    case 'M': return 'Masculino';
    case 'F': return 'Femenino';
    case 'Otro': return 'Otro';
    default: return sexo;
  }
};

const createEmptyConsultaForm = () => ({
  motivo_consulta: '',
  historial_clinico: '',
  receta_medica: '',
  receta_rp: '',
  receta_indicaciones: '',
  pedido_examenes: '',
  fecha_seguimiento: '',
  pedido_hospitalizacion: '',
  diagnostico: ''
});

const EXAMEN_FISICO_SEGMENTOS = [
  'PIEL - FANERAS',
  'CABEZA',
  'OJOS',
  'OIDOS',
  'NARIZ',
  'BOCA',
  'ORO FARINGE',
  'CUELLO',
  'AXILAS - MAMAS',
  'TORAX',
  'ABDOMEN',
  'COLUMNA VERTEBRAL',
  'INGLE - PERINE',
  'MIEMBROS SUPERIORES',
  'MIEMBROS INFERIORES',
] as const;

const buildExamenFisicoResumen = ({
  segmentos,
  notasPorSegmento,
}: {
  segmentos: string[];
  notasPorSegmento: Record<string, string>;
}): string => {
  if (segmentos.length === 0) return '';

  const lineas = segmentos.map((seg) => {
    const obs = notasPorSegmento[seg]?.trim();
    return obs ? `${seg}: ${obs.toUpperCase()}` : seg;
  });

  return `SEGMENTOS:\n${lineas.map((l) => `- ${l}`).join('\n')}`;
};

const buildRecetaResumen = ({
  rp,
  indicaciones,
}: {
  rp?: string;
  indicaciones?: string;
}): string => {
  const partes: string[] = [];

  if (rp?.trim()) {
    partes.push(`RP:\n${rp.trim().toUpperCase()}`);
  }

  if (indicaciones?.trim()) {
    partes.push(`INDICACIONES:\n${indicaciones.trim().toUpperCase()}`);
  }

  return partes.join('\n\n');
};

const createEmptySolicitudImagenForm = () => ({
  fecha_solicitud: formatDateLocal(new Date()),
  procedimiento: '',
  antecedentes_clinico_quirurgico: '',
  cuadro_clinico: '',
  medicamentos: '',
});

const solicitudImagenTieneContenido = (form: ReturnType<typeof createEmptySolicitudImagenForm>): boolean => {
  return [
    form.procedimiento,
    form.antecedentes_clinico_quirurgico,
    form.cuadro_clinico,
    form.medicamentos,
  ].some((valor) => valor.trim().length > 0);
};

const getInterconsultaEstadoLabel = (estado: InterconsultaCompleta['estado']): string => {
  const labels: Record<InterconsultaCompleta['estado'], string> = {
    PENDIENTE_AGENDAR: 'PENDIENTE AGENDAR',
    AGENDADA: 'AGENDADA',
    ATENDIDO: 'ATENDIDO',
    RECHAZADA: 'RECHAZADA',
  };
  return labels[estado] || estado;
};

const getInterconsultaEstadoClass = (estado: InterconsultaCompleta['estado']): string => {
  const classes: Record<InterconsultaCompleta['estado'], string> = {
    PENDIENTE_AGENDAR: 'bg-yellow-100 text-yellow-800',
    AGENDADA: 'bg-blue-100 text-blue-800',
    ATENDIDO: 'bg-green-100 text-green-800',
    RECHAZADA: 'bg-red-100 text-red-800',
  };
  return classes[estado] || 'bg-gray-100 text-gray-700';
};

const ANTECEDENTES_PPF_KEYS = [
  'clinicos',
  'traumatologicos',
  'pediatricos',
  'quirurgicos',
  'familiares',
  'otros',
] as const;

const tieneAntecedentesPatologicosCompletos = (antecedentes: any): boolean => {
  const bloque = antecedentes?.antecedentesPatologicosPersonalesFamiliares;
  if (!bloque || typeof bloque !== 'object') return false;

  return ANTECEDENTES_PPF_KEYS.every((key) => {
    const respuesta = bloque?.[key]?.respuesta;
    return respuesta === 'si' || respuesta === 'no';
  });
};

const tieneAntecedentesPersonalesCompletos = (antecedentes: any): boolean => {
  const bloque = antecedentes?.antecedentesPatologicosPersonalesFamiliares;
  if (!bloque || typeof bloque !== 'object') return false;
  const personalesKeys = ['clinicos', 'traumatologicos', 'pediatricos', 'quirurgicos', 'otros'] as const;
  return personalesKeys.every((key) => {
    const respuesta = bloque?.[key]?.respuesta;
    return respuesta === 'si' || respuesta === 'no';
  });
};

const tieneFamiliaresCompletos = (antecedentes: any): boolean => {
  const bloque = antecedentes?.antecedentesPatologicosPersonalesFamiliares;
  if (!bloque || typeof bloque !== 'object') return false;
  const familiares = bloque.familiares;
  return Array.isArray(familiares?.notas) && familiares.notas.length > 0;
};

const tieneAlergiasRegistradas = (antecedentes: any): boolean => {
  const alergias = antecedentes?.alergias;
  return Array.isArray(alergias) && alergias.filter((a: unknown) => typeof a === 'string' && (a as string).trim() !== '').length > 0;
};

type DiagnosticoCie10 = {
  codigo: string;
  nombre: string;
  descripcion: string;
};

const DIAGNOSTICOS_CIE10_REFERENCIA: Record<string, DiagnosticoCie10> = {
  'A09': {
    codigo: 'A09',
    nombre: 'Gastroenteritis y colitis de origen infeccioso no especificado',
    descripcion: 'Cuadro de diarrea y dolor abdominal por infección intestinal no especificada.'
  },
  'I10': {
    codigo: 'I10',
    nombre: 'Hipertensión esencial (primaria)',
    descripcion: 'Presión arterial elevada crónica sin causa secundaria identificada.'
  },
  'J30.9': {
    codigo: 'J30.9',
    nombre: 'Rinitis alérgica no especificada',
    descripcion: 'Inflamación nasal por alergia con congestión, estornudos y rinorrea.'
  },
  'J06.9': {
    codigo: 'J06.9',
    nombre: 'Infección aguda de vías respiratorias superiores no especificada',
    descripcion: 'Infección respiratoria alta aguda, usualmente viral.'
  },
  'K29.7': {
    codigo: 'K29.7',
    nombre: 'Gastritis no especificada',
    descripcion: 'Inflamación de la mucosa gástrica con dolor epigástrico o dispepsia.'
  },
  'N39.0': {
    codigo: 'N39.0',
    nombre: 'Infección de vías urinarias, sitio no especificado',
    descripcion: 'Infección urinaria con disuria, urgencia o polaquiuria.'
  },
  'E11.9': {
    codigo: 'E11.9',
    nombre: 'Diabetes mellitus tipo 2 sin complicaciones',
    descripcion: 'Hiperglucemia crónica por resistencia a insulina, sin complicaciones registradas.'
  },
  'C25.9': {
    codigo: 'C25.9',
    nombre: 'Neoplasia maligna del páncreas, parte no especificada',
    descripcion: 'Tumor maligno pancreático en localización anatómica no especificada.'
  },
  '157': {
    codigo: '157',
    nombre: 'Referencia histórica: neoplasia maligna de páncreas',
    descripcion: 'Código no estándar CIE-10; referencia clínica aproximada equivalente a C25.9.'
  }
};

const buildPedidoLaboratorioResumen = ({
  numeroPedido,
  nombreMedico,
  examenes,
  observaciones,
}: {
  numeroPedido?: number | null;
  nombreMedico: string;
  examenes: string[];
  observaciones?: string;
}): string => {
  const lineas = [
    `PEDIDO DE LABORATORIO${numeroPedido ? ` #${numeroPedido}` : ''}`,
    `MÉDICO: ${nombreMedico.toUpperCase()}`,
    'EXÁMENES:'
  ];

  examenes.forEach((examen) => {
    lineas.push(`- ${examen.toUpperCase()}`);
  });

  if (observaciones?.trim()) {
    lineas.push(`OBSERVACIONES: ${observaciones.trim().toUpperCase()}`);
  }

  return lineas.join('\n');
};

interface PacientesViewProps {
  currentUser?: {
    name?: string;
    email: string;
    tipo_usuario?: string;
  } | null;
  pacienteIdInicial?: string | null;
  citaIdInicial?: number | null;
  onConsultaCompletada?: () => void;
}

export function PacientesViewSupabase({
  currentUser,
  pacienteIdInicial,
  citaIdInicial,
  onConsultaCompletada
}: PacientesViewProps) {
  // Obtener id_compania desde localStorage
  const [idCompania, setIdCompania] = useState<number | null>(null);

  useEffect(() => {
    const companiaId = localStorage.getItem('currentCompaniaId');
    if (companiaId) {
      setIdCompania(parseInt(companiaId));
    }
  }, [currentUser]);

  // Leer id_usuario del médico desde localStorage
  useEffect(() => {
    const userId = localStorage.getItem('currentUserId');
    if (userId) setIdUsuarioActual(parseInt(userId));
  }, []);

  // ── Helpers de agenda ─────────────────────────────────────────────────────
  const getWeekRangeAgenda = (date: Date) => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { inicio: formatDateLocal(start), fin: formatDateLocal(end) };
  };

  const getWeekDaysAgenda = () => {
    const days: Date[] = [];
    const start = new Date(currentWeekAgenda);
    start.setDate(start.getDate() - start.getDay());
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const esRolAgenda = currentUser?.tipo_usuario === 'medico' || currentUser?.tipo_usuario === 'enfermera';

  const resolveUsuarioIdActual = async (): Promise<number | null> => {
    if (idUsuarioActual) return idUsuarioActual;

    const userIdLs = localStorage.getItem('currentUserId');
    if (userIdLs) {
      const parsed = parseInt(userIdLs);
      if (!Number.isNaN(parsed)) {
        setIdUsuarioActual(parsed);
        return parsed;
      }
    }

    if (!currentUser?.email) return null;

    const { data: usuarioData } = await supabase
      .from('usuario')
      .select('id_usuario')
      .eq('email', currentUser.email)
      .maybeSingle() as any;

    if (usuarioData?.id_usuario) {
      const resolved = Number(usuarioData.id_usuario);
      if (!Number.isNaN(resolved)) {
        setIdUsuarioActual(resolved);
        localStorage.setItem('currentUserId', resolved.toString());
        return resolved;
      }
    }

    return null;
  };

  const resolveSucursalIdActual = async (): Promise<number | null> => {
    const sucursalLs = localStorage.getItem('currentSucursalId');
    if (sucursalLs) {
      const parsed = parseInt(sucursalLs);
      if (!Number.isNaN(parsed)) return parsed;
    }

    const usuarioId = await resolveUsuarioIdActual();
    if (!usuarioId) return null;

    const { data: asignacionData } = await supabase
      .from('usuario_sucursal')
      .select('id_sucursal')
      .eq('id_usuario', usuarioId)
      .eq('estado', 'activo')
      .order('id_usuario_sucursal', { ascending: true })
      .limit(1)
      .maybeSingle() as any;

    if (asignacionData?.id_sucursal) {
      const resolved = Number(asignacionData.id_sucursal);
      if (!Number.isNaN(resolved)) {
        localStorage.setItem('currentSucursalId', resolved.toString());
        return resolved;
      }
    }

    return null;
  };

  const cargarAgendaMedico = async () => {
    if (!esRolAgenda) return;
    setIsLoadingAgenda(true);
    try {
      const { inicio, fin } = vistaAgenda === 'semana'
        ? getWeekRangeAgenda(currentWeekAgenda)
        : { inicio: filterFechaDesdeAgenda, fin: filterFechaHastaAgenda };

      let citas: CitaCompleta[] = [];

      if (currentUser?.tipo_usuario === 'enfermera') {
        const currentSucursalId = await resolveSucursalIdActual();
        if (currentSucursalId) {
          citas = await getCitasBySucursalYFechas(currentSucursalId, inicio, fin);
        }
      } else {
        const usuarioId = await resolveUsuarioIdActual();
        if (!usuarioId) {
          setAgendaMedico([]);
          setAgendaFiltrada([]);
          return;
        }
        const currentSucursalId = await resolveSucursalIdActual();
        citas = await getCitasByUsuarioYFechas(usuarioId, inicio, fin, currentSucursalId || undefined);
      }

      setAgendaMedico(citas);
      if (agendaFilterPaciente) {
        setAgendaFiltrada(citas.filter(c => c.paciente.id_paciente === agendaFilterPaciente.id));
      } else {
        setAgendaFiltrada(citas);
      }
    } catch (error) {
      console.error('❌ Error al cargar agenda:', error);
    } finally {
      setIsLoadingAgenda(false);
    }
  };

  const getCitasPorDiaAgenda = (fecha: Date) => {
    const fechaStr = formatDateLocal(fecha);
    return agendaFiltrada.filter(cita => {
      const cumpleFecha = cita.fecha_cita === fechaStr;
      const cumpleCanceladas = mostrarCanceladasAgenda || cita.estado_cita !== 'cancelada';
      return cumpleFecha && cumpleCanceladas;
    });
  };

  const coloresSucursalAgenda = ['blue', 'green', 'purple', 'orange', 'pink', 'indigo'];
  const getColorSucursalAgenda = (idSucursal: number) =>
    coloresSucursalAgenda[idSucursal % coloresSucursalAgenda.length];

  const handleIniciarCitaDesdeAgenda = async (cita: CitaCompleta) => {
    // Replica Agenda: abrir el paciente y preservar la cita seleccionada
    await cargarPacienteById(cita.id_paciente);
    setExpandedPatientId(cita.id_paciente);
    setSelectedPatientId(cita.id_paciente);
    setCitaIdParaConsulta(cita.id_cita);
    setCitaDetalleAgenda(null);
  };

  const handleCancelarCitaDesdeAgenda = (cita: CitaCompleta) => {
    setCitaAgendaSeleccionada(cita);
    setIsCancelarAgendaModalOpen(true);
  };
  // ──────────────────────────────────────────────────────────────────────────

  const { pacientes, isLoading, buscarPacientes, crearPaciente, actualizarPaciente, clearPacientes, cargarPacienteById } = usePacientes(idCompania || undefined, { initialLoad: false });

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPatientId, setExpandedPatientId] = useState<number | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [isNewPatientDialogOpen, setIsNewPatientDialogOpen] = useState(false);
  const [isSignosVitalesDialogOpen, setIsSignosVitalesDialogOpen] = useState(false);
  const [isConsultaScreenOpen, setIsConsultaScreenOpen] = useState(false);
  const [isSavingConsulta, setIsSavingConsulta] = useState(false);
  const [isAutoSavingConsulta, setIsAutoSavingConsulta] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [isSearchingCedula, setIsSearchingCedula] = useState(false); // Estado para loading de cédula
  const [isEditingPatient, setIsEditingPatient] = useState(false); // Estado para edición
  const [citaIdParaConsulta, setCitaIdParaConsulta] = useState<number | null>(null); // ID de cita para iniciar consulta
  const [consultaDraftKey, setConsultaDraftKey] = useState<string | null>(null);
  const [isVerConsultaDialogOpen, setIsVerConsultaDialogOpen] = useState(false);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState<ConsultaMedica | null>(null);
  const [isLoadingDetalleConsulta, setIsLoadingDetalleConsulta] = useState(false);
  const [solicitudImagenDetalle, setSolicitudImagenDetalle] = useState<SolicitudImagen | null>(null);
  const [pedidoLaboratorioDetalle, setPedidoLaboratorioDetalle] = useState<PedidoLaboratorioCompleto | null>(null);
  const [interconsultasDetalle, setInterconsultasDetalle] = useState<InterconsultaCompleta[]>([]);
  const [isLaboratorioDialogOpen, setIsLaboratorioDialogOpen] = useState(false);
  const [isLoadingLaboratorio, setIsLoadingLaboratorio] = useState(false);
  const [isLoadingMedicosLaboratorio, setIsLoadingMedicosLaboratorio] = useState(false);
  const [examenesLaboratorio, setExamenesLaboratorio] = useState<ExamenLaboratorio[]>([]);
  const [medicosLaboratorio, setMedicosLaboratorio] = useState<AsignacionCompleta[]>([]);
  const [examenesLaboratorioSeleccionados, setExamenesLaboratorioSeleccionados] = useState<number[]>([]);
  const [medicoLaboratorioSeleccionado, setMedicoLaboratorioSeleccionado] = useState<string>('');
  const [observacionesLaboratorio, setObservacionesLaboratorio] = useState('');
  const [pedidoLaboratorioActual, setPedidoLaboratorioActual] = useState<PedidoLaboratorioCompleto | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoSavingRef = useRef(false);


  // Estado para citas del paciente seleccionado
  const [citasPaciente, setCitasPaciente] = useState<CitaCompleta[]>([]);
  const [isLoadingCitas, setIsLoadingCitas] = useState(false);

  // Estado para consultas médicas indexadas por id_cita
  const [consultasPorCita, setConsultasPorCita] = useState<Record<number, ConsultaMedica>>({});

  // Estado para controlar qué citas están expandidas en el historial
  const [citasExpandidas, setCitasExpandidas] = useState<Set<number>>(new Set());

  // Estado para confirmación de No Asistió
  const [citaParaNoAsistio, setCitaParaNoAsistio] = useState<number | null>(null);
  const [isNoAsistioConfirmOpen, setIsNoAsistioConfirmOpen] = useState(false);

  // Estado para edición de cita (secretaria / administrador)
  const [citaParaEditar, setCitaParaEditar] = useState<CitaCompleta | null>(null);
  const [isEditCitaModalOpen, setIsEditCitaModalOpen] = useState(false);

  // Estado para controlar el índice de signos vitales visible para cada paciente
  const [signosVitalesIndex, setSignosVitalesIndex] = useState<Record<number, number>>({});

  // Estado para antecedentes del paciente seleccionado
  const [antecedentesData, setAntecedentesData] = useState<any>(null);
  const [isLoadingAntecedentes, setIsLoadingAntecedentes] = useState(false);

  // ── Interconsulta ────────────────────────────────────────────────────────
  const [interconsultaForm, setInterconsultaForm] = useState({
    tipo_destino: 'interno' as 'interno' | 'externo',
    id_usuario_destino: null as number | null,
    id_especialidad_destino: null as number | null,
    especialidad_destino_texto: '',
    medico_destino_externo: '',
    motivo: '',
    resumen_clinico: '',
    urgencia: 'normal' as 'normal' | 'urgente',
    fecha_limite: '',
  });
  const [interconsultasActuales, setInterconsultasActuales] = useState<InterconsultaCompleta[]>([]);
  const [isLoadingInterconsultas, setIsLoadingInterconsultas] = useState(false);
  const [isSavingInterconsulta, setIsSavingInterconsulta] = useState(false);
  const [especialidadesInterconsulta, setEspecialidadesInterconsulta] = useState<Especialidad[]>([]);
  // ──────────────────────────────────────────────────────────────────────────

  // ── Agenda en pantalla Pacientes (médico y enfermera) ────────────────────
  const [idUsuarioActual, setIdUsuarioActual] = useState<number | null>(null);
  const [agendaMedico, setAgendaMedico] = useState<CitaCompleta[]>([]);
  const [agendaFiltrada, setAgendaFiltrada] = useState<CitaCompleta[]>([]);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false);
  const [currentWeekAgenda, setCurrentWeekAgenda] = useState(new Date());
  const [vistaAgenda, setVistaAgenda] = useState<'semana' | 'lista'>('semana');
  const [mostrarCanceladasAgenda, setMostrarCanceladasAgenda] = useState(false);
  const [filterFechaDesdeAgenda, setFilterFechaDesdeAgenda] = useState<string>(formatDateLocal(new Date()));
  const [filterFechaHastaAgenda, setFilterFechaHastaAgenda] = useState<string>(formatDateLocal(new Date()));
  const [agendaFilterPaciente, setAgendaFilterPaciente] = useState<{ id: number; nombre: string } | null>(null);
  const [citaDetalleAgenda, setCitaDetalleAgenda] = useState<CitaCompleta | null>(null);
  const [citaAgendaSeleccionada, setCitaAgendaSeleccionada] = useState<CitaCompleta | null>(null);
  const [isCancelarAgendaModalOpen, setIsCancelarAgendaModalOpen] = useState(false);


  // Devuelve un objeto Date en la zona horaria de Ecuador (America/Guayaquil)
  const parseEcuadorDateTimeLocal = (fecha: string, hora: string): Date => {
    // fecha: 'YYYY-MM-DD', hora: 'HH:mm' o 'HH:mm:ss'
    const [year, month, day] = fecha.split('-').map(Number);
    const [hours, minutes, seconds = 0] = hora.split(':').map(Number);
    // Crear string ISO local en Ecuador
    const isoString = `${year.toString().padStart(4, '0')}-${month
      .toString()
      .padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hours
      .toString()
      .padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
    // Parsear como si fuera local de Ecuador
    return new Date(isoString + '-05:00');
  };

  const citaPendientePacienteAgenda = agendaFilterPaciente
    ? agendaFiltrada
        .filter((cita) => {
          const mismoPaciente = Number(cita.paciente.id_paciente) === Number(agendaFilterPaciente.id);
          if (!mismoPaciente) return false;

          const estado = (cita.estado_cita || '').toLowerCase();
          const estadoPendiente = ['pendiente', 'agendada', 'confirmada', 'en_atencion'].includes(estado);
          if (!estadoPendiente || cita.consulta_realizada) return false;

          // Solo habilitar si la cita es para el día de hoy
          const hoy = formatDateLocal(new Date());
          if (cita.fecha_cita !== hoy) return false;

          return true;
        })
        .sort((a, b) => {
          const inicioA = parseEcuadorDateTimeLocal(a.fecha_cita, a.hora_inicio).getTime();
          const inicioB = parseEcuadorDateTimeLocal(b.fecha_cita, b.hora_inicio).getTime();
          return inicioB - inicioA;
        })[0] || null
    : null;
  // ──────────────────────────────────────────────────────────────────────────

  // Hook para signos vitales del paciente seleccionado
  const { signosVitales, alertasActuales, loadAlertasForSigno, guardarSignoVital } = useSignosVitales(selectedPatientId);

  // Recargar alertas cuando el usuario navega entre registros de signos vitales
  useEffect(() => {
    if (!selectedPatientId || signosVitales.length === 0) return;
    const idx = signosVitalesIndex[selectedPatientId] || 0;
    const signo = signosVitales[idx];
    if (signo) loadAlertasForSigno(signo.id_signo_vital);
  }, [signosVitalesIndex, selectedPatientId, signosVitales, loadAlertasForSigno]);

  // Formulario de nuevo paciente
  const [newPatient, setNewPatient] = useState({
    nombres: '',
    apellidos: '',
    fecha_nacimiento: '',
    sexo: 'M' as 'M' | 'F' | 'Otro',
    cedula: '',
    email: '',
    telefono: '',
    direccion: '',
  });

  // Consultar datos de registro civil al perder foco en cédula
  const handleBlurCedula = async () => {
    const cedula = newPatient.cedula.trim();
    if (!cedula) return;
    if (cedula.length < 10) {
      toast.warning('Ingrese una cédula de al menos 10 dígitos para consultar datos');
      return;
    }

    setIsSearchingCedula(true);
    try {
      const datos = await consultarCedulaRegistroCivil(cedula);
      if (datos) {
        setNewPatient(prev => ({
          ...prev,
          nombres: datos.nombres || prev.nombres,
          apellidos: datos.apellidos || prev.apellidos,
          fecha_nacimiento: datos.fecha_nacimiento || prev.fecha_nacimiento,
          sexo: datos.sexo,
          direccion: datos.direccion || prev.direccion
        }));
        toast.success('Datos encontrados y cargados');
      } else {
        toast.warning('No se encontraron datos para la cédula ingresada');
      }
    } catch (error) {
      console.error('Error al consultar cédula:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo consultar la API de cédula');
    } finally {
      setIsSearchingCedula(false);
    }
  };

  // Formulario de signos vitales
  const [signosVitalesForm, setSignosVitalesForm] = useState({
    estatura_cm: '',
    peso_kg: '',
    perimetro_cefalico_cm: '',
    temperatura_c: '',
    frecuencia_respiratoria: '',
    frecuencia_cardiaca: '',
    presion_sistolica: '',
    presion_diastolica: '',
    saturacion_oxigeno: '',
    glucosa_mg_dl: '',
    glasgow_ocular: '',
    glasgow_verbal: '',
    glasgow_motora: '',
    reaccion_pupilar: '',
    tiempo_llenado_capilar_seg: '',
    notas: ''
  });

  // Formulario de consulta médica
  const [consultaForm, setConsultaForm] = useState(createEmptyConsultaForm);

  // Sucursal seleccionada para crear la consulta
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<number | null>(null);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [examenFisicoSeleccionados, setExamenFisicoSeleccionados] = useState<string[]>([]);
  const [notasExamenFisico, setNotasExamenFisico] = useState<Record<string, string>>({});
  const [solicitudImagenForm, setSolicitudImagenForm] = useState(createEmptySolicitudImagenForm);
  const [solicitudImagenActual, setSolicitudImagenActual] = useState<SolicitudImagen | null>(null);

  // Estado para Diagnóstico IA
  const [isLoadingDiagnosticoIA, setIsLoadingDiagnosticoIA] = useState(false);
  const [codigoCie10Input, setCodigoCie10Input] = useState('');
  const [diagnosticosCie10, setDiagnosticosCie10] = useState<DiagnosticoCie10[]>([]);

  const citaConsultaActual = (citaIdParaConsulta || citaIdInicial)
    ? citasPaciente.find((cita) => cita.id_cita === (citaIdParaConsulta || citaIdInicial)) || null
    : null;

  const medicoLaboratorioActual = medicosLaboratorio.find(
    (medico) => medico.id_usuario_sucursal.toString() === medicoLaboratorioSeleccionado
  ) || null;

  const examenesLaboratorioSeleccionadosData = examenesLaboratorio.filter((examen) =>
    examenesLaboratorioSeleccionados.includes(examen.id_examen_laboratorio)
  );

  const resumenLaboratorioSeleccion = examenesLaboratorioSeleccionadosData.length > 0 && medicoLaboratorioActual?.usuario
    ? buildPedidoLaboratorioResumen({
        nombreMedico: `${medicoLaboratorioActual.usuario.nombre} ${medicoLaboratorioActual.usuario.apellido}`,
        examenes: examenesLaboratorioSeleccionadosData.map((examen) => examen.nombre),
        observaciones: observacionesLaboratorio,
      })
    : '';

  const resumenExamenFisico = buildExamenFisicoResumen({
    segmentos: examenFisicoSeleccionados,
    notasPorSegmento: notasExamenFisico,
  });

  const resumenReceta = buildRecetaResumen({
    rp: consultaForm.receta_rp,
    indicaciones: consultaForm.receta_indicaciones,
  });

  const alergiasDesdeAntecedentesLista = Array.isArray(antecedentesData?.alergias)
    ? antecedentesData.alergias.filter((item: unknown) => typeof item === 'string' && item.trim() !== '')
    : [];

  const alergiasDesdeAntecedentesTexto = alergiasDesdeAntecedentesLista.length > 0
    ? alergiasDesdeAntecedentesLista.join(', ').toUpperCase()
    : '';

  const examenesLaboratorioAgrupados = examenesLaboratorio.reduce<Record<string, ExamenLaboratorio[]>>((acc, examen) => {
    if (!acc[examen.categoria]) {
      acc[examen.categoria] = [];
    }
    acc[examen.categoria].push(examen);
    return acc;
  }, {});

  const resetLaboratorioState = () => {
    setExamenesLaboratorioSeleccionados([]);
    setMedicoLaboratorioSeleccionado('');
    setObservacionesLaboratorio('');
    setPedidoLaboratorioActual(null);
  };

  const resolveUsuarioConsulta = async (): Promise<number | null> => {
    const resolved = await resolveUsuarioIdActual();
    if (resolved) return resolved;

    if (!currentUser?.email) return null;

    const { data: usuarioData, error } = await supabase
      .from('usuario')
      .select('id_usuario')
      .eq('email', currentUser.email)
      .maybeSingle() as any;

    if (error || !usuarioData?.id_usuario) return null;
    return Number(usuarioData.id_usuario);
  };

  const ensureCitaParaConsulta = async (): Promise<number | null> => {
    const citaActualId = citaIdParaConsulta || citaIdInicial;
    if (citaActualId) return citaActualId;

    if (!selectedPatientId || !sucursalSeleccionada) return null;

    const usuarioId = await resolveUsuarioConsulta();
    if (!usuarioId) return null;

    let { data: asignacionData } = await supabase
      .from('usuario_sucursal')
      .select('id_usuario_sucursal')
      .eq('id_usuario', usuarioId)
      .eq('id_sucursal', sucursalSeleccionada)
      .eq('estado', 'activo')
      .maybeSingle() as any;

    if (!asignacionData) {
      const { data: nuevaAsignacion, error: errorAsignacion } = await supabase
        .from('usuario_sucursal')
        .insert({
          id_usuario: usuarioId,
          id_sucursal: sucursalSeleccionada,
          especialidad: 'Medicina General',
          estado: 'activo'
        } as any)
        .select()
        .single() as any;

      if (errorAsignacion || !nuevaAsignacion) {
        return null;
      }

      await supabase
        .from('precio_usuario_sucursal')
        .insert({
          id_usuario_sucursal: nuevaAsignacion.id_usuario_sucursal,
          precio_consulta: 50.00,
          duracion_consulta: 30,
          estado: 'activo'
        } as any);

      asignacionData = nuevaAsignacion;
    }

    const { data: precioData } = await supabase
      .from('precio_usuario_sucursal')
      .select('precio_consulta, duracion_consulta')
      .eq('id_usuario_sucursal', asignacionData.id_usuario_sucursal)
      .eq('estado', 'activo')
      .maybeSingle() as any;

    const precioConsulta = precioData?.precio_consulta || 50;
    const duracionConsulta = precioData?.duracion_consulta || 30;
    const ahora = new Date();
    const horaFin = new Date(ahora.getTime() + duracionConsulta * 60000);
    const motivoInicial = (
      consultaForm.motivo_consulta ||
      citaConsultaActual?.motivo_consulta ||
      'CONSULTA EN CURSO'
    ).trim().toUpperCase();

    const { data: citaCreada, error: citaError } = await supabase
      .from('cita')
      .insert({
        id_paciente: selectedPatientId,
        id_usuario_sucursal: asignacionData.id_usuario_sucursal,
        id_sucursal: sucursalSeleccionada,
        fecha_cita: ahora.toISOString().split('T')[0],
        hora_inicio: ahora.toTimeString().split(' ')[0].substring(0, 5),
        hora_fin: horaFin.toTimeString().split(' ')[0].substring(0, 5),
        duracion_minutos: duracionConsulta,
        tipo_cita: 'consulta',
        motivo_consulta: motivoInicial,
        estado_cita: 'en_atencion',
        consulta_realizada: false,
        precio_cita: precioConsulta,
      } as any)
      .select()
      .single() as any;

    if (citaError || !citaCreada?.id_cita) {
      return null;
    }

    setCitaIdParaConsulta(citaCreada.id_cita);

    const citasActualizadas = await getCitasByPaciente(selectedPatientId);
    setCitasPaciente(citasActualizadas);

    return citaCreada.id_cita;
  };

  // Cargar agenda cuando el usuario es médico o enfermera
  useEffect(() => {
    if (currentUser?.tipo_usuario === 'enfermera') {
      cargarAgendaMedico();
      return;
    }

    if (currentUser?.tipo_usuario === 'medico' && idUsuarioActual) {
      cargarAgendaMedico();
    }
  }, [idUsuarioActual, currentWeekAgenda, vistaAgenda, filterFechaDesdeAgenda, filterFechaHastaAgenda, currentUser?.tipo_usuario, currentUser?.email]);

  useEffect(() => {
    const cargarExamenesLaboratorio = async () => {
      setIsLoadingLaboratorio(true);
      try {
        const examenes = await getExamenesLaboratorioActivos();
        setExamenesLaboratorio(examenes);
      } finally {
        setIsLoadingLaboratorio(false);
      }
    };

    cargarExamenesLaboratorio();
  }, []);

  useEffect(() => {
    const cargarMedicosLaboratorio = async () => {
      if (!isConsultaScreenOpen || !sucursalSeleccionada) {
        setMedicosLaboratorio([]);
        return;
      }

      setIsLoadingMedicosLaboratorio(true);
      try {
        const medicos = await getMedicosBySucursal(sucursalSeleccionada);
        setMedicosLaboratorio(medicos);

        if (!medicoLaboratorioSeleccionado) {
          const medicoPredeterminado = citaConsultaActual?.id_usuario_sucursal
            ? medicos.find((medico) => medico.id_usuario_sucursal === citaConsultaActual.id_usuario_sucursal)
            : medicos.find((medico) => medico.id_usuario === idUsuarioActual) || (medicos.length === 1 ? medicos[0] : null);

          if (medicoPredeterminado) {
            setMedicoLaboratorioSeleccionado(medicoPredeterminado.id_usuario_sucursal.toString());
          }
        }
      } catch (error) {
        console.error('❌ Error al cargar médicos para laboratorio:', error);
        toast.error('No se pudieron cargar los médicos para laboratorio');
      } finally {
        setIsLoadingMedicosLaboratorio(false);
      }
    };

    cargarMedicosLaboratorio();
  }, [isConsultaScreenOpen, sucursalSeleccionada, citaConsultaActual?.id_usuario_sucursal, idUsuarioActual, medicoLaboratorioSeleccionado]);

  // Cargar especialidades y médicos para el formulario de interconsulta
  useEffect(() => {
    if (!isConsultaScreenOpen) return;

    const cargarDatosInterconsulta = async () => {
      try {
        const especialidades = await getAllEspecialidades();
        setEspecialidadesInterconsulta(especialidades.filter((e) => e.estado === 'activo'));
      } catch (error) {
        console.error('❌ Error al cargar datos para interconsulta:', error);
      }
    };

    cargarDatosInterconsulta();
  }, [isConsultaScreenOpen]);

  // Cargar interconsultas existentes cuando cambia la cita de consulta
  useEffect(() => {
    if (!isConsultaScreenOpen) {
      setInterconsultasActuales([]);
      return;
    }

    const idCita = citaIdParaConsulta || citaIdInicial;
    if (!idCita) return;

    const cargarInterconsultas = async () => {
      setIsLoadingInterconsultas(true);
      try {
        const consulta = await getConsultaMedicaByCita(idCita);
        if (consulta) {
          const lista = await getInterconsultasByConsulta(consulta.id_consulta_medica);
          setInterconsultasActuales(lista);
        } else {
          setInterconsultasActuales([]);
        }
      } catch (error) {
        console.error('❌ Error al cargar interconsultas:', error);
      } finally {
        setIsLoadingInterconsultas(false);
      }
    };

    cargarInterconsultas();
  }, [isConsultaScreenOpen, citaIdParaConsulta, citaIdInicial]);

  const handleAgregarInterconsulta = async () => {
    if (interconsultasActuales.length > 0) {
      toast.error('Esta cita médica ya tiene una interconsulta registrada');
      return;
    }

    if (!interconsultaForm.motivo.trim()) {
      toast.error('El motivo de la interconsulta es requerido');
      return;
    }

    const idCita = citaIdParaConsulta || citaIdInicial;
    if (!idCita || !selectedPatientId) {
      toast.error('No hay una consulta activa');
      return;
    }

    const consulta = await getConsultaMedicaByCita(idCita);
    if (!consulta) {
      toast.error('Guarde la consulta primero antes de agregar una interconsulta');
      return;
    }

    setIsSavingInterconsulta(true);
    try {
      const datos = {
        id_consulta_medica: consulta.id_consulta_medica,
        id_paciente: selectedPatientId,
        id_usuario_solicitante: idUsuarioActual,
        tipo_destino: interconsultaForm.tipo_destino,
        id_usuario_destino: null,
        id_especialidad_destino: interconsultaForm.tipo_destino === 'interno' ? interconsultaForm.id_especialidad_destino : null,
        especialidad_destino_texto: interconsultaForm.tipo_destino === 'externo' ? interconsultaForm.especialidad_destino_texto || null : null,
        medico_destino_externo: null,
        motivo: interconsultaForm.motivo,
        resumen_clinico: interconsultaForm.resumen_clinico || null,
        urgencia: interconsultaForm.urgencia,
        fecha_limite: interconsultaForm.fecha_limite || null,
        estado: 'PENDIENTE_AGENDAR' as const,
        id_cita_generada: null,
      };

      const resultado = await createInterconsulta(datos);
      if (resultado) {
        toast.success('Interconsulta registrada correctamente');
        setInterconsultaForm({
          tipo_destino: 'interno',
          id_usuario_destino: null,
          id_especialidad_destino: null,
          especialidad_destino_texto: '',
          medico_destino_externo: '',
          motivo: '',
          resumen_clinico: '',
          urgencia: 'normal',
          fecha_limite: '',
        });
        const lista = await getInterconsultasByConsulta(consulta.id_consulta_medica);
        setInterconsultasActuales(lista);
      } else {
        toast.error('No se pudo registrar la interconsulta');
      }
    } catch (error) {
      console.error('❌ Error al agregar interconsulta:', error);
      toast.error('Error al registrar la interconsulta');
    } finally {
      setIsSavingInterconsulta(false);
    }
  };

  const handleImprimirInterconsultaDesdeConsulta = async () => {
    const interconsultaExistente = interconsultasActuales[0];
    if (interconsultaExistente) {
      handleImprimirInterconsulta(interconsultaExistente);
      return;
    }

    const interconsultaConFormulario = Boolean(interconsultaForm.motivo.trim());

    if (!interconsultaConFormulario) {
      toast.error('Complete el motivo de la interconsulta para imprimir');
      return;
    }

    const idCita = citaIdParaConsulta || citaIdInicial;
    if (!idCita || !selectedPatientId) {
      toast.error('No hay una consulta activa');
      return;
    }

    const consulta = await getConsultaMedicaByCita(idCita);
    if (!consulta) {
      toast.error('Guarde la consulta primero antes de imprimir la interconsulta');
      return;
    }

    setIsSavingInterconsulta(true);
    try {
      const datos = {
        id_consulta_medica: consulta.id_consulta_medica,
        id_paciente: selectedPatientId,
        id_usuario_solicitante: idUsuarioActual,
        tipo_destino: interconsultaForm.tipo_destino,
        id_usuario_destino: null,
        id_especialidad_destino: interconsultaForm.tipo_destino === 'interno' ? interconsultaForm.id_especialidad_destino : null,
        especialidad_destino_texto: interconsultaForm.tipo_destino === 'externo' ? interconsultaForm.especialidad_destino_texto || null : null,
        medico_destino_externo: null,
        motivo: interconsultaForm.motivo,
        resumen_clinico: interconsultaForm.resumen_clinico || null,
        urgencia: interconsultaForm.urgencia,
        fecha_limite: interconsultaForm.fecha_limite || null,
        estado: 'PENDIENTE_AGENDAR' as const,
        id_cita_generada: null,
      };

      const resultado = await createInterconsulta(datos);
      if (!resultado) {
        toast.error('No se pudo registrar la interconsulta para imprimir');
        return;
      }

      const lista = await getInterconsultasByConsulta(consulta.id_consulta_medica);
      setInterconsultasActuales(lista);
      const interconsultaGuardada = lista.find((ic) => ic.id_interconsulta === resultado.id_interconsulta);
      handleImprimirInterconsulta(interconsultaGuardada || ({
        ...resultado,
        especialidad: interconsultaForm.tipo_destino === 'interno'
          ? {
              id_especialidad: interconsultaForm.id_especialidad_destino || 0,
              nombre: especialidadesInterconsulta.find(
                (e) => e.id_especialidad === interconsultaForm.id_especialidad_destino
              )?.nombre || '',
            }
          : null,
      } as InterconsultaCompleta));
      toast.success('Interconsulta registrada para impresión');
    } catch (error) {
      console.error('❌ Error al imprimir interconsulta:', error);
      toast.error('Error al imprimir la interconsulta');
    } finally {
      setIsSavingInterconsulta(false);
    }
  };

  const handleEliminarInterconsulta = async (idInterconsulta: number) => {
    const ok = await deleteInterconsulta(idInterconsulta);
    if (ok) {
      setInterconsultasActuales((prev) => prev.filter((i) => i.id_interconsulta !== idInterconsulta));
      toast.success('Interconsulta eliminada');
    } else {
      toast.error('No se pudo eliminar la interconsulta');
    }
  };

  useEffect(() => {
    setConsultaForm((prev) => {
      if (prev.pedido_examenes === resumenExamenFisico) {
        return prev;
      }

      return {
        ...prev,
        pedido_examenes: resumenExamenFisico,
      };
    });
  }, [resumenExamenFisico]);

  useEffect(() => {
    if (!isConsultaScreenOpen || !citaConsultaActual?.motivo_consulta) {
      return;
    }

    setConsultaForm((prev) => {
      if (prev.motivo_consulta.trim()) {
        return prev;
      }

      return {
        ...prev,
        motivo_consulta: citaConsultaActual.motivo_consulta.toUpperCase(),
      };
    });
  }, [isConsultaScreenOpen, citaConsultaActual?.id_cita, citaConsultaActual?.motivo_consulta]);

  useEffect(() => {
    if (!isConsultaScreenOpen) return;
    if (citaIdParaConsulta || citaIdInicial) return;

    void ensureCitaParaConsulta();
  }, [isConsultaScreenOpen, citaIdParaConsulta, citaIdInicial, selectedPatientId, sucursalSeleccionada]);

  useEffect(() => {
    if (!isConsultaScreenOpen || !selectedPatientId || !sucursalSeleccionada) {
      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (isAutoSavingRef.current) return;
      isAutoSavingRef.current = true;
      setIsAutoSavingConsulta(true);

      try {
        const idCita = await ensureCitaParaConsulta();
        if (!idCita) return;

        const usuarioId = await resolveUsuarioConsulta();
        if (!usuarioId) return;

        if (consultaForm.motivo_consulta.trim()) {
          await updateCita(idCita, {
            motivo_consulta: consultaForm.motivo_consulta,
          });
        }

        const consultaExistente = await getConsultaMedicaByCita(idCita);
        const payloadConsulta = {
          historial_clinico: consultaForm.historial_clinico || null,
          diagnostico: consultaForm.diagnostico || null,
          diagnostico_ia: consultaForm.diagnostico || null,
          receta_medica: resumenReceta || null,
          receta_rp: consultaForm.receta_rp || null,
          receta_indicaciones: consultaForm.receta_indicaciones || null,
          pedido_examenes: consultaForm.pedido_examenes || null,
          observaciones: null,
          fecha_seguimiento: consultaForm.fecha_seguimiento || null,
          pedido_hospitalizacion: consultaForm.pedido_hospitalizacion || null,
        };

        if (consultaExistente) {
          await actualizarConsultaMedica(consultaExistente.id_consulta_medica, payloadConsulta);
        } else if (
          consultaForm.motivo_consulta.trim() ||
          consultaForm.historial_clinico.trim() ||
          consultaForm.diagnostico.trim() ||
          consultaForm.receta_rp.trim() ||
          consultaForm.receta_indicaciones.trim() ||
          consultaForm.pedido_examenes.trim()
        ) {
          await crearConsultaMedica({
            id_cita: idCita,
            id_paciente: selectedPatientId,
            id_usuario: usuarioId,
            ...payloadConsulta,
          });
        }

        const pacienteActual = pacientes.find((p: Paciente) => p.id_paciente === selectedPatientId) || null;

        if (pacienteActual && solicitudImagenTieneContenido(solicitudImagenForm)) {
          const solicitudImagen = await upsertSolicitudImagen({
            id_cita: idCita,
            id_paciente: selectedPatientId,
            id_sucursal: sucursalSeleccionada,
            id_usuario_solicitante: usuarioId,
            fecha_solicitud: solicitudImagenForm.fecha_solicitud,
            nombre_paciente: `${pacienteActual.nombres} ${pacienteActual.apellidos}`.trim(),
            edad_paciente: calcularEdad(pacienteActual.fecha_nacimiento),
            procedimiento: solicitudImagenForm.procedimiento,
            antecedentes_clinico_quirurgico: solicitudImagenForm.antecedentes_clinico_quirurgico,
            cuadro_clinico: solicitudImagenForm.cuadro_clinico,
            medicamentos: solicitudImagenForm.medicamentos,
            alergias: alergiasDesdeAntecedentesTexto,
          });

          if (solicitudImagen) {
            setSolicitudImagenActual(solicitudImagen);
          }
        }

        if (examenesLaboratorioSeleccionadosData.length > 0 && medicoLaboratorioActual) {
          const pedido = await createPedidoLaboratorio({
            id_cita: idCita,
            id_paciente: selectedPatientId,
            id_sucursal: sucursalSeleccionada,
            id_usuario_solicitante: usuarioId,
            id_usuario_sucursal_medico: medicoLaboratorioActual.id_usuario_sucursal,
            observaciones: observacionesLaboratorio || null,
            examenes: examenesLaboratorioSeleccionadosData.map((examen) => examen.id_examen_laboratorio),
          });

          if (pedido) {
            setPedidoLaboratorioActual(pedido);
          }
        }
      } catch (error) {
        console.error('❌ Error en guardado automático de consulta:', error);
      } finally {
        isAutoSavingRef.current = false;
        setIsAutoSavingConsulta(false);
      }
    }, 900);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [
    isConsultaScreenOpen,
    selectedPatientId,
    sucursalSeleccionada,
    citaIdParaConsulta,
    consultaForm,
    resumenReceta,
    solicitudImagenForm,
    alergiasDesdeAntecedentesTexto,
    examenesLaboratorioSeleccionadosData,
    medicoLaboratorioActual,
    observacionesLaboratorio,
    pacientes,
  ]);

  // Efecto de búsqueda automática REMOVIDO para usar botón manual
  // useEffect(() => {... }, [searchTerm]);

  // Expandir automáticamente el paciente cuando se inicia desde la agenda
  useEffect(() => {
    if (pacienteIdInicial) {
      const pacienteId = parseInt(pacienteIdInicial);
      if (!isNaN(pacienteId)) {
        setExpandedPatientId(pacienteId);
        setSelectedPatientId(pacienteId);
        cargarPacienteById(pacienteId);
      }
    }
  }, [pacienteIdInicial]);

  // Inicializar configuración del usuario (crear asignación de sucursal si no existe)
  useEffect(() => {
    const inicializarConfiguracion = async () => {
      if (!currentUser) return;

      try {
        // Obtener el usuario de Supabase
        const { data: usuarioData } = await supabase
          .from('usuario')
          .select('id_usuario')
          .eq('email', currentUser.email)
          .single() as any;

        if (!usuarioData) return;

        // Verificar si tiene asignación de sucursal activa
        const { data: asignacionData } = await supabase
          .from('usuario_sucursal')
          .select('*')
          .eq('id_usuario', usuarioData.id_usuario)
          .eq('estado', 'activo')
          .single() as any;

        if (!asignacionData) {
          // Buscar o crear sucursal predeterminada
          let { data: sucursalData } = await supabase
            .from('sucursal')
            .select('*')
            .eq('estado', 'activo')
            .limit(1)
            .single() as any;

          if (!sucursalData) {
            const { data: nuevaSucursal } = await supabase
              .from('sucursal')
              .insert({
                nombre: 'Sucursal Principal',
                direccion: 'Dirección por configurar',
                telefono: '',
                email: '',
                es_principal: true,
                estado: 'activo'
              } as any)
              .select()
              .single() as any;

            sucursalData = nuevaSucursal;
          }

          if (sucursalData) {
            // Crear asignación de usuario-sucursal
            const { data: nuevaAsignacion } = await supabase
              .from('usuario_sucursal')
              .insert({
                id_usuario: usuarioData.id_usuario,
                id_sucursal: sucursalData.id_sucursal,
                especialidad: 'Medicina General',
                estado: 'activo'
              } as any)
              .select()
              .single() as any;

            if (nuevaAsignacion) {
              // Crear precio predeterminado
              await supabase
                .from('precio_usuario_sucursal')
                .insert({
                  id_usuario_sucursal: nuevaAsignacion.id_usuario_sucursal,
                  precio_consulta: 50.00,
                  duracion_consulta: 30,
                  estado: 'activo'
                } as any);
            }
          }
        }
      } catch (error) {
        // Silenciar errores de configuración inicial
      }
    };

    inicializarConfiguracion();
  }, [currentUser]);

  // Cargar antecedentes del paciente seleccionado
  useEffect(() => {
    const cargarAntecedentes = async () => {
      if (!selectedPatientId) {
        setAntecedentesData(null);
        return;
      }

      setIsLoadingAntecedentes(true);
      try {
        const antecedentes = await getAntecedentesByPaciente(selectedPatientId);
        setAntecedentesData(antecedentes);
      } catch (error) {
        console.error('Error al cargar antecedentes:', error);
      } finally {
        setIsLoadingAntecedentes(false);
      }
    };

    cargarAntecedentes();
  }, [selectedPatientId]);

  // Cargar sucursales disponibles
  useEffect(() => {
    const cargarSucursales = async () => {
      const { data, error } = await supabase
        .from('sucursal')
        .select('id_sucursal, nombre, direccion, estado')
        .eq('estado', 'activo')
        .order('nombre', { ascending: true }) as any;

      if (error) {
        console.error('Error al cargar sucursales:', error);
        toast.error('Error al cargar sucursales');
      } else if (data) {
        console.log('Sucursales cargadas:', data);
        setSucursales(data);
        // Seleccionar la primera sucursal por defecto
        if (data.length > 0) {
          setSucursalSeleccionada(data[0].id_sucursal);
        }
      }
    };

    cargarSucursales();
  }, []);

  // Cargar citas del paciente seleccionado
  useEffect(() => {
    const cargarCitas = async () => {
      if (selectedPatientId) {
        setIsLoadingCitas(true);
        const citas = await getCitasByPaciente(selectedPatientId);
        setCitasPaciente(citas);

        // Cargar consultas médicas para cada cita
        const consultasMap: Record<number, ConsultaMedica> = {};
        for (const cita of citas) {
          const consulta = await getConsultaMedicaByCita(cita.id_cita);
          if (consulta) {
            consultasMap[cita.id_cita] = consulta;
          }
        }
        setConsultasPorCita(consultasMap);

        setIsLoadingCitas(false);
      } else {
        setCitasPaciente([]);
        setConsultasPorCita({});
      }
    };

    cargarCitas();
  }, [selectedPatientId]);

  // Pacientes filtrados
  const pacientesFiltrados = searchTerm
    ? pacientes
    : pacientes;

  // Toggle expansión de paciente
  const handleToggleExpand = (id: number) => {
    if (expandedPatientId === id) {
      setExpandedPatientId(null);
      setSelectedPatientId(null);
    } else {
      setExpandedPatientId(id);
      setSelectedPatientId(id);
    }
  };

  // Preparar edición de paciente
  const handleEditPatient = (paciente: Paciente) => {
    setNewPatient({
      nombres: paciente.nombres,
      apellidos: paciente.apellidos,
      fecha_nacimiento: paciente.fecha_nacimiento || '',
      sexo: paciente.sexo,
      cedula: paciente.cedula,
      email: paciente.email || '',
      telefono: paciente.telefono || '',
      direccion: paciente.direccion || '',
    });
    setIsEditingPatient(true);
    setIsNewPatientDialogOpen(true);
  };


  // Crear nuevo paciente
  const handleCreatePatient = async () => {
    // Validar todos los campos obligatorios
    const { nombres, apellidos, cedula, fecha_nacimiento, email, telefono, direccion } = newPatient;
    if (!nombres || !apellidos || !cedula || !fecha_nacimiento || !email || !telefono || !direccion) {
      toast.error('Todos los campos son obligatorios');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Por favor ingrese un correo electrónico válido');
      return;
    }

    // Validar formato de teléfono (+5939XXXXXXXX)
    const phoneRegex = /^\+5939\d{8}$/;
    if (!phoneRegex.test(telefono)) {
      toast.error('El teléfono debe tener el formato +5939XXXXXXXX (13 caracteres)');
      return;
    }

    if (!idCompania) {
      toast.error('Error: No se pudo obtener la compañía actual');
      return;
    }

    try {
      if (isEditingPatient && selectedPatientId) {
        const success = await actualizarPaciente(selectedPatientId, {
          ...newPatient,
          email: newPatient.email || null,
          telefono: newPatient.telefono || null,
          direccion: newPatient.direccion || null,
        });

        if (success) {
          toast.success('Paciente actualizado exitosamente');
          setIsNewPatientDialogOpen(false);
          setIsEditingPatient(false);
        } else {
          toast.error('Error al actualizar paciente');
        }
      } else {
        const nuevoPaciente = await crearPaciente({
          ...newPatient,
          id_compania: idCompania,
          email: newPatient.email || null,
          telefono: newPatient.telefono || null,
          direccion: newPatient.direccion || null,
          fecha_registro: new Date().toISOString().split('T')[0],
          estado: 'activo'
        });

        if (nuevoPaciente) {
          toast.success('Paciente creado exitosamente');
          setIsNewPatientDialogOpen(false);
          setNewPatient({
            nombres: '',
            apellidos: '',
            fecha_nacimiento: '',
            sexo: 'M',
            cedula: '',
            email: '',
            telefono: '',
            direccion: '',
          });
        } else {
          toast.error('Error al crear paciente');
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'CEDULA_DUPLICADA') {
        toast.error(`Ya existe un paciente con la cédula ${newPatient.cedula} en esta compañía. Buscando paciente existente...`, {
          duration: 5000
        });
        setIsNewPatientDialogOpen(false);
        // Buscar el paciente automáticamente
        await buscarPacientes(newPatient.cedula);
      } else {
        toast.error('Error al crear paciente');
      }
    }
  };

  // Guardar signos vitales
  const handleSaveSignosVitales = async () => {
    if (!selectedPatientId) {
      toast.error('No hay paciente seleccionado');
      return;
    }

    // Validar y limpiar todos los valores numéricos para evitar overflow
    const validarNumero = (valor: string | undefined, esDecimal: boolean = false): number | null => {
      if (!valor || valor.trim() === '') return null;
      const num = esDecimal ? parseFloat(valor) : parseInt(valor);
      if (isNaN(num)) return null;
      // Limitar a 999.99 máximo (NUMERIC(5,2))
      return Math.min(999.99, Math.max(-999.99, Math.round(num * 100) / 100));
    };

    const peso = validarNumero(signosVitalesForm.peso_kg, true);
    const estatura = validarNumero(signosVitalesForm.estatura_cm, true);

    const signoVital: Omit<SignoVital, 'id_signo_vital' | 'created_at'> = {
      id_paciente: selectedPatientId,
      fecha_registro: new Date().toISOString(),
      estatura_cm: estatura,
      peso_kg: peso,
      imc: estatura && peso ? calcularIMC(peso, estatura) : null,
      perimetro_cefalico_cm: validarNumero(signosVitalesForm.perimetro_cefalico_cm, true),
      temperatura_c: validarNumero(signosVitalesForm.temperatura_c, true),
      frecuencia_respiratoria: validarNumero(signosVitalesForm.frecuencia_respiratoria, false),
      frecuencia_cardiaca: validarNumero(signosVitalesForm.frecuencia_cardiaca, false),
      presion_sistolica: validarNumero(signosVitalesForm.presion_sistolica, false),
      presion_diastolica: validarNumero(signosVitalesForm.presion_diastolica, false),
      saturacion_oxigeno: validarNumero(signosVitalesForm.saturacion_oxigeno, true),
      glucosa_mg_dl: validarNumero(signosVitalesForm.glucosa_mg_dl, false),
      glasgow_ocular: validarNumero(signosVitalesForm.glasgow_ocular, false),
      glasgow_verbal: validarNumero(signosVitalesForm.glasgow_verbal, false),
      glasgow_motora: validarNumero(signosVitalesForm.glasgow_motora, false),
      reaccion_pupilar: signosVitalesForm.reaccion_pupilar || null,
      tiempo_llenado_capilar_seg: validarNumero(signosVitalesForm.tiempo_llenado_capilar_seg, true),
      notas: signosVitalesForm.notas || null
    };

    // Debug: Verificar valores antes de enviar
    console.log('Valores de signos vitales a guardar:', signoVital);

    const resultado = await guardarSignoVital(signoVital);

    if (resultado) {
      toast.success('Constantes vitales y antropometría guardadas exitosamente');
      setIsSignosVitalesDialogOpen(false);
      // Limpiar formulario
      setSignosVitalesForm({
        estatura_cm: '',
        peso_kg: '',
        perimetro_cefalico_cm: '',
        temperatura_c: '',
        frecuencia_respiratoria: '',
        frecuencia_cardiaca: '',
        presion_sistolica: '',
        presion_diastolica: '',
        saturacion_oxigeno: '',
        glucosa_mg_dl: '',
        glasgow_ocular: '',
        glasgow_verbal: '',
        glasgow_motora: '',
        reaccion_pupilar: '',
        tiempo_llenado_capilar_seg: '',
        notas: ''
      });
    } else {
      toast.error('Error al guardar constantes vitales y antropometría');
    }
  };

  // Obtener signo vital actual de un paciente según el índice
  const getSignoVitalActual = (pacienteId: number): SignoVital | null => {
    if (pacienteId === selectedPatientId && signosVitales.length > 0) {
      const index = signosVitalesIndex[pacienteId] || 0;
      return signosVitales[index] || signosVitales[0];
    }
    return null;
  };

  // Navegar entre signos vitales
  const navegarSignosVitales = (pacienteId: number, direccion: 'prev' | 'next') => {
    const currentIndex = signosVitalesIndex[pacienteId] || 0;
    const maxIndex = signosVitales.length - 1;

    if (direccion === 'prev' && currentIndex > 0) {
      setSignosVitalesIndex({ ...signosVitalesIndex, [pacienteId]: currentIndex - 1 });
    } else if (direccion === 'next' && currentIndex < maxIndex) {
      setSignosVitalesIndex({ ...signosVitalesIndex, [pacienteId]: currentIndex + 1 });
    }
  };

  // Abrir diálogo de consulta
  const handleAbrirConsulta = (citaId?: number) => {
    if (!selectedPatientId) {
      toast.error('No hay paciente seleccionado');
      return;
    }

    if (isLoadingAntecedentes) {
      toast.error('Cargando antecedentes del paciente, intenta nuevamente en unos segundos');
      return;
    }

    if (!tieneAntecedentesPersonalesCompletos(antecedentesData)) {
      toast.error('Complete los antecedentes patológicos personales (clínicos, traumatológicos, pediátricos, quirúrgicos y otros) antes de iniciar la consulta');
      return;
    }

    if (!tieneFamiliaresCompletos(antecedentesData)) {
      toast.error('Complete los antecedentes patológicos familiares antes de iniciar la consulta. Si no hay antecedentes, ingrese "Sin antecedentes familiares"');
      return;
    }

    if (!tieneAlergiasRegistradas(antecedentesData)) {
      toast.error('Registre las alergias del paciente antes de iniciar la consulta. Si no presenta alergias, ingrese "Sin alergias registradas"');
      return;
    }

    const proximaCitaId = citaId || null;
    const draftKey = `${selectedPatientId}-${proximaCitaId ?? 'sin-cita'}`;
    const mantenerBorrador = consultaDraftKey === draftKey;

    if (!mantenerBorrador) {
      setConsultaForm(createEmptyConsultaForm());
      setExamenFisicoSeleccionados([]);
      setNotasExamenFisico({});
      setSolicitudImagenForm(createEmptySolicitudImagenForm());
      setSolicitudImagenActual(null);
      setCodigoCie10Input('');
      setDiagnosticosCie10([]);
      resetLaboratorioState();
      if (sucursales.length > 0) {
        setSucursalSeleccionada(sucursales[0].id_sucursal);
      }
    }

    setCitaIdParaConsulta(proximaCitaId);
    setConsultaDraftKey(draftKey);
    setIsConsultaScreenOpen(true);
  };

  // Ver detalles de consulta médica
  const handleVerConsulta = (consulta: ConsultaMedica) => {
    setConsultaSeleccionada(consulta);
    setIsVerConsultaDialogOpen(true);
  };

  useEffect(() => {
    if (!isVerConsultaDialogOpen || !consultaSeleccionada?.id_cita) {
      setSolicitudImagenDetalle(null);
      setPedidoLaboratorioDetalle(null);
      setInterconsultasDetalle([]);
      return;
    }

    let activo = true;

    const cargarDetalleRelacionado = async () => {
      setIsLoadingDetalleConsulta(true);
      try {
        const [imagen, laboratorio, interconsultas] = await Promise.all([
          getSolicitudImagenByCita(consultaSeleccionada.id_cita),
          getPedidoLaboratorioByCita(consultaSeleccionada.id_cita),
          getInterconsultasByConsulta(consultaSeleccionada.id_consulta_medica),
        ]);

        if (!activo) return;
        setSolicitudImagenDetalle(imagen);
        setPedidoLaboratorioDetalle(laboratorio);
        setInterconsultasDetalle(interconsultas);
      } catch (error) {
        console.error('❌ Error al cargar detalle completo de la consulta:', error);
      } finally {
        if (activo) {
          setIsLoadingDetalleConsulta(false);
        }
      }
    };

    cargarDetalleRelacionado();

    return () => {
      activo = false;
    };
  }, [isVerConsultaDialogOpen, consultaSeleccionada?.id_cita]);

  // Abrir confirmación de No Asistió
  const handleMarcarNoAsistio = (citaId: number) => {
    setCitaParaNoAsistio(citaId);
    setIsNoAsistioConfirmOpen(true);
  };

  // Confirmar y ejecutar el cambio de estado a no_asistio
  const handleConfirmarNoAsistio = async () => {
    if (!citaParaNoAsistio || !selectedPatientId) return;
    try {
      const success = await updateCita(citaParaNoAsistio, { estado_cita: 'no_asistio' });
      if (success) {
        toast.success('Cita marcada como No Asistió');
        const citasActualizadas = await getCitasByPaciente(selectedPatientId);
        setCitasPaciente(citasActualizadas);
      } else {
        toast.error('Error al actualizar el estado de la cita');
      }
    } catch (error) {
      console.error('❌ Error al marcar no asistió:', error);
      toast.error('Error inesperado al actualizar la cita');
    } finally {
      setIsNoAsistioConfirmOpen(false);
      setCitaParaNoAsistio(null);
    }
  };

  // Guardar o actualizar antecedentes del paciente
  const handleActualizarAntecedentes = async (pacienteIdStr: string, seccion: string, datos: any) => {
    const pacienteId = parseInt(pacienteIdStr);

    if (!pacienteId) {
      toast.error('ID de paciente inválido');
      return;
    }

    // Mapeo de claves a nombres legibles para mensajes
    const nombresLegibles: Record<string, string> = {
      esquemaVacunacion: 'Esquema de Vacunación',
      alergias: 'Alergias',
      antecedentesPatologicosPersonalesFamiliares: 'Antecedentes patológicos personales y familiares',
      antecedentesPatologicos: 'Antecedentes patológicos personales',
      antecedentesNoPatologicos: 'Hábitos',
      antecedentesHeredofamiliares: 'Antecedentes patológicos familiares',
      antecedentesGineco: 'Antecedentes Gineco-Obstétricos',
      antecedentesperinatales: 'Antecedentes Perinatales',
      antecedentesPostnatales: 'Antecedentes Postnatales',
      antecedentesPsiquiatricos: 'Antecedentes Psiquiátricos',
      vacunas: 'Vacunas',
      medicamentos: 'Medicamentos Activos',
      dietaNutriologica: 'Dieta Nutriológica'
    };

    const nombreLegible = nombresLegibles[seccion] || seccion;

    try {
      console.log('💾 Guardando antecedente:', { pacienteId, seccion, datos });

      // Guardar usando la nueva API de kv_store
      const success = await saveAntecedente(pacienteId, seccion, datos);

      if (success) {
        toast.success(`${nombreLegible} guardado correctamente`);
        // Recargar antecedentes
        await recargarAntecedentes(pacienteId);
      } else {
        toast.error('Error al guardar antecedente');
      }
    } catch (error) {
      console.error('❌ Error al guardar antecedente:', error);
      toast.error('Error al guardar los datos');
    }
  };

  // Función auxiliar para recargar antecedentes
  const recargarAntecedentes = async (pacienteId: number) => {
    try {
      const antecedentes = await getAntecedentesByPaciente(pacienteId);
      setAntecedentesData(antecedentes);
    } catch (error) {
      console.error('Error al recargar antecedentes:', error);
    }
  };

  // Agregar diagnóstico por código CIE-10 o descripción clínica
  const handleAgregarDiagnosticoIA = async () => {
    const input = codigoCie10Input.trim();
    if (!input) {
      toast.error('Ingrese un código CIE-10 o una descripción clínica');
      return;
    }

    // Detecta si el usuario ingresó un código o una descripción
    const esCodigo = /^[A-Z][0-9]{2}(\.[0-9A-Z]{0,4})?$/i.test(input.replace(/\s+/g, ''));
    const query = esCodigo ? input.toUpperCase().replace(/\s+/g, '') : input;

    setIsLoadingDiagnosticoIA(true);

    try {
      let diagnosticoIA: DiagnosticoCie10 | null = null;
      const openAIKey = typeof import.meta.env.VITE_OPENAI_API_KEY === 'string'
        ? import.meta.env.VITE_OPENAI_API_KEY.trim()
        : '';

      try {
        if (import.meta.env.DEV && openAIKey) {
          // Desarrollo local sin Vercel: consumir OpenAI directamente
          console.log('🚀 Desarrollo local: consultando OpenAI directo');
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openAIKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              temperature: 0.2,
              messages: [
                {
                  role: 'system',
                  content: `Eres un asistente médico experto en clasificación diagnóstica CIE-10.
El médico puede ingresar un código CIE-10 (ej: J30.9) o una descripción clínica/síntoma (ej: dolor abdominal).
Responde ÚNICAMENTE con JSON válido sin markdown:
{"diagnostico":{"codigo":"X00.0","nombre":"Nombre CIE-10","descripcion":"Descripción clínica breve"}}
Si no puedes resolverlo, responde: {"error":"Mensaje de error"}`
                },
                {
                  role: 'user',
                  content: esCodigo
                    ? `Código CIE-10: ${query}`
                    : `Descripción clínica ingresada por el médico: ${query}`
                }
              ]
            })
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(`[HTTP ${response.status}] ${payload?.error?.message || payload?.error || 'Error al consultar OpenAI'}`);
          }

          const rawContent = payload?.choices?.[0]?.message?.content;
          if (!rawContent) {
            throw new Error('Respuesta vacía de OpenAI');
          }

          const cleaned = String(rawContent).replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
          const parsed = JSON.parse(cleaned) as { diagnostico?: DiagnosticoCie10; error?: string };

          if (parsed?.error) {
            throw new Error(parsed.error);
          }

          diagnosticoIA = parsed?.diagnostico || null;
        } else {
          // Producción o fallback sin clave VITE: consumir endpoint serverless
          console.log('🚀 Consultando /api/diagnostico-ia');
          const res = await fetch('/api/diagnostico-ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(`[HTTP ${res.status}] ${data.error || 'Error al obtener diagnóstico IA'}`);
          }

          diagnosticoIA = data.diagnostico || null;
        }
      } catch (apiError) {
        // Fallback al catálogo local solo si el input era un código conocido
        const referenciaLocal = esCodigo ? DIAGNOSTICOS_CIE10_REFERENCIA[query] : null;
        if (referenciaLocal) {
          diagnosticoIA = referenciaLocal;
          if (import.meta.env.DEV) {
            toast.success('⚠️ Usando catálogo local de referencia (modo desarrollo)');
          }
        } else {
          if (import.meta.env.DEV) {
            toast.error('No se pudo consultar IA en local. Verifica VITE_OPENAI_API_KEY en el .env y reinicia npm run dev.');
            return;
          }
          throw apiError;
        }
      }

      if (!diagnosticoIA) {
        toast.error('No se pudo obtener la descripción del código CIE-10');
        return;
      }

      const yaExiste = diagnosticosCie10.some(d => d.codigo === diagnosticoIA.codigo);
      if (yaExiste) {
        toast.error('Ese código CIE-10 ya fue agregado');
        return;
      }

      const nuevosDiagnosticos = [...diagnosticosCie10, diagnosticoIA];
      setDiagnosticosCie10(nuevosDiagnosticos);
      setConsultaForm({
        ...consultaForm,
        diagnostico: nuevosDiagnosticos.map(d => `${d.codigo} - ${d.nombre}: ${d.descripcion}`).join('\n')
      });
      setCodigoCie10Input('');
      toast.success('Diagnóstico CIE-10 agregado');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión con el servicio de IA');
    } finally {
      setIsLoadingDiagnosticoIA(false);
    }
  };

  // Guardar consulta médica
  const handleGuardarConsulta = async () => {
    if (!selectedPatientId || !currentUser) {
      toast.error('No hay paciente o usuario seleccionado');
      return;
    }

    // Validar que el motivo de consulta esté completo
    if (!consultaForm.motivo_consulta.trim()) {
      toast.error('El motivo de consulta es obligatorio');
      return;
    }

    // Validar que la receta médica esté ingresada
    if (!consultaForm.receta_rp.trim() && !consultaForm.receta_indicaciones.trim()) {
      toast.error('La receta médica es obligatoria. Complete el campo Rp o Indicaciones antes de guardar.');
      return;
    }

    // Validar que al menos un campo adicional esté completo
    if (!consultaForm.historial_clinico && !resumenReceta && !consultaForm.pedido_examenes && examenesLaboratorioSeleccionados.length === 0) {
      toast.error('Por favor, complete al menos un campo adicional (historial, receta o examen físico)');
      return;
    }

    // Validar que haya una sucursal seleccionada
    if (!sucursalSeleccionada) {
      toast.error('Por favor, seleccione una sucursal');
      return;
    }

    if (examenesLaboratorioSeleccionados.length > 0 && !medicoLaboratorioSeleccionado) {
      toast.error('Seleccione el médico para el pedido de laboratorio');
      return;
    }

    setIsSavingConsulta(true);

    try {
      console.log('Iniciando guardado de consulta...');

      // Obtener el ID del usuario actual desde Supabase
      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuario')
        .select('id_usuario, nombre, apellido')
        .eq('email', currentUser.email)
        .single() as any;

      if (usuarioError || !usuarioData) {
        console.error('Error al obtener usuario:', usuarioError);
        toast.error('No se pudo obtener información del usuario');
        setIsSavingConsulta(false);
        return;
      }

      const pacienteActual = pacientes.find((p: Paciente) => p.id_paciente === selectedPatientId) || null;
      const nombrePacienteSolicitud = pacienteActual
        ? `${pacienteActual.nombres} ${pacienteActual.apellidos}`.trim()
        : 'PACIENTE SIN NOMBRE';
      const edadPacienteSolicitud = pacienteActual ? calcularEdad(pacienteActual.fecha_nacimiento) : null;

      console.log('Usuario obtenido:', usuarioData);

      let idCitaParaConsulta = citaIdParaConsulta || citaIdInicial;
      if (!idCitaParaConsulta) {
        idCitaParaConsulta = await ensureCitaParaConsulta();
      }

      if (!idCitaParaConsulta) {
        toast.error('Error: No se pudo obtener el ID de la cita');
        setIsSavingConsulta(false);
        return;
      }

      const consultaPayload = {
        historial_clinico: consultaForm.historial_clinico || null,
        diagnostico: consultaForm.diagnostico || null,
        diagnostico_ia: consultaForm.diagnostico || null,
        receta_medica: resumenReceta || null,
        receta_rp: consultaForm.receta_rp || null,
        receta_indicaciones: consultaForm.receta_indicaciones || null,
        pedido_examenes: consultaForm.pedido_examenes || null,
        observaciones: null,
        fecha_seguimiento: consultaForm.fecha_seguimiento || null,
        pedido_hospitalizacion: consultaForm.pedido_hospitalizacion || null
      };

      const consultaExistente = await getConsultaMedicaByCita(idCitaParaConsulta);
      let nuevaConsulta = consultaExistente
        ? await actualizarConsultaMedica(consultaExistente.id_consulta_medica, consultaPayload)
        : await crearConsultaMedica({
            id_cita: idCitaParaConsulta,
            id_paciente: selectedPatientId,
            id_usuario: usuarioData.id_usuario,
            ...consultaPayload,
          });

      if (nuevaConsulta) {
        if (examenesLaboratorioSeleccionadosData.length > 0 && medicoLaboratorioActual) {
          const pedidoLaboratorio = await createPedidoLaboratorio({
            id_cita: idCitaParaConsulta,
            id_paciente: selectedPatientId,
            id_sucursal: sucursalSeleccionada,
            id_usuario_solicitante: usuarioData.id_usuario,
            id_usuario_sucursal_medico: medicoLaboratorioActual.id_usuario_sucursal,
            observaciones: observacionesLaboratorio || null,
            examenes: examenesLaboratorioSeleccionadosData.map((examen) => examen.id_examen_laboratorio),
          });

          if (!pedidoLaboratorio) {
            toast.error('La consulta se guardó, pero no se pudo generar el pedido de laboratorio');
            setIsSavingConsulta(false);
            return;
          }

          setPedidoLaboratorioActual(pedidoLaboratorio);
        }

        if (solicitudImagenTieneContenido(solicitudImagenForm)) {
          const solicitudImagen = await upsertSolicitudImagen({
            id_cita: idCitaParaConsulta,
            id_paciente: selectedPatientId,
            id_sucursal: sucursalSeleccionada,
            id_usuario_solicitante: usuarioData.id_usuario,
            fecha_solicitud: solicitudImagenForm.fecha_solicitud,
            nombre_paciente: nombrePacienteSolicitud,
            edad_paciente: edadPacienteSolicitud,
            procedimiento: solicitudImagenForm.procedimiento,
            antecedentes_clinico_quirurgico: solicitudImagenForm.antecedentes_clinico_quirurgico,
            cuadro_clinico: solicitudImagenForm.cuadro_clinico,
            medicamentos: solicitudImagenForm.medicamentos,
            alergias: alergiasDesdeAntecedentesTexto,
          });

          if (!solicitudImagen) {
            toast.error('La consulta se guardó, pero no se pudo registrar la solicitud de imagen');
            setIsSavingConsulta(false);
            return;
          }

          setSolicitudImagenActual(solicitudImagen);
        }

        // Si la cita ya existía (vino desde la agenda), actualizar su estado a "atendida"
        if (idCitaParaConsulta) {
          const marcada = await marcarCitaCompletada(idCitaParaConsulta, usuarioData.id_usuario);
          if (!marcada) {
            console.error('⚠️ La consulta se guardó pero no se pudo actualizar el estado de la cita a "atendida"');
          }
          // Si la cita proviene de una interconsulta, marcarla como ATENDIDO
          const interconsulta = await getInterconsultaByCita(idCitaParaConsulta);
          if (interconsulta && interconsulta.estado !== 'ATENDIDO') {
            await updateEstadoInterconsulta(interconsulta.id_interconsulta, 'ATENDIDO');
          }
        }

        // Recargar las citas del paciente
        const citasActualizadas = await getCitasByPaciente(selectedPatientId);
        setCitasPaciente(citasActualizadas);

        // Recargar consultas
        const consultasMap: Record<number, ConsultaMedica> = {};
        for (const cita of citasActualizadas) {
          const consulta = await getConsultaMedicaByCita(cita.id_cita);
          if (consulta) {
            consultasMap[cita.id_cita] = consulta;
          }
        }
        setConsultasPorCita(consultasMap);

        toast.success('Consulta guardada exitosamente');
        setIsConsultaScreenOpen(false);
        setConsultaDraftKey(null);

        // Limpiar formulario
        setConsultaForm(createEmptyConsultaForm());
        setExamenFisicoSeleccionados([]);
        setNotasExamenFisico({});
        setSolicitudImagenForm(createEmptySolicitudImagenForm());
        setSolicitudImagenActual(null);
        setCodigoCie10Input('');
        setDiagnosticosCie10([]);
        resetLaboratorioState();

        // Llamar callback si existe
        if (onConsultaCompletada) {
          onConsultaCompletada();
        }
      } else {
        toast.error('Error al guardar la consulta');
      }
    } catch (error) {
      console.error('Error al guardar consulta:', error);
      toast.error('Error inesperado al guardar la consulta');
    } finally {
      setIsSavingConsulta(false);
    }
  };

  const escapeHtml = (valor: string): string => valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const handleImprimirSolicitudImagenDesdeConsulta = async () => {
    const pacienteData = pacienteSeleccionado;
    if (!pacienteData) {
      toast.error('No hay paciente seleccionado para imprimir');
      return;
    }

    // Si ya tenemos número de solicitud, imprimir directo
    if (solicitudImagenActual?.numero_solicitud_imagen) {
      handleImprimirSolicitudImagen(solicitudImagenActual, pacienteData);
      return;
    }

    // Si el form tiene contenido, forzar guardado para obtener número
    if (solicitudImagenTieneContenido(solicitudImagenForm)) {
      try {
        const idCita = await ensureCitaParaConsulta();
        const usuarioId = await resolveUsuarioConsulta();
        if (idCita && usuarioId && sucursalSeleccionada) {
          const solicitudGuardada = await upsertSolicitudImagen({
            id_cita: idCita,
            id_paciente: selectedPatientId!,
            id_sucursal: sucursalSeleccionada,
            id_usuario_solicitante: usuarioId,
            fecha_solicitud: solicitudImagenForm.fecha_solicitud,
            nombre_paciente: `${pacienteData.nombres} ${pacienteData.apellidos}`.trim(),
            edad_paciente: calcularEdad(pacienteData.fecha_nacimiento),
            procedimiento: solicitudImagenForm.procedimiento,
            antecedentes_clinico_quirurgico: solicitudImagenForm.antecedentes_clinico_quirurgico,
            cuadro_clinico: solicitudImagenForm.cuadro_clinico,
            medicamentos: solicitudImagenForm.medicamentos,
            alergias: alergiasDesdeAntecedentesTexto,
          });
          if (solicitudGuardada) {
            setSolicitudImagenActual(solicitudGuardada);
            handleImprimirSolicitudImagen(solicitudGuardada, pacienteData);
            return;
          }
        }
      } catch (error) {
        console.error('❌ Error al guardar solicitud antes de imprimir:', error);
      }
    }

    // Fallback: imprimir con lo que hay (sin número)
    handleImprimirSolicitudImagen(solicitudImagenActual, pacienteData);
  };

  const handleImprimirSolicitudImagen = (
    solicitudData: SolicitudImagen | null = solicitudImagenActual,
    pacienteData: Paciente | null = pacienteSeleccionado,
  ) => {
    if (!pacienteData) {
      toast.error('No hay paciente seleccionado para imprimir');
      return;
    }

    const nombrePaciente = pacienteData
      ? `${pacienteData.nombres} ${pacienteData.apellidos}`.trim()
      : 'PACIENTE SIN NOMBRE';
    const edadPaciente = solicitudData?.edad_paciente != null
      ? String(solicitudData.edad_paciente)
      : `${calcularEdad(pacienteData.fecha_nacimiento)}`;
    const numeroSolicitud = solicitudData?.numero_solicitud_imagen
      ? String(solicitudData.numero_solicitud_imagen).padStart(7, '0')
      : '';

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
    .campo-edad { max-width: 220px; }
    @page { margin: 8mm; }
    @media print { body { margin: 0; } .doc { border: none; padding: 8px 10px; } }
  </style>
</head>
<body>
  <div class="doc">
    <div class="header">
      <div>
        <span class="titulo">SOLICITUD DE IMAGEN</span>
        ${numeroSolicitud ? `<span class="numero">N° ${escapeHtml(numeroSolicitud)}</span>` : ''}
      </div>
      <img src="${logoClinicaAtlas}" alt="Clinicas Atlas" class="logo" />
    </div>

    <div class="fila">
      <div class="campo">
        <span class="label">Nombre:</span>
        <span class="linea inline">${escapeHtml(nombrePaciente)}</span>
      </div>
    </div>

    <div class="fila-datos">
      <div class="campo campo-fecha">
        <span class="label">Fecha:</span>
        <span class="linea inline corta">${escapeHtml(solicitudData?.fecha_solicitud || solicitudImagenForm.fecha_solicitud || formatDateLocal(new Date()))}</span>
      </div>
      <div class="campo campo-edad">
        <span class="label">Edad:</span>
        <span class="linea inline corta">${escapeHtml(edadPaciente)}</span>
      </div>
    </div>

    <div class="fila"><div class="campo"><span class="label">Procedimiento:</span><div class="linea">${escapeHtml(solicitudData?.procedimiento || solicitudImagenForm.procedimiento)}</div></div></div>
    <div class="fila"><div class="campo"><span class="label">Antecedentes Clinico - Quirurgico:</span><div class="linea">${escapeHtml(solicitudData?.antecedentes_clinico_quirurgico || solicitudImagenForm.antecedentes_clinico_quirurgico)}</div></div></div>
    <div class="fila"><div class="campo"><span class="label">Cuadro Clinico:</span><div class="linea">${escapeHtml(solicitudData?.cuadro_clinico || solicitudImagenForm.cuadro_clinico)}</div></div></div>

    <div class="fila">
      <div class="campo"><span class="label">Medicamentos:</span><div class="linea">${escapeHtml(solicitudData?.medicamentos || solicitudImagenForm.medicamentos)}</div></div>
      <div class="campo"><span class="label">Alergias:</span><div class="linea">${escapeHtml(solicitudData?.alergias || alergiasDesdeAntecedentesTexto)}</div></div>
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión. Verifica el bloqueador de popups.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(contenido);
    printWindow.document.close();

    // Esperar a que el logo cargue para evitar impresión sin imagen.
    const imprimir = () => {
      printWindow.focus();
      printWindow.print();
    };

    const logo = printWindow.document.querySelector('img.logo') as HTMLImageElement | null;
    if (logo && !logo.complete) {
      logo.onload = imprimir;
      logo.onerror = imprimir;
      return;
    }

    imprimir();
  };

  const handleImprimirInterconsulta = (
    interconsultaData: InterconsultaCompleta,
    pacienteData: Paciente | null = pacienteSeleccionado,
  ) => {
    if (!pacienteData) {
      toast.error('No hay paciente seleccionado para imprimir');
      return;
    }

    const nombrePaciente = `${pacienteData.nombres} ${pacienteData.apellidos}`.trim() || 'PACIENTE SIN NOMBRE';
    const edadPaciente = `${calcularEdad(pacienteData.fecha_nacimiento)}`;
    const numeroInterconsulta = interconsultaData.numero_interconsulta
      ? String(interconsultaData.numero_interconsulta).padStart(7, '0')
      : '';
    const especialidadCatalogo = interconsultaData.id_especialidad_destino
      ? especialidadesInterconsulta.find((e) => e.id_especialidad === interconsultaData.id_especialidad_destino)?.nombre
      : '';
    const especialidadDestino = interconsultaData.tipo_destino === 'interno'
      ? interconsultaData.especialidad?.nombre || especialidadCatalogo || ''
      : interconsultaData.especialidad_destino_texto || '';
    const fechaSolicitud = interconsultaData.created_at
      ? formatDateLocal(new Date(interconsultaData.created_at))
      : formatDateLocal(new Date());

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
    .campo-edad { max-width: 220px; }
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

    <div class="fila">
      <div class="campo">
        <span class="label">Nombre:</span>
        <span class="linea inline">${escapeHtml(nombrePaciente)}</span>
      </div>
    </div>

    <div class="fila-datos">
      <div class="campo campo-fecha">
        <span class="label">Fecha:</span>
        <span class="linea inline corta">${escapeHtml(fechaSolicitud)}</span>
      </div>
      <div class="campo campo-edad">
        <span class="label">Edad:</span>
        <span class="linea inline corta">${escapeHtml(edadPaciente)}</span>
      </div>
    </div>

    <div class="fila"><div class="campo"><span class="label">Especialidad destino:</span><div class="linea">${escapeHtml(especialidadDestino)}</div></div></div>
    <div class="fila"><div class="campo"><span class="label">Motivo:</span><div class="linea">${escapeHtml(interconsultaData.motivo || '')}</div></div></div>
    <div class="fila"><div class="campo"><span class="label">Resumen Clinico:</span><div class="linea">${escapeHtml(interconsultaData.resumen_clinico || '')}</div></div></div>

    <div class="fila">
      <div class="campo"><span class="label">Urgencia:</span><div class="linea">${escapeHtml(interconsultaData.urgencia === 'urgente' ? 'URGENTE' : 'NORMAL')}</div></div>
      <div class="campo"><span class="label">Estado:</span><div class="linea">${escapeHtml(getInterconsultaEstadoLabel(interconsultaData.estado))}</div></div>
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión. Verifica el bloqueador de popups.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(contenido);
    printWindow.document.close();

    const imprimir = () => {
      printWindow.focus();
      printWindow.print();
    };

    const logo = printWindow.document.querySelector('img.logo') as HTMLImageElement | null;
    if (logo && !logo.complete) {
      logo.onload = imprimir;
      logo.onerror = imprimir;
      return;
    }

    imprimir();
  };

  const handleImprimirReceta = async (
    consultaData: ConsultaMedica | null = null,
    pacienteData: Paciente | null = pacienteSeleccionado,
  ) => {
    if (!pacienteData) {
      toast.error('No hay paciente seleccionado para imprimir la receta');
      return;
    }

    const recetaRp = consultaData?.receta_rp || consultaForm.receta_rp;
    const recetaIndicaciones = consultaData?.receta_indicaciones || consultaForm.receta_indicaciones;

    if (!recetaRp.trim() && !recetaIndicaciones.trim()) {
      toast.error('Complete RP o Indicaciones para imprimir la receta');
      return;
    }

    const nombreCompleto = `${pacienteData.nombres} ${pacienteData.apellidos}`.trim().toUpperCase();
    const edadTexto = `${calcularEdad(pacienteData.fecha_nacimiento)}`;
    const diagnosticoTexto = (consultaData?.diagnostico || consultaForm.diagnostico).trim().toUpperCase();
    const codigosCie = !consultaData && diagnosticosCie10.length > 0
      ? diagnosticosCie10.map((d) => d.codigo).join(', ')
      : (diagnosticoTexto.match(/[A-Z]\d{2}(?:\.\d+)?/g) || []).join(', ');
    const alergiasTexto = alergiasDesdeAntecedentesTexto;

    // Obtener o asignar número de receta independiente
    let idConsultaMedica: number | null = consultaData?.id_consulta_medica ?? null;
    if (!idConsultaMedica) {
      const idCita = citaIdParaConsulta || citaIdInicial || citaConsultaActual?.id_cita;
      if (idCita) {
        const consultaDB = await getConsultaMedicaByCita(idCita);
        idConsultaMedica = consultaDB?.id_consulta_medica ?? null;
      }
    }
    let numeroReceta: number | null = null;
    if (idConsultaMedica) {
      numeroReceta = await getOrAssignNumeroReceta(idConsultaMedica);
    }
    const rpTexto = recetaRp.trim().toUpperCase();
    const indicacionesTexto = recetaIndicaciones.trim().toUpperCase();
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([841.89, 595.28]); // A4 horizontal en puntos
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let logoImage: any = null;
      try {
        const logoBytes = await fetch(logoClinicaAtlas).then((res) => res.arrayBuffer());
        logoImage = await pdfDoc.embedPng(logoBytes);
      } catch (error) {
        console.warn('No se pudo incrustar el logotipo en PDF:', error);
      }

      const margin = 20;
      const panelGap = 8;
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const panelWidth = (pageWidth - margin * 2 - panelGap) / 2;
      const panelTop = pageHeight - margin;
      const panelBottom = margin;
      const footerLines = [
        'Av. Francisco Hernandez de Giron N35-50 y Av. America',
        'Telefonos. 3520 157 / (099 509) 321 / 1700 633 425 ext. 1030 - 1040 - 1060',
        'www.clinicasatlas.med.ec',
      ];

      const measure = (text: string, textSize: number, useBold = false): number => {
        const f = useBold ? fontBold : font;
        return f.widthOfTextAtSize(text, textSize);
      };

      const truncate = (text: string, maxWidth: number, textSize: number): string => {
        const normalized = text.trim();
        if (!normalized) return '';
        if (measure(normalized, textSize) <= maxWidth) return normalized;

        let cut = normalized;
        while (cut.length > 1 && measure(`${cut}...`, textSize) > maxWidth) {
          cut = cut.slice(0, -1);
        }
        return `${cut}...`;
      };

      const wrapText = (text: string, maxWidth: number, textSize: number): string[] => {
        const chunks = text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (chunks.length === 0) return [];

        const lines: string[] = [];
        chunks.forEach((chunk) => {
          const words = chunk.split(/\s+/).filter(Boolean);
          let current = '';

          words.forEach((word) => {
            const candidate = current ? `${current} ${word}` : word;
            if (measure(candidate, textSize) <= maxWidth) {
              current = candidate;
            } else {
              if (current) lines.push(current);
              current = word;
            }
          });

          if (current) lines.push(current);
        });

        return lines;
      };

      const drawFooter = (startX: number): void => {
        const labelY = panelBottom + 52;
        const label = 'Firma y Sello:';
        const labelSize = 11;
        const footerTextSize = 8;

        page.drawText(label, {
          x: startX,
          y: labelY,
          size: labelSize,
          font,
          color: rgb(0.45, 0.45, 0.48),
        });

        const lineStart = startX + measure(label, labelSize) + 6;
        page.drawLine({
          start: { x: lineStart, y: labelY + 2 },
          end: { x: startX + panelWidth - 4, y: labelY + 2 },
          thickness: 0.8,
          color: rgb(0.78, 0.8, 0.83),
        });

        const centerX = startX + panelWidth / 2;
        let currentY = panelBottom + 30;
        footerLines.forEach((line) => {
          const textWidth = measure(line, footerTextSize);
          page.drawText(line, {
            x: centerX - textWidth / 2,
            y: currentY,
            size: footerTextSize,
            font,
            color: rgb(0.62, 0.64, 0.68),
          });
          currentY -= 10;
        });
      };

      const drawFieldLine = (
        startX: number,
        y: number,
        label: string,
        value: string,
        maxEndX: number,
      ): void => {
        const labelSize = 11;
        const valueSize = 10;
        page.drawText(label, {
          x: startX,
          y,
          size: labelSize,
          font,
          color: rgb(0.45, 0.45, 0.48),
        });

        const lineX = startX + measure(label, labelSize) + 6;
        page.drawLine({
          start: { x: lineX, y: y + 2 },
          end: { x: maxEndX, y: y + 2 },
          thickness: 0.8,
          color: rgb(0.78, 0.8, 0.83),
        });

        const clean = truncate(value, Math.max(20, maxEndX - lineX - 3), valueSize);
        if (clean) {
          page.drawText(clean, {
            x: lineX + 2,
            y: y + 4,
            size: valueSize,
            font,
            color: rgb(0.2, 0.23, 0.3),
          });
        }
      };

      const drawPanelBase = (startX: number): number => {
        if (logoImage) {
          const scale = Math.min(160 / logoImage.width, 36 / logoImage.height);
          page.drawImage(logoImage, {
            x: startX,
            y: panelTop - 36,
            width: logoImage.width * scale,
            height: logoImage.height * scale,
          });
        }

        const rightEdge = startX + panelWidth - 4;
        let currentY = panelTop - 64;

        const ageLabel = 'Edad:';
        const ageLabelWidth = measure(ageLabel, 11);
        const ageZone = 80;
        const ageStart = rightEdge - ageZone;

        drawFieldLine(startX, currentY, 'Nombres y apellidos:', nombreCompleto, ageStart - 10);
        drawFieldLine(ageStart, currentY, ageLabel, edadTexto, rightEdge);
        currentY -= 24;

        if (numeroReceta) {
          drawFieldLine(startX, currentY, 'No.Receta:', String(numeroReceta), rightEdge);
          currentY -= 24;
        }

        return currentY;
      };

      const drawRpPanel = (startX: number): void => {
        let currentY = drawPanelBase(startX);
        const rightEdge = startX + panelWidth - 4;

        const cieLabel = 'CIE-10:';
        const cieZone = 110;
        const cieStart = rightEdge - cieZone;

        drawFieldLine(startX, currentY, 'Diagnostico:', diagnosticoTexto, cieStart - 10);
        drawFieldLine(cieStart, currentY, cieLabel, codigosCie, rightEdge);
        currentY -= 24;

        drawFieldLine(startX, currentY, 'Alergias:', alergiasTexto, rightEdge);
        currentY -= 28;

        page.drawText('Rp:', {
          x: startX,
          y: currentY,
          size: 11,
          font,
          color: rgb(0.45, 0.45, 0.48),
        });

        const contentX = startX + measure('Rp:', 11) + 8;
        const maxWidth = rightEdge - contentX;
        const maxLines = 11;
        const wrapped = wrapText(rpTexto, maxWidth, 10).slice(0, maxLines);
        let textY = currentY;
        wrapped.forEach((line) => {
          page.drawText(line, {
            x: contentX,
            y: textY,
            size: 10,
            font,
            color: rgb(0.2, 0.23, 0.3),
          });
          textY -= 13;
        });

        drawFooter(startX);
      };

      const drawIndicacionesPanel = (startX: number): void => {
        let currentY = drawPanelBase(startX);
        const rightEdge = startX + panelWidth - 4;

        page.drawText('Indicaciones:', {
          x: startX,
          y: currentY,
          size: 11,
          font,
          color: rgb(0.45, 0.45, 0.48),
        });

        const contentX = startX + measure('Indicaciones:', 11) + 8;
        const maxWidth = rightEdge - contentX;
        const maxLines = 14;
        const wrapped = wrapText(indicacionesTexto, maxWidth, 10).slice(0, maxLines);
        let textY = currentY;
        wrapped.forEach((line) => {
          page.drawText(line, {
            x: contentX,
            y: textY,
            size: 10,
            font,
            color: rgb(0.2, 0.23, 0.3),
          });
          textY -= 13;
        });

        drawFooter(startX);
      };

      page.drawLine({
        start: { x: margin + panelWidth + panelGap / 2, y: panelBottom },
        end: { x: margin + panelWidth + panelGap / 2, y: panelTop },
        thickness: 0.8,
        color: rgb(0.9, 0.91, 0.93),
      });

      drawRpPanel(margin);
      drawIndicacionesPanel(margin + panelWidth + panelGap);

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = new ArrayBuffer(pdfBytes.length);
      new Uint8Array(pdfBuffer).set(pdfBytes);
      const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const pdfWindow = window.open(pdfUrl, '_blank');

      if (!pdfWindow) {
        URL.revokeObjectURL(pdfUrl);
        toast.error('No se pudo abrir el PDF. Verifica el bloqueador de popups.');
        return;
      }

      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (error) {
      console.error('Error al generar PDF de receta:', error);
      toast.error('No se pudo generar el PDF de la receta');
    }
  };

  const handleImprimirPedidoLaboratorio = (
    pedidoData: PedidoLaboratorioCompleto | null = pedidoLaboratorioActual,
    pacienteData: Paciente | null = pacienteSeleccionado,
    borradorData?: {
      examenes: ExamenLaboratorio[];
      medicoNombre?: string;
      observaciones?: string;
    },
  ) => {
    if (!pacienteData) {
      toast.error('No hay pedido de laboratorio para imprimir');
      return;
    }

    const examenesBorrador = borradorData?.examenes || [];
    const tienePedidoPersistido = !!pedidoData;

    if (!tienePedidoPersistido && examenesBorrador.length === 0) {
      toast.error('No hay exámenes seleccionados para imprimir');
      return;
    }

    const nombrePaciente = `${pacienteData.nombres} ${pacienteData.apellidos}`.trim();
    const edadPaciente = `${calcularEdad(pacienteData.fecha_nacimiento)}`;
    const medicoResponsable = pedidoData?.medico_asignacion?.usuario
      ? `${pedidoData.medico_asignacion.usuario.nombre} ${pedidoData.medico_asignacion.usuario.apellido}`
      : borradorData?.medicoNombre || (pedidoData ? `ID Usuario Sucursal ${pedidoData.id_usuario_sucursal_medico}` : 'NO ASIGNADO');
    // Si hay exámenes en borradorData (llamada desde consulta), usarlos siempre —
    // representan la selección actual en UI. Solo usar pedidoData.detalle cuando
    // se imprime desde "Ver detalles" (sin borradorData).
    const examenesAgrupados: Record<string, string[]> = examenesBorrador.length > 0
      ? examenesBorrador.reduce((acc, examen) => {
          const cat = examen.categoria || 'OTROS';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(examen.nombre);
          return acc;
        }, {} as Record<string, string[]>)
      : (pedidoData?.detalle ?? []).reduce((acc, det) => {
          const cat = det.examen_laboratorio?.categoria || 'OTROS';
          const nombre = det.examen_laboratorio?.nombre || `Examen #${det.id_examen_laboratorio}`;
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(nombre);
          return acc;
        }, {} as Record<string, string[]>);

    const examenesTexto = Object.entries(examenesAgrupados)
      .map(([cat, nombres]) => `
        <div class="grupo">
          <div class="grupo-titulo">${escapeHtml(cat)}</div>
          <ul>${nombres.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
        </div>`)
      .join('');

    const numeroPedido = pedidoData
      ? `#${escapeHtml(String(pedidoData.numero_pedido_laboratorio).padStart(7, '0'))}`
      : 'BORRADOR';

    const fechaPedido = pedidoData
      ? String(pedidoData.fecha_pedido).slice(0, 10)
      : formatDateLocal(new Date());

    const observacionesPedido = pedidoData?.observaciones || borradorData?.observaciones || '';

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
    .titulo { font-style: italic; font-size: 34px; letter-spacing: 0.4px; color: #71717a; margin: 0; line-height: 1.05; }
    .numero { color: #3f3f46; font-size: 28px; margin-left: 14px; font-weight: 700; }
    .logo { width: 200px; object-fit: contain; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0; }
    .card { border: 1px solid #d4d4d8; border-radius: 10px; padding: 12px; }
    .label { font-size: 13px; font-weight: 700; color: #52525b; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
    .value { font-size: 17px; color: #18181b; white-space: pre-wrap; }
    ul { margin: 4px 0 0; padding-left: 20px; }
    li { font-size: 15px; margin: 3px 0; }
    .grupo { margin-bottom: 10px; }
    .grupo:last-child { margin-bottom: 0; }
    .grupo-titulo { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #71717a; border-bottom: 1px solid #e4e4e7; padding-bottom: 3px; margin-bottom: 4px; }
    @page { margin: 8mm; }
    @media print { body { margin: 0; } .doc { border: none; padding: 8px 10px; } }
  </style>
</head>
<body>
  <div class="doc">
    <div class="header">
      <div>
        <span class="titulo">PEDIDO DE LABORATORIO</span>
        <span class="numero">${numeroPedido}</span>
      </div>
      <img src="${logoClinicaAtlas}" alt="Clinicas Atlas" class="logo" />
    </div>
    <div class="grid">
      <div class="card"><div class="label">Nombre</div><div class="value">${escapeHtml(nombrePaciente)}</div></div>
      <div class="card"><div class="label">Edad</div><div class="value">${escapeHtml(edadPaciente)} años</div></div>
      <div class="card"><div class="label">Fecha</div><div class="value">${escapeHtml(fechaPedido)}</div></div>
      <div class="card"><div class="label">Médico</div><div class="value">${escapeHtml(medicoResponsable)}</div></div>
    </div>
    <div class="card">
      <div class="label">Exámenes solicitados</div>
      ${examenesTexto}
    </div>
    <div class="card" style="margin-top: 14px;">
      <div class="label">Observaciones del pedido</div>
      <div class="value">${escapeHtml(observacionesPedido)}</div>
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión. Verifica el bloqueador de popups.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(contenido);
    printWindow.document.close();

    const imprimir = () => {
      printWindow.focus();
      printWindow.print();
    };

    const logo = printWindow.document.querySelector('img.logo') as HTMLImageElement | null;
    if (logo && !logo.complete) {
      logo.onload = imprimir;
      logo.onerror = imprimir;
      return;
    }

    imprimir();
  };

  const pacienteSeleccionado = selectedPatientId ? pacientes.find((p: Paciente) => p.id_paciente === selectedPatientId) : null;

  const handleImprimirFormularioConsultaExterna = (cita: CitaCompleta, consulta: ConsultaMedica | undefined) => {
    const pac = pacienteSeleccionado;
    if (!pac) { toast.error('No hay paciente seleccionado'); return; }

    const signo = signosVitales[0] || null;
    const ant = antecedentesData;

    const e = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      return String(v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    const apellidosParts = (pac.apellidos || '').trim().split(/\s+/);
    const primerApellido = apellidosParts[0] || '';
    const segundoApellido = apellidosParts.slice(1).join(' ');
    const nombresParts = (pac.nombres || '').trim().split(/\s+/);
    const primerNombre = nombresParts[0] || '';
    const segundoNombre = nombresParts.slice(1).join(' ');

    const edadAnios = pac.fecha_nacimiento ? calcularEdad(pac.fecha_nacimiento) : '';
    const fechaCita = cita.fecha_cita ? cita.fecha_cita.slice(0, 10) : '';
    const horaCita = cita.hora_inicio ? cita.hora_inicio.slice(0, 5) : '';
    const medicoNombre = `${cita.usuario_sucursal.usuario.nombre} ${cita.usuario_sucursal.usuario.apellido}`;
    const especialidad = cita.usuario_sucursal.especialidad || 'Médico General';

    const presionArterial = signo ? `${signo.presion_sistolica ?? ''}/${signo.presion_diastolica ?? ''}` : '';
    const pulso = signo?.frecuencia_cardiaca ?? '';
    const frecResp = signo?.frecuencia_respiratoria ?? '';
    const pulsioximetria = signo?.saturacion_oxigeno ?? '';
    const peso = signo?.peso_kg ?? '';
    const talla = signo?.estatura_cm ?? '';
    const glucemia = signo?.glucosa_mg_dl ?? '';
    const perimetroCefalico = signo?.perimetro_cefalico_cm ?? '';
    const glasgowOcular = signo?.glasgow_ocular ?? '';
    const glasgowVerbal = signo?.glasgow_verbal ?? '';
    const glasgowMotora = signo?.glasgow_motora ?? '';
    const reaccionPupilar = signo?.reaccion_pupilar ?? '';

    const alergias = Array.isArray(ant?.alergias) ? ant.alergias.join(', ') : '';
    const ppf = ant?.antecedentesPatologicosPersonalesFamiliares || {};
    const fmtPpf = (key: string) => {
      const item = ppf[key];
      if (!item) return '';
      const resp = item.respuesta === 'si' ? 'Sí' : item.respuesta === 'no' ? 'No' : '';
      return [resp, item.notas || ''].filter(Boolean).join(': ');
    };
    const familiaresRaw = ppf.familiares;
    const familiares = Array.isArray(familiaresRaw)
      ? familiaresRaw.join(', ')
      : (familiaresRaw && typeof familiaresRaw === 'object' && (familiaresRaw as any).notas ? (familiaresRaw as any).notas : '');
    const medicamentos = Array.isArray(ant?.medicamentos) ? ant.medicamentos.join(', ') : '';
    const noPatol = ant?.antecedentesNoPatologicos || {};
    const habitos = [
      noPatol.tabaquismo ? `Tabaquismo: ${noPatol.tabaquismo}` : '',
      noPatol.alcoholismo ? `Alcoholismo: ${noPatol.alcoholismo}` : '',
      noPatol.drogas ? `Drogas: ${noPatol.drogas}` : '',
      noPatol.actividadFisica ? `Act. Física: ${noPatol.actividadFisica}` : '',
    ].filter(Boolean).join(' | ');
    const gineco = (() => {
      const g = ant?.antecedentesGineco;
      if (!g) return '';
      const parts: string[] = [];
      if (g.menarquia) parts.push(`Menarquia: ${g.menarquia}`);
      if (g.fechaUltimaMenstruacion) parts.push(`FUM: ${g.fechaUltimaMenstruacion}`);
      if (g.metodoAnticonceptivo) parts.push(`MAC: ${g.metodoAnticonceptivo}`);
      return parts.join(' | ');
    })();

    const seguroPrincipal = (pac.seguro_salud_principal || '').toUpperCase();
    const seguroCheck = (key: string) => seguroPrincipal.includes(key.toUpperCase()) ? '&#x2713;' : '&#x25a1;';
    const ecRaw = (pac.estado_civil || '').toUpperCase();
    const ecMap: Record<string, string> = { 'SOLTERO': 'SOL', 'CASADO': 'CAS', 'DIVORCIADO': 'DIV', 'VIUDO': 'VIU', 'UNION LIBRE': 'U-H', 'UNIÓN LIBRE': 'U-H', 'NO APLICA': 'NA' };
    const ecAbrev = Object.keys(ecMap).find(k => ecRaw.includes(k)) ? ecMap[Object.keys(ecMap).find(k => ecRaw.includes(k))!] : ecRaw;
    const ecCheck = (abrev: string) => ecAbrev === abrev ? '&#x2713;' : '&#x25a1;';
    const llegadaRaw = (pac.forma_llegada || '').toUpperCase();
    const llegadaCheck = (val: string) => llegadaRaw.includes(val.toUpperCase()) ? '&#x2713;' : '&#x25a1;';

    const diagRaw = consulta?.diagnostico || '';
    const diagLines = diagRaw.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const mid = Math.ceil(diagLines.length / 2);
    const diagPresuntivo = diagLines.slice(0, mid).join('\n');
    const diagDefinitivo = diagLines.slice(mid).join('\n') || diagRaw;

    const recetaLines = (consulta?.receta_medica || '').split('\n').filter(Boolean);
    const recetaRows = recetaLines.map((line: string) =>
      `<tr><td class="value">${e(line)}</td><td></td><td></td><td></td><td></td></tr>`).join('');
    const recetaExtra = Array.from({ length: Math.max(4 - recetaLines.length, 0) }, () =>
      '<tr><td style="min-height:12px">&nbsp;</td><td></td><td></td><td></td><td></td></tr>').join('');

    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Formulario Consulta Externa</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; color: #000; background: #fff; }
.page { width: 210mm; margin: 0 auto; padding: 4mm 5mm; }
table { width: 100%; border-collapse: collapse; }
td, th { border: 1px solid #555; padding: 1.5px 3px; vertical-align: top; }
.sh { background: #c8ddf5; font-weight: bold; font-size: 8pt; padding: 2px 4px; border: 1px solid #555; margin-top: 1px; display: block; }
.lb { font-size: 6.5pt; color: #333; font-weight: bold; }
.val { font-size: 8pt; color: #000; min-height: 11px; }
.ml { white-space: pre-wrap; min-height: 32px; }
@page { size: A4; margin: 6mm; }
@media print { body { margin: 0; } .page { width: 100%; padding: 0; } }
</style>
</head>
<body><div class="page">

<table style="margin-bottom:2px"><tr>
  <td style="width:35%;border:1px solid #555;padding:3px 6px">
    <div style="font-size:11pt;font-weight:bold;color:#1a4e8f">Cl&#237;nicas ATLAS</div>
    <div style="font-size:7pt;color:#555">Sistema de Salud</div>
  </td>
  <td style="width:40%;border:1px solid #555;padding:3px;text-align:center">
    <div style="font-size:10pt;font-weight:bold">HISTORIA CL&#205;NICA &#218;NICA</div>
    <div style="font-size:7.5pt">CONSULTA EXTERNA</div>
  </td>
  <td style="width:25%;border:1px solid #555;padding:3px;font-size:6.5pt;text-align:right">SNS-MSP/HCU-form.008/2021</td>
</tr></table>

<div class="sh">A. DATOS DEL ESTABLECIMIENTO</div>
<table><tr>
  <td style="width:30%"><div class="lb">INSTITUCIÓN DEL SISTEMA</div><div class="val">Cl&#237;nica Atlas</div></td>
  <td style="width:15%"><div class="lb">UNIC&#211;DIGO</div><div class="val"></div></td>
  <td style="width:25%"><div class="lb">ESTABLECIMIENTO DE SALUD</div><div class="val">Cl&#237;nica Atlas</div></td>
  <td style="width:20%"><div class="lb">N&#218;MERO DE HISTORIA CL&#205;NICA &#218;NICA</div><div class="val">${e(pac.cedula)}</div></td>
  <td style="width:10%"><div class="lb">N&#218;MERO DE ARCHIVO</div><div class="val">${e(String(pac.id_paciente))}</div></td>
</tr></table>

<div class="sh">B. REGISTRO DE ADMISI&#211;N</div>
<table>
<tr>
  <td colspan="3"><div class="lb">FECHA DE ADMISI&#211;N (aaaa-mm-dd)</div><div class="val">${e(fechaCita)}</div></td>
  <td colspan="3"><div class="lb">NOMBRE Y APELLIDO DEL ADMISIONISTA</div><div class="val">${e(pac.nombre_admisionista || '')}</div></td>
  <td colspan="2"><div class="lb">HISTORIA CL&#205;NICA EN EL ESTABLECIMIENTO</div><div class="val" style="font-size:7pt">SI: ${pac.historia_clinica_establecimiento ? '&#x2713;' : '&#x25a1;'} &nbsp; NO: ${!pac.historia_clinica_establecimiento ? '&#x2713;' : '&#x25a1;'}</div></td>
</tr>
<tr>
  <td colspan="2"><div class="lb">PRIMER APELLIDO</div><div class="val">${e(primerApellido)}</div></td>
  <td colspan="2"><div class="lb">SEGUNDO APELLIDO</div><div class="val">${e(segundoApellido)}</div></td>
  <td colspan="2"><div class="lb">PRIMER NOMBRE</div><div class="val">${e(primerNombre)}</div></td>
  <td><div class="lb">SEGUNDO NOMBRE</div><div class="val">${e(segundoNombre)}</div></td>
  <td><div class="lb">TIPO DOC. IDENTIFICACI&#211;N</div><div class="val" style="font-size:7pt">CC/CI: ${(pac.tipo_documento_identificacion||'').toUpperCase().includes('CI')||!(pac.tipo_documento_identificacion) ? '&#x2713;' : '&#x25a1;'} PAS: ${(pac.tipo_documento_identificacion||'').toUpperCase().includes('PAS') ? '&#x2713;' : '&#x25a1;'} CARN&#201;: ${(pac.tipo_documento_identificacion||'').toUpperCase().includes('CARN') ? '&#x2713;' : '&#x25a1;'} S/D: &#x25a1;</div></td>
</tr>
<tr>
  <td colspan="2"><div class="lb">ESTADO CIVIL</div><div class="val" style="font-size:7pt">SOL:${ecCheck('SOL')} CAS:${ecCheck('CAS')} DIV:${ecCheck('DIV')} VIU:${ecCheck('VIU')} U-H:${ecCheck('U-H')} NA:${ecCheck('NA')}</div></td>
  <td><div class="lb">SEXO</div><div class="val">${e(pac.sexo === 'M' ? 'Masculino' : pac.sexo === 'F' ? 'Femenino' : pac.sexo || '')}</div></td>
  <td><div class="lb">N&#176; TEL&#201;FONO FIJO</div><div class="val">${e(pac.telefono_fijo || '')}</div></td>
  <td colspan="2"><div class="lb">N&#176; TEL&#201;FONO CELULAR</div><div class="val">${e(pac.telefono || '')}</div></td>
  <td colspan="2"><div class="lb">FECHA DE NACIMIENTO (aaaa-mm-dd)</div><div class="val">${e((pac.fecha_nacimiento || '').slice(0, 10))}</div></td>
</tr>
<tr>
  <td colspan="2"><div class="lb">LUGAR DE NACIMIENTO</div><div class="val">${e(pac.lugar_nacimiento || '')}</div></td>
  <td><div class="lb">NACIONALIDAD</div><div class="val">${e(pac.nacionalidad || '')}</div></td>
  <td><div class="lb">EDAD</div><div class="val" style="font-size:7pt">H: &nbsp; D: &nbsp; M: &nbsp; A: ${e(String(edadAnios))}</div></td>
  <td><div class="lb">CONDICI&#211;N EDAD</div><div class="val">${e(pac.condicion_edad || '')}</div></td>
  <td colspan="2"><div class="lb">GRUPO PRIORITARIO</div><div class="val" style="font-size:7pt">SI: &#x25a1; &nbsp; NO: &#x25a1;</div></td>
  <td><div class="lb">ESPECIFIQUE</div><div class="val">${e(pac.grupo_prioritario_especifique || '')}</div></td>
</tr>
<tr>
  <td colspan="2"><div class="lb">AUTOIDENTIFICACI&#211;N &#201;TNICA</div><div class="val">${e(pac.autoidentificacion_etnica || '')}</div></td>
  <td colspan="2"><div class="lb">NACIONALIDAD &#201;TNICA</div><div class="val">${e(pac.nacionalidad_etnica || '')}</div></td>
  <td colspan="2"><div class="lb">*PUEBLOS</div><div class="val">${e(pac.pueblo || '')}</div></td>
  <td colspan="2"><div class="lb">NIVEL DE EDUCACI&#211;N</div><div class="val">${e(pac.nivel_educacion || '')}</div></td>
</tr>
<tr>
  <td colspan="2"><div class="lb">ESTADO DEL NIVEL DE EDUCACI&#211;N</div><div class="val">${e(pac.estado_nivel_educacion || '')}</div></td>
  <td colspan="2"><div class="lb">TIPO DE EMPRESA DE TRABAJO</div><div class="val">${e(pac.tipo_empresa_trabajo || '')}</div></td>
  <td colspan="2"><div class="lb">OCUPACI&#211;N / PROFESI&#211;N</div><div class="val">${e(pac.ocupacion_profesion || '')}</div></td>
  <td colspan="2"><div class="lb">SEGURO SALUD PRINCIPAL</div><div class="val" style="font-size:7pt">IESS-G:${seguroCheck('IESS-G')} IESS-C:${seguroCheck('IESS-C')} ISSPOL:${seguroCheck('ISSPOL')} ISSFA:${seguroCheck('ISSFA')} PRIV:${seguroCheck('PRIV')} NING:${seguroCheck('NING')}</div></td>
</tr>
<tr>
  <td colspan="2"><div class="lb">PROVINCIA</div><div class="val">${e(pac.provincia || '')}</div></td>
  <td colspan="2"><div class="lb">CANT&#211;N</div><div class="val">${e(pac.canton || '')}</div></td>
  <td colspan="2"><div class="lb">PARROQUIA</div><div class="val">${e(pac.parroquia || '')}</div></td>
  <td colspan="2"><div class="lb">BARRIO O SECTOR</div><div class="val">${e(pac.barrio_sector || '')}</div></td>
</tr>
<tr>
  <td colspan="3"><div class="lb">CALLE PRINCIPAL</div><div class="val">${e(pac.calle_principal || '')}</div></td>
  <td colspan="3"><div class="lb">CALLE SECUNDARIA</div><div class="val">${e(pac.calle_secundaria || '')}</div></td>
  <td colspan="2"><div class="lb">REFERENCIA</div><div class="val">${e(pac.referencia_domicilio || '')}</div></td>
</tr>
<tr>
  <td colspan="3"><div class="lb">EN CASO NECESARIO LLAMAR A:</div><div class="val">${e(pac.contacto_emergencia_nombre || '')}</div></td>
  <td colspan="2"><div class="lb">PARENTESCO</div><div class="val">${e(pac.contacto_emergencia_parentesco || '')}</div></td>
  <td colspan="2"><div class="lb">DIRECCI&#211;N</div><div class="val">${e(pac.contacto_emergencia_direccion || '')}</div></td>
  <td><div class="lb">N&#176; TEL&#201;FONO</div><div class="val">${e(pac.contacto_emergencia_telefono || '')}</div></td>
</tr>
<tr>
  <td colspan="2"><div class="lb">FORMA DE LLEGADA</div><div class="val" style="font-size:7pt">AMBULATORIO:${llegadaCheck('AMBULATORIO')} AMBULANCIA:${llegadaCheck('AMBULANC')} OTRO TRANSPORTE:${llegadaRaw && !llegadaRaw.includes('AMBULAT') && !llegadaRaw.includes('AMBULANC') && llegadaRaw ? '&#x2713;' : '&#x25a1;'}</div></td>
  <td colspan="3"><div class="lb">FUENTE DE INFORMACI&#211;N</div><div class="val">${e(pac.fuente_informacion || '')}</div></td>
  <td colspan="2"><div class="lb">INSTITUCI&#211;N O PERSONA QUE ENTREGA AL PACIENTE</div><div class="val">${e(pac.institucion_entrega_paciente || '')}</div></td>
  <td><div class="lb">N&#176; TEL&#201;FONO</div><div class="val">${e(pac.telefono_institucion_entrega || '')}</div></td>
</tr>
</table>

<div class="sh">C. INICIO DE ATENCI&#211;N</div>
<table><tr>
  <td style="width:18%"><div class="lb">FECHA (aaaa-mm-dd)</div><div class="val">${e(fechaCita)}</div></td>
  <td style="width:12%"><div class="lb">HORA (hh:mm)</div><div class="val">${e(horaCita)}</div></td>
  <td style="width:35%"><div class="lb">CONDICI&#211;N DE LLEGADA</div><div class="val" style="font-size:7pt">ESTABLE: &#x25a1; &nbsp; INESTABLE: &#x25a1; &nbsp; FALLECIDO: &#x25a1;</div></td>
  <td style="width:35%"><div class="lb">MOTIVO DE ATENCI&#211;N</div><div class="val">${e(cita.motivo_consulta || '')}</div></td>
</tr></table>

<div class="sh">E. ANTECEDENTES PATOL&#211;GICOS PERSONALES Y FAMILIARES</div>
<table>
<tr>
  <td style="width:20%"><div class="lb">1. AL&#201;RGICOS</div><div class="val ml" style="min-height:26px">${e(alergias)}</div></td>
  <td style="width:20%"><div class="lb">3. GINECOL&#211;GICOS</div><div class="val ml" style="min-height:26px">${e(gineco)}</div></td>
  <td style="width:20%"><div class="lb">5. PEDI&#193;TRICOS</div><div class="val ml" style="min-height:26px">${e(fmtPpf('pediatricos'))}</div></td>
  <td style="width:20%"><div class="lb">7. FARMACOL&#211;GICOS</div><div class="val ml" style="min-height:26px">${e(medicamentos)}</div></td>
  <td style="width:20%"><div class="lb">9. FAMILIARES</div><div class="val ml" style="min-height:26px">${e(familiares)}</div></td>
</tr>
<tr>
  <td><div class="lb">2. CL&#205;NICOS</div><div class="val ml" style="min-height:26px">${e(fmtPpf('clinicos'))}</div></td>
  <td><div class="lb">4. TRAUM ATOL&#211;GICOS</div><div class="val ml" style="min-height:26px">${e(fmtPpf('traumatologicos'))}</div></td>
  <td><div class="lb">6. QUIR&#218;RGICOS</div><div class="val ml" style="min-height:26px">${e(fmtPpf('quirurgicos'))}</div></td>
  <td><div class="lb">8. H&#193;BITOS</div><div class="val ml" style="min-height:26px">${e(habitos)}</div></td>
  <td><div class="lb">10. OTROS</div><div class="val ml" style="min-height:26px">${e(fmtPpf('otros'))}</div></td>
</tr>
</table>

<div class="sh">F. ENFERMEDAD O PROBLEMA ACTUAL <span style="font-size:6.5pt;font-weight:normal">(Cronolog&#237;a - Localizaci&#243;n - Caracter&#237;sticas - Intensidad - Frecuencia - Factores Agravantes)</span></div>
<table><tr><td><div class="val ml" style="min-height:50px">${e(consulta?.historial_clinico || '')}</div></td></tr></table>

<div class="sh">G. CONSTANTES VITALES Y ANTROPOMETR&#205;A</div>
<table>
<tr>
  <td><div class="lb">PRESI&#211;N ARTERIAL (mmHg)</div><div class="val">${e(presionArterial)}</div></td>
  <td><div class="lb">PULSO / min</div><div class="val">${e(String(pulso))}</div></td>
  <td><div class="lb">FREC. RESPIRATORIA / min</div><div class="val">${e(String(frecResp))}</div></td>
  <td><div class="lb">PULSIOXIMETR&#205;A (%)</div><div class="val">${e(String(pulsioximetria))}</div></td>
  <td><div class="lb">PESO (kg)</div><div class="val">${e(String(peso))}</div></td>
  <td><div class="lb">TALLA (cm)</div><div class="val">${e(String(talla))}</div></td>
  <td><div class="lb">GLUCEMIA CAPILAR (mg/dl)</div><div class="val">${e(String(glucemia))}</div></td>
  <td><div class="lb">PER&#205;METRO CEF&#193;LICO (cm)</div><div class="val">${e(String(perimetroCefalico))}</div></td>
</tr>
<tr>
  <td colspan="3"><div class="lb">GLASGOW INICIAL</div><div class="val" style="font-size:7pt">OCULAR (4): ${e(String(glasgowOcular))} &nbsp; VERBAL (5): ${e(String(glasgowVerbal))} &nbsp; MOTORA (6): ${e(String(glasgowMotora))}</div></td>
  <td colspan="2"><div class="lb">REACCI&#211;N PUPILAR</div><div class="val">${e(String(reaccionPupilar))}</div></td>
  <td colspan="3"><div class="lb">S/N CONSTANTES VITALES</div><div class="val"></div></td>
</tr>
</table>

<div class="sh">H. EXAMEN F&#205;SICO</div>
<table>
<tr>
  <td style="width:20%"><div class="lb">1. PIEL - FANERAS</div><div class="val" style="min-height:12px"></div></td>
  <td style="width:20%"><div class="lb">4. O&#205;DOS</div><div class="val" style="min-height:12px"></div></td>
  <td style="width:20%"><div class="lb">7. ORO FARINGE</div><div class="val" style="min-height:12px"></div></td>
  <td style="width:20%"><div class="lb">10. T&#211;RAX</div><div class="val" style="min-height:12px"></div></td>
  <td style="width:20%"><div class="lb">13. INGLE-PERIN&#201;</div><div class="val" style="min-height:12px"></div></td>
</tr>
<tr>
  <td><div class="lb">2. CABEZA</div><div class="val" style="min-height:12px"></div></td>
  <td><div class="lb">5. NARIZ</div><div class="val" style="min-height:12px"></div></td>
  <td><div class="lb">8. CUELLO</div><div class="val" style="min-height:12px"></div></td>
  <td><div class="lb">11. ABDOMEN</div><div class="val" style="min-height:12px"></div></td>
  <td><div class="lb">14. MIEMBROS SUPERIORES</div><div class="val" style="min-height:12px"></div></td>
</tr>
<tr>
  <td><div class="lb">3. OJOS</div><div class="val" style="min-height:12px"></div></td>
  <td><div class="lb">6. BOCA</div><div class="val" style="min-height:12px"></div></td>
  <td><div class="lb">9. AXILAS - MAMAS</div><div class="val" style="min-height:12px"></div></td>
  <td><div class="lb">12. COLUMNA VERTEBRAL</div><div class="val" style="min-height:12px"></div></td>
  <td><div class="lb">15. MIEMBROS INFERIORES</div><div class="val" style="min-height:12px"></div></td>
</tr>
<tr>
  <td colspan="5"><div class="lb">OBSERVACIONES EXAMEN F&#205;SICO</div><div class="val ml" style="min-height:28px">${e(consulta?.pedido_examenes || '')}</div></td>
</tr>
</table>

<table style="margin-top:1px"><tr>
<td style="width:50%;vertical-align:top">
  <div class="sh">L. DIAGN&#211;STICOS PRESUNTIVOS</div>
  <table>
    <tr><td><div class="lb">1.</div><div class="val ml" style="min-height:14px">${e(diagPresuntivo)}</div></td></tr>
    <tr><td><div class="lb">2.</div><div class="val" style="min-height:12px"></div></td></tr>
    <tr><td><div class="lb">3.</div><div class="val" style="min-height:12px"></div></td></tr>
  </table>
</td>
<td style="width:50%;vertical-align:top">
  <div class="sh">M. DIAGN&#211;STICOS DEFINITIVOS</div>
  <table>
    <tr><td><div class="lb">1.</div><div class="val ml" style="min-height:14px">${e(diagDefinitivo)}</div></td></tr>
    <tr><td><div class="lb">2.</div><div class="val" style="min-height:12px"></div></td></tr>
    <tr><td><div class="lb">3.</div><div class="val" style="min-height:12px"></div></td></tr>
  </table>
</td>
</tr></table>

<div class="sh">N. PLAN DE TRATAMIENTO</div>
<table>
<tr>
  <th style="width:45%">MEDICAMENTOS</th>
  <th style="width:10%">V&#205;A</th>
  <th style="width:15%">DOSIS</th>
  <th style="width:15%">POSOLOG&#205;A</th>
  <th style="width:15%">D&#205;AS</th>
</tr>
${recetaRows}${recetaExtra}
<tr><td colspan="5"><div class="lb">OBSERVACIONES / INDICACIONES</div><div class="val ml" style="min-height:20px">${e(consulta?.receta_indicaciones || consulta?.observaciones || '')}</div></td></tr>
</table>

<div class="sh">O. CONDICI&#211;N AL EGRESO</div>
<table>
<tr>
  <td><div class="lb">VIVO</div><div class="val">&#x25a1;</div></td>
  <td><div class="lb">ESTABLE</div><div class="val">&#x25a1;</div></td>
  <td><div class="lb">INESTABLE</div><div class="val">&#x25a1;</div></td>
  <td><div class="lb">FALLECIDO</div><div class="val">&#x25a1;</div></td>
  <td><div class="lb">ALTA DEFINITIVA</div><div class="val">&#x25a1;</div></td>
  <td><div class="lb">CONSULTA EXTERNA</div><div class="val">&#x2713;</div></td>
  <td><div class="lb">OBSERVACI&#211;N</div><div class="val">&#x25a1;</div></td>
  <td><div class="lb">D&#205;AS DE REPOSO</div><div class="val"></div></td>
</tr>
<tr>
  <td><div class="lb">HOSPITALIZACI&#211;N</div><div class="val">${consulta?.pedido_hospitalizacion ? '&#x2713;' : '&#x25a1;'}</div></td>
  <td colspan="2"><div class="lb">REFERENCIA</div><div class="val">&#x25a1;</div></td>
  <td colspan="2"><div class="lb">REFERENCIA INVERSA</div><div class="val">&#x25a1;</div></td>
  <td colspan="2"><div class="lb">DERIVACI&#211;N</div><div class="val">&#x25a1;</div></td>
  <td><div class="lb">ESTABLECIMIENTO</div><div class="val"></div></td>
</tr>
<tr><td colspan="8"><div class="lb">OBSERVACIONES</div><div class="val ml" style="min-height:16px">${e(consulta?.observaciones || '')}</div></td></tr>
</table>

<div class="sh">P. DATOS DEL PROFESIONAL RESPONSABLE</div>
<table><tr>
  <td style="width:15%"><div class="lb">FECHA (aaaa-mm-dd)</div><div class="val">${e(fechaCita)}</div></td>
  <td style="width:10%"><div class="lb">HORA (hh:mm)</div><div class="val">${e(horaCita)}</div></td>
  <td style="width:35%"><div class="lb">NOMBRE COMPLETO</div><div class="val">${e(medicoNombre)}</div></td>
  <td style="width:20%"><div class="lb">ESPECIALIDAD</div><div class="val">${e(especialidad)}</div></td>
  <td style="width:20%"><div class="lb">FIRMA Y SELLO</div><div class="val" style="min-height:32px"></div></td>
</tr></table>

<div style="margin-top:6px;text-align:right;font-size:6.5pt;color:#555">SNS-MSP/HCU-form.008/2021</div>

</div></body></html>`;

    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) { toast.error('No se pudo abrir la ventana de impresión. Verifica el bloqueador de popups.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  };

  const signoActual = selectedPatientId ? getSignoVitalActual(selectedPatientId) : null;
  const currentIndex = selectedPatientId ? (signosVitalesIndex[selectedPatientId] || 0) : 0;

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      <SupabaseIndicator />

      {!isConsultaScreenOpen && (
        <>
      {/* Top Bar: Buscador y Nuevo Paciente */}
      <div className="flex gap-4 items-center max-w-2xl mx-auto w-full">
        {/* Botón regresar a agenda (médico y enfermera con paciente abierto) */}
        {esRolAgenda && selectedPatientId && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={() => setSelectedPatientId(null)}
          >
            <ChevronLeft className="size-4 mr-1" />
            Agenda
          </Button>
        )}
        <Button
          variant="outline"
          className="flex-1 justify-start h-12 text-lg text-muted-foreground"
          onClick={() => {
            setSearchTerm('');
            clearPacientes(); // Limpiar resultados anteriores
            setIsSearchDialogOpen(true);
          }}
        >
          <Search className="mr-2 h-5 w-5" />
          {selectedPatientId && pacienteSeleccionado
            ? `Paciente seleccionado: ${pacienteSeleccionado.nombres} ${pacienteSeleccionado.apellidos}`
            : esRolAgenda
            ? "Buscar paciente en la agenda..."
            : "Click para buscar paciente..."}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {selectedPatientId && pacienteSeleccionado ? (
          <div className="h-full flex gap-4 overflow-y-auto">
            {/* Columna 1: Datos del Paciente (Card) */}
            <div className="w-1/3 min-w-[350px] space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-16">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-xl">
                        {getIniciales(pacienteSeleccionado.nombres, pacienteSeleccionado.apellidos)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg truncate">
                          {pacienteSeleccionado.nombres} {pacienteSeleccionado.apellidos}
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleEditPatient(pacienteSeleccionado)}
                        >
                          <Pencil className="size-4 text-gray-400 hover:text-blue-600" />
                        </Button>
                      </div>
                      <p className="text-sm text-gray-500">
                        {calcularEdad(pacienteSeleccionado.fecha_nacimiento)} años • {formatearSexo(pacienteSeleccionado.sexo)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">
                          {pacienteSeleccionado.cedula}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Información de contacto */}
                  <div className="space-y-3 text-sm">
                    {pacienteSeleccionado.email && (
                      <div className="flex items-center gap-3 text-gray-600">
                        <Mail className="size-4" />
                        <span className="truncate">{pacienteSeleccionado.email}</span>
                      </div>
                    )}
                    {pacienteSeleccionado.telefono && (
                      <div className="flex items-center gap-3 text-gray-600">
                        <Phone className="size-4" />
                        <span>{pacienteSeleccionado.telefono}</span>
                      </div>
                    )}
                    {pacienteSeleccionado.direccion && (
                      <div className="flex items-center gap-3 text-gray-600">
                        <MapPin className="size-4" />
                        <span className="truncate">{pacienteSeleccionado.direccion}</span>
                      </div>
                    )}
                  </div>

                  {/* Constantes Vitales y Antropometría */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">Constantes vitales y antropometría</h4>
                      <div className="flex items-center gap-1">
                        {signosVitales.length > 1 && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navegarSignosVitales(selectedPatientId, 'prev')}
                              disabled={currentIndex === 0}
                              className="h-7 w-7 p-0"
                            >
                              <ChevronLeft className="size-4" />
                            </Button>
                            <span className="text-xs text-gray-500 min-w-[3rem] text-center">
                              {currentIndex + 1} / {signosVitales.length}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navegarSignosVitales(selectedPatientId, 'next')}
                              disabled={currentIndex === signosVitales.length - 1}
                              className="h-7 w-7 p-0"
                            >
                              <ChevronRight className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mb-4"
                      onClick={() => {
                        setSelectedPatientId(pacienteSeleccionado.id_paciente);
                        setIsSignosVitalesDialogOpen(true);
                      }}
                    >
                      <Plus className="size-4 mr-2" />
                      Registrar constantes vitales y antropometría
                    </Button>

                    {signoActual ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar className="size-3" />
                          <span>
                            {new Date(signoActual.fecha_registro).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })} - {new Date(signoActual.fecha_registro).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        {/* Panel de alertas */}
                        <AlertasSignosVitalesPanel alertas={alertasActuales} />

                        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                          {/* Helper inline: alerta para un campo */}
                          {(() => {
                            const alertaPor = (campo: string) =>
                              alertasActuales.find(a => a.campo === campo);
                            const claseValor = (campo: string) => {
                              const a = alertaPor(campo);
                              if (!a) return 'text-sm font-medium';
                              return a.nivel === 'critico'
                                ? 'text-sm font-medium text-red-600'
                                : 'text-sm font-medium text-yellow-600';
                            };
                            const icono = (campo: string) => {
                              const a = alertaPor(campo);
                              if (!a) return null;
                              return (
                                <AlertTriangle
                                  className={`inline size-3 ml-1 ${a.nivel === 'critico' ? 'text-red-500' : 'text-yellow-500'}`}
                                />
                              );
                            };
                            return (
                              <>
                                <div className="flex items-center gap-2">
                                  <Ruler className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">Talla</p>
                                    <p className="text-sm font-medium">{signoActual.estatura_cm || '-'} {signoActual.estatura_cm ? 'cm' : ''}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Weight className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">Peso</p>
                                    <p className="text-sm font-medium">{signoActual.peso_kg || '-'} {signoActual.peso_kg ? 'kg' : ''}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Activity className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">IMC</p>
                                    <p className={claseValor('imc')}>
                                      {signoActual.imc || '-'} {signoActual.imc ? RANGOS_SIGNOS_VITALES.imc.unidad : ''}
                                      {icono('imc')}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Thermometer className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">Temp.</p>
                                    <p className={claseValor('temperatura_c')}>
                                      {signoActual.temperatura_c || '-'} {signoActual.temperatura_c ? '°C' : ''}
                                      {icono('temperatura_c')}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Wind className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">F. Resp.</p>
                                    <p className={claseValor('frecuencia_respiratoria')}>
                                      {signoActual.frecuencia_respiratoria || '-'} {signoActual.frecuencia_respiratoria ? 'rpm' : ''}
                                      {icono('frecuencia_respiratoria')}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Heart className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">F. Card.</p>
                                    <p className={claseValor('frecuencia_cardiaca')}>
                                      {signoActual.frecuencia_cardiaca || '-'} {signoActual.frecuencia_cardiaca ? 'bpm' : ''}
                                      {icono('frecuencia_cardiaca')}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 col-span-2">
                                  <Activity className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">Presión Arterial</p>
                                    <p className={`text-sm font-medium flex items-center gap-1 ${
                                      alertaPor('presion_sistolica') || alertaPor('presion_diastolica')
                                        ? (alertaPor('presion_sistolica')?.nivel === 'critico' || alertaPor('presion_diastolica')?.nivel === 'critico'
                                            ? 'text-red-600'
                                            : 'text-yellow-600')
                                        : ''
                                    }`}>
                                      {signoActual.presion_sistolica && signoActual.presion_diastolica
                                        ? `${signoActual.presion_sistolica}/${signoActual.presion_diastolica} mmHg`
                                        : '-'}
                                      {(alertaPor('presion_sistolica') || alertaPor('presion_diastolica')) && (
                                        <AlertTriangle className={`size-3 ${
                                          alertaPor('presion_sistolica')?.nivel === 'critico' || alertaPor('presion_diastolica')?.nivel === 'critico'
                                            ? 'text-red-500'
                                            : 'text-yellow-500'
                                        }`} />
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 col-span-2">
                                  <Droplet className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">Pulsoximetría</p>
                                    <p className={claseValor('saturacion_oxigeno')}>
                                      {signoActual.saturacion_oxigeno != null ? `${signoActual.saturacion_oxigeno}%` : '-'}
                                      {icono('saturacion_oxigeno')}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Ruler className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">Perímetro cefálico</p>
                                    <p className="text-sm font-medium">{signoActual.perimetro_cefalico_cm || '-'} {signoActual.perimetro_cefalico_cm ? 'cm' : ''}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Droplet className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">Glucemia capilar</p>
                                    <p className={claseValor('glucosa_mg_dl')}>
                                      {signoActual.glucosa_mg_dl || '-'} {signoActual.glucosa_mg_dl ? 'mg/dL' : ''}
                                      {icono('glucosa_mg_dl')}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Activity className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">Glasgow inicial</p>
                                    <p className={claseValor('glasgow_total')}>
                                      {signoActual.glasgow_ocular != null && signoActual.glasgow_verbal != null && signoActual.glasgow_motora != null
                                        ? `O:${signoActual.glasgow_ocular} V:${signoActual.glasgow_verbal} M:${signoActual.glasgow_motora} T:${signoActual.glasgow_ocular + signoActual.glasgow_verbal + signoActual.glasgow_motora}`
                                        : '-'}
                                      {icono('glasgow_total')}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Eye className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">Reacción pupilar</p>
                                    <p className="text-sm font-medium">{signoActual.reaccion_pupilar || '-'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 col-span-2">
                                  <Clock className="size-4 text-blue-600 shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">T. llenado capilar</p>
                                    <p className={claseValor('tiempo_llenado_capilar_seg')}>
                                      {signoActual.tiempo_llenado_capilar_seg || '-'} {signoActual.tiempo_llenado_capilar_seg ? 'seg' : ''}
                                      {icono('tiempo_llenado_capilar_seg')}
                                    </p>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed text-gray-500 text-sm">
                        No hay constantes vitales y antropometría registradas
                      </div>
                    )}
                  </div>

                  {/* Archivos Médicos */}
                  <div className="border-t pt-4">
                    <ArchivosMedicosSection pacienteId={selectedPatientId} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Columna 2: Antecedentes */}
            <div className="flex-1 min-w-[300px]">
              {isLoadingAntecedentes ? (
                <Card className="p-8 flex items-center justify-center h-full">
                  <Loader2 className="size-6 animate-spin text-blue-600" />
                </Card>
              ) : (
                <AntecedentesView
                  pacienteId={selectedPatientId.toString()}
                  pacienteNombre={`${pacienteSeleccionado.nombres} ${pacienteSeleccionado.apellidos}`}
                  antecedentes={antecedentesData}
                  onActualizarAntecedentes={handleActualizarAntecedentes}
                />
              )}
            </div>

            {/* Columna 3: Historial de Citas */}
            <div className="w-1/3 min-w-[300px] space-y-4">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Calendar className="size-5 text-blue-600" />
                    Historial de Citas
                  </h3>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto pr-2">
                  {isLoadingCitas ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-6 animate-spin text-blue-600" />
                    </div>
                  ) : citasPaciente.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No hay citas registradas
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {citasPaciente.map((cita: CitaCompleta) => {
                        const colorEstado = getColorEstado(cita.estado_cita);
                        const consulta = consultasPorCita[cita.id_cita];
                        const tieneConsulta = !!consulta;
                        const estaExpandida = citasExpandidas.has(cita.id_cita);

                        return (
                          <Card key={cita.id_cita} className="border-l-4" style={{ borderLeftColor: colorEstado === 'blue' ? '#3b82f6' : colorEstado === 'green' ? '#10b981' : colorEstado === 'red' ? '#ef4444' : '#f59e0b' }}>
                            <CardContent className="p-4 space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Calendar className="size-4 text-gray-500" />
                                    <span className="text-sm">
                                        {formatCalendarDateFromIsoInEcuador(cita.fecha_cita, {
                                        weekday: 'short',
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Clock className="size-4 text-gray-500" />
                                    <span className="text-sm">
                                      {formatearHora(cita.hora_inicio)} - {formatearHora(cita.hora_fin)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={cita.estado_cita === 'atendida' ? 'default' : cita.estado_cita === 'cancelada' ? 'destructive' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {cita.estado_cita}
                                  </Badge>
                                  {tieneConsulta && (
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                      <FileText className="size-3 mr-1" />
                                      Consulta
                                    </Badge>
                                  )}
                                  {tieneConsulta && consulta.historial_clinico && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const nuevasExpandidas = new Set(citasExpandidas);
                                        if (estaExpandida) {
                                          nuevasExpandidas.delete(cita.id_cita);
                                        } else {
                                          nuevasExpandidas.add(cita.id_cita);
                                        }
                                        setCitasExpandidas(nuevasExpandidas);
                                      }}
                                      className="h-6 w-6 p-0"
                                      title={estaExpandida ? "Ocultar historial clínico" : "Ver historial clínico"}
                                    >
                                      {estaExpandida ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                    </Button>
                                  )}
                                </div>
                              </div>

                              <div className="pt-2 border-t text-sm text-gray-600">
                                <p className="font-medium">Dr. {cita.usuario_sucursal.usuario.nombre} {cita.usuario_sucursal.usuario.apellido}</p>
                                <p className="text-xs text-gray-500">{cita.usuario_sucursal.especialidad || 'Médico General'}</p>
                                <p className="text-xs text-gray-500">ChatBot Seguro Medico: {cita.seguro_medico_chatbot === true ? 'Sí' : 'No'}</p>
                                {cita.aseguradora ? (
                                  <p className="text-xs text-gray-500">Aseguradora: {cita.aseguradora.nombre}</p>
                                ) : (
                                  <p className="text-xs text-gray-500">Aseguradora: No</p>
                                )}
                              </div>

                              {/* Motivo de Consulta */}
                              {cita.motivo_consulta && (
                                <div className="pt-2 border-t text-xs">
                                  <p className="font-medium text-gray-700 mb-1">Motivo de Consulta:</p>
                                  <p className="text-gray-600 line-clamp-2">{cita.motivo_consulta}</p>
                                </div>
                              )}

                              {/* Receta Médica */}
                              {tieneConsulta && consulta.receta_medica && (
                                <div className="pt-2 border-t text-xs">
                                  <p className="font-medium text-green-700 mb-1 flex items-center gap-1">
                                    <FileText className="size-3" />
                                    Receta Médica:
                                  </p>
                                  <p className="text-gray-600 whitespace-pre-wrap bg-green-50 p-2 rounded line-clamp-3">{consulta.receta_medica}</p>
                                </div>
                              )}

                              {tieneConsulta && consulta.pedido_examenes && (
                                <div className="pt-2 border-t text-xs">
                                  <p className="font-medium text-orange-700 mb-1 flex items-center gap-1">
                                    <FileText className="size-3" />
                                    Examen Físico:
                                  </p>
                                  <p className="text-gray-600 whitespace-pre-wrap bg-orange-50 p-2 rounded line-clamp-4">{consulta.pedido_examenes}</p>
                                </div>
                              )}

                              {tieneConsulta && estaExpandida && consulta.historial_clinico && (
                                <div className="pt-2 border-t text-xs">
                                  <p className="font-medium text-gray-700 mb-1">Historial Clínico:</p>
                                  <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded">{consulta.historial_clinico}</p>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
                                <span>Precio: ${cita.precio_cita}</span>
                                {cita.estado_pago && (
                                  <Badge variant="outline" className="text-xs">
                                    {cita.estado_pago}
                                  </Badge>
                                )}
                              </div>

                              {/* Botones de acción */}
                              <div className="pt-3 border-t space-y-2">
                                {/* Botón Editar Cita — solo secretaria y administrador */}
                                {(currentUser?.tipo_usuario === 'secretaria' || currentUser?.tipo_usuario === 'administrador') &&
                                  cita.estado_cita !== 'cancelada' &&
                                  cita.estado_cita !== 'no_asistio' &&
                                  !cita.consulta_realizada && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                                    onClick={() => {
                                      setCitaParaEditar(cita);
                                      setIsEditCitaModalOpen(true);
                                    }}
                                  >
                                    <Pencil className="size-3 mr-2" />
                                    Editar cita
                                  </Button>
                                )}

                                {/* Botón Iniciar Consulta para citas pendientes */}
                                {!cita.consulta_realizada && cita.estado_cita !== 'cancelada' && cita.estado_cita !== 'no_asistio' && (
                                  <Button
                                    size="sm"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => handleAbrirConsulta(cita.id_cita)}
                                  >
                                    <Stethoscope className="size-3 mr-2" />
                                    Iniciar Consulta
                                  </Button>
                                )}

                                {/* Botón No Asistió */}
                                {cita.estado_cita !== 'cancelada' && !cita.consulta_realizada && (
                                  <Button
                                    size="sm"
                                    className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                                    disabled={cita.estado_cita === 'no_asistio'}
                                    onClick={() => handleMarcarNoAsistio(cita.id_cita)}
                                  >
                                    <span className="mr-2">✗</span>
                                    No Asistió
                                  </Button>
                                )}

                                {/* Botón Ver para todas las citas */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => consulta ? handleVerConsulta(consulta) : null}
                                  disabled={cita.estado_cita === 'agendada' || cita.estado_cita === 'no_asistio' || !consulta}
                                  title={cita.estado_cita === 'no_asistio' ? "No disponible para citas con No Asistió" : cita.estado_cita === 'agendada' ? "Disponible solo para citas atendidas" : consulta ? "Ver detalles de la consulta" : "No hay consulta registrada"}
                                >
                                  <FileText className="size-3 mr-2" />
                                  Ver Detalles
                                </Button>

                                {/* Botón Formulario de Consulta Externa — solo citas atendidas */}
                                {cita.estado_cita === 'atendida' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => handleImprimirFormularioConsultaExterna(cita, consulta)}
                                    title="Imprimir formulario SNS-MSP/HCU-form.008/2021"
                                  >
                                    <Printer className="size-3 mr-2" />
                                    Formulario de Consulta Externa
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : esRolAgenda ? (
          /* ── AGENDA DE PACIENTES ─────────────────────────────────────────── */
          <div className="h-full flex flex-col space-y-4 overflow-hidden">

            {/* Chip de filtro activo por paciente */}
            {agendaFilterPaciente && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <User className="size-4 text-blue-600" />
                <span className="text-sm text-blue-700 font-medium">
                  Filtrando: {agendaFilterPaciente.nombre}
                </span>
                <button
                  className="ml-auto text-blue-500 hover:text-blue-700"
                  onClick={() => {
                    setAgendaFilterPaciente(null);
                    setAgendaFiltrada(agendaMedico);
                  }}
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* Barra de navegación */}
            <div className="flex items-center justify-between bg-white p-2 rounded-xl border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 w-8 p-0 hover:bg-white hover:shadow-sm"
                    onClick={() => {
                      const d = new Date(currentWeekAgenda);
                      d.setDate(d.getDate() - 7);
                      setCurrentWeekAgenda(d);
                    }}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 px-3 text-xs font-medium hover:bg-white hover:shadow-sm"
                    onClick={() => setCurrentWeekAgenda(new Date())}
                  >
                    Hoy
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 w-8 p-0 hover:bg-white hover:shadow-sm"
                    onClick={() => {
                      const d = new Date(currentWeekAgenda);
                      d.setDate(d.getDate() + 7);
                      setCurrentWeekAgenda(d);
                    }}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <span className="text-lg font-bold text-gray-800 tracking-tight">
                  {(() => {
                    const days = getWeekDaysAgenda();
                      return formatDateInEcuador(days[0], { month: 'long', year: 'numeric' }).toUpperCase();
                  })()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <Button
                    variant={vistaAgenda === 'semana' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setVistaAgenda('semana')}
                    className={`h-8 px-4 text-xs font-medium transition-all ${vistaAgenda === 'semana' ? 'bg-white shadow-sm' : ''}`}
                  >
                    Semana
                  </Button>
                  <Button
                    variant={vistaAgenda === 'lista' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setVistaAgenda('lista')}
                    className={`h-8 px-4 text-xs font-medium transition-all ${vistaAgenda === 'lista' ? 'bg-white shadow-sm' : ''}`}
                  >
                    Lista
                  </Button>
                </div>
                <Button
                  size="sm" variant="outline" className="h-9 px-4"
                  disabled={isLoadingAgenda}
                  onClick={cargarAgendaMedico}
                >
                  <RefreshCw className={`size-4 mr-2 ${isLoadingAgenda ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </div>

            {/* Barra de filtros */}
            <div className="flex items-center gap-4 px-4 py-3 bg-gray-50/50 rounded-xl border border-dashed">
              {vistaAgenda === 'lista' && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Rango:</span>
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
                    <div className="flex items-center gap-1 px-2 border-r">
                      <Calendar className="size-3 text-gray-400" />
                      <Input
                        type="date"
                        value={filterFechaDesdeAgenda}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterFechaDesdeAgenda(e.target.value)}
                        className="h-7 w-[120px] text-[11px] border-none focus-visible:ring-0 p-0"
                      />
                    </div>
                    <div className="flex items-center gap-1 px-2">
                      <Calendar className="size-3 text-gray-400" />
                      <Input
                        type="date"
                        value={filterFechaHastaAgenda}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterFechaHastaAgenda(e.target.value)}
                        className="h-7 w-[120px] text-[11px] border-none focus-visible:ring-0 p-0"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-gray-200 ml-auto">
                <Checkbox
                  id="agenda-canceladas"
                  checked={mostrarCanceladasAgenda}
                  onCheckedChange={(checked: boolean) => setMostrarCanceladasAgenda(checked)}
                  className="data-[state=checked]:bg-blue-600"
                />
                <label htmlFor="agenda-canceladas" className="text-[11px] font-semibold text-gray-600 cursor-pointer uppercase tracking-tight">
                  Ver canceladas
                </label>
              </div>
            </div>

            {/* Contenido de la agenda */}
            {isLoadingAgenda ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                {vistaAgenda === 'semana' ? (
                  /* Vista Semana */
                  <div className="grid grid-cols-7 gap-2">
                    {getWeekDaysAgenda().map((day, dayIdx) => {
                      const citasDelDia = getCitasPorDiaAgenda(day);
                      const isToday = getDateKeyInEcuador(day) === getDateKeyInEcuador(new Date());
                      return (
                        <div key={dayIdx} className={`min-h-[400px] ${isToday ? 'bg-blue-50' : 'bg-white'} rounded-lg border p-2`}>
                          <div className={`text-center mb-2 pb-2 border-b ${isToday ? 'border-blue-300' : ''}`}>
                            <div className={`text-xs ${isToday ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                              {formatDateInEcuador(day, { weekday: 'short' })}
                            </div>
                            <div className={`text-lg ${isToday ? 'bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto' : ''}`}>
                              {formatDateInEcuador(day, { day: 'numeric' })}
                            </div>
                          </div>
                          <div className="space-y-1">
                            {citasDelDia.map((cita) => (
                              <Card
                                key={cita.id_cita}
                                className={`p-2 cursor-pointer hover:shadow-md transition-shadow ${cita.estado_cita === 'cancelada' ? 'opacity-50' : ''}`}
                                onClick={() => setCitaDetalleAgenda(cita)}
                              >
                                <div className="text-xs space-y-1">
                                  <div className="flex items-center gap-1 font-semibold text-blue-700">
                                    <Clock className="size-3" />
                                    <span>{cita.hora_inicio.substring(0, 5)}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-medium truncate">
                                    Dr. {cita.usuario_sucursal.usuario.apellido.split(' ')[0]}
                                  </div>
                                  <div className="text-[10px] text-gray-500 truncate">
                                    {(cita as any).especialidades?.nombre || cita.usuario_sucursal.especialidad || 'Especialidad no definida'}
                                  </div>
                                  <div className="font-medium truncate text-gray-900">
                                    {cita.paciente.nombres.split(' ')[0]} {cita.paciente.apellidos.split(' ')[0]}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">{cita.motivo_consulta}</div>
                                  <Badge
                                    variant={cita.estado_cita === 'cancelada' ? 'destructive' : cita.consulta_realizada ? 'default' : 'secondary'}
                                    className="text-[10px] px-1 h-5"
                                  >
                                    {cita.estado_cita === 'cancelada' ? 'Cancelada' : cita.consulta_realizada ? 'Completada' : 'Programada'}
                                  </Badge>
                                </div>
                              </Card>
                            ))}
                            {citasDelDia.length === 0 && (
                              <div className="text-xs text-gray-400 text-center py-4">Sin citas</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Vista Lista */
                  <div className="space-y-3">
                    {agendaFiltrada.filter(c => mostrarCanceladasAgenda || c.estado_cita !== 'cancelada').length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <FileText className="size-12 mx-auto mb-3 text-gray-300" />
                        <p>No hay citas programadas para el rango seleccionado</p>
                      </div>
                    ) : (
                      agendaFiltrada
                        .filter(c => mostrarCanceladasAgenda || c.estado_cita !== 'cancelada')
                        .map((cita) => (
                          <Card key={cita.id_cita} className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge
                                    className={`bg-${getColorSucursalAgenda(cita.usuario_sucursal.sucursal.id_sucursal)}-100 text-${getColorSucursalAgenda(cita.usuario_sucursal.sucursal.id_sucursal)}-700`}
                                  >
                                    {cita.usuario_sucursal.sucursal.nombre}
                                  </Badge>
                                  <Badge variant={cita.estado_cita === 'cancelada' ? 'destructive' : cita.consulta_realizada ? 'default' : 'secondary'}>
                                    {cita.estado_cita === 'cancelada' ? 'Cancelada' : cita.consulta_realizada ? 'Completada' : 'Programada'}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <User className="size-4 text-gray-500" />
                                      <span className="font-semibold">{cita.paciente.nombres} {cita.paciente.apellidos}</span>
                                    </div>
                                    {cita.paciente.telefono && (
                                      <div className="flex items-center gap-2 text-gray-600">
                                        <Phone className="size-3" />
                                        <span className="text-xs">{cita.paciente.telefono}</span>
                                      </div>
                                    )}
                                    <div className="text-xs text-gray-500 mt-1">CI: {cita.paciente.cedula}</div>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Clock className="size-4 text-gray-500" />
                                      <span className="font-semibold">
                                        {formatCalendarDateFromIsoInEcuador(cita.fecha_cita, { day: '2-digit', month: '2-digit', year: 'numeric' })} — {cita.hora_inicio.substring(0, 5)}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600">{cita.motivo_consulta}</div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => setCitaDetalleAgenda(cita)}
                                >
                                  <Stethoscope className="size-4 mr-1" />
                                  Ver Detalles
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          /* ─────────────────────────────────────────────────────────────────── */
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-white rounded-lg border-2 border-dashed border-gray-200">
            <div className="p-6 bg-gray-50 rounded-full mb-6">
              <Search className="size-16 text-gray-300" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-700 mb-2">Busque un paciente para comenzar</h3>
            <p className="text-gray-500 max-w-md text-center">
              Haga clic en la barra de búsqueda superior para encontrar un paciente por nombre o número de cédula, o registre uno nuevo.
            </p>
          </div>
        )}
      </div>
        </>
      )}

      {/* Dialog: Buscar Paciente */}
      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Buscar Paciente</DialogTitle>
            <DialogDescription>
              Ingrese el nombre, apellido o cédula del paciente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 my-2">
            <Input
              placeholder="Ej: JUAN PEREZ o 1712345678"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value.toUpperCase())}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                  buscarPacientes(searchTerm);
                }
              }}
              autoFocus
              className="uppercase"
            />
            <Button onClick={() => buscarPacientes(searchTerm)} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              <span className="ml-2">Buscar</span>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto border rounded-md p-2 space-y-2">
            {isLoading ? (
              <div className="flex justify-center items-center h-full text-gray-500">
                <Loader2 className="size-6 animate-spin mr-2" /> Buscando...
              </div>
            ) : pacientes.length > 0 ? (
              pacientes.map((paciente: Paciente) => (
                <div
                  key={paciente.id_paciente}
                  className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg cursor-pointer border transition-colors"
                  onClick={() => {
                    if (esRolAgenda) {
                      // En modo agenda: filtrar la agenda por este paciente
                      const nombreCompleto = `${paciente.nombres} ${paciente.apellidos}`;
                      setAgendaFilterPaciente({ id: paciente.id_paciente, nombre: nombreCompleto });
                      setAgendaFiltrada(agendaMedico.filter(c => c.paciente.id_paciente === paciente.id_paciente));
                      setIsSearchDialogOpen(false);
                      setSearchTerm('');
                    } else {
                      setSelectedPatientId(paciente.id_paciente);
                      setIsSearchDialogOpen(false);
                      setSearchTerm('');
                    }
                  }}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {getIniciales(paciente.nombres, paciente.apellidos)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{paciente.nombres} {paciente.apellidos}</p>
                    <p className="text-xs text-gray-500">CI: {paciente.cedula} • {calcularEdad(paciente.fecha_nacimiento)} años</p>
                  </div>
                  <ChevronRight className="size-5 text-gray-400" />
                </div>
              ))
            ) : searchTerm && !isLoading ? (
              <div className="text-center py-8 text-gray-500">
                No se encontraron pacientes con "{searchTerm}"
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                Ingrese un término para buscar
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSearchDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nuevo Paciente */}
      <Dialog open={isNewPatientDialogOpen} onOpenChange={setIsNewPatientDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditingPatient ? 'Editar Datos del Paciente' : 'Registrar Nuevo Paciente'}</DialogTitle>
            <DialogDescription>
              {isEditingPatient ? 'Actualice la información del paciente seleccionado' : 'Complete los datos del nuevo paciente'}
            </DialogDescription>
          </DialogHeader>


          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="cedula">Cédula/ID *</Label>
                {isSearchingCedula && <span className="text-xs text-blue-600 flex items-center"><Loader2 className="size-3 animate-spin mr-1" /> Buscando...</span>}
              </div>
              <Input
                id="cedula"
                value={newPatient.cedula}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPatient({ ...newPatient, cedula: e.target.value.toUpperCase() })}
                onBlur={handleBlurCedula}
                placeholder="0000000000"
                className="uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombres">Nombres *</Label>
              <Input
                id="nombres"
                value={newPatient.nombres}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPatient({ ...newPatient, nombres: e.target.value.toUpperCase() })}
                placeholder="Nombres"
                className="uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apellidos">Apellidos *</Label>
              <Input
                id="apellidos"
                value={newPatient.apellidos}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPatient({ ...newPatient, apellidos: e.target.value.toUpperCase() })}
                placeholder="Apellidos"
                className="uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento *</Label>
              <Input
                id="fecha_nacimiento"
                type="date"
                value={newPatient.fecha_nacimiento}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPatient({ ...newPatient, fecha_nacimiento: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sexo">Sexo *</Label>
              <Select
                value={newPatient.sexo}
                onValueChange={(value: string) => setNewPatient({ ...newPatient, sexo: value as 'M' | 'F' | 'Otro' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono * (Ej: +593984035410)</Label>
              <Input
                id="telefono"
                value={newPatient.telefono}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPatient({ ...newPatient, telefono: e.target.value })}
                placeholder="0999999999"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="email">Correo Electrónico *</Label>
              <Input
                id="email"
                type="email"
                value={newPatient.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPatient({ ...newPatient, email: e.target.value.toUpperCase() })}
                placeholder="PACIENTE@EMAIL.COM"
                className="uppercase"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={newPatient.direccion}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPatient({ ...newPatient, direccion: e.target.value.toUpperCase() })}
                placeholder="DIRECCIÓN COMPLETA"
                className="uppercase"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewPatientDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreatePatient} className="bg-blue-600 hover:bg-blue-700">
              {isEditingPatient ? 'Actualizar Paciente' : 'Registrar Paciente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Constantes Vitales y Antropometría */}
      <Dialog open={isSignosVitalesDialogOpen} onOpenChange={setIsSignosVitalesDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar constantes vitales y antropometría</DialogTitle>
            <DialogDescription>
              {selectedPatientId && pacientes.find((p: Paciente) => p.id_paciente === selectedPatientId)
                ? `Paciente: ${pacientes.find((p: Paciente) => p.id_paciente === selectedPatientId)!.nombres} ${pacientes.find((p: Paciente) => p.id_paciente === selectedPatientId)!.apellidos}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Talla (cm)</Label>
              <Input
                type="number"
                step="0.1"
                max="999.99"
                value={signosVitalesForm.estatura_cm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, estatura_cm: e.target.value })}
                placeholder="170.5"
              />
            </div>

            <div className="space-y-2">
              <Label>Peso (kg)</Label>
              <Input
                type="number"
                step="0.1"
                max="999.99"
                value={signosVitalesForm.peso_kg}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, peso_kg: e.target.value })}
                placeholder="70.5"
              />
            </div>

            <div className="space-y-2">
              <Label>Perímetro cefálico (cm)</Label>
              <Input
                type="number"
                step="0.1"
                max="999.99"
                value={signosVitalesForm.perimetro_cefalico_cm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, perimetro_cefalico_cm: e.target.value })}
                placeholder="56"
              />
            </div>

            <div className="space-y-2">
              <Label>Temperatura (°C)</Label>
              <Input
                type="number"
                step="0.1"
                max="999.99"
                value={signosVitalesForm.temperatura_c}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, temperatura_c: e.target.value })}
                placeholder="36.5"
              />
            </div>

            <div className="space-y-2">
              <Label>Frec. Respiratoria</Label>
              <Input
                type="number"
                max="999"
                value={signosVitalesForm.frecuencia_respiratoria}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, frecuencia_respiratoria: e.target.value })}
                placeholder="18"
              />
            </div>

            <div className="space-y-2">
              <Label>Frec. Cardíaca (bpm)</Label>
              <Input
                type="number"
                max="999"
                value={signosVitalesForm.frecuencia_cardiaca}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, frecuencia_cardiaca: e.target.value })}
                placeholder="75"
              />
            </div>

            <div className="space-y-2">
              <Label>Pulsoximetría (%)</Label>
              <Input
                type="number"
                step="0.1"
                max="100"
                value={signosVitalesForm.saturacion_oxigeno}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, saturacion_oxigeno: e.target.value })}
                placeholder="98"
              />
            </div>

            <div className="space-y-2">
              <Label>Presión Sistólica</Label>
              <Input
                type="number"
                max="999"
                value={signosVitalesForm.presion_sistolica}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, presion_sistolica: e.target.value })}
                placeholder="120"
              />
            </div>

            <div className="space-y-2">
              <Label>Presión Diastólica</Label>
              <Input
                type="number"
                max="999"
                value={signosVitalesForm.presion_diastolica}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, presion_diastolica: e.target.value })}
                placeholder="80"
              />
            </div>

            <div className="space-y-2">
              <Label>Glucemia capilar (mg/dL)</Label>
              <Input
                type="number"
                max="999"
                value={signosVitalesForm.glucosa_mg_dl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, glucosa_mg_dl: e.target.value })}
                placeholder="95"
              />
            </div>

            <div className="space-y-2">
              <Label>Glasgow ocular (4)</Label>
              <Input
                type="number"
                min="1"
                max="4"
                value={signosVitalesForm.glasgow_ocular}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, glasgow_ocular: e.target.value })}
                placeholder="4"
              />
            </div>

            <div className="space-y-2">
              <Label>Glasgow verbal (5)</Label>
              <Input
                type="number"
                min="1"
                max="5"
                value={signosVitalesForm.glasgow_verbal}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, glasgow_verbal: e.target.value })}
                placeholder="5"
              />
            </div>

            <div className="space-y-2">
              <Label>Glasgow motora (6)</Label>
              <Input
                type="number"
                min="1"
                max="6"
                value={signosVitalesForm.glasgow_motora}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, glasgow_motora: e.target.value })}
                placeholder="6"
              />
            </div>

            <div className="space-y-2">
              <Label>Reacción pupilar</Label>
              <Select
                value={signosVitalesForm.reaccion_pupilar || undefined}
                onValueChange={(value) => setSignosVitalesForm({ ...signosVitalesForm, reaccion_pupilar: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REACTIVA">Reactiva</SelectItem>
                  <SelectItem value="LENTA">Lenta</SelectItem>
                  <SelectItem value="NO REACTIVA">No reactiva</SelectItem>
                  <SelectItem value="ANISOCORICAS">Anisocóricas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>T. llenado capilar (seg)</Label>
              <Input
                type="number"
                step="0.1"
                max="99.99"
                value={signosVitalesForm.tiempo_llenado_capilar_seg}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignosVitalesForm({ ...signosVitalesForm, tiempo_llenado_capilar_seg: e.target.value })}
                placeholder="2"
              />
            </div>

            <div className="space-y-2 col-span-3">
              <Label>Notas</Label>
              <Textarea
                value={signosVitalesForm.notas}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSignosVitalesForm({ ...signosVitalesForm, notas: e.target.value })}
                placeholder="Observaciones clínicas adicionales..."
                className="min-h-[90px]"
              />
            </div>


          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSignosVitalesDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSignosVitales} className="bg-blue-600 hover:bg-blue-700">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pantalla de Nueva Consulta */}
      {isConsultaScreenOpen && (
        <div className="flex-1 overflow-hidden">
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Nueva Consulta - {pacienteSeleccionado?.nombres} {pacienteSeleccionado?.apellidos}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                    <Calendar className="size-4" />
                    <span>{new Date().toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                      Cita N° {citaIdParaConsulta || citaIdInicial || 'GENERANDO...'}
                    </Badge>
                    {solicitudImagenActual?.numero_solicitud_imagen && (
                      <Badge variant="outline" className="border-sky-300 text-sky-700 bg-sky-50">
                        Imagen N° {String(solicitudImagenActual.numero_solicitud_imagen).padStart(7, '0')}
                      </Badge>
                    )}
                    {pedidoLaboratorioActual?.numero_pedido_laboratorio && (
                      <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">
                        Lab N° {String(pedidoLaboratorioActual.numero_pedido_laboratorio).padStart(7, '0')}
                      </Badge>
                    )}
                    {isAutoSavingConsulta && (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <Loader2 className="size-3 animate-spin" /> Guardado automático...
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsConsultaScreenOpen(false)}
                  disabled={isSavingConsulta}
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Volver
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto pt-6">
              <div className="space-y-4 pb-6">
            {/* Selector de Sucursal */}
            <div className="space-y-2 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <Label htmlFor="sucursalConsulta" className="font-medium text-blue-900">
                Sucursal * {sucursales.length > 0 && <span className="font-normal text-blue-700">({sucursales.length} disponibles)</span>}
              </Label>
              <Select
                value={sucursalSeleccionada?.toString() || ''}
                onValueChange={(value: string) => {
                  console.log('Sucursal seleccionada:', value);
                  setSucursalSeleccionada(parseInt(value));
                }}
              >
                <SelectTrigger className="bg-white w-full" id="sucursalConsulta">
                  <SelectValue placeholder="Seleccione una sucursal..." />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100] max-w-[700px]">
                  {sucursales.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">No hay sucursales disponibles</div>
                  ) : (
                    sucursales.map((sucursal: any) => (
                      <SelectItem key={sucursal.id_sucursal} value={sucursal.id_sucursal.toString()}>
                        <div className="flex flex-col">
                          <span className="font-medium">{sucursal.nombre}</span>
                          {sucursal.direccion && <span className="text-xs text-gray-500">{sucursal.direccion}</span>}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-blue-700 flex items-center gap-1">
                📍 Selecciona la sucursal donde se registrará la consulta
              </p>
            </div>

            {/* Motivo de Consulta */}
            <div className="space-y-2">
              <Label htmlFor="motivoConsulta" className="text-sm">Motivo de Consulta *</Label>
              <Textarea
                id="motivoConsulta"
                value={consultaForm.motivo_consulta}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setConsultaForm({ ...consultaForm, motivo_consulta: e.target.value.toUpperCase() })}
                placeholder="¿POR QUÉ ACUDE EL PACIENTE A CONSULTA?..."
                className="min-h-[80px] text-sm uppercase"
              />
            </div>

            {/* Enfermedad o problema actual */}
            <div className="space-y-2">
              <Label htmlFor="historialClinico" className="text-sm">Enfermedad o problema actual</Label>
              <Textarea
                id="historialClinico"
                value={consultaForm.historial_clinico}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setConsultaForm({ ...consultaForm, historial_clinico: e.target.value.toUpperCase() })}
                placeholder="DESCRIBA LA ENFERMEDAD O PROBLEMA ACTUAL DEL PACIENTE..."
                className="min-h-[100px] text-sm uppercase"
              />
            </div>

            {/* Examen Físico */}
            <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div>
                <Label className="text-sm font-medium text-orange-900">Examen Físico</Label>
                <p className="text-xs text-orange-700 mt-1">
                  Marque los segmentos evaluados durante la exploración física.
                </p>
              </div>

              <div className="space-y-2">
                {EXAMEN_FISICO_SEGMENTOS.map((segmento) => {
                  const checked = examenFisicoSeleccionados.includes(segmento);

                  return (
                    <div
                      key={segmento}
                      className={`rounded-md border bg-white p-2 text-xs transition-colors ${checked ? 'border-orange-400' : 'border-orange-200'}`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value: boolean | 'indeterminate') => {
                            setExamenFisicoSeleccionados((prev) =>
                              value === true ? [...prev, segmento] : prev.filter((item) => item !== segmento)
                            );
                          }}
                        />
                        <span className="font-medium">{segmento}</span>
                      </label>
                      {checked && (
                        <Textarea
                          value={notasExamenFisico[segmento] || ''}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setNotasExamenFisico((prev) => ({ ...prev, [segmento]: e.target.value }))
                          }
                          placeholder={`Observaciones de ${segmento.toLowerCase()}...`}
                          className="mt-2 min-h-[56px] bg-orange-50 text-xs"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-md border border-orange-200 bg-white p-2 text-xs text-orange-900">
                {consultaForm.pedido_examenes || 'SIN EXAMEN FISICO REGISTRADO'}
              </div>
            </div>

            {/* Diagnóstico IA por código CIE-10 */}
            <div className="space-y-3 border border-purple-200 rounded-lg p-4 bg-purple-50">
              <div className="space-y-2">
                <Label htmlFor="codigoCie10" className="text-sm font-medium text-purple-900 flex items-center gap-2">
                  <Brain className="size-4" />
                  Código CIE-10 o descripción clínica
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="codigoCie10"
                    value={codigoCie10Input}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCodigoCie10Input(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleAgregarDiagnosticoIA(); }}
                    placeholder="Ej: J30.9  ó  dolor abdominal"
                    className="text-sm bg-white"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-purple-300 text-purple-700 hover:bg-purple-100"
                    disabled={!codigoCie10Input.trim() || isLoadingDiagnosticoIA}
                    onClick={handleAgregarDiagnosticoIA}
                  >
                    {isLoadingDiagnosticoIA ? (
                      <><Loader2 className="size-3 mr-1 animate-spin" />Consultando...</>
                    ) : (
                      <><Brain className="size-3 mr-1" />Agregar</>
                    )}
                  </Button>
                </div>
              </div>

              {diagnosticosCie10.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-purple-700 font-medium">Listado de diagnósticos CIE-10 agregados:</p>
                  {diagnosticosCie10.map((d) => (
                    <div
                      key={d.codigo}
                      className="w-full text-left px-3 py-2 rounded-md border border-purple-200 bg-white text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-mono font-bold text-purple-700">{d.codigo}</span>
                          {' — '}
                          <span className="font-medium">{d.nombre}</span>
                          <p className="text-xs text-gray-500 mt-1">{d.descripcion}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-gray-500 hover:text-red-600"
                          onClick={() => {
                            const actualizados = diagnosticosCie10.filter(item => item.codigo !== d.codigo);
                            setDiagnosticosCie10(actualizados);
                            setConsultaForm({
                              ...consultaForm,
                              diagnostico: actualizados.map(item => `${item.codigo} - ${item.nombre}: ${item.descripcion}`).join('\n')
                            });
                          }}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Textarea
                  id="diagnosticoConfirmado"
                  value={consultaForm.diagnostico}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setConsultaForm({ ...consultaForm, diagnostico: e.target.value.toUpperCase() })
                  }
                  placeholder="Diagnóstico confirmado (puede editar manualmente el texto final)..."
                  className="min-h-[60px] text-sm uppercase"
                />
              </div>
            </div>

            {/* Gestión de Laboratorio */}
            <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-sm font-medium text-orange-900">Gestión de Laboratorio</Label>
                  <p className="text-xs text-orange-700 mt-1">
                    Seleccione médico y exámenes desde el catálogo de laboratorio.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-orange-300 bg-white text-orange-800 hover:bg-orange-100"
                    onClick={() => handleImprimirPedidoLaboratorio(
                      pedidoLaboratorioActual,
                      pacienteSeleccionado,
                      {
                        examenes: examenesLaboratorioSeleccionadosData,
                        medicoNombre: medicoLaboratorioActual?.usuario
                          ? `${medicoLaboratorioActual.usuario.nombre} ${medicoLaboratorioActual.usuario.apellido}`
                          : undefined,
                        observaciones: observacionesLaboratorio,
                      }
                    )}
                    disabled={!pedidoLaboratorioActual && examenesLaboratorioSeleccionadosData.length === 0}
                  >
                    <Printer className="size-4 mr-2" />
                    Imprimir gestión
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-orange-300 bg-white text-orange-800 hover:bg-orange-100"
                    onClick={() => setIsLaboratorioDialogOpen(true)}
                  >
                    <Plus className="size-4 mr-2" />
                    Gestionar laboratorio
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="bg-white border-orange-300 text-orange-800">
                  {examenesLaboratorioSeleccionadosData.length} examen(es) seleccionado(s)
                </Badge>
                {medicoLaboratorioActual?.usuario && (
                  <Badge variant="outline" className="bg-white border-orange-300 text-orange-800">
                    Médico: {medicoLaboratorioActual.usuario.nombre} {medicoLaboratorioActual.usuario.apellido}
                  </Badge>
                )}
                {pedidoLaboratorioActual && (
                  <Badge variant="outline" className="bg-white border-orange-300 text-orange-800">
                    Pedido #{pedidoLaboratorioActual.numero_pedido_laboratorio}
                  </Badge>
                )}
              </div>
            </div>

            {/* Solicitud de Imagen */}
            <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-sm font-medium text-sky-900">Solicitud de Imagen</Label>
                  <p className="text-xs text-sky-700 mt-1">
                    Complete los datos del formato y use imprimir para generar la hoja con logotipo.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {solicitudImagenActual?.numero_solicitud_imagen && (
                    <Badge variant="outline" className="bg-white border-sky-300 text-sky-800">
                      N° {String(solicitudImagenActual.numero_solicitud_imagen).padStart(7, '0')}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="border-sky-300 bg-white text-sky-800 hover:bg-sky-100"
                    onClick={handleImprimirSolicitudImagenDesdeConsulta}
                  >
                    <Printer className="size-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1 md:col-span-1">
                  <Label className="text-xs font-medium text-sky-900">Fecha</Label>
                  <Input
                    type="date"
                    value={solicitudImagenForm.fecha_solicitud}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSolicitudImagenForm((prev) => ({ ...prev, fecha_solicitud: e.target.value }))
                    }
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1 md:col-span-1">
                  <Label className="text-xs font-medium text-sky-900">Nombre</Label>
                  <Input
                    value={pacienteSeleccionado ? `${pacienteSeleccionado.nombres} ${pacienteSeleccionado.apellidos}` : ''}
                    readOnly
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1 md:col-span-1">
                  <Label className="text-xs font-medium text-sky-900">Edad</Label>
                  <Input
                    value={pacienteSeleccionado ? `${calcularEdad(pacienteSeleccionado.fecha_nacimiento)} años` : ''}
                    readOnly
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-sky-900">Procedimiento</Label>
                <Textarea
                  value={solicitudImagenForm.procedimiento}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setSolicitudImagenForm((prev) => ({ ...prev, procedimiento: e.target.value.toUpperCase() }))
                  }
                  className="min-h-[70px] bg-white text-sm uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-sky-900">Antecedentes Clínico - Quirúrgico</Label>
                <Textarea
                  value={solicitudImagenForm.antecedentes_clinico_quirurgico}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setSolicitudImagenForm((prev) => ({ ...prev, antecedentes_clinico_quirurgico: e.target.value.toUpperCase() }))
                  }
                  className="min-h-[70px] bg-white text-sm uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-sky-900">Cuadro Clínico</Label>
                <Textarea
                  value={solicitudImagenForm.cuadro_clinico}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setSolicitudImagenForm((prev) => ({ ...prev, cuadro_clinico: e.target.value.toUpperCase() }))
                  }
                  className="min-h-[70px] bg-white text-sm uppercase"
                />
              </div>

              <div className="space-y-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-sky-900">Medicamentos</Label>
                  <Textarea
                    value={solicitudImagenForm.medicamentos}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setSolicitudImagenForm((prev) => ({ ...prev, medicamentos: e.target.value.toUpperCase() }))
                    }
                    className="min-h-[70px] bg-white text-sm uppercase"
                  />
                </div>
                <p className="text-xs text-sky-700">
                  Alergias: <span className="font-medium text-sky-900">{alergiasDesdeAntecedentesTexto}</span>
                </p>
              </div>

            </div>

            {/* Fecha de Seguimiento */}
            <div className="space-y-2">
              <Label htmlFor="fechaSeguimiento" className="text-sm">Próxima Consulta / Fecha de Seguimiento</Label>
              <Input
                id="fechaSeguimiento"
                type="date"
                value={consultaForm.fecha_seguimiento}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConsultaForm({ ...consultaForm, fecha_seguimiento: e.target.value })}
                className="text-sm"
              />
            </div>

            {/* Pedido de Hospitalización */}
            <div className="space-y-2">
              <Label htmlFor="pedidoHospitalizacion" className="text-sm">Pedido de Hospitalización</Label>
              <Textarea
                id="pedidoHospitalizacion"
                value={consultaForm.pedido_hospitalizacion}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setConsultaForm({ ...consultaForm, pedido_hospitalizacion: e.target.value.toUpperCase() })}
                placeholder="INDICACIONES Y MOTIVO DE HOSPITALIZACIÓN (dejar vacío si no aplica)..."
                className="min-h-[80px] text-sm uppercase"
              />
            </div>

            {/* Interconsulta */}
            <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="size-4 text-purple-700" />
                  <div>
                    <Label className="text-sm font-medium text-purple-900">Interconsulta</Label>
                    <p className="text-xs text-purple-700 mt-1">
                      Registre e imprima la solicitud de interconsulta con número secuencial.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {interconsultasActuales[0]?.numero_interconsulta && (
                    <Badge variant="outline" className="bg-white border-purple-300 text-purple-800">
                      N° {String(interconsultasActuales[0].numero_interconsulta).padStart(7, '0')}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="border-purple-300 bg-white text-purple-800 hover:bg-purple-100"
                    onClick={handleImprimirInterconsultaDesdeConsulta}
                    disabled={isSavingInterconsulta}
                  >
                    {isSavingInterconsulta ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Printer className="size-4 mr-2" />
                    )}
                    Imprimir
                  </Button>
                </div>
              </div>

              {/* Formulario nueva interconsulta */}
              <div className="space-y-3 rounded-md border border-purple-200 bg-white p-3">
                {/* Tipo destino */}
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-gray-600">Tipo de destino</Label>
                    <Select
                      value={interconsultaForm.tipo_destino}
                      onValueChange={(v: 'interno' | 'externo') =>
                        setInterconsultaForm({ ...interconsultaForm, tipo_destino: v, id_usuario_destino: null, id_especialidad_destino: null, especialidad_destino_texto: '', medico_destino_externo: '' })
                      }
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interno">Interno (Clínica Atlas)</SelectItem>
                        <SelectItem value="externo">Externo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-gray-600">Urgencia</Label>
                    <Select
                      value={interconsultaForm.urgencia}
                      onValueChange={(v: 'normal' | 'urgente') => setInterconsultaForm({ ...interconsultaForm, urgencia: v })}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Especialidad */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Especialidad destino</Label>
                  {interconsultaForm.tipo_destino === 'interno' ? (
                    <Select
                      value={interconsultaForm.id_especialidad_destino?.toString() ?? ''}
                      onValueChange={(v) => setInterconsultaForm({ ...interconsultaForm, id_especialidad_destino: parseInt(v) })}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Seleccione especialidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {especialidadesInterconsulta.map((e) => (
                          <SelectItem key={e.id_especialidad} value={e.id_especialidad.toString()}>
                            {e.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={interconsultaForm.especialidad_destino_texto}
                      onChange={(e) => setInterconsultaForm({ ...interconsultaForm, especialidad_destino_texto: e.target.value })}
                      placeholder="Especialidad destino..."
                      className="text-sm"
                    />
                  )}
                </div>

                {/* Fecha límite */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Fecha límite deseada (opcional)</Label>
                  <Input
                    type="date"
                    value={interconsultaForm.fecha_limite}
                    onChange={(e) => setInterconsultaForm({ ...interconsultaForm, fecha_limite: e.target.value })}
                    className="text-sm"
                  />
                </div>

                {/* Motivo */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Motivo <span className="text-red-500">*</span></Label>
                  <Textarea
                    value={interconsultaForm.motivo}
                    onChange={(e) => setInterconsultaForm({ ...interconsultaForm, motivo: e.target.value })}
                    placeholder="Motivo de la interconsulta..."
                    className="min-h-[60px] text-sm"
                  />
                </div>

                {/* Resumen clínico */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Resumen clínico</Label>
                  <Textarea
                    value={interconsultaForm.resumen_clinico}
                    onChange={(e) => setInterconsultaForm({ ...interconsultaForm, resumen_clinico: e.target.value })}
                    placeholder="Resumen clínico del paciente (pre-llenar desde diagnóstico si aplica)..."
                    className="min-h-[60px] text-sm"
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleAgregarInterconsulta}
                  disabled={isSavingInterconsulta || !interconsultaForm.motivo.trim() || interconsultasActuales.length > 0}
                  className="w-full bg-purple-700 text-white hover:bg-purple-800"
                >
                  {isSavingInterconsulta ? (
                    <><Loader2 className="size-4 mr-2 animate-spin" />Guardando...</>
                  ) : (
                    <><Plus className="size-4 mr-2" />Agregar interconsulta</>
                  )}
                </Button>
              </div>

              {/* Lista de interconsultas guardadas */}
              {isLoadingInterconsultas && (
                <div className="flex items-center gap-2 text-xs text-purple-600">
                  <Loader2 className="size-3 animate-spin" />
                  Cargando interconsultas...
                </div>
              )}
              {interconsultasActuales.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-purple-800">Interconsultas registradas:</p>
                  {interconsultasActuales.map((ic) => {
                    const destino = ic.tipo_destino === 'interno'
                      ? (ic.especialidad?.nombre ?? 'Sin especialidad')
                      : (ic.especialidad_destino_texto ?? 'Externo');
                    return (
                      <div key={ic.id_interconsulta} className="flex items-start justify-between gap-2 rounded border border-purple-100 bg-purple-50 p-2 text-xs">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {ic.numero_interconsulta && (
                              <span className="rounded bg-white px-1.5 py-0.5 text-xs font-medium text-purple-700">
                                N° {String(ic.numero_interconsulta).padStart(7, '0')}
                              </span>
                            )}
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${getInterconsultaEstadoClass(ic.estado)}`}>
                              {getInterconsultaEstadoLabel(ic.estado)}
                            </span>
                            {ic.urgencia === 'urgente' && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">URGENTE</span>}
                            <span className="font-medium text-gray-800">{destino}</span>
                          </div>
                          <p className="text-gray-600">{ic.motivo}</p>
                          {ic.fecha_limite && <p className="text-gray-500">Límite: {new Date(ic.fecha_limite + 'T00:00:00').toLocaleDateString('es-ES')}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleImprimirInterconsulta(ic)}
                            className="text-purple-500 hover:text-purple-700 mt-0.5"
                            title="Imprimir interconsulta"
                          >
                            <Printer className="size-3.5" />
                          </button>
                          {ic.estado === 'PENDIENTE_AGENDAR' && (
                            <button
                              type="button"
                              onClick={() => handleEliminarInterconsulta(ic.id_interconsulta)}
                              className="text-red-400 hover:text-red-600 mt-0.5"
                              title="Eliminar interconsulta"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Receta Médica */}
            <div className="space-y-3 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-sm font-medium text-cyan-900">Receta Médica</Label>
                  <p className="text-xs text-cyan-700 mt-1">Complete Rp e Indicaciones para impresión en formato de receta.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-cyan-300 bg-white text-cyan-800 hover:bg-cyan-100"
                  onClick={handleImprimirReceta}
                >
                  <Printer className="size-4 mr-2" />
                  Imprimir Receta
                </Button>
              </div>

              <div className="rounded-md border border-cyan-200 bg-white p-3 text-sm text-cyan-900">
                <span className="font-medium">Alergias:</span> {alergiasDesdeAntecedentesTexto}
              </div>

              <div className="space-y-2">
                <Label htmlFor="recetaRp" className="text-sm">Rp</Label>
                <Textarea
                  id="recetaRp"
                  value={consultaForm.receta_rp}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setConsultaForm({ ...consultaForm, receta_rp: e.target.value.toUpperCase() })
                  }
                  placeholder="MEDICACIÓN (FÁRMACO, DOSIS, VÍA, FRECUENCIA)..."
                  className="min-h-[100px] text-sm uppercase bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recetaIndicaciones" className="text-sm">Indicaciones</Label>
                <Textarea
                  id="recetaIndicaciones"
                  value={consultaForm.receta_indicaciones}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setConsultaForm({ ...consultaForm, receta_indicaciones: e.target.value.toUpperCase() })
                  }
                  placeholder="INDICACIONES AL PACIENTE..."
                  className="min-h-[100px] text-sm uppercase bg-white"
                />
              </div>
            </div>
              </div>
            </CardContent>

            <div className="border-t p-4 flex justify-end">
              <Button
                onClick={handleGuardarConsulta}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isSavingConsulta}
              >
                {isSavingConsulta ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Consulta'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Dialog open={isLaboratorioDialogOpen} onOpenChange={setIsLaboratorioDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <FileText className="size-5" />
              Pedido de Laboratorio
            </DialogTitle>
            <DialogDescription>
              Seleccione el médico responsable y los exámenes que se solicitarán en esta consulta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="medicoLaboratorio">Médico *</Label>
              <Select value={medicoLaboratorioSeleccionado} onValueChange={setMedicoLaboratorioSeleccionado}>
                <SelectTrigger id="medicoLaboratorio" className="bg-white">
                  <SelectValue placeholder={isLoadingMedicosLaboratorio ? 'Cargando médicos...' : 'Seleccione un médico'} />
                </SelectTrigger>
                <SelectContent>
                  {medicosLaboratorio.map((medico) => (
                    <SelectItem key={medico.id_usuario_sucursal} value={medico.id_usuario_sucursal.toString()}>
                      {medico.usuario?.nombre} {medico.usuario?.apellido} - {medico.especialidad || 'Sin especialidad'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacionesLaboratorio">Observaciones del pedido</Label>
              <Textarea
                id="observacionesLaboratorio"
                value={observacionesLaboratorio}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setObservacionesLaboratorio(e.target.value.toUpperCase())}
                placeholder="OBSERVACIONES OPCIONALES DEL PEDIDO DE LABORATORIO..."
                className="min-h-[90px] text-sm uppercase bg-white"
              />
            </div>

            <div className="rounded-lg border bg-white">
              <div className="border-b px-4 py-3 text-sm font-medium text-gray-700">
                Catálogo de exámenes
              </div>
              <div className="max-h-[380px] overflow-y-auto p-4 space-y-4">
                {isLoadingLaboratorio ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="size-4 animate-spin" />
                    Cargando catálogo de laboratorio...
                  </div>
                ) : Object.keys(examenesLaboratorioAgrupados).length === 0 ? (
                  <p className="text-sm text-gray-500">No hay exámenes activos en el catálogo.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(examenesLaboratorioAgrupados).map(([categoria, examenes]) => (
                      <div key={categoria} className="space-y-3 rounded-md border border-orange-100 bg-orange-50/40 p-3">
                        <h4 className="text-sm font-semibold text-orange-800">{categoria}</h4>
                        <div className="space-y-2">
                          {examenes.map((examen) => {
                            const checked = examenesLaboratorioSeleccionados.includes(examen.id_examen_laboratorio);
                            return (
                              <label
                                key={examen.id_examen_laboratorio}
                                className="flex items-start gap-3 rounded-md border bg-white p-3 text-sm cursor-pointer hover:border-orange-300"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    setExamenesLaboratorioSeleccionados((prev) => {
                                      if (value === true) {
                                        return [...prev, examen.id_examen_laboratorio];
                                      }
                                      return prev.filter((item) => item !== examen.id_examen_laboratorio);
                                    });
                                  }}
                                />
                                <span>{examen.nombre}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <h4 className="text-sm font-medium text-orange-900 mb-2">Resumen del pedido</h4>
              <Textarea
                value={resumenLaboratorioSeleccion}
                readOnly
                placeholder="Seleccione médico y exámenes para generar el resumen"
                className="min-h-[140px] bg-white text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLaboratorioDialogOpen(false)}>
              Cerrar
            </Button>
            <Button
              onClick={() => setIsLaboratorioDialogOpen(false)}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={examenesLaboratorioSeleccionados.length > 0 && !medicoLaboratorioSeleccionado}
            >
              Usar pedido en consulta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ver Detalles de Consulta */}
      <Dialog open={isVerConsultaDialogOpen} onOpenChange={setIsVerConsultaDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-blue-600" />
              Detalles de la Consulta Médica
            </DialogTitle>
            <DialogDescription>
              Información registrada por el médico durante la consulta
            </DialogDescription>
          </DialogHeader>

          {consultaSeleccionada && (
            <div className="space-y-6">
              {/* Información del médico */}
              {(() => {
                const citaCons = citasPaciente.find(c => c.id_cita === consultaSeleccionada.id_cita);
                const usu = citaCons?.usuario_sucursal?.usuario as any;
                const medicoNombre = usu ? `${usu.nombre} ${usu.apellido}` : `Médico ID ${consultaSeleccionada.id_usuario}`;
                const especialidad = citaCons?.usuario_sucursal?.especialidad;
                return (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">Información del Médico</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p><strong>Médico:</strong> {medicoNombre}{especialidad ? ` — ${especialidad}` : ''}</p>
                      <p><strong>Fecha de Consulta:</strong> {new Date(consultaSeleccionada.fecha_consulta).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</p>
                    </div>
                  </div>
                );
              })()}

              {isLoadingDetalleConsulta && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando solicitud de imagen y pedido de laboratorio...
                </div>
              )}

              {/* Motivo de Consulta */}
              {(() => {
                const citaCorrespondiente = citasPaciente.find(c => c.id_cita === consultaSeleccionada.id_cita);
                return citaCorrespondiente?.motivo_consulta && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Motivo de Consulta</Label>
                    <div className="bg-gray-50 p-3 rounded-md text-sm whitespace-pre-wrap">
                      {citaCorrespondiente.motivo_consulta}
                    </div>
                  </div>
                );
              })()}

              {/* Enfermedad o problema actual */}
              {consultaSeleccionada.historial_clinico && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Enfermedad o problema actual</Label>
                  <div className="bg-gray-50 p-3 rounded-md text-sm whitespace-pre-wrap">
                    {consultaSeleccionada.historial_clinico}
                  </div>
                </div>
              )}

              {/* Código CIE-10 */}
              {consultaSeleccionada.diagnostico && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Código CIE-10</Label>
                  <div className="bg-blue-50 p-3 rounded-md text-sm whitespace-pre-wrap border border-blue-200">
                    {consultaSeleccionada.diagnostico}
                  </div>
                </div>
              )}

              {/* Examen Físico */}
              {consultaSeleccionada.pedido_examenes && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-orange-700">Examen Físico</Label>
                  <div className="bg-orange-50 p-3 rounded-md text-sm whitespace-pre-wrap border border-orange-200">
                    {consultaSeleccionada.pedido_examenes}
                  </div>
                </div>
              )}

              {/* Solicitud de Imagen */}
              {solicitudImagenDetalle && (
                <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label className="text-sm font-medium text-sky-900">Solicitud de Imagen</Label>
                      <p className="text-xs text-sky-700 mt-1">Información guardada en la base de datos para reimpresión.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-sky-300 bg-white text-sky-800 hover:bg-sky-100"
                      onClick={() => handleImprimirSolicitudImagen(solicitudImagenDetalle, pacienteSeleccionado)}
                    >
                      <Printer className="size-4 mr-2" />
                      Reimprimir
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-sky-900">Fecha</Label>
                      <div className="rounded-md border border-sky-200 bg-white p-2 text-sm">{solicitudImagenDetalle.fecha_solicitud}</div>
                    </div>
                    <div className="space-y-1 md:col-span-1">
                      <Label className="text-xs font-medium text-sky-900">Nombre</Label>
                      <div className="rounded-md border border-sky-200 bg-white p-2 text-sm">{solicitudImagenDetalle.nombre_paciente}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-sky-900">Edad</Label>
                      <div className="rounded-md border border-sky-200 bg-white p-2 text-sm">{solicitudImagenDetalle.edad_paciente ?? ''}{solicitudImagenDetalle.edad_paciente != null ? ' años' : ''}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-sky-900">Procedimiento</Label>
                    <div className="rounded-md border border-sky-200 bg-white p-2 text-sm whitespace-pre-wrap">{solicitudImagenDetalle.procedimiento || ''}</div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-sky-900">Antecedentes Clínico - Quirúrgico</Label>
                    <div className="rounded-md border border-sky-200 bg-white p-2 text-sm whitespace-pre-wrap">{solicitudImagenDetalle.antecedentes_clinico_quirurgico || ''}</div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-sky-900">Cuadro Clínico</Label>
                    <div className="rounded-md border border-sky-200 bg-white p-2 text-sm whitespace-pre-wrap">{solicitudImagenDetalle.cuadro_clinico || ''}</div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-sky-900">Medicamentos</Label>
                      <div className="rounded-md border border-sky-200 bg-white p-2 text-sm whitespace-pre-wrap">{solicitudImagenDetalle.medicamentos || ''}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-sky-900">Alergias</Label>
                      <div className="rounded-md border border-sky-200 bg-white p-2 text-sm whitespace-pre-wrap">{solicitudImagenDetalle.alergias || ''}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Gestión de Laboratorio */}
              {pedidoLaboratorioDetalle && (
                <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label className="text-sm font-medium text-orange-900">Gestión de Laboratorio</Label>
                      <p className="text-xs text-orange-700 mt-1">Pedido guardado en la base de datos para reimpresión.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-orange-300 bg-white text-orange-800 hover:bg-orange-100"
                      onClick={() => handleImprimirPedidoLaboratorio(pedidoLaboratorioDetalle, pacienteSeleccionado)}
                    >
                      <Printer className="size-4 mr-2" />
                      Reimprimir
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-orange-900">Pedido</Label>
                      <div className="rounded-md border border-orange-200 bg-white p-2 text-sm">#{String(pedidoLaboratorioDetalle.numero_pedido_laboratorio).padStart(7, '0')}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-orange-900">Médico *</Label>
                      <div className="rounded-md border border-orange-200 bg-white p-2 text-sm">
                        {pedidoLaboratorioDetalle.medico_asignacion?.usuario
                          ? `${pedidoLaboratorioDetalle.medico_asignacion.usuario.nombre} ${pedidoLaboratorioDetalle.medico_asignacion.usuario.apellido}`
                          : `ID Usuario Sucursal ${pedidoLaboratorioDetalle.id_usuario_sucursal_medico}`}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-orange-900">Observaciones del pedido</Label>
                    <div className="rounded-md border border-orange-200 bg-white p-2 text-sm whitespace-pre-wrap">{pedidoLaboratorioDetalle.observaciones || ''}</div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-orange-900">Catálogo de exámenes</Label>
                    <div className="rounded-md border border-orange-200 bg-white p-2 text-sm">
                      <ul className="list-disc pl-4 space-y-1">
                        {pedidoLaboratorioDetalle.detalle.map((detalle) => (
                          <li key={detalle.id_pedido_laboratorio_detalle}>
                            {detalle.examen_laboratorio?.nombre || `Examen #${detalle.id_examen_laboratorio}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Próxima Consulta */}
              {consultaSeleccionada.fecha_seguimiento && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-blue-700">Próxima Consulta / Fecha de Seguimiento</Label>
                  <div className="bg-blue-50 p-3 rounded-md text-sm border border-blue-200">
                    {new Date(consultaSeleccionada.fecha_seguimiento + 'T00:00:00').toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              )}

              {/* Receta Médica */}
              {(consultaSeleccionada.receta_rp || consultaSeleccionada.receta_indicaciones || consultaSeleccionada.receta_medica) && (
                <div className="space-y-3 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label className="text-sm font-medium text-cyan-900">Receta Médica</Label>
                      <p className="text-xs text-cyan-700 mt-1">Complete Rp e Indicaciones para impresión en formato de receta.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-cyan-300 bg-white text-cyan-800 hover:bg-cyan-100"
                      onClick={() => handleImprimirReceta(consultaSeleccionada, pacienteSeleccionado)}
                    >
                      <Printer className="size-4 mr-2" />
                      Reimprimir Receta
                    </Button>
                  </div>

                  <div className="rounded-md border border-cyan-200 bg-white p-3 text-sm text-cyan-900">
                    <span className="font-medium">Alergias:</span> {alergiasDesdeAntecedentesTexto || 'SIN ALERGIAS REGISTRADAS'}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Rp</Label>
                    <div className="rounded-md border border-cyan-200 bg-white p-2 text-sm whitespace-pre-wrap">
                      {consultaSeleccionada.receta_rp || consultaSeleccionada.receta_medica || ''}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Indicaciones</Label>
                    <div className="rounded-md border border-cyan-200 bg-white p-2 text-sm whitespace-pre-wrap">
                      {consultaSeleccionada.receta_indicaciones || ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Pedido de Hospitalización */}
              {consultaSeleccionada.pedido_hospitalizacion && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-red-700">Pedido de Hospitalización</Label>
                  <div className="bg-red-50 p-3 rounded-md text-sm whitespace-pre-wrap border border-red-200">
                    {consultaSeleccionada.pedido_hospitalizacion}
                  </div>
                </div>
              )}

              {/* Interconsultas */}
              {interconsultasDetalle.length > 0 && (
                <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <Label className="text-sm font-medium text-purple-900">
                    Interconsultas ({interconsultasDetalle.length})
                  </Label>
                  <div className="space-y-3">
                    {interconsultasDetalle.map((ic) => (
                      <div key={ic.id_interconsulta} className="rounded-md border border-purple-200 bg-white p-3 text-sm space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ic.urgencia === 'urgente' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {ic.urgencia === 'urgente' ? 'URGENTE' : 'Normal'}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getInterconsultaEstadoClass(ic.estado)}`}>
                            {getInterconsultaEstadoLabel(ic.estado)}
                          </span>
                          <span className="text-xs text-gray-500 ml-auto">
                            {ic.tipo_destino === 'interno' ? 'Interconsulta interna' : 'Interconsulta externa'}
                          </span>
                        </div>
                        {ic.tipo_destino === 'externo' && (
                          <p><span className="font-medium text-purple-800">Destino:</span> {ic.especialidad_destino_texto || '—'}</p>
                        )}
                        {(ic.especialidad?.nombre || ic.especialidad_destino_texto) && (
                          <p><span className="font-medium text-purple-800">Especialidad:</span> {ic.especialidad?.nombre || ic.especialidad_destino_texto}</p>
                        )}
                        <p><span className="font-medium text-purple-800">Motivo:</span> {ic.motivo}</p>
                        {ic.resumen_clinico && (
                          <p><span className="font-medium text-purple-800">Resumen clínico:</span> {ic.resumen_clinico}</p>
                        )}
                        {ic.fecha_limite && (
                          <p><span className="font-medium text-purple-800">Fecha límite:</span> {new Date(ic.fecha_limite + 'T00:00:00').toLocaleDateString('es-ES')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observaciones */}
              {consultaSeleccionada.observaciones && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Observaciones</Label>
                  <div className="bg-gray-50 p-3 rounded-md text-sm whitespace-pre-wrap">
                    {consultaSeleccionada.observaciones}
                  </div>
                </div>
              )}

              {/* Fecha de la consulta */}
              <div className="pt-4 border-t text-xs text-gray-500">
                <p>Registro creado el {new Date(consultaSeleccionada.created_at || consultaSeleccionada.fecha_consulta).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de cancelación de cita (mismo flujo que Agenda) */}
      <CancelarCitaModalSupabase
        isOpen={isCancelarAgendaModalOpen}
        onClose={() => {
          setIsCancelarAgendaModalOpen(false);
          setCitaAgendaSeleccionada(null);
        }}
        cita={citaAgendaSeleccionada}
        onCitaCancelada={async () => {
          await cargarAgendaMedico();
          if (selectedPatientId) {
            const citas = await getCitasByPaciente(selectedPatientId);
            setCitasPaciente(citas);
          }
        }}
      />

      {/* Detalle de cita desde cards de agenda */}
      <DetalleCitaDialog
        isOpen={!!citaDetalleAgenda}
        onClose={() => setCitaDetalleAgenda(null)}
        cita={citaDetalleAgenda}
        onIniciarConsulta={handleIniciarCitaDesdeAgenda}
        onModificar={() => {
          toast.info('La modificación de citas se gestiona desde el módulo Agenda');
        }}
        onCancelar={handleCancelarCitaDesdeAgenda}
      />

      {/* Modal de edición de cita — solo secretaria y administrador */}
      {isEditCitaModalOpen && citaParaEditar && (
        <AgendarCitaModalSupabase
          isOpen={isEditCitaModalOpen}
          onClose={() => {
            setIsEditCitaModalOpen(false);
            setCitaParaEditar(null);
          }}
          onCitaAgendada={async () => {
            setIsEditCitaModalOpen(false);
            setCitaParaEditar(null);
            if (selectedPatientId) {
              const citas = await getCitasByPaciente(selectedPatientId);
              setCitasPaciente(citas);
            }
          }}
          idUsuarioActual={idUsuarioActual}
          citaEditar={citaParaEditar}
          tipoUsuario={currentUser?.tipo_usuario}
          currentUserName={currentUser?.name}
        />
      )}

      {/* Dialog: Confirmación No Asistió */}
      <Dialog open={isNoAsistioConfirmOpen} onOpenChange={setIsNoAsistioConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <span>⚠</span> Confirmar No Asistió
            </DialogTitle>
            <DialogDescription>
              ¿Está seguro de que el paciente no asistió a esta cita? Esta acción cambiará el estado a <strong>No Asistió</strong> y no podrá revertirse desde esta pantalla.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsNoAsistioConfirmOpen(false);
                setCitaParaNoAsistio(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmarNoAsistio}
            >
              Sí, No Asistió
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
