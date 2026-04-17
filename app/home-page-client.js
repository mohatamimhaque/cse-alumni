'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

function HomePageContent() {
  const router = useRouter();
  const [allProfiles, setAllProfiles] = useState([]);
  const [activeSeries, setActiveSeries] = useState('all');
  const [activeOrganization, setActiveOrganization] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalProfile, setModalProfile] = useState(null);
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const [seriesExpanded, setSeriesExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [urlRestored, setUrlRestored] = useState(false);
  const searchTimer = useRef(null);
  const PER_PAGE = 20;

  // Restore state from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const page = parseInt(params.get('page')) || 1;
    const search = params.get('search') || '';
    const series = params.get('series') || 'all';
    const organization = params.get('organization') || 'all';

    setCurrentPage(page);
    setSearchQuery(search);
    setActiveSeries(series);
    setActiveOrganization(organization);
    setUrlRestored(true);
  }, []);

  // Update URL when state changes (after URL is restored)
  useEffect(() => {
    if (!urlRestored) return;

    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage);
    if (searchQuery) params.set('search', searchQuery);
    if (activeSeries !== 'all') params.set('series', activeSeries);
    if (activeOrganization !== 'all') params.set('organization', activeOrganization);

    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : '/';
    router.replace(newUrl);
  }, [currentPage, searchQuery, activeSeries, activeOrganization, urlRestored, router]);

  // Reset to page 1 when filters or search changes
  useEffect(() => {
    if (!urlRestored) return;
    setCurrentPage(1);
  }, [searchQuery, activeSeries, activeOrganization, urlRestored]);

  // Track page view on load
  useEffect(() => {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'page_view' }),
    }).catch(() => {});
  }, []);

  // Load members from API
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/members');
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const data = await res.json();
        // Filter out hidden members as a frontend safety check
        const visibleMembers = Array.isArray(data) ? data.filter(m => m.visible !== false) : [];
        setAllProfiles(visibleMembers);
      } catch (err) {
        console.error('Load members error:', err);
        setAllProfiles([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Helper functions
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const getSeries = (id) => {
    const m = String(id || '').trim().match(/^(\d{2})/);
    return m ? String(Number(m[1])).padStart(2, '0') : null;
  };

  const toOrdinal = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return '';
    const j = v % 10, k = v % 100;
    if (j === 1 && k !== 11) return `${v}st`;
    if (j === 2 && k !== 12) return `${v}nd`;
    if (j === 3 && k !== 13) return `${v}rd`;
    return `${v}th`;
  };

  const toOrdinalSupHtml = (n) => {
    const ord = toOrdinal(n);
    const m = ord.match(/^(\d+)(st|nd|rd|th)$/);
    if (!m) return esc(ord);
    return `${m[1]}<sup>${m[2]}</sup>`;
  };

  const formatSeriesHtml = (series) => {
    const n = Number(String(series || '').trim());
    const t = Number.isFinite(n) && n >= 0 ? String(Math.trunc(n)).padStart(2, '0') : String(series || '');
    return `${esc(t)} Series`;
  };

  const getBatchNumberFromSeries = (series) => {
    if (!series) return null;
    const s = Number(series);
    if (!Number.isFinite(s) || s < 0 || s > 99) return null;
    if (s >= 19) return s;
    else if (s >= 11) return s + 1;
    return ((s - 99 + 100) % 100) + 1;
  };

  const getBatchCategory = (b) => {
    const n = Number(b);
    if (!Number.isFinite(n)) return '';
    if (n >= 1 && n <= 20) return 'Alumni';
    if (n >= 21 && n <= 22) return 'Student';
    return '';
  };

  const getTelHref = (v) => { const c = String(v || '').replace(/[^\d+]/g, ''); return c ? `tel:${c}` : ''; };
  const getMailHref = (v) => { const e = String(v || '').trim(); return e ? `mailto:${e}` : ''; };
  const cleanDisplayValue = (v) => {
    const s = String(v || '').trim();
    if (!s || /^[-_\u2014]+$/.test(s) || /^(n\/?a|na|null|none)$/i.test(s)) return '';
    return s;
  };

  // Resolve photo URL:
  //  - R2 URLs → proxy via /api/image
  //  - Any other URL → pass through
  const getPhotoUrl = (url) => {
    if (!url) return '';
    if (typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return ''; // local path — not yet migrated
    if (trimmed.includes('.r2.cloudflarestorage.com')) return `/api/image?url=${encodeURIComponent(trimmed)}`;
    return trimmed;
  };

  // Filtering
  const getFiltered = useCallback(() => {
    const q = searchQuery.toLowerCase();
    return allProfiles.filter((p) => {
      const s = getSeries(p.ID);
      const seriesOk = activeSeries === 'all' || s === activeSeries;
      const orgOk = activeOrganization === 'all' || String(p.Organization || '').trim() === activeOrganization;
      const textOk = !q || [p.Name, p.ID, p.Email, p.Mobile, p.Designation, p.Organization].some((v) => (v || '').toLowerCase().includes(q));
      return seriesOk && orgOk && textOk;
    });
  }, [allProfiles, activeSeries, activeOrganization, searchQuery]);

  const filtered = getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * PER_PAGE;
  const pageItems = filtered.slice(start, start + PER_PAGE);

  // Series chips
  const seriesSet = new Set();
  allProfiles.forEach((p) => { const v = getSeries(p.ID); if (v) seriesSet.add(v); });
  const seriesList = [...seriesSet].sort((a, b) => Number(a) - Number(b));

  // Organizations
  const orgSet = new Set();
  allProfiles.forEach((p) => { const o = String(p.Organization || '').trim(); if (o) orgSet.add(o); });
  const orgList = [...orgSet].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  // Pagination numbers
  const getPageNums = (cur, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const p = [1];
    if (cur > 3) p.push('...');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) p.push(i);
    if (cur < total - 2) p.push('...');
    p.push(total);
    return p;
  };

  // Search with debounce
  const handleSearch = (val) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchQuery(val);
      setCurrentPage(1);
    }, 180);
  };

  // Open modal + track analytics
  const openModal = (profile) => {
    setModalProfile(profile);
    setPhotoLoadError(false);
    document.body.style.overflow = 'hidden';
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'card_view',
        memberId: profile._id || profile.ID,
        memberName: profile.Name,
      }),
    }).catch(() => {});
  };

  const closeModal = () => {
    setModalProfile(null);
    setPhotoLoadError(false);
    document.body.style.overflow = '';
  };

  // Download card as image
  const downloadCard = async () => {
    const card = document.getElementById('idCard');
    if (!card) {
      alert('Card element not found');
      return;
    }
    const dlBtn = document.getElementById('downloadBtn');
    if (dlBtn) { dlBtn.classList.add('loading'); dlBtn.disabled = true; }
    try {
      const scale = 2.5;
      const cardW = card.offsetWidth, cardH = card.offsetHeight;
      const outW = cardW * scale, outH = cardH * scale;
      const radius = 22 * scale;

      const domtoimage = (await import('dom-to-image')).default;
      const dataUrl = await domtoimage.toPng(card, {
        width: outW, height: outH,
        style: { transform: `scale(${scale})`, transformOrigin: 'top left', width: cardW + 'px', height: cardH + 'px' },
        quality: 1, bgcolor: '#08142f',
      });

      if (!dataUrl) throw new Error('Failed to generate image data');

      const img = new Image(); img.src = dataUrl;
      await new Promise((res, rej) => { 
        img.onload = res;
        img.onerror = () => rej(new Error('Image generation failed'));
        setTimeout(() => rej(new Error('Image generation timeout')), 5000);
      });
      
      const cvs = document.createElement('canvas'); cvs.width = outW; cvs.height = outH;
      const ctx = cvs.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      ctx.beginPath();
      ctx.moveTo(radius, 0); ctx.lineTo(outW - radius, 0);
      ctx.arc(outW - radius, radius, radius, -Math.PI / 2, 0);
      ctx.lineTo(outW, outH - radius);
      ctx.arc(outW - radius, outH - radius, radius, 0, Math.PI / 2);
      ctx.lineTo(radius, outH);
      ctx.arc(radius, outH - radius, radius, Math.PI / 2, Math.PI);
      ctx.lineTo(0, radius);
      ctx.arc(radius, radius, radius, Math.PI, -Math.PI / 2);
      ctx.closePath(); ctx.clip();
      ctx.fillStyle = '#08142f'; ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, 0, 0);

      const memberName = (modalProfile?.Name || 'member').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      const link = document.createElement('a');
      link.download = `DUET_Reunion_2025_${memberName}.png`;
      link.href = cvs.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
      alert('Could not generate image. Try again or take a screenshot.');
    } finally {
      if (dlBtn) { dlBtn.classList.remove('loading'); dlBtn.disabled = false; }
    }
  };

  // Keyboard: Escape closes modal
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Render modal profile info
  const renderModal = () => {
    if (!modalProfile) return null;
    const p = modalProfile;
    const series = getSeries(p.ID);
    const batchNo = getBatchNumberFromSeries(series);
    const batchCategory = getBatchCategory(batchNo);
    const designation = cleanDisplayValue(p.Designation);
    const organization = cleanDisplayValue(p.Organization);
    const location = cleanDisplayValue(p.Location);
    const mobile = cleanDisplayValue(p.Mobile);
    const email = cleanDisplayValue(p.Email);
    const photoSrc = getPhotoUrl(p.photo);

    return (
      <div className="modal-overlay open" id="modalOverlay" onClick={(e) => { if (e.target.id === 'modalOverlay') closeModal(); }}>
        <div className="modal-shell">
          <div id="idCard">
            <div className="card-top-band"></div>
            <div className="id-event-top">
              <img className="id-logo id-logo-left" src="/assests/logo/duet.png" alt="DUET Logo" loading="lazy" />
              <div className="id-event-title">
                <div className="id-event-sub">Computer Science and Engineering</div>
              </div>
              <img className="id-logo id-logo-right" src="/assests/logo/cse.jpg" alt="CSE Logo" loading="lazy" />
            </div>
            <div className="id-photo-stage">
              <div className="id-photo-wrap">
                {photoSrc && !photoLoadError ? (
                  <img 
                    id="idCardPhoto" 
                    src={photoSrc} 
                    alt={p.Name || 'Member photo'} 
                    onError={() => setPhotoLoadError(true)}
                  />
                ) : null}
                {!photoSrc || photoLoadError ? (
                  <div className="id-photo-placeholder">
                    <span className="material-symbols-outlined">account_circle</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="id-name" id="idName">{p.Name || 'Unknown'}</div>
            <div className="id-designation" id="idDesignation">{designation}</div>
            <div className="id-org-name" id="idOrgName">{organization}</div>
            <div className="id-badges" id="idBadges">
              {p.ID && <span className="id-badge id-badge-id">ID {esc(p.ID)}</span>}
              {series && <span className="id-badge id-badge-series" dangerouslySetInnerHTML={{ __html: formatSeriesHtml(series) }}></span>}
              {batchNo && <span className="id-badge id-badge-batch" dangerouslySetInnerHTML={{ __html: `${toOrdinalSupHtml(batchNo)} Batch` }}></span>}
              {batchCategory && <span className="id-badge id-badge-status">{batchCategory}</span>}
            </div>
            <div className="id-details-shell">
              <div className="id-details" id="idDetails">
                <div className="id-row"><div className="id-row-label">Student ID</div><div className="id-row-value">{esc(p.ID || '—')}</div></div>
                <div className="id-row">
                  <div className="id-row-label">Series / Batch</div>
                  <div className="id-row-value" dangerouslySetInnerHTML={{ __html: `${series ? formatSeriesHtml(series) : '<span class="empty">—</span>'}${batchNo ? ` · ${toOrdinalSupHtml(batchNo)} Batch` : ''}` }}></div>
                </div>
                {mobile && (
                  <div className="id-row"><div className="id-row-label">Mobile</div><div className="id-row-value"><a href={getTelHref(mobile)}>{esc(mobile)}</a></div></div>
                )}
                {email && (
                  <div className="id-row"><div className="id-row-label">Email</div><div className="id-row-value"><a href={getMailHref(email)}>{esc(email)}</a></div></div>
                )}
                {organization && (
                  <div className="id-row"><div className="id-row-label">Organization</div><div className="id-row-value">{esc(organization)}</div></div>
                )}
                {location && (
                  <div className="id-row"><div className="id-row-label">Location</div><div className="id-row-value">{esc(location)}</div></div>
                )}
              </div>
            </div>
            <div className="id-bottom-strip">
              <span className="id-bottom-text">dhaka university of engineering &amp; technology, gazipur</span>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-download" id="downloadBtn" title="Download ID Card as image" onClick={downloadCard}>
              <div className="dl-spinner"></div>
              <span className="material-symbols-outlined dl-icon" aria-hidden="true">download</span>
              <span className="btn-text">Save</span>
            </button>
            <button className="btn btn-close" onClick={closeModal}>
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
              <span className="btn-text">Close</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_CONTENT }} />
      <header>
        <div className="header-brand">
          <h1>DUET Reunion 2025</h1>
          <p>Series 99-22 · Member Directory</p>
        </div>
        <div className="header-divider"></div>
        <div className="search-wrap">
          <span className="material-symbols-outlined" style={{fontSize: '20px'}}>search</span>
          <input type="text" id="searchInput" placeholder="Search by name, ID, organization, designation…" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
        </div>
        <div className="stats">
          <span id="countDisplay">{filtered.length}</span>
          <small>Members</small>
        </div>
      </header>

      <div className="filter-section">
        <div className="filter-row series-row">
          <span className="filter-label">Series:</span>
          <button className="series-toggle" onClick={() => setSeriesExpanded(!seriesExpanded)} aria-label={seriesExpanded ? 'Hide series list' : 'Show series list'}>
            <span className="material-symbols-outlined" aria-hidden="true">{seriesExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
          </button>
          {seriesExpanded && (
            <div className="chips" id="seriesChips">
              <button className={`chip series-chip ${activeSeries === 'all' ? 'active' : ''}`} onClick={() => { setActiveSeries('all'); setCurrentPage(1); }}>All</button>
              {seriesList.map((s) => (
                <button key={s} className={`chip series-chip ${activeSeries === s ? 'active' : ''}`} onClick={() => { setActiveSeries(s); setCurrentPage(1); }}>{s} Series</button>
              ))}
            </div>
          )}
        </div>
        <div className="filter-row">
          <span className="filter-label">Organization:</span>
          <input
            id="organizationSelect"
            className="org-select"
            type="text"
            list="organizationOptions"
            placeholder="All Organizations"
            onChange={(e) => {
              const val = e.target.value.trim();
              if (!val || /^all organizations$/i.test(val)) { setActiveOrganization('all'); }
              else if (orgList.includes(val)) { setActiveOrganization(val); }
              else { setActiveOrganization('all'); }
              setCurrentPage(1);
            }}
          />
          <datalist id="organizationOptions">
            {orgList.map((o) => <option key={o} value={o} />)}
          </datalist>
        </div>
      </div>

      <div className="grid-container" id="grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card skeleton-card">
              <div className="skeleton-photo"></div>
              <div className="card-body">
                <div className="skeleton-meta"><div className="skeleton-pill"></div><div className="skeleton-pill"></div></div>
                <div className="skeleton-line name"></div><div className="skeleton-line role"></div><div className="skeleton-line role2"></div>
                <div className="skeleton-footer"><div className="skeleton-chip"></div><div className="skeleton-chip small"></div></div>
              </div>
            </div>
          ))
        ) : pageItems.length === 0 ? (
          <div className="no-results">
            <span className="material-symbols-outlined" style={{fontSize: '44px'}}>search</span>
            <p>No members found.</p>
          </div>
        ) : (
          pageItems.map((p, i) => {
            const series = getSeries(p.ID);
            const batchNo = getBatchNumberFromSeries(series);
            const photoSrc = getPhotoUrl(p.photo);
            return (
              <div key={p._id || i} className="card" style={{ animationDelay: `${i * 0.025}s` }} onClick={() => openModal(p)}>
                {photoSrc ? (
                  <img 
                    className="card-photo" 
                    src={photoSrc} 
                    alt={p.Name || 'Member photo'} 
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const placeholder = e.target.parentElement?.querySelector('.card-photo-placeholder');
                      if (placeholder) placeholder.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="card-photo-placeholder" style={{ display: photoSrc ? 'none' : 'flex' }}>👤</div>
                <div className="card-body">
                  <div className="card-meta">
                    <span className="badge badge-id">ID {esc(p.ID || '—')}</span>
                    {series && <span className="badge badge-series" dangerouslySetInnerHTML={{ __html: formatSeriesHtml(series) }}></span>}
                    {batchNo && <span className="badge badge-batch" dangerouslySetInnerHTML={{ __html: `${toOrdinalSupHtml(batchNo)} Batch` }}></span>}
                  </div>
                  <div className="card-name">{esc(p.Name || 'Unknown')}</div>
                  <div className="card-role">{esc(p.Designation || '')}{p.Designation && p.Organization ? ' · ' : ''}{esc(p.Organization || '')}{p.Location ? ` · ${esc(p.Location)}` : ''}</div>
                  <div className="card-footer">
                    <span className="blood-badge">{esc(p.Blood || '?')}</span>
                    <span className="view-btn">View ID Card <span className="material-symbols-outlined" style={{fontSize: '14px', marginLeft: '4px', verticalAlign: 'middle'}}>arrow_forward</span></span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination-wrap" id="paginationWrap">
          <div className="page-info">Showing {start + 1}–{Math.min(start + PER_PAGE, filtered.length)} of {filtered.length} members</div>
          <button className="pg-btn" onClick={() => { setCurrentPage(Math.max(1, safePage - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={safePage === 1}>
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          {getPageNums(safePage, totalPages).map((pg, i) =>
            pg === '...' ? <span key={`ell-${i}`} className="pg-ellipsis">…</span> :
              <button key={pg} className={`pg-btn ${pg === safePage ? 'active' : ''}`} onClick={() => { setCurrentPage(pg); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{pg}</button>
          )}
          <button className="pg-btn" onClick={() => { setCurrentPage(Math.min(totalPages, safePage + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={safePage === totalPages}>
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}

      <footer className="page-footer">
        <span className="page-footer-label">Developed by</span>
        <strong>Mohatamim</strong>
        <span className="page-footer-sep">•</span>
        <span className="page-footer-label">WhatsApp:</span>
        <a className="page-footer-link" href="https://wa.me/8801518749114" target="_blank" rel="noopener noreferrer">01518749114</a>
      </footer>

      {renderModal()}
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}

// CSS — improved styling with better UX, accessibility, and visual hierarchy
const CSS_CONTENT = `
:root {
  --bg:#0d1117;--surface:#161b22;--card:#1c2230;--border:#2a3245;
  --gold:#c9a84c;--gold-dim:#8a6e2f;--gold-light:#e8c96a;
  --text:#e8eaf0;--muted:#7a8499;--accent:#3a7bd5;--red:#e05252;
  --emerald:#32d399;--card-photo-h:210px;
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.12);
  --shadow-md: 0 8px 20px rgba(0,0,0,0.18);
  --shadow-lg: 0 16px 40px rgba(0,0,0,0.25);
  --shadow-xl: 0 24px 72px rgba(0,0,0,0.32);
  --transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh;line-height:1.5}
.material-symbols-outlined{font-variation-settings:'FILL' 0,'wght' 500,'GRAD' 0,'opsz' 24;font-family:'Material Symbols Outlined';display:inline-flex;align-items:center;justify-content:center;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
header{background:linear-gradient(135deg,#0d1117 0%,#1a2235 60%,#0d1117 100%);border-bottom:1px solid var(--border);padding:18px 36px;position:sticky;top:0;z-index:100;display:grid;grid-template-columns:auto auto 1fr auto;align-items:center;gap:14px 20px;box-shadow:var(--shadow-sm)}
.header-brand{min-width:0}
.header-brand h1{font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:700;color:var(--gold);letter-spacing:.02em;line-height:1.1;white-space:nowrap}
.header-brand p{font-size:.72rem;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-top:2px;line-height:1.25}
.header-divider{width:1px;height:36px;background:var(--border);justify-self:center}
.search-wrap{min-width:0;width:100%;position:relative;display:flex;align-items:center}
.search-wrap .material-symbols-outlined{position:absolute;left:12px;color:var(--muted);pointer-events:none;font-size:20px}
#searchInput{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px 10px 38px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:.9rem;outline:none;transition:var(--transition);box-shadow:var(--shadow-sm)}
#searchInput:focus{border-color:var(--gold);box-shadow:var(--shadow-md),0 0 0 3px rgba(201,168,76,0.1)}
#searchInput::placeholder{color:var(--muted)}
.stats{text-align:right;white-space:nowrap}
.stats span{font-size:1.5rem;font-weight:600;color:var(--gold);font-family:'Playfair Display',serif;display:block;line-height:1}
.stats small{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
@media(max-width:900px){header{padding:14px 24px;grid-template-columns:1fr auto;grid-template-rows:auto auto;gap:10px 16px}.header-brand{grid-column:1;grid-row:1}.stats{grid-column:2;grid-row:1;align-self:center}.header-divider{display:none}.search-wrap{grid-column:1/-1;grid-row:2;min-width:0}}
@media(max-width:540px){header{padding:12px 16px;grid-template-columns:1fr auto;gap:8px 12px}.header-brand h1{font-size:1.05rem}.header-brand p{font-size:.65rem;letter-spacing:.08em}.stats span{font-size:1.2rem}.stats small{font-size:.62rem}#searchInput{font-size:.85rem;padding:9px 12px 9px 34px}}
.filter-section{background:var(--bg);border-bottom:1px solid var(--border)}
.filter-row{padding:10px 36px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;border-bottom:1px solid rgba(42,50,69,.5)}
.filter-row:last-child{border-bottom:none}
.filter-label{font-size:.68rem;color:var(--gold-dim);text-transform:uppercase;letter-spacing:.12em;font-weight:600;margin-right:4px;white-space:nowrap}
.chips{display:flex;gap:5px;flex-wrap:wrap;width:100%}
.series-toggle{margin-left:auto;width:32px;height:32px;border-radius:50%;border:1px solid var(--border);background:var(--surface);color:var(--gold);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:var(--transition);box-shadow:var(--shadow-sm)}
.series-toggle:hover{border-color:var(--gold);color:var(--gold-light);box-shadow:var(--shadow-md);transform:scale(1.08)}
.series-toggle:active{transform:scale(0.96)}
.series-toggle .material-symbols-outlined{font-size:20px;line-height:1}
.chip{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:6px 14px;font-size:.75rem;color:var(--muted);cursor:pointer;transition:var(--transition);font-family:'DM Sans',sans-serif;white-space:nowrap;font-weight:500;box-shadow:var(--shadow-sm)}
.chip:hover{border-color:var(--gold-dim);color:var(--text);box-shadow:var(--shadow-md);transform:translateY(-2px)}
.chip.active{background:var(--gold);border-color:var(--gold);color:#0d1117;font-weight:700;box-shadow:0 8px 20px rgba(201,168,76,0.25),var(--shadow-md)}
.chip.series-chip.active{background:var(--accent);border-color:var(--accent);color:#fff;box-shadow:0 8px 20px rgba(58,123,213,0.25),var(--shadow-md)}
.org-select{min-width:min(520px,100%);max-width:100%;width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:.84rem;outline:none;transition:var(--transition);font-weight:500;box-shadow:var(--shadow-sm)}
.org-select:hover{border-color:rgba(201,168,76,0.3)}
.org-select:focus{border-color:var(--gold);box-shadow:var(--shadow-md),0 0 0 3px rgba(201,168,76,0.1)}
.grid-container{padding:28px 36px;display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:18px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden;cursor:pointer;transition:var(--transition);animation:fadeUp .4s ease both;box-shadow:var(--shadow-md);position:relative}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.card:hover{transform:translateY(-6px);box-shadow:var(--shadow-lg),0 0 0 1px var(--gold-dim);border-color:var(--gold-dim)}.card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(201,168,76,0.08),transparent);opacity:0;transition:opacity .3s;pointer-events:none;z-index:1}
.card:hover::before{opacity:1}
.card-photo{width:100%;height:var(--card-photo-h);object-fit:cover;object-position:center top;display:block;background:var(--surface);transition:transform .4s ease}
.card:hover .card-photo{transform:scale(1.05)}
.card-photo-placeholder{width:100%;height:var(--card-photo-h);background:linear-gradient(135deg,var(--surface),var(--border));display:flex;align-items:center;justify-content:center;font-size:2.8rem;color:var(--border)}
.card-body{padding:14px}
.card-meta{display:flex;gap:5px;margin-bottom:7px;flex-wrap:wrap}
.badge{font-size:.64rem;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.05em;transition:var(--transition);display:inline-flex;align-items:center;gap:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15)}
.badge-id{background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(201,168,76,.08));color:var(--gold);border:1px solid rgba(201,168,76,.4)}
.badge-series{background:linear-gradient(135deg,rgba(58,123,213,.18),rgba(58,123,213,.08));color:var(--accent);border:1px solid rgba(58,123,213,.4)}
.badge-batch{background:linear-gradient(135deg,rgba(22,223,140,.18),rgba(22,223,140,.08));color:#5de0a3;border:1px solid rgba(22,223,140,.4)}
.badge-status{background:linear-gradient(135deg,rgba(160,174,208,.18),rgba(160,174,208,.08));color:#d3dcf0;border:1px solid rgba(160,174,208,.4)}
.card-name{font-family:'Playfair Display',serif;font-size:1rem;font-weight:600;color:var(--text);line-height:1.3;margin-bottom:7px}
.card-role{font-size:.78rem;color:var(--muted);line-height:1.4;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-footer{display:flex;align-items:center;justify-content:space-between;padding-top:9px;border-top:1px solid var(--border)}
.blood-badge{font-size:.7rem;font-weight:600;padding:3px 9px;border-radius:20px;background:rgba(201,168,76,.12);color:var(--gold);border:1px solid var(--gold-dim)}
.view-btn{font-size:.73rem;color:var(--accent);font-weight:600;display:flex;align-items:center;gap:4px;transition:var(--transition);opacity:.85}
.view-btn:hover{opacity:1;gap:6px}
.skeleton-card{pointer-events:none}
.skeleton-photo,.skeleton-line,.skeleton-pill,.skeleton-chip{position:relative;overflow:hidden;background:linear-gradient(110deg,rgba(50,58,78,.6) 8%,rgba(92,104,132,.42) 18%,rgba(50,58,78,.6) 33%);background-size:220% 100%;animation:shimmer 1.15s linear infinite}
.skeleton-photo{height:var(--card-photo-h)}
.skeleton-meta{display:flex;gap:6px;margin-bottom:10px}
.skeleton-pill{height:18px;width:76px;border-radius:999px}
.skeleton-line{height:11px;border-radius:7px;margin-bottom:8px}
.skeleton-line.name{height:14px;width:72%;margin-bottom:10px}
.skeleton-line.role{width:90%}
.skeleton-line.role2{width:64%;margin-bottom:0}
.skeleton-footer{display:flex;align-items:center;justify-content:space-between;padding-top:10px;margin-top:12px;border-top:1px solid var(--border)}
.skeleton-chip{height:20px;width:56px;border-radius:999px}
.skeleton-chip.small{width:84px}
@keyframes shimmer{from{background-position:200% 0}to{background-position:-20% 0}}
.pagination-wrap{padding:20px 36px 40px;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap}
.page-info{font-size:.78rem;color:var(--muted);text-align:center;width:100%;margin-bottom:4px}
.pg-btn{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;min-width:36px;font-size:.82rem;color:var(--muted);cursor:pointer;font-family:'DM Sans',sans-serif;transition:var(--transition);display:flex;align-items:center;justify-content:center;font-weight:500;box-shadow:var(--shadow-sm)}
.pg-btn:hover:not(:disabled){border-color:var(--gold);color:var(--text);box-shadow:var(--shadow-md);transform:translateY(-2px)}
.pg-btn.active{background:var(--gold);border-color:var(--gold);color:#0d1117;font-weight:700;box-shadow:0 6px 20px rgba(201,168,76,0.22)}
.pg-btn:disabled{opacity:.35;cursor:not-allowed}
.pg-ellipsis{color:var(--muted);font-size:.82rem;padding:0 2px}
.page-footer{width:100%;padding:10px 16px;background:transparent;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;color:#8fa3c8;font-size:clamp(.8rem,1.8vw,.9rem);text-align:center}
.page-footer-label{color:#93a7cb}
.page-footer-sep{color:rgba(141,162,201,.5)}
.page-footer strong{color:var(--gold-light);font-weight:600}
.page-footer-link{color:var(--gold-light);font-weight:600;text-decoration:none}
.page-footer-link:hover{text-decoration:underline}
.no-results{grid-column:1/-1;text-align:center;padding:70px 20px;color:var(--muted)}
.no-results svg{opacity:.3;margin-bottom:14px}
.modal-overlay{display:none;position:fixed;inset:0;background:radial-gradient(circle at 20% 20%,rgba(29,59,120,.42),rgba(6,9,16,.9) 52%),rgba(6,9,16,.9);backdrop-filter:blur(10px);z-index:1000;align-items:center;justify-content:center;padding:20px}
.modal-overlay.open{display:flex;animation:fadeInBlur .3s ease}
@keyframes fadeInBlur{from{opacity:0;backdrop-filter:blur(0px)}to{opacity:1;backdrop-filter:blur(10px)}}
.modal-shell{width:100%;max-width:470px;display:grid;grid-template-columns:minmax(0,360px) auto;align-items:center;justify-content:center;column-gap:12px;animation:slideUp .35s cubic-bezier(0.34, 1.56, 0.64, 1)}
@keyframes slideUp{from{transform:translateY(40px) scale(0.95);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
.card-top-band{height:8px;background:linear-gradient(90deg,#b9932f 0%,#e5c45b 50%,#b9932f 100%)}
#idCard{width:min(360px,100%);margin:0 auto;min-height:540px;display:flex;flex-direction:column;background:linear-gradient(162deg,#1d2f68 0%,#15295a 34%,#0a1a3a 68%,#08142f 100%);border-radius:22px;border:1px solid rgba(184,152,56,.35);box-shadow:0 24px 72px rgba(2,7,20,.72),0 0 0 1px rgba(79,209,255,.1) inset,0 0 40px rgba(58,123,213,0.08);position:relative;overflow:hidden}
#idCard::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px);background-size:42px 42px;opacity:.5;pointer-events:none}
#idCard::after{content:'';position:absolute;width:180px;height:180px;right:-64px;top:-62px;background:radial-gradient(circle,rgba(79,209,255,.18) 0%,rgba(79,209,255,0) 70%);pointer-events:none}
.id-event-top{position:relative;z-index:1;display:grid;grid-template-columns:76px 1fr 76px;align-items:center;gap:8px;padding:16px 18px 8px}
.id-logo{width:58px;height:58px;border-radius:50%;object-fit:contain;object-position:center;display:block;background:linear-gradient(135deg,rgba(13,30,69,.8),rgba(8,20,45,.9));box-shadow:0 8px 22px rgba(0,0,0,.35),0 0 0 2px rgba(255,255,255,.14),inset 0 1px 2px rgba(255,255,255,.15);border:1px solid rgba(79,209,255,.15);padding:4px;transition:all 0.3s ease}
.id-logo:hover{box-shadow:0 12px 28px rgba(0,0,0,.4),0 0 0 2px rgba(79,209,255,.3),inset 0 1px 2px rgba(255,255,255,.2);transform:scale(1.05)}
.id-logo-right{justify-self:end}
.id-event-title{text-align:center;max-width:180px;justify-self:center}
.id-event-sub{margin-top:2px;font-family:'DM Sans',sans-serif;font-size:.68rem;letter-spacing:.03em;color:#8ea2cc;font-weight:500;line-height:1.25}
.id-photo-stage{position:relative;z-index:1;margin-top:10px;display:flex;justify-content:center}
.id-photo-wrap{position:relative;width:118px;height:118px;border-radius:50%;padding:4px;border:1px solid rgba(255,255,255,.26);box-shadow:0 12px 28px rgba(4,10,26,.45),0 0 0 1px rgba(79,209,255,.18) inset;background:linear-gradient(155deg,rgba(28,55,110,.9),rgba(17,34,76,.88));backdrop-filter:blur(3px)}
.id-photo-wrap::after{content:'';position:absolute;inset:0;border-radius:50%;background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,0) 32%);pointer-events:none}
#idCardPhoto{width:100%;height:100%;object-fit:cover;object-position:center top;border-radius:50%;border:1px solid rgba(255,255,255,.2);display:block;background:#1c2a3a}
.id-photo-placeholder{width:100%;height:100%;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:radial-gradient(circle at 40% 30%,#1a326f 0%,#10234f 70%,#0a1733 100%);display:flex;align-items:center;justify-content:center;color:#2f4a87}
.id-name{position:relative;z-index:1;text-align:center;margin-top:6px;font-family:'DM Sans',sans-serif;font-size:clamp(.96rem,3.2vw,1.28rem);font-weight:700;color:#f5f8ff;line-height:1.12;padding:0 28px;text-shadow:0 2px 10px rgba(0,0,0,.32);letter-spacing:.005em}
.id-designation{position:relative;z-index:1;text-align:center;margin-top:5px;font-size:.8rem;color:#a5b9df;padding:0 28px}
.id-org-name{position:relative;z-index:1;text-align:center;margin-top:2px;font-size:.76rem;color:#7f94be;min-height:20px;padding:0 28px}
.id-badges{position:relative;z-index:1;display:flex;justify-content:center;gap:6px;margin-top:10px;flex-wrap:wrap;padding:0 18px;align-items:center}
.id-badge{font-size:.65rem;font-weight:700;letter-spacing:.09em;padding:8px;border-radius:7px;backdrop-filter:blur(3px);display:inline-flex;align-items:center;line-height:1}
#idCard sup{font-size:.62em;line-height:0;position:relative;top:-.45em;margin-left:1px}
.id-badge-id{background:rgba(201,168,76,.18);color:#e8cf75;border:1px solid rgba(201,168,76,.35)}
.id-badge-series{background:rgba(58,123,213,.2);color:#7fb6ff;border:1px solid rgba(58,123,213,.4)}
.id-badge-batch{background:rgba(22,223,140,.14);color:#7be7b6;border:1px solid rgba(22,223,140,.35)}
.id-badge-status{background:rgba(160,174,208,.14);color:#d3dcf0;border:1px solid rgba(160,174,208,.3)}
.id-details-shell{position:relative;z-index:1;margin:11px 14px 12px;background:linear-gradient(160deg,rgba(14,34,75,.45),rgba(10,25,57,.44));border:1px solid rgba(255,255,255,.2);border-radius:12px;backdrop-filter:blur(4px);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 8px 22px rgba(5,10,22,.24)}
.id-details{padding:9px 10px;display:grid;gap:5px}
.id-row{display:grid;grid-template-columns:108px 1fr;align-items:center;gap:7px;border-bottom:1px solid rgba(255,255,255,.055);padding-bottom:4px}
.id-row:last-child{border-bottom:none;padding-bottom:0}
.id-row-label{font-size:.6rem;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#637ca9}
.id-row-value{font-size:.76rem;font-weight:700;color:#dde8ff;line-height:1.24;word-break:break-word;text-align:right;font-variant-numeric:tabular-nums}
.id-row-value.empty{color:#7086af;font-style:italic}
.id-row-value a{color:#7fb6ff;text-decoration:none}
.id-row-value a:hover{text-decoration:underline;color:#9dccff}
.id-bottom-strip{position:relative;z-index:1;margin-top:auto;background:linear-gradient(90deg,rgba(8,18,44,.88),rgba(16,38,88,.82),rgba(8,18,44,.88));height:44px;padding:0 12px;display:flex;align-items:center;justify-content:center;border-top:1px solid rgba(185,158,75,.24)}
.id-bottom-text{font-size:.55rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6480b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;width:100%}
.modal-actions{display:flex;flex-direction:column;gap:10px;justify-self:start;align-self:center;z-index:3}
.btn{font-family:'DM Sans',sans-serif;font-size:.82rem;font-weight:600;width:58px;height:58px;border-radius:16px;cursor:pointer;transition:var(--transition);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;box-shadow:var(--shadow-md)}
.btn:active{transform:scale(0.95)}
.btn .material-symbols-outlined{font-size:22px;line-height:1;transition:var(--transition)}
.btn .btn-text{font-size:.62rem;letter-spacing:.04em;transition:var(--transition)}
.btn-close{background:linear-gradient(180deg,rgba(32,40,60,.94),rgba(20,27,43,.95));border:1px solid rgba(125,140,178,.3);color:#9fb2d9;box-shadow:var(--shadow-md)}
.btn-close:hover{border-color:var(--red);color:var(--red);box-shadow:0 12px 30px rgba(224,82,82,0.2)}
.btn-download{background:linear-gradient(180deg,rgba(201,168,76,.22),rgba(138,110,47,.18));border:1px solid rgba(201,168,76,.4);color:var(--gold-light);box-shadow:var(--shadow-md),0 0 0 1px rgba(201,168,76,.08) inset;position:relative;overflow:hidden}
.btn-download::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0),rgba(255,255,255,0.08),rgba(255,255,255,0));opacity:0;transition:opacity .3s}
.btn-download:hover:not(:disabled){background:linear-gradient(180deg,rgba(201,168,76,.38),rgba(138,110,47,.3));border-color:var(--gold);color:#fff;box-shadow:var(--shadow-lg),0 0 0 1px rgba(201,168,76,.08) inset,0 0 30px rgba(201,168,76,0.15);transform:translateY(-2px)}
.btn-download:hover:not(:disabled)::before{opacity:1}
.btn-download:disabled{opacity:.55;cursor:not-allowed}
.btn-download .dl-spinner{width:18px;height:18px;border:2px solid rgba(201,168,76,.3);border-top-color:var(--gold-light);border-radius:50%;animation:spin .7s linear infinite;display:none}
.btn-download.loading .dl-spinner{display:block}
.btn-download.loading .dl-icon,.btn-download.loading .btn-text{display:none}
.loading-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:280px;gap:14px}
.spinner{width:38px;height:38px;border:3px solid var(--border);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;transition:background 0.3s}
::-webkit-scrollbar-thumb:hover{background:var(--gold-dim)}
@media(max-width:1200px){.filter-row,.grid-container,.pagination-wrap{padding-left:24px;padding-right:24px}.grid-container{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}}
@media(max-width:992px){.filter-row,.grid-container,.pagination-wrap{padding-left:18px;padding-right:18px}.grid-container{gap:14px;grid-template-columns:repeat(auto-fill,minmax(205px,1fr))}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important;scroll-behavior:auto !important}}
@media(max-width:768px){
  :root{--card-photo-h:180px}
  body{overflow-x:hidden}
  .series-toggle{width:30px;height:30px}
  .series-toggle .material-symbols-outlined{font-size:19px}
  .chip{font-size:.72rem;padding:4px 10px}
  .filter-row{padding:9px 14px}
  .org-select{font-size:.8rem}
  .grid-container{padding:14px;gap:12px;grid-template-columns:1fr}
  .pagination-wrap{padding:14px 14px 24px}
  .pg-btn{min-width:34px;padding:6px 10px}
  .page-footer{width:calc(100% - 28px);margin:16px auto 14px;padding:9px 12px;gap:6px}
  .modal-shell{max-width:100%;display:flex;flex-direction:column;gap:10px}
  #idCard{width:min(332px,100%);min-height:470px}
  .id-event-top{grid-template-columns:60px 1fr 60px;padding:14px 14px 4px}
  .id-logo{width:46px;height:46px}
  .id-photo-wrap{width:102px;height:102px}
  .id-name{font-size:1.1rem;padding:0 12px;margin-top:4px}
  .id-designation,.id-org-name{padding:0 16px}
  .id-badges{margin-top:11px}
  .id-badge{font-size:.6rem}
  .id-details-shell{margin:14px 14px 16px}
  .id-row{grid-template-columns:98px 1fr}
  .id-row-label{font-size:.62rem;letter-spacing:.16em}
  .id-row-value{font-size:.74rem}
  .modal-actions{flex-direction:row;justify-content:center;width:100%}
  .btn{width:auto;height:42px;border-radius:10px;flex-direction:row;padding:0 14px;gap:6px}
  .btn .btn-text{font-size:.74rem}
}
@media(max-width:420px){
  .filter-row{padding:8px 12px}
  .grid-container{padding:12px}
  .chip{font-size:.7rem;padding:4px 9px}
  .modal-overlay{padding:12px}
  #idCard{width:100%;min-height:458px;border-radius:18px}
}
`;
