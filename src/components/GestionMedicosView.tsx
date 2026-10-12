import { useState } from 'react';
import { CalendarPlus, CheckCircle2, Clock, Loader2, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  createAsignacionConsultorio,
  createUsuario,
  createUsuarioSucursal,
  formatearTipoUsuario,
  getUsuarioByCedula,
  type AsignacionConsultorio,
  type Usuario
} from '../lib/configuracionesService';
import { useAsignacionesConsultorio, useConsultorios, useEspecialidades, useUsuarioSucursales } from '../hooks/useConfiguraciones';

const DIAS_SEMANA = [
  { valor: 1, nombre: 'Lunes', abrev: 'Lun' },
  { valor: 2, nombre: 'Martes', abrev: 'Mar' },
  { valor: 3, nombre: 'Miércoles', abrev: 'Mié' },
  { valor: 4, nombre: 'Jueves', abrev: 'Jue' },
  { valor: 5, nombre: 'Viernes', abrev: 'Vie' },
  { valor: 6, nombre: 'Sábado', abrev: 'Sáb' },
  { valor: 0, nombre: 'Domingo', abrev: 'Dom' },
];

// Orden de visualización: lunes a domingo (domingo = 0 va al final)
const ordenDia = (dia: number) => (dia === 0 ? 7 : dia);
const horaCorta = (hora: string) => (hora || '').slice(0, 5);
const nombreDia = (dia: number) => DIAS_SEMANA.find(item => item.valor === dia)?.nombre || `Día ${dia}`;

interface GestionMedicosViewProps {
  currentUser: {
    id_sucursal?: number;
  } | null;
  onTerminar: () => void;
  /** Modo embebido (desde el modal de agendar cita): al terminar devuelve la asignación del médico */
  onMedicoListo?: (resultado: { idUsuarioSucursal: number; idEspecialidad: number | null }) => void;
  especialidadInicial?: number | null;
}

export function GestionMedicosView({ currentUser, onTerminar, onMedicoListo, especialidadInicial }: GestionMedicosViewProps) {
  const embebido = !!onMedicoListo;
  const [step, setStep] = useState<'buscar' | 'asignar' | 'horario' | 'listo'>('buscar');
  const [idEspecialidadAsignacion, setIdEspecialidadAsignacion] = useState<number | null>(null);
  const [cedulaBusqueda, setCedulaBusqueda] = useState('');
  const [usuarioEncontrado, setUsuarioEncontrado] = useState<Usuario | null>(null);
  const [idUsuario, setIdUsuario] = useState<number | null>(null);
  const [idUsuarioSucursal, setIdUsuarioSucursal] = useState<number | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorCreacion, setErrorCreacion] = useState<string | null>(null);
  const [formUsuario, setFormUsuario] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    password: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    estado: 'activo' as 'activo' | 'inactivo'
  });
  const [formAsignacion, setFormAsignacion] = useState({
    id_especialidad: especialidadInicial ? especialidadInicial.toString() : '',
    cargo: 'MEDICO ESPECIALISTA'
  });
  const [formHorario, setFormHorario] = useState({
    hora_inicio: '08:00',
    hora_fin: '17:00',
    duracion_consulta: 30
  });
  const [diasSeleccionados, setDiasSeleccionados] = useState<number[]>([1]);

  const { especialidades, isLoading: cargandoEspecialidades } = useEspecialidades();
  const { consultorios, isLoading: cargandoConsultorios } = useConsultorios(currentUser?.id_sucursal);
  const {
    asignaciones: asignacionesUsuarioSucursal,
    isLoading: cargandoAsignacionesUsuarioSucursal
  } = useUsuarioSucursales(idUsuario ?? undefined);
  // Asignación del médico en la sucursal del Gestor (la BD permite una sola por médico y sucursal)
  const asignacionEnSucursal = idUsuario && currentUser?.id_sucursal
    ? asignacionesUsuarioSucursal.find(asignacion =>
        asignacion.id_usuario === idUsuario && asignacion.id_sucursal === currentUser.id_sucursal)
    : undefined;
  const idUsuarioSucursalVista = idUsuarioSucursal
    ?? (asignacionEnSucursal?.estado === 'activo' ? asignacionEnSucursal.id_usuario_sucursal : null);
  const {
    asignaciones: asignacionesConsultorio,
    isLoading: cargandoAsignacionesConsultorio,
    loadAsignaciones: recargarHorarios
  } = useAsignacionesConsultorio(idUsuarioSucursalVista ?? undefined);
  // Por ahora no se gestionan consultorios en este perfil: se asigna uno automáticamente
  // (la BD lo exige y la cita lo toma del horario; la disponibilidad se calcula por médico).
  const idConsultorioAutomatico = (() => {
    const usadoPorMedico = asignacionesConsultorio.find(horario =>
      horario.id_usuario_sucursal === idUsuarioSucursalVista && horario.estado === 'activo')?.id_consultorio;
    if (usadoPorMedico) return usadoPorMedico;
    const activos = consultorios.filter(consultorio => consultorio.estado === 'activo');
    return (activos[0] || consultorios[0])?.id_consultorio ?? null;
  })();
  const horariosMedico = idUsuarioSucursalVista
    ? [...asignacionesConsultorio]
        .filter(horario => horario.id_usuario_sucursal === idUsuarioSucursalVista)
        .sort((a, b) => ordenDia(a.dia_semana) - ordenDia(b.dia_semana) || a.hora_inicio.localeCompare(b.hora_inicio))
    : [];

  const toggleDia = (dia: number) => {
    setDiasSeleccionados(prev =>
      prev.includes(dia) ? prev.filter(valor => valor !== dia) : [...prev, dia]
    );
  };

  const handleBuscar = async () => {
    if (!cedulaBusqueda.trim()) {
      toast.error('Ingrese la cédula del médico');
      return;
    }

    setBuscando(true);
    setBusquedaRealizada(false);
    setErrorCreacion(null);
    try {
      const usuario = await getUsuarioByCedula(cedulaBusqueda.trim());
      setUsuarioEncontrado(usuario);
      setIdUsuarioSucursal(null);
      setIdUsuario(usuario?.tipo_usuario === 'medico' ? usuario.id_usuario : null);
      setBusquedaRealizada(true);
      if (usuario) {
        toast.success('Se encontró un usuario con esta cédula');
      }
    } catch (error) {
      console.error('Error buscando médico:', error);
      toast.error('No se pudo buscar la cédula');
    } finally {
      setBuscando(false);
    }
  };

  const handleContinuarConUsuario = () => {
    if (!usuarioEncontrado || usuarioEncontrado.tipo_usuario !== 'medico') return;
    setIdUsuario(usuarioEncontrado.id_usuario);
    setStep('asignar');
  };

  const handleAgregarHorario = () => {
    if (!asignacionEnSucursal || asignacionEnSucursal.estado !== 'activo') return;
    setIdUsuarioSucursal(asignacionEnSucursal.id_usuario_sucursal);
    setIdEspecialidadAsignacion(asignacionEnSucursal.id_especialidad);
    setStep('horario');
  };

  const handleUsarMedicoExistente = () => {
    if (!onMedicoListo || !asignacionEnSucursal || asignacionEnSucursal.estado !== 'activo') return;
    if (horariosMedico.filter(horario => horario.estado === 'activo').length === 0) {
      toast.error('Este médico no tiene horarios activos. Agregue un horario antes de usarlo en la cita.');
      return;
    }
    onMedicoListo({ idUsuarioSucursal: asignacionEnSucursal.id_usuario_sucursal, idEspecialidad: asignacionEnSucursal.id_especialidad });
  };

  const handleCrearMedico = async () => {
    if (!busquedaRealizada) {
      toast.error('Busque la cédula antes de crear un médico');
      return;
    }
    if (!formUsuario.nombre.trim() || !formUsuario.apellido.trim() || !formUsuario.email.trim() || !formUsuario.password.trim()) {
      toast.error('Nombre, apellido, email y contraseña son requeridos');
      return;
    }

    setGuardando(true);
    setErrorCreacion(null);
    try {
      const usuario = await createUsuario({
        nombre: formUsuario.nombre.trim(),
        apellido: formUsuario.apellido.trim(),
        cedula: cedulaBusqueda.trim(),
        email: formUsuario.email.trim(),
        telefono: formUsuario.telefono.trim() || null,
        password: formUsuario.password,
        tipo_usuario: 'medico',
        fecha_ingreso: formUsuario.fecha_ingreso,
        estado: formUsuario.estado
      });

      if (!usuario) {
        toast.error('No se pudo crear el médico');
        return;
      }

      setUsuarioEncontrado(usuario);
      setIdUsuario(usuario.id_usuario);
      setStep('asignar');
      toast.success('Médico creado exitosamente');
    } catch (error: any) {
      const mensaje = error?.message || 'No se pudo crear el médico';
      setErrorCreacion(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardarAsignacion = async () => {
    if (!idUsuario || !currentUser?.id_sucursal || !formAsignacion.id_especialidad) {
      toast.error('Debe seleccionar una especialidad');
      return;
    }

    if (cargandoAsignacionesUsuarioSucursal) {
      toast.error('Espere a que se carguen las asignaciones del médico');
      return;
    }

    const idEspecialidad = parseInt(formAsignacion.id_especialidad);
    const asignacionExistente = asignacionesUsuarioSucursal.find(asignacion =>
      asignacion.estado === 'activo'
      && asignacion.id_sucursal === currentUser.id_sucursal
      && asignacion.id_especialidad === idEspecialidad
    );

    if (asignacionExistente) {
      setIdUsuarioSucursal(asignacionExistente.id_usuario_sucursal);
      setIdEspecialidadAsignacion(idEspecialidad);
      setStep('horario');
      toast.info('El médico ya tiene esta asignación activa; se reutilizará para el horario');
      return;
    }

    setGuardando(true);
    try {
      const asignacion = await createUsuarioSucursal({
        id_usuario: idUsuario,
        id_sucursal: currentUser.id_sucursal,
        id_especialidad: idEspecialidad,
        especialidad: null,
        cargo: formAsignacion.cargo,
        estado: 'activo'
      });

      if (!asignacion) {
        toast.error('No se pudo crear la asignación a la sucursal');
        return;
      }

      setIdUsuarioSucursal(asignacion.id_usuario_sucursal);
      setIdEspecialidadAsignacion(idEspecialidad);
      setStep('horario');
      toast.success('Médico asignado a la sucursal');
    } catch (error) {
      console.error('Error creando asignación:', error);
      toast.error('No se pudo crear la asignación a la sucursal');
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardarHorario = async () => {
    if (!idUsuarioSucursal) {
      toast.error('No se encontró la asignación del médico a la sucursal');
      return;
    }
    if (cargandoConsultorios) {
      toast.error('Espere a que se carguen los datos de la sucursal');
      return;
    }
    if (!idConsultorioAutomatico) {
      toast.error('La sucursal no tiene consultorios registrados. Solicite al administrador crear al menos uno en Configuraciones.');
      return;
    }
    if (diasSeleccionados.length === 0) {
      toast.error('Debe seleccionar al menos un día');
      return;
    }
    if (!formHorario.hora_inicio || !formHorario.hora_fin) {
      toast.error('Debe especificar hora de inicio y fin');
      return;
    }
    if (!formHorario.duracion_consulta || formHorario.duracion_consulta <= 0 || formHorario.duracion_consulta > 480) {
      toast.error('La duración debe estar entre 1 y 480 minutos (8 horas)');
      return;
    }
    if (cargandoAsignacionesConsultorio) {
      toast.error('Espere a que se carguen los horarios existentes');
      return;
    }

    if (formHorario.hora_fin <= formHorario.hora_inicio) {
      toast.error('La hora de fin debe ser mayor a la hora de inicio');
      return;
    }

    const idConsultorio = idConsultorioAutomatico;
    // Un día se omite si el médico ya tiene un horario activo que se cruza con el nuevo (cualquier consultorio)
    const cruces = diasSeleccionados
      .map(dia => ({
        dia,
        horario: horariosMedico.find(horario =>
          horario.estado === 'activo'
          && horario.dia_semana === dia
          && formHorario.hora_inicio < horaCorta(horario.hora_fin)
          && formHorario.hora_fin > horaCorta(horario.hora_inicio)
        )
      }))
      .filter((cruce): cruce is { dia: number; horario: AsignacionConsultorio } => !!cruce.horario);
    const diasOmitidos = cruces.map(cruce => cruce.dia);
    const diasFiltrados = diasSeleccionados.filter(dia => !diasOmitidos.includes(dia));

    if (cruces.length > 0) {
      const detalle = cruces
        .map(cruce => `${nombreDia(cruce.dia)} (${horaCorta(cruce.horario.hora_inicio)}–${horaCorta(cruce.horario.hora_fin)})`)
        .join(', ');
      if (diasFiltrados.length === 0) {
        toast.error(`El horario se cruza con horarios ya registrados: ${detalle}`);
        return;
      }
      toast.info(`Se omitieron días que se cruzan con horarios ya registrados: ${detalle}`);
    }

    setGuardando(true);
    try {
      const resultados = await Promise.all(diasFiltrados.map(dia => createAsignacionConsultorio({
        id_usuario_sucursal: idUsuarioSucursal,
        id_consultorio: idConsultorio,
        dia_semana: dia,
        hora_inicio: formHorario.hora_inicio,
        hora_fin: formHorario.hora_fin,
        duracion_consulta: formHorario.duracion_consulta,
        estado: 'activo'
      })));
      const creados = resultados.filter(Boolean).length;

      if (creados === 0) {
        toast.error('No se pudo crear el horario');
        return;
      }

      toast.success(creados === 1 ? 'Horario creado exitosamente' : `${creados} horarios creados exitosamente`);
      await recargarHorarios();
      if (onMedicoListo) {
        // Modo embebido: el médico queda seleccionado automáticamente en la cita
        onMedicoListo({ idUsuarioSucursal, idEspecialidad: idEspecialidadAsignacion });
        return;
      }
      setStep('listo');
    } catch (error) {
      console.error('Error creando horarios:', error);
      toast.error('No se pudo crear el horario');
    } finally {
      setGuardando(false);
    }
  };

  const handleAgregarOtro = () => {
    setStep('buscar');
    setCedulaBusqueda('');
    setUsuarioEncontrado(null);
    setIdUsuario(null);
    setIdUsuarioSucursal(null);
    setBusquedaRealizada(false);
    setErrorCreacion(null);
    setFormUsuario({
      nombre: '',
      apellido: '',
      email: '',
      telefono: '',
      password: '',
      fecha_ingreso: new Date().toISOString().split('T')[0],
      estado: 'activo'
    });
    setFormAsignacion({ id_especialidad: '', cargo: 'MEDICO ESPECIALISTA' });
    setFormHorario({ hora_inicio: '08:00', hora_fin: '17:00', duracion_consulta: 30 });
    setDiasSeleccionados([1]);
  };

  const renderHorariosMedico = () => {
    if (cargandoAsignacionesConsultorio) {
      return (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Cargando horarios...
        </p>
      );
    }
    if (horariosMedico.length === 0) {
      return <p className="text-sm text-gray-500">Este médico aún no tiene horarios registrados en esta sucursal.</p>;
    }
    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        {horariosMedico.map((horario, index) => (
          <div
            key={horario.id_asignacion}
            className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm ${index > 0 ? 'border-t border-gray-200' : ''}`}
          >
            <span className="font-medium text-gray-900">{nombreDia(horario.dia_semana)}</span>
            <span className="flex items-center gap-1 text-gray-700">
              <Clock className="size-3.5" />
              {horaCorta(horario.hora_inicio)} – {horaCorta(horario.hora_fin)}
            </span>
            <span className="text-xs text-gray-500">
              {horario.duracion_consulta} min por cita{horario.estado !== 'activo' ? ' · inactivo' : ''}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (!currentUser?.id_sucursal) {
    return (
      <Card className="p-6">
        <p className="text-sm text-red-600">No se encontró la sucursal asignada al Gestor.</p>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {!embebido && (
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Médicos y Horarios</h1>
          <p className="text-sm text-gray-600">Agregue médicos, asígnelos a su sucursal y defina sus horarios.</p>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-gray-500" aria-label="Progreso del registro de médico">
        {['Buscar médico', 'Asignar sucursal', 'Definir horario', 'Listo'].map((label, index) => {
          const pasos = ['buscar', 'asignar', 'horario', 'listo'];
          const activo = pasos.indexOf(step) >= index;
          return (
            <span key={label} className={activo ? 'font-medium text-blue-600' : ''}>
              {index > 0 && <span className="mx-2 text-gray-300">/</span>}
              {label}
            </span>
          );
        })}
      </div>

      {step === 'buscar' && (
        <Card className="p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold">1. Buscar o crear médico</h2>
            <p className="text-sm text-gray-600">Busque primero por cédula para evitar registros duplicados.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="cedula-medico">Cédula</Label>
              <Input
                id="cedula-medico"
                value={cedulaBusqueda}
                onChange={(event) => {
                  setCedulaBusqueda(event.target.value);
                  setUsuarioEncontrado(null);
                  setIdUsuario(null);
                  setIdUsuarioSucursal(null);
                  setBusquedaRealizada(false);
                  setErrorCreacion(null);
                }}
                placeholder="Ingrese la cédula"
              />
            </div>
            <Button className="sm:mt-8" onClick={handleBuscar} disabled={buscando}>
              {buscando ? <Loader2 className="size-4 animate-spin mr-2" /> : <Search className="size-4 mr-2" />}
              Buscar
            </Button>
          </div>

          {usuarioEncontrado && (
            <Card className="p-4 bg-blue-50 border-blue-200">
              <p className="font-medium">{usuarioEncontrado.nombre} {usuarioEncontrado.apellido}</p>
              <p className="text-sm text-gray-600">{usuarioEncontrado.email}</p>
              <p className="text-sm text-gray-600">Estado: {usuarioEncontrado.estado}</p>
              {usuarioEncontrado.tipo_usuario !== 'medico' ? (
                <p className="mt-4 text-sm text-red-600">
                  Esta cédula ya está registrada con el rol {formatearTipoUsuario(usuarioEncontrado.tipo_usuario)} y no puede asignarse como médico.
                  Si esta persona también atiende pacientes, solicite al administrador del sistema que cambie su rol a Médico.
                </p>
              ) : cargandoAsignacionesUsuarioSucursal ? (
                <p className="mt-4 text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Cargando asignaciones del médico...
                </p>
              ) : asignacionEnSucursal?.estado === 'activo' ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-gray-700">
                    Asignado a esta sucursal
                    {asignacionEnSucursal.especialidad_data?.nombre ? ` · ${asignacionEnSucursal.especialidad_data.nombre}` : ''}
                    {asignacionEnSucursal.cargo ? ` · ${asignacionEnSucursal.cargo}` : ''}
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900">Horarios registrados</p>
                    {renderHorariosMedico()}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {embebido && (
                      <Button onClick={handleUsarMedicoExistente}>
                        <CheckCircle2 className="size-4 mr-2" />
                        Usar este médico en la cita
                      </Button>
                    )}
                    <Button variant={embebido ? 'outline' : 'default'} onClick={handleAgregarHorario}>
                      <CalendarPlus className="size-4 mr-2" />
                      Agregar horario
                    </Button>
                  </div>
                </div>
              ) : asignacionEnSucursal ? (
                <p className="mt-4 text-sm text-red-600">
                  La asignación de este médico en esta sucursal está inactiva. Solicite al administrador que la active en Configuraciones.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-gray-700">El médico aún no está asignado a esta sucursal.</p>
                  <Button onClick={handleContinuarConUsuario}>
                    Asignar a esta sucursal
                  </Button>
                </div>
              )}
            </Card>
          )}

          {!usuarioEncontrado && busquedaRealizada && !buscando && !errorCreacion && (
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="font-medium">Crear médico nuevo</h3>
                <p className="text-sm text-gray-600">No existe un usuario con esta cédula. El rol será Médico.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre-medico">Nombre *</Label>
                  <Input id="nombre-medico" value={formUsuario.nombre} onChange={(event) => setFormUsuario(prev => ({ ...prev, nombre: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido-medico">Apellido *</Label>
                  <Input id="apellido-medico" value={formUsuario.apellido} onChange={(event) => setFormUsuario(prev => ({ ...prev, apellido: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Cédula</Label>
                  <Input value={cedulaBusqueda} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-medico">Email *</Label>
                  <Input id="email-medico" type="email" value={formUsuario.email} onChange={(event) => setFormUsuario(prev => ({ ...prev, email: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono-medico">Teléfono</Label>
                  <Input id="telefono-medico" value={formUsuario.telefono} onChange={(event) => setFormUsuario(prev => ({ ...prev, telefono: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-medico">Contraseña *</Label>
                  <Input id="password-medico" type="password" value={formUsuario.password} onChange={(event) => setFormUsuario(prev => ({ ...prev, password: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fecha-ingreso-medico">Fecha de ingreso *</Label>
                  <Input id="fecha-ingreso-medico" type="date" value={formUsuario.fecha_ingreso} onChange={(event) => setFormUsuario(prev => ({ ...prev, fecha_ingreso: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={formUsuario.estado} onValueChange={(value: 'activo' | 'inactivo') => setFormUsuario(prev => ({ ...prev, estado: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCrearMedico} disabled={guardando}>
                {guardando ? <Loader2 className="size-4 animate-spin mr-2" /> : <UserPlus className="size-4 mr-2" />}
                Crear médico y continuar
              </Button>
            </div>
          )}

          {errorCreacion && (
            <Card className="p-4 bg-red-50 border-red-200">
              <p className="text-sm text-red-600">{errorCreacion}</p>
              <Button variant="outline" className="mt-3" onClick={() => {
                setErrorCreacion(null);
                setUsuarioEncontrado(null);
                setBusquedaRealizada(false);
              }}>
                Volver a buscar
              </Button>
            </Card>
          )}
        </Card>
      )}

      {step === 'asignar' && (
        <Card className="p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold">2. Asignar a esta sucursal</h2>
            <p className="text-sm text-gray-600">La sucursal está fijada a la asignación del Gestor.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Especialidad *</Label>
              <Select value={formAsignacion.id_especialidad} onValueChange={(value) => setFormAsignacion(prev => ({ ...prev, id_especialidad: value }))} disabled={cargandoEspecialidades}>
                <SelectTrigger><SelectValue placeholder="Seleccione una especialidad" /></SelectTrigger>
                <SelectContent>
                  {especialidades.map(especialidad => (
                    <SelectItem key={especialidad.id_especialidad} value={especialidad.id_especialidad.toString()}>{especialidad.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value="Médico especialista" disabled />
            </div>
          </div>
          <Button onClick={handleGuardarAsignacion} disabled={guardando || cargandoAsignacionesUsuarioSucursal}>
            {guardando && <Loader2 className="size-4 animate-spin mr-2" />}
            Guardar asignación y continuar
          </Button>
        </Card>
      )}

      {step === 'horario' && (
        <Card className="p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold">3. Definir horario</h2>
            <p className="text-sm text-gray-600">
              {usuarioEncontrado ? `${usuarioEncontrado.nombre} ${usuarioEncontrado.apellido}. ` : ''}
              Los días que se crucen con un horario ya registrado se omitirán.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">Horarios registrados</p>
            {renderHorariosMedico()}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duracion-consulta">Duración de consulta (minutos)</Label>
              <Input id="duracion-consulta" type="number" min="1" max="480" value={formHorario.duracion_consulta} onChange={(event) => setFormHorario(prev => ({ ...prev, duracion_consulta: parseInt(event.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora-inicio">Hora de inicio</Label>
              <Input id="hora-inicio" type="time" value={formHorario.hora_inicio} onChange={(event) => setFormHorario(prev => ({ ...prev, hora_inicio: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora-fin">Hora de fin</Label>
              <Input id="hora-fin" type="time" value={formHorario.hora_fin} onChange={(event) => setFormHorario(prev => ({ ...prev, hora_fin: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Días de atención *</Label>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map(dia => (
                <Button key={dia.valor} type="button" variant={diasSeleccionados.includes(dia.valor) ? 'default' : 'outline'} onClick={() => toggleDia(dia.valor)}>
                  {dia.abrev}
                </Button>
              ))}
            </div>
          </div>
          <Button onClick={handleGuardarHorario} disabled={guardando || cargandoAsignacionesConsultorio}>
            {guardando && <Loader2 className="size-4 animate-spin mr-2" />}
            Guardar horario
          </Button>
        </Card>
      )}

      {step === 'listo' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-6 text-green-600 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold">Configuración completada</h2>
              <p className="text-sm text-gray-600">
                {usuarioEncontrado ? `${usuarioEncontrado.nombre} ${usuarioEncontrado.apellido}` : 'El médico'} quedó asignado a la sucursal con estos horarios.
              </p>
            </div>
          </div>
          {renderHorariosMedico()}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setStep('horario')}>
              <CalendarPlus className="size-4 mr-2" />
              Agregar otro horario
            </Button>
            <Button onClick={handleAgregarOtro}>Agregar otro médico</Button>
            <Button variant="outline" onClick={onTerminar}>Terminar</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
