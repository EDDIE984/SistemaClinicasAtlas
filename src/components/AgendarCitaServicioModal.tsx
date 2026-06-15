// Modal para agendar citas de servicios (Tomografía, Rayos X, Laboratorio, etc.)
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Loader2, Search, User, ChevronLeft, XCircle, Image, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getPacienteByCedula, createPaciente } from '../lib/pacientesService';
import { consultarCedulaRegistroCivil } from '../lib/registroCivilService';
import { obtenerSlotsServicio } from '../lib/slotsServicioService';
import { useServicios, useSucursales } from '../hooks/useConfiguraciones';
import type { CitaServicioCompleta, CitaServicio, Servicio } from '../lib/configuracionesService';
import type { Paciente } from '../lib/pacientesService';
import type { SlotServicio } from '../lib/slotsServicioService';

interface AgendarCitaServicioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCitaAgendada: () => void;
  onCrearCita: (data: Omit<CitaServicio, 'id_cita_servicio' | 'created_at' | 'updated_at' | 'servicio' | 'horario_servicio'>) => Promise<CitaServicio | null>;
  onActualizarCita?: (id: number, updates: Partial<Omit<CitaServicio, 'id_cita_servicio' | 'created_at' | 'updated_at' | 'servicio' | 'horario_servicio'>>) => Promise<CitaServicio | null>;
  citaEditar?: CitaServicioCompleta | null;
  fechaInicial?: string | null;
  idServicioInicial?: number | null;
  currentUserName?: string;
  onSolicitarCancelacion?: () => void;
}

type Step = 'paciente' | 'nuevoPaciente' | 'detalles';

const MIME_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;

function calcularBytesBase64(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.floor(base64.length * 0.75);
}

function dataUrlTieneFirmaImagen(dataUrl: string): boolean {
  const base64 = dataUrl.split(',')[1] ?? '';
  return (
    base64.startsWith('/9j/') ||
    base64.startsWith('iVBOR') ||
    base64.startsWith('UklGR') ||
    base64.startsWith('R0lGOD') ||
    base64.startsWith('Qk')
  );
}

const getNuevoPacienteInicial = () => ({
  cedula: '',
  nombres: '',
  apellidos: '',
  fecha_nacimiento: '',
  sexo: 'M' as 'M' | 'F' | 'Otro',
  telefono: '',
  email: '',
  direccion: '',
  id_sucursal: null as number | null,
  nombre_admisionista: '',
  historia_clinica_establecimiento: '',
  tipo_documento_identificacion: 'CC/CI',
  estado_civil: '',
  telefono_fijo: '',
  lugar_nacimiento: '',
  nacionalidad: '',
  condicion_edad: '',
  grupo_prioritario: '',
  grupo_prioritario_especifique: '',
  autoidentificacion_etnica: '',
  nacionalidad_etnica: '',
  pueblo: '',
  nivel_educacion: '',
  estado_nivel_educacion: '',
  tipo_empresa_trabajo: '',
  ocupacion_profesion: '',
  seguro_salud_principal: '',
  provincia: '',
  canton: '',
  parroquia: '',
  barrio_sector: '',
  calle_principal: '',
  calle_secundaria: '',
  referencia_domicilio: '',
  contacto_emergencia_nombre: '',
  contacto_emergencia_parentesco: '',
  contacto_emergencia_direccion: '',
  contacto_emergencia_telefono: '',
  forma_llegada: '',
  fuente_informacion: '',
  institucion_entrega_paciente: '',
  telefono_institucion_entrega: '',
});

export function AgendarCitaServicioModal({
  isOpen,
  onClose,
  onCitaAgendada,
  onCrearCita,
  onActualizarCita,
  citaEditar,
  fechaInicial,
  idServicioInicial,
  currentUserName,
  onSolicitarCancelacion,
}: AgendarCitaServicioModalProps) {
  const isEditing = !!citaEditar;
  const { servicios } = useServicios();
  const { sucursales } = useSucursales();

  const nombreAdmisionista = currentUserName || localStorage.getItem('currentUserName') || '';

  const [step, setStep] = useState<Step>('paciente');
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLookingUpCedula, setIsLookingUpCedula] = useState(false);
  const [isUploadingFoto, setIsUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);

  // Paciente seleccionado
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null);
  const [cedulaBusqueda, setCedulaBusqueda] = useState('');
  const [nuevoPaciente, setNuevoPaciente] = useState(getNuevoPacienteInicial);

  // Detalles de la cita
  const [idServicio, setIdServicio] = useState<number>(idServicioInicial || 0);
  const [fecha, setFecha] = useState<string>(fechaInicial || new Date().toISOString().split('T')[0]);
  const [slotSeleccionado, setSlotSeleccionado] = useState<SlotServicio | null>(null);
  const [idHorarioServicio, setIdHorarioServicio] = useState<number>(0);
  const [motivo, setMotivo] = useState('');
  const [precio, setPrecio] = useState<string>('');
  const [formaPago, setFormaPago] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [medicoSolicitante, setMedicoSolicitante] = useState('');
  const [numRegistro, setNumRegistro] = useState('');
  const [tieneSeguroMedico, setTieneSeguroMedico] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [fotoNombre, setFotoNombre] = useState('');

  // Slots
  const [slots, setSlots] = useState<{ id_horario: number; horario: string; slot: SlotServicio }[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Servicios activos (sin CONSULTA EXTERNA)
  const serviciosActivos = servicios.filter(
    s => s.estado === 'activo' && s.descripcion.toUpperCase() !== 'CONSULTA EXTERNA'
  );

  const getSucursalInicialPaciente = () => {
    const servicioSeleccionado = serviciosActivos.find(
      s => s.id_servicio === (idServicio || idServicioInicial || serviciosActivos[0]?.id_servicio)
    );
    const idSucursalSesion = parseInt(localStorage.getItem('currentSucursalId') || '0');

    return servicioSeleccionado?.id_sucursal
      || (idSucursalSesion || null)
      || sucursales[0]?.id_sucursal
      || null;
  };

  // Reset al abrir
  useEffect(() => {
    if (!isOpen) return;

    if (isEditing && citaEditar) {
      setPacienteSeleccionado({
        id_paciente: citaEditar.id_paciente,
        nombres: citaEditar.paciente.nombres,
        apellidos: citaEditar.paciente.apellidos,
        cedula: citaEditar.paciente.cedula,
        telefono: citaEditar.paciente.telefono,
        id_compania: 0,
        fecha_nacimiento: '',
        sexo: 'M',
        email: null,
        direccion: null,
        fecha_registro: '',
        estado: 'activo',
      } as Paciente);
      setIdServicio(citaEditar.id_servicio);
      setFecha(citaEditar.fecha_cita);
      setIdHorarioServicio(citaEditar.id_horario_servicio);
      setSlotSeleccionado({ hora_inicio: citaEditar.hora_inicio, hora_fin: citaEditar.hora_fin, disponible: true, cupos_disponibles: 1 });
      setMotivo(citaEditar.motivo || '');
      setPrecio(citaEditar.precio_cita?.toString() || '');
      setFormaPago(citaEditar.forma_pago || '');
      setNotas(citaEditar.notas_cita || '');
      setMedicoSolicitante(citaEditar.medico_solicitante || '');
      setNumRegistro(citaEditar.numero_registro_medico || '');
      setTieneSeguroMedico(citaEditar.tiene_seguro_medico || '');
      setFotoBase64('');
      setFotoNombre('');
      setStep('detalles');
    } else {
      setStep('paciente');
      setPacienteSeleccionado(null);
      setCedulaBusqueda('');
      setNuevoPaciente({
        ...getNuevoPacienteInicial(),
        id_sucursal: getSucursalInicialPaciente(),
        nombre_admisionista: nombreAdmisionista,
      });
      setIdServicio(idServicioInicial || serviciosActivos[0]?.id_servicio || 0);
      setFecha(fechaInicial || new Date().toISOString().split('T')[0]);
      setSlotSeleccionado(null);
      setIdHorarioServicio(0);
      setMotivo('');
      setPrecio('');
      setFormaPago('');
      setNotas('');
      setMedicoSolicitante('');
      setNumRegistro('');
      setTieneSeguroMedico('');
      setFotoBase64('');
      setFotoNombre('');
      setSlots([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || step !== 'nuevoPaciente' || nuevoPaciente.id_sucursal || sucursales.length === 0) return;
    setNuevoPaciente(prev => ({
      ...prev,
      id_sucursal: getSucursalInicialPaciente(),
    }));
  }, [isOpen, step, nuevoPaciente.id_sucursal, sucursales.length, idServicio]);

  // Cargar slots cuando cambia servicio o fecha
  useEffect(() => {
    if (step !== 'detalles' || !idServicio || !fecha) return;
    cargarSlots();
  }, [idServicio, fecha, step]);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      dialogContentRef.current?.scrollTo({ top: 0 });
    });
  }, [isOpen, step]);

  const cargarSlots = async () => {
    setIsLoadingSlots(true);
    setSlotSeleccionado(null);
    setIdHorarioServicio(0);
    try {
      const respuesta = await obtenerSlotsServicio(fecha, idServicio);
      const slotsFlat: { id_horario: number; horario: string; slot: SlotServicio }[] = [];
      for (const h of respuesta.horarios) {
        for (const s of h.slots) {
          slotsFlat.push({ id_horario: h.id_horario_servicio, horario: h.horario_general.hora_inicio + '–' + h.horario_general.hora_fin, slot: s });
        }
      }
      setSlots(slotsFlat);
    } catch {
      setSlots([]);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // Buscar paciente por cédula
  const handleBuscarPaciente = async () => {
    const cedula = cedulaBusqueda.trim();
    if (!cedula) { toast.error('Ingrese una cédula'); return; }

    setIsSearching(true);
    try {
      const paciente = await getPacienteByCedula(cedula);
      if (paciente) {
        setPacienteSeleccionado(paciente);
        setStep('paciente');
      } else {
        // No existe — ir a formulario nuevo paciente con consulta al Registro Civil
        const base = {
          ...getNuevoPacienteInicial(),
          cedula,
          id_sucursal: getSucursalInicialPaciente(),
          nombre_admisionista: nombreAdmisionista,
        };
        setNuevoPaciente(base);
        setStep('nuevoPaciente');
        setIsLookingUpCedula(true);
        try {
          const datos = await consultarCedulaRegistroCivil(cedula);
          if (datos) {
            setNuevoPaciente(prev => ({
              ...prev,
              nombres: datos.nombres || prev.nombres,
              apellidos: datos.apellidos || prev.apellidos,
              fecha_nacimiento: datos.fecha_nacimiento || prev.fecha_nacimiento,
              sexo: datos.sexo || prev.sexo,
              direccion: datos.direccion || prev.direccion,
              estado_civil: datos.estado_civil || prev.estado_civil,
              nacionalidad: datos.nacionalidad || prev.nacionalidad,
              lugar_nacimiento: datos.lugar_nacimiento || prev.lugar_nacimiento,
              nivel_educacion: datos.nivel_educacion || prev.nivel_educacion,
              ocupacion_profesion: datos.ocupacion_profesion || prev.ocupacion_profesion,
              provincia: datos.provincia || prev.provincia,
              canton: datos.canton || prev.canton,
              parroquia: datos.parroquia || prev.parroquia,
              barrio_sector: datos.barrio_sector || prev.barrio_sector,
              calle_principal: datos.calle_principal || prev.calle_principal,
              referencia_domicilio: datos.referencia_domicilio || prev.referencia_domicilio,
            }));
            toast.info('Datos del Registro Civil cargados. Complete los campos faltantes.');
          } else {
            toast.info('Paciente no encontrado. Complete los datos manualmente.');
          }
        } catch {
          toast.info('No se pudo consultar el Registro Civil. Complete los datos manualmente.');
        } finally {
          setIsLookingUpCedula(false);
        }
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleRegistrarPaciente = async () => {
    const { nombres, apellidos, cedula, fecha_nacimiento, sexo, email, telefono } = nuevoPaciente;
    if (!nombres || !apellidos || !cedula || !fecha_nacimiento || !sexo || !email || !telefono) {
      toast.error('Todos los campos obligatorios (*) deben completarse');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Por favor ingrese un correo electrónico válido');
      return;
    }
    const phoneRegex = /^\+5939\d{8}$/;
    if (!phoneRegex.test(telefono)) {
      toast.error('El teléfono debe tener el formato +5939XXXXXXXX (13 caracteres)');
      return;
    }

    const companiaId = localStorage.getItem('currentCompaniaId');
    if (!companiaId) { toast.error('Error: no se pudo obtener la compañía actual'); return; }

    setIsSaving(true);
    try {
      const pacienteCreado = await createPaciente({
        id_compania: parseInt(companiaId),
        id_sucursal: nuevoPaciente.id_sucursal,
        cedula,
        nombres,
        apellidos,
        fecha_nacimiento,
        sexo,
        telefono: telefono || null,
        email: email || null,
        direccion: null,
        fecha_registro: new Date().toISOString().split('T')[0],
        nombre_admisionista: nuevoPaciente.nombre_admisionista || null,
        historia_clinica_establecimiento: nuevoPaciente.historia_clinica_establecimiento || null,
        tipo_documento_identificacion: nuevoPaciente.tipo_documento_identificacion || null,
        estado_civil: null,
        telefono_fijo: null,
        lugar_nacimiento: null,
        nacionalidad: null,
        condicion_edad: null,
        grupo_prioritario: null,
        grupo_prioritario_especifique: null,
        autoidentificacion_etnica: null,
        nacionalidad_etnica: null,
        pueblo: null,
        nivel_educacion: null,
        estado_nivel_educacion: null,
        tipo_empresa_trabajo: null,
        ocupacion_profesion: null,
        seguro_salud_principal: null,
        provincia: null,
        canton: null,
        parroquia: null,
        barrio_sector: null,
        calle_principal: null,
        calle_secundaria: null,
        referencia_domicilio: null,
        contacto_emergencia_nombre: nuevoPaciente.contacto_emergencia_nombre || null,
        contacto_emergencia_parentesco: nuevoPaciente.contacto_emergencia_parentesco || null,
        contacto_emergencia_direccion: nuevoPaciente.contacto_emergencia_direccion || null,
        contacto_emergencia_telefono: nuevoPaciente.contacto_emergencia_telefono || null,
        forma_llegada: null,
        fuente_informacion: null,
        institucion_entrega_paciente: null,
        telefono_institucion_entrega: null,
      } as Omit<Paciente, 'id_paciente' | 'created_at' | 'estado'>);

      if (!pacienteCreado) { toast.error('No se pudo registrar el paciente'); return; }
      toast.success('Paciente registrado exitosamente');
      setPacienteSeleccionado(pacienteCreado);
      setStep('detalles');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmarPaciente = () => {
    if (!pacienteSeleccionado) return;
    setStep('detalles');
  };

  const handleSeleccionarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!MIME_IMAGEN_PERMITIDOS.includes(file.type.toLowerCase())) {
      toast.error('Solo se permiten imágenes');
      return;
    }
    if (file.size > MAX_IMAGEN_BYTES) {
      toast.error('La imagen no puede superar 5 MB');
      return;
    }

    setIsUploadingFoto(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64Raw = ev.target?.result as string;
      if (!base64Raw?.startsWith('data:image/')) {
        toast.error('Formato de imagen inválido');
        setIsUploadingFoto(false);
        return;
      }

      if (!dataUrlTieneFirmaImagen(base64Raw)) {
        toast.error('El archivo seleccionado no contiene una imagen válida');
        setIsUploadingFoto(false);
        return;
      }

      const bytes = calcularBytesBase64(base64Raw);
      if (bytes > MAX_IMAGEN_BYTES) {
        toast.error('Imagen demasiado grande (máximo 5 MB)');
        setIsUploadingFoto(false);
        return;
      }

      setFotoBase64(base64Raw);
      setFotoNombre(file.name);
      setIsUploadingFoto(false);
      toast.success(`Imagen cargada (${Math.round(bytes / 1024)} KB)`);
    };
    reader.onerror = () => {
      setIsUploadingFoto(false);
      toast.error('Error al leer el archivo');
    };
    reader.readAsDataURL(file);
  };

  const handleGuardar = async () => {
    if (!pacienteSeleccionado) { toast.error('Seleccione un paciente'); return; }
    if (!idServicio) { toast.error('Seleccione un servicio'); return; }
    if (!fecha) { toast.error('Seleccione una fecha'); return; }
    if (!slotSeleccionado && !isEditing) { toast.error('Seleccione un horario disponible'); return; }
    if (!medicoSolicitante.trim()) { toast.error('Ingrese el nombre del médico solicitante'); return; }
    if (!numRegistro.trim()) { toast.error('Ingrese el número de registro médico'); return; }
    if (!tieneSeguroMedico.trim()) { toast.error('Ingrese si tiene seguro médico'); return; }

    const sucursalDelServicio = serviciosActivos.find(s => s.id_servicio === idServicio);
    const idSucursal = sucursalDelServicio?.id_sucursal
      || parseInt(localStorage.getItem('currentSucursalId') || '0');

    const datosBase = {
      id_servicio: idServicio,
      id_paciente: pacienteSeleccionado.id_paciente,
      id_sucursal: idSucursal,
      id_horario_servicio: idHorarioServicio || citaEditar?.id_horario_servicio || 0,
      fecha_cita: fecha,
      hora_inicio: slotSeleccionado?.hora_inicio || citaEditar?.hora_inicio || '',
      hora_fin: slotSeleccionado?.hora_fin || citaEditar?.hora_fin || '',
      estado_cita: (isEditing ? citaEditar?.estado_cita || 'confirmada' : 'confirmada') as CitaServicio['estado_cita'],
      motivo: motivo || undefined,
      precio_cita: precio ? parseFloat(precio) : undefined,
      forma_pago: (formaPago || undefined) as CitaServicio['forma_pago'],
      estado_pago: 'pendiente' as const,
      notas_cita: notas || undefined,
      medico_solicitante: medicoSolicitante.trim().toUpperCase(),
      numero_registro_medico: numRegistro.trim(),
      tiene_seguro_medico: tieneSeguroMedico.trim(),
      fecha_confirmada: isEditing ? citaEditar?.fecha_confirmada || undefined : new Date().toISOString(),
      ...(fotoBase64 ? { foto_pedido_base64: fotoBase64 } : {}),
    };

    setIsSaving(true);
    try {
      let ok: CitaServicio | null;
      if (isEditing && onActualizarCita) {
        ok = await onActualizarCita(citaEditar!.id_cita_servicio, datosBase);
      } else {
        ok = await onCrearCita(datosBase);
      }
      if (ok) {
        toast.success(isEditing ? 'Cita actualizada exitosamente' : 'Cita agendada exitosamente');
        onCitaAgendada();
        onClose();
      } else {
        toast.error('Error al guardar la cita');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setNuevoPaciente(prev => ({ ...prev, [field]: e.target.value.toUpperCase() }));

  const nombreServicio = (s: Servicio) => {
    const suc = sucursales.find(su => su.id_sucursal === s.id_sucursal);
    return `${s.descripcion} — ${s.area}${suc ? ` (${suc.nombre})` : ''}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent ref={dialogContentRef} className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Cita de Servicio' : 'Nueva Cita de Servicio'}
          </DialogTitle>
        </DialogHeader>

        {/* PASO 1: BUSCAR PACIENTE */}
        {step === 'paciente' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Busque el paciente por número de cédula.</p>

            <div className="flex gap-2">
              <Input
                placeholder="Cédula del paciente"
                value={cedulaBusqueda}
                onChange={e => setCedulaBusqueda(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBuscarPaciente()}
              />
              <Button onClick={handleBuscarPaciente} disabled={isSearching} variant="outline">
                {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>

            {/* Paciente encontrado */}
            {pacienteSeleccionado && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <User className="size-4 text-green-600" />
                  <span className="font-semibold text-green-800">
                    {pacienteSeleccionado.nombres} {pacienteSeleccionado.apellidos}
                  </span>
                </div>
                <p className="text-sm text-green-700">CI: {pacienteSeleccionado.cedula}</p>
                {pacienteSeleccionado.telefono && (
                  <p className="text-sm text-green-700">Tel: {pacienteSeleccionado.telefono}</p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleConfirmarPaciente} disabled={!pacienteSeleccionado}>
                Siguiente
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* PASO 1b: NUEVO PACIENTE */}
        {step === 'nuevoPaciente' && (
          <div className="space-y-4">
            {isLookingUpCedula && (
              <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-2 rounded">
                <Loader2 className="size-3 animate-spin" /> Consultando Registro Civil...
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

              {/* Sucursal y Admisionista */}
              <div className="space-y-2 sm:col-span-2">
                <Label>Sucursal</Label>
                <Select
                  value={nuevoPaciente.id_sucursal?.toString() ?? ''}
                  onValueChange={v => setNuevoPaciente(prev => ({ ...prev, id_sucursal: parseInt(v) }))}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccione sucursal" /></SelectTrigger>
                  <SelectContent>
                    {sucursales.map(s => (
                      <SelectItem key={s.id_sucursal} value={s.id_sucursal.toString()}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Nombre del admisionista</Label>
                <Input value={nuevoPaciente.nombre_admisionista} disabled className="uppercase bg-gray-50 text-gray-600" />
              </div>

              {/* Identificación */}
              <div className="sm:col-span-2 xl:col-span-4 border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900">Identificación</h3>
              </div>

              <div className="space-y-2">
                <Label>Cédula / Pasaporte *</Label>
                <Input value={nuevoPaciente.cedula} onChange={e => setNuevoPaciente(p => ({ ...p, cedula: e.target.value }))} placeholder="0000000000" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Tipo de documento</Label>
                <Select value={nuevoPaciente.tipo_documento_identificacion} onValueChange={v => setNuevoPaciente(p => ({ ...p, tipo_documento_identificacion: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CC/CI">CC/CI</SelectItem>
                    <SelectItem value="PAS">Pasaporte</SelectItem>
                    <SelectItem value="CARNE">Carné</SelectItem>
                    <SelectItem value="SD">S/D</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 hidden">
                <Label>Historia clínica en establecimiento</Label>
                <Select value={nuevoPaciente.historia_clinica_establecimiento} onValueChange={v => setNuevoPaciente(p => ({ ...p, historia_clinica_establecimiento: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SI">Sí</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Primer y segundo nombre *</Label>
                <Input value={nuevoPaciente.nombres} onChange={set('nombres')} placeholder="NOMBRES" className="uppercase" />
              </div>

              <div className="space-y-2">
                <Label>Primer y segundo apellido *</Label>
                <Input value={nuevoPaciente.apellidos} onChange={set('apellidos')} placeholder="APELLIDOS" className="uppercase" />
              </div>

              {/* Datos personales */}
              <div className="sm:col-span-2 xl:col-span-4 border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900">Datos personales</h3>
              </div>

              <div className="space-y-2 hidden">
                <Label>Estado civil</Label>
                <Select value={nuevoPaciente.estado_civil} onValueChange={v => setNuevoPaciente(p => ({ ...p, estado_civil: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOL">Soltero/a</SelectItem>
                    <SelectItem value="CAS">Casado/a</SelectItem>
                    <SelectItem value="DIV">Divorciado/a</SelectItem>
                    <SelectItem value="VIU">Viudo/a</SelectItem>
                    <SelectItem value="U">Unión libre</SelectItem>
                    <SelectItem value="UH">Unión de hecho</SelectItem>
                    <SelectItem value="NA">No aplica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fecha de nacimiento *</Label>
                <Input type="date" value={nuevoPaciente.fecha_nacimiento} onChange={e => setNuevoPaciente(p => ({ ...p, fecha_nacimiento: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label>Sexo *</Label>
                <Select value={nuevoPaciente.sexo} onValueChange={v => setNuevoPaciente(p => ({ ...p, sexo: v as 'M' | 'F' | 'Otro' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Teléfono celular * (Ej: +593984035410)</Label>
                <Input value={nuevoPaciente.telefono} onChange={e => setNuevoPaciente(p => ({ ...p, telefono: e.target.value }))} placeholder="+593984035410" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Teléfono fijo</Label>
                <Input value={nuevoPaciente.telefono_fijo} onChange={e => setNuevoPaciente(p => ({ ...p, telefono_fijo: e.target.value }))} placeholder="022000000" />
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={nuevoPaciente.email} onChange={e => setNuevoPaciente(p => ({ ...p, email: e.target.value.toUpperCase() }))} placeholder="EJEMPLO@CORREO.COM" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Lugar de nacimiento</Label>
                <Input value={nuevoPaciente.lugar_nacimiento} onChange={set('lugar_nacimiento')} placeholder="CIUDAD / PROVINCIA" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Nacionalidad</Label>
                <Input value={nuevoPaciente.nacionalidad} onChange={set('nacionalidad')} placeholder="ECUATORIANA" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Condición edad</Label>
                <Select value={nuevoPaciente.condicion_edad} onValueChange={v => setNuevoPaciente(p => ({ ...p, condicion_edad: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="H">Hora</SelectItem>
                    <SelectItem value="D">Día</SelectItem>
                    <SelectItem value="M">Mes</SelectItem>
                    <SelectItem value="A">Año</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 hidden">
                <Label>Grupo prioritario</Label>
                <Select value={nuevoPaciente.grupo_prioritario} onValueChange={v => setNuevoPaciente(p => ({ ...p, grupo_prioritario: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SI">Sí</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2 hidden">
                <Label>Especifique grupo prioritario</Label>
                <Input value={nuevoPaciente.grupo_prioritario_especifique} onChange={set('grupo_prioritario_especifique')} placeholder="ADULTO MAYOR, EMBARAZO, DISCAPACIDAD..." className="uppercase" />
              </div>

              {/* Etnia, educación y trabajo */}
              <div className="sm:col-span-2 xl:col-span-4 border-t pt-4 hidden">
                <h3 className="text-sm font-semibold text-gray-900">Etnia, educación y trabajo</h3>
              </div>

              <div className="space-y-2 hidden">
                <Label>Autoidentificación étnica</Label>
                <Input value={nuevoPaciente.autoidentificacion_etnica} onChange={set('autoidentificacion_etnica')} placeholder="MESTIZO/A" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Nacionalidad étnica</Label>
                <Input value={nuevoPaciente.nacionalidad_etnica} onChange={set('nacionalidad_etnica')} placeholder="NACIONALIDAD ÉTNICA" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Pueblo</Label>
                <Input value={nuevoPaciente.pueblo} onChange={set('pueblo')} placeholder="PUEBLO" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Nivel de educación</Label>
                <Input value={nuevoPaciente.nivel_educacion} onChange={set('nivel_educacion')} placeholder="BÁSICA, BACHILLERATO, SUPERIOR..." className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Estado del nivel de educación</Label>
                <Input value={nuevoPaciente.estado_nivel_educacion} onChange={set('estado_nivel_educacion')} placeholder="COMPLETO / INCOMPLETO" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Tipo de empresa de trabajo</Label>
                <Input value={nuevoPaciente.tipo_empresa_trabajo} onChange={set('tipo_empresa_trabajo')} placeholder="PÚBLICA / PRIVADA / NINGUNA" className="uppercase" />
              </div>

              <div className="space-y-2 sm:col-span-2 hidden">
                <Label>Ocupación / profesión</Label>
                <Input value={nuevoPaciente.ocupacion_profesion} onChange={set('ocupacion_profesion')} placeholder="OCUPACIÓN O PROFESIÓN" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Seguro salud principal</Label>
                <Select value={nuevoPaciente.seguro_salud_principal} onValueChange={v => setNuevoPaciente(p => ({ ...p, seguro_salud_principal: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IESS-G">IESS-G</SelectItem>
                    <SelectItem value="IESS-C">IESS-C</SelectItem>
                    <SelectItem value="ISSPOL">ISSPOL</SelectItem>
                    <SelectItem value="ISSFA">ISSFA</SelectItem>
                    <SelectItem value="PRIV">Privado</SelectItem>
                    <SelectItem value="NING">Ninguno</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Residencia */}
              <div className="sm:col-span-2 xl:col-span-4 border-t pt-4 hidden">
                <h3 className="text-sm font-semibold text-gray-900">Residencia</h3>
              </div>

              <div className="space-y-2 hidden">
                <Label>Provincia</Label>
                <Input value={nuevoPaciente.provincia} onChange={set('provincia')} placeholder="PROVINCIA" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Cantón</Label>
                <Input value={nuevoPaciente.canton} onChange={set('canton')} placeholder="CANTÓN" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Parroquia</Label>
                <Input value={nuevoPaciente.parroquia} onChange={set('parroquia')} placeholder="PARROQUIA" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Barrio o sector</Label>
                <Input value={nuevoPaciente.barrio_sector} onChange={set('barrio_sector')} placeholder="BARRIO O SECTOR" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Calle principal</Label>
                <Input value={nuevoPaciente.calle_principal} onChange={set('calle_principal')} placeholder="CALLE PRINCIPAL" className="uppercase" />
              </div>

              <div className="space-y-2 hidden">
                <Label>Calle secundaria</Label>
                <Input value={nuevoPaciente.calle_secundaria} onChange={set('calle_secundaria')} placeholder="CALLE SECUNDARIA" className="uppercase" />
              </div>

              <div className="space-y-2 sm:col-span-2 hidden">
                <Label>Referencia domicilio</Label>
                <Input value={nuevoPaciente.referencia_domicilio} onChange={set('referencia_domicilio')} placeholder="REFERENCIA" className="uppercase" />
              </div>

              <div className="space-y-2 sm:col-span-2 xl:col-span-4 hidden">
                <Label>Dirección completa *</Label>
                <Input value={nuevoPaciente.direccion} onChange={set('direccion')} placeholder="DIRECCIÓN COMPLETA" className="uppercase" />
              </div>

              {/* Contacto y llegada */}
              <div className="sm:col-span-2 xl:col-span-4 border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900">Contacto de emergencia</h3>
              </div>

              <div className="space-y-2">
                <Label>En caso necesario llamar a</Label>
                <Input value={nuevoPaciente.contacto_emergencia_nombre} onChange={set('contacto_emergencia_nombre')} placeholder="NOMBRE COMPLETO" className="uppercase" />
              </div>

              <div className="space-y-2">
                <Label>Parentesco</Label>
                <Input value={nuevoPaciente.contacto_emergencia_parentesco} onChange={set('contacto_emergencia_parentesco')} placeholder="PARENTESCO" className="uppercase" />
              </div>

              <div className="space-y-2">
                <Label>Dirección contacto</Label>
                <Input value={nuevoPaciente.contacto_emergencia_direccion} onChange={set('contacto_emergencia_direccion')} placeholder="DIRECCIÓN" className="uppercase" />
              </div>

              <div className="space-y-2">
                <Label>Teléfono contacto</Label>
                <Input value={nuevoPaciente.contacto_emergencia_telefono} onChange={e => setNuevoPaciente(p => ({ ...p, contacto_emergencia_telefono: e.target.value }))} placeholder="+593..." />
              </div>

              <div className="space-y-2 hidden">
                <Label>Forma de llegada</Label>
                <Select value={nuevoPaciente.forma_llegada} onValueChange={v => setNuevoPaciente(p => ({ ...p, forma_llegada: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AMBULATORIO">Ambulatorio</SelectItem>
                    <SelectItem value="AMBULANCIA">Ambulancia</SelectItem>
                    <SelectItem value="OTRO_TRANSPORTE">Otro transporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 hidden">
                <Label>Fuente de información</Label>
                <Input value={nuevoPaciente.fuente_informacion} onChange={set('fuente_informacion')} placeholder="PACIENTE / FAMILIAR / OTRO" className="uppercase" />
              </div>

              <div className="space-y-2 sm:col-span-2 hidden">
                <Label>Institución o persona que entrega</Label>
                <Input value={nuevoPaciente.institucion_entrega_paciente} onChange={set('institucion_entrega_paciente')} placeholder="INSTITUCIÓN / PERSONA" className="uppercase" />
              </div>

              <div className="space-y-2 sm:col-span-2 hidden">
                <Label>Teléfono institución entrega</Label>
                <Input value={nuevoPaciente.telefono_institucion_entrega} onChange={e => setNuevoPaciente(p => ({ ...p, telefono_institucion_entrega: e.target.value }))} placeholder="+593..." />
              </div>

            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('paciente')}>
                <ChevronLeft className="size-4 mr-1" /> Atrás
              </Button>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleRegistrarPaciente} disabled={isSaving}>
                {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
                Registrar Paciente
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* PASO 2: DETALLES DE LA CITA */}
        {step === 'detalles' && (
          <div className="space-y-4">
            {/* Resumen paciente */}
            {pacienteSeleccionado && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                <User className="size-4 text-gray-500" />
                <span className="font-medium">{pacienteSeleccionado.nombres} {pacienteSeleccionado.apellidos}</span>
                <span className="text-gray-500">• {pacienteSeleccionado.cedula}</span>
                {!isEditing && (
                  <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-xs" onClick={() => setStep('paciente')}>
                    <ChevronLeft className="size-3 mr-1" /> Cambiar
                  </Button>
                )}
              </div>
            )}

            {/* Servicio */}
            <div className="space-y-1">
              <Label>Servicio *</Label>
              <Select value={idServicio.toString()} onValueChange={v => setIdServicio(parseInt(v))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
                <SelectContent>
                  {serviciosActivos.map(s => (
                    <SelectItem key={s.id_servicio} value={s.id_servicio.toString()}>
                      {nombreServicio(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha */}
            <div className="space-y-1">
              <Label>Fecha *</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>

            {/* Slots */}
            <div className="space-y-2">
              <Label>Horario disponible {!isEditing && '*'}</Label>
              {isEditing && slotSeleccionado && (
                <div className="p-2 bg-blue-50 rounded text-sm text-blue-700">
                  Horario actual: {slotSeleccionado.hora_inicio.slice(0, 5)} – {slotSeleccionado.hora_fin.slice(0, 5)}
                  <span className="text-xs text-blue-500 ml-2">(Selecciona otro slot para cambiarlo)</span>
                </div>
              )}
              {isLoadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <Loader2 className="size-4 animate-spin" /> Cargando horarios disponibles...
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">
                  No hay horarios disponibles para este servicio en la fecha seleccionada.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {slots.map((item, i) => {
                    const esSeleccionado = slotSeleccionado?.hora_inicio === item.slot.hora_inicio;
                    return (
                      <Button
                        key={i}
                        type="button"
                        size="sm"
                        variant={esSeleccionado ? 'default' : 'outline'}
                        disabled={!item.slot.disponible}
                        onClick={() => {
                          setSlotSeleccionado(item.slot);
                          setIdHorarioServicio(item.id_horario);
                        }}
                        className={`text-xs ${!item.slot.disponible ? 'opacity-40' : ''}`}
                      >
                        {item.slot.hora_inicio.slice(0, 5)}–{item.slot.hora_fin.slice(0, 5)}
                        <Badge variant="outline" className="ml-1 text-xs px-1">
                          {item.slot.cupos_disponibles} cupo{item.slot.cupos_disponibles !== 1 ? 's' : ''}
                        </Badge>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pedido médico */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-4">
              <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-gray-900">Datos del pedido médico</h3>
              </div>

              <div className="space-y-1">
                <Label>Médico solicitante *</Label>
                <Input
                  placeholder="NOMBRE DEL MÉDICO"
                  value={medicoSolicitante}
                  onChange={e => setMedicoSolicitante(e.target.value)}
                  className="uppercase"
                />
              </div>

              <div className="space-y-1">
                <Label>Número de registro *</Label>
                <Input
                  placeholder="Ej: 123456"
                  value={numRegistro}
                  onChange={e => setNumRegistro(e.target.value)}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>Tiene seguro médico *</Label>
                <Input
                  placeholder="Ej: Sí, IESS / No / Particular"
                  value={tieneSeguroMedico}
                  onChange={e => setTieneSeguroMedico(e.target.value)}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>Fotografía del pedido</Label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingFoto ? (
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                      <Loader2 className="size-5 animate-spin" />
                      <span className="text-sm">Procesando imagen...</span>
                    </div>
                  ) : fotoNombre ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-center gap-2 text-blue-700">
                        <Image className="size-5" />
                        <span className="max-w-full truncate text-sm font-medium">{fotoNombre}</span>
                      </div>
                      <p className="text-xs text-gray-500">Haz clic para cambiar el archivo</p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-gray-500">
                      <Image className="size-8 mx-auto opacity-40" />
                      <p className="text-sm">Haz clic para seleccionar la fotografía del pedido</p>
                      <p className="text-xs">JPG, PNG, WEBP — máximo 5 MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSeleccionarFoto}
                />
              </div>

              {!isEditing && (!medicoSolicitante.trim() || !numRegistro.trim() || !tieneSeguroMedico.trim()) && (
                <div className="md:col-span-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
                  <span>Completa los datos del pedido para guardar la cita como confirmada. La fotografía puede cargarse luego desde confirmación.</span>
                </div>
              )}
            </div>

            {/* Motivo */}
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Input placeholder="Motivo de la cita (opcional)" value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>

            {/* Precio y Forma de pago */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Precio ($)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={precio} onChange={e => setPrecio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Forma de pago</Label>
                <Select value={formaPago} onValueChange={setFormaPago}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="seguro">Seguro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea placeholder="Notas adicionales (opcional)" value={notas} onChange={e => setNotas(e.target.value)} rows={2} />
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {/* Botón cancelar cita — solo en modo edición y si aún se puede cancelar */}
              {isEditing && onSolicitarCancelacion &&
                citaEditar?.estado_cita !== 'cancelada' &&
                citaEditar?.estado_cita !== 'atendida' &&
                citaEditar?.estado_cita !== 'no_asistio' && (
                <Button
                  variant="outline"
                  className="sm:mr-auto gap-1.5 text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 hover:border-red-400"
                  onClick={onSolicitarCancelacion}
                >
                  <XCircle className="size-4" /> Cancelar cita
                </Button>
              )}
              {!isEditing && (
                <Button variant="outline" onClick={() => setStep('paciente')}>
                  <ChevronLeft className="size-4 mr-1" /> Atrás
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
              <Button onClick={handleGuardar} disabled={isSaving}>
                {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
                {isEditing ? 'Actualizar Cita' : 'Agendar Cita'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
