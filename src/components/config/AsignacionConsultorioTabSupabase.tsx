// Tab de gestión de Asignaciones de Consultorio (Horarios) con Supabase
import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Pencil, Trash2, Loader2, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { useAsignacionesConsultorio, formatearDiaSemana, useUsuarioSucursales, useConsultorios, useSucursales } from '../../hooks/useConfiguraciones';
import type { AsignacionConsultorio } from '../../lib/configuracionesService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

const DIAS_SEMANA = [
  { valor: 1, nombre: 'Lunes',     abrev: 'Lun' },
  { valor: 2, nombre: 'Martes',    abrev: 'Mar' },
  { valor: 3, nombre: 'Miércoles', abrev: 'Mié' },
  { valor: 4, nombre: 'Jueves',    abrev: 'Jue' },
  { valor: 5, nombre: 'Viernes',   abrev: 'Vie' },
  { valor: 6, nombre: 'Sábado',    abrev: 'Sáb' },
  { valor: 0, nombre: 'Domingo',   abrev: 'Dom' },
];

export function AsignacionConsultorioTabSupabase() {
  const { asignaciones, isLoading, loadAsignaciones, agregarAsignacion, actualizarAsignacion, eliminarAsignacion } = useAsignacionesConsultorio();
  const { asignaciones: usuariosSucursales } = useUsuarioSucursales();
  const { consultorios } = useConsultorios();
  const { sucursales } = useSucursales();
  
  const [filtroSucursal, setFiltroSucursal] = useState<string>('todas');
  const [filtroMedico, setFiltroMedico] = useState<string>('todos');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [asignacionActual, setAsignacionActual] = useState<AsignacionConsultorio | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [asignacionAEliminar, setAsignacionAEliminar] = useState<AsignacionConsultorio | null>(null);
  const [consultoriosFiltrados, setConsultoriosFiltrados] = useState<typeof consultorios>([]);

  const [formData, setFormData] = useState({
    id_usuario_sucursal: 0,
    id_consultorio: 0,
    hora_inicio: '08:00',
    hora_fin: '17:00',
    duracion_consulta: 30,
    estado: 'activo' as 'activo' | 'inactivo'
  });
  const [diasSeleccionados, setDiasSeleccionados] = useState<number[]>([1]);

  const toggleDia = (valor: number) => {
    setDiasSeleccionados(prev =>
      prev.includes(valor) ? prev.filter(d => d !== valor) : [...prev, valor]
    );
  };

  // Filtrar consultorios cuando cambia el médico seleccionado
  useEffect(() => {
    if (formData.id_usuario_sucursal) {
      // Buscar la asignación usuario-sucursal seleccionada
      const usuarioSucursal = usuariosSucursales.find(
        us => us.id_usuario_sucursal === formData.id_usuario_sucursal
      );

      if (usuarioSucursal) {
        // Filtrar consultorios que pertenecen a la misma sucursal
        const consultoriosDeLaSucursal = consultorios.filter(
          c => c.id_sucursal === usuarioSucursal.id_sucursal
        );
        setConsultoriosFiltrados(consultoriosDeLaSucursal);

        // Si el consultorio seleccionado no está en la lista filtrada, resetear
        const consultorioValido = consultoriosDeLaSucursal.find(
          c => c.id_consultorio === formData.id_consultorio
        );
        if (!consultorioValido && consultoriosDeLaSucursal.length > 0) {
          setFormData(prev => ({ ...prev, id_consultorio: consultoriosDeLaSucursal[0].id_consultorio }));
        } else if (consultoriosDeLaSucursal.length === 0) {
          setFormData(prev => ({ ...prev, id_consultorio: 0 }));
        }
      } else {
        setConsultoriosFiltrados([]);
        setFormData(prev => ({ ...prev, id_consultorio: 0 }));
      }
    } else {
      setConsultoriosFiltrados([]);
      setFormData(prev => ({ ...prev, id_consultorio: 0 }));
    }
  }, [formData.id_usuario_sucursal, usuariosSucursales, consultorios]);

  const handleNuevo = () => {
    const primerMedico = usuariosSucursales.find(us => us.cargo === 'MEDICO ESPECIALISTA');
    setFormData({
      id_usuario_sucursal: primerMedico?.id_usuario_sucursal || 0,
      id_consultorio: consultorios[0]?.id_consultorio || 0,
      hora_inicio: '08:00',
      hora_fin: '17:00',
      duracion_consulta: 30,
      estado: 'activo' as 'activo' | 'inactivo'
    });
    setDiasSeleccionados([1]);
    setIsEditing(false);
    setAsignacionActual(null);
    setIsDialogOpen(true);
  };

  const handleEditar = (asignacion: AsignacionConsultorio) => {
    setFormData({
      id_usuario_sucursal: asignacion.id_usuario_sucursal,
      id_consultorio: asignacion.id_consultorio,
      hora_inicio: asignacion.hora_inicio,
      hora_fin: asignacion.hora_fin,
      duracion_consulta: asignacion.duracion_consulta || 30,
      estado: asignacion.estado
    });
    setDiasSeleccionados([asignacion.dia_semana]);
    setIsEditing(true);
    setAsignacionActual(asignacion);
    setIsDialogOpen(true);
  };

  const handleGuardar = async () => {
    if (!formData.id_usuario_sucursal || !formData.id_consultorio) {
      toast.error('Debe seleccionar un médico y un consultorio');
      return;
    }
    if (!isEditing && diasSeleccionados.length === 0) {
      toast.error('Debe seleccionar al menos un día');
      return;
    }
    if (!formData.hora_inicio || !formData.hora_fin) {
      toast.error('Debe especificar hora de inicio y fin');
      return;
    }
    if (!formData.duracion_consulta || formData.duracion_consulta <= 0 || formData.duracion_consulta > 480) {
      toast.error('La duración debe estar entre 1 y 480 minutos (8 horas)');
      return;
    }

    const datosBase = {
      id_usuario_sucursal: formData.id_usuario_sucursal,
      id_consultorio: formData.id_consultorio,
      hora_inicio: formData.hora_inicio,
      hora_fin: formData.hora_fin,
      duracion_consulta: formData.duracion_consulta,
      estado: formData.estado as 'activo' | 'inactivo'
    };

    if (isEditing && asignacionActual) {
      const success = await actualizarAsignacion(asignacionActual.id_asignacion, datosBase);
      if (success) {
        await loadAsignaciones();
        toast.success('Horario actualizado exitosamente');
        setIsDialogOpen(false);
      } else {
        toast.error('Error al actualizar el horario');
      }
    } else {
      const resultados = await Promise.all(
        diasSeleccionados.map(dia => agregarAsignacion({ ...datosBase, dia_semana: dia }))
      );
      const creados = resultados.filter(Boolean).length;
      if (creados > 0) {
        await loadAsignaciones();
        toast.success(
          creados === 1
            ? 'Horario creado exitosamente'
            : `${creados} horarios creados exitosamente`
        );
        setIsDialogOpen(false);
      } else {
        toast.error('Error al crear los horarios');
      }
    }
  };

  const handleEliminarClick = (asignacion: AsignacionConsultorio) => {
    setAsignacionAEliminar(asignacion);
    setIsDeleteDialogOpen(true);
  };

  const handleEliminarConfirmar = async () => {
    if (!asignacionAEliminar) return;

    const success = await eliminarAsignacion(asignacionAEliminar.id_asignacion);
    if (success) {
      await loadAsignaciones();
      toast.success('Horario eliminado exitosamente');
      setIsDeleteDialogOpen(false);
      setAsignacionAEliminar(null);
    } else {
      toast.error('Error al eliminar el horario. Puede tener registros asociados.');
    }
  };

  const asignacionesFiltradas = asignaciones.filter(asig => {
    const cumpleSucursal = filtroSucursal === 'todas' || asig.usuario_sucursal?.id_sucursal.toString() === filtroSucursal;
    const cumpleMedico = filtroMedico === 'todos' || asig.usuario_sucursal?.id_usuario.toString() === filtroMedico;
    return cumpleSucursal && cumpleMedico;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="flex items-center gap-2">
            <CalendarClock className="size-5" />
            Horarios y Asignaciones de Consultorio
          </h2>
          <p className="text-sm text-gray-600">Define horarios de atención por médico y consultorio</p>
        </div>
        <Button onClick={handleNuevo} disabled={usuariosSucursales.length === 0 || consultorios.length === 0}>
          <Plus className="size-4 mr-2" />
          Nuevo Horario
        </Button>
      </div>

      {/* Sección de Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Filtrar por Sucursal</Label>
            <Select value={filtroSucursal} onValueChange={setFiltroSucursal}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las sucursales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las sucursales</SelectItem>
                {sucursales.map(s => (
                  <SelectItem key={s.id_sucursal} value={s.id_sucursal.toString()}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Filtrar por Médico</Label>
            <Select value={filtroMedico} onValueChange={setFiltroMedico}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los médicos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los médicos</SelectItem>
                {usuariosSucursales
                  .filter(us => us.cargo === 'MEDICO ESPECIALISTA')
                  // Eliminar duplicados de médicos si están en varias sucursales para el filtro
                  .filter((us, index, self) => 
                    index === self.findIndex(t => t.id_usuario === us.id_usuario)
                  )
                  .map(us => (
                    <SelectItem key={us.id_usuario} value={us.id_usuario.toString()}>
                      Dr. {us.usuario?.nombre} {us.usuario?.apellido}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {(usuariosSucursales.length === 0 || consultorios.length === 0) && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <p className="text-sm text-yellow-800">
            ⚠️ Debes tener usuarios asignados a sucursales y consultorios registrados antes de crear horarios.
          </p>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Médico</TableHead>
                <TableHead>Consultorio</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Día</TableHead>
                <TableHead>Hora Inicio</TableHead>
                <TableHead>Hora Fin</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asignacionesFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No hay asignaciones de horario que coincidan con los filtros
                  </TableCell>
                </TableRow>
              ) : (
                asignacionesFiltradas.map((asignacion, index) => (
                  <TableRow key={asignacion.id_asignacion || `asignacion-${index}`}>
                    <TableCell className="font-semibold">
                      Dr. {asignacion.usuario_sucursal?.usuario?.nombre} {asignacion.usuario_sucursal?.usuario?.apellido}
                    </TableCell>
                    <TableCell>{asignacion.consultorio?.nombre}</TableCell>
                    <TableCell>{asignacion.usuario_sucursal?.sucursal?.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatearDiaSemana(asignacion.dia_semana)}
                      </Badge>
                    </TableCell>
                    <TableCell>{asignacion.hora_inicio}</TableCell>
                    <TableCell>{asignacion.hora_fin}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {asignacion.duracion_consulta || 30} min
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={asignacion.estado === 'activo' ? 'default' : 'secondary'}>
                        {asignacion.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => handleEditar(asignacion)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEliminarClick(asignacion)}>
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dialog: Crear/Editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Horario' : 'Nuevo Horario'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Modifica los datos del horario' : 'Define un horario de atención'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Médico *</Label>
              <Select
                value={formData.id_usuario_sucursal.toString()}
                onValueChange={(value: string) => setFormData({ ...formData, id_usuario_sucursal: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {usuariosSucursales
                    .filter((us) => us.cargo === 'MEDICO ESPECIALISTA')
                    .map((us) => (
                      <SelectItem key={us.id_usuario_sucursal} value={us.id_usuario_sucursal.toString()}>
                        Dr. {us.usuario?.nombre} {us.usuario?.apellido} - {us.sucursal?.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Consultorio *</Label>
              <Select
                value={formData.id_consultorio.toString()}
                onValueChange={(value: string) => setFormData({ ...formData, id_consultorio: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {consultoriosFiltrados.map((consultorio) => (
                    <SelectItem key={consultorio.id_consultorio} value={consultorio.id_consultorio.toString()}>
                      {consultorio.nombre} ({consultorio.sucursal?.nombre})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{isEditing ? 'Día de la semana' : 'Días de la semana *'}</Label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map(dia => {
                  const seleccionado = diasSeleccionados.includes(dia.valor);
                  return (
                    <Button
                      key={dia.valor}
                      type="button"
                      size="sm"
                      variant={seleccionado ? 'default' : 'outline'}
                      disabled={isEditing}
                      onClick={() => toggleDia(dia.valor)}
                      className="min-w-[46px]"
                    >
                      {dia.abrev}
                    </Button>
                  );
                })}
              </div>
              {isEditing && (
                <p className="text-xs text-gray-400">El día no se puede modificar. Elimina y crea un nuevo horario si necesitas cambiarlo.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora Inicio *</Label>
                <Input
                  type="time"
                  value={formData.hora_inicio}
                  onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Hora Fin *</Label>
                <Input
                  type="time"
                  value={formData.hora_fin}
                  onChange={(e) => setFormData({ ...formData, hora_fin: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Duración de la Consulta (minutos) *</Label>
              <Input
                type="number"
                min="5"
                max="480"
                step="5"
                placeholder="30"
                value={formData.duracion_consulta}
                onChange={(e) => setFormData({ ...formData, duracion_consulta: parseInt(e.target.value) || 30 })}
              />
              <p className="text-xs text-gray-500">
                Tiempo estimado por consulta. Valores comunes: 15, 30, 45, 60 minutos
              </p>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={formData.estado} onValueChange={(value: 'activo' | 'inactivo') => setFormData({ ...formData, estado: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar}>
              {isEditing
                ? 'Actualizar'
                : diasSeleccionados.length > 1
                  ? `Crear ${diasSeleccionados.length} horarios`
                  : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el horario del Dr. {asignacionAEliminar?.usuario_sucursal?.usuario?.nombre} en {asignacionAEliminar?.consultorio?.nombre}.
              Esta acción no se puede deshacer y puede fallar si existen registros asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminarConfirmar} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}