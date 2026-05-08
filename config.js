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
  rubro:     "Repostería artesanal", 
  ubicacion: "Paso del Rey",          // Ej: "Buenos Aires", "Palermo"

  // ── HERO ───────────────────────────────────────────────────────
  heroSubtitulo: "Tortas, meriendas y postres elaborados con amor, los mejores ingredientes y dedicación.",

  // ── SECCIÓN NOSOTROS ───────────────────────────────────────────
  nosotros: {
    label:  "Nuestra historia",
    titulo: "Cada dulce es una pequeña obra de arte",
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
  whatsapp:  "541134521808",       // Sin +, sin espacios. Ej: "5491123456789"
  instagram: "dulce.princesa.ok",  // Sin @

  contacto: {
    label:      "Hablemos",
    titulo:     "¿Buscás algo especial?",
    waDisplay:  "+54 11 3452-1808",           
    waTexto:    "Hola! Vi su página y me gustaría consultar para hacer un pedido.",
    waTextoProducto: "Hola! Vi su página y me gustaría consultar por: *{nombre}*",
    ctaTitulo:  "Hacemos tu pedido a medida",
    ctaParrafo: "Cada creación es única y personalizada. Contanos qué estás buscando — sabores, ocasión, cantidad — y te respondemos a la brevedad con todos los detalles.",
    ctaBoton:   "Escribinos por WhatsApp"
  },

  // ── FOOTER ─────────────────────────────────────────────────────
  footer: {
    copyright: "© 2026 Dulce Princesa · Amor en cada ingrediente"
  },

  // ── ADMIN ──────────────────────────────────────────────────────
  admin: {
    nombrePanel: "Dulce Princesa"   // Aparece en la barra de administrador
  },

  // ── TIPO DE PRODUCTO (para los textos del panel admin) ─────────
  tipoProducto:        "Tartas",               // Ej: "tortas", "tartas"
  tipoProductoEjemplo: "Tarta de frutas",              // Ej: "torta de chocolate"

  // ── CATEGORÍAS PREDEFINIDAS (panel admin) ──────────────────────
  // Las que aparecen en el dropdown al cargar el panel por primera vez
  categoriasFijas: [],

  // ── FIREBASE ───────────────────────────────────────────────────
  // Creá un proyecto nuevo en https://console.firebase.google.com para cada cliente
  firebase: {
    apiKey: "AIzaSyBxpC0bH7CmaZOW4egg2CKHaSIvIQiwvi8",
    authDomain: "dulce-princesa-2.firebaseapp.com",
    projectId: "dulce-princesa-2",
    storageBucket: "dulce-princesa-2.firebasestorage.app",
    messagingSenderId: "428638217700",
    appId: "1:428638217700:web:b80397a7f600b7812b13f1"
  },

  // ── TIPOGRAFÍA (Google Fonts) ───────────────────────────────────
  // Si cambiás las fuentes, script.js actualiza el link de Google Fonts automáticamente
  // Usá exactamente el nombre como aparece en fonts.google.com
  fontSerif: "Cormorant Garamond",  // Fuente elegante para títulos
  fontSans:  "Jost",                // Fuente moderna para cuerpo de texto

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
  // Estos son los productos que se cargan si Firebase está vacío
  // o cuando el admin presiona "Restaurar originales"
  productosDefault: []
};
