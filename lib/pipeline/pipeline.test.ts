import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeSite, stageForAnalysis } from './analyze-site'
import { FetchFailure, isPublicAddress, type FetchedPage } from './fetch-site'
import { classifyWebsite, extractWhatsappNumbers, phoneToDigits, placeIdFrom, triageLead } from './triage'

const NOW = new Date('2026-10-13T12:00:00Z')

function page(body: string, extra: Partial<FetchedPage> = {}): FetchedPage {
  return {
    requestedUrl: 'https://despacho.mx/',
    finalUrl: 'https://despacho.mx/',
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body,
    redirects: [],
    elapsedMs: 400,
    tlsError: null,
    ...extra,
  }
}

const filler = 'Somos un despacho con práctica en derecho civil, mercantil y familiar. '.repeat(30)
const healthy = `<html><head><title>Despacho</title><meta name="viewport" content="width=device-width">
<meta name="description" content="Abogados"></head><body><p>${filler}</p>
<a href="tel:+525512345678">Llamar</a><a href="https://wa.me/525512345678">WhatsApp</a>
<footer>© 2026 Despacho</footer></body></html>`

describe('triage', () => {
  it('distingue sitio propio, redes y WhatsApp', () => {
    assert.deepEqual(classifyWebsite('https://www.Despacho.com.mx/inicio'), { kind: 'web', domain: 'despacho.com.mx', whatsapp: null })
    assert.equal(classifyWebsite('https://www.facebook.com/despacho').kind, 'social')
    assert.equal(classifyWebsite('instagram.com/despacho').kind, 'social')
    assert.deepEqual(classifyWebsite('https://wa.me/5215512345678'), { kind: 'whatsapp', domain: null, whatsapp: '525512345678' })
    assert.equal(classifyWebsite('').kind, 'none')
    assert.equal(classifyWebsite('no es url').kind, 'none')
  })

  it('no confunde sites.google.com con una red social y no comparte dominio', () => {
    const site = classifyWebsite('https://sites.google.com/view/robles-abogados/inicio')
    assert.equal(site.kind, 'web')
    assert.equal(site.domain, 'sites.google.com/view/robles-abogados')
  })

  it('normaliza teléfonos mexicanos para wa.me', () => {
    assert.equal(phoneToDigits('+52 55 4468 9187', 'mx'), '525544689187')
    assert.equal(phoneToDigits('+52 1 55 4468 9187', 'mx'), '525544689187')
    assert.equal(phoneToDigits('55 4468 9187', 'mx'), '525544689187')
    assert.equal(phoneToDigits('(449) 125-4443', null), '524491254443')
    assert.equal(phoneToDigits('+1 415 555 0100', 'us'), '14155550100')
    assert.equal(phoneToDigits('123', 'mx'), null)
  })

  it('extrae WhatsApp de enlaces en el HTML', () => {
    const html = `<a href="https://api.whatsapp.com/send?phone=5215598982031&text=hola">x</a>
      <a href='https://wa.me/+52%2055%201234%205678'>y</a><a href="https://wa.me/message/H7NMJ">z</a>`
    assert.deepEqual(extractWhatsappNumbers(html).sort(), ['525512345678', '525598982031'])
  })

  it('toma el place id de la URL de Maps', () => {
    assert.equal(placeIdFrom(null, 'https://www.google.com/maps/search/?api=1&query=X&query_place_id=ChIJabc'), 'ChIJabc')
    assert.equal(placeIdFrom('ChIJexplicit', null), 'ChIJexplicit')
  })

  it('manda a revisión solo a quien tiene sitio propio', () => {
    const withSite = triageLead({ website: 'despacho.mx', phone: '55 1234 5678', mapsUrl: null, countryCode: 'mx' })
    assert.equal(withSite.stage, 'to_check')
    assert.equal(withSite.checkState, 'pending')
    const social = triageLead({ website: 'https://facebook.com/x', phone: null, mapsUrl: null, countryCode: 'mx' })
    assert.equal(social.stage, 'no_site')
    assert.equal(social.checkState, 'skipped')
  })
})

describe('isPublicAddress', () => {
  it('bloquea direcciones internas', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.17.0.2', '192.168.1.1', '169.254.169.254', '100.64.1.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1']) {
      assert.equal(isPublicAddress(ip), false, ip)
    }
  })
  it('permite direcciones públicas', () => {
    for (const ip of ['8.8.8.8', '104.21.3.4', '172.32.0.1', '2606:4700::1111']) {
      assert.equal(isPublicAddress(ip), true, ip)
    }
  })
})

describe('analyzeSite', () => {
  it('un sitio sano y moderno no es candidato', () => {
    const analysis = analyzeSite(page(healthy), { now: NOW })
    assert.equal(analysis.status, 'ok')
    assert.deepEqual(analysis.whatsapp, ['525512345678'])
    assert.equal(stageForAnalysis(analysis), 'site_ok')
  })

  it('detecta el error crítico de WordPress', () => {
    const analysis = analyzeSite(
      page('<html><title>WordPress › Error</title><body>Ha habido un error crítico en esta web.</body></html>', { status: 500 }),
      { now: NOW }
    )
    assert.equal(analysis.status, 'broken')
    assert.equal(analysis.issues[0].code, 'wp_critical')
    assert.equal(stageForAnalysis(analysis), 'candidate')
  })

  it('detecta sitio en construcción', () => {
    const analysis = analyzeSite(page('<html><title>Home</title><body><h1>Estamos trabajando en la construcción de nuestro nuevo sitio</h1><p>En construcción</p></body></html>'), { now: NOW })
    assert.equal(analysis.status, 'construction')
  })

  it('no marca "en construcción" en un sitio largo que lo menciona de pasada', () => {
    const body = healthy.replace('</body>', '<p>Asesoría en construcción de inmuebles.</p></body>')
    assert.equal(analyzeSite(page(body), { now: NOW }).status, 'ok')
  })

  it('detecta dominio estacionado', () => {
    const analysis = analyzeSite(page('<html><body>This domain is for sale! Buy this domain at Afternic.</body></html>'), { now: NOW })
    assert.equal(analysis.status, 'parked')
  })

  it('suma los problemas de un sitio viejo', () => {
    const old = `<html><head><title>Abogados</title></head><body><font>a</font><font>b</font><font>c</font><font>d</font><font>e</font>
      <p>${filler}</p><a href="/movil/index.html">Versión móvil</a><p>Copyright © 2015 Abogados</p></body></html>`
    const analysis = analyzeSite(page(old, { finalUrl: 'http://despacho.mx/' }), { now: NOW })
    const codes = analysis.issues.map((i) => i.code)
    for (const code of ['no_viewport', 'separate_mobile', 'legacy_tech', 'old_copyright', 'no_https', 'no_contact']) {
      assert.ok(codes.includes(code), code)
    }
    assert.ok(analysis.score >= 90)
    assert.equal(stageForAnalysis(analysis), 'candidate')
  })

  it('un sitio caído es candidato y un bloqueo anti-robots va a revisión manual', () => {
    assert.equal(stageForAnalysis(analyzeSite(new FetchFailure('dns', 'x'), { now: NOW })), 'candidate')
    assert.equal(stageForAnalysis(analyzeSite(page('<html>Just a moment...</html>', { status: 403 }), { now: NOW })), 'unverified')
  })

  it('distingue un destino de redirección inexistente de uno que solo tardó', () => {
    assert.equal(analyzeSite(new FetchFailure('dns', 'Redirige a www.x.mx, que no abre'), { now: NOW }).status, 'dead')
    const slow = analyzeSite(new FetchFailure('timeout', 'Redirige a x.mx, que no abre'), { now: NOW })
    assert.equal(slow.status, 'unverified')
    assert.equal(slow.issues[0].label, 'Redirige a x.mx, que no respondió a tiempo')
  })

  it('reconoce un dominio que redirige a Facebook', () => {
    const analysis = analyzeSite(page('<html></html>', { finalUrl: 'https://www.facebook.com/despacho' }), { now: NOW })
    assert.equal(analysis.status, 'social')
  })

  it('marca un dominio que ya no habla del negocio', () => {
    const store = healthy.replace('Despacho</title>', 'Tienda en línea</title>').replace(/Somos un despacho[^<]*/g, 'Compra ropa y accesorios con envío gratis. '.repeat(20))
    const analysis = analyzeSite(page(store), { now: NOW, businessName: 'Elías Calles & Karam Abogados' })
    assert.ok(analysis.issues.some((i) => i.code === 'name_mismatch'))
    const own = analyzeSite(page(healthy.replace('Despacho</title>', 'Elias Calles y Karam</title>')), { now: NOW, businessName: 'Elías Calles & Karam Abogados' })
    assert.ok(!own.issues.some((i) => i.code === 'name_mismatch'))
  })

  it('no cuenta Site Kit by Google como Google Sites', () => {
    const html = healthy.replace('<head>', '<head><meta name="generator" content="Site Kit by Google 1.120"><meta name="generator" content="WordPress 6.6.2">')
    assert.equal(analyzeSite(page(html), { now: NOW }).cms, 'WordPress')
  })
})
