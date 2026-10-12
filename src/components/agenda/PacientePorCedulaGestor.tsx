// Paso de paciente para el perfil GESTOR en el modal de consulta externa.
// Replica el flujo del modal de servicios (AgendarCitaServicioModal): búsqueda por cédula,
// y si no existe, registro con los mismos datos básicos y consulta al Registro Civil.
import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, User, ChevronLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  getPacienteByCedula,
  createPaciente,
  updatePaciente,
  getPacienteByCedulaCualquierEstado,
  construirActualizacionPacienteExistente,
} from '../../lib/pacientesService';
import { consultarCedulaRegistroCivil } from '../../lib/registroCivilService';
import { useSucursales } from '../../hooks/useConfiguraciones';
import type { Paciente } from '../../lib/pacientesService';

interface PacientePorCedulaGestorProps {
  nombreAdmisionista: string;
  pacienteInicial?: Paciente | null;
  prefill?: { cedula?: string | null; telefono?: string | null; correo?: string | null } | null;
  onPacienteConfirmado: (paciente: Paciente) => void;
  onCancelar: () => void;
}

const getNuevoPacienteInicial = () => ({
  cedula: '',
  nombres: '',
  apellidos: '',
  fecha_nacimiento: '',
  sexo: 'M' as 'M' | 'F' | 'Otro',
  telefono: '',
  email: '',
  id_sucursal: null as number | null,
  contacto_emergencia_nombre: '',
  contacto_emergencia_parentesco: '',
  contacto_emergencia_direccion: '',
  contacto_emergencia_telefono: '',
});

export function PacientePorCedulaGestor({
  nombreAdmisionista,
  pacienteInicial,
  prefill,
  onPacienteConfirmado,
  onCancelar,
}: PacientePorCedulaGestorProps) {
  const { sucursales } = useSucursales();
  const [paso, setPaso] = useState<'buscar' | 'nuevo'>('buscar');
  const [cedulaBusqueda, setCedulaBusqueda] = useState(pacienteInicial?.cedula || prefill?.cedula || '');
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(pacienteInicial || null);
  const [nuevoPaciente, setNuevoPaciente] = useState(getNuevoPacienteInicial);
  const [isSearching, setIsSearching] = useState(false);
  const [isLookingUpCedula, setIsLookingUpCedula] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const prefillAplicadoRef = useRef(false);

  const getSucursalInicial = () => {
    const idSucursalSesion = parseInt(localStorage.getItem('currentSucursalId') || '0');
    return idSucursalSesion || sucursales[0]?.id_sucursal || null;
  };

  // Solicitud del chatbot: buscar la cédula automáticamente una sola vez
  useEffect(() => {
    if (pacienteInicial || !prefill?.cedula || prefillAplicadoRef.current) return;
    prefillAplicadoRef.current = true;
    void handleBuscarPaciente(prefill.cedula);
  }, [prefill?.cedula]);

  useEffect(() => {
    if (paso !== 'nuevo' || nuevoPaciente.id_sucursal || sucursales.length === 0) return;
    setNuevoPaciente(prev => ({ ...prev, id_sucursal: getSucursalInicial() }));
  }, [paso, nuevoPaciente.id_sucursal, sucursales.length]);

  // Consulta el Registro Civil y completa el formulario (también usado por el botón de reconsulta)
  const consultarRegistroCivil = async (cedula: string) => {
    setIsLookingUpCedula(true);
    try {
      const datos = await consultarCedulaRegistroCivil(cedula);
      if (datos) {
        setNuevoPaciente(prev => ({
          ...prev,
          nombres: datos.nombres || prev.nombres,
          apellidos: datos.apellidos || prev.apellidos,
          fecha_nacimiento: datos.fecha_nacimiento || prev.fecha_nacimiento,
          sexo: (datos.sexo as 'M' | 'F' | 'Otro') || prev.sexo,
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
  };

  const handleReconsultarRegistroCivil = () => {
    const cedula = nuevoPaciente.cedula.trim();
    if (!/^\d{10}$/.test(cedula)) {
      toast.warning('La cédula debe tener 10 dígitos para consultar el Registro Civil');
      return;
    }
    void consultarRegistroCivil(cedula);
  };

  const handleBuscarPaciente = async (cedulaParam?: string) => {
    const cedula = (cedulaParam ?? cedulaBusqueda).trim();
    if (!cedula) { toast.error('Ingrese una cédula'); return; }

    setIsSearching(true);
    setPacienteSeleccionado(null);
    try {
      const paciente = await getPacienteByCedula(cedula);
      if (paciente) {
        setPacienteSeleccionado(paciente);
        setPaso('buscar');
        return;
      }

      // No existe: formulario de nuevo paciente con consulta al Registro Civil
      setNuevoPaciente({
        ...getNuevoPacienteInicial(),
        cedula,
        id_sucursal: getSucursalInicial(),
        telefono: prefill?.telefono || '',
        email: prefill?.correo?.toUpperCase() || '',
      });
      setPaso('nuevo');
      await consultarRegistroCivil(cedula);
    } finally {
      setIsSearching(false);
    }
  };

  // La cédula ya existe (p. ej. paciente inactivo o cédula corregida en el formulario):
  // se actualiza ese paciente con los datos del formulario y se continúa con el agendamiento.
  const continuarConPacienteExistente = async (cedula: string) => {
    const existente = await getPacienteByCedulaCualquierEstado(cedula);
    if (!existente) {
      toast.error(`Ya existe un paciente con la cédula ${cedula}, pero no se pudo cargar`);
      return;
    }
    const actualizacion = construirActualizacionPacienteExistente({
      nombres: nuevoPaciente.nombres,
      apellidos: nuevoPaciente.apellidos,
      fecha_nacimiento: nuevoPaciente.fecha_nacimiento,
      sexo: nuevoPaciente.sexo,
      telefono: nuevoPaciente.telefono,
      email: nuevoPaciente.email,
      contacto_emergencia_nombre: nuevoPaciente.contacto_emergencia_nombre,
      contacto_emergencia_parentesco: nuevoPaciente.contacto_emergencia_parentesco,
      contacto_emergencia_direccion: nuevoPaciente.contacto_emergencia_direccion,
      contacto_emergencia_telefono: nuevoPaciente.contacto_emergencia_telefono,
    });
    try {
      await updatePaciente(existente.id_paciente, actualizacion);
    } catch (error) {
      toast.error(`El paciente ya existe y no se pudieron actualizar sus datos: ${error instanceof Error ? error.message : 'error desconocido'}`);
      return;
    }
    toast.info('El paciente ya estaba registrado: se actualizaron sus datos y se continúa con el agendamiento');
    onPacienteConfirmado({ ...existente, ...actualizacion } as Paciente);
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
        nombre_admisionista: nombreAdmisionista || null,
        historia_clinica_establecimiento: null,
        tipo_documento_identificacion: 'CC/CI',
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
      onPacienteConfirmado(pacienteCreado);
    } catch (error) {
      console.error('❌ Error al registrar paciente:', error);
      if (error instanceof Error && error.message === 'CEDULA_DUPLICADA') {
        await continuarConPacienteExistente(cedula);
      } else {
        toast.error(`No se pudo registrar el paciente: ${error instanceof Error ? error.message : 'error desconocido'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const set = (field: keyof ReturnType<typeof getNuevoPacienteInicial>) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setNuevoPaciente(prev => ({ ...prev, [field]: e.target.value.toUpperCase() }));

  if (paso === 'buscar') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Busque el paciente por número de cédula.</p>

        <div className="flex gap-2">
          <Input
            placeholder="Cédula del paciente"
            value={cedulaBusqueda}
            onChange={e => setCedulaBusqueda(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBuscarPaciente()}
          />
          <Button onClick={() => handleBuscarPaciente()} disabled={isSearching} variant="outline">
            {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          </Button>
        </div>

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

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button onClick={() => pacienteSeleccionado && onPacienteConfirmado(pacienteSeleccionado)} disabled={!pacienteSeleccionado}>
            Siguiente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLookingUpCedula && (
        <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-2 rounded">
          <Loader2 className="size-3 animate-spin" /> Consultando Registro Civil...
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
          <Input value={nombreAdmisionista} disabled className="uppercase bg-gray-50 text-gray-600" />
        </div>

        <div className="sm:col-span-2 xl:col-span-4 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Identificación</h3>
        </div>

        <div className="space-y-2">
          <Label>Cédula / Pasaporte *</Label>
          <div className="flex gap-2">
            <Input value={nuevoPaciente.cedula} onChange={e => setNuevoPaciente(p => ({ ...p, cedula: e.target.value }))} placeholder="0000000000" />
            <Button
              type="button"
              variant="outline"
              onClick={handleReconsultarRegistroCivil}
              disabled={isLookingUpCedula}
              title="Consultar nuevamente el Registro Civil"
            >
              {isLookingUpCedula ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Primer y segundo nombre *</Label>
          <Input value={nuevoPaciente.nombres} onChange={set('nombres')} placeholder="NOMBRES" className="uppercase" />
        </div>

        <div className="space-y-2">
          <Label>Primer y segundo apellido *</Label>
          <Input value={nuevoPaciente.apellidos} onChange={set('apellidos')} placeholder="APELLIDOS" className="uppercase" />
        </div>

        <div className="sm:col-span-2 xl:col-span-4 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Datos personales</h3>
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

        <div className="space-y-2">
          <Label>Email *</Label>
          <Input type="email" value={nuevoPaciente.email} onChange={e => setNuevoPaciente(p => ({ ...p, email: e.target.value.toUpperCase() }))} placeholder="EJEMPLO@CORREO.COM" className="uppercase" />
        </div>

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
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setPaso('buscar')}>
          <ChevronLeft className="size-4 mr-1" /> Atrás
        </Button>
        <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
        <Button onClick={handleRegistrarPaciente} disabled={isSaving}>
          {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
          Registrar Paciente
        </Button>
      </div>
    </div>
  );
}
