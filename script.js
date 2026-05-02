// ════════════════════════════════════════════════════════
//  CONFIGURACIÓN FIREBASE
// ════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyDNUQ0Kz_vjlPzG3ChnWIFFeKOPziIcz1c",
  authDomain: "dulce-princesa-18082001.firebaseapp.com",
  projectId: "dulce-princesa-18082001",
  storageBucket: "dulce-princesa-18082001.firebasestorage.app",
  messagingSenderId: "1030198289641",
  appId: "1:1030198289641:web:0b93396e294ccc23fbfc78"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const DOC_REF = db.collection('catalogo').doc('productos');

// ════════════════════════════════════════════════════════
//  PRODUCTOS ORIGINALES (fallback y restauración)
// ════════════════════════════════════════════════════════
const productosDefault = [
  {
    nombre:"Pan dulce",
    tipo:"Panadería",
    desc:"Hecho con mucho amor, bien esponjoso y lleno de sabor. Podés elegir clásico con frutas abrillantadas o con chips de chocolate 🍫🍊",
    img:"img/pan_dulce_1.jpg"
  },
  {
    nombre:"Tarta de durazno",
    tipo:"Tartas",
    desc:"Nuestra tarta de durazno, dulce de leche y crema es ese abrazo dulce que estabas esperando. Fruta fresca, crema suave, base crocante y el clásico sabor del dulce de leche… todo en una sola porción de felicidad.",
    img:"img/tarta_durazno.webp"
  },
  {
    nombre:"Tarta de chocolate y dulce de leche",
    tipo:"Tartas",
    desc:"Exquisita tarta con base crocante, rellena de dulce de leche y cubierta con chocolate. La combinación perfecta, un mordisco para la felicidad 🍫",
    img:"img/tarta_chocolate.jpg"
  },
  {
    nombre:"Pasta frola",
    tipo:"Clásicos",
    desc:"Clásica pasta frola con masa suave y relleno de dulce de membrillo o batata. Hecha con amor, rellena de tradición… y lista para conquistarte.",
    img:"img/pasta_frola.webp"
  },
  {
    nombre:"Huevo de Pascua",
    tipo:"Clásicos",
    desc:"Chocolate fino, diseño artesanal y toda la magia de la tradición. Un regalo perfecto para celebrar la Pascua con estilo y dulzura.",
    img:"img/huevo_pascua.webp"
  }
];

// ════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ════════════════════════════════════════════════════════
let productos = [];
let posCarrusel = {};       // { catId: posicion }
let carruselProds = {};     // { catId: [productos del carrusel] }
let categoriasOcultas = []; // nombres de categorías ocultas

const params = new URLSearchParams(location.search);
const ADMIN_REQUEST = params.has('admin');
let ADMIN_MODE = false;

// ════════════════════════════════════════════════════════
//  FIREBASE: cargar y guardar
// ════════════════════════════════════════════════════════
async function cargarDesdeFirebase(){
  const snap = await DOC_REF.get();
  if(snap.exists){
    const data = snap.data();
    if(data.lista && data.lista.length > 0){
      categoriasOcultas = Array.isArray(data.categoriasOcultas) ? data.categoriasOcultas : [];
      return data.lista;
    }
  }
  await DOC_REF.set({ lista: productosDefault, categoriasOcultas: [] });
  return productosDefault.map(p => ({...p}));
}

async function guardarEnFirebase(){
  await DOC_REF.set({ lista: productos, categoriasOcultas });
}

// ════════════════════════════════════════════════════════
//  LOGIN
// ════════════════════════════════════════════════════════
function pedirLoginAdmin(){
  const user = prompt("Usuario:");
  const pass = prompt("Contraseña:");
  if(user === "NaiLoza" && pass === "nachu18082001"){
    ADMIN_MODE = true;
    document.body.classList.add('admin');
  } else {
    alert("Credenciales incorrectas");
  }
}

function logoutAdmin(){ location.reload(); }

// ════════════════════════════════════════════════════════
//  INICIALIZAR
// ════════════════════════════════════════════════════════
async function inicializar(){
  // Login PRIMERO, dentro del DOMContentLoaded, para que Android no pierda el evento
  if(ADMIN_REQUEST){
    pedirLoginAdmin();
  }

  if(ADMIN_MODE){
    document.body.classList.add('admin-mode');
    document.getElementById('admin-bar').style.display = 'flex';
  }
  try {
    productos = await cargarDesdeFirebase();
  } catch(err){
    console.error('Error cargando Firebase:', err);
    productos = productosDefault.map(p => ({...p}));
  }
  document.getElementById('carrusel-loading').style.display = 'none';
  buildAllCarousels();
}

document.addEventListener('DOMContentLoaded', inicializar);
window.addEventListener('resize', () => buildAllCarousels());

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
  return [...new Set(productos.map(p => p.tipo))];
}

function visiblePorPantalla(){
  if(window.innerWidth <= 768)  return 1;
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

  visibles.forEach((cat, idx) => {
    const prods = productos.filter(p => p.tipo === cat);
    if(!prods.length) return;
    const catId = getCatId(cat);
    const section = crearSeccionCarrusel(cat, catId, idx > 0);
    container.appendChild(section);
    toInit.push({ catId, prods: [...prods] });
  });

  // "Todos los productos" al final
  if(productos.length > 0){
    const section = crearSeccionCarrusel('Todos los productos', 'todos', visibles.length > 0);
    container.appendChild(section);
    toInit.push({ catId: 'todos', prods: [...productos] });
  }

  // Ahora que están en el DOM, construir los tracks
  toInit.forEach(({ catId, prods }) => {
    buildTrack(catId, prods);
    // Touch swipe
    const track = document.getElementById('carrusel-track-' + catId);
    if(!track) return;
    let startX = 0;
    track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, {passive:true});
    track.addEventListener('touchend', e => {
      const diff = startX - e.changedTouches[0].clientX;
      if(Math.abs(diff) > 40) moverCarrusel(catId, diff > 0 ? 1 : -1);
    });
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
  header.innerHTML = `<span class="section-label cat-label">${cat}</span>`;
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
  const visible = visiblePorPantalla();

  carruselProds[catId] = prods;
  track.innerHTML = '';

  const btnPrev = document.getElementById('btn-prev-' + catId);
  const btnNext = document.getElementById('btn-next-' + catId);

  // Si hay ≤ productos que los slots visibles, mostrar estático sin clonar
  if(prods.length <= visible){
    prods.forEach(p => track.appendChild(crearCard(p, false)));
    posCarrusel[catId] = 0;
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    if(btnPrev) btnPrev.style.display = 'none';
    if(btnNext) btnNext.style.display = 'none';
    return;
  }

  if(btnPrev) btnPrev.style.display = '';
  if(btnNext) btnNext.style.display = '';

  prods.slice(-visible).forEach(p => track.appendChild(crearCard(p, true)));
  prods.forEach(p => track.appendChild(crearCard(p, false)));
  prods.slice(0, visible).forEach(p => track.appendChild(crearCard(p, true)));

  posCarrusel[catId] = visible;
  actualizarCarrusel(catId, false);
}

function crearCard(p, esClonado){
  const card = document.createElement('div');
  card.className = 'producto-card';
  card.innerHTML = `
    <div class="prod-img-placeholder">
      <img src="${p.img}" alt="${p.nombre}">
    </div>
    <div class="prod-info">
      <div class="prod-tipo">${p.tipo}</div>
      <div class="prod-name">${p.nombre}</div>
    </div>
    <div class="prod-overlay">
      <h3>${p.nombre}</h3>
      <div class="ver-mas">Ver más</div>
    </div>`;

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
  }

  card.addEventListener('click', () => openModal(p));
  return card;
}

function actualizarCarrusel(catId, animar = true){
  const track = document.getElementById('carrusel-track-' + catId);
  if(!track || !track.children.length) return;
  const cardW = track.children[0].getBoundingClientRect().width;
  track.style.transition = animar ? 'transform .45s cubic-bezier(.4,0,.2,1)' : 'none';
  track.style.transform  = `translateX(-${posCarrusel[catId] * (cardW + 20)}px)`;
}

function moverCarrusel(catId, dir){
  const visible = visiblePorPantalla();
  const prods = carruselProds[catId] || [];
  const total  = prods.length;
  if(total <= visible) return; // estático, sin scroll
  posCarrusel[catId] = (posCarrusel[catId] || visible) + dir;
  actualizarCarrusel(catId, true);

  const track = document.getElementById('carrusel-track-' + catId);
  if(!track) return;
  track.addEventListener('transitionend', () => {
    if(posCarrusel[catId] >= total + visible){ posCarrusel[catId] = visible; actualizarCarrusel(catId, false); }
    if(posCarrusel[catId] < visible){ posCarrusel[catId] = total + visible - 1; actualizarCarrusel(catId, false); }
  }, {once:true});
}

// ════════════════════════════════════════════════════════
//  MODAL PRODUCTO
// ════════════════════════════════════════════════════════
function openModal(p){
  document.getElementById('modal-tipo').textContent  = p.tipo;
  document.getElementById('modal-title').textContent = p.nombre;
  document.getElementById('modal-desc').textContent  = p.desc;
  
  const imgContainer = document.getElementById('modal-img');
  const imgs = p.imgs && p.imgs.length > 0 ? p.imgs : [p.img];
  
  if(imgs.length <= 1){
    imgContainer.innerHTML = `<img src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover;">`;
  } else {
    let dotsHTML = imgs.map((_,i) => `<div class="modal-dot${i===0?' active':''}" onclick="modalCarouselGo(${i})"></div>`).join('');
    let imgsHTML = imgs.map((src,i) => `<img src="${src}" class="${i===0?'active':''}" alt="">`).join('');
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
  
  const msg = encodeURIComponent("Hola! Vi su página y me gustaría hacer un pedido.");
  document.getElementById('modal-wa').href = `https://wa.me/541134521808?text=${msg}`;
  document.getElementById('modal').classList.add('active');
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
  }
}

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
  const idx = productos.indexOf(p);
  if(idx > -1) productos.splice(idx, 1);
  buildAllCarousels();
  mostrarToast('Guardando…');
  await guardarEnFirebase();
  mostrarToast('Producto eliminado ✓');
}

// ════════════════════════════════════════════════════════
//  ADMIN — Agregar / Editar
// ════════════════════════════════════════════════════════
let fotosBase64 = [];      // array de todas las fotos { data, isPortada }
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
  document.getElementById('a-tipo-nueva').value = '';
  document.getElementById('a-tipo-nueva-wrap').style.display = 'none';
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
        if(fotosBase64.length === files.length) portadaIdx = 0; // primera foto = portada por defecto al agregar la primera tanda
        renderFotosGrid();
        document.getElementById('a-foto-texto').textContent = `${fotosBase64.length} imagen${fotosBase64.length!==1?'es':''} cargada${fotosBase64.length!==1?'s':''}`;
      }
    });
  });
  // Reset input para poder subir las mismas fotos otra vez
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
      <img src="${src}" class="${i === portadaIdx ? 'portada-activa' : ''}" alt="">
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
      const MAX = 900;
      let w = img.width, h = img.height;
      if(w > MAX){ h = Math.round(h * MAX / w); w = MAX; }
      if(h > MAX){ w = Math.round(w * MAX / h); h = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// Mostrar/ocultar input de nueva categoría
function toggleNuevaCat(){
  const sel = document.getElementById('a-tipo');
  const wrap = document.getElementById('a-tipo-nueva-wrap');
  const input = document.getElementById('a-tipo-nueva');
  if(sel.value === '__nueva__'){
    wrap.style.display = 'block';
    input.focus();
  } else {
    wrap.style.display = 'none';
    input.value = '';
  }
}

// Poblar el select con las categorías existentes (incluyendo las creadas)
function poblarSelectTipo(valorActual){
  const sel = document.getElementById('a-tipo');
  const opcionesFijas = ['Tortas','Tartas','Clásicos','Panadería','Meriendas','Estacionales','Otro'];
  const existentes = getCategorias();
  // Mostrar solo las fijas que aún existen como categorías activas, más las extra creadas
  const extras = existentes.filter(c => !opcionesFijas.includes(c));
  const fijasFiltradas = opcionesFijas.filter(c => existentes.includes(c) || !productos.length);

  sel.innerHTML = `<option value="">— Seleccioná una categoría —</option>`;
  [...fijasFiltradas, ...extras].forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  // Siempre mostrar la opción de nueva categoría
  const optNueva = document.createElement('option');
  optNueva.value = '__nueva__';
  optNueva.textContent = '＋ Agregar nueva categoría…';
  sel.appendChild(optNueva);

  if(valorActual) sel.value = valorActual;
  document.getElementById('a-tipo-nueva-wrap').style.display = 'none';
  document.getElementById('a-tipo-nueva').value = '';
}

async function guardarProducto(){
  const nombre = document.getElementById('a-nombre').value.trim();
  let   tipo   = document.getElementById('a-tipo').value;
  const desc   = document.getElementById('a-desc').value.trim();

  // Resolver nueva categoría
  if(tipo === '__nueva__'){
    tipo = document.getElementById('a-tipo-nueva').value.trim();
    if(!tipo){ alert('Por favor escribí el nombre de la nueva categoría.'); return; }
  }

  if(!nombre)    { alert('Por favor ingresá el nombre del producto.'); return; }
  if(!tipo)      { alert('Por favor seleccioná una categoría.'); return; }
  if(!desc)      { alert('Por favor escribí una descripción.'); return; }
  if(!fotosBase64.length){ alert('Por favor subí al menos una foto del producto.'); return; }

  // Reordenar: portada primero
  const reordenadas = [fotosBase64[portadaIdx], ...fotosBase64.filter((_,i)=>i!==portadaIdx)];
  const imgPortada = reordenadas[0];

  if(productoEditando){
    productoEditando.nombre = nombre;
    productoEditando.tipo   = tipo;
    productoEditando.desc   = desc;
    productoEditando.img    = imgPortada;
    productoEditando.imgs   = reordenadas;
  } else {
    productos.push({ nombre, tipo, desc, img: imgPortada, imgs: reordenadas });
  }

  buildAllCarousels();
  document.getElementById('admin-modal').classList.remove('active');
  mostrarToast('Guardando…');
  await guardarEnFirebase();
  mostrarToast('Producto guardado ✓');
  setTimeout(() => scrollToSection('productos'), 300);
  productoEditando = null;
  fotosBase64 = [];
  portadaIdx = 0;
  renderFotosGrid();
  document.querySelector('.admin-modal h2').textContent = 'Nuevo producto';
}

function abrirModalEditar(p){
  productoEditando = p;
  document.getElementById('a-nombre').value = p.nombre;
  poblarSelectTipo(p.tipo);
  document.getElementById('a-desc').value   = p.desc;
  // Cargar fotos existentes
  fotosBase64 = p.imgs && p.imgs.length > 0 ? [...p.imgs] : [p.img];
  portadaIdx = 0;
  renderFotosGrid();
  document.getElementById('a-foto-texto').textContent = `${fotosBase64.length} imagen${fotosBase64.length!==1?'es':''} cargada${fotosBase64.length!==1?'s':''}`;
  document.querySelector('.admin-modal h2').textContent = 'Editar producto';
  document.getElementById('admin-modal').classList.add('active');
}

// ════════════════════════════════════════════════════════
//  ADMIN — Restaurar originales
// ════════════════════════════════════════════════════════
async function resetearProductos(){
  if(!confirm('¿Restaurar el catálogo original? Se perderán todos los cambios.')) return;
  productos = productosDefault.map(p => ({...p}));
  categoriasOcultas = [];
  buildAllCarousels();
  mostrarToast('Guardando…');
  await guardarEnFirebase();
  mostrarToast('Catálogo restaurado ✓');
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
  const optTodos = document.createElement('option');
  optTodos.value = '__todos__';
  optTodos.textContent = 'Todos los productos';
  select.appendChild(optTodos);

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
    : productos.filter(p => p.tipo === reorderCatActual);
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
      <img class="reorder-thumb" src="${p.img}" alt="${p.nombre}">
      <div class="reorder-info">
        <div class="reorder-name">${p.nombre}</div>
        <div class="reorder-tipo">${p.tipo}</div>
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
  if(reorderCatActual === '__todos__'){
    productos = ordenTemporal;
  } else {
    // Reemplazar los productos de esa categoría en su orden dentro del array global
    let idx = 0;
    productos = productos.map(p =>
      p.tipo === reorderCatActual ? ordenTemporal[idx++] : p
    );
  }
  buildAllCarousels();
  document.getElementById('reorder-modal').classList.remove('active');
  mostrarToast('Guardando orden…');
  await guardarEnFirebase();
  mostrarToast('Orden guardado ✓');
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

function renderCatToggles(){
  const list = document.getElementById('cat-toggle-list');
  list.innerHTML = '';
  getCategorias().forEach(cat => {
    const count = productos.filter(p => p.tipo === cat).length;
    const visible = !categoriasOcultas.includes(cat);
    const item = document.createElement('div');
    item.className = 'cat-toggle-item';
    item.innerHTML = `
      <div>
        <div class="cat-toggle-name">${cat}</div>
        <div class="cat-toggle-count">${count} producto${count !== 1 ? 's' : ''}</div>
      </div>
      <div class="cat-toggle-actions">
        <button class="btn-cat-delete" title="Eliminar categoría y sus productos" onclick="eliminarCategoria('${cat.replace(/'/g,"\\'")}')">×</button>
        <label class="toggle-switch">
          <input type="checkbox" data-cat="${cat}" ${visible ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>`;
    list.appendChild(item);
  });
}

async function guardarCategorias(){
  const checkboxes = document.querySelectorAll('#cat-toggle-list input[type=checkbox]');
  categoriasOcultas = [];
  checkboxes.forEach(cb => {
    if(!cb.checked) categoriasOcultas.push(cb.dataset.cat);
  });
  buildAllCarousels();
  document.getElementById('cat-modal').classList.remove('active');
  mostrarToast('Guardando…');
  await guardarEnFirebase();
  mostrarToast('Categorías actualizadas ✓');
}

async function eliminarCategoria(cat){
  const count = productos.filter(p => p.tipo === cat).length;
  const msg = count > 0
    ? `¿Eliminar la categoría "${cat}" y sus ${count} producto${count !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`
    : `¿Eliminar la categoría "${cat}"?`;
  if(!confirm(msg)) return;
  productos = productos.filter(p => p.tipo !== cat);
  categoriasOcultas = categoriasOcultas.filter(c => c !== cat);
  renderCatToggles();
  buildAllCarousels();
  mostrarToast('Guardando…');
  await guardarEnFirebase();
  mostrarToast(`Categoría "${cat}" eliminada ✓`);
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