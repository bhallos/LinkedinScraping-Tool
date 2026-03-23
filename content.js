// Content script that runs on Google search results pages
// Adds a floating panel to easily scrape LinkedIn profiles

(function () {
  // Only run on searches that look LinkedIn-related
  const searchQuery = new URLSearchParams(window.location.search).get('q') || '';
  const isLinkedInSearch = searchQuery.toLowerCase().includes('linkedin') || searchQuery.includes('site:linkedin.com');

  if (!isLinkedInSearch) return;

  // Create floating action button
  const fab = document.createElement('div');
  fab.id = 'li-scraper-fab';
  fab.innerHTML = `
    <div id="li-scraper-panel">
      <div class="li-scraper-header">
        <span>LinkedIn Scraper</span>
        <button id="li-scraper-close">&times;</button>
      </div>
      <div class="li-scraper-body">
        <div id="li-scraper-status">Ready to scrape</div>
        <div class="li-scraper-count">
          Found: <strong id="li-scraper-found">0</strong> profiles on this page
        </div>
        <button id="li-scraper-extract" class="li-scraper-btn primary">Extract Profiles</button>
        <button id="li-scraper-save" class="li-scraper-btn success" disabled>Save to Collection</button>
        <div id="li-scraper-results"></div>
      </div>
    </div>
    <button id="li-scraper-toggle" title="LinkedIn Scraper">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
      </svg>
    </button>
  `;
  document.body.appendChild(fab);

  let isOpen = false;
  let extractedProfiles = [];

  // Toggle panel
  document.getElementById('li-scraper-toggle').addEventListener('click', () => {
    isOpen = !isOpen;
    document.getElementById('li-scraper-panel').style.display = isOpen ? 'block' : 'none';
    if (isOpen) countProfiles();
  });

  // Close panel
  document.getElementById('li-scraper-close').addEventListener('click', () => {
    isOpen = false;
    document.getElementById('li-scraper-panel').style.display = 'none';
  });

  // Count LinkedIn profiles on page
  function countProfiles() {
    const links = document.querySelectorAll('a[href*="linkedin.com/in/"]');
    const uniqueUrls = new Set();
    links.forEach(l => {
      const url = l.href.split('?')[0].replace(/\/$/, '');
      if (url.includes('/in/')) uniqueUrls.add(url);
    });
    document.getElementById('li-scraper-found').textContent = uniqueUrls.size;
  }

  /**
   * Walk up the DOM from a link element to find the enclosing
   * search-result block. Works with any Google DOM structure.
   */
  function findResultContainer(linkEl) {
    let el = linkEl;
    const maxDepth = 12;
    for (let i = 0; i < maxDepth; i++) {
      el = el.parentElement;
      if (!el || el.id === 'search' || el.id === 'rso' || el.id === 'main' || el.tagName === 'BODY') break;
      // A good container usually has an h3 AND some text length
      const h3 = el.querySelector('h3');
      const text = el.innerText || '';
      if (h3 && text.length > 60) return el;
    }
    // Fallback: walk up fewer levels to find any block with an h3
    el = linkEl;
    for (let i = 0; i < maxDepth; i++) {
      el = el.parentElement;
      if (!el || el.tagName === 'BODY') break;
      if (el.querySelector('h3')) return el;
    }
    return linkEl.closest('[data-hveid]') || linkEl.parentElement;
  }

  /**
   * Parse a profile from a result container
   */
  function parseProfile(container, url) {
    const titleEl = container.querySelector('h3');
    let name = '';
    let headline = '';

    if (titleEl) {
      const titleText = titleEl.textContent.trim();
      // LinkedIn titles: "Name - Title - LinkedIn" or "Name | LinkedIn"
      const parts = titleText.split(/\s[-–—|]\s/);
      name = (parts[0] || '').replace(/\s*\|?\s*LinkedIn\s*/gi, '').trim();
      if (parts.length > 1) {
        headline = parts.slice(1).join(' - ').replace(/\s*\|?\s*LinkedIn\s*/gi, '').trim();
      }
    }

    // Get all text in the container for snippet extraction
    // Skip the title text itself
    let snippet = '';
    const allTextEls = container.querySelectorAll(
      'span, em, div[data-sncf], .VwiC3b, [style*="-webkit-line-clamp"], div[data-content-feature]'
    );
    const snippetParts = [];
    allTextEls.forEach(el => {
      // skip if this is the title or inside the title
      if (el.closest('h3') || el.querySelector('h3')) return;
      // skip if it's just a URL display
      if (el.closest('cite')) return;
      const t = el.textContent.trim();
      if (t.length > 20 && !snippetParts.includes(t)) {
        snippetParts.push(t);
      }
    });
    snippet = snippetParts.join(' ').substring(0, 500);

    // If snippet is empty, use the container's full text minus the title
    if (!snippet) {
      const full = container.innerText || '';
      const titleText = titleEl ? titleEl.textContent : '';
      snippet = full.replace(titleText, '').trim().substring(0, 500);
    }

    // Extract location
    let location = '';
    const locationPatterns = [
      /(?:located in|based in|from|Location:)\s+([^.·\-\n]+)/i,
      /([A-Z][a-zA-Z\s]+(?:Area|Metro|City|Region|State|Country))/,
      /(\w[\w\s]+,\s*\w[\w\s]+(?:,\s*\w+)?)\s*(?:·|[-–—]|\|)/,
    ];
    for (const pat of locationPatterns) {
      const m = snippet.match(pat);
      if (m) { location = m[1].trim().substring(0, 80); break; }
    }

    // Extract company
    let company = '';
    const companyPatterns = [
      /(?:at|@)\s+([^.·\-,\n]{2,40})/i,
      /(?:works?\s+at)\s+([^.·\-,\n]{2,40})/i,
      /(?:currently\s+at)\s+([^.·\-,\n]{2,40})/i,
    ];
    const searchIn = snippet + ' ' + headline;
    for (const pat of companyPatterns) {
      const m = searchIn.match(pat);
      if (m) { company = m[1].replace(/\s*LinkedIn\s*/gi, '').trim(); break; }
    }

    // Also try to pull follower count (shown in Google's knowledge card)
    let followers = '';
    const followMatch = (container.innerText || '').match(/([\d,.]+[KkMm]?\+?)\s*followers/i);
    if (followMatch) followers = followMatch[1];

    return { name, headline, company, location, followers, snippet: snippet.substring(0, 300) };
  }

  // Extract profiles — link-first approach
  document.getElementById('li-scraper-extract').addEventListener('click', () => {
    extractedProfiles = [];
    const seenUrls = new Set();

    // Find ALL LinkedIn profile links on the page
    const allLinks = document.querySelectorAll('a[href*="linkedin.com/in/"]');

    allLinks.forEach(linkEl => {
      // Skip links inside our own scraper panel
      if (linkEl.closest('#li-scraper-fab')) return;

      const rawUrl = linkEl.href || '';
      if (!rawUrl.includes('linkedin.com/in/')) return;
      const cleanUrl = rawUrl.split('?')[0].replace(/\/$/, '');
      if (seenUrls.has(cleanUrl)) return;
      seenUrls.add(cleanUrl);

      const container = findResultContainer(linkEl);
      const data = parseProfile(container, cleanUrl);

      extractedProfiles.push({
        name: data.name,
        headline: data.headline,
        company: data.company,
        location: data.location,
        followers: data.followers,
        linkedinUrl: cleanUrl,
        snippet: data.snippet,
        scrapedAt: new Date().toISOString(),
      });

      // Highlight this result
      if (container && container !== linkEl.parentElement) {
        container.style.borderLeft = '3px solid #0a66c2';
        container.style.paddingLeft = '8px';
        container.style.transition = 'all 0.3s';
      }
    });

    const statusEl = document.getElementById('li-scraper-status');
    statusEl.textContent = `Extracted ${extractedProfiles.length} profiles`;
    statusEl.style.color = extractedProfiles.length > 0 ? '#28a745' : '#dc3545';

    document.getElementById('li-scraper-save').disabled = extractedProfiles.length === 0;

    // Show mini list
    const resultsEl = document.getElementById('li-scraper-results');
    resultsEl.innerHTML = extractedProfiles.slice(0, 5).map(p =>
      `<div class="li-scraper-item">${escapeHtml(p.name)} ${p.headline ? '- ' + escapeHtml(p.headline.substring(0, 40)) : ''}</div>`
    ).join('') + (extractedProfiles.length > 5 ? `<div class="li-scraper-item" style="color:#0a66c2;font-weight:600">...and ${extractedProfiles.length - 5} more</div>` : '');
  });

  // Save to Chrome storage
  document.getElementById('li-scraper-save').addEventListener('click', async () => {
    const stored = await chrome.storage.local.get('profiles');
    const existing = stored.profiles || [];
    const existingUrls = new Set(existing.map(p => p.linkedinUrl));
    const newProfiles = extractedProfiles.filter(p => !existingUrls.has(p.linkedinUrl));
    const merged = [...existing, ...newProfiles];
    await chrome.storage.local.set({ profiles: merged });

    const statusEl = document.getElementById('li-scraper-status');
    statusEl.textContent = `Saved! ${newProfiles.length} new, ${merged.length} total`;
    statusEl.style.color = '#0a66c2';
  });

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
