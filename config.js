// ════════════════════════════════════════════════════════════════
//  CONFIG.JS — Editá SOLO este archivo para adaptar a cada cliente
//  (index.html, style.css y script.js no los tocás nunca más)
// ════════════════════════════════════════════════════════════════

const SITE_CONFIG = {

  // ── MARCA ──────────────────────────────────────────────────────
  // Nombre que aparece en el nav, hero, footer y título del browser
  marcaPrincipal: "Dulce",      // Parte normal del nombre
  marcaItalica:   "Princesa",   // Parte en cursiva y con color del acento

  // ── DESCRIPCIÓN CORTA ──────────────────────────────────────────
  rubro:     "Reposteria Artesanal", 
  ubicacion: "Paso del Rey",          // Ej: "Buenos Aires", "Palermo"

  // ── HERO ───────────────────────────────────────────────────────
  heroSubtitulo: "Tortas, meriendas y postres elaborados con amor, los mejores ingredientes y dedicación.",

  // ── SECCIÓN NOSOTROS ───────────────────────────────────────────
  nosotros: {
    label:  "Nuestra historia",
    titulo: "Cada dulce es una pequeña obra de arte",
    slogan: "Amor en cada ingrediente",
    parrafos: [
      "En <strong>Dulce Princesa</strong> nos dedicamos a crear experiencias dulces únicas. Cada torta, cada postre, cada merienda está pensada con detalle, elaborada con los mejores ingredientes y presentada con una estética cuidada.",
      "Nuestro emprendimiento nació con la pasión de endulzar los momentos especiales: cumpleaños, reuniones, celebraciones o simplemente un capricho merecido.",
      "Trabajamos de forma artesanal, pedido por pedido, para garantizar la frescura y calidad que mereces."
    ],
    stats: [
      { num: "100%", label: "Artesanal" },
      { num: "♡",   label: "Hecho con amor" }
    ]
  },

  // ── SECCIÓN PRODUCTOS ──────────────────────────────────────────
  productos: {
    label:  "Lo que ofrecemos",
    titulo: "Nuestras creaciones"
  },

  // ── CONTACTO ───────────────────────────────────────────────────
  whatsapp:  "541134521808",         // Sin +, sin espacios. Ej: "5491123456789"
  instagram: "dulce.princesa.ok",  // Sin @

  contacto: {
  label:      "Hablemos",
  titulo:     "¿Buscás algo especial?",
  waDisplay:  "+54 11 3452-1808",           
  waTexto:    "Hola! Como estas? Me gustaria consultarte por tus productos!",
  waTextoProducto: "Hola! Como estas? Me gustaria consultarte por: *{nombre}*",
  ctaTitulo:  "Hacemos tu pedido a medida",
  ctaParrafo: "Cada creación es única y personalizada. Contanos qué estás buscando — sabores, ocasión, cantidad — y te respondemos a la brevedad con todos los detalles.",
  ctaBoton:   "Escribinos por WhatsApp"
},

  // ── FOOTER ─────────────────────────────────────────────────────
  footer: {
    copyright: "© 2026 Dulce Princesa · Amor en cada ingrediente"
  },

  seo: {
    // Pestaña del browser y título principal de OG/Twitter
    title:       "Dulce Princesa · Repostería Artesanal · Paso del Rey",

    // Descripción para buscadores y previews de WhatsApp/redes
    description: "Tortas, meriendas y postres artesanales elaborados con amor. Pedidos personalizados. Paso del Rey.",

    // URL canónica del sitio (sin barra final)
    url:         "https://dulceprincesaok.github.io/Dulce_Princesa_PaginaWeb",

    // Imagen que aparece al compartir el link (idealmente 1200×630 px)
    image:       "https://dulceprincesaok.github.io/Dulce_Princesa_PaginaWeb/img/logo.png",

    // Idioma/locale (dejá es_AR para Argentina)
    locale:      "es_AR"
  },

  // ── ADMIN ──────────────────────────────────────────────────────
  admin: {
    nombrePanel: "Dulce Princesa"   // Aparece en la barra de administrador
  },

  // ── TIPO DE PRODUCTO (para los textos del panel admin) ─────────
  tipoProducto:        "Tartas",               
  tipoProductoEjemplo: "Tarta de Frutas", 

  paginacionBatch: 8, // productos por batch por carrusel

  // ── CATEGORÍAS PREDEFINIDAS (panel admin) ──────────────────────
  // Las que aparecen en el dropdown al cargar el panel por primera vez
  categoriasFijas: [],

  // ── FIREBASE ───────────────────────────────────────────────────
  firebase: {
    apiKey: "AIzaSyBxpC0bH7CmaZOW4egg2CKHaSIvIQiwvi8",
    authDomain: "dulce-princesa-2.firebaseapp.com",
    projectId: "dulce-princesa-2",
    storageBucket: "dulce-princesa-2.firebasestorage.app",
    messagingSenderId: "428638217700",
    appId: "1:428638217700:web:b80397a7f600b7812b13f1"
  },

  // ── TIPOGRAFÍA (Google Fonts) ───────────────────────────────────
  tipografia: {
    // Cuerpo de texto (párrafos, botones, inputs, etiquetas, nav links)
    cuerpo:          "Inter",

    // Logo en el nav (marca del negocio)
    nav:             "EB Garamond",

    // Título grande en el hero (nombre de la marca)
    tituloPagina:    "Pinyon Script",

    // Títulos de secciones (Nosotros, Contacto, etc.)
    tituloSeccion:   "Cormorant Garamond",

    // Nombre del producto en cards y modales
    tituloProducto:  "Cormorant Garamond",

    // Títulos en paneles y modales del admin
    tituloAdmin:     "Cormorant Garamond",
  },

  // ── LEGACY (no tocar — usados internamente por script.js) ──────
  // Se derivan automáticamente de tipografia arriba
  get fontSerif(){ return this.tipografia.tituloPagina },
  get fontSans() { return this.tipografia.cuerpo },

  // ── PALETA DE COLORES ──────────────────────────────────────────
  // Usá coolors.co o palettte.app para generar paletas para cada cliente
  colores: {
    fondo:  "#F2C4CE",        /* color fondo */
    principal:  "#D4849A",    /* color principal */
    secciones:  "#FAF0F2",    /* color para secciones */
    detalles: "#E8A0B0",     /* color para detalles */
    cream:  "#F7FCFD",        /* fondo general frío */
    text: "#3A2328",         /* azul oscuro elegante */
    textSoft:  "#7A5560",    /* gris azulado */
    gold: "#C9A96E",         /* acento verde agua */
    white:  "#ffffff"
  },

  // ── CATÁLOGO INICIAL / RESTAURACIÓN ────────────────────────────
  heroLogoImgDefault: "img/LOGOHERO.png",
  navLogoImgDefault:  null,

  productosDefault: []
};




/*
MODIFICAR ESA PARTE EN style.css para ajustar separacion en pantalla principal (modificar lo que diga margin-bottom: rem)

.hero-content{position:relative;z-index:2;text-align:center;max-width:700px;padding:2rem}
  .hero-eyebrow{font-size:11px;letter-spacing:5px;text-transform:uppercase;color:var(--principal);margin-bottom:1rem;opacity:0;transform:translateY(14px);transition:opacity .72s ease, transform .72s ease}
   #hero-eyebrow-2{margin-bottom:2.5rem}
  .hero-title{font-family:var(--font-titulo-pagina),serif;font-size:clamp(52px,8vw,88px);font-weight:300;line-height:1.05;color:var(--text);margin-bottom:1.2rem;opacity:0;transform:translateY(14px);transition:opacity .72s ease, transform .72s ease}
  .hero-title em{color:var(--principal);font-style:italic}
  .hero-title-img-wrap{background:transparent;margin-bottom:2rem;opacity:0;transform:translateY(14px);transition:opacity .72s ease, transform .72s ease}
  .hero-title-img-wrap img{background:transparent;mix-blend-mode:multiply}
  .hero-subtitle{font-size:15px;font-weight:300;color:var(--text-soft);letter-spacing:1px;line-height:1.8;margin-bottom:2rem;opacity:0;transform:translateY(14px);transition:opacity .72s ease, transform .72s ease}
  .hero-cta{display:inline-flex;gap:1rem;flex-wrap:wrap;justify-content:center;opacity:0;transform:translateY(14px);transition:opacity .72s ease, transform .72s ease}

*/