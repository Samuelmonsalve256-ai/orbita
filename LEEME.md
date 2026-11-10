# Órbita · Panel de vida

Agenda mensual, alertas, resumen de la mañana, asistente con IA, cola de llamadas para agendar citas y globo 3D con la ruta de tus citas por Colombia.

- **App:** `https://samuelmonsalve256-ai.github.io/Orbita/` (cuando actives GitHub Pages, paso 3)
- **Datos:** el mismo proyecto de Supabase de MotoContable, en tablas propias (`orb_items`, `orb_historial`). No toca nada de MotoContable.
- **Cuenta:** entras con el mismo correo y contraseña de MotoContable.

---

## Qué hace cada archivo

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Toda la app |
| `manifest.webmanifest`, `icono-180.png`, `icono-512.png` | Permiten instalarla en el iPhone y el Mac como una app, con su ícono |
| `sw.js` | Guarda la app para que abra rápido y sin internet (no guarda tus datos) |
| `supabase/01_orbita.sql` | Crea las tablas de Órbita, sus reglas de seguridad y el historial |
| `supabase/functions/orbita-ia/index.ts` | Conecta la app con la IA de Claude. Tu clave de Anthropic vive solo ahí |
| `.claude/skills/design-motion-principles/` | Skill de diseño de animaciones para Claude Code |

---

## PASO 1: Crear las tablas en Supabase (2 minutos)

1. Entra en <https://supabase.com/dashboard> y abre tu proyecto (`llyovzgwdqoeunvyczcy`, el de MotoContable).
2. En el menú izquierdo abre **SQL Editor** → **New query**.
3. Copia todo el contenido de `supabase/01_orbita.sql`, pégalo y pulsa **Run**.
4. Al final debe aparecer una tabla con `orb_items` y `orb_historial`, ambas con `rls_activo = true`.

Se puede ejecutar más de una vez sin problema. No borra nada.

## PASO 2: Revisar tu usuario

Usa el mismo usuario de MotoContable (Authentication → Users). No hay que crear uno nuevo.

## PASO 3: Publicar la app con GitHub Pages

1. En GitHub abre el repositorio **Orbita** → **Settings** → **Pages**.
2. En **Source** elige **Deploy from a branch**.
3. En **Branch** elige `main` y la carpeta `/ (root)`. Pulsa **Save**.
4. Espera 1 o 2 minutos. La dirección aparece arriba: `https://samuelmonsalve256-ai.github.io/Orbita/`.

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

Mientras no hagas este paso, todo lo demás funciona; solo los botones de IA muestran un aviso.

## PASO 5: Instalarla en el iPhone y en el Mac

**iPhone (Safari):** abre la dirección de la app → botón **Compartir** → **Agregar a pantalla de inicio** → **Agregar**.

**Mac (Safari):** abre la dirección → menú **Archivo** → **Agregar al Dock**.
**Mac (Chrome):** abre la dirección → ícono de instalar en la barra de direcciones → **Instalar**.

---

## Cómo se protegen tus datos

- Cada cita, correo y llamada se guarda en Supabase con tu usuario. Las reglas de seguridad impiden que otra cuenta los lea.
- La app nunca borra filas: al eliminar algo solo lo marca como eliminado.
- Cada versión anterior queda en `orb_historial`. Si algo se borra o cambia por error, se puede recuperar.
- Sin internet, los cambios se guardan en el dispositivo y se suben solos al volver la conexión.
- Lo que cambias en el iPhone aparece solo en el Mac (y al revés) en segundos.
