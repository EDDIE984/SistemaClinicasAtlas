// Configuración del presupuesto de maternidad por aseguradora (config_cotizacion.presupuesto).
// El PDF que se envía a la paciente se arma con estos valores sobre la hoja membretada.
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Copy, Eye, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAseguradoraMaternidadById, updateAseguradoraMaternidad, vistaPreviaPresupuestoMaternidad } from '../../lib/maternidadService';
import type { ConfigPresupuestoMaternidad, MaternidadAseguradora } from '../../lib/supabaseTypes';
import { formatearUSD } from './maternidadUtils';

interface MaternidadCotizacionConfigDialogProps {
  aseguradora: MaternidadAseguradora | null;
  /** Todas las aseguradoras, para copiar la configuración de otra */
  aseguradoras: MaternidadAseguradora[];
  onOpenChange: (open: boolean) => void;
  onGuardado: () => void;
}

// En el formulario los números se manejan como texto para permitir campos vacíos
interface HonorarioForm { concepto: string; valor: string }
interface ProcedimientoForm {
  procedimiento: string;
  internacion: string;
  clinica: string;
  abono: string;
  incluye: string;
  notas: string;
  honorarios: HonorarioForm[];
}
interface AdicionalForm { grupo: string; concepto: string; valor: string }
interface PresupuestoForm {
  procedimientos: ProcedimientoForm[];
  adicionales: AdicionalForm[];
  firma: { nombre: string; cargo: string; telefono: string };
  especialidad: string;
}

const PROCEDIMIENTO_VACIO: ProcedimientoForm = {
  procedimiento: '',
  internacion: '',
  clinica: '',
  abono: '',
  incluye: '',
  notas: '',
  honorarios: [{ concepto: 'HONORARIOS MÉDICO CIRUJANO', valor: '' }],
};

const FORM_VACIO: PresupuestoForm = {
  procedimientos: [],
  adicionales: [],
  firma: { nombre: '', cargo: 'Presupuestos', telefono: '' },
  especialidad: 'GINECÓLOGO',
};

const aTexto = (valor: number | null | undefined) => (valor === null || valor === undefined ? '' : String(valor));
const aNumero = (valor: string) => {
  const limpio = valor.trim().replace(',', '.');
  return limpio === '' ? null : Number(limpio);
};
const lineas = (texto: string) => texto.split('\n').map(l => l.trim()).filter(Boolean);

// Las cotizaciones de maternidad son siempre estas dos (una página del PDF cada una)
const PROCEDIMIENTOS_FIJOS = ['CESÁREA', 'PARTO NORMAL'];
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

function aFormulario(config?: ConfigPresupuestoMaternidad | null): PresupuestoForm {
  const guardados = config?.procedimientos || [];
  return {
    procedimientos: PROCEDIMIENTOS_FIJOS.map(nombre => {
      const p = guardados.find(g => normalizar(g.procedimiento || '') === normalizar(nombre));
      if (!p) return { ...PROCEDIMIENTO_VACIO, procedimiento: nombre, honorarios: [...PROCEDIMIENTO_VACIO.honorarios] };
      return {
      procedimiento: nombre,
      internacion: p.internacion || '',
      clinica: aTexto(p.clinica),
      abono: aTexto(p.abono),
      incluye: (p.incluye || []).join('\n'),
      notas: (p.notas || []).join('\n'),
      honorarios: (p.honorarios || []).map(h => ({ concepto: h.concepto, valor: aTexto(h.valor) })),
      };
    }),
    adicionales: (config?.adicionales || []).map(a => ({ grupo: a.grupo || '', concepto: a.concepto, valor: aTexto(a.valor) })),
    firma: { ...FORM_VACIO.firma, ...(config?.firma || {}) },
    especialidad: config?.especialidad || 'GINECÓLOGO',
  };
}

function aConfig(form: PresupuestoForm): ConfigPresupuestoMaternidad {
  return {
    especialidad: form.especialidad.trim() || 'GINECÓLOGO',
    firma: { nombre: form.firma.nombre.trim(), cargo: form.firma.cargo.trim(), telefono: form.firma.telefono.trim() },
    adicionales: form.adicionales
      .filter(a => a.concepto.trim())
      .map(a => ({ concepto: a.concepto.trim(), valor: aNumero(a.valor) ?? 0, ...(a.grupo.trim() ? { grupo: a.grupo.trim() } : {}) })),
    procedimientos: form.procedimientos.map(p => ({
      procedimiento: p.procedimiento.trim().toUpperCase(),
      internacion: p.internacion.trim().toUpperCase(),
      clinica: aNumero(p.clinica) ?? 0,
      abono: aNumero(p.abono),
      incluye: lineas(p.incluye),
      notas: lineas(p.notas),
      honorarios: p.honorarios
        .filter(h => h.concepto.trim())
        .map(h => ({ concepto: h.concepto.trim().toUpperCase(), valor: aNumero(h.valor) })),
    })),
  };
}

const totalProcedimiento = (p: ProcedimientoForm) =>
  (aNumero(p.clinica) || 0) + p.honorarios.reduce((suma, h) => suma + (aNumero(h.valor) || 0), 0);

export function MaternidadCotizacionConfigDialog({ aseguradora, aseguradoras, onOpenChange, onGuardado }: MaternidadCotizacionConfigDialogProps) {
  const [form, setForm] = useState<PresupuestoForm>(FORM_VACIO);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  // Valores leídos de la base al abrir (la lista de la pantalla puede estar desactualizada)
  const [actual, setActual] = useState<MaternidadAseguradora | null>(null);
  const [isCargando, setIsCargando] = useState(false);

  useEffect(() => {
    if (!aseguradora) {
      setActual(null);
      return;
    }
    let cancelado = false;
    setIsCargando(true);
    (async () => {
      try {
        const fresca = await getAseguradoraMaternidadById(aseguradora.id_aseguradora_mat);
        if (cancelado) return;
        setActual(fresca);
        setForm(aFormulario(fresca.config_cotizacion?.presupuesto));
      } catch {
        if (!cancelado) {
          toast.error('No se pudieron cargar los valores de la cotización');
          onOpenChange(false);
        }
      } finally {
        if (!cancelado) setIsCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [aseguradora]);

  if (!aseguradora) return null;

  const otrasConPresupuesto = aseguradoras.filter(
    a => a.id_aseguradora_mat !== aseguradora.id_aseguradora_mat && a.config_cotizacion?.presupuesto?.procedimientos?.length,
  );

  const setProcedimiento = (indice: number, cambios: Partial<ProcedimientoForm>) =>
    setForm(prev => ({ ...prev, procedimientos: prev.procedimientos.map((p, i) => (i === indice ? { ...p, ...cambios } : p)) }));

  const setHonorario = (indice: number, h: number, cambios: Partial<HonorarioForm>) =>
    setProcedimiento(indice, {
      honorarios: form.procedimientos[indice].honorarios.map((x, j) => (j === h ? { ...x, ...cambios } : x)),
    });

  const setAdicional = (indice: number, cambios: Partial<AdicionalForm>) =>
    setForm(prev => ({ ...prev, adicionales: prev.adicionales.map((a, i) => (i === indice ? { ...a, ...cambios } : a)) }));

  const handleCopiar = (idOrigen: string) => {
    const origen = aseguradoras.find(a => a.id_aseguradora_mat.toString() === idOrigen);
    if (!origen?.config_cotizacion?.presupuesto) return;
    setForm(aFormulario(origen.config_cotizacion.presupuesto));
    toast.info(`Valores copiados de ${origen.nombre}. Revíselos y guarde para aplicarlos.`);
  };

  const validar = (): string | null => {
    for (const p of form.procedimientos) {
      const clinica = aNumero(p.clinica);
      if (clinica === null || isNaN(clinica) || clinica < 0) return `Ingrese el valor de clínica de ${p.procedimiento}`;
      if (p.abono && isNaN(aNumero(p.abono) as number)) return `El abono de ${p.procedimiento} no es un número válido`;
      if (p.honorarios.some(h => h.valor && isNaN(aNumero(h.valor) as number))) return `Revise los honorarios de ${p.procedimiento}`;
    }
    if (form.adicionales.some(a => a.concepto.trim() && isNaN(aNumero(a.valor) ?? 0))) return 'Revise los valores adicionales';
    return null;
  };

  const handleGuardar = async () => {
    const error = validar();
    if (error) return toast.error(error);
    setIsSaving(true);
    try {
      await updateAseguradoraMaternidad(aseguradora.id_aseguradora_mat, {
        config_cotizacion: { ...(actual?.config_cotizacion || {}), presupuesto: aConfig(form) },
      });
      toast.success(`Cotización de ${aseguradora.nombre} guardada`);
      onGuardado();
      onOpenChange(false);
    } catch {
      toast.error('Error al guardar la configuración de la cotización');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuitarPresupuesto = async () => {
    setIsSaving(true);
    try {
      const { presupuesto: _omitido, ...resto } = actual?.config_cotizacion || {};
      await updateAseguradoraMaternidad(aseguradora.id_aseguradora_mat, { config_cotizacion: resto });
      toast.success('Se quitó el presupuesto: esta aseguradora usará el presupuesto genérico');
      onGuardado();
      onOpenChange(false);
    } catch {
      toast.error('Error al quitar el presupuesto');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVistaPrevia = async () => {
    const error = validar();
    if (error) return toast.error(error);
    setIsPreview(true);
    try {
      const url = await vistaPreviaPresupuestoMaternidad({ presupuesto: aConfig(form) });
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error(`No se pudo generar la vista previa: ${e instanceof Error ? e.message : e}`);
    } finally {
      setIsPreview(false);
    }
  };

  const tienePresupuesto = !!actual?.config_cotizacion?.presupuesto?.procedimientos?.length;

  return (
    <Dialog open={!!aseguradora} onOpenChange={onOpenChange}>
      <DialogContent className="maternidad-dialog-medio">
        <DialogHeader>
          <DialogTitle>Cotización · {aseguradora.nombre}</DialogTitle>
          <DialogDescription>
            Valores del presupuesto que se envía por correo: una cotización para Cesárea y otra para Parto normal (una página del PDF cada una). El total se calcula con la clínica más los honorarios con valor.
          </DialogDescription>
        </DialogHeader>

        {otrasConPresupuesto.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Copy className="size-4 text-gray-500" />
            <Label className="text-xs">Copiar valores de:</Label>
            <Select onValueChange={handleCopiar}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Seleccione una aseguradora" /></SelectTrigger>
              <SelectContent>
                {otrasConPresupuesto.map(a => (
                  <SelectItem key={a.id_aseguradora_mat} value={a.id_aseguradora_mat.toString()}>{a.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isCargando ? (
          <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
        ) : (
        <>
        {/* Resumen: una cotización por procedimiento = una página del PDF */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Cotizaciones:</span>
          {form.procedimientos.map((p, i) => (
            <span key={i} className="rounded border bg-purple-50 border-purple-200 px-2 py-1 text-xs">
              {i + 1}. {p.procedimiento} · <strong>{formatearUSD(totalProcedimiento(p))}</strong>
            </span>
          ))}
        </div>

        <div className="space-y-4">
          {form.procedimientos.map((p, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-purple-50 border-b border-purple-200">
                <h3 className="font-semibold">
                  Cotización {i + 1}: {p.procedimiento}
                  <span className="text-sm font-normal text-gray-600"> · página {i + 1} del PDF</span>
                </h3>
                <span className="text-sm">Total: <strong>{formatearUSD(totalProcedimiento(p))}</strong></span>
              </div>
              <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Internación</Label>
                  <Input value={p.internacion} placeholder="3 DÍAS - 2 NOCHES" onChange={e => setProcedimiento(i, { internacion: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor clínica (USD) *</Label>
                  <Input type="number" min="0" step="0.01" value={p.clinica} onChange={e => setProcedimiento(i, { clinica: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Abono para el ingreso (USD)</Label>
                  <Input type="number" min="0" step="0.01" value={p.abono} placeholder="Vacío = no se muestra" onChange={e => setProcedimiento(i, { abono: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Incluye (un ítem por línea)</Label>
                <Textarea rows={6} value={p.incluye} onChange={e => setProcedimiento(i, { incluye: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Honorarios médicos (valor vacío = A CONVENIR)</Label>
                {p.honorarios.map((h, j) => (
                  <div key={j} className="flex gap-2">
                    <Input value={h.concepto} placeholder="HONORARIOS ANESTESIÓLOGO" onChange={e => setHonorario(i, j, { concepto: e.target.value })} />
                    <Input className="w-32" type="number" min="0" step="0.01" value={h.valor} placeholder="A CONVENIR" onChange={e => setHonorario(i, j, { valor: e.target.value })} />
                    <Button type="button" size="sm" variant="ghost" onClick={() => setProcedimiento(i, { honorarios: p.honorarios.filter((_, k) => k !== j) })}>
                      <Trash2 className="size-4 text-red-600" />
                    </Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => setProcedimiento(i, { honorarios: [...p.honorarios, { concepto: '', valor: '' }] })}>
                  <Plus className="size-4 mr-1" /> Honorario
                </Button>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notas (una por línea; el abono se agrega al final automáticamente)</Label>
                <Textarea rows={4} value={p.notas} onChange={e => setProcedimiento(i, { notas: e.target.value })} />
              </div>

              </div>
            </Card>
          ))}

          <Card className="overflow-hidden">
            <div className="p-3 bg-gray-50 border-b">
              <h3 className="font-semibold">Adicionales y firma <span className="text-sm font-normal text-gray-600">· comunes a todas las cotizaciones</span></h3>
            </div>
            <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">
                Valores adicionales fuera del paquete (se muestran en todas las páginas). El subtítulo es opcional, p. ej. "Laboratorios:".
              </Label>
              {form.adicionales.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="w-32" value={a.grupo} placeholder="Subtítulo" onChange={e => setAdicional(i, { grupo: e.target.value })} />
                  <Textarea rows={1} value={a.concepto} placeholder="Concepto (Enter = otra línea)" onChange={e => setAdicional(i, { concepto: e.target.value })} />
                  <Input className="w-32" type="number" min="0" step="0.01" value={a.valor} placeholder="USD" onChange={e => setAdicional(i, { valor: e.target.value })} />
                  <Button type="button" size="sm" variant="ghost" onClick={() => setForm(prev => ({ ...prev, adicionales: prev.adicionales.filter((_, k) => k !== i) }))}>
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setForm(prev => ({ ...prev, adicionales: [...prev.adicionales, { grupo: '', concepto: '', valor: '' }] }))}>
                <Plus className="size-4 mr-1" /> Valor adicional
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-1">
                <Label className="text-xs">Firma: nombre</Label>
                <Input value={form.firma.nombre} onChange={e => setForm(prev => ({ ...prev, firma: { ...prev.firma, nombre: e.target.value } }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Firma: cargo</Label>
                <Input value={form.firma.cargo} onChange={e => setForm(prev => ({ ...prev, firma: { ...prev.firma, cargo: e.target.value } }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Firma: teléfono</Label>
                <Input value={form.firma.telefono} onChange={e => setForm(prev => ({ ...prev, firma: { ...prev.firma, telefono: e.target.value } }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Especialidad del médico</Label>
                <Input value={form.especialidad} onChange={e => setForm(prev => ({ ...prev, especialidad: e.target.value }))} />
              </div>
            </div>
            </div>
          </Card>
        </div>

        </>
        )}

        <DialogFooter className="flex flex-wrap gap-2">
          {tienePresupuesto && (
            <Button variant="ghost" onClick={handleQuitarPresupuesto} disabled={isSaving}>
              <Trash2 className="size-4 mr-1 text-red-600" /> Usar genérico
            </Button>
          )}
          <Button variant="outline" onClick={handleVistaPrevia} disabled={isPreview}>
            {isPreview ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Eye className="size-4 mr-1" />}
            Vista previa PDF
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={isSaving || isCargando || !actual}>
            {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
