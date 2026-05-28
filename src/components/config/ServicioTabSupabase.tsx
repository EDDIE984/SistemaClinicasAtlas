// Tab de gestión de Servicios con Supabase
import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { BriefcaseMedical, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useServicios, useSucursales } from '../../hooks/useConfiguraciones';
import type { Servicio } from '../../lib/configuracionesService';

export function ServicioTabSupabase() {
  const { servicios, isLoading, agregarServicio, actualizarServicio, eliminarServicio } = useServicios();
  const { sucursales } = useSucursales();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [servicioActual, setServicioActual] = useState<Servicio | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [servicioAEliminar, setServicioAEliminar] = useState<Servicio | null>(null);

  const [formData, setFormData] = useState({
    id_sucursal: 0,
    descripcion: '',
    area: '',
    estado: 'activo'
  });

  const handleNuevo = () => {
    setFormData({
      id_sucursal: sucursales[0]?.id_sucursal || 0,
      descripcion: '',
      area: '',
      estado: 'activo'
    });
    setIsEditing(false);
    setServicioActual(null);
    setIsDialogOpen(true);
  };

  const handleEditar = (servicio: Servicio) => {
    setFormData({
      id_sucursal: servicio.id_sucursal,
      descripcion: servicio.descripcion,
      area: servicio.area,
      estado: servicio.estado
    });
    setIsEditing(true);
    setServicioActual(servicio);
    setIsDialogOpen(true);
  };

  const handleGuardar = async () => {
    if (!formData.id_sucursal) {
      toast.error('Debe seleccionar una sucursal');
      return;
    }

    if (!formData.area.trim()) {
      toast.error('El área es requerida');
      return;
    }

    if (!formData.descripcion.trim()) {
      toast.error('La descripción es requerida');
      return;
    }

    const datos = {
      id_sucursal: formData.id_sucursal,
      descripcion: formData.descripcion.trim(),
      area: formData.area.trim(),
      estado: formData.estado
    };

    if (isEditing && servicioActual) {
      const success = await actualizarServicio(servicioActual.id_servicio, datos);
      if (success) {
        toast.success('Servicio actualizado exitosamente');
        setIsDialogOpen(false);
      } else {
        toast.error('Error al actualizar el servicio');
      }
    } else {
      const nuevo = await agregarServicio(datos);
      if (nuevo) {
        toast.success('Servicio creado exitosamente');
        setIsDialogOpen(false);
      } else {
        toast.error('Error al crear el servicio');
      }
    }
  };

  const handleEliminarClick = (servicio: Servicio) => {
    setServicioAEliminar(servicio);
    setIsDeleteDialogOpen(true);
  };

  const handleEliminarConfirmar = async () => {
    if (!servicioAEliminar) return;

    const success = await eliminarServicio(servicioAEliminar.id_servicio);
    if (success) {
      toast.success('Servicio eliminado exitosamente');
      setIsDeleteDialogOpen(false);
      setServicioAEliminar(null);
    } else {
      toast.error('Error al eliminar el servicio. Puede tener registros asociados.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="flex items-center gap-2">
            <BriefcaseMedical className="size-5" />
            Gestión de Servicios
          </h2>
          <p className="text-sm text-gray-600">Administra los servicios disponibles por sucursal</p>
        </div>
        <Button onClick={handleNuevo} disabled={sucursales.length === 0}>
          <Plus className="size-4 mr-2" />
          Nuevo Servicio
        </Button>
      </div>

      {sucursales.length === 0 && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <p className="text-sm text-yellow-800">
            Primero debes crear al menos una sucursal antes de agregar servicios.
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
                <TableHead>Descripción</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No hay servicios registrados
                  </TableCell>
                </TableRow>
              ) : (
                servicios.map((servicio, index) => (
                  <TableRow key={servicio.id_servicio || `servicio-${index}`}>
                    <TableCell className="font-semibold max-w-sm truncate">{servicio.descripcion}</TableCell>
                    <TableCell>{servicio.area}</TableCell>
                    <TableCell>{servicio.sucursal?.nombre}</TableCell>
                    <TableCell>
                      <Badge variant={servicio.estado === 'activo' ? 'default' : 'secondary'}>
                        {servicio.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => handleEditar(servicio)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEliminarClick(servicio)}>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Modifica los datos del servicio' : 'Ingresa los datos del nuevo servicio'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sucursal *</Label>
              <Select
                value={formData.id_sucursal.toString()}
                onValueChange={(value) => setFormData({ ...formData, id_sucursal: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((sucursal) => (
                    <SelectItem key={sucursal.id_sucursal} value={sucursal.id_sucursal.toString()}>
                      {sucursal.nombre} ({sucursal.compania?.nombre})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Área *</Label>
              <Input
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                placeholder="Ej: Imagenología, Laboratorio, Consulta Externa"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Describe el servicio disponible"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={formData.estado} onValueChange={(value: string) => setFormData({ ...formData, estado: value })}>
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
              {isEditing ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el servicio "{servicioAEliminar?.descripcion}".
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
