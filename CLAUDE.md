# CLAUDE.md — Sistema Médico Clínica Atlas

## Propósito del proyecto

Sistema de gestión clínica para **Clínica Atlas** (Ecuador). Permite administrar:

- Pacientes: registro, historial médico, signos vitales, archivos
- Agenda: citas, disponibilidad por consultorio/médico, horarios
- Cobros: precios base, precios por médico, pagos, reportes financieros
- Configuración: empresas, sucursales, consultorios, usuarios, especialidades, aseguradoras
- Reportes: analítica de atención médica
- Chatbot: asistente de consulta médica con IA
- Interconsultas: derivaciones entre médicos internos y externos

Usuarios del sistema: médicos, secretarias, enfermeras, personal administrativo.
Contexto geográfico: Ecuador — integración con Registro Civil para validación de cédula.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, TypeScript, Vite 6 (SWC) |
| UI | Radix UI (primitivos), Tailwind CSS, Lucide React |
| Estado | React Context API (ConfigContext), useState, custom hooks |
| Formularios | React Hook Form |
| Gráficas | Recharts |
| Notificaciones | Sonner (toast) |
| Base de datos | Supabase (PostgreSQL) con RLS |
| Auth | Supabase Auth vía authService |
| Serverless | Vercel (`api/` folder = funciones serverless TypeScript) |
| Despliegue | Vercel (SPA rewrite, Vite framework) |

---

## Estructura del proyecto

```
Sistema Medico Clinica Atlas/
├── api/                              # Vercel serverless functions
│   └── consulta-cedula.ts            # Proxy para validación de cédula (Registro Civil)
├── src/
│   ├── main.tsx                      # Punto de entrada — monta App en #root
│   ├── App.tsx                       # Raíz — enruta entre Login y Dashboard según auth
│   ├── index.css                     # Estilos globales (Tailwind + custom)
│   ├── components/
│   │   ├── ui/                       # Librería de componentes Radix UI (47 archivos)
│   │   ├── config/                   # Tabs de configuración por entidad (18 archivos)
│   │   │   ├── UsuarioTabSupabase.tsx
│   │   │   ├── SucursalTabSupabase.tsx
│   │   │   ├── CompaniaTabSupabase.tsx
│   │   │   └── ...
│   │   ├── agenda/                   # Componentes específicos de la agenda
│   │   ├── Login.tsx                 # Formulario de autenticación
│   │   ├── Dashboard.tsx             # Shell principal — sidebar + navegación + vistas
│   │   ├── AgendaViewSupabase.tsx    # Calendario/agenda de citas
│   │   ├── AgendarCitaModalSupabase.tsx  # Modal para crear/editar citas
│   │   ├── DetalleCitaDialog.tsx     # Detalle de una cita
│   │   ├── PacientesViewSupabase.tsx # Gestión de pacientes
│   │   ├── CitasDashboardSupabase.tsx# Dashboard con métricas de citas
│   │   ├── CargosViewSupabase.tsx    # Facturación y cobros
│   │   ├── ReportesViewSupabase.tsx  # Reportes y analítica
│   │   ├── ChatBotViewSupabase.tsx   # Asistente IA
│   │   ├── InterconsultasView.tsx    # Módulo de interconsultas (derivaciones)
│   │   └── ConfiguracionesViewSupabase.tsx  # Configuración del sistema
│   ├── lib/                          # Servicios y lógica de negocio
│   │   ├── supabase.ts               # Cliente Supabase (singleton)
│   │   ├── supabaseTypes.ts          # Tipos TypeScript del esquema de BD
│   │   ├── authService.ts            # Autenticación, roles, asignaciones
│   │   ├── pacientesService.ts       # CRUD pacientes, signos vitales, antecedentes
│   │   ├── citasService.ts           # CRUD citas, estados, filtros
│   │   ├── configuracionesService.ts # Empresas, sucursales, usuarios, precios
│   │   ├── cobrosService.ts          # Facturación y pagos
│   │   ├── reportesService.ts        # Agregación de datos para reportes
│   │   ├── chatbotService.ts         # Lógica del asistente IA
│   │   ├── registroCivilService.ts   # Integración Registro Civil Ecuador
│   │   ├── interconsultaService.ts   # CRUD interconsultas y cambio de estado
│   │   └── slotsService.ts           # Disponibilidad de horarios
│   ├── hooks/                        # Custom hooks (estado + llamadas a servicios)
│   │   ├── useCitas.ts
│   │   ├── usePacientes.ts
│   │   ├── useReportes.ts
│   │   ├── useConfiguraciones.ts
│   │   ├── useCobros.ts
│   │   └── useChatbot.ts
│   ├── contexts/
│   │   └── ConfigContext.tsx         # Estado global: consultorios, usuarios, sucursales
│   ├── utils/
│   │   ├── consultorioSync.ts        # Sincronización de consultorios
│   │   └── usuarioSync.ts            # Sincronización de usuarios
│   ├── data/
│   │   ├── mockData.ts               # Datos de muestra
│   │   └── conversacionesChatbot.ts  # Conversaciones predefinidas del chatbot
│   ├── database/
│   │   └── supabase-schema.sql       # Esquema inicial completo
│   └── supabase/                     # Migraciones y scripts SQL (30+ archivos)
│       ├── migration.sql             # Migración completa
│       ├── seed_data.sql             # Datos semilla
│       ├── INDICE_SCRIPTS.md         # Índice de todos los scripts SQL
│       └── NNN_descripcion.sql       # Migraciones incrementales numeradas
├── public/                           # Assets estáticos
├── dist/                             # Build de producción (generado)
├── index.html                        # HTML raíz con div#root
├── vite.config.ts                    # Configuración de Vite
├── vercel.json                       # Configuración de despliegue Vercel
└── package.json
```

---

## Decisiones de arquitectura clave

### 1. Capa de servicios en `src/lib/`
Toda lógica de acceso a datos está en archivos `*Service.ts`. Los componentes nunca llaman directamente al cliente Supabase — siempre usan el servicio correspondiente.

```
src/lib/
  citasService.ts            # CRUD de citas
  pacientesService.ts        # CRUD de pacientes
  configuracionesService.ts  # Empresas, sucursales, usuarios, precios
  cobrosService.ts           # Facturación y pagos
  reportesService.ts         # Generación de reportes
  authService.ts             # Autenticación y roles
  chatbotService.ts          # Lógica del asistente IA
  registroCivilService.ts    # Proxy a API del Registro Civil
  interconsultaService.ts    # CRUD interconsultas (getInterconsultas, createInterconsulta, updateEstadoInterconsulta, deleteInterconsulta, asignarCitaInterconsulta)
  slotsService.ts            # Disponibilidad de horarios
```

### 2. Custom hooks como abstracción de datos
Los hooks en `src/hooks/` encapsulan estado y llamadas a servicios. Los componentes consumen hooks, no servicios directamente.

```
Componente → useCitas.ts → citasService.ts → supabase.ts
```

### 3. ConfigContext para estado global compartido
`src/contexts/ConfigContext.tsx` contiene configuraciones cargadas al inicio de sesión (consultorios, usuarios, sucursales, especialidades). Usar `useConfig()` en lugar de recargar datos de configuración desde Supabase en cada componente.

### 4. Sufijo "Supabase" en componentes principales
Los componentes de vista con integración real a Supabase llevan el sufijo `Supabase` (ej. `AgendaViewSupabase.tsx`). Es un marcador histórico de la migración desde datos mock — no agregar este sufijo a componentes nuevos.

### 5. Proxy serverless para APIs externas
El endpoint del Registro Civil de Ecuador no acepta llamadas CORS desde el browser. La llamada pasa por `api/consulta-cedula.ts` (Vercel serverless function) como proxy. Toda llamada a terceros que tenga restricciones CORS debe ir por `api/`.

### 6. Migraciones SQL en `src/supabase/`
Cada cambio de esquema tiene su propio archivo SQL numerado en `src/supabase/`. Hay un índice en `INDICE_SCRIPTS.md`. Al modificar el esquema, crear un nuevo archivo SQL numerado y ejecutarlo desde el SQL Editor del dashboard de Supabase.

### 7. RLS (Row Level Security) en Supabase
**Este proyecto NO usa Supabase Auth nativo.** La autenticación se gestiona mediante una tabla propia — no hay `auth.uid()` ni `auth.role()` disponibles.

Por lo tanto, **todas las tablas deben tener RLS deshabilitado**. Al crear una nueva tabla, nunca agregar `ENABLE ROW LEVEL SECURITY` ni `CREATE POLICY`. Si una tabla tiene RLS habilitado, las operaciones INSERT/UPDATE/DELETE devolverán error 401.

Si al crear una tabla se incluyó RLS por error, corregirlo con:
```sql
ALTER TABLE public.nombre_tabla DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nombre_policy" ON public.nombre_tabla;
```

---

## Convenciones de código

### Nombres de entidades
- Tablas y campos de BD: **español** (`paciente`, `cita`, `usuario`, `compania`, `sucursal`, `consultorio`)
- Interfaces TypeScript: PascalCase siguiendo el nombre de la tabla (`Paciente`, `Cita`, `Usuario`)
- Funciones de servicio: verbo en inglés + entidad en español (`getPacientes`, `updateCita`, `createUsuario`, `deleteCita`)
- Handlers en componentes: prefijo `handle` (`handleLogin`, `handleSubmit`, `handleDelete`)

### Componentes
- Functional components con React hooks
- Interface de props definida antes del componente
- Clases CSS de Tailwind directamente en JSX — no CSS modules, no styled-components
- Importar solo los íconos necesarios desde `lucide-react`

### Manejo de errores
```typescript
// Patrón estándar en servicios
try {
  const { data, error } = await supabase.from('tabla').select(...)
  if (error) throw error
  return data
} catch (error) {
  console.error('❌ Error en operación:', error)
  throw error
}

// En componentes: notificar al usuario con Sonner
toast.error('Mensaje de error para el usuario')
toast.success('Operación exitosa')
```

### Async/await
Siempre usar `async/await` — no usar cadenas `.then()/.catch()`.

### Tipos de Supabase
Los tipos de base de datos viven en `src/lib/supabaseTypes.ts`. Al agregar tablas o columnas, actualizar este archivo antes de modificar el servicio.

---

## Cómo abordar tareas comunes

### Depuración de una query que devuelve datos incorrectos o vacíos

1. Verificar políticas RLS en el dashboard de Supabase para esa tabla
2. Reproducir la query directamente en el SQL Editor de Supabase
3. Revisar el servicio en `src/lib/*Service.ts` — comprobar filtros (`.eq()`, `.filter()`) y joins (`.select('*, tabla_relacionada(*)')`)
4. Buscar `console.error` en browser devtools — los errores del proyecto usan prefijo `❌`
5. Verificar que el `id_compania` o `id_sucursal` del contexto sea el correcto para el usuario logueado

### Agregar una nueva funcionalidad

1. **Definir tipos** en `src/lib/supabaseTypes.ts` si hay nuevas tablas o columnas
2. **Crear el servicio** en `src/lib/nombreService.ts` con funciones CRUD
3. **Crear el hook** en `src/hooks/useNombre.ts` que consume el servicio
4. **Crear el componente** en `src/components/` usando el hook
5. **Registrar la vista** en `src/components/Dashboard.tsx` si es una nueva sección
6. Si requiere cambio de esquema: crear `src/supabase/NNN_descripcion.sql` y ejecutarlo en Supabase

### Agregar un campo a una tabla existente

1. Crear `src/supabase/NNN_add_campo_tabla.sql` con el `ALTER TABLE ... ADD COLUMN ...`
2. Ejecutar en Supabase SQL Editor
3. Actualizar la interface correspondiente en `src/lib/supabaseTypes.ts`
4. Actualizar el servicio: incluir el campo en selects, inserts y updates
5. Actualizar el componente/formulario para mostrar o capturar el campo

### Agregar un nuevo endpoint serverless

1. Crear `api/nombre-endpoint.ts`
2. Seguir el patrón del proxy existente en `api/consulta-cedula.ts`
3. Si requiere rewrite de URL, añadirlo en `vercel.json`

### Problemas de CORS en producción

Las llamadas a APIs externas deben pasar por una serverless function en `api/`. No hacer fetch directo a terceros desde el frontend — funcionará en dev pero fallará en producción.

### Cambiar lógica de disponibilidad / slots

- Lógica de slots: `src/lib/slotsService.ts`
- Citas existentes: `src/lib/citasService.ts`
- Vista de agenda: `src/components/AgendaViewSupabase.tsx`
- Modal de agendar: `src/components/AgendarCitaModalSupabase.tsx`

### Modificar el módulo de interconsultas

- Servicio: `src/lib/interconsultaService.ts`
- Vista del módulo: `src/components/InterconsultasView.tsx`
- Formulario dentro de consulta: buscar bloque `{/* Interconsulta */}` en `src/components/PacientesViewSupabase.tsx`
- Tipos: interfaces `Interconsulta` e `InterconsultaCompleta` en `src/lib/supabaseTypes.ts`
- Migración SQL: `src/supabase/042_interconsultas.sql`

### Modificar precios base o precios por médico

- Componente precio base: `src/components/config/PrecioBaseTabSupabase.tsx`
- Componente precio usuario: `src/components/config/UsuarioSucursalTabSupabase.tsx`
- Hooks: `usePreciosBase()` y `usePreciosUsuario()` en `src/hooks/useConfiguraciones.ts`
- Servicio: funciones `*PrecioBase` y `*PrecioUsuario` en `src/lib/configuracionesService.ts`
- Tablas BD: `precio_base_especialidad` y `precio_usuario_sucursal`

### Editar una cita desde la ficha del paciente

Los roles **secretaria** y **administrador** pueden editar una cita directamente desde el historial de citas del paciente en `PacientesViewSupabase.tsx`. El botón "Editar cita" aparece en cada cita que cumpla:

- Estado distinto de `cancelada` y `no_asistio`
- Sin consulta realizada (`consulta_realizada === false`)

Al hacer clic se abre `AgendarCitaModalSupabase` en modo edición (`citaEditar` prop), pre-llenado con los datos actuales. Al guardar se recargan las citas del paciente con `getCitasByPaciente`.

**Archivos involucrados:**
- `src/components/PacientesViewSupabase.tsx` — botón, estados `citaParaEditar` / `isEditCitaModalOpen`, instancia del modal
- `src/components/AgendarCitaModalSupabase.tsx` — modo edición vía prop `citaEditar`; el `updates` incluye `id_usuario_sucursal` para permitir cambio de médico/sucursal

**Restricción de modificación (`canModificarCita` en `citasService.ts`):** bloquea únicamente si la cita está `cancelada` o tiene `consulta_realizada = true`. No hay restricción de tiempo (la restricción de "1 hora de anticipación" fue eliminada).

---

## Módulo de Precios

### Modelo de datos

El sistema maneja **dos niveles de precios**:

| Nivel | Tabla BD | Interfaz TS | Alcance |
|-------|----------|-------------|---------|
| Precio base | `precio_base_especialidad` | `PrecioBase` | Por cargo del médico, asociado a una compañía |
| Precio por médico | `precio_usuario_sucursal` | `PrecioUsuario` | Por asignación médico-sucursal específica |

### Precio Base (`precio_base_especialidad`)

Define tarifas estándar por **tipo de cargo** del médico dentro de una compañía. Los tres cargos válidos son:

```typescript
const CARGOS = [
  { value: 'MEDICO ESPECIALISTA', label: 'Médico Especialista' },
  { value: 'MEDICO SUPLENTE',     label: 'Médico Suplente' },
  { value: 'MEDICO RESPALDO',     label: 'Médico Respaldo' },
];
```

Campos de la tabla:

```typescript
interface PrecioBase {
  id_precio_base: number;
  id_compania: number;        // Compañía a la que aplica
  cargo: string;              // Uno de los tres cargos válidos (en mayúsculas sin tildes)
  precio_consulta: number;    // Precio para consulta normal
  precio_control: number;     // Precio para consulta de control
  precio_emergencia: number;  // Precio para consulta de emergencia
  estado: 'activo' | 'inactivo';
}
```

**Normalización del cargo**: los valores se guardan en mayúsculas sin tildes ni emojis. La función `normalizeText()` en el componente garantiza consistencia al guardar y al mostrar. Usar `getCargoCanonicalValue()` para guardar y `getCargoDisplayLabel()` para mostrar.

**Precondición**: debe existir al menos una compañía antes de crear un precio base. El componente muestra advertencia si no hay compañías.

**Flujo CRUD**:
```
PrecioBaseTabSupabase → usePreciosBase() → createPrecioBase / updatePrecioBase / deletePrecioBase → precio_base_especialidad
```

### Precio por Médico (`precio_usuario_sucursal`)

Permite definir una tarifa específica para un médico en una sucursal concreta, sobreescribiendo el precio base. Se asocia a un registro de `usuario_sucursal` (asignación médico-sucursal).

Campos relevantes:

```typescript
interface PrecioUsuario {
  id_precio: number;
  id_usuario_sucursal: number;  // FK a la asignación médico-sucursal
  precio_consulta: number;
  duracion_consulta: number;    // Duración en minutos (afecta generación de slots)
  estado: 'activo' | 'inactivo';
}
```

> **Nota importante**: `duracion_consulta` no es solo informativa — es usada por `slotsService.ts` para calcular la disponibilidad de horarios del médico.

### Jerarquía de precios

```
precio_usuario_sucursal  (médico específico en sucursal X)
        ↓ si no existe
precio_base_especialidad (cargo del médico en la compañía)
```

Los cobros (`cobrosService.ts`) deben respetar esta jerarquía al calcular el monto de una cita.

### Función utilitaria

`formatearMoneda(valor: number): string` — formatea números como moneda en USD. Exportada desde `configuracionesService.ts` y re-exportada por `useConfiguraciones.ts`.

---

## Módulo de Interconsultas

### Concepto
Una interconsulta es la derivación formal de un paciente a otro especialista durante una consulta activa. Puede ser **interna** (a un médico de Clínica Atlas) o **externa** (a un especialista fuera de la clínica).

### Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/supabase/042_interconsultas.sql` | Migración SQL — ejecutar en Supabase SQL Editor |
| `src/lib/interconsultaService.ts` | Servicio CRUD completo |
| `src/components/InterconsultasView.tsx` | Vista del módulo (tabla, filtros, detalle, cambio de estado) |
| `src/components/PacientesViewSupabase.tsx` | Contiene el formulario de registro dentro de la consulta |

### Modelo de datos (`interconsulta`)

```typescript
interface Interconsulta {
  id_interconsulta: number
  id_consulta_medica: number | null      // Consulta que la origina
  id_paciente: number | null
  id_usuario_solicitante: number | null  // Médico que solicita
  tipo_destino: 'interno' | 'externo'
  id_usuario_destino: number | null      // Médico interno destino
  id_especialidad_destino: number | null
  especialidad_destino_texto: string | null  // Para destino externo
  medico_destino_externo: string | null      // Para destino externo
  motivo: string
  resumen_clinico: string | null
  urgencia: 'normal' | 'urgente'
  fecha_limite: string | null
  estado: 'pendiente' | 'en_proceso' | 'atendida' | 'cancelada'
  id_cita_generada: number | null        // Cita creada por la secretaria
}
```

### Flujo de trabajo

1. **Médico** registra la interconsulta dentro de la consulta activa (sección morada debajo de "Pedido de Hospitalización" en `PacientesViewSupabase.tsx`). La consulta médica debe existir previamente (auto-guardada).
2. La interconsulta queda en estado **pendiente**.
3. **Secretaria/Administrativo** ve la interconsulta en el módulo "Interconsultas" del menú y puede usar el botón **"Agendar"** para convertirla en una cita real (abre `AgendarCitaModalSupabase`). Al confirmar la cita, el estado pasa a **en_proceso**.
4. El **médico destino** (interno) puede cambiar el estado a **atendida** desde el módulo.
5. Cualquier rol puede marcar como **cancelada**.

### Acceso por rol

| Rol | Qué ve |
|-----|--------|
| Médico | Solo las que él generó + las dirigidas a él |
| Secretaria | Todas; puede convertir internos a cita |
| Enfermera | Todas |
| Administrativo | Todas; puede convertir internos a cita |

### Importante al modificar

- La interconsulta **solo se puede eliminar si está en estado `pendiente`** — el servicio `deleteInterconsulta` filtra por ese estado en BD.
- El formulario de registro **requiere que la consulta médica ya exista** en BD (auto-save activo). Si no hay consulta guardada, muestra toast de error.
- El `id_consulta_medica` se obtiene llamando `getConsultaMedicaByCita(idCita)` en el momento de guardar — no se trackea en estado del componente.

### Modificar interconsultas

```
InterconsultasView.tsx → interconsultaService.ts → tabla interconsulta
PacientesViewSupabase.tsx (formulario) → interconsultaService.ts → tabla interconsulta
```

---

## Build y optimización de chunks

El `vite.config.ts` usa `manualChunks` para dividir los vendors en archivos separados. Esto mejora el tiempo de carga y permite que el browser cachee librerías independientemente del código de la app.

| Chunk | Contenido |
|-------|-----------|
| `vendor-react` | react, react-dom |
| `vendor-supabase` | @supabase/supabase-js, @jsr/supabase |
| `vendor-ui` | @radix-ui/*, cmdk, vaul, embla-carousel |
| `vendor-charts` | recharts, d3 |
| `vendor-pdf` | pdf-lib |
| `vendor-xlsx` | xlsx, fflate |
| `vendor-icons` | lucide-react |
| `vendor-misc` | resto de dependencias |
| `index` | código de la aplicación |

**Regla:** al agregar una dependencia grande (>100 kB), evaluar si merece su propio chunk en `vite.config.ts`.

---

## Comandos de desarrollo

```bash
npm run dev       # Servidor local (http://localhost:5173)
npm run build     # Build de producción en /dist
npm run preview   # Preview del build de producción
```

## Despliegue

El proyecto se despliega automáticamente en Vercel al hacer push a `main`.
- Build: `npm run build` → output: `dist/`
- Serverless functions: archivos en `api/`
- SPA routing: rewrite configurado en `vercel.json`
