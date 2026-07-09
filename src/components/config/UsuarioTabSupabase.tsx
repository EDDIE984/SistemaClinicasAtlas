// Tab de gestión de Usuarios con Supabase
import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Pencil, Trash2, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useUsuarios, formatearTipoUsuario, useCompanias, useSucursales, useServicios, useUsuarioSucursales } from '../../hooks/useConfiguraciones';
import type { Usuario, TipoUsuario, Sucursal, UsuarioSucursal } from '../../lib/configuracionesService';
import { createUsuarioSucursal, getUsuarioSucursalesByUsuario, updateUsuarioSucursalOrThrow } from '../../lib/configuracionesService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

export function UsuarioTabSupabase() {
  const { usuarios, isLoading, agregarUsuario, actualizarUsuario, eliminarUsuario } = useUsuarios();
  const { companias } = useCompanias();
  const { sucursales: todasSucursales } = useSucursales();
  const { asignaciones: asignacionesUsuarios } = useUsuarioSucursales();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null);
  const [usuarioSucursalActual, setUsuarioSucursalActual] = useState<UsuarioSucursal | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<Usuario | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    cedula: '',
    email: '',
    telefono: '',
    password: '',
    tipo_usuario: 'medico' as TipoUsuario,
    fecha_ingreso: new Date().toISOString().split('T')[0],
    estado: 'activo',
    id_compania: '',
    id_sucursal: '',
    id_servicio: '',
    especialidad: ''
  });

  const [sucursalesFiltradas, setSucursalesFiltradas] = useState<Sucursal[]>([]);
  const idSucursalSeleccionada = formData.id_sucursal ? parseInt(formData.id_sucursal) : undefined;
  const { servicios: serviciosSucursal } = useServicios(idSucursalSeleccionada);
  const { servicios: todosServicios } = useServicios();

  // Filtrar sucursales cuando cambia la compañía seleccionada
  useEffect(() => {
    if (formData.id_compania) {
      const filtered = todasSucursales.filter(
        s => s.id_compania.toString() === formData.id_compania
      );
      setSucursalesFiltradas(filtered);
      
      // Si la sucursal seleccionada no pertenece a la nueva compañía, resetear
      if (formData.id_sucursal) {
        const sucursalValida = filtered.find(s => s.id_sucursal.toString() === formData.id_sucursal);
        if (!sucursalValida) {
          setFormData(prev => ({ ...prev, id_sucursal: '', id_servicio: '' }));
        }
      }
    } else {
      setSucursalesFiltradas([]);
      setFormData(prev => ({ ...prev, id_sucursal: '', id_servicio: '' }));
    }
  }, [formData.id_compania, todasSucursales]);

  useEffect(() => {
    if (!formData.id_servicio || serviciosSucursal.length === 0) return;

    const servicioValido = serviciosSucursal.find(
      servicio => servicio.id_servicio.toString() === formData.id_servicio
    );

    if (!servicioValido) {
      setFormData(prev => ({ ...prev, id_servicio: '' }));
    }
  }, [formData.id_servicio, serviciosSucursal]);

  const getAsignacionPrincipal = (idUsuario: number) => {
    return asignacionesUsuarios.find(asignacion => asignacion.id_usuario === idUsuario && asignacion.estado === 'activo')
      || asignacionesUsuarios.find(asignacion => asignacion.id_usuario === idUsuario);
  };

  const getServicioAsignadoLabel = (idUsuario: number) => {
    const asignacion = getAsignacionPrincipal(idUsuario);
    if (!asignacion) return '-';

    const servicio = asignacion.servicio
      || todosServicios.find(item => item.id_servicio === asignacion.id_servicio);

    return servicio ? `${servicio.descripcion} (${servicio.area})` : '-';
  };

  const handleNuevo = () => {
    setFormData({
      nombre: '',
      apellido: '',
      cedula: '',
      email: '',
      telefono: '',
      password: '',
      tipo_usuario: 'medico',
      fecha_ingreso: new Date().toISOString().split('T')[0],
      estado: 'activo',
      id_compania: '',
      id_sucursal: '',
      id_servicio: '',
      especialidad: ''
    });
    setIsEditing(false);
    setUsuarioActual(null);
    setUsuarioSucursalActual(null);
    setSucursalesFiltradas([]);
    setIsDialogOpen(true);
  };

  const handleEditar = async (usuario: Usuario) => {
    const asignaciones = await getUsuarioSucursalesByUsuario(usuario.id_usuario);
    const asignacionPrincipal = asignaciones.find(asignacion => asignacion.estado === 'activo') || asignaciones[0] || null;

    setFormData({
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      cedula: usuario.cedula,
      email: usuario.email,
      telefono: usuario.telefono || '',
      password: '', // No mostramos la contraseña por seguridad
      tipo_usuario: usuario.tipo_usuario,
      fecha_ingreso: usuario.fecha_ingreso,
      estado: usuario.estado,
      id_compania: asignacionPrincipal?.sucursal?.id_compania?.toString() || '',
      id_sucursal: asignacionPrincipal?.id_sucursal?.toString() || '',
      id_servicio: asignacionPrincipal?.id_servicio?.toString() || '',
      especialidad: asignacionPrincipal?.especialidad || ''
    });
    setIsEditing(true);
    setUsuarioActual(usuario);
    setUsuarioSucursalActual(asignacionPrincipal);
    setSucursalesFiltradas(
      asignacionPrincipal?.sucursal?.id_compania
        ? todasSucursales.filter(s => s.id_compania === asignacionPrincipal.sucursal?.id_compania)
        : []
    );
    setIsDialogOpen(true);
  };

  const handleGuardar = async () => {
    if (!formData.nombre.trim() || !formData.apellido.trim() || !formData.email.trim() || !formData.cedula.trim()) {
      toast.error('Nombre, apellido, cédula y email son requeridos');
      return;
    }

    if (!isEditing && !formData.password.trim()) {
      toast.error('La contraseña es requerida para usuarios nuevos');
      return;
    }

    if (!formData.id_compania || !formData.id_sucursal) {
      toast.error('Compañía y sucursal son requeridos');
      return;
    }

    if ((formData.tipo_usuario === 'USUARIO_IMANGE' || formData.tipo_usuario === 'USUARIO_IMAGEN') && !formData.id_servicio) {
      toast.error('Debe seleccionar un servicio para Usuario Imagen');
      return;
    }

    const datos: any = {
      nombre: formData.nombre.trim(),
      apellido: formData.apellido.trim(),
      cedula: formData.cedula.trim(),
      email: formData.email.trim(),
      telefono: formData.telefono.trim() || null,
      tipo_usuario: formData.tipo_usuario,
      fecha_ingreso: formData.fecha_ingreso,
      estado: formData.estado
    };

    // Solo incluir password si se está creando o si se ingresó una nueva
    if (!isEditing || formData.password.trim()) {
      datos.password = formData.password.trim();
    }

    if (isEditing && usuarioActual) {
      const success = await actualizarUsuario(usuarioActual.id_usuario, datos);
      if (success) {
        try {
          const asignacionesActuales = usuarioSucursalActual
            ? [usuarioSucursalActual]
            : await getUsuarioSucursalesByUsuario(usuarioActual.id_usuario);
          const asignacionParaActualizar = asignacionesActuales.find(
            asignacion => asignacion.id_sucursal === parseInt(formData.id_sucursal)
          ) || asignacionesActuales[0] || null;

          const datosAsignacion = {
            id_usuario: usuarioActual.id_usuario,
            id_sucursal: parseInt(formData.id_sucursal),
            id_servicio: formData.id_servicio ? parseInt(formData.id_servicio) : null,
            especialidad: formData.especialidad.trim() || null,
            cargo: asignacionParaActualizar?.cargo || null,
            id_especialidad: asignacionParaActualizar?.id_especialidad || null,
            estado: asignacionParaActualizar?.estado || 'activo' as 'activo' | 'inactivo'
          };

          if (asignacionParaActualizar) {
            await updateUsuarioSucursalOrThrow(asignacionParaActualizar.id_usuario_sucursal, datosAsignacion);
          } else {
            const nuevaAsignacion = await createUsuarioSucursal(datosAsignacion);
            if (!nuevaAsignacion) throw new Error('No se pudo crear la asignación usuario-sucursal');
          }

          toast.success('Usuario actualizado exitosamente');
          setIsDialogOpen(false);
        } catch (error: any) {
          toast.error(error.message || 'Usuario actualizado, pero no se pudo guardar el servicio asignado');
        }
      } else {
        toast.error('Error al actualizar el usuario');
      }
    } else {
      try {
        // Crear el usuario
        const nuevo = await agregarUsuario(datos);
        if (nuevo) {
          // Crear la asignación usuario-sucursal
          const asignacion = await createUsuarioSucursal({
            id_usuario: nuevo.id_usuario,
            id_sucursal: parseInt(formData.id_sucursal),
            id_servicio: formData.id_servicio ? parseInt(formData.id_servicio) : null,
            especialidad: formData.especialidad.trim() || null,
            cargo: null,
            estado: 'activo'
          });

          if (asignacion) {
            toast.success('Usuario y asignación creados exitosamente');
            setIsDialogOpen(false);
          } else {
            toast.warning('Usuario creado pero hubo un error al crear la asignación');
            setIsDialogOpen(false);
          }
        }
      } catch (error: any) {
        // Mostrar el mensaje de error específico
        toast.error(error.message || 'Error al crear el usuario');
      }
    }
  };

  const handleEliminarClick = (usuario: Usuario) => {
    setUsuarioAEliminar(usuario);
    setIsDeleteDialogOpen(true);
  };

  const handleEliminarConfirmar = async () => {
    if (!usuarioAEliminar) return;

    const success = await eliminarUsuario(usuarioAEliminar.id_usuario);
    if (success) {
      toast.success('Usuario eliminado exitosamente');
      setIsDeleteDialogOpen(false);
      setUsuarioAEliminar(null);
    } else {
      toast.error('Error al eliminar el usuario. Puede tener registros asociados.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="flex items-center gap-2">
            <Users className="size-5" />
            Gestión de Usuarios
          </h2>
          <p className="text-sm text-gray-600">Administra los usuarios del sistema</p>
        </div>
        <Button onClick={handleNuevo}>
          <Plus className="size-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No hay usuarios registrados
                  </TableCell>
                </TableRow>
              ) : (
                usuarios.map((usuario, index) => (
                  <TableRow key={usuario.id_usuario || `usuario-${index}`}>
                    <TableCell className="font-semibold">
                      {usuario.nombre} {usuario.apellido}
                    </TableCell>
                    <TableCell>{usuario.cedula}</TableCell>
                    <TableCell>{usuario.email}</TableCell>
                    <TableCell>{usuario.telefono || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatearTipoUsuario(usuario.tipo_usuario)}
                      </Badge>
                    </TableCell>
                    <TableCell>{getServicioAsignadoLabel(usuario.id_usuario)}</TableCell>
                    <TableCell>
                      <Badge variant={usuario.estado === 'activo' ? 'default' : 'secondary'}>
                        {usuario.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => handleEditar(usuario)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEliminarClick(usuario)}>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Modifica los datos del usuario' : 'Ingresa los datos del nuevo usuario'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre"
                />
              </div>

              <div className="space-y-2">
                <Label>Apellido *</Label>
                <Input
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  placeholder="Apellido"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cédula *</Label>
                <Input
                  value={formData.cedula}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  placeholder="Cédula de identidad"
                  disabled={isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@ejemplo.com"
                  disabled={isEditing}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="Teléfono"
                />
              </div>

              <div className="space-y-2">
                <Label>Contraseña {isEditing ? '' : '*'}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={isEditing ? 'Dejar vacío para mantener actual' : 'Contraseña'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Usuario *</Label>
                <Select
                  value={formData.tipo_usuario}
                  onValueChange={(value: TipoUsuario) => setFormData({ ...formData, tipo_usuario: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medico">Médico</SelectItem>
                    <SelectItem value="administrativo">Administrativo</SelectItem>
                    <SelectItem value="enfermera">Enfermera</SelectItem>
                    <SelectItem value="secretaria">Secretaria</SelectItem>
                    <SelectItem value="USUARIO_IMANGE">Usuario Imagen</SelectItem>
                    <SelectItem value="GESTOR_IMAGEN">Gestor Imagen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fecha de Ingreso *</Label>
                <Input
                  type="date"
                  value={formData.fecha_ingreso}
                  onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={formData.estado} onValueChange={(value) => setFormData({ ...formData, estado: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Compañía *</Label>
                <Select
                  value={formData.id_compania}
                  onValueChange={(value) => setFormData({ ...formData, id_compania: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una compañía" />
                  </SelectTrigger>
                  <SelectContent>
                    {companias.map((compania) => (
                      <SelectItem key={compania.id_compania} value={compania.id_compania.toString()}>
                        {compania.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sucursal *</Label>
                <Select
                  value={formData.id_sucursal}
                  onValueChange={(value) => setFormData({ ...formData, id_sucursal: value, id_servicio: '' })}
                  disabled={!formData.id_compania}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursalesFiltradas.map((sucursal) => (
                      <SelectItem key={sucursal.id_sucursal} value={sucursal.id_sucursal.toString()}>
                        {sucursal.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.tipo_usuario !== 'GESTOR_IMAGEN' && (
              <div className="space-y-2">
                <Label>Servicio {(formData.tipo_usuario === 'USUARIO_IMANGE' || formData.tipo_usuario === 'USUARIO_IMAGEN') ? '*' : ''}</Label>
                <Select
                  value={formData.id_servicio}
                  onValueChange={(value) => setFormData({ ...formData, id_servicio: value })}
                  disabled={!formData.id_sucursal || serviciosSucursal.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un servicio (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviciosSucursal.map((servicio) => (
                      <SelectItem key={servicio.id_servicio} value={servicio.id_servicio.toString()}>
                        {servicio.descripcion} ({servicio.area})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Especialidad</Label>
              <Input
                value={formData.especialidad}
                onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })}
                placeholder="Ej: Medicina General, Cardiología, etc."
              />
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

      {/* Dialog: Confirmar Eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará al usuario "{usuarioAEliminar?.nombre} {usuarioAEliminar?.apellido}".
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
