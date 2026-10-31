// Registro de una solicitud de maternidad desde la web: solo cotización o agendamiento del tour
import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2, FileText, CalendarCheck, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAseguradorasMaternidad, useHorariosDisponiblesMaternidad } from '../../hooks/useMaternidad';
import {
  registrarSolicitudMaternidad,
  enviarCotizacionMaternidad,
  buscarDatosMadrePorCedula,
  mensajeErrorMaternidad,
} from '../../lib/maternidadService';
import type { MaternidadSolicitud } from '../../lib/supabaseTypes';
import { fechaHoyEcuadorISO, formatFechaLarga } from './maternidadUtils';

interface MaternidadSolicitudModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Solicitud existente (p. ej. solo cotización) a la que se le agenda el tour */
  solicitudBase?: MaternidadSolicitud | null;
  fechaInicial?: string;
  idHorarioInicial?: number;
  usuarioNombre: string;
  onGuardado: () => void;
}

type Modo = 'cotizacion' | 'tour';

const formVacio = {
  nombre_madre: '',
  cedula: '',
  semanas_gestacion: '',
  correo: '',
  telefono: '',
  medico_ginecologo: '',
  id_aseguradora_mat: '',
  notas: '',
};

export function MaternidadSolicitudModal({
  open,
  onOpenChange,
  solicitudBase,
  fechaInicial,
  idHorarioInicial,
  usuarioNombre,
  onGuardado,
}: MaternidadSolicitudModalProps) {
  const { aseguradoras } = useAseguradorasMaternidad(true);
  const [formData, setFormData] = useState(formVacio);
  const [modo, setModo] = useState<Modo>('tour');
  const [fechaTour, setFechaTour] = useState('');
  const [idHorario, setIdHorario] = useState('');
  const [enviarCorreo, setEnviarCorreo] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBuscando, setIsBuscando] = useState(false);
  const [cedulaBuscada, setCedulaBuscada] = useState('');
  const ultimaCedulaRef = useRef('');

  const { turnos, isLoading: cargandoTurnos } = useHorariosDisponiblesMaternidad(
    modo === 'tour' && fechaTour ? fechaTour : undefined,
    modo === 'tour' && fechaTour ? fechaTour : undefined,
  );
  const turnosFecha = fechaTour ? turnos.filter(t => t.fecha === fechaTour) : [];

  useEffect(() => {
    if (!open) return;
    setFormData(solicitudBase ? {
      nombre_madre: solicitudBase.nombre_madre,
      cedula: solicitudBase.cedula,
      semanas_gestacion: solicitudBase.semanas_gestacion?.toString() || '',
      correo: solicitudBase.correo,
      telefono: solicitudBase.telefono,
      medico_ginecologo: solicitudBase.medico_ginecologo || '',
      id_aseguradora_mat: solicitudBase.id_aseguradora_mat?.toString() || '',
      notas: solicitudBase.notas || '',
    } : formVacio);
    setModo(solicitudBase || fechaInicial ? 'tour' : 'cotizacion');
    setFechaTour(fechaInicial || solicitudBase?.fecha_tour || '');
    setIdHorario(idHorarioInicial?.toString() || '');
    setEnviarCorreo(true);
    setCedulaBuscada(solicitudBase?.cedula || '');
  }, [open, solicitudBase, fechaInicial, idHorarioInicial]);

  const set = (campo: keyof typeof formVacio, valor: string) => setFormData(prev => ({ ...prev, [campo]: valor }));

  // Si la mamá ya existe (solicitud previa o paciente) trae sus datos; si no, consulta el Registro Civil
  const handleBuscarCedula = async (cedulaParam?: string) => {
    const cedula = (cedulaParam ?? formData.cedula).replace(/\s/g, '');
    if (!/^\d{10}$/.test(cedula)) {
      toast.warning('La cédula debe tener 10 dígitos para buscar');
      return;
    }
    setCedulaBuscada(cedula);
    ultimaCedulaRef.current = cedula;
    setIsBuscando(true);
    try {
      const datos = await buscarDatosMadrePorCedula(cedula);
      // Si mientras tanto se escribió otra cédula, se descarta esta respuesta
      if (ultimaCedulaRef.current !== cedula) return;
      // Cédula nueva = otra paciente: se reemplazan todos sus datos (no se mezclan con los de la anterior)
      setFormData(prev => ({
        ...prev,
        cedula,
        nombre_madre: datos?.nombre_madre || '',
        correo: datos?.correo?.toLowerCase() || '',
        telefono: datos?.telefono || '',
        semanas_gestacion: datos?.semanas_gestacion?.toString() || '',
        medico_ginecologo: datos?.medico_ginecologo || '',
        id_aseguradora_mat:
          datos?.id_aseguradora_mat && aseguradoras.some(a => a.id_aseguradora_mat === datos.id_aseguradora_mat)
            ? datos.id_aseguradora_mat.toString() : '',
      }));
      if (!datos) {
        toast.info('No se encontraron datos para esta cédula. Complete el formulario manualmente.');
        return;
      }
      toast.info(
        datos.fuente === 'maternidad' ? 'Mamá con solicitud previa: datos cargados. Verifique semanas de gestación.'
          : datos.fuente === 'paciente' ? 'Paciente registrada en el sistema: datos cargados.'
            : 'Datos del Registro Civil cargados. Complete los campos faltantes.',
      );
    } catch {
      toast.info('No se pudo consultar la cédula. Complete los datos manualmente.');
    } finally {
      setIsBuscando(false);
    }
  };

  const handleCambioCedula = (valor: string) => {
    set('cedula', valor);
    const limpia = valor.replace(/\s/g, '');
    // Búsqueda automática al completar los 10 dígitos (una vez por cédula)
    if (!solicitudBase && /^\d{10}$/.test(limpia) && limpia !== cedulaBuscada) void handleBuscarCedula(limpia);
  };

  const handleGuardar = async () => {
    const cedula = formData.cedula.replace(/\s/g, '');
    if (!formData.nombre_madre.trim()) return toast.error('Ingrese el nombre de la mamá');
    if (!/^\d{10}$/.test(cedula) && !/^[A-Za-z0-9]{5,20}$/.test(cedula)) return toast.error('Ingrese una cédula o pasaporte válido');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData.correo.trim())) return toast.error('Ingrese un correo válido');
    if (!formData.telefono.trim()) return toast.error('Ingrese el teléfono');
    if (!formData.id_aseguradora_mat) return toast.error('Seleccione la aseguradora');
    const semanas = formData.semanas_gestacion ? parseInt(formData.semanas_gestacion) : null;
    if (semanas !== null && (isNaN(semanas) || semanas < 1 || semanas > 45)) return toast.error('Las semanas de gestación deben estar entre 1 y 45');
    if (modo === 'tour' && (!fechaTour || !idHorario)) return toast.error('Seleccione la fecha y el turno del tour');

    setIsSaving(true);
    try {
      const resultado = await registrarSolicitudMaternidad({
        nombre_madre: formData.nombre_madre,
        cedula,
        correo: formData.correo,
        telefono: formData.telefono,
        semanas_gestacion: semanas,
        medico_ginecologo: formData.medico_ginecologo || null,
        id_aseguradora_mat: parseInt(formData.id_aseguradora_mat),
        fecha_tour: modo === 'tour' ? fechaTour : null,
        id_horario_mat: modo === 'tour' ? parseInt(idHorario) : null,
        notas: formData.notas || null,
        creado_por: usuarioNombre,
        id_solicitud_mat: solicitudBase?.id_solicitud_mat ?? null,
      });

      toast.success(
        resultado.tour_nuevo
          ? 'Tour agendado correctamente'
          : resultado.accion === 'actualizada' ? 'Solicitud actualizada' : 'Solicitud de cotización registrada',
      );

      if (enviarCorreo) {
        try {
          const envio = await enviarCotizacionMaternidad(
            resultado.id_solicitud_mat,
            usuarioNombre,
            resultado.tour_nuevo ? 'confirmacion_tour' : 'cotizacion',
          );
          toast.success(`Cotización ${envio.numero_cotizacion || ''} enviada a ${resultado.correo}`);
        } catch (error) {
          toast.warning(`La solicitud se guardó, pero el correo no se envió: ${mensajeErrorMaternidad(error)}`);
        }
      }

      onGuardado();
      onOpenChange(false);
    } catch (error) {
      toast.error(mensajeErrorMaternidad(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="maternidad-dialog-medio">
        <DialogHeader>
          <DialogTitle>{solicitudBase ? 'Agendar tour de maternidad' : 'Nueva solicitud de maternidad'}</DialogTitle>
          <DialogDescription>
            Registra la cotización o agenda el tour. Se enviará un correo con el presupuesto, el checklist y el boletín.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Cédula de identidad *</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.cedula}
                  maxLength={20}
                  placeholder="Ingrese la cédula para buscar sus datos"
                  onChange={e => handleCambioCedula(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBuscarCedula()}
                />
                <Button type="button" variant="outline" onClick={() => handleBuscarCedula()} disabled={isBuscando} title="Buscar por cédula">
                  {isBuscando ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Nombre de la mamá *</Label>
              <Input value={formData.nombre_madre} onChange={e => set('nombre_madre', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Semanas de gestación</Label>
              <Input type="number" min="1" max="45" value={formData.semanas_gestacion} onChange={e => set('semanas_gestacion', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Correo *</Label>
              <Input type="email" value={formData.correo} onChange={e => set('correo', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono *</Label>
              <Input value={formData.telefono} onChange={e => set('telefono', e.target.value)} placeholder="0991234567" />
            </div>
            <div className="space-y-2">
              <Label>Médico ginecólogo</Label>
              <Input value={formData.medico_ginecologo} onChange={e => set('medico_ginecologo', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Aseguradora *</Label>
              <Select value={formData.id_aseguradora_mat} onValueChange={v => set('id_aseguradora_mat', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccione la aseguradora" /></SelectTrigger>
                <SelectContent>
                  {aseguradoras.map(a => (
                    <SelectItem key={a.id_aseguradora_mat} value={a.id_aseguradora_mat.toString()}>{a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>¿Qué solicita?</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={modo === 'cotizacion' ? 'default' : 'outline'}
                disabled={!!solicitudBase}
                onClick={() => setModo('cotizacion')}
              >
                <FileText className="size-4 mr-1" /> Solo cotización
              </Button>
              <Button type="button" size="sm" variant={modo === 'tour' ? 'default' : 'outline'} onClick={() => setModo('tour')}>
                <CalendarCheck className="size-4 mr-1" /> Agendar tour
              </Button>
            </div>
          </div>

          {modo === 'tour' && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label>Fecha del tour *</Label>
                <Input
                  type="date"
                  min={fechaHoyEcuadorISO()}
                  value={fechaTour}
                  onChange={e => { setFechaTour(e.target.value); setIdHorario(''); }}
                />
                {fechaTour && <p className="text-xs text-gray-500 capitalize">{formatFechaLarga(fechaTour)}</p>}
              </div>
              {fechaTour && (
                <div className="space-y-2">
                  <Label>Turno *</Label>
                  {cargandoTurnos ? (
                    <Loader2 className="size-5 animate-spin text-blue-600" />
                  ) : turnosFecha.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay turnos configurados para esta fecha (o ya pasaron).</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {turnosFecha.map(t => {
                        const seleccionado = idHorario === t.id_horario_mat.toString();
                        // El turno ya ocupado por esta misma solicitud sigue disponible para ella
                        const propio = solicitudBase?.id_horario_mat === t.id_horario_mat && solicitudBase?.fecha_tour === t.fecha;
                        const lleno = t.disponibles <= 0 && !propio;
                        return (
                          <Button
                            key={t.id_horario_mat}
                            type="button"
                            size="sm"
                            variant={seleccionado ? 'default' : 'outline'}
                            disabled={lleno}
                            onClick={() => setIdHorario(t.id_horario_mat.toString())}
                          >
                            {t.horario} · {lleno ? 'Ocupado' : t.disponibles === 1 ? 'Disponible' : `${t.disponibles} cupos`}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea rows={2} value={formData.notas} onChange={e => set('notas', e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={enviarCorreo} onCheckedChange={v => setEnviarCorreo(v === true)} />
            Enviar correo con la cotización (presupuesto, checklist y boletín)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={isSaving}>
            {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
            {modo === 'tour' ? 'Agendar tour' : 'Registrar cotización'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
