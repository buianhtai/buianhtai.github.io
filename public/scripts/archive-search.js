/* Full-text article archive powered by a static Pagefind index.
   When running Astro dev without an index, metadata search remains usable. */
(() => {
  const browser = document.getElementById('article-browser');
  if (!browser) return;

  const input = document.getElementById('ed-article-search');
  const cards = [...browser.querySelectorAll('#ed-article-list .ed-archive-post')];
  const list = document.getElementById('ed-article-list');
  const count = document.getElementById('ed-result-count');
  const empty = document.getElementById('ed-no-results');
  const moreWrap = document.getElementById('ed-archive-more-wrap');
  const moreButton = document.getElementById('ed-show-more');
  const fullText = document.getElementById('ed-fulltext-pane');
  const results = document.getElementById('ed-fulltext-results');
  const status = document.getElementById('ed-fulltext-status');
  const fullTextMore = document.getElementById('ed-fulltext-more');
  const fallback = document.getElementById('ed-search-fallback');
  const categories = [...browser.querySelectorAll('button[data-category]')];
  const series = [...browser.querySelectorAll('button[data-series]')];
  const isVi = document.documentElement.lang === 'vi';
  const params = new URLSearchParams(window.location.search);
  const categoryValues = new Set(categories.map(b => b.dataset.category));
  const seriesValues = new Set(series.map(b => b.dataset.series));
  let category = categoryValues.has(params.get('category')) ? params.get('category') : 'all';
  let seriesId = seriesValues.has(params.get('series')) ? params.get('series') : 'all';
  let pageLimit = 12;
  let searchLimit = 12;
  let searchResults = [];
  let generation = 0;
  let debounceTimer;
  let pagefindPromise;
  input.value = params.get('q') || '';

  function setUrl() {
    const url = new URL(window.location.href);
    if (category === 'all') url.searchParams.delete('category');
    else url.searchParams.set('category', category);
    if (seriesId === 'all') url.searchParams.delete('series');
    else url.searchParams.set('series', seriesId);
    if (input.value.trim()) url.searchParams.set('q', input.value.trim());
    else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  }

  function syncFilters() {
    categories.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.category === category)));
    series.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.series === seriesId)));
  }

  function browse(needle = '') {
    list.hidden = false;
    fullText.hidden = true;
    let matched = 0;
    cards.forEach(card => {
      const passes = (!needle || (card.dataset.search || '').includes(needle.toLocaleLowerCase()))
        && (category === 'all' || card.dataset.category === category)
        && (seriesId === 'all' || card.dataset.series === seriesId);
      if (passes) matched += 1;
      card.hidden = !passes || matched > pageLimit;
    });
    count.textContent = String(matched);
    empty.hidden = matched !== 0;
    moreWrap.hidden = matched <= pageLimit;
  }

  function clearResults() {
    results.replaceChildren();
    searchResults = [];
    searchLimit = 12;
    fullTextMore.hidden = true;
  }

  function fullTextItem(data) {
    const a = document.createElement('a');
    const url = new URL(data.url, location.origin);
    // Results are article-local; do not render arbitrary external destinations.
    if (url.origin !== location.origin || !url.pathname.startsWith('/' + document.documentElement.lang + '/blog/')) return null;
    a.href = url.pathname + url.search + url.hash;
    a.className = 'ed-search-hit';
    const label = document.createElement('span');
    label.className = 'ed-kicker';
    label.textContent = isVi ? 'Kết quả trong bài viết' : 'Article match';
    const title = document.createElement('strong');
    title.textContent = (data.meta && data.meta.title) || url.pathname.split('/').filter(Boolean).pop() || a.href;
    const snippet = document.createElement('span');
    snippet.className = 'ed-search-excerpt';
    // Pagefind excerpts HTML-escape source content and only inject its own <mark> tags.
    snippet.innerHTML = data.excerpt || '';
    const arrow = document.createElement('span');
    arrow.className = 'ed-search-arrow';
    arrow.textContent = '↗';
    a.append(label, title, snippet, arrow);
    return a;
  }

  async function displaySearchBatch(token) {
    if (token !== generation) return;
    const start = results.childElementCount;
    const batch = searchResults.slice(start, searchLimit);
    const data = await Promise.all(batch.map(result => result.data()));
    if (token !== generation) return;
    for (const entry of data) {
      const item = fullTextItem(entry);
      if (item) results.append(item);
    }
    fullTextMore.hidden = searchLimit >= searchResults.length;
  }

  async function search(term, token) {
    fullText.hidden = false;
    list.hidden = true;
    moreWrap.hidden = true;
    empty.hidden = true;
    fallback.hidden = true;
    clearResults();
    status.textContent = isVi ? 'Đang tìm trong nội dung bài viết…' : 'Searching full article text…';
    try {
      // This static bundle is created after Astro build, not available in plain dev mode.
      const pf = await (pagefindPromise ||= import('/pagefind/pagefind.js'));
      const filters = {};
      if (category !== 'all') filters.category = category;
      if (seriesId !== 'all') filters.series = seriesId;
      const found = await pf.search(term, {filters});
      if (token !== generation) return;
      searchResults = found.results;
      count.textContent = String(searchResults.length);
      status.textContent = searchResults.length
        ? (isVi ? 'Kết quả trong toàn bộ nội dung bài viết' : 'Results from full article text')
        : (isVi ? 'Không tìm thấy kết quả phù hợp.' : 'No matching articles found.');
      await displaySearchBatch(token);
    } catch (error) {
      if (token !== generation) return;
      console.warn('Full-text search unavailable; falling back to metadata.', error);
      fallback.hidden = false;
      fullText.hidden = true;
      browse(term);
    }
  }

  function update({syncUrl = true} = {}) {
    ++generation;
    clearTimeout(debounceTimer);
    if (syncUrl) setUrl();
    syncFilters();
    fallback.hidden = true;
    const term = input.value.trim();
    if (!term) {
      browse();
      return;
    }
    const token = generation;
    debounceTimer = setTimeout(() => search(term, token), 230);
  }

  categories.forEach(b => b.addEventListener('click', () => {
    category = b.dataset.category;
    pageLimit = 12;
    update();
  }));
  series.forEach(b => b.addEventListener('click', () => {
    seriesId = b.dataset.series;
    pageLimit = 12;
    update();
  }));
  input.addEventListener('input', () => {
    pageLimit = 12;
    update();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape' && input.value) {input.value = ''; update();}
  });
  moreButton.addEventListener('click', () => {
    pageLimit += 12;
    browse();
  });
  fullTextMore.addEventListener('click', async () => {
    searchLimit += 12;
    try {await displaySearchBatch(generation);}
    catch (error) { console.warn('Could not load additional search results', error); }
  });
  document.getElementById('ed-reset')?.addEventListener('click', () => {
    input.value = '';
    category = 'all';
    seriesId = 'all';
    pageLimit = 12;
    update();
    input.focus();
  });
  window.addEventListener('popstate', () => {
    const url = new URLSearchParams(location.search);
    category = categoryValues.has(url.get('category')) ? url.get('category') : 'all';
    seriesId = seriesValues.has(url.get('series')) ? url.get('series') : 'all';
    input.value = url.get('q') || '';
    pageLimit = 12;
    update({syncUrl:false});
  });
  update({syncUrl:false});
})();
