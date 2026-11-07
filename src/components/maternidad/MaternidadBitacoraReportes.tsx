// Reportería de la bitácora de tours (indicadores, gráficas y hojas de Excel), compartida por
// la pantalla Bitácora de Tours y por Reportes Maternidad
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../ui/card';
import type { EmbudoComercial as DatosEmbudo, IndicadoresBitacora } from '../../hooks/useMaternidad';
import { formatearResultadoParto, formatearTipoParto } from '../../lib/maternidadService';
import type { MaternidadSolicitudVista } from '../../lib/supabaseTypes';
import {
  SEGUIMIENTO_TOUR,
  formatFechaCorta,
  nombreMes,
  seguimientoTour,
  semanasHoy,
  seguroDe,
  type SeguimientoTour,
} from './maternidadUtils';

const COLORES_SEGUIMIENTO: Record<SeguimientoTour, string> = {
  temprana: '#d97706',
  seguimiento: '#f87171',
  llamar: '#dc2626',
  vencida: '#6b7280',
  perdida: '#6b7280',
  parto_clinica: '#16a34a',
  sin_semanas: '#cbd5e1',
};

const textoFirma = (firma: boolean | null) => (firma === true ? 'SI' : firma === false ? 'NO' : '');

export function KpiBitacora({ titulo, valor, detalle, color = '' }: { titulo: string; valor: string | number; detalle?: string; color?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className={`text-2xl font-semibold ${color}`}>{valor}</p>
      {detalle && <p className="text-xs text-gray-400">{detalle}</p>}
    </Card>
  );
}

/** Indicadores principales: tours, alertas, partos en la clínica y firma */
export function BitacoraIndicadoresPrincipales({ ind }: { ind: IndicadoresBitacora }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiBitacora
        titulo="Tours realizados"
        valor={ind.total}
        detalle={ind.promedioSemanas ? `${ind.promedioSemanas} semanas en promedio al tour` : undefined}
      />
      <KpiBitacora
        titulo="Alertas de seguimiento"
        valor={ind.llamar + ind.enSeguimiento}
        detalle={`${ind.llamar} para llamar (37–40) · ${ind.enSeguimiento} en seguimiento (20–36)`}
        color="text-red-600"
      />
      <KpiBitacora titulo="Dieron a luz en la clínica" valor={ind.partosClinica} detalle={`${ind.tasaParto}% de los tours`} color="text-green-700" />
      <KpiBitacora titulo="Firmaron" valor={`${ind.tasaFirma}%`} detalle={`${ind.firmaron} de los tours con dato de firma`} />
    </div>
  );
}

function Barras({ titulo, datos, clave, color, vertical = false, alto = 260 }: {
  titulo: string; datos: object[]; clave: string; color: string; vertical?: boolean; alto?: number;
}) {
  return (
    <Card className="p-4">
      <h3 className="font-medium mb-2">{titulo}</h3>
      <ResponsiveContainer width="100%" height={alto}>
        {vertical ? (
          <BarChart data={datos} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey={clave} width={130} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="tours" name="Tours" fill={color} />
          </BarChart>
        ) : (
          <BarChart data={datos}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={clave} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="tours" name="Tours" fill={color} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
}

/** Indicadores de seguimiento y gráficas de la bitácora */
export function BitacoraReportes({ ind }: { ind: IndicadoresBitacora }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBitacora titulo="En seguimiento" valor={ind.enSeguimiento} detalle="Entre 20 y 36 semanas hoy" color="text-red-600" />
        <KpiBitacora titulo="Pendientes" valor={ind.pendientes} detalle="Menos de 20 semanas hoy" color="text-amber-600" />
        <KpiBitacora titulo="Ya está perdida" valor={ind.perdidas} detalle="Más de 40 semanas o seguimiento cerrado" color="text-gray-600" />
        <KpiBitacora titulo="Sin semanas" valor={ind.sinSemanas} detalle="No se puede calcular el seguimiento" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBitacora
          titulo="Duración promedio"
          valor={ind.duracionPromedio ? `${ind.duracionPromedio} min` : '—'}
          detalle="Tours con hora de inicio y fin"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-medium mb-2">Tours por mes</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ind.porMes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="tours" name="Tours" fill="#2563eb" />
              <Bar dataKey="partos" name="Partos en la clínica" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <h3 className="font-medium mb-2">Estado de seguimiento</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={ind.porSeguimiento.map(s => ({ ...s, nombre: SEGUIMIENTO_TOUR[s.estado].label }))}
                dataKey="total"
                nameKey="nombre"
                outerRadius={90}
                label
              >
                {ind.porSeguimiento.map(s => <Cell key={s.estado} fill={COLORES_SEGUIMIENTO[s.estado]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Barras titulo="Tours por asesor" datos={ind.porAsesor} clave="asesor" color="#9333ea" vertical alto={Math.max(220, ind.porAsesor.length * 32)} />
        <Barras titulo="Tours por seguro (top 10)" datos={ind.porSeguro} clave="seguro" color="#0891b2" vertical alto={300} />
        <Barras titulo="Médicos tratantes (top 10)" datos={ind.porMedico} clave="medico" color="#d97706" vertical alto={300} />
        <Barras titulo="Semanas de gestación al tour" datos={ind.porSemanas} clave="rango" color="#2563eb" />
        <Barras titulo="Tours por día de la semana" datos={ind.porDiaSemana} clave="dia" color="#16a34a" />
        <Barras titulo="Tours por hora de inicio" datos={ind.porHora} clave="hora" color="#0891b2" />
        <Barras titulo="Tours por origen" datos={ind.porOrigen} clave="origen" color="#64748b" vertical alto={200} />
      </div>
    </div>
  );
}

/**
 * Agrega al libro las hojas de la bitácora con el formato del Excel original (sin DETALLE):
 * registro en orden ascendente, resumen, por mes y por asesor.
 */
export function agregarHojasBitacora(
  libro: XLSX.WorkBook,
  tours: MaternidadSolicitudVista[],
  ind: IndicadoresBitacora,
  periodo: string,
  prefijo = '',
  /** Filtros aplicados, para dejarlos en la hoja Resumen */
  filtros: { Filtro: string; Valor: string }[] = [],
) {
  const ordenados = [...tours].sort((a, b) =>
    (a.fecha_tour || '').localeCompare(b.fecha_tour || '') || (a.numero_bitacora || 0) - (b.numero_bitacora || 0));
  const filas = ordenados.map(s => ({
    '#': s.numero_bitacora ?? '',
    'FECHA': formatFechaCorta(s.fecha_tour),
    'MES': nombreMes(s.fecha_tour),
    'NOMBRES': s.nombre_madre,
    'MÉDICO TRATANTE': s.medico_ginecologo ?? '',
    'SEMANAS DE GESTACIÓN': s.semanas_gestacion ?? '',
    'TELF': s.telefono ?? '',
    'HORA DE INICIO': s.hora_inicio_real?.slice(0, 5) ?? '',
    'HORA FIN': s.hora_fin_real?.slice(0, 5) ?? '',
    'ASESOR': s.asesor ?? '',
    'SEGURO': seguroDe(s),
    'FIRMA PACIENTE': textoFirma(s.firma_paciente),
    'SEMANAS ACTUALES DE GESTACIÓN': semanasHoy(s) ?? '',
    'FECHA PROBABLE DE PARTO': s.fecha_probable_parto ? formatFechaCorta(s.fecha_probable_parto) : '',
    'SEGUIMIENTO': SEGUIMIENTO_TOUR[seguimientoTour(s)].label,
    'PARTO': formatearResultadoParto(s.resultado_parto),
    'FECHA PARTO': s.fecha_parto ? formatFechaCorta(s.fecha_parto) : '',
    'TIPO PARTO': formatearTipoParto(s.tipo_parto),
    'CÉDULA': s.cedula ?? '',
    'CORREO': s.correo ?? '',
    'ORIGEN': s.origen === 'BITACORA' ? 'Bitácora (Excel)' : s.origen === 'CHATBOT' ? 'WhatsApp' : 'Sistema',
  }));
  const resumen = [
    { Indicador: 'Período (fecha del tour)', Valor: periodo },
    ...filtros.map(f => ({ Indicador: `Filtro · ${f.Filtro}`, Valor: f.Valor })),
    { Indicador: 'Tours realizados', Valor: ind.total },
    { Indicador: 'Firmaron (%)', Valor: ind.tasaFirma },
    { Indicador: 'Llamar a seguimiento (37–40 semanas)', Valor: ind.llamar },
    { Indicador: 'En seguimiento (20–36 semanas)', Valor: ind.enSeguimiento },
    { Indicador: 'Pendientes (< 20 semanas)', Valor: ind.pendientes },
    { Indicador: 'Ya está perdida', Valor: ind.perdidas },
    { Indicador: 'Sin semanas', Valor: ind.sinSemanas },
    { Indicador: 'Dieron a luz en la clínica', Valor: ind.partosClinica },
    { Indicador: 'Partos en la clínica sobre tours (%)', Valor: ind.tasaParto },
    { Indicador: 'Promedio de semanas al tour', Valor: ind.promedioSemanas ?? '' },
    { Indicador: 'Duración promedio del tour (min)', Valor: ind.duracionPromedio ?? '' },
  ];
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), `${prefijo}Bitácora`);
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resumen), `${prefijo}Resumen bitácora`.slice(0, 31));
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet(ind.porMes.map(m => ({ Mes: m.etiqueta, Tours: m.tours, 'Partos en la clínica': m.partos }))),
    `${prefijo}Tours por mes`.slice(0, 31),
  );
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet(ind.porAsesor.map(a => ({ Asesor: a.asesor, Tours: a.tours }))),
    `${prefijo}Tours por asesor`.slice(0, 31),
  );
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet(ind.porMedico.map(m => ({ 'Médico tratante': m.medico, Tours: m.tours }))),
    `${prefijo}Médicos tratantes`.slice(0, 31),
  );
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet(ind.porSeguro.map(m => ({ Seguro: m.seguro, Tours: m.tours }))),
    `${prefijo}Tours por seguro`.slice(0, 31),
  );
  // Lista de llamadas: mamás en alerta (20–40 semanas sin parto registrado)
  const enAlertaRoja = ordenados
    .filter(s => s.estado_seguimiento === 'llamar' || s.estado_seguimiento === 'seguimiento')
    .sort((a, b) => Number(b.semanas_actuales || 0) - Number(a.semanas_actuales || 0));
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet(enAlertaRoja.length ? enAlertaRoja.map(s => ({
      'Prioridad': s.estado_seguimiento === 'llamar' ? 'Llamar (37–40 semanas)' : 'En seguimiento (20–36)',
      'Nombres': s.nombre_madre,
      'Teléfono': s.telefono ?? '',
      'Semanas actuales': semanasHoy(s) ?? '',
      'Fecha probable de parto': s.fecha_probable_parto ? formatFechaCorta(s.fecha_probable_parto) : '',
      'Médico tratante': s.medico_ginecologo ?? '',
      'Seguro': seguroDe(s),
      'Asesor': s.asesor ?? '',
      'Tour': `#${s.numero_bitacora ?? '—'} ${formatFechaCorta(s.fecha_tour)}`,
    })) : [{ 'Prioridad': 'Sin mamás en alerta con los filtros aplicados' }]),
    `${prefijo}Seguimiento`.slice(0, 31),
  );
}

/** Embudo comercial: solicitudes de WhatsApp / plataforma hasta el parto en la clínica */
export function EmbudoComercialCard({ embudo }: { embudo: DatosEmbudo }) {
  return (
    <Card className="p-4 space-y-3">
      <div>
        <h3 className="font-medium">Embudo comercial (WhatsApp y plataforma)</h3>
        <p className="text-xs text-gray-500">
          Solicitudes registradas en el período: cuántas recibieron proforma, agendaron, asistieron y dieron a luz en la clínica.
          No incluye la bitácora histórica.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={embudo.etapas} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="etapa" width={140} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="total" name="Mamás" fill="#16a34a" />
          </BarChart>
        </ResponsiveContainer>
        <div className="space-y-2 text-sm">
          {embudo.etapas.map(e => (
            <div key={e.etapa} className="flex items-center justify-between border-b pb-1">
              <span>{e.etapa}</span>
              <span className="font-semibold">
                {e.total}
                {e.conversion !== null && <span className="ml-2 text-xs font-normal text-gray-500">{e.conversion}% de la etapa anterior</span>}
              </span>
            </div>
          ))}
          <div className="pt-2 space-y-1 text-xs text-gray-600">
            {embudo.porCanal.map(c => (
              <p key={c.canal}>
                <strong>{c.canal}:</strong> {c.solicitudes} solicitudes · {c.proformas} proformas · {c.tours} tours · {c.asistieron} asistieron · {c.partos} partos
              </p>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function agregarHojaEmbudo(libro: XLSX.WorkBook, embudo: DatosEmbudo, periodo: string) {
  const filas = [
    { Etapa: `Período (fecha de registro): ${periodo}`, Total: '', 'Conversión (%)': '' },
    ...embudo.etapas.map(e => ({ Etapa: e.etapa, Total: e.total, 'Conversión (%)': e.conversion ?? '' })),
    { Etapa: '', Total: '', 'Conversión (%)': '' },
    ...embudo.porCanal.flatMap(c => [
      { Etapa: `${c.canal} · solicitudes`, Total: c.solicitudes, 'Conversión (%)': '' },
      { Etapa: `${c.canal} · proformas`, Total: c.proformas, 'Conversión (%)': '' },
      { Etapa: `${c.canal} · tours`, Total: c.tours, 'Conversión (%)': '' },
      { Etapa: `${c.canal} · asistieron`, Total: c.asistieron, 'Conversión (%)': '' },
      { Etapa: `${c.canal} · partos`, Total: c.partos, 'Conversión (%)': '' },
    ]),
  ];
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Embudo comercial');
}
