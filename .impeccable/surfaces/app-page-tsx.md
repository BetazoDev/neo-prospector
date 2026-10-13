---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/bases/[jobId]/page.tsx","app/bases/page.tsx","app/embudo/page.tsx","app/login/page.tsx"]
---

# Surface brief: Prospector app (shell, Inicio, Bases, Embudo, base, ficha del negocio, acceso)

## Scope and mode
Operate. The whole internal app: the persistent shell and every working screen. Spanish (Mexico).

## Audience, job, constraints
Hemeron's owner and a few sellers. Start a search for any niche in any zone, see which businesses need a new site and why, work them from a desk or a phone. Always visible in the shell: recent bases, stage counters, global search (Cmd/Ctrl+K), live background activity. Must not feel like a generic admin template, flashy, a spreadsheet, or awkward on a phone.

## Direction contract
THESIS: Every business found is a dot. The prospector is a search box over the living field of all your bases: as sites are checked the field fills, crimson where a redesign is due. It refuses the category default of an icon sidebar, a grid of stat cards and a spreadsheet of rows.
OWN-WORLD: hemeron.com's fields. Carbon #0e0e0e for the shell and every page header, niebla #ecebeb as the work field under lists, paper #f6f6f5 panels, crimson #ce0037 only for candidates and the primary action, vino #6e0112 pressed, aluminio greys for checked-and-fine. Clash Grotesk 500 display with a dimmed second line, Switzer for everything read, small uppercase tracked labels only for meta, legends and column heads. Pill buttons. Dots of 7 to 10 px.
STORY: The seller types a niche and a zone and presses Buscar negocios. The new base appears as a row of dim dots that turn crimson or grey as each site is checked. They open the base, filter by its crimson dots, read in one line why each business needs a new site, step through them in the ficha with J/K, and tap WhatsApp.
FIRST VIEWPORT: Carbon top bar: logo and "Prospector", Inicio, Bases (recent bases menu), Embudo, the Cmd+K search field, the live activity pill, the account menu; under it a stage rail of counts that link to Embudo. Left five columns: "¿Qué negocios / buscamos hoy?" in Clash at 64 px, one line of lede, Giro and Zona fields and the crimson pill "Buscar negocios". Right seven columns: "Tus bases", each recent base a row of name, dot field and crimson candidate count. Primary action: the pill.
FORM: Campo de puntos, position 6 of 7 on my ordered list, seed key 66d5c5f5. Signature move: the dot field, live (fills as checks land, pulses where a site is being checked) and linked to the list (hovering a row lights its dot, clicking a dot opens that business).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Memorable moment
Watching a fresh base's dots turn crimson one by one while you are still on the home screen.

## Unresolved
- Per-seller accounts do not exist yet; the account menu shows the single login.
- Phase 2 and 3 stages (demo lista, contactado, respondió, cliente) are counted from day one but stay at 0 until those phases ship.
