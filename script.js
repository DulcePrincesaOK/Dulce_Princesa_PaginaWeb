// ════════════════════════════════════════════════════════
//  CONFIGURACIÓN FIREBASE — viene de config.js
// ════════════════════════════════════════════════════════
firebase.initializeApp(SITE_CONFIG.firebase);
const db = firebase.firestore();
// Cada producto es un documento en la subcolección "productos"
// La metadata (categorías, orden, etc.) va en un doc separado "__meta__"
const PRODS_COL = db.collection('catalogo').doc('productos').collection('items');
const META_REF  = db.collection('catalogo').doc('_meta');
// Índice: UN documento con TODOS los productos (solo texto + URLs de Cloudinary).
// Los visitantes leen solo este doc → 1 lectura en vez de 1 por producto.
// La fuente de verdad sigue siendo PRODS_COL (compatible con el respaldo).
const INDICE_REF = db.collection('catalogo').doc('_indice');
// Config de Cloudinary (cloud name + preset). Solo legible por admins (ver reglas).
const CLOUDINARY_REF = db.collection('privado').doc('cloudinary');
const auth = firebase.auth();


//MANTENER SESIÓN
auth.onAuthStateChanged(user => {
  if(user && ADMIN_REQUEST){
    const yaEraAdmin = ADMIN_MODE;
    ADMIN_MODE = true;
    document.body.classList.add('admin');
    document.getElementById('admin-bar').style.display = 'flex';
    if(!yaEraAdmin) iniciarSincronizacionAdmin().catch(() => {});
  } else if(user && !ADMIN_REQUEST){
    // Sesión activa pero URL normal → cerrar sesión silenciosamente
    auth.signOut();
  }
});

// ════════════════════════════════════════════════════════
//  PRODUCTOS ORIGINALES — vienen de config.js
// ════════════════════════════════════════════════════════
const productosDefault = SITE_CONFIG.productosDefault;

// ════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ════════════════════════════════════════════════════════
let productos = [];
let carrito = []; // Variable global para guardar el pedido
let posCarrusel = {};       // { catId: posicion }
let carruselProds = {};     // { catId: [productos del carrusel] }

// Se resuelve cuando termina la carga inicial del catálogo
let resolverCargaInicial;
const CARGA_INICIAL = new Promise(r => { resolverCargaInicial = r; });
// En modo admin: promesa de la carga COMPLETA desde la colección (fuente de verdad).
// Toda escritura la espera antes de guardar, para no trabajar con datos parciales.
let ADMIN_SYNC = null;

let categoriasOcultas = []; // nombres de categorías ocultas
let categoriaOrden = [];    // orden personalizado de categorías
let ordenCategorias = {};
let productosOcultos = [];  // IDs de productos ocultos individualmente

const params = new URLSearchParams(location.search);
const ADMIN_REQUEST = params.has('admin');
let ADMIN_MODE = false;



// ════════════════════════════════════════════════════════
//  APLICAR CONFIG — llena todos los textos y colores
//  desde config.js al cargar la página
// ════════════════════════════════════════════════════════
function applyConfig() {
  const C = SITE_CONFIG;

  // Título del browser
  document.title = (C.seo && C.seo.title) || `${C.marcaPrincipal} ${C.marcaItalica}`;

  // Fuentes — lee tipografia de config.js, inyecta variables CSS y carga Google Fonts
  const T = C.tipografia || {};

  // Mapa de variable CSS → clave en tipografia
  const fontVars = {
    '--font-cuerpo':          T.cuerpo          || 'Jost',
    '--font-nav':             T.nav             || T.cuerpo || 'Jost',
    '--font-titulo-pagina':   T.tituloPagina    || 'Pinyon Script',
    '--font-titulo-seccion':  T.tituloSeccion   || T.tituloPagina || 'Pinyon Script',
    '--font-titulo-producto': T.tituloProducto  || T.tituloPagina || 'Pinyon Script',
    '--font-titulo-admin':    T.tituloAdmin     || T.tituloPagina || 'Pinyon Script',
  };

  // Inyectar variables en :root
  const root = document.documentElement;
  Object.entries(fontVars).forEach(([varName, fontName]) => {
    root.style.setProperty(varName, `'${fontName}'`);
  });

  // Actualizar Google Fonts con todas las fuentes únicas
  const gfonts = document.getElementById('gfonts');
  if (gfonts) {
    const uniqueFonts = [...new Set(Object.values(fontVars))];
    const families = uniqueFonts
      .map(f => `family=${f.replace(/ /g, '+')}:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400`)
      .join('&');
    const nuevaUrl = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    if(gfonts.href !== nuevaUrl) gfonts.href = nuevaUrl;
  }

  document.body.style.fontFamily = `'${T.cuerpo || 'Jost'}', sans-serif`;

  // Colores CSS (sobreescribe el :root del CSS)
  applyColores(C.colores);

  // ── NAV ──────────────────────────────────────────────
  const navLogoContainer = document.getElementById('nav-logo');
  const navLogoSrc = C._navLogoImg || C.navLogoImgDefault || null;
  if (navLogoSrc) {
    navLogoContainer.innerHTML = `<img src="${esc(cldUrl(navLogoSrc, CLD_LOGO))}" class="nav-logo-img" alt="Logo"> ${C.marcaPrincipal} <span>${C.marcaItalica}</span>`;
  } else {
    navLogoContainer.innerHTML = `${C.marcaPrincipal} <span>${C.marcaItalica}</span>`;
  }
  // Añadir flex para alinear imagen y texto perfectamente
  navLogoContainer.style.display = 'flex';
  navLogoContainer.style.alignItems = 'center';
  navLogoContainer.style.gap = '10px';
  document.getElementById('nav-ig-link').href =
    `https://instagram.com/${C.instagram}`;
  document.getElementById('nav-wa-link').href =
    `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(C.contacto.waTexto)}`;
  const dockIg = document.getElementById('dock-ig-link');
  const dockWa = document.getElementById('dock-wa-link');
  if (dockIg) dockIg.href = `https://instagram.com/${C.instagram}`;
  if (dockWa) dockWa.href = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(C.contacto.waTexto)}`;

  // ── HERO ─────────────────────────────────────────────
  document.getElementById('hero-eyebrow-1').textContent = `· ${C.rubro} ·`;
  document.getElementById('hero-eyebrow-2').textContent = C.ubicacion;

  // Título hero: imagen si existe, texto si no
  const heroTitleText = document.getElementById('hero-title');
  const heroTitleImgWrap = document.getElementById('hero-title-img-wrap');
  const heroTitleImg = document.getElementById('hero-title-img');
  // Firebase/caché primero; si no hay nada, usa el default hardcodeado de config.js
  const heroLogoSrc = C._heroLogoImg || C.heroLogoImgDefault || null;
  if(heroLogoSrc){
    heroTitleText.style.display = 'none';
    heroTitleImgWrap.style.display = 'block';
    const heroSrcFinal = cldUrl(heroLogoSrc, CLD_LOGO);
    if(heroTitleImg.getAttribute('src') !== heroSrcFinal) heroTitleImg.src = heroSrcFinal;
  } else {
    heroTitleImgWrap.style.display = 'none';
    heroTitleText.style.display = '';
    heroTitleText.innerHTML = `${C.marcaPrincipal}<br><em>${C.marcaItalica}</em>`;
  }

  document.getElementById('hero-subtitle').innerHTML = C.heroSubtitulo;

  // Imagen de la sección Nosotros (si se cambió desde "Editar página")
  const nosotrosImgEl = document.querySelector('.about-img-placeholder img');
  if(nosotrosImgEl && C._nosotrosImg){
    const src = cldUrl(C._nosotrosImg, CLD_LOGO);
    if(nosotrosImgEl.getAttribute('src') !== src) nosotrosImgEl.src = src;
  }

  // ── NOSOTROS ─────────────────────────────────────────
  document.getElementById('nosotros-label').textContent = C.nosotros.label;
  document.getElementById('nosotros-titulo').textContent = C.nosotros.titulo;
  document.getElementById('nosotros-slogan').textContent = C.nosotros.slogan;
  document.getElementById('nosotros-parrafos').innerHTML =
    C.nosotros.parrafos.map(p => `<p>${p}</p>`).join('');
  document.getElementById('nosotros-stats').innerHTML =
    C.nosotros.stats.map(s => `
      <div class="about-stat" style="display:inline-flex">
        <span class="stat-num">${s.num}</span>
        <span class="stat-label">${s.label}</span>
      </div>`).join('');

  // ── PRODUCTOS ────────────────────────────────────────
  document.getElementById('productos-label').textContent = C.productos.label;
  document.getElementById('productos-titulo').textContent = C.productos.titulo;

  // ── CONTACTO ─────────────────────────────────────────
  document.getElementById('contacto-label').textContent = C.contacto.label;
  document.getElementById('contacto-titulo').textContent = C.contacto.titulo;

  const waLink = document.getElementById('contacto-wa-link');
  waLink.href = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(C.contacto.waTexto)}`;
  waLink.textContent = C.contacto.waDisplay;

  const igLink = document.getElementById('contacto-ig-link');
  igLink.href = `https://instagram.com/${C.instagram}`;
  igLink.textContent = `@${C.instagram}`;

  document.getElementById('contacto-social-ig').href = `https://instagram.com/${C.instagram}`;
  document.getElementById('contacto-social-wa').href = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(C.contacto.waTexto)}`;

  document.getElementById('contacto-cta-titulo').textContent = C.contacto.ctaTitulo;
  document.getElementById('contacto-cta-p').textContent = C.contacto.ctaParrafo;

  const ctaBtn = document.getElementById('contacto-cta-btn');
  ctaBtn.href = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(C.contacto.waTexto)}`;
  document.getElementById('contacto-cta-btn-texto').textContent = C.contacto.ctaBoton;

  // ── FOOTER ───────────────────────────────────────────
  document.getElementById('footer-logo').innerHTML =
    `${C.marcaPrincipal} <span>${C.marcaItalica}</span>`;
  document.getElementById('footer-tagline').textContent =
    `${C.rubro} · ${C.ubicacion}`;
  document.getElementById('footer-ig-link').href =
    `https://instagram.com/${C.instagram}`;
  document.getElementById('footer-wa-link').href =
    `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(C.contacto.waTexto)}`;
  document.getElementById('footer-copy').textContent = C.footer.copyright;

  // ── ADMIN BAR ────────────────────────────────────────
  document.getElementById('admin-badge-nombre').textContent = C.admin.nombrePanel;
  document.getElementById('login-modal-logo').innerHTML = `${C.marcaPrincipal} <span>${C.marcaItalica}</span>`;

  // ── ADMIN MODAL ──────────────────────────────────────
  document.getElementById('admin-modal-subtitle').textContent =
    `Completá los datos del Producto`;
  document.getElementById('a-nombre').placeholder =
    `Ej: ${C.tipoProductoEjemplo}`;
}

// ════════════════════════════════════════════════════════
//  APLICAR COLORES — sobreescribe variables CSS del :root
// ════════════════════════════════════════════════════════
function applyColores(c) {
  const r = document.documentElement.style;
  r.setProperty('--fondo',      c.fondo);
  r.setProperty('--principal', c.principal);
  r.setProperty('--secciones', c.secciones);
  r.setProperty('--detalles',  c.detalles);
  r.setProperty('--cream',     c.cream);
  r.setProperty('--text',      c.text);
  r.setProperty('--text-soft', c.textSoft);
  r.setProperty('--gold',      c.gold);
  r.setProperty('--white',     c.white);
}

// ════════════════════════════════════════════════════════
//  FIREBASE: cargar y guardar
// ════════════════════════════════════════════════════════
// Carga TODO el catálogo al iniciar.
// 1) metadata (1 lectura)  2) índice con todos los productos (1 lectura)
// Si el índice no existe (base vieja, restauración, fotos en base64 muy pesadas),
// cae a leer la colección completa (1 lectura por producto).
async function cargarDesdeFirebase(){
  const [metaRes, indiceRes] = await Promise.allSettled([
    META_REF.get({ source: 'server' }),
    INDICE_REF.get({ source: 'server' })
  ]);

  if(metaRes.status === 'fulfilled'){
    const metaSnap = metaRes.value;
    if(metaSnap.exists){
      const m = metaSnap.data();

      // ── Invalidación de caché por timestamp ──────────────────
      const serverTs = m.lastModified || 0;
      const localTs  = Number(localStorage.getItem('cache_ts') || '0');
      if(serverTs > localTs){
        try {
          localStorage.removeItem('meta_cache');
          localStorage.removeItem('config_cache');
        } catch(e) {}
      }

      categoriasOcultas = Array.isArray(m.categoriasOcultas) ? m.categoriasOcultas : [];
      categoriaOrden    = Array.isArray(m.categoriaOrden)    ? m.categoriaOrden    : [];
      ordenCategorias   = m.ordenCategorias || {};
      productosOcultos  = Array.isArray(m.productosOcultos)  ? m.productosOcultos  : [];
    }
  } else {
    console.warn('No se pudo cargar metadata:', metaRes.reason);
  }

  if(indiceRes.status === 'fulfilled' && indiceRes.value.exists){
    const lista = indiceRes.value.data().productos;
    if(Array.isArray(lista)) return lista.map(p => ({ ...p }));
  }

  // Fallback: colección completa
  return leerColeccionCompleta();
}

async function leerColeccionCompleta(){
  const snap = await PRODS_COL.get({ source: 'server' });
  return snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

// Copia de un producto con solo los campos que usa la página
function productoParaIndice(p){
  return {
    id:     p.id,
    nombre: p.nombre || '',
    precio: p.precio || '',
    tipo:   p.tipo || (Array.isArray(p.tipos) ? p.tipos[0] : ''),
    tipos:  Array.isArray(p.tipos) ? p.tipos : (p.tipo ? [p.tipo] : []),
    desc:   p.desc || '',
    img:    p.img || '',
    imgs:   Array.isArray(p.imgs) ? p.imgs : (p.img ? [p.img] : [])
  };
}

// Firestore admite documentos de hasta 1 MiB. Si quedan fotos en base64
// el índice no entra: en ese caso se borra y los visitantes leen la colección.
const INDICE_MAX_BYTES = 900000;

function construirIndice(ts){
  const data = { productos: productos.map(productoParaIndice), lastModified: ts };
  const bytes = new Blob([JSON.stringify(data)]).size;
  return bytes <= INDICE_MAX_BYTES ? data : null;
}

// Guarda cambios de productos + índice + timestamp en UNA operación atómica.
// ops: [{ tipo:'set'|'delete', ref, data }]
async function commitCambios(ops = []){
  const ts = Date.now();
  const batch = db.batch();
  ops.forEach(op => {
    if(op.tipo === 'delete') batch.delete(op.ref);
    else batch.set(op.ref, op.data);
  });
  const indice = construirIndice(ts);
  if(indice) batch.set(INDICE_REF, indice);
  else       batch.delete(INDICE_REF);
  batch.set(META_REF, { lastModified: ts, categorias: getCategorias() }, { merge: true });
  await batch.commit();
  try { localStorage.setItem('cache_ts', String(ts)); } catch(e) {}
  if(!indice){
    mostrarToastError('⚠ Hay fotos viejas guardadas dentro de la base (base64) y el catálogo pesa demasiado.<br>Abrí <b>⚙ Herramientas → Migrar fotos a Cloudinary</b>.', 12000);
  }
}

// Guarda SOLO la metadata (categorías, orden, visibilidad)
async function guardarMetaEnFirebase(){
  const cats = getCategorias();
  const ts = Date.now();
  await META_REF.set({
    categoriasOcultas,
    categoriaOrden,
    ordenCategorias,
    productosOcultos,
    categorias: cats,
    lastModified: ts
  }, { merge: true });
  try {
    localStorage.setItem('meta_cache', JSON.stringify({
      categoriasOcultas, categoriaOrden, ordenCategorias, productosOcultos
    }));
    localStorage.setItem('cache_ts', String(ts));
  } catch(e) {}
}

// Guarda/actualiza UN producto en su propio documento (+ índice)
async function guardarProductoEnFirebase(prod){
  const docRef = prod.id ? PRODS_COL.doc(prod.id) : PRODS_COL.doc();
  if(!prod.id) prod.id = docRef.id;
  await commitCambios([{ tipo: 'set', ref: docRef, data: productoParaIndice(prod) }]);
  return prod;
}

// Elimina UN producto de Firestore (+ índice)
async function eliminarProductoEnFirebase(prodId){
  await commitCambios([{ tipo: 'delete', ref: PRODS_COL.doc(prodId) }]);
}

// ════════════════════════════════════════════════════════
//  ADMIN — sincronización con la fuente de verdad
//  Al entrar como admin se lee la colección completa y se
//  regenera el índice. Esto también repara el índice después
//  de restaurar un respaldo o de editar algo en la consola.
// ════════════════════════════════════════════════════════
function iniciarSincronizacionAdmin(){
  if(ADMIN_SYNC) return ADMIN_SYNC;
  ADMIN_SYNC = (async () => {
    await CARGA_INICIAL;
    mostrarToast('Cargando catálogo completo…');
    const lista = await leerColeccionCompleta();
    productos = lista;
    buildAllCarousels();
    await commitCambios([]);
    const conBase64 = contarFotosBase64();
    if(conBase64 > 0){
      mostrarToastError(`Hay ${conBase64} foto${conBase64 !== 1 ? 's' : ''} guardada${conBase64 !== 1 ? 's' : ''} en formato viejo (base64).<br>Usá <b>⚙ Herramientas → Migrar fotos a Cloudinary</b>.`, 9000);
    } else {
      mostrarToast('Catálogo sincronizado ✓');
    }
  })().catch(err => {
    console.error('Error sincronizando catálogo admin:', err);
    ADMIN_SYNC = null;
    mostrarToastError('⚠ No se pudo cargar el catálogo completo. Recargá la página antes de editar.', 10000);
    throw err;
  });
  return ADMIN_SYNC;
}

// Toda operación de escritura del admin pasa por acá primero
async function esperarAdminListo(){
  if(!ADMIN_SYNC) iniciarSincronizacionAdmin();
  await ADMIN_SYNC;
}

function esBase64(src){ return typeof src === 'string' && src.startsWith('data:'); }

function contarFotosBase64(){
  let n = 0;
  productos.forEach(p => {
    const imgs = Array.isArray(p.imgs) && p.imgs.length ? p.imgs : [p.img];
    imgs.forEach(s => { if(esBase64(s)) n++; });
  });
  return n;
}

// ════════════════════════════════════════════════════════
//  CLOUDINARY — subida de fotos desde el panel admin
//  Usa un "upload preset" NO firmado. El cloud name y el
//  preset se guardan en Firestore (privado/cloudinary), que
//  solo pueden leer los admins, así no quedan en el código.
// ════════════════════════════════════════════════════════
let cldConfig = null;

async function obtenerCloudinary(){
  if(cldConfig) return cldConfig;
  const snap = await CLOUDINARY_REF.get();
  if(snap.exists && snap.data().cloudName && snap.data().preset){
    cldConfig = snap.data();
    return cldConfig;
  }
  return configurarCloudinary();
}

async function configurarCloudinary(){
  const actual = cldConfig || {};
  const cloudName = (prompt('Cloudinary — "Cloud name" (lo ves en el Dashboard de Cloudinary):', actual.cloudName || '') || '').trim();
  if(!cloudName) throw new Error('Cloudinary no configurado');
  const preset = (prompt('Cloudinary — nombre del "Upload preset" (no firmado):', actual.preset || '') || '').trim();
  if(!preset) throw new Error('Cloudinary no configurado');
  await CLOUDINARY_REF.set({ cloudName, preset });
  cldConfig = { cloudName, preset };
  return cldConfig;
}

// Sube una imagen (dataURL o Blob) y devuelve su URL https
async function subirImagenCloudinary(archivo){
  const { cloudName, preset } = await obtenerCloudinary();
  const fd = new FormData();
  fd.append('file', archivo);
  fd.append('upload_preset', preset);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: 'POST',
    body: fd
  });
  const data = await r.json().catch(() => ({}));
  if(!r.ok || !data.secure_url){
    throw new Error('Cloudinary: ' + ((data.error && data.error.message) || ('HTTP ' + r.status)));
  }
  return data.secure_url;
}

// Reemplaza las fotos nuevas (dataURL) de una lista por URLs de Cloudinary
async function subirFotosPendientes(lista, onProgreso){
  const pendientes = lista.filter(esBase64).length;
  let hechas = 0;
  const resultado = [];
  for(const src of lista){
    if(esBase64(src)){
      if(onProgreso) onProgreso(hechas + 1, pendientes);
      resultado.push(await subirImagenCloudinary(src));
      hechas++;
    } else {
      resultado.push(src);
    }
  }
  return resultado;
}

// Agrega transformaciones de Cloudinary a una URL (tamaño + formato automático).
// Si la imagen no es de Cloudinary (base64 viejo o img/ local) la deja igual.
function cldUrl(src, transf){
  if(typeof src !== 'string' || !src.includes('res.cloudinary.com') || !src.includes('/upload/')) return src;
  return src.replace('/upload/', `/upload/${transf}/`);
}
const CLD_CARD  = 'f_auto,q_auto,c_limit,w_600';
const CLD_MODAL = 'f_auto,q_auto,c_limit,w_1400';
const CLD_THUMB = 'f_auto,q_auto,c_fill,w_160,h_160';
const CLD_LOGO  = 'f_auto,q_auto,c_limit,w_800';

// Escapa texto antes de insertarlo con innerHTML
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// ════════════════════════════════════════════════════════
//  LOGIN — credenciales vienen de config.js
// ════════════════════════════════════════════════════════
function pedirLoginAdmin(){
  document.getElementById('login-modal').classList.add('active');
  setTimeout(() => document.getElementById('login-email').focus(), 150);
  ['login-email','login-password'].forEach(id => {
    document.getElementById(id).onkeydown = e => { if(e.key === 'Enter') submitLogin(); };
  });
}

function mostrarAyudaContrasena(e){
  e.preventDefault();
  alert('Para restablecer tu contraseña, contactate con el servicio técnico de LUCANSOFT.');
}

function cancelarLogin(){
  document.getElementById('login-modal').classList.remove('active');
  document.getElementById('login-error').textContent = '';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
}

async function submitLogin(){
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');
  const errorEl  = document.getElementById('login-error');

  if(!email || !password){ errorEl.textContent = 'Completá email y contraseña.'; return; }

  btn.textContent = 'Ingresando…';
  btn.disabled    = true;
  errorEl.textContent = '';

  try {
    await auth.signInWithEmailAndPassword(email, password);
    document.getElementById('login-modal').classList.remove('active');
    ADMIN_MODE = true;
    document.body.classList.add('admin');
    document.getElementById('admin-bar').style.display = 'flex';
    buildAllCarousels(); // reconstruir cards con botones de admin
    iniciarSincronizacionAdmin().catch(() => {});
  } catch {
    errorEl.textContent = 'Credenciales incorrectas. Intentá de nuevo.';
    btn.textContent = 'Ingresar';
    btn.disabled    = false;
  }
}

function logoutAdmin(){
  auth.signOut().then(() => {
    location.reload();
  });
}

// ════════════════════════════════════════════════════════
//  INICIALIZAR
// ════════════════════════════════════════════════════════
async function inicializar(){
  if(ADMIN_MODE){
    document.body.classList.add('admin-mode');
    document.getElementById('admin-bar').style.display = 'flex';
  }

  // Cargar metadata cacheada ANTES de buildAllCarousels — orden de categorías correcto
  try {
    const metaCache = localStorage.getItem('meta_cache');
    if (metaCache) {
      const m = JSON.parse(metaCache);
      categoriasOcultas = Array.isArray(m.categoriasOcultas) ? m.categoriasOcultas : [];
      categoriaOrden    = Array.isArray(m.categoriaOrden)    ? m.categoriaOrden    : [];
      ordenCategorias   = m.ordenCategorias || {};
      productosOcultos  = Array.isArray(m.productosOcultos)  ? m.productosOcultos  : [];
    }
  } catch(e) {}

  // Productos: siempre desde Firestore (sin caché) para garantizar datos actualizados
  // en cualquier dispositivo sin necesidad de borrar datos del navegador.
  try {
    productos = await cargarDesdeFirebase();
    productos.forEach((p, i) => {
      if(!p.id){
        p.id = 'prod_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2,8);
      }
    });
    // Guardar metadata en caché (no los productos) para el orden de categorías
    try {
      localStorage.setItem('meta_cache', JSON.stringify({
        categoriasOcultas, categoriaOrden, ordenCategorias, productosOcultos
      }));
    } catch(e) {}

  } catch(err){
    console.warn('Primer intento fallido, reintentando...', err);
    try {
      await new Promise(r => setTimeout(r, 1200));
      productos = await cargarDesdeFirebase();
      try {
        localStorage.setItem('meta_cache', JSON.stringify({
          categoriasOcultas, categoriaOrden, ordenCategorias, productosOcultos
        }));
      } catch(e) {}
    } catch(err2){
      console.error('Error cargando Firebase:', err2);
      productos = productosDefault.map(p => ({...p}));
      if(!productos.length){
        mostrarErrorCarga();
        resolverCargaInicial();
        return;
      }
    }
  }

  const loadingEl = document.getElementById('carrusel-loading');
  if (loadingEl) loadingEl.style.display = 'none';
  buildAllCarousels();
  resolverCargaInicial();
}

// Mensaje visible si el catálogo no se pudo cargar (sin conexión, cuota, etc.)
function mostrarErrorCarga(){
  const container = document.getElementById('carrousels-container');
  if(!container) return;
  container.innerHTML = `
    <div class="carga-error">
      <p>No pudimos cargar los productos en este momento.</p>
      <button class="btn-outline" onclick="location.reload()">Reintentar</button>
    </div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Aplicar config desde caché inmediatamente si existe
  try {
    const configCache = localStorage.getItem('config_cache');
    if (configCache) {
      const data = JSON.parse(configCache);
      if(data.rubro)         SITE_CONFIG.rubro         = data.rubro;
      if(data.ubicacion)     SITE_CONFIG.ubicacion      = data.ubicacion;
      if(data.heroSubtitulo) SITE_CONFIG.heroSubtitulo  = data.heroSubtitulo;
      if(data.nosotros)      SITE_CONFIG.nosotros        = { ...SITE_CONFIG.nosotros, ...data.nosotros };
      if(data.whatsapp)      SITE_CONFIG.whatsapp        = data.whatsapp;
      if(data.instagram)     SITE_CONFIG.instagram       = data.instagram;
      if(data.contacto)      SITE_CONFIG.contacto        = { ...SITE_CONFIG.contacto, ...data.contacto };
      if(data.nosotrosImg)   SITE_CONFIG._nosotrosImg    = data.nosotrosImg;
      if(data.heroLogoImg)   SITE_CONFIG._heroLogoImg    = data.heroLogoImg;
      if(data.navLogoImg)    SITE_CONFIG._navLogoImg     = data.navLogoImg;
    }
  } catch(e) {}

  applyConfig();
  if(ADMIN_REQUEST){ pedirLoginAdmin(); }

  // Hero anima INMEDIATAMENTE — no espera Firebase para nada
  animarHero();

  // Mejoras de UI: reveal de texto en Nosotros, dock mobile
  initNosotrosReveal();
  initMobileDock();
  cargarCarritoLocal();

  // Firebase carga en segundo plano, nunca bloquea la UI ni la animación
  cargarConfigEditable().then(data => {
    if (data) {
      try { localStorage.setItem('config_cache', JSON.stringify(data)); } catch(e) {}
      applyConfig();
    }
  }).catch(() => {});

  inicializar();
});

// ════════════════════════════════════════════════════════
//  ANIMACIÓN HERO — entrada única y armoniosa
//  Espera a que la imagen del logo esté lista antes de
//  arrancar, para que todo aparezca junto en cascada.
// ════════════════════════════════════════════════════════
function animarHero(){
  const DELAY_BASE  = 110;
  const DELAY_START = 80;

  // Anima TODO de inmediato — sin esperar la imagen del logo
  const heroImg = document.getElementById('hero-title-img');
  const imgWrap = document.getElementById('hero-title-img-wrap');

  // Elementos sin la imagen — animan siempre con stagger normal
  const elementos = [
    document.getElementById('hero-eyebrow-1'),
    document.getElementById('hero-eyebrow-2'),
    document.getElementById('hero-title'),
    // imgWrap se maneja aparte ↓
    document.getElementById('hero-subtitle'),
    document.querySelector('.hero-cta'),
    document.querySelector('.hero-scroll'),
  ].filter(Boolean);

  const visibles = elementos.filter(el => el.style.display !== 'none');
  visibles.forEach((el, i) => {
    setTimeout(() => el.classList.add('hero-visible'), DELAY_START + i * DELAY_BASE);
  });

  // imgWrap: espera a que la imagen cargue para disparar la animación junto con ella
  if(imgWrap && imgWrap.style.display !== 'none'){
    // Posición natural en el stagger (después del hero-title, antes del subtitle)
    const staggerDelay = DELAY_START + 2 * DELAY_BASE;
    const revelar = () => { imgWrap.classList.add('hero-visible'); };
    if(heroImg && heroImg.src && heroImg.src !== window.location.href){
      if(heroImg.complete && heroImg.naturalWidth > 0){
        // Ya cargó (caché) — anima en su lugar normal
        setTimeout(revelar, staggerDelay);
      } else {
        // Aún no cargó — espera el evento y anima entonces
        const onLoad = () => { setTimeout(revelar, 80); };
        heroImg.addEventListener('load',  onLoad, { once: true });
        heroImg.addEventListener('error', onLoad, { once: true }); // fallback si falla
      }
    } else {
      setTimeout(revelar, staggerDelay);
    }
  }
}

let resizeTimer;
let ultimoAncho = window.innerWidth;
window.addEventListener('resize', () => {
  // En mobile, mostrar/ocultar la barra de direcciones dispara 'resize'
  // (cambia solo el alto). Reconstruir solo si cambió el ancho.
  if(window.innerWidth === ultimoAncho) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    ultimoAncho = window.innerWidth;
    buildAllCarousels();
  }, 150);
});



// ════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════
function getCatId(cat){
  return 'cat-' + cat.toLowerCase()
    .replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e')
    .replace(/[íìîï]/g,'i').replace(/[óòôö]/g,'o')
    .replace(/[úùûü]/g,'u').replace(/ñ/g,'n')
    .replace(/[^a-z0-9]/g,'-');
}

function getCategorias(){
  // Soporta tanto tipo (string legacy) como tipos (array nuevo)
  const cats = [];
  productos.forEach(p => {
    const lista = Array.isArray(p.tipos) ? p.tipos : [p.tipo];
    lista.forEach(c => { if(c && !cats.includes(c)) cats.push(c); });
  });
  // Aplicar orden personalizado si existe
  if(categoriaOrden.length > 0){
    const ordenadas = categoriaOrden.filter(c => cats.includes(c));
    const nuevas = cats.filter(c => !categoriaOrden.includes(c));
    return [...ordenadas, ...nuevas];
  }
  return cats;
}

function esMobile(){ return window.innerWidth <= 768; }

function visiblePorPantalla(){
  if(esMobile())              return 4; // 4 cards por "página" en mobile (grilla 2x2)
  if(window.innerWidth <= 1024) return 2;
  return 3;
}

// ════════════════════════════════════════════════════════
//  CARRUSELES — Construir todos
// ════════════════════════════════════════════════════════
function buildAllCarousels(){
  const container = document.getElementById('carrousels-container');
  if(!container) return;

  container.innerHTML = '';

  const cats = getCategorias();
  const visibles = cats.filter(c => !categoriasOcultas.includes(c));
  const toInit = [];

  // IDs ya incluidos en "todos" para construirlo sin duplicados
  const idsTodos = new Set();

  visibles.forEach((cat, idx) => {

    const prods = productos.filter(p => {
      const lista = Array.isArray(p.tipos) ? p.tipos : [p.tipo];
      return lista.includes(cat);
    });

    const orden = ordenCategorias[cat];
    if(orden){
      prods.sort((a,b) => {
        const ia = orden.indexOf(a.id);
        const ib = orden.indexOf(b.id);
        if(ia === -1) return 1;
        if(ib === -1) return -1;
        return ia - ib;
      });
    }

    if(!prods.length) return;

    const catId = getCatId(cat);
    const section = crearSeccionCarrusel(cat, catId, idx > 0);
    container.appendChild(section);

    toInit.push({ catId, catNombre: cat, prods: [...prods] });

    // Acumular IDs para "todos"
    prods.forEach(p => idsTodos.add(p.id));
  });

  // "Todos los productos" — construido desde los productos ya en memoria,
  // sin duplicados, respetando el orden en que aparecen por categoría.
  // Se incluyen también productos sin categoría visible (edge case).
  const prodsTodos = [];
  const idsYaAgregados = new Set();

  // Primero los que aparecen en categorías visibles (en orden de aparición)
  toInit.forEach(({ prods }) => {
    prods.forEach(p => {
      if(!idsYaAgregados.has(p.id)){
        idsYaAgregados.add(p.id);
        prodsTodos.push(p);
      }
    });
  });

  // Luego los que pudieran no estar en ninguna categoría visible (no debería ocurrir,
  // pero los incluimos para que "todos" sea realmente TODOS)
  productos.forEach(p => {
    if(!idsYaAgregados.has(p.id)){
      idsYaAgregados.add(p.id);
      prodsTodos.push(p);
    }
  });

  if(prodsTodos.length > 0){
    const section = crearSeccionCarrusel('Todos los productos', 'todos', visibles.length > 0);
    container.appendChild(section);
    toInit.push({ catId: 'todos', catNombre: 'todos', prods: prodsTodos });
  }

  // Construir tracks + eventos
  toInit.forEach(({ catId, prods }) => {

    buildTrack(catId, prods);

    const track = document.getElementById('carrusel-track-' + catId);
    if(!track) return;

    // ── Sincronizar posición al deslizar con el dedo / trackpad ──
    // Así las flechas siguen desde donde quedó el usuario.
    const outer = track.closest('.carrusel-track-outer');
    if(!outer) return;

    let scrollTimer;
    outer.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        posCarrusel[catId] = Math.round(outer.scrollLeft / pasoCarrusel());
      }, 80);
    }, { passive: true });

  });
}

function crearSeccionCarrusel(cat, catId, showDivider){
  const section = document.createElement('div');
  section.className = 'cat-section';
  section.id = 'section-' + catId;

  if(showDivider){
    const d = document.createElement('div');
    d.className = 'cat-divider';
    section.appendChild(d);
  }

  const header = document.createElement('div');
  header.className = 'cat-section-header';
  header.innerHTML = `<span class="section-label cat-label">${esc(cat)}</span>`;
  section.appendChild(header);

  const wrapper = document.createElement('div');
  wrapper.className = 'carrusel-wrapper';
  wrapper.innerHTML = `
    <button class="carrusel-btn prev" id="btn-prev-${catId}" onclick="moverCarrusel('${catId}',-1)">
      <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <div class="carrusel-track-outer">
      <div class="carrusel-track" id="carrusel-track-${catId}"></div>
    </div>
    <button class="carrusel-btn next" id="btn-next-${catId}" onclick="moverCarrusel('${catId}',1)">
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
    </button>`;
  section.appendChild(wrapper);
  return section;
}

function buildTrack(catId, prods){
  const track = document.getElementById('carrusel-track-' + catId);
  if(!track || !prods.length) return;

  // En modo visitante, ocultar los productos marcados como no visibles
  const prodsVisibles = ADMIN_MODE
    ? prods
    : prods.filter(p => !productosOcultos.includes(p.id));

  const visible = visiblePorPantalla();
  const cardW   = getCardWidth();

  carruselProds[catId] = prodsVisibles;
  posCarrusel[catId]   = 0;
  track.innerHTML      = '';

  if(esMobile()){
    // Agrupar de a 4 cards en grupos 2x2
    const grupos = [];
    for(let i = 0; i < prodsVisibles.length; i += 4){
      grupos.push(prodsVisibles.slice(i, i + 4));
    }
    grupos.forEach(grupo => {
      const grp = document.createElement('div');
      grp.className = 'carrusel-grupo-mobile';
      grp.style.flex = `0 0 ${cardW * 2 + 10}px`;
      grp.style.display = 'grid';
      grp.style.gridTemplateColumns = '1fr 1fr';
      grp.style.gap = '8px';
      grupo.forEach(p => {
        const card = crearCard(p, false);
        card.style.flex = '';
        card.style.width = '100%';
        grp.appendChild(card);
      });
      track.appendChild(grp);
    });
  } else {
    prodsVisibles.forEach(p => {
      const card = crearCard(p, false);
      card.style.flex = `0 0 ${cardW}px`;
      track.appendChild(card);
    });
  }

  const btnPrev = document.getElementById('btn-prev-' + catId);
  const btnNext = document.getElementById('btn-next-' + catId);
  const totalGrupos = esMobile() ? Math.ceil(prodsVisibles.length / 4) : prodsVisibles.length;
  const ocultar = totalGrupos <= 1;
  if(btnPrev) btnPrev.style.display = ocultar ? 'none' : '';
  if(btnNext) btnNext.style.display = ocultar ? 'none' : '';
}

// ════════════════════════════════════════════════════════
//  TILT 3D + BRILLO — tarjetas de producto
// ════════════════════════════════════════════════════════
function aplicarTilt3D(card){
  if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;

  const MAX_TILT = 8; // grados

  function onMove(e){
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const px = x / rect.width;
    const py = y / rect.height;

    const rotateY = (px - 0.5) * MAX_TILT * 2;
    const rotateX = (0.5 - py) * MAX_TILT * 2;

    card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.015)`;
    card.style.setProperty('--mx', `${px * 100}%`);
    card.style.setProperty('--my', `${py * 100}%`);
  }

  function onEnter(){
    card.classList.add('tilt-active');
  }

  function onLeave(){
    card.classList.remove('tilt-active');
    card.style.transform = '';
  }

  card.addEventListener('mouseenter', onEnter);
  card.addEventListener('mousemove', onMove);
  card.addEventListener('mouseleave', onLeave);
}

// ════════════════════════════════════════════════════════
//  TEXT REVEAL — sección Nosotros (blur → foco)
// ════════════════════════════════════════════════════════
function initNosotrosReveal(){
  const parrafosEl = document.getElementById('nosotros-parrafos');
  const statsEl = document.getElementById('nosotros-stats');
  if (!parrafosEl || !statsEl) return;

  // Esperamos un tick a que applyConfig() haya inyectado el contenido
  requestAnimationFrame(() => {
    // Envolver cada párrafo en spans de línea/palabra para el reveal
    const paras = parrafosEl.querySelectorAll('p');
    paras.forEach((p, pi) => {
      const words = p.innerHTML.split(/\s+/).filter(Boolean);
      p.innerHTML = words.map((w, wi) =>
        `<span class="reveal-word" style="transition-delay:${(pi * 60) + (wi * 18)}ms">${w}</span>`
      ).join(' ');
    });

    const revealables = [
      ...parrafosEl.querySelectorAll('.reveal-word'),
      ...statsEl.querySelectorAll('.about-stat')
    ];

    if (!('IntersectionObserver' in window)) {
      revealables.forEach(el => el.classList.add('in-view'));
      return;
    }

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    revealables.forEach(el => obs.observe(el));
  });
}

// ════════════════════════════════════════════════════════
//  DOCK FLOTANTE — mobile
// ════════════════════════════════════════════════════════
function initMobileDock(){
  const dock = document.getElementById('mobile-dock');
  if (!dock) return;

  document.body.classList.add('has-mobile-dock');

  const items = dock.querySelectorAll('.mobile-dock-item');
  items.forEach(item => {
    item.addEventListener('touchstart', () => {
      items.forEach(i => i.classList.remove('dock-active'));
      item.classList.add('dock-active');
    }, { passive: true });
    item.addEventListener('touchend', () => {
      setTimeout(() => item.classList.remove('dock-active'), 180);
    }, { passive: true });
  });
}

function crearCard(p, esClonado){
  const card = document.createElement('div');
  card.dataset.prodId = p.id;          
  const estaOculto = productosOcultos.includes(p.id);
  card.className = 'producto-card' + (estaOculto ? ' producto-oculto' : '');
  card.innerHTML = `
    <div class="prod-img-placeholder">
      <img src="${esc(cldUrl(p.img, CLD_CARD))}" alt="${esc(p.nombre)}" loading="lazy" decoding="async">
    </div>
    <div class="prod-info">
      <div class="prod-tipo">${esc(Array.isArray(p.tipos) ? p.tipos[0] : p.tipo)}</div>
      <div class="prod-name">${esc(p.nombre)}</div>
    </div>
    <div class="prod-overlay">
      <h3>${esc(p.nombre)}</h3>
      <div class="ver-mas">Ver más</div>
    </div>
    <div class="card-tilt-shine"></div>`;

  aplicarTilt3D(card);

  if(ADMIN_MODE && !esClonado){
    const btnDel = document.createElement('button');
    btnDel.className = 'admin-delete-btn';
    btnDel.innerHTML = '×';
    btnDel.title = 'Eliminar producto';
    btnDel.addEventListener('click', e => { e.stopPropagation(); eliminarProducto(p); });
    card.appendChild(btnDel);

    const btnEdit = document.createElement('button');
    btnEdit.className = 'admin-edit-btn';
    btnEdit.innerHTML = '✏';
    btnEdit.title = 'Editar producto';
    btnEdit.style.right = '50px';
    btnEdit.addEventListener('click', e => { e.stopPropagation(); abrirModalEditar(p); });
    card.appendChild(btnEdit);

    const btnVis = document.createElement('button');
    btnVis.className = 'admin-visibility-btn' + (estaOculto ? ' is-hidden' : '');
    btnVis.title = estaOculto ? 'Producto oculto — clic para mostrar' : 'Ocultar producto';
    btnVis.innerHTML = estaOculto
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    btnVis.addEventListener('click', e => { e.stopPropagation(); toggleVisibilidadProducto(p, card, btnVis); });
    card.appendChild(btnVis);

    if(estaOculto){
      const badge = document.createElement('div');
      badge.className = 'oculto-badge';
      badge.textContent = 'No visible';
      card.appendChild(badge);
    }
  }

  card.addEventListener('click', () => openModal(p));
  return card;
}

function getCardWidth(){
  const gap = 10;
  if(esMobile()){
    // 2 columnas → cada card ocupa la mitad del contenedor menos el gap central
    const padding = 48;
    const containerW = window.innerWidth - padding;
    return (containerW - gap) / 2;
  }
  const visibleN = visiblePorPantalla();
  const padding = 128;
  const containerW = Math.min(window.innerWidth - padding, 1100);
  return (containerW - gap * (visibleN - 1)) / visibleN;
}

function actualizarCarrusel(catId){
  const track = document.getElementById('carrusel-track-' + catId);
  if(!track) return;
  const outer  = track.closest('.carrusel-track-outer');
  const cardW  = getCardWidth();
  if(esMobile()){
    const grupoW = cardW * 2 + 10;
    Array.from(track.children).forEach(c => { c.style.flex = `0 0 ${grupoW}px`; });
    if(outer) outer.scrollLeft = (posCarrusel[catId] || 0) * (grupoW + 20);
  } else {
    Array.from(track.children).forEach(c => c.style.flex = `0 0 ${cardW}px`);
    if(outer) outer.scrollLeft = (posCarrusel[catId] || 0) * (cardW + 20);
  }
}

function moverCarrusel(catId, dir){
  const prods   = carruselProds[catId] || [];
  const visible = visiblePorPantalla();
  // En mobile los items del track son grupos de 4, no cards individuales
  const totalItems = esMobile() ? Math.ceil(prods.length / 4) : prods.length;
  if(totalItems <= 1) return;

  const maxPos = totalItems - 1;
  posCarrusel[catId] = Math.max(0, Math.min((posCarrusel[catId] || 0) + dir, maxPos));

  const track = document.getElementById('carrusel-track-' + catId);
  const outer = track?.closest('.carrusel-track-outer');
  if(outer) outer.scrollLeft = posCarrusel[catId] * pasoCarrusel();
}

// Distancia en px entre un item del carrusel y el siguiente
function pasoCarrusel(){
  const cardW = getCardWidth();
  return esMobile() ? (cardW * 2 + 10) + 20 : cardW + 20;
}

// ════════════════════════════════════════════════════════
//  MODAL PRODUCTO
// ════════════════════════════════════════════════════════
function openModal(p){
  document.getElementById('modal-tipo').textContent  = Array.isArray(p.tipos) ? p.tipos.join(' · ') : p.tipo;
  document.getElementById('modal-title').textContent = p.nombre;
  document.getElementById('modal-precio').textContent = p.precio ? p.precio : '';
  document.getElementById('modal-desc').textContent  = p.desc;
  
  const imgContainer = document.getElementById('modal-img');
  const imgs = p.imgs && p.imgs.length > 0 ? p.imgs : [p.img];
  
  if(imgs.length <= 1){
    imgContainer.innerHTML = `<img src="${esc(cldUrl(imgs[0], CLD_MODAL))}" style="width:100%;height:100%;object-fit:cover;">`;
  } else {
    let dotsHTML = imgs.map((_,i) => `<div class="modal-dot${i===0?' active':''}" onclick="modalCarouselGo(${i})"></div>`).join('');
    let imgsHTML = imgs.map((src,i) => `<img src="${esc(cldUrl(src, CLD_MODAL))}" class="${i===0?'active':''}" alt="">`).join('');
    imgContainer.innerHTML = `
      <div class="modal-img-carousel" id="modal-carousel">
        ${imgsHTML}
        <button class="modal-carousel-btn prev-modal" onclick="modalCarouselMove(-1)">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button class="modal-carousel-btn next-modal" onclick="modalCarouselMove(1)">
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div class="modal-carousel-dots">${dotsHTML}</div>
      </div>`;
    window._modalCarouselIdx = 0;
    window._modalCarouselTotal = imgs.length;
  }
  
  // WhatsApp link con nombre del producto
  const template = SITE_CONFIG.contacto.waTextoProducto || SITE_CONFIG.contacto.waTexto;
  const msgProducto = template.replace('{nombre}', p.nombre);
  document.getElementById('modal-wa').href = `https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent(msgProducto)}`;
  document.getElementById('modal').classList.add('active');
  document.getElementById('modal-add-cart').onclick = () => agregarAlCarrito(p);
  document.body.style.overflow = 'hidden';
}

function modalCarouselMove(dir){
  const total = window._modalCarouselTotal || 1;
  window._modalCarouselIdx = ((window._modalCarouselIdx || 0) + dir + total) % total;
  modalCarouselGo(window._modalCarouselIdx);
}

function modalCarouselGo(idx){
  window._modalCarouselIdx = idx;
  const carousel = document.getElementById('modal-carousel');
  if(!carousel) return;
  carousel.querySelectorAll('img').forEach((img, i) => img.classList.toggle('active', i === idx));
  carousel.querySelectorAll('.modal-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}

function closeModal(e){
  if(e.target === document.getElementById('modal')){
    document.getElementById('modal').classList.remove('active');
    document.body.style.overflow = '';
    resetModalZoom();
  }
}

// ════════════════════════════════════════════════════════
//  ZOOM EN IMAGEN DEL MODAL
//  — Desktop: rueda del mouse sobre la imagen
//  — Mobile:  gesto pinch (dos dedos) sobre la imagen
// ════════════════════════════════════════════════════════
const ZOOM_MIN   = 1;
const ZOOM_MAX   = 4;
const ZOOM_STEP  = 0.15;

let zoomState = {
  scale:    1,
  originX:  50,   // % dentro de la imagen
  originY:  50,
  // pinch
  lastDist: null,
};

function getActiveModalImg(){
  const container = document.getElementById('modal-img');
  if(!container) return null;
  // Carrusel múltiple
  const active = container.querySelector('img.active');
  if(active) return active;
  // Imagen única
  return container.querySelector('img');
}

function applyZoom(){
  const img = getActiveModalImg();
  if(!img) return;
  img.style.transformOrigin = `${zoomState.originX}% ${zoomState.originY}%`;
  img.style.transform       = `scale(${zoomState.scale})`;
  img.style.transition      = 'transform 0.12s ease';
  img.style.cursor          = zoomState.scale > 1 ? 'zoom-out' : 'zoom-in';
}

function resetModalZoom(){
  zoomState.scale   = 1;
  zoomState.originX = 50;
  zoomState.originY = 50;
  zoomState.lastDist = null;
  const img = getActiveModalImg();
  if(img){
    img.style.transform       = 'scale(1)';
    img.style.transformOrigin = '50% 50%';
    img.style.cursor          = '';
  }
}

// Calcular origen del zoom relativo a la imagen
function calcOrigin(e, img){
  const rect = img.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width)  * 100;
  const y = ((e.clientY - rect.top)  / rect.height) * 100;
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

// ── Desktop: wheel ──────────────────────────────────────
document.addEventListener('wheel', function(e){
  const container = document.getElementById('modal-img');
  if(!container || !container.contains(e.target)) return;

  const img = getActiveModalImg();
  if(!img) return;

  e.preventDefault();

  const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
  const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomState.scale + delta));

  if(newScale !== zoomState.scale){
    const origin = calcOrigin(e, img);
    zoomState.originX = origin.x;
    zoomState.originY = origin.y;
    zoomState.scale   = newScale;
  }
  applyZoom();
}, { passive: false });

// ── Mobile: pinch ───────────────────────────────────────
document.addEventListener('touchstart', function(e){
  const container = document.getElementById('modal-img');
  if(!container || !container.contains(e.target)) return;
  if(e.touches.length === 2){
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    zoomState.lastDist = Math.hypot(dx, dy);
  }
}, { passive: true });

document.addEventListener('touchmove', function(e){
  const container = document.getElementById('modal-img');
  if(!container || !container.contains(e.target)) return;
  if(e.touches.length !== 2 || zoomState.lastDist === null) return;

  e.preventDefault();

  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  const dist = Math.hypot(dx, dy);

  const ratio    = dist / zoomState.lastDist;
  const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomState.scale * ratio));

  // Origen = punto medio entre los dos dedos
  const img = getActiveModalImg();
  if(img){
    const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const rect = img.getBoundingClientRect();
    zoomState.originX = Math.max(0, Math.min(100, ((mx - rect.left) / rect.width)  * 100));
    zoomState.originY = Math.max(0, Math.min(100, ((my - rect.top)  / rect.height) * 100));
  }

  zoomState.scale   = newScale;
  zoomState.lastDist = dist;
  applyZoom();
}, { passive: false });

document.addEventListener('touchend', function(e){
  if(e.touches.length < 2) zoomState.lastDist = null;
}, { passive: true });

// Resetear zoom al cambiar de foto en el carrusel del modal
const _origModalCarouselGo = window.modalCarouselGo;
window.modalCarouselGo = function(idx){
  resetModalZoom();
  _origModalCarouselGo(idx);
};

document.querySelector('.modal-close').addEventListener('click', () => {
  document.getElementById('modal').classList.remove('active');
  document.body.style.overflow = '';
});

function scrollToSection(id){
  document.getElementById(id).scrollIntoView({behavior:'smooth'});
}

// ════════════════════════════════════════════════════════
//  ADMIN — Eliminar
// ════════════════════════════════════════════════════════
async function eliminarProducto(p){
  if(!confirm(`¿Eliminar "${p.nombre}" del catálogo?`)) return;
  mostrarToast('Guardando…');
  try {
    await esperarAdminListo();
    // Buscar por id: después de sincronizar, el objeto en memoria puede ser otro
    productos = productos.filter(x => x.id !== p.id);
    productosOcultos = productosOcultos.filter(id => id !== p.id);
    buildAllCarousels();
    if(p.id) await eliminarProductoEnFirebase(p.id);
    await guardarMetaEnFirebase();
    mostrarToast('Producto eliminado ✓');
  } catch(err) {
    console.error('Error eliminando producto:', err);
    mostrarToastError('⚠ Error al eliminar. Revisá la conexión, recargar la página.', 7000);
  }
}

// ════════════════════════════════════════════════════════
//  ADMIN — Visibilidad individual de producto
// ════════════════════════════════════════════════════════
async function toggleVisibilidadProducto(p, card, btn){
  try { await esperarAdminListo(); } catch(e) { return; }
  const estaOculto = productosOcultos.includes(p.id);

  if(estaOculto){
    // Mostrar → quitar del array
    productosOcultos = productosOcultos.filter(id => id !== p.id);
  } else {
    // Ocultar → agregar al array
    productosOcultos.push(p.id);
  }

// Actualizar visual de la card sin reconstruir todo
const ahoraOculto = !estaOculto;
const svgOculto = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const svgVisible = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

document.querySelectorAll(`.producto-card[data-prod-id="${p.id}"]`).forEach(c => {
  c.classList.toggle('producto-oculto', ahoraOculto);
  const b = c.querySelector('.admin-visibility-btn');
  if(b){
    b.classList.toggle('is-hidden', ahoraOculto);
    b.title = ahoraOculto ? 'Producto oculto — clic para mostrar' : 'Ocultar producto';
    b.innerHTML = ahoraOculto ? svgOculto : svgVisible;
  }
  const badgeExistente = c.querySelector('.oculto-badge');
  if(ahoraOculto && !badgeExistente){
    const badge = document.createElement('div');
    badge.className = 'oculto-badge';
    badge.textContent = 'No visible';
    c.appendChild(badge);
  } else if(!ahoraOculto && badgeExistente){
    badgeExistente.remove();
  }
});
  


  mostrarToast('Guardando…');
  try {
    await guardarMetaEnFirebase();
    mostrarToast(ahoraOculto ? 'Producto ocultado ✓' : 'Producto visible ✓');
  } catch(err) {
    console.error('Error guardando visibilidad:', err);
    mostrarToastError('⚠ Error al guardar. Revisá la conexión, recargar la página.', 7000);
  }
}


let fotosBase64 = [];      // array de todas las fotos
let portadaIdx = 0;        // índice de la foto de portada
let productoEditando = null;

function abrirModalAgregar(){
  productoEditando = null;
  fotosBase64 = [];
  portadaIdx = 0;
  document.getElementById('a-nombre').value = '';
  document.getElementById('a-desc').value   = '';
  poblarSelectTipo('');
  document.querySelector('.admin-modal h2').textContent = 'Nuevo producto';
  renderFotosGrid();
  document.getElementById('admin-modal').classList.add('active');
}

function cerrarAdminModal(e){
  if(e.target.id !== 'admin-modal') return;
  document.getElementById('admin-modal').classList.remove('active');
  productoEditando = null;
  fotosBase64 = [];
  portadaIdx = 0;
  document.getElementById('a-nombre').value = '';
  document.getElementById('a-desc').value   = '';
  poblarSelectTipo([]);
  renderFotosGrid();
  document.querySelector('.admin-modal h2').textContent = 'Nuevo producto';
}

function agregarFotos(e){
  const files = Array.from(e.target.files);
  if(!files.length) return;
  let pending = files.length;
  files.forEach(file => {
    comprimirImagen(file, base64 => {
      fotosBase64.push(base64);
      pending--;
      if(pending === 0){
        if(fotosBase64.length === files.length) portadaIdx = 0;
        renderFotosGrid();
        document.getElementById('a-foto-texto').textContent = `${fotosBase64.length} imagen${fotosBase64.length!==1?'es':''} cargada${fotosBase64.length!==1?'s':''}`;
      }
    });
  });
  e.target.value = '';
}

function renderFotosGrid(){
  const grid = document.getElementById('fotos-preview-grid');
  if(!grid) return;
  grid.innerHTML = '';
  fotosBase64.forEach((src, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'foto-thumb-wrap' + (i === portadaIdx ? ' is-portada' : '');
    wrap.title = 'Clic para marcar como portada';
    wrap.innerHTML = `
      <img src="${esc(cldUrl(src, CLD_THUMB))}" class="${i === portadaIdx ? 'portada-activa' : ''}" alt="">
      <button class="foto-thumb-remove" title="Eliminar foto">×</button>
      ${i === portadaIdx ? '<span class="portada-badge">Portada</span>' : ''}`;
    wrap.querySelector('img').addEventListener('click', () => { portadaIdx = i; renderFotosGrid(); });
    wrap.querySelector('.foto-thumb-remove').addEventListener('click', e => {
      e.stopPropagation();
      fotosBase64.splice(i, 1);
      if(portadaIdx >= fotosBase64.length) portadaIdx = Math.max(0, fotosBase64.length - 1);
      renderFotosGrid();
      document.getElementById('a-foto-texto').textContent = fotosBase64.length === 0
        ? 'Hacé clic para subir imágenes'
        : `${fotosBase64.length} imagen${fotosBase64.length!==1?'es':''} cargada${fotosBase64.length!==1?'s':''}`;
    });
    grid.appendChild(wrap);
  });
}

function comprimirImagen(file, callback){
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      // Se sube a Cloudinary en buena calidad (sirve para el zoom del modal);
      // la página después pide versiones chicas según dónde se muestre.
      const MAX = 1600;
      let w = img.width, h = img.height;
      if(w > MAX){ h = Math.round(h * MAX / w); w = MAX; }
      if(h > MAX){ w = Math.round(w * MAX / h); h = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// Igual que comprimirImagen pero exporta PNG para preservar transparencia (ej: logo hero)
function comprimirImagenPNG(file, callback){
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1000;
      let w = img.width, h = img.height;
      if(w > MAX){ h = Math.round(h * MAX / w); w = MAX; }
      if(h > MAX){ w = Math.round(w * MAX / h); h = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h); // asegura fondo transparente
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/png'));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// Mostrar/ocultar input de nueva categoría
function toggleNuevaCat(){
  const wrap = document.getElementById('a-tipo-nueva-wrap');
  const input = document.getElementById('a-tipo-nueva');
  const visible = wrap.style.display === 'block';
  if(visible){
    wrap.style.display = 'none';
    input.value = '';
  } else {
    wrap.style.display = 'block';
    input.focus();
  }
}

// Poblar checkboxes de categorías (selección múltiple)
function poblarSelectTipo(seleccionados = []){
  const selArr = Array.isArray(seleccionados) ? seleccionados : [seleccionados];
  const opcionesFijas = SITE_CONFIG.categoriasFijas;
  const existentes = getCategorias();
  const extras = existentes.filter(c => !opcionesFijas.includes(c));
  const todas = [...new Set([...opcionesFijas, ...extras])];

  const container = document.getElementById('a-tipos-checks');
  container.innerHTML = '';

  todas.forEach(c => {
    const label = document.createElement('label');
    label.className = 'cat-checkbox-label';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = c;
    cb.checked = selArr.includes(c);
    label.appendChild(cb);
    label.append(' ' + c);
    container.appendChild(label);
  });

  // Mostrar/ocultar "nueva categoría"
  document.getElementById('a-tipo-nueva-wrap').style.display = 'none';
  document.getElementById('a-tipo-nueva').value = '';
}

async function guardarProducto(){
  const nombre = document.getElementById('a-nombre').value.trim();
  const precioInput = document.getElementById('a-precio').value.trim();
  const precio = precioInput ? '$' + Number(precioInput.replace(/\D/g, '')).toLocaleString('es-AR') : '';
  const desc   = document.getElementById('a-desc').value.trim();

  // Categorías seleccionadas (checkboxes múltiples)
  const tiposSeleccionados = Array.from(
    document.querySelectorAll('#a-tipos-checks input[type=checkbox]:checked')
  ).map(cb => cb.value);

  // Nueva categoría escrita a mano
  const nuevaCatInput = document.getElementById('a-tipo-nueva').value.trim();
  if(nuevaCatInput && !tiposSeleccionados.includes(nuevaCatInput)) tiposSeleccionados.push(nuevaCatInput);

  if(!nombre)    { alert('Por favor ingresá el nombre del producto.'); return; }
  if(!tiposSeleccionados.length){ alert('Por favor seleccioná al menos una categoría.'); return; }
  if(!fotosBase64.length){ alert('Por favor subí al menos una foto del producto.'); return; }

  const btnGuardar = document.querySelector('#admin-modal .btn-guardar');
  if(btnGuardar){ btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando…'; }

  try {
    await esperarAdminListo();

    // 1) Subir a Cloudinary las fotos nuevas ANTES de tocar el catálogo.
    //    Si falla, no se modifica nada y las fotos quedan en el formulario.
    const ordenadas = [fotosBase64[portadaIdx], ...fotosBase64.filter((_,i)=>i!==portadaIdx)];
    const urls = await subirFotosPendientes(ordenadas, (n, total) => {
      mostrarToast(`Subiendo foto ${n} de ${total}…`);
    });

    // 2) Actualizar en memoria
    let prodTarget;
    const editando = productoEditando && productos.find(x => x.id === productoEditando.id);
    if(editando){
      prodTarget = editando;
    } else {
      prodTarget = {};
      productos.push(prodTarget);
    }
    Object.assign(prodTarget, {
      nombre,
      precio,
      tipo: tiposSeleccionados[0], // compatibilidad legacy
      tipos: tiposSeleccionados,
      desc,
      img: urls[0],
      imgs: urls
    });

    // 3) Guardar producto + índice + metadata
    mostrarToast('Guardando…');
    await guardarProductoEnFirebase(prodTarget);
    await guardarMetaEnFirebase();

    buildAllCarousels();
    document.getElementById('admin-modal').classList.remove('active');
    productoEditando = null;
    fotosBase64 = [];
    portadaIdx = 0;
    renderFotosGrid();
    document.querySelector('.admin-modal h2').textContent = 'Nuevo producto';
    mostrarToast('Producto guardado ✓');
    setTimeout(() => scrollToSection('productos'), 300);
  } catch(err) {
    console.error('Error guardando producto:', err);
    const esCld = String(err && err.message).startsWith('Cloudinary');
    mostrarToastError(esCld
      ? '⚠ No se pudieron subir las fotos (' + esc(err.message) + ').<br>Revisá la conexión o la configuración en ⚙ Herramientas.'
      : '⚠ Error al guardar. Revisá la conexión a internet y volvé a intentar.', 12000);
  } finally {
    if(btnGuardar){ btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar producto'; }
  }
}

function abrirModalEditar(p){
  productoEditando = p;
  document.getElementById('a-nombre').value = p.nombre;
  document.getElementById('a-precio').value = (p.precio || '').replace('$','');
  const tiposActuales = Array.isArray(p.tipos) ? p.tipos : [p.tipo];
  poblarSelectTipo(tiposActuales);
  document.getElementById('a-desc').value   = p.desc;
  fotosBase64 = p.imgs && p.imgs.length > 0 ? [...p.imgs] : [p.img];
  portadaIdx = 0;
  renderFotosGrid();
  document.getElementById('a-foto-texto').textContent = `${fotosBase64.length} imagen${fotosBase64.length!==1?'es':''} cargada${fotosBase64.length!==1?'s':''}`;
  document.querySelector('.admin-modal h2').textContent = 'Editar producto';
  document.getElementById('admin-modal').classList.add('active');
}


// ════════════════════════════════════════════════════════
//  ADMIN — Reordenar por categoría
// ════════════════════════════════════════════════════════
let ordenTemporal  = [];
let dragSrcIndex   = null;
let reorderCatActual = null;

function abrirModalReorden(){
  const select = document.getElementById('reorder-cat-select');
  select.innerHTML = '';

  getCategorias().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  reorderCatActual = select.value;
  cargarOrdenTemporal();
  renderizarListaReorden();
  document.getElementById('reorder-modal').classList.add('active');
}

function cambiarCatReorden(){
  reorderCatActual = document.getElementById('reorder-cat-select').value;
  cargarOrdenTemporal();
  renderizarListaReorden();
}

function cargarOrdenTemporal(){
  ordenTemporal = reorderCatActual === '__todos__'
    ? [...productos]
    : productos.filter(p => {
        const lista = Array.isArray(p.tipos) ? p.tipos : [p.tipo];
        return lista.includes(reorderCatActual);
      });
}

function cerrarModalReorden(e){
  if(e.target.id !== 'reorder-modal') return;
  document.getElementById('reorder-modal').classList.remove('active');
}

function renderizarListaReorden(){
  const lista = document.getElementById('reorder-list');
  lista.innerHTML = '';

  ordenTemporal.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'reorder-item';
    li.draggable = true;
    li.dataset.index = i;
    li.innerHTML = `
      <span class="reorder-handle">⠿</span>
      <span class="reorder-num">${i + 1}</span>
      <img class="reorder-thumb" src="${esc(cldUrl(p.img, CLD_THUMB))}" alt="${esc(p.nombre)}" loading="lazy">
      <div class="reorder-info">
        <div class="reorder-name">${esc(p.nombre)}</div>
        <div class="reorder-tipo">${esc(Array.isArray(p.tipos) ? p.tipos.join(', ') : p.tipo)}</div>
      </div>`;

    li.addEventListener('dragstart', e => {
      dragSrcIndex = parseInt(li.dataset.index);
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      lista.querySelectorAll('.reorder-item').forEach(el => el.classList.remove('drag-over'));
    });
    li.addEventListener('dragover', e => {
      e.preventDefault();
      lista.querySelectorAll('.reorder-item').forEach(el => el.classList.remove('drag-over'));
      li.classList.add('drag-over');
    });
    li.addEventListener('drop', e => {
      e.preventDefault();
      const destIndex = parseInt(li.dataset.index);
      if(dragSrcIndex === null || dragSrcIndex === destIndex) return;
      const [moved] = ordenTemporal.splice(dragSrcIndex, 1);
      ordenTemporal.splice(destIndex, 0, moved);
      dragSrcIndex = null;
      renderizarListaReorden();
    });

    lista.appendChild(li);
  });
}

async function guardarReorden(){
  try { await esperarAdminListo(); } catch(e) { return; }

  ordenCategorias[reorderCatActual] =
    ordenTemporal.map(p => p.id);

  buildAllCarousels();

  document.getElementById('reorder-modal')
    .classList.remove('active');

  mostrarToast('Guardando orden…');
  try {
    await guardarMetaEnFirebase();
    mostrarToast('Orden guardado ✓');
  } catch(err) {
    console.error('Error guardando orden:', err);
    mostrarToastError('⚠ Error al guardar. Revisá la conexión, recargar la página.', 7000);
  }
}

// ════════════════════════════════════════════════════════
//  ADMIN — Visibilidad de categorías
// ════════════════════════════════════════════════════════
function abrirModalCategorias(){
  renderCatToggles();
  document.getElementById('cat-modal').classList.add('active');
}

function cerrarModalCategorias(e){
  if(e.target.id !== 'cat-modal') return;
  document.getElementById('cat-modal').classList.remove('active');
}

let catDragSrc = null;

function renderCatToggles(){
  const list = document.getElementById('cat-toggle-list');
  list.innerHTML = '';
  const cats = getCategorias();
  cats.forEach((cat, idx) => {
    const count = productos.filter(p => {
      const lista = Array.isArray(p.tipos) ? p.tipos : [p.tipo];
      return lista.includes(cat);
    }).length;
    const visible = !categoriasOcultas.includes(cat);
    const item = document.createElement('div');
    item.className = 'cat-toggle-item';
    item.draggable = true;
    item.dataset.cat = cat;
    item.dataset.index = idx;
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
        <span class="cat-drag-handle" title="Arrastrá para reordenar">⠿</span>
        <div>
          <div class="cat-toggle-name">${esc(cat)}</div>
          <div class="cat-toggle-count">${count} producto${count !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="cat-toggle-actions">
        <button class="btn-cat-delete" title="Eliminar categoría y sus productos">×</button>
        <label class="toggle-switch">
          <input type="checkbox" data-cat="${esc(cat)}" ${visible ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>`;

    item.querySelector('.btn-cat-delete').addEventListener('click', () => eliminarCategoria(cat));

    item.addEventListener('dragstart', e => {
      catDragSrc = idx;
      item.classList.add('cat-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('cat-dragging');
      list.querySelectorAll('.cat-toggle-item').forEach(el => el.classList.remove('cat-drag-over'));
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      list.querySelectorAll('.cat-toggle-item').forEach(el => el.classList.remove('cat-drag-over'));
      item.classList.add('cat-drag-over');
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      const destIdx = parseInt(item.dataset.index);
      if(catDragSrc === null || catDragSrc === destIdx) return;
      const currentCats = getCategorias();
      const [moved] = currentCats.splice(catDragSrc, 1);
      currentCats.splice(destIdx, 0, moved);
      categoriaOrden = currentCats;
      catDragSrc = null;
      renderCatToggles();
    });

    list.appendChild(item);
  });
}

async function guardarCategorias(){
  try { await esperarAdminListo(); } catch(e) { return; }
  const checkboxes = document.querySelectorAll('#cat-toggle-list input[type=checkbox]');
  categoriasOcultas = [];
  checkboxes.forEach(cb => {
    if(!cb.checked) categoriasOcultas.push(cb.dataset.cat);
  });
  buildAllCarousels();
  document.getElementById('cat-modal').classList.remove('active');
  mostrarToast('Guardando…');
  try {
    await guardarMetaEnFirebase();
    mostrarToast('Categorías actualizadas ✓');
  } catch(err) {
    console.error('Error guardando categorías:', err);
    mostrarToastError('⚠ Error al guardar. Revisá la conexión, recargar la página.', 7000);
  }
}

async function eliminarCategoria(cat){
  try { await esperarAdminListo(); } catch(e) { return; }
  const enCat = productos.filter(p => {
    const lista = Array.isArray(p.tipos) ? p.tipos : [p.tipo];
    return lista.includes(cat);
  });
  // Solo se borran los productos que pertenecen ÚNICAMENTE a esta categoría.
  // Los que tienen otras categorías se conservan, sin esta.
  const aBorrar     = enCat.filter(p => (Array.isArray(p.tipos) ? p.tipos : [p.tipo]).length <= 1);
  const aActualizar = enCat.filter(p => !aBorrar.includes(p));

  const msg = aBorrar.length > 0
    ? `¿Eliminar la categoría "${cat}" y sus ${aBorrar.length} producto${aBorrar.length !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`
    : `¿Eliminar la categoría "${cat}"?`;
  if(!confirm(msg)) return;

  const idsBorrar = new Set(aBorrar.map(p => p.id));
  productos = productos.filter(p => !idsBorrar.has(p.id));
  aActualizar.forEach(p => {
    p.tipos = p.tipos.filter(c => c !== cat);
    p.tipo  = p.tipos[0];
  });
  categoriasOcultas = categoriasOcultas.filter(c => c !== cat);
  categoriaOrden    = categoriaOrden.filter(c => c !== cat);
  delete ordenCategorias[cat];
  productosOcultos  = productosOcultos.filter(id => !idsBorrar.has(id));

  renderCatToggles();
  buildAllCarousels();
  mostrarToast('Guardando…');
  try {
    // Solo se tocan los productos afectados (nunca se borra lo que no está en la categoría)
    const ops = [
      ...aBorrar.map(p => ({ tipo: 'delete', ref: PRODS_COL.doc(p.id) })),
      ...aActualizar.map(p => ({ tipo: 'set', ref: PRODS_COL.doc(p.id), data: productoParaIndice(p) }))
    ];
    // Firestore admite hasta 500 operaciones por lote
    let i = 0;
    do {
      await commitCambios(ops.slice(i, i + 400));
      i += 400;
    } while(i < ops.length);
    await guardarMetaEnFirebase();
    mostrarToast('Categoría eliminada ✓');
  } catch(err) {
    console.error('Error eliminando categoría:', err);
    mostrarToastError('⚠ Error al eliminar. Revisá la conexión, recargar la página.', 7000);
  }
}

// ════════════════════════════════════════════════════════
//  ADMIN — Editar contenido de la página
// ════════════════════════════════════════════════════════

// Referencia a la config editable (persiste en Firebase)
const CONFIG_REF = db.collection('catalogo').doc('siteConfig');

// Imagen nosotros pendiente de guardar (base64)
let nosotrosImgPendiente = null;
// Imagen del logo del hero pendiente de guardar (base64)
let heroLogoImgPendiente = null;
let navLogoImgPendiente = null;

function cargarHeroLogo(e){
  const file = e.target.files[0];
  if(!file) return;
  comprimirImagenPNG(file, base64 => {
    heroLogoImgPendiente = base64;
    document.getElementById('ep-hero-logo-thumb').src = base64;
    document.getElementById('ep-hero-logo-preview').style.display = 'block';
    document.getElementById('ep-hero-logo-texto').textContent = 'Imagen cargada — clic para cambiar';
    const actualEl = document.getElementById('ep-hero-logo-actual');
    if(actualEl) actualEl.style.display = 'none';
  });
  e.target.value = '';
}

function cargarNavLogo(e){
  const file = e.target.files[0];
  if(!file) return;
  comprimirImagenPNG(file, base64 => { // Usa PNG para preservar la transparencia
    navLogoImgPendiente = base64;
    document.getElementById('ep-nav-logo-thumb').src = base64;
    document.getElementById('ep-nav-logo-preview').style.display = 'block';
    document.getElementById('ep-nav-logo-texto').textContent = 'Imagen cargada — clic para cambiar';
    const actualEl = document.getElementById('ep-nav-logo-actual');
    if(actualEl) actualEl.style.display = 'none';
  });
  e.target.value = '';
}

async function cargarConfigEditable(){
  try {
    const snap = await CONFIG_REF.get({ source: 'server' });
    if(snap.exists){
      const data = snap.data();
      // Mezclar sobre SITE_CONFIG
      if(data.rubro)            SITE_CONFIG.rubro           = data.rubro;
      if(data.ubicacion)        SITE_CONFIG.ubicacion        = data.ubicacion;
      if(data.heroSubtitulo)    SITE_CONFIG.heroSubtitulo    = data.heroSubtitulo;
      if(data.nosotros)         SITE_CONFIG.nosotros         = { ...SITE_CONFIG.nosotros, ...data.nosotros };
      if(data.whatsapp)         SITE_CONFIG.whatsapp         = data.whatsapp;
      if(data.instagram)        SITE_CONFIG.instagram        = data.instagram;
      if(data.contacto)         SITE_CONFIG.contacto         = { ...SITE_CONFIG.contacto, ...data.contacto };
      if(data.nosotrosImg)      SITE_CONFIG._nosotrosImg     = data.nosotrosImg;
      if(data.heroLogoImg)      SITE_CONFIG._heroLogoImg     = data.heroLogoImg;
      if(data.navLogoImg)       SITE_CONFIG._navLogoImg      = data.navLogoImg;
      return data;
    }
  } catch(err){
    console.warn('No se pudo cargar configEditable:', err);
  }
}

function abrirModalEditarPagina(){
  const C = SITE_CONFIG;
  // ── Hero logo image ───────────────────────────────
  heroLogoImgPendiente = null;
  navLogoImgPendiente = null;
  const navLogoPreview = document.getElementById('ep-nav-logo-preview');
  const navLogoActual  = document.getElementById('ep-nav-logo-actual');
  if(navLogoPreview) navLogoPreview.style.display = 'none';
  if(navLogoActual){
    navLogoActual.style.display = C._navLogoImg ? 'block' : 'none';
    if(C._navLogoImg) document.getElementById('ep-nav-logo-actual-img').src = cldUrl(C._navLogoImg, CLD_LOGO);
  }
  const heroLogoPreview = document.getElementById('ep-hero-logo-preview');
  const heroLogoActual  = document.getElementById('ep-hero-logo-actual');
  if(heroLogoPreview) heroLogoPreview.style.display = 'none';
  if(C._heroLogoImg && heroLogoActual){
    heroLogoActual.style.display = 'block';
    document.getElementById('ep-hero-logo-actual-img').src = cldUrl(C._heroLogoImg, CLD_LOGO);
    document.getElementById('ep-hero-logo-texto').textContent = 'Clic para cambiar la imagen del título';
  } else if(heroLogoActual){
    heroLogoActual.style.display = 'none';
    document.getElementById('ep-hero-logo-texto').textContent = 'Hacé clic para subir la imagen del título';
  }
  // Rellenar campos Hero
  document.getElementById('ep-rubro').value          = C.rubro || '';
  document.getElementById('ep-ubicacion').value      = C.ubicacion || '';
  // Convertir <br> en salto para textarea
  document.getElementById('ep-hero-subtitulo').value = desEscapar((C.heroSubtitulo || '').replace(/<br\s*\/?>/gi, '\n'));

  // Imagen nosotros
  nosotrosImgPendiente = null;
  const preview = document.getElementById('ep-nosotros-img-preview');
  const thumb   = document.getElementById('ep-nosotros-img-thumb');
  if(C._nosotrosImg){
    thumb.src = cldUrl(C._nosotrosImg, CLD_LOGO);
    preview.style.display = 'block';
    document.getElementById('ep-nosotros-img-texto').textContent = 'Imagen cargada — clic para cambiar';
  } else {
    preview.style.display = 'none';
    document.getElementById('ep-nosotros-img-texto').textContent = 'Hacé clic para cambiar la imagen';
  }

  // Rellenar campos Nosotros
  document.getElementById('ep-nos-label').value    = C.nosotros.label  || '';
  document.getElementById('ep-nos-titulo').value   = C.nosotros.titulo || '';
  const ps = C.nosotros.parrafos || ['','',''];
  // Strip tags for editing
  document.getElementById('ep-nos-p1').value = desEscapar((ps[0]||'').replace(/<[^>]+>/g,''));
  document.getElementById('ep-nos-p2').value = desEscapar((ps[1]||'').replace(/<[^>]+>/g,''));
  document.getElementById('ep-nos-p3').value = desEscapar((ps[2]||'').replace(/<[^>]+>/g,''));
  

  document.getElementById('edit-nosotros-slogan').value = C.nosotros.slogan || '';


  const stats = C.nosotros.stats || [{num:'',label:''},{num:'',label:''}];
  document.getElementById('ep-stat1-num').value   = (stats[0]||{}).num   || '';
  document.getElementById('ep-stat1-label').value = (stats[0]||{}).label || '';
  document.getElementById('ep-stat2-num').value   = (stats[1]||{}).num   || '';
  document.getElementById('ep-stat2-label').value = (stats[1]||{}).label || '';

  // Rellenar campos Contacto
  document.getElementById('ep-whatsapp').value          = C.whatsapp || '';
  document.getElementById('ep-wa-display').value        = C.contacto.waDisplay || '';
  document.getElementById('ep-wa-texto').value          = C.contacto.waTexto || '';
  document.getElementById('ep-wa-texto-producto').value = C.contacto.waTextoProducto || '';
  document.getElementById('ep-instagram').value         = C.instagram || '';
  document.getElementById('ep-contacto-label').value    = C.contacto.label || '';
  document.getElementById('ep-contacto-titulo').value   = C.contacto.titulo || '';
  document.getElementById('ep-cta-titulo').value        = C.contacto.ctaTitulo || '';
  document.getElementById('ep-cta-parrafo').value       = C.contacto.ctaParrafo || '';
  document.getElementById('ep-cta-boton').value         = C.contacto.ctaBoton || '';

  // Mostrar tab inicial
  cambiarTabEP('hero');
  document.getElementById('edit-pagina-modal').classList.add('active');
}

// Convierte &amp; &lt; etc. de vuelta a texto para editarlo
function desEscapar(html){
  const t = document.createElement('textarea');
  t.innerHTML = html;
  return t.value;
}

function cerrarModalEditarPagina(e){
  if(e.target.id !== 'edit-pagina-modal') return;
  document.getElementById('edit-pagina-modal').classList.remove('active');
}

function cambiarTabEP(tab){
  document.querySelectorAll('.ep-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.ep-panel').forEach(p => p.style.display = 'none');
  document.getElementById('ep-panel-' + tab).style.display = 'block';
}

function cargarImagenNosotros(e){
  const file = e.target.files[0];
  if(!file) return;
  comprimirImagen(file, base64 => {
    nosotrosImgPendiente = base64;
    document.getElementById('ep-nosotros-img-thumb').src = base64;
    document.getElementById('ep-nosotros-img-preview').style.display = 'block';
    document.getElementById('ep-nosotros-img-texto').textContent = 'Imagen cargada — clic para cambiar';
  });
  e.target.value = '';
}

async function guardarEditarPagina(){
  const C = SITE_CONFIG;
  const btnGuardar = document.querySelector('#edit-pagina-modal .btn-guardar');
  if(btnGuardar){ btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando…'; }

  // ── 1) Subir imágenes nuevas a Cloudinary (si hay) ─────
  let nosotrosUrl = null, heroUrl = null, navUrl = null;
  try {
    const pendientes = [nosotrosImgPendiente, heroLogoImgPendiente, navLogoImgPendiente].filter(Boolean).length;
    let n = 0;
    const subir = async (img) => {
      if(!img) return null;
      n++;
      mostrarToast(`Subiendo imagen ${n} de ${pendientes}…`);
      return subirImagenCloudinary(img);
    };
    nosotrosUrl = await subir(nosotrosImgPendiente);
    heroUrl     = await subir(heroLogoImgPendiente);
    navUrl      = await subir(navLogoImgPendiente);
  } catch(err){
    console.error('Error subiendo imágenes:', err);
    mostrarToastError('⚠ No se pudieron subir las imágenes (' + esc(err.message) + ').<br>No se guardó ningún cambio.', 10000);
    if(btnGuardar){ btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar cambios'; }
    return;
  }

  // ── 2) Leer valores ────────────────────────────────────
  C.rubro      = document.getElementById('ep-rubro').value.trim();
  C.ubicacion  = document.getElementById('ep-ubicacion').value.trim();
  // Textarea usa \n, HTML usa <br>
  C.heroSubtitulo = esc(document.getElementById('ep-hero-subtitulo').value.trim()).replace(/\n/g,'<br>');

  C.nosotros.label  = document.getElementById('ep-nos-label').value.trim();
  C.nosotros.titulo = document.getElementById('ep-nos-titulo').value.trim();
  C.nosotros.parrafos = [
    document.getElementById('ep-nos-p1').value.trim(),
    document.getElementById('ep-nos-p2').value.trim(),
    document.getElementById('ep-nos-p3').value.trim()
  ].filter(p => p !== '').map(esc);
  C.nosotros.slogan = document.getElementById('edit-nosotros-slogan').value.trim();
  C.nosotros.stats = [
    { num: document.getElementById('ep-stat1-num').value.trim(), label: document.getElementById('ep-stat1-label').value.trim() },
    { num: document.getElementById('ep-stat2-num').value.trim(), label: document.getElementById('ep-stat2-label').value.trim() }
  ];

  C.whatsapp  = document.getElementById('ep-whatsapp').value.trim().replace(/\D/g,'');
  C.instagram = document.getElementById('ep-instagram').value.trim().replace(/^@/,'');
  C.contacto.waDisplay       = document.getElementById('ep-wa-display').value.trim();
  C.contacto.waTexto         = document.getElementById('ep-wa-texto').value.trim();
  C.contacto.waTextoProducto = document.getElementById('ep-wa-texto-producto').value.trim();
  C.contacto.label           = document.getElementById('ep-contacto-label').value.trim();
  C.contacto.titulo          = document.getElementById('ep-contacto-titulo').value.trim();
  C.contacto.ctaTitulo       = document.getElementById('ep-cta-titulo').value.trim();
  C.contacto.ctaParrafo      = document.getElementById('ep-cta-parrafo').value.trim();
  C.contacto.ctaBoton        = document.getElementById('ep-cta-boton').value.trim();

  if(nosotrosUrl) C._nosotrosImg = nosotrosUrl;
  if(heroUrl)     C._heroLogoImg = heroUrl;
  if(navUrl)      C._navLogoImg  = navUrl;
  nosotrosImgPendiente = heroLogoImgPendiente = navLogoImgPendiente = null;

  // ── 3) Aplicar en vivo a la página ─────────────────────
  applyConfig();
  document.getElementById('edit-pagina-modal').classList.remove('active');
  if(btnGuardar){ btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar cambios'; }
  mostrarToast('Guardando…');

  // ── 4) Persistir en Firebase ───────────────────────────
  try {
    const ts = Date.now();
    const data = {
      rubro:        C.rubro,
      ubicacion:    C.ubicacion,
      heroSubtitulo:C.heroSubtitulo,
      nosotros:     C.nosotros,
      whatsapp:     C.whatsapp,
      instagram:    C.instagram,
      contacto:     C.contacto,
      nosotrosImg:  C._nosotrosImg || null,
      heroLogoImg:  C._heroLogoImg || null,
      navLogoImg:   C._navLogoImg || null
    };
    await CONFIG_REF.set(data);
    // Invalidar caché de otros dispositivos
    await META_REF.set({ lastModified: ts }, { merge: true });
    try {
      localStorage.setItem('cache_ts', String(ts));
      localStorage.setItem('config_cache', JSON.stringify(data));
    } catch(e) {}
    mostrarToast('Cambios guardados ✓');
  } catch(err){
    console.error('Error guardando configEditable:', err);
    mostrarToastError('⚠ Error al guardar. Revisá la conexión, recargar la página.', 7000);
  }
}

// ════════════════════════════════════════════════════════
//  ADMIN — Herramientas (Cloudinary, migración, índice)
// ════════════════════════════════════════════════════════
async function abrirModalHerramientas(){
  document.getElementById('tools-modal').classList.add('active');
  const estadoCld = document.getElementById('tools-cld-estado');
  const estadoB64 = document.getElementById('tools-b64-estado');
  estadoCld.textContent = 'Verificando…';
  estadoB64.textContent = 'Verificando…';
  try {
    await esperarAdminListo();
    const snap = await CLOUDINARY_REF.get();
    const d = snap.exists ? snap.data() : null;
    estadoCld.textContent = d && d.cloudName
      ? `Configurado · cloud: ${d.cloudName} · preset: ${d.preset}`
      : 'Sin configurar (se te va a pedir al subir la primera foto)';
    const n = contarFotosBase64() + fotosBase64DePagina().length;
    estadoB64.textContent = n
      ? `Hay ${n} foto${n !== 1 ? 's' : ''} en formato viejo (base64) para migrar.`
      : 'Todas las fotos ya están en Cloudinary ✓';
  } catch(err){
    estadoCld.textContent = 'No se pudo verificar: ' + err.message;
    estadoB64.textContent = '';
  }
}

function cerrarModalHerramientas(e){
  if(e && e.target.id !== 'tools-modal') return;
  document.getElementById('tools-modal').classList.remove('active');
}

async function cambiarConfigCloudinary(){
  try {
    await configurarCloudinary();
    mostrarToast('Cloudinary configurado ✓');
    abrirModalHerramientas();
  } catch(err){
    mostrarToastError('⚠ ' + esc(err.message), 5000);
  }
}

// Imágenes de la página (logos / Nosotros) que siguen en base64
function fotosBase64DePagina(){
  const C = SITE_CONFIG;
  return [
    ['nosotrosImg', C._nosotrosImg],
    ['heroLogoImg', C._heroLogoImg],
    ['navLogoImg',  C._navLogoImg]
  ].filter(([, v]) => esBase64(v));
}

// Sube a Cloudinary todas las fotos guardadas en base64 y reemplaza por URLs.
// Se puede cortar y volver a ejecutar: retoma con lo que falte.
async function migrarFotosACloudinary(){
  const btn = document.getElementById('tools-btn-migrar');
  const log = document.getElementById('tools-log');
  try {
    await esperarAdminListo();
    const conFotos = productos.filter(p => {
      const imgs = Array.isArray(p.imgs) && p.imgs.length ? p.imgs : [p.img];
      return imgs.some(esBase64) || esBase64(p.img);
    });
    const dePagina = fotosBase64DePagina();
    if(!conFotos.length && !dePagina.length){
      log.textContent = 'No hay nada para migrar ✓';
      return;
    }
    if(!confirm(`Se van a subir a Cloudinary las fotos de ${conFotos.length} producto(s)` +
                (dePagina.length ? ` y ${dePagina.length} imagen(es) de la página` : '') +
                '. ¿Continuar?')) return;

    await obtenerCloudinary();
    btn.disabled = true;
    let hechos = 0;
    for(const p of conFotos){
      log.textContent = `Producto ${hechos + 1} de ${conFotos.length}: ${p.nombre}…`;
      const imgs = Array.isArray(p.imgs) && p.imgs.length ? p.imgs : [p.img];
      const urls = await subirFotosPendientes(imgs);
      p.imgs = urls;
      p.img  = urls[0];
      // Se guarda producto por producto para no perder avance si algo falla
      await PRODS_COL.doc(p.id).set(productoParaIndice(p));
      hechos++;
    }

    if(dePagina.length){
      log.textContent = 'Subiendo imágenes de la página…';
      const C = SITE_CONFIG;
      const cambios = {};
      for(const [campo, valor] of dePagina){
        cambios[campo] = await subirImagenCloudinary(valor);
      }
      if(cambios.nosotrosImg) C._nosotrosImg = cambios.nosotrosImg;
      if(cambios.heroLogoImg) C._heroLogoImg = cambios.heroLogoImg;
      if(cambios.navLogoImg)  C._navLogoImg  = cambios.navLogoImg;
      await CONFIG_REF.set(cambios, { merge: true });
      try { localStorage.removeItem('config_cache'); } catch(e) {}
      applyConfig();
    }

    // Regenerar índice (ahora sí entra en un solo documento)
    await commitCambios([]);
    buildAllCarousels();
    log.textContent = `Listo ✓ Se migraron ${hechos} producto(s)` + (dePagina.length ? ` y ${dePagina.length} imagen(es) de la página.` : '.');
    mostrarToast('Migración completa ✓');
  } catch(err){
    console.error('Error migrando fotos:', err);
    log.textContent = '⚠ Se interrumpió: ' + err.message + '. Podés volver a ejecutarla, retoma desde donde quedó.';
  } finally {
    if(btn) btn.disabled = false;
  }
}

// Vuelve a leer la colección completa y regenera el índice que leen los visitantes
async function reconstruirIndice(){
  const log = document.getElementById('tools-log');
  try {
    log.textContent = 'Leyendo todos los productos…';
    productos = await leerColeccionCompleta();
    await commitCambios([]);
    await guardarMetaEnFirebase();
    buildAllCarousels();
    log.textContent = `Índice regenerado con ${productos.length} productos ✓`;
  } catch(err){
    log.textContent = '⚠ Error: ' + err.message;
  }
}

// ════════════════════════════════════════════════════════
//  Toast
// ════════════════════════════════════════════════════════
function mostrarToast(msg){
  const t = document.getElementById('admin-toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

function mostrarToastError(msg, duracion = 2800){
  const t = document.getElementById('admin-toast');
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duracion);
}

// ════════════════════════════════════════════════════════
//  BUSCADOR
// ════════════════════════════════════════════════════════
let searchTimeout = null;

function abrirBuscador(){
  const overlay = document.getElementById('search-overlay');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  document.getElementById('search-input').value = '';
  document.getElementById('search-empty').style.display = 'none';
  ejecutarBusqueda('');
  setTimeout(() => document.getElementById('search-input').focus(), 80);
}

function cerrarBuscador(){
  document.getElementById('search-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

function onSearchInput(e){
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => ejecutarBusqueda(e.target.value), 180);
}

function ejecutarBusqueda(query){
  const q = query.trim();
  const resultsEl = document.getElementById('search-results');
  const emptyEl   = document.getElementById('search-empty');
  const countEl   = document.getElementById('search-count');

  if(!q){
    // Sin texto → mostrar la primera categoría visible (normalmente "Destacados")
    emptyEl.style.display = 'none';
    const primeraCat = getCategorias().filter(c => !categoriasOcultas.includes(c))[0];
    if(!primeraCat){ resultsEl.innerHTML = ''; countEl.textContent = ''; return; }
    const destacados = productos.filter(p => {
      const lista = Array.isArray(p.tipos) ? p.tipos : [p.tipo];
      return lista.includes(primeraCat);
    });
    countEl.textContent = primeraCat; // muestra el nombre de la categoría como título
    resultsEl.innerHTML = '';
    destacados.forEach(p => {
      const card = document.createElement('div');
      card.className = 'search-card';
      const cats = Array.isArray(p.tipos) ? p.tipos.join(' · ') : (p.tipo || '');
      card.innerHTML = `
        <div class="search-card-img">
          <img src="${esc(cldUrl(p.img, CLD_THUMB))}" alt="${esc(p.nombre)}" loading="lazy">
        </div>
        <div class="search-card-info">
          <div class="search-card-cat">${esc(cats)}</div>
          <div class="search-card-name">${esc(p.nombre)}</div>
          <div class="search-card-desc">${p.desc ? esc(p.desc.substring(0,80))+'…' : ''}</div>
        </div>
        <button class="search-card-btn">Ver</button>`;
      card.addEventListener('click', () => { cerrarBuscador(); openModal(p); });
      resultsEl.appendChild(card);
    });
    return;
  }

  const palabras = q.toLowerCase().split(/\s+/).filter(Boolean);
  const encontrados = productos.filter(p => {
    const titulo = p.nombre.toLowerCase();
    return palabras.some(w => titulo.includes(w));
  });

  countEl.textContent = encontrados.length > 0
    ? `${encontrados.length} resultado${encontrados.length !== 1 ? 's' : ''}`
    : '';

  if(!encontrados.length){
    resultsEl.innerHTML = '';
    emptyEl.style.display = 'block';
    emptyEl.querySelector('.search-empty-term').textContent = `"${q}"`;
    return;
  }

  emptyEl.style.display = 'none';
  resultsEl.innerHTML = '';
  encontrados.forEach(p => {
    const card = document.createElement('div');
    card.className = 'search-card';
    const cats = Array.isArray(p.tipos) ? p.tipos.join(' · ') : (p.tipo || '');
    card.innerHTML = `
      <div class="search-card-img">
        <img src="${esc(cldUrl(p.img, CLD_THUMB))}" alt="${esc(p.nombre)}" loading="lazy">
      </div>
      <div class="search-card-info">
        <div class="search-card-cat">${esc(cats)}</div>
        <div class="search-card-name">${resaltarPalabras(p.nombre, palabras)}</div>
        <div class="search-card-desc">${p.desc ? esc(p.desc.substring(0,80))+'…' : ''}</div>
      </div>
      <button class="search-card-btn">Ver</button>`;
    card.addEventListener('click', () => { cerrarBuscador(); openModal(p); });
    resultsEl.appendChild(card);
  });
}

function resaltarPalabras(texto, palabras){
  let result = esc(texto);
  palabras.forEach(w => {
    const regex = new RegExp(`(${esc(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');
  });
  return result;
}




function toggleLoginPassword() {
  const input = document.getElementById('login-password');
  const iconShow = document.getElementById('eye-icon-show');
  const iconHide = document.getElementById('eye-icon-hide');
  if (input.type === 'password') {
    input.type = 'text';
    iconShow.style.display = 'none';
    iconHide.style.display = '';
  } else {
    input.type = 'password';
    iconShow.style.display = '';
    iconHide.style.display = 'none';
  }
}




document.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  cerrarBuscador();
  const modal = document.getElementById('modal');
  if(modal.classList.contains('active')){
    modal.classList.remove('active');
    document.body.style.overflow = '';
    resetModalZoom();
  }
  if(document.getElementById('cart-overlay').classList.contains('active')) toggleCarrito();
});

document.addEventListener('DOMContentLoaded', () => {

  const inputPrecio = document.getElementById('a-precio');

  if(!inputPrecio) return;

  inputPrecio.addEventListener('input', function(e){

    let valor = e.target.value.replace(/\D/g, '');

    if(!valor){
      e.target.value = '';
      return;
    }

    e.target.value = Number(valor).toLocaleString('es-AR');
  });

});


// ════════════════════════════════════════════════════════
//  PARALLAX HERO — los círculos se mueven al hacer scroll
//  Cada círculo tiene una velocidad distinta (factor),
//  creando sensación de profundidad. Sutil y elegante.
// ════════════════════════════════════════════════════════
(function iniciarParallax(){
  // factor: qué tan rápido se mueve cada círculo
  // positivo = baja más lento que el scroll (flota hacia arriba)
  // negativo = sube más rápido (se aleja)
  const capas = [
    { selector: '.hc1', factor: 0.18 },  // grande, movimiento suave
    { selector: '.hc2', factor: 0.28 },  // mediano, un poco más rápido
    { selector: '.hc3', factor: 0.12 },  // pequeño, casi inmóvil
  ];

  const elementos = capas.map(c => ({
    el: document.querySelector(c.selector),
    factor: c.factor
  })).filter(c => c.el);

  // ── Parallax imagen "Nosotros" ──────────────────────────
  // La imagen se mueve más lento que el scroll → efecto de profundidad
  const nosotrosImg = document.querySelector('.about-img-placeholder') || document.querySelector('.about-img-main');
  const FACTOR_NOS = window.innerWidth <= 768 ? 0.05 : 0.18; // 0 = sin efecto · 1 = fija · 0.18 = sutil y elegante

  let rafPending = false;

  function aplicar(){
    const scrollY = window.scrollY;

    // Círculos del hero
    elementos.forEach(({ el, factor }) => {
      el.style.transform = `translateY(${scrollY * factor}px)`;
    });

    // Imagen de Nosotros: offset relativo al centro visible de la sección
    if(nosotrosImg){
      const seccion = nosotrosImg.closest('#nosotros');
      const rect    = seccion ? seccion.getBoundingClientRect() : null;
      const centro  = rect ? rect.top + rect.height / 2 - window.innerHeight / 2 : 0;
      nosotrosImg.style.transform = `translateY(${centro * FACTOR_NOS}px) scale(${window.innerWidth <= 768 ? 1.02 : 1.08})`;
    }

    rafPending = false;
  }

  window.addEventListener('scroll', () => {
    if(!rafPending){
      rafPending = true;
      requestAnimationFrame(aplicar);
    }
  }, { passive: true });

  // Aplicar estado inicial sin esperar el primer scroll
  requestAnimationFrame(aplicar);
})();



// ════════════════════════════════════════════════════════
//  CARRITO DE COMPRAS
// ════════════════════════════════════════════════════════

function toggleCarrito() {
  const overlay = document.getElementById('cart-overlay');
  overlay.classList.toggle('active');
  if (overlay.classList.contains('active')) {
    document.body.style.overflow = 'hidden';
    actualizarCarritoUI();
  } else {
    document.body.style.overflow = '';
  }
}

function agregarAlCarrito(producto) {
  if (!producto.precio || producto.precio.trim() === '') {
    mostrarToastError('Este producto no tiene precio asignado.');
    return;
  }
  
  // Revisamos si el producto ya está en el carrito
  const existente = carrito.find(p => p.id === producto.id);
  
  if (existente) {
    // Si existe, solo sumamos 1 a la cantidad
    existente.cantidad += 1;
  } else {
    // Si no existe, lo agregamos con cantidad inicial de 1
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      img: producto.img,
      cantidad: 1
    });
  }

  actualizarCarritoUI();
  mostrarToast('Producto agregado al carrito 🛒');
  closeModal({ target: document.getElementById('modal') }); 
}

// Nueva función para sumar/restar desde el carrito
function cambiarCantidad(index, delta) {
  if (carrito[index]) {
    carrito[index].cantidad += delta;
    // Si la cantidad llega a 0, se elimina del carrito
    if (carrito[index].cantidad <= 0) {
      eliminarDelCarrito(index);
    } else {
      actualizarCarritoUI();
    }
  }
}

function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
  actualizarCarritoUI();
}

// El carrito sobrevive a recargar la página (se guarda en este navegador)
function guardarCarritoLocal(){
  try { localStorage.setItem('carrito', JSON.stringify(carrito)); } catch(e) {}
}

function cargarCarritoLocal(){
  try {
    const data = JSON.parse(localStorage.getItem('carrito') || '[]');
    if(Array.isArray(data)) carrito = data.filter(p => p && p.id && p.cantidad > 0);
  } catch(e) {}
  actualizarCarritoUI();
}

function actualizarCarritoUI() {
  guardarCarritoLocal();
  const itemsContainer = document.getElementById('cart-items');
  const countBadge = document.getElementById('cart-count');
  const totalEl = document.getElementById('cart-total-price');
  
  // Contamos el total de unidades (no solo la cantidad de productos distintos)
  let totalUnidades = 0;
  carrito.forEach(p => totalUnidades += p.cantidad);

  // Burbuja con el contador en el menú superior
  if (totalUnidades > 0) {
    countBadge.style.display = 'flex';
    countBadge.textContent = totalUnidades;
  } else {
    countBadge.style.display = 'none';
  }

  // Burbuja con el contador en el dock flotante mobile
  const dockBadge = document.getElementById('dock-cart-count');
  if (dockBadge) {
    if (totalUnidades > 0) {
      dockBadge.style.display = 'flex';
      dockBadge.textContent = totalUnidades;
    } else {
      dockBadge.style.display = 'none';
    }
  }

  // Lista vacía
  if (carrito.length === 0) {
    itemsContainer.innerHTML = '<p class="cart-empty">Tu carrito está vacío.<br><br>¡Agregá algunos productos!</p>';
    totalEl.textContent = '$0';
    return;
  }

  // Renderizar items y calcular total
  let html = '';
  let total = 0;

  carrito.forEach((p, idx) => {
    const precioNum = Number((p.precio || '0').replace(/\D/g, ''));
    const subtotal = precioNum * p.cantidad;
    total += subtotal;
    
    html += `
      <div class="cart-item">
        <img src="${esc(cldUrl(p.img, CLD_THUMB))}" class="cart-item-img">
        <div class="cart-item-info">
          <div class="cart-item-title">${esc(p.nombre)}</div>
          <div class="cart-item-price">${esc(p.precio)} c/u</div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
            <button onclick="cambiarCantidad(${idx}, -1)" style="width:24px; height:24px; border:1px solid var(--detalles); background:transparent; cursor:pointer; border-radius:4px; display:flex; align-items:center; justify-content:center; color:var(--text); font-weight:bold; transition: background 0.2s;">-</button>
            <span style="font-size:13px; font-weight:600; width:18px; text-align:center; color:var(--text);">${p.cantidad}</span>
            <button onclick="cambiarCantidad(${idx}, 1)" style="width:24px; height:24px; border:1px solid var(--detalles); background:transparent; cursor:pointer; border-radius:4px; display:flex; align-items:center; justify-content:center; color:var(--text); font-weight:bold; transition: background 0.2s;">+</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="eliminarDelCarrito(${idx})" title="Eliminar del carrito">✕</button>
      </div>
    `;
  });

  itemsContainer.innerHTML = html;
  totalEl.textContent = '$' + total.toLocaleString('es-AR');
}

function enviarPedidoWa() {
  if (carrito.length === 0) {
    mostrarToastError('El carrito está vacío.');
    return;
  }

  let lineas = [`Hola! Como estas? Me gustaria hacer el siguiente pedido:`];
  let total = 0;

  carrito.forEach((p) => {
    const precioNum = Number((p.precio || '0').replace(/\D/g, ''));
    total += precioNum * p.cantidad;
    lineas.push(`• ${p.cantidad}x *${p.nombre}* - ${p.precio} c/u `);
  });

  lineas.push(`*TOTAL A ABONAR: $${total.toLocaleString('es-AR')}*`);

  const mensaje = lineas.join('\n');
  const url = `https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
}
// ════════════════════════════════════════════════════════════════
//  MENÚ HAMBURGUESA (mobile) + DROPDOWN DESKTOP (categorías)
// ════════════════════════════════════════════════════════════════

function initDropdownListeners() {
  // El dropdown ahora es puro CSS :hover — no necesita JS para abrirse/cerrarse.
  // Solo necesitamos poblar las categorías la primera vez que se hace hover.
  const li = document.getElementById('nav-productos-li');
  if (!li) return;
  let built = false;
  li.addEventListener('mouseenter', () => {
    if (!built) { buildNavCategoryMenus(); built = true; }
  });
}

function buildNavCategoryMenus() {
  const cats = getCategorias().filter(c => !categoriasOcultas.includes(c));

  // ── Desktop dropdown ──
  const desktopEl = document.getElementById('nav-dropdown-cats');
  if (desktopEl) {
    desktopEl.innerHTML = '';
    cats.forEach(cat => {
      const a = document.createElement('a');
      a.className = 'nav-dropdown-item';
      a.textContent = cat;
      a.addEventListener('click', () => irACategoria(cat));
      desktopEl.appendChild(a);
    });
  }

  // ── Mobile menu ──
  const mobileEl = document.getElementById('mobile-menu-cats');
  if (mobileEl) {
    mobileEl.innerHTML = '';
    // "Todos los productos" primero
    const btnTodos = document.createElement('button');
    btnTodos.className = 'mobile-menu-cat-item mobile-menu-cat-todos';
    btnTodos.textContent = 'Todos los productos';
    btnTodos.addEventListener('click', () => { closeMobileMenu(); irATodosLosProductos(); });
    mobileEl.appendChild(btnTodos);
    // Separador
    const sep = document.createElement('div');
    sep.className = 'mobile-menu-cat-sep';
    mobileEl.appendChild(sep);
    // Categorías individuales
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'mobile-menu-cat-item';
      btn.textContent = cat;
      btn.addEventListener('click', () => { closeMobileMenu(); irACategoria(cat); });
      mobileEl.appendChild(btn);
    });
  }
}

function closeDesktopDropdown() {
  // No-op: el dropdown se cierra solo con CSS :hover
}

function irACategoria(catName) {
  const sectionId = 'section-' + getCatId(catName);
  const section = document.getElementById(sectionId);
  if (section) {
    const navH = document.querySelector('nav')?.offsetHeight || 60;
    const top = section.getBoundingClientRect().top + window.scrollY - navH - 12;
    window.scrollTo({ top, behavior: 'smooth' });
  } else {
    scrollToSection('productos');
    setTimeout(() => irACategoria(catName), 600);
  }
}

function irATodosLosProductos() {
  const section = document.getElementById('section-todos');
  if (section) {
    const navH = document.querySelector('nav')?.offsetHeight || 60;
    const top = section.getBoundingClientRect().top + window.scrollY - navH - 12;
    window.scrollTo({ top, behavior: 'smooth' });
  } else {
    scrollToSection('productos');
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  const btn = document.getElementById('nav-hamburger');
  const isOpen = menu.classList.contains('active');
  if (isOpen) {
    closeMobileMenu();
  } else {
    buildNavCategoryMenus();
    menu.classList.add('active');
    overlay.classList.add('active');
    btn.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  const btn = document.getElementById('nav-hamburger');
  menu.classList.remove('active');
  overlay.classList.remove('active');
  btn.classList.remove('active');
  document.body.style.overflow = '';
}

// Inicializar listeners del dropdown cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDropdownListeners);
} else {
  initDropdownListeners();
}

// Hook sobre buildAllCarousels para reconstruir los menús
(function patchBuildAll() {
  const origFn = window.buildAllCarousels;
  if (origFn) {
    window.buildAllCarousels = function() {
      origFn.apply(this, arguments);
      setTimeout(buildNavCategoryMenus, 200);
    };
  }
})();

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileMenu(); });

