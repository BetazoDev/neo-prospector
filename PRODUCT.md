# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
The Hemeron team: the owner, who runs the operation, plus a few sellers who share the same bases. Together they search Google Maps for any niche in any zone ("whatever my mind thinks of"), see which businesses have a weak or broken website, get a redesign demo built for the good candidates, and contact the business by WhatsApp with that demo. Reviewing happens at a desk in long sessions; contacting happens just as often from a phone, on the go.

## Product Purpose
Hemeron Prospector is Hemeron's internal prospecting tool (Hemeron is a custom-software studio in Aguascalientes, hemeron.com). It turns a search ("dentists in Querétaro") into a short list of businesses worth pitching, with the reason each one needs a new site, and moves each lead from search to first conversation. Success is more qualified first conversations per hour of team time, each started with a real demo of the business's own site.

## Positioning
Hemeron does not pitch with a portfolio: it shows each business its own website already redesigned with its real logo, colors and published information, before the first message. The prospector is the pipeline that makes that possible at volume: scrape, automatic site check, deep research, demo build, WhatsApp with the demo link.

## Operating Context
- Searches run on Apify (Google Maps actor) by niche plus zone; each search becomes a "base". CSV import is also supported.
- On import, every lead is classified (own website, social profile only, WhatsApp only, none) and its website is checked on the server: status, errors, mobile support, age, platform, published WhatsApp. The check produces an opportunity score and a stage.
- Next phases (planned, not built yet): a worker on the owner's Mac (headless Claude Code on the owner's Claude plan) does a visual audit, a mandatory deep research of each business (Google Maps, social networks, directories, Wayback), builds the demo in Astro, and publishes it to demos.diabolicalservices.tech (auto-deploy on push). Then outreach: prefilled WhatsApp messages (click to send, never automated sending) and contact tracking.
- Deployed on Dokploy (prospector.diabolicalservices.tech), Next.js 16 with PostgreSQL.
- Interface language: Spanish (Mexico).

## Capabilities and Constraints
- Today: login, searches via Apify, CSV import/export, bases, automatic triage and site check, stages (candidato, sitio aceptable, revisión manual, sin sitio, descartado), lead detail with findings, WhatsApp click-to-chat.
- One shared login exists today; separate accounts per seller are undecided.
- Niches are open-ended: the product must not assume law firms, even though the first demos were law firms.
- Lead data is public business information from Google Maps and the business's own site.
- Exported CSVs keep their first ten column names (ID, Empresa, Categoría, Teléfono, Rating, Reseñas, Ciudad, Dirección, Sitio Web, Google Maps) because the demo tooling in ~/Claude reads them by name.

## Brand Commitments
- Name and logo: Hemeron (wordmark from hemeron.com), product name "Prospector".
- The user asked for the hemeron.com brand: its palette (carbon #0e0e0e, crimson #ce0037, vino #6e0112, paper #f6f6f5, aluminio #d7d8d7, niebla #ecebeb) and its typefaces (Clash Grotesk, Switzer).
- Voice: direct Spanish of Mexico, plain words, no hype.

## Evidence on Hand
- Real bases exported from the prospector (e.g. ~/Claude/contacto/_fuente/base-5-2026-10-12.csv, 100 law firms in CDMX).
- Demos already built: lista 1 (Next.js, ~65 sites) and lista 2 (Astro) in ~/Claude/portafolio, live at demos.diabolicalservices.tech.
- Contact messages and WhatsApp numbers per firm in ~/Claude/contacto/contactos.json.
- No client results, conversion figures or testimonials exist yet: nothing of that kind may be invented in the interface.

## Product Principles
1. The next lead to work is always obvious: the interface ranks by opportunity and says why.
2. Truth over volume: every finding shows its evidence and its confidence; nothing about a business is invented.
3. Background work is visible: searches, checks and demo builds show their progress and never strand the user.
4. Works in the field: reviewing on a desk and contacting from a phone are both first-class.
5. Any niche, any zone: nothing in the product is tied to one industry.

## Accessibility & Inclusion
WCAG AA contrast for text; Spanish copy throughout.
