// Modal para agendar citas integrado con Supabase
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { usePacientes } from '../hooks/usePacientes';
import { useHorarios } from '../hooks/useCitas';
import { Plus, Search, Pencil, Edit, Loader2, FileText, Calendar, Clock, X, XCircle, Minimize2, Maximize2 } from 'lucide-react'; // Import icons
import { getAllPacientes } from '../lib/pacientesService';
import { getAsignacionesCompletasByUsuario, getSucursalesByCompania, getMedicosBySucursal, type AsignacionCompleta } from '../lib/authService';
import { createCita, updateCita, generarHorariosDisponibles, canModificarCita, type CitaCompleta } from '../lib/citasService';
import { updatePaciente } from '../lib/pacientesService'; // Import updatePaciente
import { consultarCedulaRegistroCivil } from '../lib/registroCivilService'; // Import automatic ID lookup
import { getAllEspecialidades, type Especialidad, getAllAseguradoras, type Aseguradora } from '../lib/configuracionesService'; // Import getAllEspecialidades and insurers


interface AgendarCitaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCitaAgendada: () => void;
  idUsuarioActual: number | null;
  citaEditar?: CitaCompleta | null;
  tipoUsuario?: string;
}

export function AgendarCitaModalSupabase({ isOpen, onClose, onCitaAgendada, idUsuarioActual, citaEditar, tipoUsuario }: AgendarCitaModalProps) {
  const [windowState, setWindowState] = useState<'normal' | 'minimized'>('normal');

  useEffect(() => {
    if (isOpen && windowState === 'minimized') {
      // Keep it minimized if it was already minimized
    } else if (!isOpen) {
      setWindowState('normal');
    }
  }, [isOpen]);

  const [step, setStep] = useState<'paciente' | 'detalles' | 'nuevoPaciente'>('paciente');
  const modoEdicion = !!citaEditar;
  const esSecretaria = tipoUsuario === 'secretaria';

  // Paso 1: Seleccin de paciente
  const [searchPaciente, setSearchPaciente] = useState('');
  const [selectedPacienteId, setSelectedPacienteId] = useState('');
  const [pacientes, setPacientes] = useState<any[]>([]);

  // Estado para nuevo paciente
  const [nuevoPaciente, setNuevoPaciente] = useState({
    nombres: '',
    apellidos: '',
    cedula: '',
    fecha_nacimiento: '',
    sexo: 'M',
    telefono: '',
    email: '',
    direccion: '',
    id_sucursal: null as number | null,
    nombre_sucursal: '' // Para mostrar el nombre
  });

  // Paso 2: Detalles de la cita
  const [selectedAsignacion, setSelectedAsignacion] = useState('');
  const [fecha, setFecha] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [duracion, setDuracion] = useState('30');
  const [tipoCita, setTipoCita] = useState<'consulta' | 'control' | 'emergencia' | 'primera_vez'>('consulta');
  const [motivoConsulta, setMotivoConsulta] = useState('');
  const [idAseguradora, setIdAseguradora] = useState('1'); // Default to 'Sin Aseguradora'
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);
  const [referencia, setReferencia] = useState('');

  const [asignaciones, setAsignaciones] = useState<AsignacionCompleta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingCedula, setIsSearchingCedula] = useState(false); // Estado para loading de cédula
  const [isModificacionPermitida, setIsModificacionPermitida] = useState(true);

  // Estados específicos para SECRETARIA
  const [sucursalSecretaria, setSucursalSecretaria] = useState('');
  const [sucursalesDisponibles, setSucursalesDisponibles] = useState<any[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [selectedEspecialidad, setSelectedEspecialidad] = useState('');
  const [medicosDisponibles, setMedicosDisponibles] = useState<AsignacionCompleta[]>([]);
  const [selectedMedico, setSelectedMedico] = useState<AsignacionCompleta | null>(null);

  // Estado para edición de paciente
  const [isEditingPatient, setIsEditingPatient] = useState(false);

  // Cargar pacientes
  useEffect(() => {
    if (isOpen) {
      loadPacientes();
    }
  }, [isOpen]);

  // Pre-llenar datos cuando se edita
  useEffect(() => {
    if (isOpen && citaEditar) {
      setIsModificacionPermitida(canModificarCita(citaEditar));

      // Si estamos en modo edición, ir directamente a detalles
      setStep('detalles');
      setSelectedPacienteId(citaEditar.id_paciente.toString());
      setSelectedAsignacion(citaEditar.id_usuario_sucursal.toString());
      setFecha(citaEditar.fecha_cita);
      setHoraInicio(citaEditar.hora_inicio.substring(0, 5));
      setDuracion('30');
      setTipoCita(citaEditar.tipo_cita);
      setMotivoConsulta(citaEditar.motivo_consulta);
      if (citaEditar.id_aseguradora) {
        setIdAseguradora(citaEditar.id_aseguradora.toString());
      }
      if (citaEditar.referencia) {
        setReferencia(citaEditar.referencia);
      }

      // Si es secretaria, establecer la sucursal y cargar médicos
      if (esSecretaria && citaEditar.usuario_sucursal?.sucursal?.id_sucursal) {
        const idSucursal = citaEditar.usuario_sucursal.sucursal.id_sucursal.toString();
        setSucursalSecretaria(idSucursal);

        // Cargar especialidades
        const cargarData = async () => {
          const especialidadesData = await getAllEspecialidades();
          setEspecialidades(especialidadesData);

          // Cargar médicos de esa sucursal
          const medicos = await getMedicosBySucursal(citaEditar.usuario_sucursal.sucursal.id_sucursal);
          // Filtrar por especialidad si hay una seleccionada (o la de la cita)
          // Nota: getMedicosBySucursal devuelve todas. Filtraremos en render o effect
          setMedicosDisponibles(medicos);
          setAsignaciones(medicos);
        };
        cargarData();
      }
    } else {
      setIsModificacionPermitida(true);
    }
  }, [isOpen, citaEditar, esSecretaria]);

  // Auto-llenar sucursal cuando se abre formulario nuevo paciente
  useEffect(() => {
    if (step === 'nuevoPaciente' && asignaciones.length > 0) {
      // Obtener la sucursal activa desde localStorage
      const sucursalId = localStorage.getItem('currentSucursalId');

      if (sucursalId) {
        const asignacionActiva = asignaciones.find(
          a => a.id_sucursal === parseInt(sucursalId)
        );

        if (asignacionActiva) {
          setNuevoPaciente(prev => ({
            ...prev,
            id_sucursal: asignacionActiva.id_sucursal,
            nombre_sucursal: `${asignacionActiva.compania.nombre} - ${asignacionActiva.sucursal.nombre} `
          }));
          console.log('✅ Auto-llenada sucursal para nuevo paciente:', asignacionActiva.sucursal.nombre);
        }
      }
    }
  }, [step, asignaciones]);

  const loadPacientes = async () => {
    // Obtener id_compania desde localStorage para filtrar
    const companiaId = localStorage.getItem('currentCompaniaId');
    if (companiaId) {
      const { getPacientesByCompania } = await import('../lib/pacientesService');
      const data = await getPacientesByCompania(parseInt(companiaId));
      setPacientes(data);
    } else {
      const data = await getAllPacientes();
      setPacientes(data);
    }
  };

  const loadAsignaciones = async () => {
    if (!idUsuarioActual) return;
    const data = await getAsignacionesCompletasByUsuario(idUsuarioActual);

    // Filtrar solo la asignación de la sucursal actual
    const sucursalId = localStorage.getItem('currentSucursalId');
    const asignacionActual = sucursalId
      ? data.filter(a => a.id_sucursal === parseInt(sucursalId))
      : data;

    setAsignaciones(asignacionActual);

    // Seleccionar automáticamente la asignación de la sucursal actual
    if (asignacionActual.length > 0 && !selectedAsignacion) {
      setSelectedAsignacion(asignacionActual[0].id_usuario_sucursal.toString());
      console.log('✅ Auto-seleccionada sucursal actual:', asignacionActual[0].sucursal.nombre);
    }
  };

  // FUNCIONES PARA SECRETARIA
  const loadSucursales = async () => {
    const companiaId = localStorage.getItem('currentCompaniaId');
    if (companiaId) {
      console.log('📍 Cargando sucursales para secretaria...');
      const data = await getSucursalesByCompania(parseInt(companiaId));
      setSucursalesDisponibles(data);
      console.log('✅ Sucursales cargadas:', data.length);

      const especialidadesData = await getAllEspecialidades();
      setEspecialidades(especialidadesData);



      // Auto-seleccionar la primera sucursal
      if (data.length > 0 && !modoEdicion) {
        const primeraSucursal = (data as any)[0].id_sucursal.toString();
        setSucursalSecretaria(primeraSucursal);
        console.log('✅ Auto-seleccionada primera sucursal:', (data as any)[0].nombre);

        // Cargar médicos de la primera sucursal
        const medicos = await getMedicosBySucursal((data as any)[0].id_sucursal);
        console.log('✅ Médicos cargados automáticamente:', medicos.length);
        setMedicosDisponibles(medicos);
        // setAsignaciones(medicos); // No asignamos aún para obligar a seleccionar especialidad o médico
      }
    }
  };

  const handleSucursalChange = async (sucursalId: string) => {
    console.log('🔄 Cambiando sucursal:', sucursalId);
    setSucursalSecretaria(sucursalId);
    setSelectedEspecialidad(''); // Reset especialidad
    setSelectedAsignacion(''); // Reset médico
    setSelectedMedico(null);
    setFecha(''); // Reset fecha
    setHoraInicio(''); // Reset hora
    setMedicosDisponibles([]); // Reset médicos

    // Cargar médicos de la sucursal seleccionada
    const medicos = await getMedicosBySucursal(parseInt(sucursalId));
    console.log('✅ Médicos cargados:', medicos.length);
    setMedicosDisponibles(medicos);
    // setAsignaciones(medicos);
  };



  const handleEspecialidadChange = (especialidadId: string) => {
    setSelectedEspecialidad(especialidadId);
    setSelectedAsignacion(''); // Reset médico al cambiar especialidad
    setSelectedMedico(null);

    // Si queremos filtrar automáticamente la lista de médicos, lo hacemos en el render
    // o aquí si preferimos tener un estado separado de medicosFiltrados.
    // Usaremos un filtro en el render sobre medicosDisponibles.
  };

  // Filtrar médicos según la especialidad seleccionada
  const medicosFiltrados = medicosDisponibles.filter(medico => {
    if (!selectedEspecialidad) return true; // Si no hay especialidad, mostrar todos (o ninguno, según requerimiento)
    // Asumiendo que medico.especialidad es el NOMBRE de la especialidad en usuario_sucursal
    // NECESITAMOS comparar con el ID o el Nombre.
    // El usuario_sucursal tiene especialidad (string) y id_especialidad (number - nuevo campo).
    // Si ya migramos id_especialidad, usamos ese.

    // Tratamos de comparar por ID primero, luego por nombre si falla.
    const especialidadSeleccionada = especialidades.find(e => e.id_especialidad.toString() === selectedEspecialidad);

    if ((medico as any).id_especialidad) {
      return (medico as any).id_especialidad.toString() === selectedEspecialidad;
    }

    // Fallback: comparar nombre si id no disponible (aunque debería estarlo tras migración)
    if (especialidadSeleccionada && medico.especialidad) {
      return medico.especialidad.toLowerCase().trim() === especialidadSeleccionada.nombre.toLowerCase().trim();
    }

    return false;
  });

  useEffect(() => {
    const loadInitialData = async () => {
      if (isOpen) {
        // Cargar aseguradoras
        const aseguradorasData = await getAllAseguradoras();
        setAseguradoras(aseguradorasData);

        if (esSecretaria && step === 'detalles') {
          loadSucursales();
        } else if (!esSecretaria) {
          if (idUsuarioActual) {
            loadAsignaciones();
          }
        }
      }
    };
    loadInitialData();
  }, [isOpen, esSecretaria, step, idUsuarioActual]);

  // Hook de horarios para la asignación seleccionada
  const idAsignacionNum = selectedAsignacion ? parseInt(selectedAsignacion) : null;
  console.log('🎯 AgendarCitaModal - selectedAsignacion:', selectedAsignacion);
  console.log('🎯 AgendarCitaModal - idAsignacionNum:', idAsignacionNum);
  const { diasSemana, precio, verificarDisponibilidadHorario, getCitasDelDia } = useHorarios(
    idAsignacionNum,
    selectedMedico?.cargo,
    selectedMedico?.sucursal.id_compania
  );
  const [citasDelDia, setCitasDelDia] = useState<any[]>([]);

  console.log('💰 AgendarCitaModal - Precio recibido del hook:', precio);
  console.log('📅 AgendarCitaModal - Días de semana recibidos:', diasSemana.length);

  // Filtrar pacientes
  const pacientesFiltrados = pacientes.filter(paciente => {
    const searchLower = searchPaciente.toLowerCase();
    return (
      paciente.nombres.toLowerCase().includes(searchLower) ||
      paciente.apellidos.toLowerCase().includes(searchLower) ||
      paciente.cedula.includes(searchLower)
    );
  });

  // Calcular hora fin
  const calcularHoraFin = (inicio: string, duracionMin: string) => {
    if (!inicio || !duracionMin) return '';

    const [horas, minutos] = inicio.split(':').map(Number);
    const totalMinutos = horas * 60 + minutos + parseInt(duracionMin);

    const horasFin = Math.floor(totalMinutos / 60);
    const minutosFin = totalMinutos % 60;

    return `${horasFin.toString().padStart(2, '0')}:${minutosFin.toString().padStart(2, '0')} `;
  };

  // Cargar citas del día cuando cambia la fecha o la asignación
  useEffect(() => {
    const cargarCitasDia = async () => {
      if (fecha && selectedAsignacion && getCitasDelDia) {
        console.log('📅 Cargando citas para el día:', fecha);
        const citas = await getCitasDelDia(fecha);
        setCitasDelDia(citas);
        console.log('✅ Citas encontradas para el día:', citas.length);
      } else {
        setCitasDelDia([]);
      }
    };

    cargarCitasDia();
  }, [fecha, selectedAsignacion]);

  // Validar disponibilidad del día
  const isDiaDisponible = (fechaSeleccionada: string) => {
    if (!fechaSeleccionada || diasSemana.length === 0) return false;

    // Asegurar que la fecha se interpreta en hora local correctamente
    // Agregar T00:00:00 para evitar problemas de zona horaria al convertir a Date
    const fecha = new Date(fechaSeleccionada + 'T00:00:00');
    const diaSemanaNumero = fecha.getDay(); // 0=domingo, 1=lunes, 2=martes...

    console.log('🔍 Verificando disponibilidad:', {
      fechaSeleccionada,
      diaSemanaNumero,
      diasDisponibles: diasSemana.map(d => d.dia_semana),
      diasSemanaCompleto: diasSemana
    });

    // Comparar números con números; para suplentes también validar rango de fecha
    return diasSemana.some(d =>
      d.dia_semana === diaSemanaNumero &&
      (!d.fecha_inicio || fechaSeleccionada >= d.fecha_inicio) &&
      (!d.fecha_fin || fechaSeleccionada <= d.fecha_fin)
    );
  };

  // Obtener horarios disponibles para el día seleccionado
  const getHorariosDisponibles = () => {
    if (!fecha || diasSemana.length === 0) return [];

    const fechaDate = new Date(fecha + 'T00:00:00');
    const diaSemanaNumero = fechaDate.getDay(); // 0=domingo, 1=lunes, 2=martes...

    const diaConfig = diasSemana.find(d =>
      d.dia_semana === diaSemanaNumero &&
      (!d.fecha_inicio || fecha >= d.fecha_inicio) &&
      (!d.fecha_fin || fecha <= d.fecha_fin)
    );
    if (!diaConfig) return [];

    // Usar la duración configurada en lugar de 15 minutos fijos
    const duracionConsulta = diaConfig.duracion_consulta || 30;
    console.log('⏱️ Duración de consulta configurada:', duracionConsulta, 'minutos');

    // Generar horarios base
    const horariosBase = generarHorariosDisponibles(diaConfig.hora_inicio, diaConfig.hora_fin, duracionConsulta);

    // Si estamos editando, permitir la hora actual de la cita
    // Si NO estamos editando, filtrar las horas ocupadas
    return horariosBase.filter(horaInicio => {
      // Si es la misma hora de la cita que se está editando, permitirla
      if (modoEdicion && citaEditar && citaEditar.fecha_cita === fecha && citaEditar.hora_inicio.substring(0, 5) === horaInicio) {
        return true;
      }

      const horaFin = calcularHoraFin(horaInicio, duracionConsulta.toString());

      // Verificar si hay conflicto con alguna cita existente
      const conflicto = citasDelDia.some(cita => {
        // Ignorar la cita que se está editando
        if (modoEdicion && citaEditar && cita.id_cita === citaEditar.id_cita) {
          return false;
        }

        const citaInicio = cita.hora_inicio.substring(0, 5);
        const citaFin = cita.hora_fin.substring(0, 5);

        // Lógica de traslape
        return (
          (horaInicio >= citaInicio && horaInicio < citaFin) ||
          (horaFin > citaInicio && horaFin <= citaFin) ||
          (horaInicio <= citaInicio && horaFin >= citaFin)
        );
      });

      return !conflicto;
    });
  };

  const horariosDisponibles = getHorariosDisponibles();

  // Función para generar el rango de horario (ej: "8:00 - 8:30")
  const generarRangoHorario = (horaInicio: string, duracionMinutos: number): string => {
    const horaFin = calcularHoraFin(horaInicio, duracionMinutos.toString());
    return `${horaInicio} - ${horaFin} `;
  };

  // Obtener la duración configurada para el día seleccionado
  const getDuracionConfigurada = (): number => {
    if (!fecha || diasSemana.length === 0) return 30;

    const fechaDate = new Date(fecha + 'T00:00:00');
    const diaSemanaNumero = fechaDate.getDay();

    const diaConfig = diasSemana.find(d =>
      d.dia_semana === diaSemanaNumero &&
      (!d.fecha_inicio || fecha >= d.fecha_inicio) &&
      (!d.fecha_fin || fecha <= d.fecha_fin)
    );
    return diaConfig?.duracion_consulta || 30;
  };

  // Consultar datos de registro civil al perder foco en cédula
  const handleBlurCedula = async () => {
    const cedula = nuevoPaciente.cedula;
    if (!cedula || cedula.length < 10) return;

    setIsSearchingCedula(true);
    try {
      const datos = await consultarCedulaRegistroCivil(cedula);
      if (datos) {
        setNuevoPaciente(prev => ({
          ...prev,
          nombres: datos.nombres || prev.nombres,
          apellidos: datos.apellidos || prev.apellidos,
          fecha_nacimiento: datos.fecha_nacimiento || prev.fecha_nacimiento,
          sexo: datos.sexo,
          direccion: datos.direccion || prev.direccion
        }));
        toast.success('Datos encontrados y cargados');
      }
    } catch (error) {
      console.error('Error al consultar cédula:', error);
    } finally {
      setIsSearchingCedula(false);
    }
  };

  // Preparar edición de paciente
  const handleEditPaciente = () => {
    const pacienteData = citaEditar?.paciente || pacientes.find(p => p.id_paciente.toString() === selectedPacienteId);

    if (pacienteData) {
      setNuevoPaciente({
        nombres: pacienteData.nombres,
        apellidos: pacienteData.apellidos,
        cedula: pacienteData.cedula,
        fecha_nacimiento: pacienteData.fecha_nacimiento || '',
        sexo: pacienteData.sexo,
        telefono: pacienteData.telefono || '',
        email: pacienteData.email || '',
        direccion: pacienteData.direccion || '',
        id_sucursal: null,
        nombre_sucursal: ''
      });
      setIsEditingPatient(true);
      setStep('nuevoPaciente');
    }
  };

  // Crear o Actualizar paciente
  const handleCrearPaciente = async () => {
    // Validar todos los campos obligatorios
    const { nombres, apellidos, cedula, fecha_nacimiento, email, telefono, direccion, sexo } = nuevoPaciente;
    if (!nombres || !apellidos || !cedula || !fecha_nacimiento || !sexo || !email || !telefono || !direccion) {
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

    setIsLoading(true);

    try {
      // Obtener id_compania desde localStorage
      const companiaId = localStorage.getItem('currentCompaniaId');
      if (!companiaId) {
        toast.error('Error: No se pudo obtener la compañía actual');
        setIsLoading(false);
        return;
      }

      // Importar la función directamente
      const { createPaciente } = await import('../lib/pacientesService');

      let resultado = null;

      if (isEditingPatient && selectedPacienteId) {
        // ACTUALIZAR PACIENTE
        const success = await updatePaciente(parseInt(selectedPacienteId), {
          nombres: nuevoPaciente.nombres,
          apellidos: nuevoPaciente.apellidos,
          cedula: nuevoPaciente.cedula,
          fecha_nacimiento: nuevoPaciente.fecha_nacimiento,
          sexo: nuevoPaciente.sexo as 'M' | 'F' | 'Otro',
          telefono: nuevoPaciente.telefono || null,
          email: nuevoPaciente.email || null,
          direccion: nuevoPaciente.direccion || null,
        });

        if (success) {
          toast.success('Paciente actualizado exitosamente');
          // Retornar a detalles
          await loadPacientes(); // Recargar lista
          setStep('detalles');
          setIsEditingPatient(false);
          return; // Salir, no necesitamos hacer lo de abajo
        } else {
          toast.error('Error al actualizar el paciente');
        }
      } else {
        // CREAR PACIENTE
        const pacienteCreado = await createPaciente({
          id_compania: parseInt(companiaId),
          nombres: nuevoPaciente.nombres,
          apellidos: nuevoPaciente.apellidos,
          cedula: nuevoPaciente.cedula,
          fecha_nacimiento: nuevoPaciente.fecha_nacimiento || new Date().toISOString().split('T')[0],
          sexo: nuevoPaciente.sexo as 'M' | 'F' | 'Otro',
          telefono: nuevoPaciente.telefono || null,
          email: nuevoPaciente.email || null,
          direccion: nuevoPaciente.direccion || null,
          fecha_registro: new Date().toISOString().split('T')[0]
        });

        if (pacienteCreado) {
          resultado = pacienteCreado;
          toast.success('Paciente creado exitosamente');

          // Recargar lista de pacientes
          await loadPacientes();

          // Seleccionar automáticamente el nuevo paciente
          setSelectedPacienteId(pacienteCreado.id_paciente.toString());

          // Limpiar formulario y volver
          setNuevoPaciente({
            nombres: '',
            apellidos: '',
            cedula: '',
            fecha_nacimiento: '',
            sexo: 'M',
            telefono: '',
            email: '',
            direccion: '',
            id_sucursal: null,
            nombre_sucursal: ''
          });

          // Si se creó, usualmente volvemos a selección o vamos a detalles?
          // El flujo original iba a 'paciente' (selección), podemos mantenerlo o ir a detalles
          setStep('paciente');
        } else {
          toast.error('Error al crear el paciente');
        }
      }
    } catch (error) {
      console.error('Error al guardar paciente:', error);
      toast.error('Error al guardar el paciente');
    }

    setIsLoading(false);
  };

  // Manejar siguiente paso
  const handleNextStep = () => {
    if (!selectedPacienteId) {
      toast.error('Por favor seleccione un paciente');
      return;
    }
    setStep('detalles');
  };

  // Manejar envío del formulario
  const handleSubmit = async () => {
    const camposFaltantes: string[] = [];

    if (!selectedPacienteId) camposFaltantes.push('Paciente');
    if (!selectedAsignacion) camposFaltantes.push(esSecretaria ? 'Médico' : 'Sucursal');
    if (!fecha) camposFaltantes.push('Fecha');
    if (!horaInicio) camposFaltantes.push('Hora de inicio');
    if (!motivoConsulta.trim()) camposFaltantes.push('Motivo de consulta');
    if (!idAseguradora) camposFaltantes.push('Aseguradora');
    if (!referencia) camposFaltantes.push('Referencia');

    if (camposFaltantes.length > 0) {
      toast.error(`Por favor complete los campos obligatorios: ${camposFaltantes.join(', ')}`);
      return;
    }

    const horaFin = calcularHoraFin(horaInicio, duracion);

    // Verificar si la modificación está permitida
    if (modoEdicion && !isModificacionPermitida) {
      toast.error('No se puede modificar esta cita. Solo puede cancelar o ver detalles.');
      return;
    }

    // Verificar disponibilidad (solo si no estamos editando o si cambió el horario)
    if (!modoEdicion ||
      (citaEditar && (citaEditar.fecha_cita !== fecha || citaEditar.hora_inicio !== horaInicio))) {
      const disponible = await verificarDisponibilidadHorario(fecha, horaInicio, horaFin);

      if (!disponible) {
        toast.error('El horario seleccionado no está disponible');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (modoEdicion && citaEditar) {
        // MODO EDICIÓN
        console.log('✏️ Actualizando cita ID:', citaEditar.id_cita);

        const updates = {
          fecha_cita: fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          duracion_minutos: parseInt(duracion),
          tipo_cita: tipoCita,
          motivo_consulta: motivoConsulta,
          id_aseguradora: parseInt(idAseguradora),
          referencia: referencia,
          id_usuario_sucursal: parseInt(selectedAsignacion)
        };

        const resultado = await updateCita(citaEditar.id_cita, updates);

        if (resultado) {
          toast.success('Cita modificada exitosamente');
          onCitaAgendada();
          handleClose();
        } else {
          toast.error('Error al modificar la cita');
        }
      } else {
        // MODO CREACIÓN
        // Obtener id_sucursal de la asignación seleccionada
        const asignacionesFuente = esSecretaria ? medicosDisponibles : asignaciones;
        const asignacionSeleccionada = asignacionesFuente.find(
          a => a.id_usuario_sucursal === parseInt(selectedAsignacion)
        );

        if (!asignacionSeleccionada) {
          toast.error('Error: No se encontró la asignación seleccionada. Seleccione nuevamente el médico/sucursal.');
          setIsLoading(false);
          return;
        }

        // Obtener id_consultorio desde los días de semana configurados
        const fechaDate = new Date(fecha + 'T00:00:00');
        const diaSemana = fechaDate.getDay();

        console.log('🔍 Buscando consultorio:', {
          fechaSeleccionada: fecha,
          diaSemanaCalculado: diaSemana,
          diasSemanaDisponibles: diasSemana,
          totalDias: diasSemana.length
        });

        const diaConfig = diasSemana.find(d => d.dia_semana === diaSemana);

        console.log('📍 Configuración encontrada:', diaConfig);

        if (!diaConfig) {
          toast.error('No se encontró configuración del consultorio para este día');
          setIsLoading(false);
          return;
        }

        if (!diaConfig.id_consultorio) {
          console.error('❌ ERROR: diaConfig.id_consultorio es NULL o undefined');
          toast.error('Error: No hay consultorio asignado para este día');
          setIsLoading(false);
          return;
        }

        console.log('📋 Datos de la cita a crear:', {
          id_paciente: parseInt(selectedPacienteId),
          id_usuario_sucursal: parseInt(selectedAsignacion),
          id_especialidad: parseInt(selectedEspecialidad) || 2,
          id_sucursal: asignacionSeleccionada.id_sucursal,
          id_consultorio: diaConfig.id_consultorio,
          fecha_cita: fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          duracion_minutos: parseInt(duracion),
          tipo_cita: tipoCita,
          motivo_consulta: motivoConsulta,
          estado_cita: 'agendada',
          precio_cita: precio
        });

        const nuevaCita = await createCita({
          id_paciente: parseInt(selectedPacienteId),
          id_usuario_sucursal: parseInt(selectedAsignacion),
          id_especialidad: parseInt(selectedEspecialidad) || 2, // Default ID 2
          id_sucursal: asignacionSeleccionada.id_sucursal,
          id_consultorio: diaConfig.id_consultorio,
          fecha_cita: fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          duracion_minutos: parseInt(duracion),
          tipo_cita: tipoCita,
          motivo_consulta: motivoConsulta,
          estado_cita: 'agendada',
          precio_cita: precio,
          id_aseguradora: parseInt(idAseguradora),
          referencia: referencia
        });

        if (nuevaCita) {
          toast.success('Cita agendada exitosamente');
          onCitaAgendada();
          handleClose();
        } else {
          toast.error('Error al agendar la cita');
        }
      }
    } catch (error) {
      console.error('Error al procesar cita:', error);
      toast.error(modoEdicion ? 'Error al modificar la cita' : 'Error al agendar la cita');
    }

    setIsLoading(false);
  };

  // Cerrar modal y resetear
  // Cerrar modal y resetear
  const handleClose = () => {
    setWindowState('normal');
    setStep('paciente');
    setSearchPaciente('');
    setSelectedPacienteId('');
    setSelectedAsignacion('');
    setSelectedMedico(null);
    setFecha('');
    setHoraInicio('');
    setDuracion('30');
    setTipoCita('consulta');
    setMotivoConsulta('');
    setReferencia('');
    setNuevoPaciente({
      nombres: '',
      apellidos: '',
      cedula: '',
      fecha_nacimiento: '',
      sexo: 'M',
      telefono: '',
      email: '',
      direccion: '',
      id_sucursal: null,
      nombre_sucursal: ''
    });
    setIsModificacionPermitida(true);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && windowState !== 'minimized'} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="relative">
            <div className="absolute left-0 top-0 -translate-y-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-gray-100"
                onClick={() => setWindowState('minimized')}
                title="Minimizar"
              >
                <Minimize2 className="h-4 w-4 text-gray-500" />
              </Button>
            </div>
            <DialogTitle className="pl-10">
              {step === 'paciente' && 'Seleccionar Paciente'}
              {step === 'nuevoPaciente' && (isEditingPatient ? 'Editar Datos del Paciente' : 'Registrar Nuevo Paciente')}
              {step === 'detalles' && (modoEdicion ? 'Modificar Cita' : 'Detalles de la Cita')}
            </DialogTitle>
            <DialogDescription className="pl-10">
              {step === 'paciente' && 'Busque y seleccione el paciente para la cita'}
              {step === 'nuevoPaciente' && 'Complete los datos del nuevo paciente'}
              {step === 'detalles' && (modoEdicion ? 'Modifique los datos de la cita médica' : 'Complete la información de la cita médica')}
            </DialogDescription>
          </DialogHeader>

          {step === 'paciente' ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
                  <Input
                    placeholder="Buscar por nombre, apellido o cédula..."
                    value={searchPaciente}
                    onChange={(e) => setSearchPaciente(e.target.value.toUpperCase())}
                    className="pl-10 uppercase"
                  />
                </div>
                <Button
                  onClick={() => {
                    setIsEditingPatient(false);
                    setStep('nuevoPaciente');
                  }}
                  className="bg-gray-900 hover:bg-gray-800 whitespace-nowrap"
                >
                  <Plus className="size-4 mr-2" />
                  Nuevo Paciente
                </Button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {pacientesFiltrados.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    {searchPaciente ? 'No se encontraron pacientes' : 'No hay pacientes registrados'}
                  </div>
                )}

                {pacientesFiltrados.map((paciente) => (
                  <div
                    key={paciente.id_paciente}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedPacienteId === paciente.id_paciente.toString()
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                      }`}
                    onClick={() => setSelectedPacienteId(paciente.id_paciente.toString())}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">
                          {paciente.nombres} {paciente.apellidos}
                        </p>
                        <p className="text-sm text-gray-500">
                          {paciente.cedula} • {paciente.telefono || 'Sin teléfono'}
                        </p>
                      </div>
                      {selectedPacienteId === paciente.id_paciente.toString() && (
                        <div className="text-blue-600">✓</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : step === 'nuevoPaciente' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Sucursal *</Label>
                  <Input
                    value={nuevoPaciente.nombre_sucursal}
                    disabled
                    className="bg-gray-50 text-gray-600"
                    placeholder="Cargando sucursal..."
                  />
                  <p className="text-xs text-gray-500">Se asignará automáticamente a su sucursal actual</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Cédula/Pasaporte *</Label>
                    {isSearchingCedula && <span className="text-xs text-blue-600 flex items-center"><Loader2 className="size-3 animate-spin mr-1" /> Buscando...</span>}
                  </div>
                  <Input
                    value={nuevoPaciente.cedula}
                    onChange={(e) => setNuevoPaciente({ ...nuevoPaciente, cedula: e.target.value })}
                    onBlur={handleBlurCedula}
                    placeholder="0000000000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nombres *</Label>
                  <Input
                    value={nuevoPaciente.nombres}
                    onChange={(e) => setNuevoPaciente({ ...nuevoPaciente, nombres: e.target.value.toUpperCase() })}
                    placeholder="Nombres"
                    className="uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Apellidos *</Label>
                  <Input
                    value={nuevoPaciente.apellidos}
                    onChange={(e) => setNuevoPaciente({ ...nuevoPaciente, apellidos: e.target.value.toUpperCase() })}
                    placeholder="Apellidos"
                    className="uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Fecha de Nacimiento *</Label>
                  <Input
                    type="date"
                    value={nuevoPaciente.fecha_nacimiento}
                    onChange={(e) => setNuevoPaciente({ ...nuevoPaciente, fecha_nacimiento: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sexo *</Label>
                  <Select
                    value={nuevoPaciente.sexo}
                    onValueChange={(value: string) => setNuevoPaciente({ ...nuevoPaciente, sexo: value })}
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
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={nuevoPaciente.email}
                    onChange={(e) => setNuevoPaciente({ ...nuevoPaciente, email: e.target.value.toUpperCase() })}
                    placeholder="EJEMPLO@CORREO.COM"
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono * (Ej: +593984035410)</Label>
                  <Input
                    value={nuevoPaciente.telefono}
                    onChange={(e) => setNuevoPaciente({ ...nuevoPaciente, telefono: e.target.value })}
                    placeholder="+593984035410"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Dirección *</Label>
                  <Input
                    value={nuevoPaciente.direccion}
                    onChange={(e) => setNuevoPaciente({ ...nuevoPaciente, direccion: e.target.value.toUpperCase() })}
                    placeholder="DIRECCIÓN COMPLETA"
                    className="uppercase"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {modoEdicion && !isModificacionPermitida && (
                <div className="bg-yellow-100 text-yellow-800 border border-yellow-300 p-3 rounded text-sm">
                  No es posible modificar esta cita porque está pasada o está a menos de 1 hora. Solo puede cancelar.
                </div>
              )}
              <div className="bg-blue-50/50 p-3 rounded-md border border-blue-100 flex justify-between items-center">
                <div>
                  <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Paciente</p>
                  <p className="font-medium text-gray-900">
                    {(() => {
                      const pacienteActual = pacientes.find(p => p.id_paciente.toString() === selectedPacienteId);
                      if (pacienteActual) {
                        return `${pacienteActual.nombres} ${pacienteActual.apellidos}`;
                      }
                      return citaEditar?.paciente
                        ? `${citaEditar.paciente.nombres} ${citaEditar.paciente.apellidos}`
                        : '';
                    })()}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleEditPaciente} className="h-8 w-8 p-0">
                  <Pencil className="size-4 text-gray-500 hover:text-blue-600" />
                </Button>
              </div>

              {esSecretaria ? (
                <>
                  <div className="space-y-2">
                    <Label>Sucursal *</Label>
                    <Select value={sucursalSecretaria} onValueChange={handleSucursalChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione sucursal" />
                      </SelectTrigger>
                      <SelectContent>
                        {sucursalesDisponibles.map((suc) => (
                          <SelectItem key={suc.id_sucursal} value={suc.id_sucursal.toString()}>
                            {suc.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {sucursalSecretaria && (
                    <div className="space-y-2">
                      <Label>Especialidad *</Label>
                      <Select value={selectedEspecialidad} onValueChange={handleEspecialidadChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione especialidad" />
                        </SelectTrigger>
                        <SelectContent>
                          {especialidades.map((esp) => (
                            <SelectItem key={esp.id_especialidad} value={esp.id_especialidad.toString()}>
                              {esp.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {sucursalSecretaria && (
                    <div className="space-y-2">
                      <Label>Médico *</Label>
                      <Select value={selectedAsignacion} onValueChange={(val: string) => {
                          setSelectedAsignacion(val);
                          const medico = medicosFiltrados.find((m: AsignacionCompleta) => m.id_usuario_sucursal.toString() === val) || null;
                          setSelectedMedico(medico);
                        }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione médico" />
                        </SelectTrigger>
                        <SelectContent>
                          {medicosFiltrados.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">
                              {selectedEspecialidad ? 'No hay médicos de esta especialidad' : 'Seleccione una especialidad primero'}
                            </div>
                          ) : (
                            medicosFiltrados.map((medico: any) => (
                              <SelectItem key={medico.id_usuario_sucursal} value={medico.id_usuario_sucursal.toString()}>
                                Dr. {medico.usuario.nombre} {medico.usuario.apellido}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Sucursal *</Label>
                  <Input
                    value={asignaciones.length > 0 ? `${asignaciones[0].compania.nombre} - ${asignaciones[0].sucursal.nombre}` : 'Cargando...'}
                    disabled
                    className="bg-gray-50 text-gray-600"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => {
                    setFecha(e.target.value);
                    setHoraInicio('');
                  }}
                  min={new Date().toISOString().split('T')[0]}
                />
                {fecha && !isDiaDisponible(fecha) && (
                  <p className="text-xs text-red-500">
                    el Doctor(a) seleccionado no tiene configurado horarios de cita para el día seleccionado
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hora de Inicio *</Label>
                  <Select value={horaInicio} onValueChange={setHoraInicio} disabled={!fecha || !isDiaDisponible(fecha)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {horariosDisponibles.map((hora) => (
                        <SelectItem key={hora} value={hora}>
                          {generarRangoHorario(hora, getDuracionConfigurada())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Duración (minutos) *</Label>
                  <Select value="30" onValueChange={setDuracion} disabled>
                    <SelectTrigger className="bg-gray-50">
                      <SelectValue placeholder="30 minutos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {horaInicio && (
                <div className="text-sm text-gray-600">
                  Hora de finalización: <span className="font-semibold">{calcularHoraFin(horaInicio, duracion)}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Cita *</Label>
                  <Select value={tipoCita} onValueChange={(value: any) => setTipoCita(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consulta">Consulta</SelectItem>
                      <SelectItem value="control">Control</SelectItem>
                      <SelectItem value="primera_vez">Primera Vez</SelectItem>
                      <SelectItem value="emergencia">Emergencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Aseguradora *</Label>
                  <Select value={idAseguradora} onValueChange={setIdAseguradora}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar aseguradora" />
                    </SelectTrigger>
                    <SelectContent>
                      {aseguradoras.map((aseg) => (
                        <SelectItem key={aseg.id_aseguradora} value={aseg.id_aseguradora.toString()}>
                          {aseg.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivo de Consulta *</Label>
                <Textarea
                  value={motivoConsulta}
                  onChange={(e) => setMotivoConsulta(e.target.value.toUpperCase())}
                  placeholder="DESCRIBA BREVEMENTE EL MOTIVO DE LA CONSULTA"
                  rows={3}
                  className="uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label>Referencia *</Label>
                <Select value={referencia} onValueChange={setReferencia}>
                  <SelectTrigger>
                    <SelectValue placeholder="¿Cómo nos conoció?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Redes Sociales">Redes Sociales</SelectItem>
                    <SelectItem value="Mi médico">Mi médico</SelectItem>
                    <SelectItem value="Familia/Amigos">Familia/Amigos</SelectItem>
                    <SelectItem value="Conocía la clínica">Conocía la clínica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedAsignacion && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm">
                    <span className="text-gray-600">Precio de consulta:</span>{' '}
                    <span className="font-semibold text-blue-700">${precio.toFixed(2)}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {(step === 'detalles' || step === 'nuevoPaciente') && !modoEdicion && (
              <Button variant="outline" onClick={() => setStep('paciente')}>
                Atrás
              </Button>
            )}
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            {step === 'paciente' && (
              <Button onClick={handleNextStep} className="bg-blue-600 hover:bg-blue-700">
                Siguiente
              </Button>
            )}
            {step === 'nuevoPaciente' && (
              <Button onClick={handleCrearPaciente} className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                {isLoading ? 'Guardando...' : (isEditingPatient ? 'Actualizar Paciente' : 'Guardar Paciente')}
              </Button>
            )}
            {step === 'detalles' && (
              <Button
                onClick={handleSubmit}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isLoading || (modoEdicion && !isModificacionPermitida)}
              >
                {isLoading
                  ? (modoEdicion ? 'Modificando...' : 'Agendando...')
                  : (modoEdicion
                    ? (isModificacionPermitida ? 'Modificar Cita' : 'No modificable')
                    : 'Agendar Cita')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isOpen && windowState === 'minimized' && (
        <div
          className="fixed bottom-4 left-4 z-[100] w-72 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-300"
        >
          <div className="bg-gray-900 px-3 py-2 flex items-center justify-between text-white">
            <div className="flex items-center gap-2 overflow-hidden">
              <Calendar className="size-4 shrink-0 text-blue-400" />
              <span className="text-xs font-medium truncate">
                {step === 'paciente' && 'Agendar: Buscando paciente'}
                {step === 'nuevoPaciente' && 'Agendar: Nuevo paciente'}
                {step === 'detalles' && (selectedPacienteId
                  ? `Agendar: ${pacientes.find(p => p.id_paciente.toString() === selectedPacienteId)?.nombres || 'Paciente'}`
                  : 'Agendar: Detalles')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-white/20 text-white p-0 border-none"
                onClick={() => setWindowState('normal')}
                title="Restaurar"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-white/20 text-white p-0 border-none"
                onClick={handleClose}
                title="Cerrar"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}