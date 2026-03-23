/**
 * MESSAGE TEMPLATES ENGINE
 * Based on "Outreaching Scripts: Documented" PDF
 *
 * 5 templates + follow-up sequence:
 *  • Connection Request (≤300 chars) — crisp, agenda-led
 *  • Follow-up 1 — social proof + case study
 *  • Follow-up 2 — lead magnet
 *  • Follow-up 3 — re-engagement
 *  Templates #1-#5 from the doc are all available
 */

/* eslint-disable no-unused-vars */

// ── Helpers ──────────────────────────────────────────────────────────────────
function firstName(fullName) {
  return (fullName || '').split(/\s+/)[0] || 'there';
}

function profileDetail(profile) {
  // Pick the most specific thing we know about the person
  if (profile.recentPost && profile.recentPost.length > 20) {
    return `your recent post on "${profile.recentPost.substring(0, 60).replace(/\n/g, ' ')}…"`;
  }
  if (profile.about && profile.about.length > 30) {
    return profile.about.substring(0, 80).replace(/\n/g, ' ') + '…';
  }
  if (profile.headline) return profile.headline.substring(0, 80);
  return 'your profile';
}

function industryGuess(profile) {
  // Try to infer industry from headline/about/company
  const text = [profile.headline, profile.about, profile.currentCompany, profile.snippet].join(' ');
  const keywords = [
    'coaching', 'coach', 'consulting', 'consultant', 'marketing', 'sales', 'HR', 'tech',
    'finance', 'real estate', 'e-commerce', 'SaaS', 'startup', 'healthcare', 'education',
    'training', 'speaking', 'author', 'creator', 'agency', 'freelance',
  ];
  for (const kw of keywords) {
    if (text.toLowerCase().includes(kw.toLowerCase())) return kw;
  }
  if (profile.headline) return profile.headline.split(/[-–|]/)[0].trim().substring(0, 40);
  return 'your industry';
}

function trimTo(str, max) {
  if (!str) return '';
  if (str.length <= max) return str;
  return str.substring(0, max - 1).trimEnd() + '…';
}

// ── Template builders ─────────────────────────────────────────────────────────

/**
 * CONNECTION REQUEST NOTE  (≤ 300 chars)
 * Template #1 variant — the most widely used from the PDF
 */
function buildConnectionRequest(profile, me) {
  const fn = firstName(profile.name);
  const detail = profileDetail(profile);
  const yrs  = me.yearsExp   || 'X';
  const trials = me.numTrials || 'Y+';
  const pain = me.painPoint  || 'this challenge';
  const resource = me.framework || 'a resource';
  const audience = me.targetAudience || 'professionals like you';
  const outcome = me.dreamOutcome || 'great results';
  const cta = me.cta || 'Mind if I share?';

  let msg = `Hi ${fn}, Checked ${detail}. It took me ${yrs} yrs & ${trials} trials to decode ${pain}. I created a ${resource} helping ${audience} achieve ${outcome}. ${cta}`;
  if (msg.length > 300) {
    // Shorter fallback
    msg = `Hi ${fn}, Noticed ${profile.headline ? profile.headline.substring(0,50) : 'your work'}. Created a ${resource} that helps ${audience} ${outcome}. ${cta}`;
  }
  return trimTo(msg, 300);
}

/**
 * FOLLOW-UP #1 — Social proof + case study  (after they accept / no reply)
 * Template based on PDF page 3
 */
function buildFollowUp1(profile, me) {
  const fn = firstName(profile.name);
  const industry = industryGuess(profile);
  const outcome = me.dreamOutcome || 'remarkable results';
  const caseStudy = me.caseStudy || 'one of my recent clients saw amazing growth';
  const cta = me.cta || 'Worth a chat?';

  return `Hi ${fn},

Thanks for connecting!

I noticed you're in ${industry}. I've helped similar professionals achieve ${outcome} — on autopilot.

${caseStudy}. And we're getting breakthroughs like this every week.

I want to do the same for you. Interested?

If now's not a good time, no worries — just let me know. ${cta}`;
}

/**
 * FOLLOW-UP #2 — Lead magnet offer
 * Template based on PDF page 3-4
 */
function buildFollowUp2(profile, me) {
  const fn = firstName(profile.name);
  const industry = industryGuess(profile);
  const yrs = me.yearsExp || 'X';
  const leadMagnet = me.leadMagnet || 'a free resource';
  const numClients = me.numClients || '100+';

  return `${fn}, I saw you're in ${industry}.

I just finished putting together ${leadMagnet} — combining ${yrs} years of my research and working with ${numClients} clients.

Thought it'd be really helpful for you. Mind if I send it over?`;
}

/**
 * FOLLOW-UP #3 — Re-engagement (went cold)
 * Based on PDF follow-up sequence rules
 */
function buildFollowUp3(profile, me) {
  const fn = firstName(profile.name);
  const outcome = me.dreamOutcome || 'big results';
  const avoid = me.avoidStruggle || 'wasting time with no replies';

  return `${fn}, I know you're busy so I'll keep this short.

Still excited about the chance to help you get ${outcome} — without ${avoid}.

If the timing's right, I'd love to connect. If not, totally fine — just say the word.`;
}

/**
 * TEMPLATE #2 from PDF — Seasonal / Gift angle
 */
function buildGiftTemplate(profile, me) {
  const fn = firstName(profile.name);
  const audience = me.targetAudience || 'professionals';
  const outcome = me.dreamOutcome || 'your dream results';
  const resource = me.leadMagnet || me.framework || 'a free resource';
  const credibility = me.softCredibility || me.yearsExp ? `my ${me.yearsExp} years of experience` : 'helping others';

  return `Hi ${fn}, Checked your profile — ${profileDetail(profile)}.

I'm offering something special to ${audience}: a ${resource} designed to help you ${outcome} — based on ${credibility}.

Type "YES" if you'd like to claim it!`;
}

/**
 * TEMPLATE #4 from PDF — Common struggle approach
 */
function buildStruggleTemplate(profile, me) {
  const fn = firstName(profile.name);
  const audience = me.targetAudience || 'professionals';
  const pain = me.painPoint || 'this problem';
  const yrs = me.yearsExp || 'X';
  const trials = me.numTrials || 'Y+';
  const resource = me.framework || 'a system';
  const outcome = me.dreamOutcome || 'great results';
  const avoid = me.avoidStruggle || 'the usual struggles';
  const cta = me.cta || 'Worth a chat?';

  return `Hi ${fn},

Many ${audience} I work with struggle with ${pain}.

After ${yrs} years and ${trials} experiments, I've developed ${resource} that helps them achieve ${outcome} — without ${avoid}.

${cta}`;
}

/**
 * TEMPLATE #5 from PDF — Profile detail + system
 */
function buildSystemTemplate(profile, me) {
  const fn = firstName(profile.name);
  const detail = profileDetail(profile);
  const yrs = me.yearsExp || 'X';
  const industry = me.yourIndustry || 'this field';
  const audience = me.targetAudience || 'professionals';
  const outcome = me.dreamOutcome || 'your goals';
  const avoid = me.avoidStruggle || 'common setbacks';

  return `Hi ${fn}, Checked your profile and saw ${detail}.

After ${yrs} years working in ${industry}, I've created a system to help ${audience} achieve ${outcome} while avoiding ${avoid}.

Would you be open to exploring this?`;
}

// ── Email pattern generator ───────────────────────────────────────────────────
function generateEmailPatterns(name, companyOrDomain) {
  const parts = (name || '').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const first = parts[0] || '';
  const last  = parts[parts.length - 1] || '';
  if (!first || !last || first === last) return [];

  // If input looks like a domain already, use it; otherwise slugify company name
  let domain = '';
  if (/\.[a-z]{2,}$/.test(companyOrDomain)) {
    domain = companyOrDomain.toLowerCase().trim();
  } else {
    const slug = (companyOrDomain || '')
      .toLowerCase()
      .replace(/\b(inc|llc|ltd|pvt|private|limited|corp|co|the|and|&|technologies|solutions|services|consulting|group|india|global)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    if (!slug) return [];
    domain = `${slug}.com`;
  }

  return [
    `${first}@${domain}`,
    `${first}.${last}@${domain}`,
    `${first}${last}@${domain}`,
    `${first[0]}${last}@${domain}`,
    `${first[0]}.${last}@${domain}`,
  ];
}

// ── Master generate function ──────────────────────────────────────────────────
function generateAllMessages(profile, me) {
  // Generate email patterns if no real email
  const emailPatterns = profile.email
    ? [profile.email]
    : generateEmailPatterns(profile.name, profile.currentCompany || profile.company || '');

  return {
    emailPatterns,
    connectionRequest : buildConnectionRequest(profile, me),
    followUp1         : buildFollowUp1(profile, me),
    followUp2         : buildFollowUp2(profile, me),
    followUp3         : buildFollowUp3(profile, me),
    giftTemplate      : buildGiftTemplate(profile, me),
    struggleTemplate  : buildStruggleTemplate(profile, me),
    systemTemplate    : buildSystemTemplate(profile, me),
  };
}
