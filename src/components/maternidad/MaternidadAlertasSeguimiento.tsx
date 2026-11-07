// Alertas rojas de seguimiento de parto (perfil maternidad): franja fija en todas las pantallas y panel
// con las mamás entre 20 y 40 semanas para llamar, actualizar semanas, registrar el parto o cerrar el seguimiento
import { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { AlertTriangle, Baby, Eye, Loader2, MessageCircle, Phone, Save } from 'lucide-react';
import { toast } from 'sonner';
import { mensajeErrorMaternidad, updateSemanasMaternidad } from '../../lib/maternidadService';
import type { MaternidadSolicitudVista } from '../../lib/supabaseTypes';
import { MaternidadPartoDialog } from './MaternidadPartoDialog';
import { MaternidadSolicitudDialog } from './MaternidadSolicitudDialog';
import { SEGUIMIENTO_TOUR, formatFechaCorta, formatSemanas, semanasHoy } from './maternidadUtils';

interface MaternidadAlertasBannerProps {
  alertas: MaternidadSolicitudVista[];
  proximas: number;
  sinSemanas: number;
  usuarioNombre: string;
  onRecargar: () => void;
  /** Abre la Bitácora de Tours con un filtro de seguimiento */
  onIrABitacora: (filtro: string) => void;
}

/** 0991234567 → 593991234567 para el enlace de WhatsApp */
const numeroWhatsApp = (telefono: string) => {
  const digitos = telefono.replace(/\D/g, '');
  return digitos.startsWith('0') ? `593${digitos.slice(1)}` : digitos;
};

export function MaternidadAlertasBanner({
  alertas,
  proximas,
  sinSemanas,
  usuarioNombre,
  onRecargar,
  onIrABitacora,
}: MaternidadAlertasBannerProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [semanasEditadas, setSemanasEditadas] = useState<Record<number, string>>({});
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [partoDe, setPartoDe] = useState<MaternidadSolicitudVista | null>(null);
  const [detalle, setDetalle] = useState<MaternidadSolicitudVista | null>(null);

  if (alertas.length === 0) return null;

  const texto = busqueda.trim().toLowerCase();
  const filtradas = texto
    ? alertas.filter(a => a.nombre_madre.toLowerCase().includes(texto) || (a.telefono || '').includes(texto))
    : alertas;
  const grupos = [
    { titulo: 'Próximas a dar a luz (37–40 semanas): llamar ahora', filas: filtradas.filter(a => a.estado_seguimiento === 'llamar') },
    { titulo: 'En seguimiento (20–36 semanas)', filas: filtradas.filter(a => a.estado_seguimiento === 'seguimiento') },
  ];

  const handleGuardarSemanas = async (alerta: MaternidadSolicitudVista) => {
    const semanas = Number(semanasEditadas[alerta.id_solicitud_mat]);
    if (!Number.isInteger(semanas) || semanas < 1 || semanas > 45) {
      toast.error('Las semanas deben ser un número entero entre 1 y 45');
      return;
    }
    setGuardandoId(alerta.id_solicitud_mat);
    try {
      await updateSemanasMaternidad(alerta.id_solicitud_mat, semanas, usuarioNombre);
      toast.success(`${alerta.nombre_madre}: ${semanas} semanas a hoy`);
      setSemanasEditadas(prev => {
        const copia = { ...prev };
        delete copia[alerta.id_solicitud_mat];
        return copia;
      });
      onRecargar();
    } catch (error) {
      toast.error(`No se pudieron actualizar las semanas: ${mensajeErrorMaternidad(error)}`);
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <>
      {/* Franja fija: no se puede cerrar, desaparece cuando no quedan alertas */}
      <div className="sticky top-0 z-30 bg-red-600 text-white shadow-md" role="alert">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 px-6 py-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-5 shrink-0" />
            <span>
              {alertas.length} {alertas.length === 1 ? 'mamá' : 'mamás'} en seguimiento de parto
              {proximas > 0 && <> · <strong>{proximas} {proximas === 1 ? 'próxima' : 'próximas'} a dar a luz (37–40 semanas)</strong></>}
            </span>
          </p>
          <Button size="sm" variant="outline" className="h-8 bg-white text-red-700 hover:bg-white" onClick={() => setAbierto(true)}>
            Ver alertas
          </Button>
        </div>
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="maternidad-dialog-ancho">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="size-4" />
              </span>
              Alertas de seguimiento de parto
            </DialogTitle>
            <DialogDescription>
              Mamás con tour realizado o proforma enviada que están entre 20 y 40 semanas y aún no registran parto.
              Con más de 40 semanas el seguimiento se cierra automáticamente.
            </DialogDescription>
          </DialogHeader>

          <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o teléfono" />

          <div className="space-y-4">
            {grupos.map(grupo => grupo.filas.length > 0 && (
              <div key={grupo.titulo} className="space-y-2">
                <h3 className="text-sm font-semibold text-red-700">{grupo.titulo} ({grupo.filas.length})</h3>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mamá</TableHead>
                        <TableHead>Contacto</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Semanas hoy</TableHead>
                        <TableHead>Actualizar semanas</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupo.filas.map(a => (
                        <TableRow key={a.id_solicitud_mat} className="bg-red-50">
                          <TableCell>
                            <p className="font-medium">{a.nombre_madre}</p>
                            <p className="text-xs text-gray-500">{a.medico_ginecologo || 'Sin médico registrado'}</p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {a.telefono ? (
                              <div className="flex gap-1">
                                <a href={`tel:${a.telefono}`} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
                                  <Phone className="size-3" />{a.telefono}
                                </a>
                                <a
                                  href={`https://wa.me/${numeroWhatsApp(a.telefono)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-green-700"
                                  title="Escribir por WhatsApp"
                                >
                                  <MessageCircle className="size-4" />
                                </a>
                              </div>
                            ) : <span className="text-xs text-gray-400">Sin teléfono</span>}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {a.estado === 'asistio'
                              ? `Tour #${a.numero_bitacora ?? '—'} · ${formatFechaCorta(a.fecha_tour)}`
                              : `Proforma ${a.ultima_cotizacion || ''}`}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="outline" className={SEGUIMIENTO_TOUR[a.estado_seguimiento].className}>
                              {formatSemanas(semanasHoy(a))}
                            </Badge>
                            {a.fecha_probable_parto && <p className="text-xs text-gray-500 mt-1">FPP {formatFechaCorta(a.fecha_probable_parto)}</p>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="1"
                                max="45"
                                className="h-8 w-20"
                                placeholder="Sem."
                                value={semanasEditadas[a.id_solicitud_mat] ?? ''}
                                onChange={e => setSemanasEditadas(prev => ({ ...prev, [a.id_solicitud_mat]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleGuardarSemanas(a)}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2"
                                disabled={!semanasEditadas[a.id_solicitud_mat] || guardandoId === a.id_solicitud_mat}
                                onClick={() => handleGuardarSemanas(a)}
                                title="Guardar las semanas que indica la mamá a hoy"
                              >
                                {guardandoId === a.id_solicitud_mat ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPartoDe(a)}>
                                <Baby className="size-3 mr-1" />Parto / cerrar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setAbierto(false); setDetalle(a); }}>
                                <Eye className="size-3 mr-1" />Detalle
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
            {filtradas.length === 0 && <p className="text-sm text-gray-500 text-center py-6">No hay alertas que coincidan con la búsqueda.</p>}
          </div>

          {sinSemanas > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span className="text-gray-600">
                {sinSemanas} {sinSemanas === 1 ? 'mamá' : 'mamás'} en seguimiento sin semanas registradas: no se puede calcular su alerta.
              </span>
              <Button size="sm" variant="outline" onClick={() => { setAbierto(false); onIrABitacora('sin_semanas'); }}>
                Ver en la Bitácora
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MaternidadPartoDialog
        solicitud={partoDe}
        usuarioNombre={usuarioNombre}
        onOpenChange={open => { if (!open) setPartoDe(null); }}
        onGuardado={onRecargar}
      />
      <MaternidadSolicitudDialog
        solicitud={detalle}
        onOpenChange={open => { if (!open) { setDetalle(null); setAbierto(true); } }}
        usuarioNombre={usuarioNombre}
        onAgendarTour={() => setDetalle(null)}
        onActualizado={onRecargar}
      />
    </>
  );
}
