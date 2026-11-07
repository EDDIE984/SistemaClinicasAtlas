// Reporte de proformas enviadas: valores por procedimiento, fechas de envío y resultado de cada mamá
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Eye, Loader2, Printer } from 'lucide-react';
import type { IndicadoresProformas } from '../../hooks/useMaternidad';
import { formatearEstadoSolicitudMaternidad, formatearResultadoParto } from '../../lib/maternidadService';
import type { MaternidadEnvioCorreo, MaternidadProforma } from '../../lib/supabaseTypes';
import { KpiBitacora } from './MaternidadBitacoraReportes';
import { formatFechaCorta, formatFechaHora, formatearUSD } from './maternidadUtils';

const POR_PAGINA = 50;
const COLORES_PROCEDIMIENTO = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2'];

/** Primer envío exitoso de cada proforma (los envíos están en maternidad_envio_correo) */
export function primerEnvioPorProforma(envios: MaternidadEnvioCorreo[]): Map<number, string> {
  const mapa = new Map<number, string>();
  envios
    .filter(e => e.id_cotizacion_mat && e.estado === 'enviado')
    .forEach(e => {
      const actual = mapa.get(e.id_cotizacion_mat as number);
      if (!actual || e.created_at < actual) mapa.set(e.id_cotizacion_mat as number, e.created_at);
    });
  return mapa;
}

const resultadoMama = (p: MaternidadProforma) => {
  const s = p.solicitud;
  if (!s) return '—';
  if (s.resultado_parto === 'clinica') return 'Dio a luz en la clínica';
  if (s.estado === 'asistio') return 'Asistió al tour';
  if (s.fecha_tour && ['agendada', 'confirmada'].includes(s.estado)) return 'Tour agendado';
  return formatearEstadoSolicitudMaternidad(s.estado);
};

const tipoProforma = (p: MaternidadProforma) => (p.tipo === 'confirmacion_tour' ? 'Confirmación de tour' : 'Cotización');

interface ProformasReporteProps {
  proformas: MaternidadProforma[];
  ind: IndicadoresProformas;
  primerEnvio: Map<number, string>;
  isLoading: boolean;
  imprimiendoId: number | null;
  onImprimir: (proforma: MaternidadProforma) => void;
  onDetalle: (proforma: MaternidadProforma) => void;
}

export function ProformasReporte({ proformas, ind, primerEnvio, isLoading, imprimiendoId, onImprimir, onDetalle }: ProformasReporteProps) {
  const [pagina, setPagina] = useState(0);
  const paginas = Math.max(1, Math.ceil(proformas.length / POR_PAGINA));
  const visibles = useMemo(() => proformas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA), [proformas, pagina]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBitacora titulo="Proformas enviadas" valor={ind.enviadas} detalle={`${ind.reenvios} reenvíos · ${ind.mamas} mamás cotizadas`} />
        {ind.porProcedimiento.slice(0, 2).map(p => (
          <KpiBitacora
            key={p.procedimiento}
            titulo={`${p.procedimiento}: valor promedio`}
            valor={formatearUSD(p.promedio)}
            detalle={`${p.cotizaciones} cotizaciones · de ${formatearUSD(p.minimo)} a ${formatearUSD(p.maximo)}`}
            color="text-blue-700"
          />
        ))}
        <KpiBitacora titulo="Envíos con error" valor={ind.conError} color={ind.conError > 0 ? 'text-red-600' : ''} />
      </div>

      {ind.porProcedimiento.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium mb-2">Valores cotizados por procedimiento</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Procedimiento</TableHead>
                <TableHead className="text-right">Cotizaciones</TableHead>
                <TableHead className="text-right">Promedio</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Máximo</TableHead>
                <TableHead className="text-right">Total cotizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ind.porProcedimiento.map(p => (
                <TableRow key={p.procedimiento}>
                  <TableCell className="font-medium">{p.procedimiento}</TableCell>
                  <TableCell className="text-right">{p.cotizaciones}</TableCell>
                  <TableCell className="text-right">{formatearUSD(p.promedio)}</TableCell>
                  <TableCell className="text-right">{formatearUSD(p.minimo)}</TableCell>
                  <TableCell className="text-right">{formatearUSD(p.maximo)}</TableCell>
                  <TableCell className="text-right">{formatearUSD(p.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {proformas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="font-medium mb-2">Proformas enviadas por mes</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ind.porMes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="proformas" name="Proformas" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-4">
            <h3 className="font-medium mb-2">Valor promedio por aseguradora</h3>
            <ResponsiveContainer width="100%" height={Math.max(240, ind.porAseguradora.length * 34)}>
              <BarChart data={ind.porAseguradora} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v: number) => `$${v}`} />
                <YAxis type="category" dataKey="aseguradora" width={130} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatearUSD(v)} />
                <Legend />
                {ind.procedimientos.map((proc, i) => (
                  <Bar key={proc} dataKey={proc} name={proc} fill={COLORES_PROCEDIMIENTO[i % COLORES_PROCEDIMIENTO.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      <Card>
        <div className="p-4 pb-0">
          <h3 className="font-medium">Detalle de proformas ({proformas.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N.º</TableHead>
                <TableHead>Mamá</TableHead>
                <TableHead>Aseguradora</TableHead>
                <TableHead>Valores</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Primer envío</TableHead>
                <TableHead>Último envío</TableHead>
                <TableHead>Envíos</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                    No hay proformas enviadas en el período. Se registran desde WhatsApp o la plataforma.
                  </TableCell>
                </TableRow>
              ) : visibles.map(p => (
                <TableRow key={p.id_cotizacion_mat}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {p.numero_cotizacion}
                    <p className="font-sans text-gray-500">{tipoProforma(p)}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{p.solicitud?.nombre_madre || '—'}</p>
                    <p className="text-xs text-gray-500">{p.solicitud?.telefono || ''}</p>
                  </TableCell>
                  <TableCell className="text-xs">{p.aseguradora || '—'}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {(p.resumen || []).length === 0 ? 'Genérica' : p.resumen.map(r => (
                      <p key={r.procedimiento}>{r.procedimiento}: <strong>{formatearUSD(r.total)}</strong></p>
                    ))}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatFechaHora(p.fecha_emision)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatFechaHora(primerEnvio.get(p.id_cotizacion_mat) || p.fecha_envio)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatFechaHora(p.fecha_envio)}</TableCell>
                  <TableCell className="text-xs">
                    {p.veces_enviada}
                    {p.estado === 'error' && <Badge variant="destructive" className="ml-1">Error</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{resultadoMama(p)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {p.valores && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={imprimiendoId !== null} onClick={() => onImprimir(p)}>
                          {imprimiendoId === p.id_cotizacion_mat ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Printer className="size-3 mr-1" />}
                          Imprimir
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onDetalle(p)}>
                        <Eye className="size-3 mr-1" />Detalle
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {paginas > 1 && (
          <div className="flex items-center justify-end gap-2 p-3 text-sm">
            <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</Button>
            <span>Página {pagina + 1} de {paginas}</span>
            <Button size="sm" variant="outline" disabled={pagina >= paginas - 1} onClick={() => setPagina(p => p + 1)}>Siguiente</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Hojas Proformas (una fila por proforma, una columna por procedimiento) y Envíos (una fila por envío) */
export function agregarHojasProformas(
  libro: XLSX.WorkBook,
  proformas: MaternidadProforma[],
  envios: MaternidadEnvioCorreo[],
  ind: IndicadoresProformas,
) {
  const primerEnvio = primerEnvioPorProforma(envios);
  const filas = proformas.map(p => {
    const fila: Record<string, string | number> = {
      'N.º proforma': p.numero_cotizacion,
      'Tipo': tipoProforma(p),
      'Mamá': p.solicitud?.nombre_madre ?? '',
      'Cédula': p.solicitud?.cedula ?? '',
      'Teléfono': p.solicitud?.telefono ?? '',
      'Correo': p.solicitud?.correo ?? '',
      'Aseguradora': p.aseguradora ?? '',
    };
    ind.procedimientos.forEach(proc => {
      const valor = (p.resumen || []).find(r => r.procedimiento === proc)?.total;
      fila[`Valor ${proc}`] = valor ?? '';
    });
    Object.assign(fila, {
      'Fecha emisión': formatFechaHora(p.fecha_emision),
      'Primer envío': formatFechaHora(primerEnvio.get(p.id_cotizacion_mat) || p.fecha_envio),
      'Último envío': formatFechaHora(p.fecha_envio),
      'Veces enviada': p.veces_enviada,
      'Estado envío': p.estado === 'enviada' ? 'Enviada' : p.estado === 'error' ? 'Error' : 'Generada',
      'Resultado': resultadoMama(p),
      'Parto': formatearResultadoParto(p.solicitud?.resultado_parto),
      'Fecha tour': p.solicitud?.fecha_tour ? formatFechaCorta(p.solicitud.fecha_tour) : '',
      'Generada por': p.generado_por ?? '',
    });
    return fila;
  });
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet(filas.length ? filas : [{ 'N.º proforma': 'Sin proformas enviadas en el período' }]),
    'Proformas',
  );

  const numeros = new Map(proformas.map(p => [p.id_cotizacion_mat, p]));
  const filasEnvios = envios
    .filter(e => !e.id_cotizacion_mat || numeros.has(e.id_cotizacion_mat))
    .map(e => ({
      'Fecha y hora': formatFechaHora(e.created_at),
      'N.º proforma': e.id_cotizacion_mat ? numeros.get(e.id_cotizacion_mat)?.numero_cotizacion ?? '' : '',
      'Mamá': e.id_cotizacion_mat ? numeros.get(e.id_cotizacion_mat)?.solicitud?.nombre_madre ?? '' : '',
      'Tipo': e.tipo === 'confirmacion_tour' ? 'Confirmación de tour' : 'Cotización',
      'Destinatario': e.destinatario,
      'Estado': e.estado === 'enviado' ? 'Enviado' : 'Error',
      'Error': e.error_mensaje ?? '',
      'Enviado por': e.enviado_por,
    }));
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet(filasEnvios.length ? filasEnvios : [{ 'Fecha y hora': 'Sin envíos en el período' }]),
    'Envíos',
  );

  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet(ind.porProcedimiento.length ? ind.porProcedimiento.map(p => ({
      Procedimiento: p.procedimiento,
      Cotizaciones: p.cotizaciones,
      Promedio: p.promedio,
      Mínimo: p.minimo,
      Máximo: p.maximo,
      'Total cotizado': p.total,
    })) : [{ Procedimiento: 'Sin valores en el período' }]),
    'Valores por procedimiento',
  );
}
