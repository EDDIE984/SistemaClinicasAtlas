# 📚 Índice de Scripts SQL - Guía Rápida

## 🚨 PROBLEMA ACTUAL
Error al marcar citas como completadas:
```
null value in column "id_usuario_cambio" violates not-null constraint
```

---

## ⚡ SOLUCIÓN RÁPIDA (30 segundos)

### 👉 USA ESTE ARCHIVO: **`EJECUTAR_ESTO.sql`**

**Qué hace:**
- Muestra el problema actual
- Deshabilita el trigger problemático
- Verifica que el fix funcionó

**Cómo usar:**
1. Abre Supabase SQL Editor
2. Copia TODO el contenido de `EJECUTAR_ESTO.sql`
3. Pega en el editor
4. Click "Run"
5. Busca: `✅✅✅ TRIGGER DESHABILITADO`

**Resultado:** Problema resuelto ✅

---

## 📂 TODOS LOS ARCHIVOS DISPONIBLES

### 🎯 Para Resolver el Problema

| Archivo | Tiempo | Descripción | Cuándo Usar |
|---------|--------|-------------|-------------|
| **EJECUTAR_ESTO.sql** | 30 seg | Fix rápido todo-en-uno | **⭐ RECOMENDADO - Usar primero** |
| **DESHABILITAR_TRIGGER_AHORA.sql** | 10 seg | Solo la línea esencial | Si solo quieres el comando mínimo |
| **EJECUTAR_PASO_A_PASO.sql** | 5 min | Fix completo con explicaciones | Si quieres entender cada paso |

---

### 🔍 Para Diagnosticar

| Archivo | Tiempo | Descripción | Cuándo Usar |
|---------|--------|-------------|-------------|
| **DIAGNOSTICO_RAPIDO.sql** | 2 min | Estado completo del sistema | Antes o después del fix |
| **VERIFICAR_FIX.sql** | 1 min | Confirmar que el fix funcionó | Después de aplicar el fix |

---

### 📖 Documentación

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| **README_EJECUTAR_SCRIPTS.md** | Guía completa | Instrucciones detalladas de todos los scripts |
| **INSTRUCCIONES_VISUALES.md** | Tutorial visual | Paso a paso con capturas conceptuales |
| **INDICE_SCRIPTS.md** | Este archivo | Índice rápido de referencia |

---

### 🗄️ Otros Scripts (No necesarios para el fix actual)

| Archivo | Descripción |
|---------|-------------|
| `migration.sql` | Migración inicial de la base de datos |
| `seed_data.sql` | Datos de prueba |
| `ADD_*.sql` | Scripts para agregar tablas específicas |
| `FIX_*.sql` | Fixes anteriores (ya aplicados) |
| `CREATE_RPC_*.sql` | Funciones RPC (no usadas actualmente) |
| `067_gestor_role.sql` | Agrega el rol `GESTOR` al constraint de tipos de usuario |
| `068_fix_relacion_usuario_sucursal_servicio.sql` | Re-asegura el FK `usuario_sucursal.id_servicio -> servicio` y recarga el cache de esquema de PostgREST |
| `069_conversacion_chatbot_estado_completado.sql` | Normaliza el CHECK de `conversacion_chatbot.estado` para permitir `pendiente`, `completado` y `cancelado` |
| `070_cita_servicio_origen_agendamiento.sql` | Agrega `cita_servicio.origen_agendamiento` (`SISTEMA` / `CHATBOT`), igual que en `cita` |
| `071_recordatorio_whatsapp.sql` | Crea `recordatorio_whatsapp`: historial de recordatorios de cita enviados por WhatsApp a pacientes y médicos |

---

## 🎬 Flujo Recomendado para Resolver el Problema

### Opción 1: Fast Track (RECOMENDADO) ⚡
```
1. EJECUTAR_ESTO.sql
   ↓
2. Probar en la app
   ↓
3. ✅ Listo!
```

### Opción 2: Con Diagnóstico 🔍
```
1. DIAGNOSTICO_RAPIDO.sql (ver el problema)
   ↓
2. EJECUTAR_ESTO.sql (aplicar fix)
   ↓
3. VERIFICAR_FIX.sql (confirmar)
   ↓
4. Probar en la app
   ↓
5. ✅ Listo!
```

### Opción 3: Detallada 📋
```
1. DIAGNOSTICO_RAPIDO.sql
   ↓
2. EJECUTAR_PASO_A_PASO.sql
   ↓
3. VERIFICAR_FIX.sql
   ↓
4. Probar en la app
   ↓
5. ✅ Listo!
```

---

## 🎯 Guía de Decisión Rápida

### "Solo quiero arreglar el problema YA"
→ **`EJECUTAR_ESTO.sql`**

### "Quiero entender qué está pasando"
→ **`DIAGNOSTICO_RAPIDO.sql`** primero, luego **`EJECUTAR_ESTO.sql`**

### "Necesito documentación completa"
→ Lee **`README_EJECUTAR_SCRIPTS.md`**

### "Quiero instrucciones paso a paso con imágenes"
→ Lee **`INSTRUCCIONES_VISUALES.md`**

### "Solo dame el comando SQL mínimo"
→ **`DESHABILITAR_TRIGGER_AHORA.sql`**, línea 15:
```sql
ALTER TABLE cita DISABLE TRIGGER trigger_historial_estado_cita;
```

### "¿Cómo verifico que funcionó?"
→ **`VERIFICAR_FIX.sql`**

---

## 📊 Comparación de Scripts

### EJECUTAR_ESTO.sql
- ✅ Rápido (30 segundos)
- ✅ Todo en uno
- ✅ Muestra resultados inmediatos
- ✅ Fácil de usar
- **Recomendado para:** Resolver el problema rápidamente

### DIAGNOSTICO_RAPIDO.sql
- ✅ Ver estado actual completo
- ✅ Estadísticas detalladas
- ✅ No hace cambios
- **Recomendado para:** Entender el problema antes de aplicar el fix

### EJECUTAR_PASO_A_PASO.sql
- ✅ Explicaciones detalladas
- ✅ Muestra cada paso
- ✅ Incluye comentarios
- ✅ Opciones adicionales
- **Recomendado para:** Aprender mientras resuelves

### VERIFICAR_FIX.sql
- ✅ Confirma que el trigger está deshabilitado
- ✅ Muestra últimos registros
- ✅ Verifica estructura de tablas
- **Recomendado para:** Después de aplicar el fix

### DESHABILITAR_TRIGGER_AHORA.sql
- ✅ Solo el comando esencial
- ✅ Minimalista
- **Recomendado para:** Usuarios avanzados que ya conocen el problema

---

## 🔧 Qué Archivo Usar Según tu Situación

### Situación 1: "Nunca he visto este error antes"
```
1. INSTRUCCIONES_VISUALES.md (leer primero)
2. DIAGNOSTICO_RAPIDO.sql (entender el problema)
3. EJECUTAR_ESTO.sql (resolver)
4. VERIFICAR_FIX.sql (confirmar)
```

### Situación 2: "Ya sé del problema, solo arréglalo"
```
1. EJECUTAR_ESTO.sql
2. Probar en la app
```

### Situación 3: "Quiero aprender mientras lo resuelvo"
```
1. README_EJECUTAR_SCRIPTS.md (leer)
2. DIAGNOSTICO_RAPIDO.sql
3. EJECUTAR_PASO_A_PASO.sql
4. VERIFICAR_FIX.sql
```

### Situación 4: "Ya ejecuté algo pero no sé si funcionó"
```
1. VERIFICAR_FIX.sql
2. Si muestra "✅ DESHABILITADO" → Listo
3. Si muestra "❌ HABILITADO" → EJECUTAR_ESTO.sql
```

### Situación 5: "Necesito documentación para mi equipo"
```
1. README_EJECUTAR_SCRIPTS.md (guía técnica)
2. INSTRUCCIONES_VISUALES.md (tutorial visual)
3. INDICE_SCRIPTS.md (referencia rápida)
```

---

## ⚠️ Advertencias Importantes

### ❌ NO Ejecutes Estos Archivos (para el fix actual)
- `migration.sql` - Solo para setup inicial
- `seed_data.sql` - Solo para datos de prueba
- `ADD_*.sql` - Solo si necesitas agregar tablas nuevas
- `CREATE_RPC_*.sql` - No se usa actualmente

### ✅ SÍ Ejecuta (para resolver el problema)
- `EJECUTAR_ESTO.sql` ← **ESTE ES EL QUE NECESITAS**
- `DIAGNOSTICO_RAPIDO.sql` (opcional)
- `VERIFICAR_FIX.sql` (opcional)

---

## 🎓 Glosario

**Trigger:** Función automática que se ejecuta cuando ocurre un evento en la base de datos  
**id_usuario_cambio:** Columna que registra qué usuario hizo el cambio de estado  
**historial_estado_cita:** Tabla que guarda todos los cambios de estado de las citas  
**NOT NULL constraint:** Restricción que impide valores nulos en una columna  

---

## 📞 Contacto y Soporte

Si después de ejecutar `EJECUTAR_ESTO.sql` sigues teniendo problemas:

1. Ejecuta `DIAGNOSTICO_RAPIDO.sql` y copia los resultados
2. Ejecuta `VERIFICAR_FIX.sql` y copia los resultados
3. Abre la consola del navegador (F12) y copia los errores
4. Revisa `/lib/citasService.ts` para verificar que el código está actualizado

---

## ✅ Checklist de Ejecución

- [ ] He leído este índice
- [ ] Sé qué archivo voy a ejecutar: **`EJECUTAR_ESTO.sql`**
- [ ] Tengo acceso a Supabase SQL Editor
- [ ] Tengo permisos de administrador
- [ ] He copiado el contenido del archivo
- [ ] He pegado en SQL Editor
- [ ] He ejecutado con "Run"
- [ ] He visto el mensaje de éxito: "✅✅✅ TRIGGER DESHABILITADO"
- [ ] He probado en la aplicación
- [ ] La cita se marca como completada sin errores
- [ ] **¡PROBLEMA RESUELTO!** 🎉

---

## 🚀 Próximos Pasos Después del Fix

Una vez resuelto el problema:

1. ✅ Marcar varias citas como completadas (prueba)
2. ✅ Verificar el historial en la base de datos
3. ✅ Confirmar que `id_usuario_cambio` tiene valores
4. ✅ Revisar que no hay otros errores en la consola
5. ✅ Continuar con el desarrollo normal

---

## 📈 Estado del Proyecto

### ✅ Completado
- Migración de 14 tablas a Supabase
- 7 módulos funcionando
- Guardado automático en tiempo real
- Código TypeScript corregido (`observaciones` en vez de `motivo_cambio`)

### ⚠️ Pendiente
- **Ejecutar `EJECUTAR_ESTO.sql` en Supabase** ← Estás aquí

### 🎯 Después del Fix
- Sistema 100% funcional
- Todas las funcionalidades operativas

---

**Última actualización:** Scripts corregidos con nombres de columnas PostgreSQL correctos  
**Versión:** 1.0 - Scripts listos para ejecutar  
**Estado:** ✅ Todo listo para resolver el problema
