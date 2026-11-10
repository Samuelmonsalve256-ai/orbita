# CRONOVA · Agenda inteligente

Tu centro de mando personal: agenda, alertas, resumen de la mañana, asistente con IA, llamadas para agendar citas y un mapa 3D de Colombia con tu recorrido, kilómetros y tiempos.

- **App:** `https://samuelmonsalve256-ai.github.io/orbita/`
- **Datos:** el mismo proyecto de Supabase de MotoContable, en tablas propias (`orb_items`, `orb_historial`). No toca nada de MotoContable.
- **Cuenta:** entras con el mismo correo y contraseña de MotoContable.
- **Lugares:** los 1.122 municipios de Colombia del DANE, más tus lugares guardados (Doradal viene incluido). Los pueblos, corregimientos y veredas que no estén se buscan en OpenStreetMap y quedan guardados.
- **Rutas:** distancias y tiempos por carretera de OpenStreetMap (servicio OSRM). Cada tramo tiene un botón para abrirlo en Waze con el tráfico en vivo.

---

## Qué hace cada archivo

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la app |
| `css/cronova.css` | Diseño: 4 temas de color y 3 tipografías |
| `js/app.js` | Toda la lógica: agenda, nube, IA, rutas, sonidos, ajustes |
| `js/mapa.js` | Mapa 3D de Colombia |
| `js/vendor/` | Librerías incluidas (three.js, supabase-js) para que funcione sin depender de otros servidores |
| `data/colombia.json` | Departamentos y municipios con sus coordenadas |
| `data/colombia-hex.json` | Colombia en hexágonos por departamento para el planeta del mapa |
| `manifest.webmanifest`, `icono-*.png`, `img/` | Ícono y logo para instalarla en el iPhone y el Mac |
| `sw.js` | Guarda la app para que abra rápido y sin internet (no guarda tus datos) |
| `supabase/01_orbita.sql` | Crea las tablas, las reglas de seguridad y el historial |
| `supabase/02_cronova.sql` | Permite guardar tus Ajustes en la nube (nombre, casa, colores) |
| `supabase/functions/orbita-ia/index.ts` | Conecta la app con la IA de Claude. Tu clave de Anthropic vive solo ahí |
| `.claude/skills/design-motion-principles/` | Skill de diseño de animaciones para Claude Code |

---

## PASO 1: Crear las tablas en Supabase

1. Entra en <https://supabase.com/dashboard> y abre tu proyecto (`llyovzgwdqoeunvyczcy`, el de MotoContable).
2. En el menú izquierdo abre **SQL Editor** → **New query**.
3. Copia todo el contenido de `supabase/01_orbita.sql`, pégalo y pulsa **Run** (o **Command + Enter**).
4. Al final debe aparecer una tabla con `orb_items` y `orb_historial`, ambas con `rls_activo = true`.
5. Haz lo mismo con `supabase/02_cronova.sql`. Debe mostrar una regla que incluye `'config'`.

Los dos se pueden ejecutar más de una vez sin problema. No borran nada.

## PASO 2: Revisar tu usuario

Usa el mismo usuario de MotoContable (Authentication → Users). No hay que crear uno nuevo.

## PASO 3: Publicar la app con GitHub Pages

1. En GitHub abre el repositorio **Orbita** → **Settings** → **Pages**.
2. En **Source** elige **Deploy from a branch**.
3. En **Branch** elige `main` y la carpeta `/ (root)`. Pulsa **Save**.
4. Espera 1 o 2 minutos. La dirección aparece arriba: `https://samuelmonsalve256-ai.github.io/orbita/`.

## PASO 4: Activar la IA

La IA necesita una clave de Anthropic (se paga por uso, aparte de tu plan de Claude).

1. Crea la clave en <https://console.anthropic.com> → **API Keys** → **Create Key**. Cópiala.
2. En Supabase abre **Edge Functions** → **Secrets** (o **Project Settings → Edge Functions**) y agrega:
   - `ANTHROPIC_API_KEY` = la clave que copiaste.
   - `ORBITA_CORREOS` = tu correo (así nadie más puede gastar tu saldo).
3. Despliega la función `orbita-ia`. Hay dos formas:
   - **Desde el panel:** **Edge Functions** → **Deploy a new function** → **Via Editor**, nombre `orbita-ia`, pega el contenido de `supabase/functions/orbita-ia/index.ts` y pulsa **Deploy**.
   - **Desde la terminal del Mac:** `supabase functions deploy orbita-ia --project-ref llyovzgwdqoeunvyczcy`
4. Deja activada la opción **Verify JWT** (solo usuarios con sesión pueden usarla).

Mientras no hagas este paso, todo lo demás funciona; solo los botones de IA muestran un aviso. Para comprobarla: **Ajustes → Inteligencia artificial → Probar conexión**.

## PASO 5: Instalarla en el iPhone y en el Mac

**iPhone (Safari):** abre la dirección de la app → botón **Compartir** → **Agregar a pantalla de inicio** → **Agregar**.

**Mac (Safari):** abre la dirección → menú **Archivo** → **Agregar al Dock**.
**Mac (Chrome):** abre la dirección → ícono de instalar en la barra de direcciones → **Instalar**.

---

## Reglas de la agenda

- Solo se agenda de **hoy en adelante**, hasta el **31 de diciembre del año siguiente**. Los días que ya pasaron se ven rayados y no se pueden elegir.
- La fecha y la hora se actualizan solas, y el saludo cambia según la hora: buenos días, buenas tardes o buenas noches.
- Tu nombre y tu casa se cambian en **Ajustes → Perfil y casa**.

## Cómo se protegen tus datos

- Cada cita, correo y llamada se guarda en Supabase con tu usuario. Las reglas de seguridad impiden que otra cuenta los lea.
- La app nunca borra filas: al eliminar algo solo lo marca como eliminado.
- Cada versión anterior queda en `orb_historial`. Si algo se borra o cambia por error, se puede recuperar.
- Sin internet, los cambios se guardan en el dispositivo y se suben solos al volver la conexión.
- Lo que cambias en el iPhone aparece solo en el Mac (y al revés) en segundos.
