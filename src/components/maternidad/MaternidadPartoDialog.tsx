// Seguimiento del parto: si la mamá dio a luz en la clínica (fecha, tipo y observación) o se cierra el seguimiento
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Baby, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  RESULTADOS_PARTO_MATERNIDAD,
  TIPOS_PARTO_MATERNIDAD,
  mensajeErrorMaternidad,
  updatePartoSolicitudMaternidad,
} from '../../lib/maternidadService';
import type { MaternidadSolicitud, ResultadoPartoMaternidad, TipoPartoMaternidad } from '../../lib/supabaseTypes';
import { fechaHoyEcuadorISO } from './maternidadUtils';

interface MaternidadPartoDialogProps {
  solicitud: Pick<
    MaternidadSolicitud,
    'id_solicitud_mat' | 'nombre_madre' | 'resultado_parto' | 'fecha_parto' | 'tipo_parto' | 'observacion_parto'
  > | null;
  usuarioNombre: string;
  onOpenChange: (open: boolean) => void;
  onGuardado: (solicitud: MaternidadSolicitud) => void;
}

const tarjeta = (activa: boolean) =>
  `rounded-lg border p-3 text-left transition-colors ${activa ? 'border-blue-600 bg-blue-50' : 'hover:bg-gray-50'}`;

export function MaternidadPartoDialog({ solicitud, usuarioNombre, onOpenChange, onGuardado }: MaternidadPartoDialogProps) {
  const [resultado, setResultado] = useState<ResultadoPartoMaternidad>('pendiente');
  const [fecha, setFecha] = useState('');
  const [tipo, setTipo] = useState<TipoPartoMaternidad | ''>('');
  const [observacion, setObservacion] = useState('');
  const [isGuardando, setIsGuardando] = useState(false);

  // Se carga solo al abrir (la solicitud del padre puede cambiar de referencia en cada render)
  const idAbierta = solicitud?.id_solicitud_mat;
  useEffect(() => {
    if (!solicitud) return;
    setResultado(solicitud.resultado_parto || 'pendiente');
    setFecha(solicitud.fecha_parto || '');
    setTipo(solicitud.tipo_parto || '');
    setObservacion(solicitud.observacion_parto || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAbierta]);

  if (!solicitud) return null;

  const enClinica = resultado === 'clinica';

  const handleGuardar = async () => {
    if (enClinica) {
      if (!fecha) return toast.error('Ingrese la fecha del parto');
      if (fecha > fechaHoyEcuadorISO()) return toast.error('La fecha del parto no puede ser futura');
      if (!tipo) return toast.error('Seleccione el tipo de parto');
    }
    if (resultado === 'perdida' && !observacion.trim()) return toast.error('Indique el motivo del cierre del seguimiento');
    setIsGuardando(true);
    try {
      const guardada = await updatePartoSolicitudMaternidad(solicitud.id_solicitud_mat, {
        resultado_parto: resultado,
        fecha_parto: fecha || null,
        tipo_parto: tipo || null,
        observacion_parto: observacion || null,
      }, usuarioNombre);
      toast.success('Seguimiento del parto guardado');
      onGuardado(guardada);
      onOpenChange(false);
    } catch (error) {
      toast.error(`No se pudo guardar el seguimiento: ${mensajeErrorMaternidad(error)}`);
    } finally {
      setIsGuardando(false);
    }
  };

  return (
    <Dialog open={!!solicitud} onOpenChange={onOpenChange}>
      <DialogContent className="maternidad-dialog-medio maternidad-dialog-secundario">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Baby className="size-4" />
            </span>
            Seguimiento del parto
          </DialogTitle>
          <DialogDescription>{solicitud.nombre_madre} · ¿dio a luz en la clínica?</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {RESULTADOS_PARTO_MATERNIDAD.map(r => (
              <button key={r.value} type="button" onClick={() => setResultado(r.value)} className={tarjeta(resultado === r.value)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{r.label}</span>
                  {resultado === r.value && <Check className="size-4 text-blue-600" />}
                </div>
                <p className="text-xs text-gray-500 mt-1">{r.descripcion}</p>
              </button>
            ))}
          </div>

          {enClinica && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border p-3">
              <div className="space-y-2">
                <Label>Fecha del parto *</Label>
                <Input type="date" max={fechaHoyEcuadorISO()} value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de parto *</Label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_PARTO_MATERNIDAD.map(t => (
                    <Button
                      key={t.value}
                      type="button"
                      size="sm"
                      variant={tipo === t.value ? 'default' : 'outline'}
                      onClick={() => setTipo(t.value)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {resultado !== 'pendiente' && (
            <div className="space-y-2">
              <Label>{resultado === 'perdida' ? 'Motivo del cierre *' : 'Observación'}</Label>
              <Textarea
                rows={2}
                value={observacion}
                onChange={e => setObservacion(e.target.value)}
                placeholder={resultado === 'perdida' ? 'Ej.: dio a luz en otra clínica, no contesta las llamadas' : 'Detalle del parto'}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGuardando}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={isGuardando}>
            {isGuardando && <Loader2 className="size-4 mr-2 animate-spin" />}
            Guardar seguimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
