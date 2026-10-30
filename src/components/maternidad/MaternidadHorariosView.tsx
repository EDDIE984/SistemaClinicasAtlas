// Configuración de turnos de tours de maternidad (día, hora y cupo)
import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { CalendarClock, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useHorariosMaternidad } from '../../hooks/useMaternidad';
import type { MaternidadHorario } from '../../lib/supabaseTypes';
import { DIAS_SEMANA_MATERNIDAD, nombreDiaSemana } from './maternidadUtils';

const formInicial = {
  hora_inicio: '09:00',
  hora_fin: '10:00',
  cupo: 1,
  estado: 'activo' as 'activo' | 'inactivo',
};

export function MaternidadHorariosView() {
  const { horarios, isLoading, loadHorarios, crearHorario, actualizarHorario, eliminarHorario } = useHorariosMaternidad();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [horarioActual, setHorarioActual] = useState<MaternidadHorario | null>(null);
  const [horarioAEliminar, setHorarioAEliminar] = useState<MaternidadHorario | null>(null);
  const [formData, setFormData] = useState(formInicial);
  const [diasSeleccionados, setDiasSeleccionados] = useState<number[]>([1]);
  const [isSaving, setIsSaving] = useState(false);

  const toggleDia = (valor: number) =>
    setDiasSeleccionados(prev => (prev.includes(valor) ? prev.filter(d => d !== valor) : [...prev, valor]));

  const handleNuevo = () => {
    setFormData(formInicial);
    setDiasSeleccionados([1, 2, 3, 4, 5]);
    setHorarioActual(null);
    setIsDialogOpen(true);
  };

  const handleEditar = (horario: MaternidadHorario) => {
    setFormData({
      hora_inicio: horario.hora_inicio.slice(0, 5),
      hora_fin: horario.hora_fin.slice(0, 5),
      cupo: horario.cupo,
      estado: horario.estado,
    });
    setDiasSeleccionados([horario.dia_semana]);
    setHorarioActual(horario);
    setIsDialogOpen(true);
  };

  const handleGuardar = async () => {
    if (!horarioActual && diasSeleccionados.length === 0) return toast.error('Seleccione al menos un día');
    if (!formData.hora_inicio || !formData.hora_fin) return toast.error('Especifique hora de inicio y fin');
    if (formData.hora_fin <= formData.hora_inicio) return toast.error('La hora de fin debe ser mayor a la de inicio');
    if (!formData.cupo || formData.cupo < 1) return toast.error('El cupo debe ser al menos 1');

    setIsSaving(true);
    try {
      if (horarioActual) {
        await actualizarHorario(horarioActual.id_horario_mat, formData);
        toast.success('Turno actualizado');
      } else {
        const resultados = await Promise.allSettled(
          [...diasSeleccionados].sort().map(dia => crearHorario({ ...formData, dia_semana: dia })),
        );
        const creados = resultados.filter(r => r.status === 'fulfilled').length;
        const fallidos = resultados.length - creados;
        if (creados > 0) toast.success(creados === 1 ? 'Turno creado' : `${creados} turnos creados`);
        if (fallidos > 0) toast.error(`${fallidos} turno(s) no se crearon: ya existe un turno a esa hora`);
      }
      await loadHorarios();
      setIsDialogOpen(false);
    } catch {
      toast.error('Error al guardar el turno. Verifique que no exista otro turno a la misma hora.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEliminar = async () => {
    if (!horarioAEliminar) return;
    try {
      await eliminarHorario(horarioAEliminar.id_horario_mat);
      toast.success('Turno eliminado');
      await loadHorarios();
    } catch {
      toast.error('No se puede eliminar: el turno tiene tours asociados. Desactívelo en su lugar.');
    } finally {
      setHorarioAEliminar(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="flex items-center gap-2">
            <CalendarClock className="size-5" />
            Horarios de Tours de Maternidad
          </h2>
          <p className="text-sm text-gray-600">Turnos disponibles por día de la semana y cupo máximo por turno</p>
        </div>
        <Button onClick={handleNuevo}>
          <Plus className="size-4 mr-2" />
          Nuevo turno
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DIAS_SEMANA_MATERNIDAD.map(dia => {
            const turnos = horarios.filter(h => h.dia_semana === dia.valor);
            if (turnos.length === 0) return null;
            return (
              <Card key={dia.valor}>
                <div className="p-3 border-b font-medium">{dia.nombre}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Turno</TableHead>
                      <TableHead>Cupo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {turnos.map(h => (
                      <TableRow key={h.id_horario_mat}>
                        <TableCell className="font-mono text-sm">{h.hora_inicio.slice(0, 5)} – {h.hora_fin.slice(0, 5)}</TableCell>
                        <TableCell><Badge variant="secondary">{h.cupo} {h.cupo === 1 ? 'cupo' : 'cupos'}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={h.estado === 'activo' ? 'default' : 'secondary'}>{h.estado === 'activo' ? 'Activo' : 'Inactivo'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => handleEditar(h)}><Pencil className="size-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => setHorarioAEliminar(h)}><Trash2 className="size-4 text-red-600" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            );
          })}
          {horarios.length === 0 && (
            <Card className="p-8 text-center text-gray-500">No hay turnos configurados</Card>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{horarioActual ? 'Editar turno' : 'Nuevo turno'}</DialogTitle>
            <DialogDescription>
              {horarioActual ? 'Modifica la hora, el cupo o el estado del turno' : 'Selecciona uno o varios días y define el turno'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{horarioActual ? 'Día' : 'Días *'}</Label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA_MATERNIDAD.map(dia => (
                  <Button
                    key={dia.valor}
                    type="button"
                    size="sm"
                    variant={diasSeleccionados.includes(dia.valor) ? 'default' : 'outline'}
                    disabled={!!horarioActual}
                    onClick={() => toggleDia(dia.valor)}
                    className="min-w-[46px]"
                  >
                    {dia.abrev}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora inicio *</Label>
                <Input type="time" value={formData.hora_inicio} onChange={e => setFormData({ ...formData, hora_inicio: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Hora fin *</Label>
                <Input type="time" value={formData.hora_fin} onChange={e => setFormData({ ...formData, hora_fin: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cupo por turno *</Label>
                <Input type="number" min="1" value={formData.cupo} onChange={e => setFormData({ ...formData, cupo: parseInt(e.target.value) || 1 })} />
                <p className="text-xs text-gray-500">Reservas por turno (1 = un tour por turno)</p>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={formData.estado} onValueChange={(v: 'activo' | 'inactivo') => setFormData({ ...formData, estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={isSaving}>
              {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
              {horarioActual ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!horarioAEliminar} onOpenChange={open => { if (!open) setHorarioAEliminar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar turno?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el turno del <strong>{horarioAEliminar ? nombreDiaSemana(horarioAEliminar.dia_semana) : ''}</strong> a las{' '}
              <strong>{horarioAEliminar?.hora_inicio.slice(0, 5)}</strong>. Si tiene tours asociados no se podrá eliminar; desactívelo en su lugar.
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
