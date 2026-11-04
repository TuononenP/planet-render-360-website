const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const [places, icons] = await Promise.all([
  fetch('/assets/places.json').then(response => response.json()),
  fetch('/assets/icons.json').then(response => response.json()),
]);
const iconFallbacks = {
  'arrow-right': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  'arrow-down': '<path d="M12 5v14m-6-6 6 6 6-6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
};
function paintIcons(root = document) {
  $$('[data-icon]', root).forEach(element => {
    const name = element.dataset.icon;
    element.innerHTML = icons[name] || `<svg viewBox="0 0 24 24">${iconFallbacks[name] || ''}</svg>`;
    $('svg', element)?.setAttribute('aria-hidden', 'true');
    $('svg', element)?.setAttribute('focusable', 'false');
  });
}
paintIcons();

let saved = [];
try {
  const stored = JSON.parse(localStorage.getItem('pr360-showcase-favourites') || '[]');
  if (Array.isArray(stored)) saved = stored.filter(id => places.some(place => place.id === id));
} catch { /* Storage can be unavailable in a private browser session. */ }
let filter = 'all';
let current = places[0];
let light = 'opening';
let season = 'summer';
let direction = 'opening';
let toastTimeout;
let lapseTimer;
let tourStep = 0;
let lastOpener;
const explorer = $('#explorer');
const viewImage = $('#viewer-image');
const directions = ['opening', 'north', 'east', 'south', 'west'];
const headingLabels = { north: '000° N', east: '090° E', south: '180° S', west: '270° W' };
const placeStories = {
  new_york: 'Stand by the East River and look across to Lower Manhattan. This opening viewpoint is set at Brooklyn Bridge Park, with the skyline across the water.',
  stockholm: 'Look out from Monteliusvägen over the water to Stockholm’s rooftops. Try the winter capture for a different view of the same waterfront.',
  paris: 'A classic first look across the gardens toward the Eiffel Tower. The app brings recognizable landmarks into the surrounding city scene.',
  san_francisco: 'Look down Hyde Street from Lombard Street toward the bay. The stepped streets and homes frame the opening view from Russian Hill.',
  helsinki: 'Look across South Harbour toward Helsinki’s waterfront and cathedral landmarks. The opening viewpoint sits by the water.',
  banff: 'Follow the Bow River into a landscape of wooded banks and mountain ridges. Real elevation data gives the terrain its shape.',
};
function coordinate(value, positive, negative) {
  const number = new Intl.NumberFormat('en', { minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: false }).format(Math.abs(value));
  return `${number}° ${value >= 0 ? positive : negative}`;
}
function coordinates(place) {
  return `${coordinate(place.lat, 'N', 'S')}  ${coordinate(place.lon, 'E', 'W')}`;
}
function notify(message) {
  clearTimeout(toastTimeout);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  // A modal dialog is in the top layer, so its notifications belong there too.
  (explorer.open ? $('#viewer') : document.body).append($('#toast'));
  toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 3500);
}
function toggleFavourite(id) {
  const adding = !saved.includes(id);
  saved = adding ? [...saved, id] : saved.filter(item => item !== id);
  let persisted = true;
  try { localStorage.setItem('pr360-showcase-favourites', JSON.stringify(saved)); } catch { persisted = false; }
  const focusId = document.activeElement?.dataset.save;
  renderPlaces();
  if (focusId) $(`[data-save="${focusId}"]`)?.focus({ preventScroll: true });
  syncSaveButton();
  notify(adding ? (persisted ? 'Place added to your favourites' : 'Favourite kept for this visit') : 'Place removed from your favourites');
}
function renderPlaces() {
  const term = $('#place-search').value.trim().toLowerCase();
  const results = places.filter(place => {
    const category = place.id === 'banff' ? 'nature' : 'city';
    return (filter === 'all' || filter === category || (filter === 'saved' && saved.includes(place.id)))
      && `${place.name} ${place.country} ${place.spot}`.toLowerCase().includes(term);
  });
  $('#destination-grid').innerHTML = results.map(place => `
    <article class="destination-card">
      <button class="card-open" data-open="${place.id}" aria-label="Explore ${place.name}">
        <div class="card-picture"><img src="${place.images.opening}" alt="${place.name}, rendered in Planet Render 360" loading="lazy"><span class="card-category">${place.id === 'banff' ? 'A quieter horizon' : 'City escape'}</span></div>
        <div class="card-body"><div class="card-place-row"><h3>${place.name}</h3><span data-icon="arrow-up-right"></span></div><p class="card-country">${place.country}</p><div class="card-coordinates"><span>${coordinate(place.lat, 'N', 'S')}</span> <span>${coordinate(place.lon, 'E', 'W')}</span></div></div>
      </button>
      <button class="save-place" data-save="${place.id}" aria-label="${saved.includes(place.id) ? 'Remove' : 'Save'} ${place.name} ${saved.includes(place.id) ? 'from' : 'to'} favourites" aria-pressed="${saved.includes(place.id)}"><span data-icon="star"></span></button>
    </article>`).join('');
  paintIcons($('#destination-grid'));
  $('#empty-places').hidden = results.length !== 0;
}
renderPlaces();
$('#place-search').addEventListener('input', renderPlaces);
$$('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  $$('[data-filter]').forEach(item => item.setAttribute('aria-pressed', item === button));
  renderPlaces();
}));

// The landing page uses the exact rendered captures, without tinting them.
$$('[data-light]').forEach(button => button.addEventListener('click', () => {
  $('#hero-image').src = places[0].images[button.dataset.light];
  $('#hero-image').alt = `New York's skyline in ${button.textContent.toLowerCase()} light, captured in Planet Render 360`;
  $$('[data-light]').forEach(item => item.setAttribute('aria-pressed', item === button));
}));

const journey = [
  { image: 'picker', coordinates: '48.8622° N  2.2887° E', title: 'A point on the map. A place to begin.', icon: 'map-pin', alt: 'Actual app screen: choosing a place on the map' },
  { image: 'loading', coordinates: '48.8622° N  2.2887° E', title: 'A world coming together, layer by layer.', icon: 'layers', alt: 'Actual app screen: terrain and data loading progress' },
  { image: 'viewer', coordinates: '46.6863° N  7.8632° E', title: 'Arrive. Look around. Stay a little.', icon: 'move', alt: 'Actual app screen: exploring Interlaken in the 360 viewer' },
];
function selectJourney(index, focus = false) {
  const item = journey[index];
  $$('[data-step]').forEach(button => {
    const selected = Number(button.dataset.step) === index;
    button.setAttribute('aria-selected', selected);
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
  $('#journey-panel').setAttribute('aria-labelledby', `step-${index}`);
  $('#journey-image').src = `/assets/${item.image}.jpg`;
  $('#journey-image').alt = item.alt;
  $('#journey-caption').textContent = item.title;
  $('#stage-coordinate').textContent = item.coordinates;
  $('#journey-icon').dataset.icon = item.icon;
  paintIcons($('#journey-panel'));
}
$$('[data-step]').forEach(button => {
  button.addEventListener('click', () => selectJourney(Number(button.dataset.step)));
  button.addEventListener('keydown', event => {
    const index = Number(button.dataset.step);
    const next = { ArrowDown: (index + 1) % 3, ArrowUp: (index + 2) % 3, Home: 0, End: 2 }[event.key];
    if (next !== undefined) { event.preventDefault(); selectJourney(next, true); }
  });
});
const tools = {
  look: { image: 'tools', alt: 'Actual app screen showing the 360 view and its controls', copy: 'In the app: W A S D to walk · G for drone mode · H to hide the controls.' },
  landmarks: { image: 'picker', alt: 'Actual app screen showing the map and landmark discovery', copy: 'In the app: open a map landmark for its story, or press L in the viewer to list nearby landmarks.' },
  photo: { image: 'tools', alt: 'Actual app screen with the viewer tool menu', copy: 'In the app: P to save a photo · C to copy an exact view link · N for horizon labels.' },
  history: { image: 'history', alt: 'Actual app screen showing recent places, favourites, and cached worlds', copy: 'In the app: history keeps your viewpoint. Cached worlds help you return more quickly.' },
};
$$('[data-tool]').forEach(button => button.addEventListener('click', () => {
  const tool = tools[button.dataset.tool];
  $$('[data-tool]').forEach(item => item.setAttribute('aria-pressed', item === button));
  $('#tool-image').src = `/assets/${tool.image}.jpg`;
  $('#tool-image').alt = tool.alt;
  $('#tool-description').innerHTML = `<span data-icon="info"></span> ${tool.copy}`;
  paintIcons($('#tool-description'));
}));
function showDialog(dialog) {
  dialog.showModal();
  document.body.classList.add('modal-open');
}
function closeDialog(dialog) {
  dialog.close();
}
$$('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => {
    if (!$$('dialog').some(item => item.open)) document.body.classList.remove('modal-open');
  });
  dialog.addEventListener('click', event => {
    if (dialog !== explorer && event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
    }
  });
});
$('#expand-screen').addEventListener('click', () => {
  $('#full-screen-image').src = $('#tool-image').src;
  $('#full-screen-image').alt = $('#tool-image').alt;
  showDialog($('#screen-dialog'));
});
$('#close-screen').addEventListener('click', () => closeDialog($('#screen-dialog')));
$('#about-site').addEventListener('click', () => showDialog($('#about-dialog')));
$('#close-about').addEventListener('click', () => closeDialog($('#about-dialog')));

function syncSaveButton() {
  const isSaved = saved.includes(current.id);
  $('#viewer-save').setAttribute('aria-pressed', isSaved);
  $('#viewer-save').setAttribute('aria-label', `${isSaved ? 'Remove' : 'Save'} ${current.name} ${isSaved ? 'from' : 'to'} favourites`);
}
function updateURL() {
  if (!explorer.open) return;
  const url = new URL(location.href);
  url.search = new URLSearchParams({ place: current.id, light, season, direction }).toString();
  url.hash = '';
  history.replaceState(null, '', url);
}
function imagePath() {
  if (season === 'winter') return current.images.winter;
  return current.images[direction === 'opening' ? light : direction];
}
function renderView() {
  viewImage.src = imagePath();
  viewImage.alt = `${current.name}, ${season}, ${direction === 'opening' ? light === 'opening' ? 'opening light' : light : direction + '-facing capture'}, rendered in Planet Render 360`;
  $('#viewer-title').textContent = current.name;
  $('#viewer-region').textContent = `${current.spot} · ${current.country}`;
  $('#viewer-coordinates').textContent = coordinates(current);
  const cardinal = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(current.bearing / 22.5) % 16];
  $('#viewer-compass').textContent = headingLabels[direction] || `${String(current.bearing).padStart(3, '0')}° ${cardinal}`;
  $('#direction-name').textContent = direction === 'opening' ? 'Opening view' : `${direction[0].toUpperCase()}${direction.slice(1)} view`;
  $$('[data-time]').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.time === light);
    button.disabled = season === 'winter';
  });
  $('#timelapse').disabled = season === 'winter';
  $('#season-control').hidden = !current.images.winter;
  $$('[data-season-choice]').forEach(button => button.setAttribute('aria-pressed', button.dataset.seasonChoice === season));
  $('#previous-direction').disabled = season === 'winter';
  $('#next-direction').disabled = season === 'winter';
  $('#panel-title').textContent = season === 'winter' ? 'A winter kind of quiet.' : light === 'night' ? 'After the light fades.' : 'A moment in the light.';
  $('#preview-hint').textContent = season === 'winter'
    ? 'Winter opening view. Switch to summer to try the captured light changes and directions.'
    : 'Try the captured light changes. In the app, choose any time with the sun arc.';
  $('#info-title').textContent = current.spot;
  $('#info-copy').textContent = placeStories[current.id];
  $('#drag-prompt').style.opacity = season === 'winter' ? '0' : '1';
  syncSaveButton();
  updateURL();
}
function openExplorer(id, requestedSeason = 'summer', opener, state = {}) {
  current = places.find(place => place.id === id) || places[0];
  season = requestedSeason === 'winter' && current.images.winter ? 'winter' : 'summer';
  light = ['opening', 'day', 'night'].includes(state.light) ? state.light : 'opening';
  direction = directions.includes(state.direction) && season !== 'winter' ? state.direction : 'opening';
  lastOpener = opener || document.activeElement;
  $('#view-info').hidden = true;
  $('#info-button').setAttribute('aria-pressed', 'false');
  $('#tour-card').hidden = true;
  $('#panel-controls').hidden = false;
  $('#toggle-panel').setAttribute('aria-expanded', 'true');
  $('#toggle-panel').setAttribute('aria-label', 'Collapse view controls');
  $('#toggle-panel [data-icon]').dataset.icon = 'chevron-down';
  paintIcons($('#toggle-panel'));
  stopTimeLapse();
  showDialog(explorer);
  renderView();
  $('#close-explorer').focus();
}
document.addEventListener('click', event => {
  const saveButton = event.target.closest('[data-save]');
  const openButton = event.target.closest('[data-open]');
  if (saveButton) toggleFavourite(saveButton.dataset.save);
  else if (openButton) openExplorer(openButton.dataset.open, openButton.dataset.season, openButton);
});
$('#close-explorer').addEventListener('click', () => closeDialog(explorer));
explorer.addEventListener('close', () => {
  stopTimeLapse();
  const url = new URL(location.href);
  ['place', 'light', 'season', 'direction'].forEach(key => url.searchParams.delete(key));
  history.replaceState(null, '', url);
  document.body.append($('#toast'));
  if (lastOpener?.isConnected) lastOpener.focus({ preventScroll: true });
});
$('#viewer-save').addEventListener('click', () => toggleFavourite(current.id));
function stopTimeLapse() {
  clearInterval(lapseTimer);
  lapseTimer = undefined;
  $('#timelapse').setAttribute('aria-pressed', 'false');
  $('#timelapse').innerHTML = '<span data-icon="play"></span> Time-lapse';
  paintIcons($('#timelapse'));
}
$$('[data-time]').forEach(button => button.addEventListener('click', () => {
  stopTimeLapse();
  light = button.dataset.time;
  direction = 'opening';
  renderView();
}));
$$('[data-season-choice]').forEach(button => button.addEventListener('click', () => {
  stopTimeLapse();
  season = button.dataset.seasonChoice;
  direction = 'opening';
  light = 'opening';
  renderView();
}));
$('#timelapse').addEventListener('click', () => {
  if (lapseTimer) return stopTimeLapse();
  direction = 'opening';
  $('#timelapse').setAttribute('aria-pressed', 'true');
  $('#timelapse').innerHTML = '<span data-icon="pause"></span> Pause';
  paintIcons($('#timelapse'));
  const cycle = ['opening', 'day', 'night'];
  const advance = () => { light = cycle[(cycle.indexOf(light) + 1) % cycle.length]; renderView(); };
  advance();
  lapseTimer = setInterval(advance, 2500);
  notify('Playing three captured moments. Pause at any time.');
});
function changeDirection(offset) {
  if (season === 'winter') return;
  stopTimeLapse();
  light = 'opening';
  direction = directions[(directions.indexOf(direction) + offset + directions.length) % directions.length];
  renderView();
  $('#drag-prompt').style.opacity = '0';
}
$('#previous-direction').addEventListener('click', () => changeDirection(-1));
$('#next-direction').addEventListener('click', () => changeDirection(1));
let pointerStart;
$('#viewer-drag').addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; });
$('#viewer-drag').addEventListener('pointerup', event => {
  if (pointerStart && Math.abs(event.clientX - pointerStart.x) > 40 && Math.abs(event.clientY - pointerStart.y) < 100) changeDirection(event.clientX < pointerStart.x ? 1 : -1);
  pointerStart = undefined;
});
$('#viewer-drag').addEventListener('pointercancel', () => { pointerStart = undefined; });
$('#viewer-drag').addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); changeDirection(event.key === 'ArrowRight' ? 1 : -1); }
});
$('#toggle-panel').addEventListener('click', () => {
  const expanded = $('#toggle-panel').getAttribute('aria-expanded') === 'true';
  $('#panel-controls').hidden = expanded;
  $('#toggle-panel').setAttribute('aria-expanded', !expanded);
  $('#toggle-panel').setAttribute('aria-label', `${expanded ? 'Expand' : 'Collapse'} view controls`);
  $('#toggle-panel [data-icon]').dataset.icon = expanded ? 'chevron-up' : 'chevron-down';
  paintIcons($('#toggle-panel'));
});
$('#photo-button').addEventListener('click', async () => {
  const button = $('#photo-button');
  button.disabled = true;
  try {
    const response = await fetch(imagePath());
    if (!response.ok) throw new Error('Photo not available');
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `planet-render-360-${current.id}-${season}-${direction === 'opening' ? light : direction}.jpg`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    notify('Photo downloaded from the captured preview');
  } catch { notify('The photo did not download. Try again.'); }
  button.disabled = false;
});
$('#share-button').addEventListener('click', async () => {
  updateURL();
  try {
    await navigator.clipboard.writeText(location.href);
    notify('Showcase view link copied');
  } catch { notify('The view is in your browser address. Copy the URL to share it.'); }
});
function closeInfo() {
  $('#view-info').hidden = true;
  $('#info-button').setAttribute('aria-pressed', 'false');
}
$('#info-button').addEventListener('click', () => {
  const opening = $('#view-info').hidden;
  $('#view-info').hidden = !opening;
  $('#info-button').setAttribute('aria-pressed', opening);
  if (opening) $('#tour-card').hidden = true;
});
$('#close-info').addEventListener('click', closeInfo);
const tour = [
  { title: 'Arrive somewhere new.', copy: 'In the app, tap the map or search for a place to build a view. Here, you’re exploring real captures from six destinations.' },
  { title: 'Turn toward your curiosity.', copy: 'Drag the scene or use the direction arrows to browse captured viewpoints. In the app, look freely, walk the ground, or fly a drone.' },
  { title: 'Find your favourite light.', copy: 'Try Midday, Opening light, and Night. The app’s sun arc lets you choose any time. Stockholm also has a winter preview here.' },
  { title: 'Take a little of it with you.', copy: 'Use Save photo for a capture, copy a showcase view link, or star this place to keep it in your browser’s favourites.' },
];
function renderTour() {
  $('#tour-count').textContent = `Your first look · ${tourStep + 1} / ${tour.length}`;
  $('#tour-title').textContent = tour[tourStep].title;
  $('#tour-copy').textContent = tour[tourStep].copy;
  $('#tour-next').innerHTML = `${tourStep === 3 ? 'Start exploring' : 'Next'} <span data-icon="arrow-right"></span>`;
  paintIcons($('#tour-next'));
}
$('#tour-button').addEventListener('click', () => {
  closeInfo();
  tourStep = 0;
  renderTour();
  $('#tour-card').hidden = false;
});
$('#tour-next').addEventListener('click', () => {
  tourStep += 1;
  if (tourStep >= tour.length) $('#tour-card').hidden = true;
  else renderTour();
});
$('#close-tour').addEventListener('click', () => { $('#tour-card').hidden = true; });
explorer.addEventListener('cancel', event => {
  if (!$('#tour-card').hidden || !$('#view-info').hidden) {
    event.preventDefault();
    $('#tour-card').hidden = true;
    closeInfo();
  }
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !$$('dialog').some(dialog => dialog.open) && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    $('#place-search').scrollIntoView({ block: 'center' });
    $('#place-search').focus({ preventScroll: true });
  }
});
const query = new URLSearchParams(location.search);
if (places.some(place => place.id === query.get('place'))) {
  openExplorer(query.get('place'), query.get('season'), null, { light: query.get('light'), direction: query.get('direction') });
}
