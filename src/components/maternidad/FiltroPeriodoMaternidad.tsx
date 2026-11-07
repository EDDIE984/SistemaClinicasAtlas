// Selector de período para los reportes de maternidad: accesos rápidos + fechas desde/hasta
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PERIODOS, rangoPeriodo, type ClavePeriodo } from './maternidadUtils';

export interface PeriodoMaternidad {
  clave: ClavePeriodo;
  desde: string;
  hasta: string;
}

/** Período inicial a partir de un acceso rápido */
export const periodoInicial = (clave: ClavePeriodo = 'este_anio'): PeriodoMaternidad => ({
  clave,
  ...(rangoPeriodo(clave) || rangoPeriodo('este_anio')!),
});

interface FiltroPeriodoMaternidadProps {
  periodo: PeriodoMaternidad;
  onChange: (periodo: PeriodoMaternidad) => void;
  /** Texto que aclara a qué fecha se aplica (p. ej. "fecha del tour") */
  etiqueta?: string;
}

export function FiltroPeriodoMaternidad({ periodo, onChange, etiqueta = 'Período' }: FiltroPeriodoMaternidadProps) {
  const elegir = (clave: ClavePeriodo) => {
    const rango = rangoPeriodo(clave);
    onChange(rango ? { clave, ...rango } : { ...periodo, clave });
  };

  return (
    <>
      <div className="space-y-1">
        <Label className="text-xs">{etiqueta}</Label>
        <Select value={periodo.clave} onValueChange={v => elegir(v as ClavePeriodo)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Desde</Label>
        <Input type="date" value={periodo.desde} onChange={e => onChange({ ...periodo, clave: 'personalizado', desde: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Hasta</Label>
        <Input type="date" value={periodo.hasta} onChange={e => onChange({ ...periodo, clave: 'personalizado', hasta: e.target.value })} />
      </div>
    </>
  );
}
