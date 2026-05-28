# Diseño: Tab "Horarios Servicios" en Configuraciones

**Fecha:** 2026-05-27  
**Estado:** Aprobado

---

## Contexto

El módulo de Configuraciones ya tiene un tab "Horarios" (`AsignacionConsultorioTabSupabase`) que gestiona cuándo trabaja un médico en un consultorio. La clínica necesita un tab equivalente para los **servicios** (Tomografía, Rayos X, Laboratorio, etc.) — definiendo cuándo está disponible cada servicio durante la semana.

Este horario sirve hoy como referencia informativa, pero su estructura debe ser compatible con el sistema de generación de slots para poder integrar citas de servicios en el futuro.

---

## Objetivo

Crear el tab **"Horarios Servicios"** en Configuraciones con la misma funcionalidad CRUD que el tab "Horarios", adaptado para servicios:

- Filtrar por **Sucursal → Servicio**  
- Definir días de la semana, hora inicio, hora fin, duración y capacidad por servicio  
- CRUD completo (crear, editar, eliminar, activar/inactivar)

---

## Tabla de base de datos: `horario_servicio`

```sql
CREATE TABLE horario_servicio (
  id_horario_servicio SERIAL PRIMARY KEY,
  id_servicio         INTEGER NOT NULL REFERENCES servicio(id_servicio) ON DELETE CASCADE,
  dia_semana          INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio         TIME NOT NULL,
  hora_fin            TIME NOT NULL,
  duracion_consulta   INTEGER DEFAULT 30 CHECK (duracion_consulta > 0 AND duracion_consulta <= 480),
  capacidad           INTEGER DEFAULT 1 CHECK (capacidad > 0),
  estado              VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_horario_servicio_servicio ON horario_servicio(id_servicio);
CREATE INDEX idx_horario_servicio_dia ON horario_servicio(dia_semana);

-- Trigger updated_at (igual que otras tablas del proyecto)
CREATE TRIGGER update_horario_servicio_updated_at
  BEFORE UPDATE ON horario_servicio
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sin RLS (el proyecto no usa Supabase Auth nativo)
ALTER TABLE horario_servicio DISABLE ROW LEVEL SECURITY;
```

**Relación:** `horario_servicio.id_servicio → servicio.id_servicio`  
La sucursal se obtiene implícitamente a través de `servicio.id_sucursal`.

**Campo `capacidad`:** incluido desde el inicio para preparar la integración futura con `slotsService.ts`. Indica cuántos pacientes pueden ser atendidos simultáneamente en ese bloque de tiempo. Por defecto 1.

---

## Interface TypeScript

```typescript
interface HorarioServicio {
  id_horario_servicio: number;
  id_servicio: number;
  dia_semana: number;        // 1=Lunes … 7=Domingo
  hora_inicio: string;       // "HH:MM"
  hora_fin: string;          // "HH:MM"
  duracion_consulta: number; // minutos
  capacidad: number;         // pacientes simultáneos
  estado: 'activo' | 'inactivo';
  created_at?: string;
  updated_at?: string;
  servicio?: Servicio;       // join con tabla servicio
}
```

Agregar en `src/lib/supabaseTypes.ts` junto a las demás interfaces.

---

## Capa de servicio (`configuracionesService.ts`)

Agregar las siguientes funciones siguiendo el patrón de `getAllAsignacionesConsultorio` / `createAsignacionConsultorio`:

| Función | Descripción |
|---------|-------------|
| `getHorariosByServicio(idServicio)` | Horarios de un servicio específico |
| `getHorariosBySucursal(idSucursal)` | Todos los horarios de la sucursal (join a `servicio`) |
| `createHorarioServicio(horario)` | Crear nuevo horario |
| `updateHorarioServicio(id, updates)` | Editar horario |
| `deleteHorarioServicio(id)` | Eliminar horario |

Select con join: `.select('*, servicio(id_servicio, descripcion, area, id_sucursal)')`.

---

## Hook (`useConfiguraciones.ts`)

```typescript
useHorariosServicio(idSucursal?: number)
```

Mismo patrón que `useAsignacionesConsultorio`:
- Estado: `horarios`, `loading`, `error`
- Métodos: `loadHorarios()`, `agregarHorario()`, `actualizarHorario()`, `eliminarHorario()`

---

## Componente UI: `HorarioServicioTabSupabase.tsx`

Basado en `AsignacionConsultorioTabSupabase.tsx`, con estas diferencias:

### Filtros (header de la vista)
- Selector de **Sucursal** (igual que antes)
- Selector de **Servicio** (reemplaza selector de Médico)
  - Carga servicios activos de la sucursal seleccionada via `useServicios(idSucursal)`

### Tabla de resultados
| Columna | Fuente |
|---------|--------|
| Servicio | `servicio.descripcion` |
| Área | `servicio.area` |
| Día | texto del día (Lunes … Domingo) |
| Horario | `hora_inicio – hora_fin` |
| Duración | `duracion_consulta` min |
| Capacidad | `capacidad` |
| Estado | badge activo/inactivo |
| Acciones | Editar / Eliminar |

### Formulario (Dialog crear/editar)
- **Servicio** — dropdown con servicios activos de la sucursal (obligatorio)
- **Día de la semana** — igual que en Horarios (1-7)
- **Hora inicio / Hora fin** — time inputs
- **Duración** — número en minutos (5–480)
- **Capacidad** — número entero ≥ 1 (default 1)
- **Estado** — switch activo/inactivo

### Validaciones
- `hora_fin > hora_inicio`
- Duración entre 5 y 480 minutos
- Capacidad ≥ 1
- Servicio requerido

---

## Registro del tab en `ConfiguracionesViewSupabase.tsx`

```typescript
{ value: 'horarios-servicios', label: 'Horarios Servicios', icon: CalendarClock }
```

```tsx
<TabsContent value="horarios-servicios">
  <HorarioServicioTabSupabase />
</TabsContent>
```

---

## Migración SQL

Archivo: `src/supabase/059_horario_servicio.sql`

---

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `src/supabase/059_horario_servicio.sql` | **Crear** — DDL de la tabla |
| `src/lib/supabaseTypes.ts` | **Modificar** — agregar `HorarioServicio` |
| `src/lib/configuracionesService.ts` | **Modificar** — agregar 5 funciones CRUD |
| `src/hooks/useConfiguraciones.ts` | **Modificar** — agregar `useHorariosServicio` |
| `src/components/config/HorarioServicioTabSupabase.tsx` | **Crear** — componente UI |
| `src/components/ConfiguracionesViewSupabase.tsx` | **Modificar** — registrar tab |

---

## Verificación

1. Ejecutar `059_horario_servicio.sql` en Supabase SQL Editor — verificar que la tabla se crea sin errores y RLS está deshabilitado
2. Ir a Configuraciones → tab "Horarios Servicios"
3. Seleccionar una sucursal → verificar que el dropdown de servicios carga
4. Crear un horario → verificar que aparece en la tabla
5. Editar el horario → verificar que los campos se pre-cargan y se guardan correctamente
6. Eliminar el horario → verificar que desaparece de la tabla
7. Verificar que el tab "Horarios" original no fue afectado

---

## Consideración futura (no en este alcance)

Cuando se integre con `slotsService.ts`, el campo `capacidad` permitirá generar N slots paralelos por bloque de tiempo. La relación `usuario_sucursal.id_servicio` (ya existente desde `057_usuario_sucursal_servicio.sql`) indicará qué técnicos/médicos operan cada servicio.
