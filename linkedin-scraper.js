// LinkedIn Profile Content Script
// Runs on linkedin.com/in/* pages — extracts full profile data + shows extraction panel

(function () {
  if (document.getElementById('li-profile-extractor')) return; // prevent double inject

  // ── Inject floating panel ──────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'li-profile-extractor';
  panel.innerHTML = `
    <div id="lip-header">
      <span>🔍 Profile Extractor</span>
      <button id="lip-close">✕</button>
    </div>
    <div id="lip-body">
      <div id="lip-status">Ready — click Extract to scrape this profile</div>
      <button id="lip-extract" class="lip-btn primary">⬇ Extract Full Profile</button>
      <button id="lip-save"   class="lip-btn success" disabled>💾 Save to Collection</button>
      <div id="lip-preview"></div>
    </div>
  `;
  document.body.appendChild(panel);

  let lastData = null;

  document.getElementById('lip-close').onclick = () => panel.remove();

  // ── Helpers ───────────────────────────────────────────────────────────────
  function txt(el) { return el ? el.innerText.trim() : ''; }

  function getByLabel(labelText) {
    const spans = document.querySelectorAll('span');
    for (const s of spans) {
      if (s.innerText.trim().toLowerCase() === labelText.toLowerCase()) {
        return s.closest('li') || s.closest('div') || s.parentElement;
      }
    }
    return null;
  }

  function getSectionByHeading(headingText) {
    const headers = document.querySelectorAll('h2, h3, div[id]');
    for (const h of headers) {
      const t = h.innerText || h.id || '';
      if (t.trim().toLowerCase().includes(headingText.toLowerCase())) {
        // Walk up to the closest section/div container
        const section = h.closest('section') || h.closest('[data-view-name]') || h.parentElement?.parentElement;
        return section;
      }
    }
    return null;
  }

  function extractListItems(section, max = 4) {
    if (!section) return '';
    const items = section.querySelectorAll('li');
    const results = [];
    items.forEach((item, i) => {
      if (i >= max) return;
      const t = item.innerText.replace(/\n+/g, ' | ').trim();
      if (t.length > 4) results.push(t);
    });
    return results.join('\n');
  }

  // ── Main extractor ────────────────────────────────────────────────────────
  function extractProfile() {
    const data = {};

    // ── Name ──
    data.name = txt(
      document.querySelector('h1.text-heading-xlarge') ||
      document.querySelector('h1[class*="heading"]') ||
      document.querySelector('h1')
    );

    // ── Headline ──
    data.headline = txt(
      document.querySelector('.text-body-medium.break-words') ||
      document.querySelector('[data-field="headline"]') ||
      document.querySelector('.pv-top-card h1 + div')
    );

    // ── Location ──
    data.location = txt(
      document.querySelector('.pv-top-card--list-bullet li') ||
      document.querySelector('[class*="location"]') ||
      document.querySelector('span.text-body-small.inline.t-black--light.break-words')
    );

    // ── Followers / Connections ──
    const connEl = document.querySelector('[class*="connections"] span, [class*="followers"] span, .pvs-header__subtitle');
    data.followers = connEl ? connEl.innerText.replace(/\n/g, ' ').trim() : '';
    if (!data.followers) {
      const allText = document.body.innerText;
      const m = allText.match(/([\d,]+\+?\s*(?:followers|connections))/i);
      if (m) data.followers = m[1];
    }

    // ── About / Summary ──
    let about = '';
    // Strategy 1: find div with id "about"
    const aboutAnchor = document.getElementById('about');
    if (aboutAnchor) {
      const section = aboutAnchor.closest('section') || aboutAnchor.parentElement?.parentElement;
      if (section) {
        // get all text, remove heading
        const clone = section.cloneNode(true);
        clone.querySelectorAll('h2, h3, button').forEach(e => e.remove());
        about = clone.innerText.replace(/see more|show more/gi, '').trim();
      }
    }
    // Strategy 2: search by heading text
    if (!about) {
      const aboutSection = getSectionByHeading('about');
      if (aboutSection) {
        const clone = aboutSection.cloneNode(true);
        clone.querySelectorAll('h2, h3, button').forEach(e => e.remove());
        about = clone.innerText.replace(/see more|show more/gi, '').trim().substring(0, 800);
      }
    }
    data.about = about.substring(0, 800);

    // ── Current Company & Title (from Experience) ──
    let currentCompany = '';
    let currentTitle = '';
    const expAnchor = document.getElementById('experience');
    if (expAnchor) {
      const expSection = expAnchor.closest('section') || expAnchor.parentElement?.parentElement;
      if (expSection) {
        const firstItem = expSection.querySelector('li');
        if (firstItem) {
          const spans = firstItem.querySelectorAll('span[aria-hidden="true"]');
          const texts = Array.from(spans).map(s => s.innerText.trim()).filter(t => t.length > 1);
          currentTitle = texts[0] || '';
          currentCompany = texts[1] || texts[2] || '';
          // Clean up time markers
          currentCompany = currentCompany.replace(/\d{4}|Present|Full-time|Part-time|Internship|Contract/gi, '').trim();
        }
      }
    }
    // Fallback from headline
    if (!currentCompany && data.headline) {
      const m = data.headline.match(/(?:at|@)\s+(.+)/i);
      if (m) currentCompany = m[1].trim();
    }
    data.currentTitle = currentTitle;
    data.currentCompany = currentCompany;

    // ── Experience List (top 3) ──
    const expSection = document.getElementById('experience')?.closest('section') ||
                       document.getElementById('experience')?.parentElement?.parentElement;
    data.experience = expSection ? extractListItems(expSection, 3) : '';

    // ── Education (top 2) ──
    const eduAnchor = document.getElementById('education');
    const eduSection = eduAnchor?.closest('section') || eduAnchor?.parentElement?.parentElement;
    data.education = eduSection ? extractListItems(eduSection, 2) : '';

    // ── Skills (top 5) ──
    const skillsAnchor = document.getElementById('skills');
    const skillsSection = skillsAnchor?.closest('section') || skillsAnchor?.parentElement?.parentElement;
    data.skills = skillsSection ? extractListItems(skillsSection, 5) : '';

    // ── Email from Contact Info (if visible in DOM) ──
    let email = '';
    // Check for mailto links anywhere on the page
    document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
      const e = a.href.replace('mailto:', '').trim();
      if (e && !email) email = e;
    });
    // Scan for email patterns in visible text
    if (!email) {
      const bodyText = document.body.innerText;
      const emailMatch = bodyText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) email = emailMatch[0];
    }
    data.email = email;

    // ── Website / Social links ──
    let website = '';
    document.querySelectorAll('a[href*="http"]').forEach(a => {
      if (website) return;
      const href = a.href || '';
      if (href.includes('linkedin.com') || href.includes('google.com') || href.includes('facebook.com')) return;
      if (a.closest('[id*="contact"]') || a.closest('[class*="contact"]')) {
        website = href;
      }
    });
    data.website = website;

    // ── LinkedIn URL ──
    data.linkedinUrl = window.location.href.split('?')[0].replace(/\/$/, '');

    // ── Recent Post (visible on profile) ──
    let recentPost = '';
    const activitySection = getSectionByHeading('activity') || getSectionByHeading('posts');
    if (activitySection) {
      const postEl = activitySection.querySelector('[class*="feed-shared-text"], .break-words span, span.visually-hidden + span');
      if (postEl) recentPost = postEl.innerText.replace(/\n+/g, ' ').trim().substring(0, 300);
    }
    if (!recentPost) {
      // Try to find any post-like text blocks
      const feedItems = document.querySelectorAll('[data-urn*="activity"] [class*="commentary"], .feed-shared-update-v2__description-wrapper');
      if (feedItems.length) recentPost = feedItems[0].innerText.trim().substring(0, 300);
    }
    data.recentPost = recentPost;

    // ── Generate email patterns if no real email found ──
    if (!data.email && data.name) {
      data.emailPatterns = generateEmailPatterns(data.name, data.currentCompany);
    } else {
      data.emailPatterns = data.email ? [data.email] : [];
    }

    data.scrapedAt = new Date().toISOString();
    data.source = 'linkedin-profile';

    return data;
  }

  function generateEmailPatterns(name, company) {
    const parts = name.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';
    if (!first || !last || first === last) return [];

    // Try to guess domain from company name
    const companySlug = (company || '')
      .toLowerCase()
      .replace(/\b(inc|llc|ltd|pvt|private|limited|corp|co|the|and|&)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

    if (!companySlug) return [];

    const domain = `${companySlug}.com`;
    return [
      `${first}@${domain}`,
      `${first}.${last}@${domain}`,
      `${first[0]}${last}@${domain}`,
      `${first[0]}.${last}@${domain}`,
      `${first}${last}@${domain}`,
    ];
  }

  // ── Extract button click ──────────────────────────────────────────────────
  document.getElementById('lip-extract').addEventListener('click', () => {
    const statusEl = document.getElementById('lip-status');
    statusEl.textContent = 'Extracting...';
    statusEl.style.color = '#666';

    try {
      lastData = extractProfile();

      // Render preview
      const preview = document.getElementById('lip-preview');
      preview.innerHTML = `
        <div class="lip-field"><b>Name:</b> ${esc(lastData.name)}</div>
        <div class="lip-field"><b>Headline:</b> ${esc(lastData.headline)}</div>
        <div class="lip-field"><b>Company:</b> ${esc(lastData.currentCompany)}</div>
        <div class="lip-field"><b>Location:</b> ${esc(lastData.location)}</div>
        <div class="lip-field"><b>Followers:</b> ${esc(lastData.followers)}</div>
        <div class="lip-field"><b>Email:</b> ${esc(lastData.email || lastData.emailPatterns?.join(', ') || '—')}</div>
        <div class="lip-field"><b>About:</b> ${esc((lastData.about || '—').substring(0, 120))}${lastData.about?.length > 120 ? '…' : ''}</div>
        <div class="lip-field"><b>Recent Post:</b> ${esc((lastData.recentPost || '—').substring(0, 80))}${lastData.recentPost?.length > 80 ? '…' : ''}</div>
      `;

      statusEl.textContent = `✅ Extracted — ${lastData.name}`;
      statusEl.style.color = '#28a745';
      document.getElementById('lip-save').disabled = false;
    } catch (err) {
      statusEl.textContent = '❌ Error extracting. Try scrolling down first.';
      statusEl.style.color = '#dc3545';
      console.error('[LinkedIn Scraper]', err);
    }
  });

  // ── Save to collection ────────────────────────────────────────────────────
  document.getElementById('lip-save').addEventListener('click', async () => {
    if (!lastData) return;
    const stored = await chrome.storage.local.get('profiles');
    const existing = stored.profiles || [];
    const existingUrls = new Set(existing.map(p => p.linkedinUrl));

    if (existingUrls.has(lastData.linkedinUrl)) {
      // Update existing entry with richer data
      const idx = existing.findIndex(p => p.linkedinUrl === lastData.linkedinUrl);
      existing[idx] = { ...existing[idx], ...lastData };
      await chrome.storage.local.set({ profiles: existing });
      document.getElementById('lip-status').textContent = '🔄 Updated existing profile';
    } else {
      await chrome.storage.local.set({ profiles: [...existing, lastData] });
      document.getElementById('lip-status').textContent = `💾 Saved! Total: ${existing.length + 1}`;
    }
    document.getElementById('lip-status').style.color = '#0a66c2';
  });

  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }
})();
