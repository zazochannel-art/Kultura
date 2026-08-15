// Registry for the in-app "how it works" guide.
//
// Unlike the UI strings in i18n/, none of this text is needed to render the
// app — it only appears once somebody opens the guide. So no pack is imported
// statically: all three are dynamic, and a session that never opens the guide
// never downloads a byte of it.
const LOADERS = {
  ro: () => import('./guide/ro.js'),
  en: () => import('./guide/en.js'),
  ru: () => import('./guide/ru.js'),
};

const cache = {};

// Fetch the guide for a language, falling back to Romanian the way t() does.
// Returns null only if even the fallback can't be loaded (offline before the
// service worker has precached it), so callers can show a real error instead
// of an empty modal.
export async function loadGuide(lang) {
  const want = LOADERS[lang] ? lang : 'ro';
  if (cache[want]) return cache[want];
  try {
    cache[want] = (await LOADERS[want]()).default;
    return cache[want];
  } catch (_) {
    if (want === 'ro') return null;
    return loadGuide('ro');
  }
}
