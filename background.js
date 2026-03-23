chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ profiles: [], myProfile: {} });
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.action === 'saveProfiles') {
    chrome.storage.local.get('profiles', ({ profiles = [] }) => {
      const existingUrls = new Set(profiles.map(p => p.linkedinUrl));
      const added = msg.profiles.filter(p => !existingUrls.has(p.linkedinUrl));
      chrome.storage.local.set({ profiles: [...profiles, ...added] }, () => {
        reply({ saved: added.length, total: profiles.length + added.length });
      });
    });
    return true;
  }
});
