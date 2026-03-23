/* ─────────────────────────────────────────────────────────────────
   LinkedIn ProScraper & Outreach  ·  popup.js
   ───────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {

  // ── Tab switching ────────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
    });
  });

  // ── Search Tab ───────────────────────────────────────────────────
  const fields = {
    jobTitle    : document.getElementById('job-title'),
    company     : document.getElementById('company'),
    location    : document.getElementById('location'),
    keywords    : document.getElementById('keywords'),
    exclude     : document.getElementById('exclude'),
    customQuery : document.getElementById('custom-query'),
  };
  const queryPreview = document.getElementById('query-preview');

  function buildQuery() {
    const custom = fields.customQuery.value.trim();
    if (custom) return custom;

    const parts = ['site:linkedin.com/in/'];
    if (fields.jobTitle.value.trim())  parts.push(fields.jobTitle.value.trim());
    if (fields.company.value.trim())   parts.push(fields.company.value.trim());
    if (fields.location.value.trim())  parts.push(fields.location.value.trim());
    if (fields.keywords.value.trim())  parts.push(fields.keywords.value.trim());
    if (fields.exclude.value.trim()) {
      fields.exclude.value.trim().split(',').map(t => t.trim()).filter(Boolean)
        .forEach(term => parts.push(`-${term}`));
    }
    return parts.join(' ');
  }

  function updatePreview() {
    const q = buildQuery();
    queryPreview.textContent = q || 'Enter criteria above…';
  }

  Object.values(fields).forEach(f => f.addEventListener('input', updatePreview));

  document.getElementById('search-btn').addEventListener('click', () => {
    const q = buildQuery();
    if (!q || q === 'site:linkedin.com/in/') { showToast('Enter search criteria first'); return; }
    chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(q)}&num=20` });
  });

  document.getElementById('copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(buildQuery()).then(() => showToast('Query copied!'));
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    Object.values(fields).forEach(f => f.value = '');
    updatePreview();
  });

  // ── My Profile Tab ───────────────────────────────────────────────
  const profileFieldMap = {
    'my-name'        : 'yourName',
    'my-title'       : 'yourTitle',
    'my-company'     : 'yourCompany',
    'my-years'       : 'yearsExp',
    'my-trials'      : 'numTrials',
    'my-clients'     : 'numClients',
    'my-audience'    : 'targetAudience',
    'my-pain'        : 'painPoint',
    'my-outcome'     : 'dreamOutcome',
    'my-avoid'       : 'avoidStruggle',
    'my-framework'   : 'framework',
    'my-magnet'      : 'leadMagnet',
    'my-casestudy'   : 'caseStudy',
    'my-credibility' : 'softCredibility',
    'my-cta'         : 'cta',
    'my-industry'    : 'yourIndustry',
  };

  // Load saved profile into form
  async function loadMyProfile() {
    const stored = await chrome.storage.local.get('myProfile');
    const me = stored.myProfile || {};
    Object.entries(profileFieldMap).forEach(([elId, key]) => {
      const el = document.getElementById(elId);
      if (el && me[key]) el.value = me[key];
    });
    return me;
  }

  // Collect form values
  function collectMyProfile() {
    const me = {};
    Object.entries(profileFieldMap).forEach(([elId, key]) => {
      const el = document.getElementById(elId);
      if (el) me[key] = el.value.trim();
    });
    return me;
  }

  document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const me = collectMyProfile();
    await chrome.storage.local.set({ myProfile: me });
    const msg = document.getElementById('profile-saved-msg');
    msg.style.display = 'block';
    setTimeout(() => (msg.style.display = 'none'), 2500);
    showToast('My Profile saved ✅');
  });

  await loadMyProfile();

  // ── Results Tab ──────────────────────────────────────────────────

  // Scrape current Google page
  document.getElementById('scrape-btn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes('google.com/search')) {
      showToast('Navigate to a Google search page first'); return;
    }
    try {
      const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeGoogleResults });
      if (res?.[0]?.result) {
        const profiles = res[0].result;
        if (!profiles.length) { showToast('No LinkedIn profiles found on this page'); return; }
        await mergeProfiles(profiles);
        showToast(`Scraped ${profiles.length} profiles`);
        await loadResults();
      }
    } catch (e) { showToast('Error — try refreshing the page'); console.error(e); }
  });

  // Generate messages for all profiles
  document.getElementById('gen-messages-btn').addEventListener('click', async () => {
    const stored = await chrome.storage.local.get(['profiles', 'myProfile']);
    const profiles = stored.profiles || [];
    const me = stored.myProfile || {};
    const templateNum = document.getElementById('template-select').value;

    if (!profiles.length) { showToast('No profiles to process'); return; }

    const updated = profiles.map(p => {
      const msgs = generateAllMessages(p, me);
      let connectionRequest = msgs.connectionRequest;
      if (templateNum === '2') connectionRequest = msgs.giftTemplate;
      else if (templateNum === '3') connectionRequest = msgs.connectionRequest; // #3 uses same engine
      else if (templateNum === '4') connectionRequest = msgs.struggleTemplate;
      else if (templateNum === '5') connectionRequest = msgs.systemTemplate;

      return {
        ...p,
        emailPatterns   : p.email ? [p.email] : msgs.emailPatterns,
        connectionRequest,
        followUp1       : msgs.followUp1,
        followUp2       : msgs.followUp2,
        followUp3       : msgs.followUp3,
        messagesGeneratedAt: new Date().toISOString(),
      };
    });

    await chrome.storage.local.set({ profiles: updated });
    document.getElementById('msg-status').textContent = `✅ Messages ready for ${updated.length} profiles`;
    showToast(`Generated messages for ${updated.length} profiles`);
    await loadResults();
  });

  // Export CSV (with all data + messages)
  document.getElementById('export-csv-btn').addEventListener('click', async () => {
    const stored = await chrome.storage.local.get('profiles');
    const profiles = stored.profiles || [];
    if (!profiles.length) { showToast('Nothing to export'); return; }

    const headers = [
      'Name', 'Headline', 'Current Title', 'Current Company', 'Location', 'Followers',
      'LinkedIn URL', 'Email (Found)', 'Email Patterns',
      'About Section', 'Experience', 'Education', 'Skills', 'Recent Post', 'Website',
      'Connection Request (≤300 chars)', 'Follow-Up 1 (Social Proof)',
      'Follow-Up 2 (Lead Magnet)', 'Follow-Up 3 (Re-engage)',
      'Snippet', 'Scraped At',
    ];

    const rows = profiles.map(p => [
      csv(p.name),
      csv(p.headline),
      csv(p.currentTitle),
      csv(p.currentCompany || p.company),
      csv(p.location),
      csv(p.followers),
      csv(p.linkedinUrl),
      csv(p.email || ''),
      csv((p.emailPatterns || []).join(' | ')),
      csv(p.about),
      csv(p.experience),
      csv(p.education),
      csv(p.skills),
      csv(p.recentPost),
      csv(p.website),
      csv(p.connectionRequest),
      csv(p.followUp1),
      csv(p.followUp2),
      csv(p.followUp3),
      csv(p.snippet),
      csv(p.scrapedAt),
    ]);

    const content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile('\uFEFF' + content, `linkedin_outreach_${yyyymmdd()}.csv`, 'text/csv;charset=utf-8;');
    showToast(`Exported ${profiles.length} profiles with messages`);
  });

  // Clear results
  document.getElementById('clear-results-btn').addEventListener('click', async () => {
    if (!confirm('Clear all scraped profiles and messages?')) return;
    await chrome.storage.local.set({ profiles: [] });
    await loadResults();
    showToast('Cleared');
  });

  // ── Load & render results ────────────────────────────────────────
  async function loadResults() {
    const stored = await chrome.storage.local.get('profiles');
    const profiles = stored.profiles || [];
    document.getElementById('result-count').textContent = profiles.length;
    document.getElementById('total-profiles').textContent = profiles.length;

    const listEl = document.getElementById('results-list');

    if (!profiles.length) {
      listEl.innerHTML = '<p class="empty-state">No profiles yet.<br>Search Google → click the floating button → scrape.<br>Or visit a LinkedIn profile directly.</p>';
      return;
    }

    listEl.innerHTML = profiles.map((p, i) => {
      const hasMessages = !!p.connectionRequest;
      const emailDisplay = p.email || (p.emailPatterns?.length ? p.emailPatterns[0] : '');
      const charCount = (p.connectionRequest || '').length;
      const charClass = charCount > 300 ? 'char-warn' : '';

      return `
      <div class="profile-card" data-idx="${i}">
        <button class="pc-remove" data-idx="${i}" title="Remove">✕</button>

        <div class="pc-name">${esc(p.name)}</div>
        <div class="pc-headline">${esc(p.headline || '')}</div>
        <div class="pc-meta">
          ${p.currentCompany || p.company ? `🏢 ${esc(p.currentCompany || p.company)}` : ''}
          ${p.location ? ` · 📍 ${esc(p.location)}` : ''}
          ${p.followers ? ` · 👥 ${esc(p.followers)}` : ''}
        </div>

        ${emailDisplay ? `<div class="pc-email">✉️ ${esc(emailDisplay)}${p.emailPatterns?.length > 1 ? ` <span style="color:#aaa">+${p.emailPatterns.length-1} patterns</span>` : ''}</div>` : ''}

        ${p.about ? `<div class="pc-about">📝 ${esc(p.about.substring(0, 120))}${p.about.length > 120 ? '…' : ''}</div>` : ''}

        <div class="pc-url" style="font-size:10.5px;color:#0a66c2;margin-bottom:6px">
          <a href="${esc(p.linkedinUrl)}" target="_blank">${esc(p.linkedinUrl)}</a>
        </div>

        ${hasMessages ? `
        <div class="pc-messages">
          <button class="msg-toggle" data-type="conn" data-idx="${i}">
            📨 Connection Request <span class="${charClass}" style="font-size:10px;margin-left:4px">${charCount}/300 chars</span>
          </button>
          <div class="msg-block" id="msg-conn-${i}">
            <label>Connection Request (≤300 chars) <button class="copy-msg-btn" data-copy="conn" data-idx="${i}">Copy</button></label>
            <div class="msg-text" id="msg-conn-text-${i}">${esc(p.connectionRequest)}</div>
            <div class="char-count ${charClass}">${charCount} chars</div>
          </div>

          <button class="msg-toggle" data-type="f1" data-idx="${i}">💬 Follow-Up 1 — Social Proof</button>
          <div class="msg-block" id="msg-f1-${i}">
            <label>Follow-Up 1 (Send after 1–3 days) <button class="copy-msg-btn" data-copy="f1" data-idx="${i}">Copy</button></label>
            <div class="msg-text" id="msg-f1-text-${i}">${esc(p.followUp1)}</div>
          </div>

          <button class="msg-toggle" data-type="f2" data-idx="${i}">📦 Follow-Up 2 — Lead Magnet</button>
          <div class="msg-block" id="msg-f2-${i}">
            <label>Follow-Up 2 (Send after 5 days) <button class="copy-msg-btn" data-copy="f2" data-idx="${i}">Copy</button></label>
            <div class="msg-text" id="msg-f2-text-${i}">${esc(p.followUp2)}</div>
          </div>

          <button class="msg-toggle" data-type="f3" data-idx="${i}">🔁 Follow-Up 3 — Re-engage</button>
          <div class="msg-block" id="msg-f3-${i}">
            <label>Follow-Up 3 (Send after 2 weeks) <button class="copy-msg-btn" data-copy="f3" data-idx="${i}">Copy</button></label>
            <div class="msg-text" id="msg-f3-text-${i}">${esc(p.followUp3)}</div>
          </div>
        </div>` : `<div style="font-size:11px;color:#aaa">Click "✉ Gen Messages" to generate outreach</div>`}
      </div>`;
    }).join('');

    // Remove profile
    listEl.querySelectorAll('.pc-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.idx);
        const s = await chrome.storage.local.get('profiles');
        s.profiles.splice(idx, 1);
        await chrome.storage.local.set({ profiles: s.profiles });
        await loadResults();
      });
    });

    // Toggle message blocks
    listEl.querySelectorAll('.msg-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const idx  = btn.dataset.idx;
        const block = document.getElementById(`msg-${type}-${idx}`);
        if (block) block.classList.toggle('open');
      });
    });

    // Copy message buttons
    listEl.querySelectorAll('.copy-msg-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.dataset.copy;
        const idx  = btn.dataset.idx;
        const textEl = document.getElementById(`msg-${type}-text-${idx}`);
        if (textEl) {
          await navigator.clipboard.writeText(textEl.textContent);
          showToast('Message copied!');
        }
      });
    });
  }

  await loadResults();

  // ── Utilities ────────────────────────────────────────────────────
  async function mergeProfiles(newProfiles) {
    const stored = await chrome.storage.local.get('profiles');
    const existing = stored.profiles || [];
    const existingUrls = new Set(existing.map(p => p.linkedinUrl));
    const merged = [
      ...existing,
      ...newProfiles.filter(p => !existingUrls.has(p.linkedinUrl)),
    ];
    await chrome.storage.local.set({ profiles: merged });
  }

  function csv(str) {
    if (str === null || str === undefined) return '';
    str = String(str).replace(/\r?\n/g, ' ');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function yyyymmdd() {
    return new Date().toISOString().slice(0, 10);
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function showToast(msg) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2300);
  }
});

// ─────────────────────────────────────────────────────────────────
// Injected into Google SERP pages — LINK-FIRST approach
// (runs via chrome.scripting.executeScript, NOT in popup context)
// ─────────────────────────────────────────────────────────────────
function scrapeGoogleResults() {
  const profiles = [];
  const seenUrls = new Set();

  function findResultContainer(linkEl) {
    let el = linkEl;
    for (let i = 0; i < 12; i++) {
      el = el.parentElement;
      if (!el || ['search','rso','main','BODY'].includes(el.id || el.tagName)) break;
      if (el.querySelector('h3') && (el.innerText || '').length > 60) return el;
    }
    el = linkEl;
    for (let i = 0; i < 12; i++) {
      el = el.parentElement;
      if (!el || el.tagName === 'BODY') break;
      if (el.querySelector('h3')) return el;
    }
    return linkEl.closest('[data-hveid]') || linkEl.parentElement;
  }

  document.querySelectorAll('a[href*="linkedin.com/in/"]').forEach(linkEl => {
    const raw = linkEl.href || '';
    if (!raw.includes('linkedin.com/in/')) return;
    const url = raw.split('?')[0].replace(/\/$/, '');
    if (seenUrls.has(url)) return;
    seenUrls.add(url);

    const c = findResultContainer(linkEl);

    // Name + headline from h3
    const titleEl = c.querySelector('h3');
    let name = '', headline = '';
    if (titleEl) {
      const parts = titleEl.textContent.trim().split(/\s[-–—|]\s/);
      name     = (parts[0] || '').replace(/\s*\|?\s*LinkedIn\s*/gi, '').trim();
      headline = parts.slice(1).join(' - ').replace(/\s*\|?\s*LinkedIn\s*/gi, '').trim();
    }

    // Snippet (skip title + cite)
    const snippetParts = [];
    c.querySelectorAll('span, em, div[data-sncf], .VwiC3b, [style*="-webkit-line-clamp"]').forEach(el => {
      if (el.closest('h3') || el.closest('cite')) return;
      const t = el.textContent.trim();
      if (t.length > 20 && !snippetParts.includes(t)) snippetParts.push(t);
    });
    let snippet = snippetParts.join(' ').substring(0, 500);
    if (!snippet) snippet = (c.innerText || '').replace(titleEl?.textContent || '', '').trim().substring(0, 500);

    // Email from snippet
    const emailMatch = snippet.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : '';

    // Location
    let location = '';
    for (const p of [/(?:located in|based in|from)\s+([^.·\-\n]+)/i, /(\w[\w\s]+,\s*\w[\w\s]+)\s*(?:·|[-–])/]) {
      const m = snippet.match(p);
      if (m) { location = m[1].trim().substring(0, 80); break; }
    }

    // Company
    let company = '';
    const searchIn = snippet + ' ' + headline;
    for (const p of [/(?:at|@)\s+([^.·\-,\n]{2,40})/i, /(?:works?\s+at)\s+([^.·\-,\n]{2,40})/i]) {
      const m = searchIn.match(p);
      if (m) { company = m[1].replace(/\s*LinkedIn\s*/gi, '').trim(); break; }
    }

    // Followers
    const followMatch = (c.innerText || '').match(/([\d,.]+[KkMm]?\+?)\s*followers/i);
    const followers = followMatch ? followMatch[1] : '';

    profiles.push({ name, headline, company, location, followers, email, linkedinUrl: url, snippet: snippet.substring(0, 300), scrapedAt: new Date().toISOString() });
  });

  return profiles;
}
