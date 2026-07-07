// =========================================================================
// PUBLIC CAMPAIGN JOURNAL — PUBLISH / UNPUBLISH
// =========================================================================
// "Publish Journal" takes a deliberate, FILTERED snapshot of only this
// character's Campaign Notes (Session Notes, Quests, NPCs, Locations,
// Misc & Loot, plus the tags attached to those entries) and writes it to a
// world-readable Firestore document:
//
//     artifacts/{appId}/published/{characterId}
//
// Backstory, Personality, Character Build, and Open Threads are NEVER
// copied into that document, so there is structurally nothing private to
// leak — the public doc simply doesn't contain that data.
//
// The snapshot model is intentional: the public copy only changes when you
// press Publish again, so your live working notes stay private until you
// deliberately push an update. "Unpublish" deletes the public document.
//
// Viewers read the snapshot through view.html?c={characterId} with no
// sign-in. Firestore rules must allow public reads on the published path
// and restrict writes to your UID (see PUBLISH-SETUP.md).

var PUBLISHED_COLLECTION = 'published';

function publishedDocRef(charId) {
    return db.collection('artifacts').doc(appId)
             .collection(PUBLISHED_COLLECTION).doc(charId);
}

// Public link for the CURRENT character, derived from wherever the app is
// hosted so it works on GitHub Pages, localhost, or a custom domain.
window.getPublishedJournalUrl = function() {
    var base = window.location.href.split(/[?#]/)[0];
    base = base.replace(/index\.html$/i, '');
    if (base.charAt(base.length - 1) !== '/') base += '/';
    return base + 'view.html?c=' + encodeURIComponent(currentCharacterId);
};

// --- SNAPSHOT SANITIZER ---
// Notes HTML can contain @mention anchors: <a onclick="window.setTab('tab','id')">.
// Mentions that point INSIDE the campaign sections are kept (the public viewer
// implements its own setTab so they deep-link within the journal). Mentions
// that point at private sections (backstory, personality, build) are flattened
// to inert text so no private deep link or tab id ever ships. Script-ish tags
// are stripped as defense in depth.
function sanitizePublishedHtml(html) {
    if (!html) return html || '';
    var d = document.createElement('div');
    d.innerHTML = html;
    d.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach(function(n) { n.remove(); });
    d.querySelectorAll('a[onclick]').forEach(function(a) {
        var oc = a.getAttribute('onclick') || '';
        var m = oc.match(/setTab\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/);
        var tab = m ? m[1] : '';
        if (tab.indexOf('campaign_') === 0) {
            a.removeAttribute('contenteditable');
            a.removeAttribute('href');
        } else {
            var span = document.createElement('span');
            span.className = 'font-bold text-stone-500 dark:text-stone-400';
            span.textContent = a.textContent;
            a.parentNode.replaceChild(span, a);
        }
    });
    return d.innerHTML;
}

// Build the filtered object that becomes the public journal. This is an
// ALLOWLIST — fields are explicitly copied in, never filtered out, so any
// future private section added to characterData stays private by default.
function buildPublishedSnapshot() {
    var cd = characterData;
    var cn = (cd && cd.campaignNotes) ? cd.campaignNotes : {};
    var snap = JSON.parse(JSON.stringify({
        sessionNotes: cn.sessionNotes || [],
        quests: cn.quests || [],
        npcs: cn.npcs || [],
        locations: cn.locations || [],
        misc: (typeof cn.misc === 'string') ? cn.misc : ''
    }));
    snap.sessionNotes.forEach(function(s) { s.notes = sanitizePublishedHtml(s.notes); });
    snap.quests.forEach(function(q) { q.notes = sanitizePublishedHtml(q.notes); });
    snap.locations.forEach(function(l) { l.notes = sanitizePublishedHtml(l.notes); });
    snap.npcs.forEach(function(f) {
        (f.members || []).forEach(function(n) { n.notes = sanitizePublishedHtml(n.notes); });
    });
    snap.misc = sanitizePublishedHtml(snap.misc);
    return {
        name: cd.name || 'Unnamed Character',
        basics: {
            race: (cd.basics && cd.basics.race) || '',
            class: (cd.basics && cd.basics.class) || ''
        },
        avatar: cd.avatar || '',
        campaignNotes: snap
    };
}

window.publishCampaignJournal = function() {
    if (!isCloudReady || !cloudUser || !db || !currentCharacterId) {
        window.showCustomAlert('Cloud Sign-In Required', 'Publishing writes the public snapshot to the cloud, so it needs an active cloud connection. Please sign in first.', '🔒');
        return;
    }
    window.showCustomConfirm(
        'Publish Campaign Journal?',
        'This puts a read-only snapshot of this character\'s Campaign Notes — Sessions, Quests, NPCs, Locations, Misc & Loot, and their tags — at a public link anyone can view. Backstory, Personality, Character Build, and Open Threads are never included. Publishing again later replaces the public copy with your latest notes.',
        '🌐',
        async function() {
            updateCloudUIStatus('Publishing Journal...', 'loader-2', 'bg-amber-900/50 text-amber-400 animate-pulse');
            try {
                var body = buildPublishedSnapshot();
                var payload = (typeof compressPayload === 'function') ? compressPayload(body) : null;
                var doc = {
                    _pv: 1,
                    name: body.name,
                    basics: body.basics,
                    publishedAt: Date.now()
                };
                if (payload) { doc.payload = payload; } else { doc.data = body; }
                await publishedDocRef(currentCharacterId).set(doc);

                updateCloudUIStatus('Cloud Sync Active', 'cloud-lightning', 'bg-emerald-900/50 text-emerald-400');
                flashSuccessIndicator('Journal published!');

                var url = window.getPublishedJournalUrl();
                var copied = false;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    try { await navigator.clipboard.writeText(url); copied = true; } catch (e) { /* clipboard blocked — link is still shown */ }
                }
                window.showCustomAlert(
                    'Journal is Live',
                    'Share this link:\n\n' + url + '\n\n' + (copied ? '(Copied to your clipboard.) ' : '') + 'Viewers see the snapshot you just published. To update the public copy, press Publish again; to take it down, press Unpublish.',
                    '🌐'
                );
            } catch (e) {
                console.error('Publish failed:', e);
                updateCloudUIStatus('Cloud Sync Active', 'cloud-lightning', 'bg-emerald-900/50 text-emerald-400');
                window.showCustomAlert('Publish Failed', 'The cloud rejected the publish: ' + (e.message || e.code || 'Unknown error') + '\n\nIf this says "permission denied", double-check the published-path block in your Firestore rules (see PUBLISH-SETUP.md).', '❌');
            }
        }
    );
};

window.unpublishCampaignJournal = function() {
    if (!isCloudReady || !cloudUser || !db || !currentCharacterId) {
        window.showCustomAlert('Cloud Sign-In Required', 'Unpublishing needs an active cloud connection. Please sign in first.', '🔒');
        return;
    }
    window.showCustomConfirm(
        'Unpublish Journal?',
        'This deletes the public snapshot for this character. The share link will stop working immediately. Your own notes are not affected.',
        '🚫',
        async function() {
            try {
                await publishedDocRef(currentCharacterId).delete();
                flashSuccessIndicator('Journal unpublished');
            } catch (e) {
                console.error('Unpublish failed:', e);
                window.showCustomAlert('Unpublish Failed', 'The cloud rejected the delete: ' + (e.message || e.code || 'Unknown error'), '❌');
            }
        }
    );
};
