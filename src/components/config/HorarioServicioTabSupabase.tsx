// Tab de gestión de Horarios de Servicios con Supabase
import { useState } from 'react';
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
import { useHorariosServicio, useServicios, useSucursales, formatearDiaSemana } from '../../hooks/useConfiguraciones';
import type { HorarioServicio } from '../../lib/configuracionesService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

const DIAS_SEMANA = [
  { valor: 1, nombre: 'Lunes',     abrev: 'Lun' },
  { valor: 2, nombre: 'Martes',    abrev: 'Mar' },
  { valor: 3, nombre: 'Miércoles', abrev: 'Mié' },
  { valor: 4, nombre: 'Jueves',    abrev: 'Jue' },
  { valor: 5, nombre: 'Viernes',   abrev: 'Vie' },
  { valor: 6, nombre: 'Sábado',    abrev: 'Sáb' },
  { valor: 7, nombre: 'Domingo',   abrev: 'Dom' },
];

const formInicial = {
  id_servicio: 0,
  hora_inicio: '08:00',
  hora_fin: '17:00',
  duracion_consulta: 30,
  capacidad: 1,
  estado: 'activo' as 'activo' | 'inactivo'
};

export function HorarioServicioTabSupabase() {
  const { sucursales } = useSucursales();
  const [filtroSucursal, setFiltroSucursal] = useState<string>('todas');
  const [filtroServicio, setFiltroServicio] = useState<string>('todos');

  const idSucursalNum = filtroSucursal !== 'todas' ? parseInt(filtroSucursal) : undefined;
  const idServicioNum = filtroServicio !== 'todos' ? parseInt(filtroServicio) : undefined;

  const { horarios, isLoading, loadHorarios, agregarHorario, actualizarHorario, eliminarHorario } =
    useHorariosServicio(idSucursalNum, idServicioNum);

  const { servicios } = useServicios(idSucursalNum);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [horarioActual, setHorarioActual] = useState<HorarioServicio | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [horarioAEliminar, setHorarioAEliminar] = useState<HorarioServicio | null>(null);
  const [formData, setFormData] = useState(formInicial);
  const [diasSeleccionados, setDiasSeleccionados] = useState<number[]>([1]);

  const toggleDia = (valor: number) => {
    setDiasSeleccionados(prev =>
      prev.includes(valor) ? prev.filter(d => d !== valor) : [...prev, valor]
    );
  };

  const handleNuevo = () => {
    const primerServicio = servicios.find(s => s.estado === 'activo');
    setFormData({ ...formInicial, id_servicio: primerServicio?.id_servicio || 0 });
    setDiasSeleccionados([1]);
    setIsEditing(false);
    setHorarioActual(null);
    setIsDialogOpen(true);
  };

  const handleEditar = (horario: HorarioServicio) => {
    setFormData({
      id_servicio: horario.id_servicio,
      hora_inicio: horario.hora_inicio.slice(0, 5),
      hora_fin: horario.hora_fin.slice(0, 5),
      duracion_consulta: horario.duracion_consulta,
      capacidad: horario.capacidad,
      estado: horario.estado
    });
    setDiasSeleccionados([horario.dia_semana]);
    setIsEditing(true);
    setHorarioActual(horario);
    setIsDialogOpen(true);
  };

  const handleGuardar = async () => {
    if (!formData.id_servicio) {
      toast.error('Debe seleccionar un servicio');
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
    if (formData.hora_fin <= formData.hora_inicio) {
      toast.error('La hora de fin debe ser mayor a la hora de inicio');
      return;
    }
    if (!formData.duracion_consulta || formData.duracion_consulta < 5 || formData.duracion_consulta > 480) {
      toast.error('La duración debe estar entre 5 y 480 minutos');
      return;
    }
    if (!formData.capacidad || formData.capacidad < 1) {
      toast.error('La capacidad debe ser al menos 1');
      return;
    }

    const datosBase = {
      id_servicio: formData.id_servicio,
      hora_inicio: formData.hora_inicio,
      hora_fin: formData.hora_fin,
      duracion_consulta: formData.duracion_consulta,
      capacidad: formData.capacidad,
      estado: formData.estado
    };

    if (isEditing && horarioActual) {
      const success = await actualizarHorario(horarioActual.id_horario_servicio, datosBase);
      if (success) {
        await loadHorarios();
        toast.success('Horario actualizado exitosamente');
        setIsDialogOpen(false);
      } else {
        toast.error('Error al actualizar el horario');
      }
    } else {
      const diasOrdenados = [...diasSeleccionados].sort((a, b) => a - b);
      const resultados = await Promise.all(
        diasOrdenados.map(dia => agregarHorario({ ...datosBase, dia_semana: dia }))
      );
      const creados = resultados.filter(Boolean).length;
      if (creados > 0) {
        await loadHorarios();
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

  const handleEliminarClick = (horario: HorarioServicio) => {
    setHorarioAEliminar(horario);
    setIsDeleteDialogOpen(true);
  };

  const handleEliminarConfirmar = async () => {
    if (!horarioAEliminar) return;
    const success = await eliminarHorario(horarioAEliminar.id_horario_servicio);
    if (success) {
      await loadHorarios();
      toast.success('Horario eliminado exitosamente');
      setIsDeleteDialogOpen(false);
      setHorarioAEliminar(null);
    } else {
      toast.error('Error al eliminar el horario. Puede tener citas asociadas.');
    }
  };

  const handleCambioSucursal = (value: string) => {
    setFiltroSucursal(value);
    setFiltroServicio('todos');
  };

  const serviciosActivos = servicios.filter(
    s => s.estado === 'activo' && s.descripcion.toUpperCase() !== 'CONSULTA EXTERNA'
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="flex items-center gap-2">
            <CalendarClock className="size-5" />
            Horarios de Servicios
          </h2>
          <p className="text-sm text-gray-600">Define horarios de disponibilidad por servicio</p>
        </div>
        <Button onClick={handleNuevo} disabled={serviciosActivos.length === 0}>
          <Plus className="size-4 mr-2" />
          Nuevo Horario
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Filtrar por Sucursal</Label>
            <Select value={filtroSucursal} onValueChange={handleCambioSucursal}>
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
            <Label className="text-xs">Filtrar por Servicio</Label>
            <Select value={filtroServicio} onValueChange={setFiltroServicio}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los servicios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los servicios</SelectItem>
                {serviciosActivos.map(s => (
                  <SelectItem key={s.id_servicio} value={s.id_servicio.toString()}>
                    {s.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {serviciosActivos.length === 0 && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <p className="text-sm text-yellow-800">
            ⚠️ Debes tener servicios registrados antes de crear horarios. Ve a la pestaña "Servicios" para agregar servicios.
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
                <TableHead>Servicio</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Día</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Capacidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {horarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No hay horarios de servicios registrados
                  </TableCell>
                </TableRow>
              ) : (
                [...horarios]
                  .sort((a, b) => {
                    const sucA = a.servicio?.sucursal?.nombre ?? sucursales.find(s => s.id_sucursal === a.servicio?.id_sucursal)?.nombre ?? '';
                    const sucB = b.servicio?.sucursal?.nombre ?? sucursales.find(s => s.id_sucursal === b.servicio?.id_sucursal)?.nombre ?? '';
                    if (sucA !== sucB) return sucA.localeCompare(sucB, 'es');
                    const srvA = a.servicio?.descripcion ?? '';
                    const srvB = b.servicio?.descripcion ?? '';
                    if (srvA !== srvB) return srvA.localeCompare(srvB, 'es');
                    return a.dia_semana - b.dia_semana;
                  })
                  .map((horario, index) => (
                  <TableRow key={horario.id_horario_servicio || `horario-${index}`}>
                    <TableCell className="font-semibold">
                      {horario.servicio?.descripcion ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{horario.servicio?.area ?? '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {horario.servicio?.sucursal?.nombre
                        ?? sucursales.find(s => s.id_sucursal === horario.servicio?.id_sucursal)?.nombre
                        ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatearDiaSemana(horario.dia_semana)}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {horario.hora_inicio?.slice(0, 5)} – {horario.hora_fin?.slice(0, 5)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{horario.duracion_consulta} min</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {horario.capacidad} {horario.capacidad === 1 ? 'cupo' : 'cupos'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={horario.estado === 'activo' ? 'default' : 'secondary'}>
                        {horario.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => handleEditar(horario)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEliminarClick(horario)}>
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
            <DialogTitle>{isEditing ? 'Editar Horario de Servicio' : 'Nuevo Horario de Servicio'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modifica los datos del horario'
                : 'Selecciona uno o varios días y define el horario del servicio'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Servicio *</Label>
              <Select
                value={formData.id_servicio.toString()}
                onValueChange={(value) => setFormData({ ...formData, id_servicio: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un servicio" />
                </SelectTrigger>
                <SelectContent>
                  {serviciosActivos.map(s => {
                    const nombreSucursal = s.sucursal?.nombre
                      ?? sucursales.find(su => su.id_sucursal === s.id_sucursal)?.nombre
                      ?? '';
                    return (
                      <SelectItem key={s.id_servicio} value={s.id_servicio.toString()}>
                        {s.descripcion} — {s.area}{nombreSucursal ? ` — ${nombreSucursal}` : ''}
                      </SelectItem>
                    );
                  })}
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
                  onChange={e => setFormData({ ...formData, hora_inicio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora Fin *</Label>
                <Input
                  type="time"
                  value={formData.hora_fin}
                  onChange={e => setFormData({ ...formData, hora_fin: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duración por turno (min) *</Label>
                <Input
                  type="number"
                  min="5"
                  max="480"
                  step="5"
                  value={formData.duracion_consulta}
                  onChange={e => setFormData({ ...formData, duracion_consulta: parseInt(e.target.value) || 30 })}
                />
                <p className="text-xs text-gray-500">Ej: 30, 45, 60 min</p>
              </div>
              <div className="space-y-2">
                <Label>Capacidad simultánea *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.capacidad}
                  onChange={e => setFormData({ ...formData, capacidad: parseInt(e.target.value) || 1 })}
                />
                <p className="text-xs text-gray-500">Pacientes por turno</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={formData.estado}
                onValueChange={(value: 'activo' | 'inactivo') => setFormData({ ...formData, estado: value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
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
              Esta acción eliminará el horario de{' '}
              <strong>{horarioAEliminar?.servicio?.descripcion}</strong> el día{' '}
              <strong>{horarioAEliminar ? formatearDiaSemana(horarioAEliminar.dia_semana) : ''}</strong>.
              Esta acción no se puede deshacer y puede fallar si existen citas asociadas.
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
