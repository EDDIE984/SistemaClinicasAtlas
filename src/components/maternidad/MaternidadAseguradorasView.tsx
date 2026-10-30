// Configuración de aseguradoras del módulo Maternidad (el chatbot solo ofrece las activas)
import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { FileText, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAseguradorasMaternidad } from '../../hooks/useMaternidad';
import type { MaternidadAseguradora } from '../../lib/supabaseTypes';
import { MaternidadCotizacionConfigDialog } from './MaternidadCotizacionConfigDialog';

export function MaternidadAseguradorasView() {
  const { aseguradoras, isLoading, loadAseguradoras, crearAseguradora, actualizarAseguradora, eliminarAseguradora } =
    useAseguradorasMaternidad();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [actual, setActual] = useState<MaternidadAseguradora | null>(null);
  const [aEliminar, setAEliminar] = useState<MaternidadAseguradora | null>(null);
  const [aConfigurar, setAConfigurar] = useState<MaternidadAseguradora | null>(null);
  const [nombre, setNombre] = useState('');
  const [orden, setOrden] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const handleNuevo = () => {
    setActual(null);
    setNombre('');
    setOrden((aseguradoras.reduce((max, a) => Math.max(max, a.orden), 0) || 0) + 1);
    setIsDialogOpen(true);
  };

  const handleEditar = (aseguradora: MaternidadAseguradora) => {
    setActual(aseguradora);
    setNombre(aseguradora.nombre);
    setOrden(aseguradora.orden);
    setIsDialogOpen(true);
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) return toast.error('Ingrese el nombre de la aseguradora');
    setIsSaving(true);
    try {
      if (actual) {
        await actualizarAseguradora(actual.id_aseguradora_mat, { nombre, orden });
        toast.success('Aseguradora actualizada');
      } else {
        await crearAseguradora({ nombre, orden, estado: 'activo' });
        toast.success('Aseguradora creada');
      }
      await loadAseguradoras();
      setIsDialogOpen(false);
    } catch {
      toast.error('Error al guardar. Verifique que el nombre no esté repetido.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEstado = async (aseguradora: MaternidadAseguradora, activo: boolean) => {
    try {
      await actualizarAseguradora(aseguradora.id_aseguradora_mat, { estado: activo ? 'activo' : 'inactivo' });
      await loadAseguradoras();
    } catch {
      toast.error('Error al cambiar el estado');
    }
  };

  const handleEliminar = async () => {
    if (!aEliminar) return;
    try {
      await eliminarAseguradora(aEliminar.id_aseguradora_mat);
      toast.success('Aseguradora eliminada');
      await loadAseguradoras();
    } catch {
      toast.error('No se puede eliminar: tiene solicitudes asociadas. Desactívela en su lugar.');
    } finally {
      setAEliminar(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Aseguradoras de Maternidad
          </h2>
          <p className="text-sm text-gray-600">El chatbot y el formulario solo ofrecen las aseguradoras activas</p>
        </div>
        <Button onClick={handleNuevo}>
          <Plus className="size-4 mr-2" />
          Nueva aseguradora
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Aseguradora</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cotización</TableHead>
                <TableHead>Activa</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aseguradoras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">No hay aseguradoras registradas</TableCell>
                </TableRow>
              ) : (
                aseguradoras.map(a => (
                  <TableRow key={a.id_aseguradora_mat}>
                    <TableCell>{a.orden}</TableCell>
                    <TableCell className="font-semibold">{a.nombre}</TableCell>
                    <TableCell>
                      <Badge variant={a.estado === 'activo' ? 'default' : 'secondary'}>{a.estado === 'activo' ? 'Activo' : 'Inactivo'}</Badge>
                    </TableCell>
                    <TableCell>
                      {a.config_cotizacion?.presupuesto?.procedimientos?.length ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                          {a.config_cotizacion.presupuesto.procedimientos.length} procedimiento(s)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">Genérica</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={a.estado === 'activo'} onCheckedChange={v => handleToggleEstado(a, v)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setAConfigurar(a)} title="Configurar valores de la cotización">
                          <FileText className="size-4 mr-1" /> Cotización
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEditar(a)}><Pencil className="size-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setAEliminar(a)}><Trash2 className="size-4 text-red-600" /></Button>
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
            <DialogTitle>{actual ? 'Editar aseguradora' : 'Nueva aseguradora'}</DialogTitle>
            <DialogDescription>Nombre tal como se mostrará a las pacientes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input type="number" min="0" value={orden} onChange={e => setOrden(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={isSaving}>
              {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
              {actual ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MaternidadCotizacionConfigDialog
        aseguradora={aConfigurar}
        aseguradoras={aseguradoras}
        onOpenChange={open => { if (!open) setAConfigurar(null); }}
        onGuardado={loadAseguradoras}
      />

      <AlertDialog open={!!aEliminar} onOpenChange={open => { if (!open) setAEliminar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar aseguradora?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{aEliminar?.nombre}</strong>. Si tiene solicitudes asociadas no se podrá eliminar; desactívela en su lugar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminar} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
