'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [members, setMembers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('members');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adminPage, setAdminPage] = useState(1);
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const [editMember, setEditMember] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ Name: '', Email: '', Mobile: '', ID: '', Blood: '', Designation: '', Organization: '', Location: '', photo: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // ── Bulk delete state ───────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ── Bulk upload state ───────────────────────────────────────────────────────
  const [bulkExcel, setBulkExcel] = useState(null);
  const [bulkZip,   setBulkZip]   = useState(null);
  const [bulkExcelPreview, setBulkExcelPreview] = useState(null);
  const [bulkZipPreview, setBulkZipPreview] = useState(null);
  const [bulkDragExcel, setBulkDragExcel] = useState(false);
  const [bulkDragZip,   setBulkDragZip]   = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null); // { added, skipped, errors[] }
  const excelInputRef   = useRef(null);
  const zipInputRef     = useRef(null);
  const selectAllRef    = useRef(null);

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/members');
      if (res.status === 401) { router.push('/admin'); return; }
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch { setMembers([]); }
    setLoading(false);
  }, [router]);

  const loadAnalytics = useCallback(async (page = 1) => {
    try {
      const res = await fetch(`/api/analytics?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch {}
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {}
  }, []);

  useEffect(() => { loadMembers(); loadAnalytics(); loadStats(); }, [loadMembers, loadAnalytics, loadStats]);

  useEffect(() => { loadAnalytics(analyticsPage); }, [analyticsPage, loadAnalytics]);



  const flash = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3500);
  };

  // Upload photo
  const uploadPhoto = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url;
  };

  // Parse Excel file for preview
  const parseExcel = async (file) => {
    try {
      const XLSX = await import('xlsx');
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      setBulkExcelPreview(data.slice(0, 50));
    } catch (err) {
      setBulkExcelPreview(null);
    }
  };

  // Parse ZIP file for preview
  const parseZip = async (file) => {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const loaded = await zip.loadAsync(file);
      const files = [];
      loaded.forEach((path, item) => {
        if (!item.dir && /\.(jpg|jpeg|png|gif|webp)$/i.test(path)) {
          files.push(path);
        }
      });
      setBulkZipPreview(files.slice(0, 50)); // Preview first 50 files
    } catch (err) {
      console.error('ZIP parse error:', err);
      setBulkZipPreview(null);
    }
  };

  // Add member
  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let photoUrl = formData.photo;
      if (photoFile) photoUrl = await uploadPhoto(photoFile);
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, photo: photoUrl }),
      });
      if (res.ok) {
        flash('Member added successfully');
        setShowAddForm(false);
        setFormData({ Name: '', Email: '', Mobile: '', ID: '', Blood: '', Designation: '', Organization: '', Location: '', photo: '' });
        setPhotoFile(null);
        loadMembers();
      } else {
        const err = await res.json();
        flash(err.error || 'Failed to add', 'error');
      }
    } catch (err) { flash(err.message, 'error'); }
    setSaving(false);
  };

  // Edit member
  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let photoUrl = formData.photo;
      if (photoFile) photoUrl = await uploadPhoto(photoFile);
      const res = await fetch(`/api/members/${editMember._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, photo: photoUrl }),
      });
      if (res.ok) {
        flash('Member updated successfully');
        setEditMember(null);
        setPhotoFile(null);
        loadMembers();
      } else {
        const err = await res.json();
        flash(err.error || 'Failed to update', 'error');
      }
    } catch (err) { flash(err.message, 'error'); }
    setSaving(false);
  };

  // Delete member
  const handleDelete = async (id, name) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
      if (res.ok) {
        flash('Member deleted');
        setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
        loadMembers();
      } else flash('Failed to delete', 'error');
    } catch { flash('Delete failed', 'error'); }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} selected member(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    let deleted = 0, failed = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
        if (res.ok) deleted++; else failed++;
      } catch { failed++; }
    }
    setSelectedIds(new Set());
    await loadMembers();
    setBulkDeleting(false);
    if (failed === 0) flash(`${deleted} member(s) deleted`);
    else flash(`${deleted} deleted, ${failed} failed`, 'error');
  };

  // Checkbox toggle (single row)
  const toggleSelect = (id) => setSelectedIds((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  // Toggle visibility
  const toggleVisibility = async (member) => {
    try {
      const res = await fetch(`/api/members/${member._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !member.visible }),
      });
      if (res.ok) {
        flash(`${member.Name} is now ${member.visible ? 'hidden' : 'visible'}`);
        loadMembers();
      } else flash('Failed to update visibility', 'error');
    } catch { flash('Update failed', 'error'); }
  };

  // Start editing
  const startEdit = (m) => {
    setEditMember(m);
    setFormData({ Name: m.Name || '', Email: m.Email || '', Mobile: m.Mobile || '', ID: m.ID || '', Blood: m.Blood || '', Designation: m.Designation || '', Organization: m.Organization || '', Location: m.Location || '', photo: m.photo || '' });
    setPhotoFile(null);
    setShowAddForm(false);
  };

  // Start adding
  const startAdd = () => {
    setShowAddForm(true);
    setEditMember(null);
    setFormData({ Name: '', Email: '', Mobile: '', ID: '', Blood: '', Designation: '', Organization: '', Location: '', photo: '' });
    setPhotoFile(null);
  };

  // Filter members
  const filteredMembers = search
    ? members.filter((m) => [m.Name, m.ID, m.Email, m.Organization, m.Location].some((v) => (v || '').toLowerCase().includes(search.toLowerCase())))
    : members;

  // Pagination
  const ADMIN_PER_PAGE = 20;
  const adminTotalPages = Math.max(1, Math.ceil(filteredMembers.length / ADMIN_PER_PAGE));
  const adminSafePage = Math.min(adminPage, adminTotalPages);
  const adminStart = (adminSafePage - 1) * ADMIN_PER_PAGE;
  const pagedMembers = filteredMembers.slice(adminStart, adminStart + ADMIN_PER_PAGE);

  const allPageSelected  = pagedMembers.length > 0 && pagedMembers.every((m) => selectedIds.has(m._id));
  const somePageSelected = pagedMembers.some((m) => selectedIds.has(m._id));
  const toggleSelectAll  = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => { const s = new Set(prev); pagedMembers.forEach((m) => s.delete(m._id)); return s; });
    } else {
      setSelectedIds((prev) => { const s = new Set(prev); pagedMembers.forEach((m) => s.add(m._id)); return s; });
    }
  };

  // Keep the select-all checkbox in indeterminate state when only some rows are checked
  // (placed here so somePageSelected / allPageSelected are already initialized)
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  // Logout
  const handleLogout = async () => {
    document.cookie = 'duet_admin_session=; Path=/; Max-Age=0';
    router.push('/admin');
  };

  // Resolve photo URL (R2; run migrate-photos to upload local paths)
  const getAdminPhotoUrl = (url) => {
    if (!url) return '';
    if (!url.startsWith('http://') && !url.startsWith('https://')) return '';
    if (url.includes('.r2.cloudflarestorage.com')) return `/api/image?url=${encodeURIComponent(url)}`;
    return url;
  };

  // ── Bulk upload handler ───────────────────────────────────────────────────
  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkExcel) { flash('Please select an Excel file', 'error'); return; }
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const fd = new FormData();
      fd.append('excel', bulkExcel);
      if (bulkZip) fd.append('photos', bulkZip);
      const res  = await fetch('/api/bulk-upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { flash(data.error || 'Bulk upload failed', 'error'); }
      else {
        setBulkResult(data);
        if (data.added > 0) { loadMembers(); flash(`✓ ${data.added} member(s) added successfully`); }
        else flash('No new members were added', 'error');
      }
    } catch (err) { flash(err.message, 'error'); }
    setBulkUploading(false);
  };

  const handleBulkReset = () => {
    setBulkExcel(null);
    setBulkZip(null);
    setBulkExcelPreview(null);
    setBulkZipPreview(null);
    setBulkResult(null);
    if (excelInputRef.current) excelInputRef.current.value = '';
    if (zipInputRef.current)   zipInputRef.current.value   = '';
  };

  // Member form component
  const renderForm = (onSubmit, title) => (
    <div className="admin-modal-overlay" onClick={(e) => { if (e.target.className === 'admin-modal-overlay') { setEditMember(null); setShowAddForm(false); } }}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={() => { setEditMember(null); setShowAddForm(false); }}>✕</button>
        </div>
        <form onSubmit={onSubmit} className="member-form">
          <div className="form-grid">
            <div className="form-group"><label>Name *</label><input required value={formData.Name} onChange={(e) => setFormData({ ...formData, Name: e.target.value })} placeholder="Full name" /></div>
            <div className="form-group"><label>Student ID *</label><input required value={formData.ID} onChange={(e) => setFormData({ ...formData, ID: e.target.value })} placeholder="e.g. 99406" /></div>
            <div className="form-group"><label>Email</label><input type="email" value={formData.Email} onChange={(e) => setFormData({ ...formData, Email: e.target.value })} placeholder="email@example.com" /></div>
            <div className="form-group"><label>Mobile</label><input value={formData.Mobile} onChange={(e) => setFormData({ ...formData, Mobile: e.target.value })} placeholder="01XXXXXXXXX" /></div>
            <div className="form-group"><label>Blood Group</label>
              <select value={formData.Blood} onChange={(e) => setFormData({ ...formData, Blood: e.target.value })}>
                <option value="">Select</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Designation</label><input value={formData.Designation} onChange={(e) => setFormData({ ...formData, Designation: e.target.value })} placeholder="Job title" /></div>
            <div className="form-group full-width"><label>Organization</label><input value={formData.Organization} onChange={(e) => setFormData({ ...formData, Organization: e.target.value })} placeholder="Company/Institution" /></div>
            <div className="form-group full-width"><label>Current Location</label><input value={formData.Location} onChange={(e) => setFormData({ ...formData, Location: e.target.value })} placeholder="City, Country" /></div>
            <div className="form-group full-width">
              <label>Photo</label>
              <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0] || null)} />
              {formData.photo && !photoFile && <div className="current-photo-hint">Current: <a href={formData.photo} target="_blank" rel="noopener noreferrer">View photo</a></div>}
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={() => { setEditMember(null); setShowAddForm(false); }}>Cancel</button>
            <button type="submit" className="save-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DASHBOARD_CSS }} />

      {/* Top bar */}
      <div className="admin-topbar">
        <div className="admin-brand">
          <h1>DUET Reunion 2025</h1>
          <span className="admin-tag">Admin</span>
        </div>
        <div className="admin-topbar-actions">
          <a href="/" className="topbar-link">View Site</a>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {/* Flash message */}
      {message.text && <div className={`flash-msg ${message.type}`}>{message.text}</div>}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{members.length}</div><div className="stat-label">Total Members</div></div>
        <div className="stat-card"><div className="stat-num">{analytics?.totalPageViews ?? '—'}</div><div className="stat-label">Page Views (30d)</div></div>
        <div className="stat-card"><div className="stat-num">{analytics?.totalCardViews ?? '—'}</div><div className="stat-label">Card Views (30d)</div></div>
        <div className="stat-card"><div className="stat-num">{analytics?.uniqueVisitors ?? '—'}</div><div className="stat-label">Unique Visitors</div></div>
        <div className="stat-card"><div className="stat-num">{stats?.database.totalRecords ?? '—'}</div><div className="stat-label">Database Records</div></div>
        <div className="stat-card"><div className="stat-num">{stats?.storage.r2Objects ?? '—'}</div><div className="stat-label">R2 Photos</div></div>
        <div className="stat-card"><div className="stat-num">{stats?.storage.r2StorageFormatted ?? '—'}</div><div className="stat-label">Storage Used</div></div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>Members</button>
        <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Visitor Analytics</button>
        <button className={`tab-btn ${activeTab === 'bulk' ? 'active' : ''}`} onClick={() => setActiveTab('bulk')}>📤 Bulk Upload</button>
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="admin-section">
          <div className="section-header">
            <input className="admin-search" type="text" placeholder="Search members…" value={search} onChange={(e) => { setSearch(e.target.value); setAdminPage(1); setSelectedIds(new Set()); }} />
            <button className="add-btn" onClick={startAdd}>+ Add Member</button>
            {selectedIds.size > 0 && (
              <button className="bulk-delete-btn" onClick={handleBulkDelete} disabled={bulkDeleting}>
                {bulkDeleting
                  ? <><span className="btn-spinner" />Deleting…</>
                  : <>🗑 Delete {selectedIds.size} Selected</>}
              </button>
            )}
          </div>
          {loading ? (
            <div className="admin-loading"><div className="spinner"></div></div>
          ) : (
            <div className="table-wrap">
              <table className="member-table">
                <thead>
                  <tr>
                    <th className="cb-col">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="row-cb"
                        checked={allPageSelected}
                        onChange={toggleSelectAll}
                        title="Select / deselect all on this page"
                      />
                    </th>
                    <th>Photo</th>
                    <th>Name</th>
                    <th>ID</th>
                    <th>Email</th>
                    <th>Mobile</th>
                    <th>Organization</th>
                    <th>Location</th>
                    <th>Blood</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedMembers.length === 0 ? (
                    <tr><td colSpan="10" className="empty-row">No members found</td></tr>
                  ) : pagedMembers.map((m) => (
                    <tr key={m._id} className={[
                      m.visible === false ? 'hidden-row' : '',
                      selectedIds.has(m._id) ? 'selected-row' : ''
                    ].join(' ').trim()}>
                      <td className="cb-col">
                        <input
                          type="checkbox"
                          className="row-cb"
                          checked={selectedIds.has(m._id)}
                          onChange={() => toggleSelect(m._id)}
                        />
                      </td>
                      <td>
                        {m.photo
                          ? <img
                              src={getAdminPhotoUrl(m.photo)}
                              alt={m.Name}
                              className="table-photo"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          : null}
                        <div
                          className="table-photo-placeholder"
                          style={{ display: m.photo ? 'none' : 'flex' }}
                        >👤</div>
                      </td>
                      <td className="name-cell">{m.Name}{m.visible === false && <span className="hidden-tag">HIDDEN</span>}</td>
                      <td><span className="id-badge-sm">{m.ID}</span></td>
                      <td className="email-cell">{m.Email}</td>
                      <td>{m.Mobile}</td>
                      <td className="org-cell">{m.Organization}</td>
                      <td className="org-cell">{m.Location || '—'}</td>
                      <td><span className="blood-sm">{m.Blood || '—'}</span></td>
                      <td>
                        <div className="action-btns">
                          <button className={`vis-btn ${m.visible === false ? 'off' : ''}`} onClick={() => toggleVisibility(m)} title={m.visible === false ? 'Show to visitors' : 'Hide from visitors'}>{m.visible === false ? '👁‍🗨' : '👁'}</button>
                          <button className="edit-btn" onClick={() => startEdit(m)} title="Edit">✎</button>
                          <button className="delete-btn" onClick={() => handleDelete(m._id, m.Name)} title="Delete">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Admin Pagination */}
          {!loading && adminTotalPages > 1 && (
            <div className="admin-pagination">
              <span className="admin-page-info">Showing {adminStart + 1}–{Math.min(adminStart + ADMIN_PER_PAGE, filteredMembers.length)} of {filteredMembers.length}</span>
              <div className="admin-page-btns">
                <button className="apg-btn" disabled={adminSafePage === 1} onClick={() => setAdminPage(adminSafePage - 1)}>‹ Prev</button>
                {Array.from({ length: Math.min(adminTotalPages, 7) }, (_, i) => {
                  let pg;
                  if (adminTotalPages <= 7) pg = i + 1;
                  else if (adminSafePage <= 4) pg = i + 1;
                  else if (adminSafePage >= adminTotalPages - 3) pg = adminTotalPages - 6 + i;
                  else pg = adminSafePage - 3 + i;
                  return (
                    <button key={pg} className={`apg-btn ${pg === adminSafePage ? 'active' : ''}`} onClick={() => setAdminPage(pg)}>{pg}</button>
                  );
                })}
                <button className="apg-btn" disabled={adminSafePage === adminTotalPages} onClick={() => setAdminPage(adminSafePage + 1)}>Next ›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Upload Tab */}
      {activeTab === 'bulk' && (
        <div className="admin-section">
          <div className="bulk-header">
            <div>
              <h2 className="bulk-title">Bulk Upload Members</h2>
              <p className="bulk-subtitle">Upload an Excel spreadsheet alongside a ZIP of profile photos to add multiple members at once.</p>
            </div>
          </div>

          <form onSubmit={handleBulkUpload} className="bulk-form">
            {/* Excel drop zone */}
            <div
              className={`drop-zone ${bulkDragExcel ? 'drag-over' : ''} ${bulkExcel ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setBulkDragExcel(true); }}
              onDragLeave={() => setBulkDragExcel(false)}
              onDrop={(e) => { e.preventDefault(); setBulkDragExcel(false); const f = e.dataTransfer.files[0]; if (f) { setBulkExcel(f); parseExcel(f); } }}
              onClick={() => excelInputRef.current?.click()}
            >
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files[0]; setBulkExcel(f); if (f) parseExcel(f); }}
              />
              <div className="drop-icon"><span className="material-symbols-outlined">description</span></div>
              {bulkExcel ? (
                <div className="drop-file-name">{bulkExcel.name} <span className="file-size">({(bulkExcel.size / 1024).toFixed(1)} KB)</span></div>
              ) : (
                <>
                  <div className="drop-label">Drop Excel file here</div>
                  <div className="drop-hint">or click to browse · .xlsx · .xls · .csv</div>
                </>
              )}
            </div>

            {/* ZIP drop zone */}
            <div
              className={`drop-zone ${bulkDragZip ? 'drag-over' : ''} ${bulkZip ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setBulkDragZip(true); }}
              onDragLeave={() => setBulkDragZip(false)}
              onDrop={(e) => { e.preventDefault(); setBulkDragZip(false); const f = e.dataTransfer.files[0]; if (f) { setBulkZip(f); parseZip(f); } }}
              onClick={() => zipInputRef.current?.click()}
            >
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files[0]; setBulkZip(f); if (f) parseZip(f); }}
              />
              <div className="drop-icon"><span className="material-symbols-outlined">image</span></div>
              {bulkZip ? (
                <div className="drop-file-name">{bulkZip.name} <span className="file-size">({(bulkZip.size / 1024).toFixed(1)} KB)</span></div>
              ) : (
                <>
                  <div className="drop-label">Drop Photos ZIP here <span className="optional-tag">optional</span></div>
                  <div className="drop-hint">or click to browse · .zip containing member photos</div>
                </>
              )}
            </div>

            {/* Excel preview */}
            {bulkExcelPreview && bulkExcelPreview.length > 0 && (
              <div className="preview-section">
                <div className="preview-header"><span className="material-symbols-outlined" style={{fontSize: '16px', marginRight: '6px'}}>description</span>Your Excel Data Preview ({bulkExcelPreview.length} rows)</div>
                <div className="sample-table-wrap">
                  <table className="sample-table">
                    <thead>
                      <tr>
                        {Object.keys(bulkExcelPreview[0] || {}).map(k => <th key={k}>{k}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {bulkExcelPreview.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((v, j) => <td key={j}>{String(v || '')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ZIP preview */}
            {bulkZipPreview && bulkZipPreview.length > 0 && (
              <div className="preview-section">
                <div className="preview-header"><span className="material-symbols-outlined" style={{fontSize: '16px', marginRight: '6px'}}>image</span>Photos in ZIP ({bulkZipPreview.length} files)</div>
                <div className="zip-files-list">
                  {bulkZipPreview.map((f, i) => (
                    <div key={i} className="zip-file-item">{f}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="bulk-actions">
              <button type="submit" className="save-btn" disabled={bulkUploading || !bulkExcel}>
                {bulkUploading ? <><span className="btn-spinner" />Uploading…</> : '📤 Upload Members'}
              </button>
              {(bulkExcel || bulkZip) && !bulkUploading && (
                <button type="button" className="cancel-btn" onClick={handleBulkReset}>Clear</button>
              )}
            </div>
          </form>

          {/* Result panel */}
          {bulkResult && (
            <div className="bulk-result">
              <div className="bulk-result-grid">
                <div className="result-card success">
                  <div className="result-num">{bulkResult.added}</div>
                  <div className="result-lbl">Members Added</div>
                </div>
                <div className="result-card warn">
                  <div className="result-num">{bulkResult.skipped}</div>
                  <div className="result-lbl">Rows Skipped</div>
                </div>
                <div className="result-card err">
                  <div className="result-num">{bulkResult.errors?.length ?? 0}</div>
                  <div className="result-lbl">Errors</div>
                </div>
              </div>
              {bulkResult.errors?.length > 0 && (
                <div className="error-list">
                  <div className="error-list-title">⚠️ Issues encountered:</div>
                  {bulkResult.errors.map((e, i) => <div key={i} className="error-item">{e}</div>)}
                </div>
              )}
            </div>
          )}

          {/* ── EXAMPLE SECTION ── */}
          <div className="example-section">
            <h3 className="example-title">📁 Required File Structure</h3>
            <p className="example-desc">Your Excel file should match the column headers below (names are flexible). Photos should be in a ZIP with filenames matching the <code>Photo</code> column.</p>

            <div className="example-two-col">
              {/* Folder structure */}
              <div className="example-box">
                <div className="example-box-header">📂 Folder / ZIP structure</div>
                <div className="folder-tree">
                  <div className="tree-row"><span className="tree-folder">📁 upload_package/</span></div>
                  <div className="tree-row indent1"><span className="tree-file"><span className="material-symbols-outlined" style={{fontSize: '14px', marginRight: '4px', verticalAlign: 'middle'}}>description</span>members.xlsx</span></div>
                  <div className="tree-row indent1"><span className="tree-folder">📁 photos.zip</span></div>
                  <div className="tree-row indent2"><span className="tree-file">🖼 99406.jpg</span></div>
                  <div className="tree-row indent2"><span className="tree-file">🖼 99502.png</span></div>
                  <div className="tree-row indent2"><span className="tree-file">🖼 00101.jpg</span></div>
                  <div className="tree-row indent2"><span className="tree-file muted">…</span></div>
                </div>
                <div className="example-note">🗒 The ZIP can also be placed directly inside the same folder as the Excel — just select it separately in the uploader.</div>
              </div>

              {/* Column reference */}
              <div className="example-box">
                <div className="example-box-header">📋 Excel column reference</div>
                <table className="col-table">
                  <thead><tr><th>Column</th><th>Required</th><th>Example value</th></tr></thead>
                  <tbody>
                    {[
                      ['Name',         '✅ Yes', 'Md. Rahim Uddin'],
                      ['ID',           '✅ Yes', '99406'],
                      ['Email',        'Optional', 'rahim@example.com'],
                      ['Mobile',       'Optional', '01711234567'],
                      ['Blood',        'Optional', 'B+'],
                      ['Designation',  'Optional', 'Sr. Engineer'],
                      ['Organization', 'Optional', 'DUET'],
                      ['Location',     'Optional', 'Dhaka, Bangladesh'],
                      ['Photo',        'Optional', '99406.jpg'],
                    ].map(([col, req, ex]) => (
                      <tr key={col}>
                        <td><code className="col-name">{col}</code></td>
                        <td><span className={req.startsWith('✅') ? 'req-yes' : 'req-opt'}>{req}</span></td>
                        <td className="ex-val">{ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sample Excel preview */}
            <div className="example-box mt-12">
              <div className="example-box-header"><span className="material-symbols-outlined" style={{fontSize: '14px', marginRight: '4px', verticalAlign: 'middle'}}>description</span>Sample Excel Format (All Required Columns)</div>
              <div className="sample-table-wrap">
                <table className="sample-table">
                  <thead>
                    <tr>{['Name','ID','Email','Mobile','Blood','Designation','Organization','Location','Photo'].map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Md. Rahim Uddin</td><td>99406</td><td>rahim@example.com</td>
                      <td>01711234567</td><td>B+</td><td>Sr. Engineer</td>
                      <td>Bangladesh Power Dev. Board</td><td>Dhaka, BD</td><td>99406.jpg</td>
                    </tr>
                    <tr>
                      <td>Nasrin Akter</td><td>99502</td><td>nasrin@example.com</td>
                      <td>01811234567</td><td>A+</td><td>Lecturer</td>
                      <td>DUET</td><td>Gazipur, BD</td><td>99502.png</td>
                    </tr>
                    <tr>
                      <td>Karim Hossain</td><td>00101</td><td></td>
                      <td>01911234567</td><td>O+</td><td>Project Manager</td>
                      <td>Samsung R&amp;D BD</td><td>Dhaka, BD</td><td>00101.jpg</td>
                    </tr>
                    <tr>
                      <td>Nadia Islam</td><td>99301</td><td>nadia@example.com</td>
                      <td>01621234567</td><td>AB+</td><td>Architect</td>
                      <td>Grameenphone Ltd</td><td>Dhaka, BD</td><td>99301.jpg</td>
                    </tr>
                    <tr>
                      <td>Hassan Ahmed</td><td>00205</td><td>hassan@example.com</td>
                      <td>01731234567</td><td>B-</td><td>Consultant</td>
                      <td>McKinsey &amp; Company</td><td>Dhaka, BD</td><td>00205.jpg</td>
                    </tr>
                    <tr>
                      <td>Faria Zahra</td><td>99410</td><td>faria@example.com</td>
                      <td>01741234567</td><td>A-</td><td>Manager</td>
                      <td>Brac Bank</td><td>Dhaka, BD</td><td>99410.png</td>
                    </tr>
                    <tr>
                      <td>Reza Khan</td><td>99215</td><td>reza@example.com</td>
                      <td>01751234567</td><td>O+</td><td>Director</td>
                      <td>Robi Axiata Ltd</td><td>Dhaka, BD</td><td>99215.jpg</td>
                    </tr>
                    <tr>
                      <td>Sophia Ahmed</td><td>00312</td><td></td>
                      <td>01761234567</td><td>AB-</td><td>Analyst</td>
                      <td>Standard Chartered Bank</td><td>Dhaka, BD</td><td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="example-note">🗒 Column header names are flexible — e.g. "Student ID", "Full Name", "Company" all work. Leave the Photo cell blank for members without a photo.</div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="admin-section">
          {!analytics ? (
            <div className="admin-loading"><div className="spinner"></div></div>
          ) : (
            <>
              {/* Views over time */}
              {analytics.viewsOverTime && analytics.viewsOverTime.length > 0 && (
                <div className="analytics-block">
                  <h3>📈 Views Over Time (Last 30 Days)</h3>
                  <div className="chart-container">
                    <div className="mini-chart">
                      {analytics.viewsOverTime.map((day, i) => {
                        const maxViews = Math.max(...analytics.viewsOverTime.map(d => d.total));
                        const height = maxViews > 0 ? (day.total / maxViews) * 100 : 0;
                        return (
                          <div key={i} className="chart-bar" title={`${new Date(day.date).toLocaleDateString()}: ${day.total} (${day.pageViews} page, ${day.cardViews} card)`}>
                            <div className="bar-fill" style={{height: height + '%'}}></div>
                            <div className="bar-label">{new Date(day.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Country distribution */}
              {analytics.countryDist && analytics.countryDist.length > 0 && (
                <div className="analytics-block">
                  <h3>🌍 Visitors by Country</h3>
                  <div className="country-chart">
                    {analytics.countryDist.map((country, i) => {
                      const maxCount = Math.max(...analytics.countryDist.map(c => c.count));
                      const percentage = maxCount > 0 ? (country.count / maxCount) * 100 : 0;
                      return (
                        <div key={i} className="country-row">
                          <div className="country-name">{country.country}</div>
                          <div className="country-bar-wrapper">
                            <div className="country-bar" style={{width: percentage + '%'}}></div>
                            <div className="country-count">{country.count}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Storage & Operations */}
              {stats && (
                <div className="analytics-block">
                  <h3>💾 Storage & Operations</h3>
                  <div className="storage-grid">
                    <div className="storage-card">
                      <div className="storage-icon"><span className="material-symbols-outlined">storage</span></div>
                      <div className="storage-label">Database Records</div>
                      <div className="storage-value">{stats.database.totalRecords.toLocaleString()}</div>
                      <div className="storage-details">
                        <div>{stats.database.members.toLocaleString()} members</div>
                        <div>{stats.database.analyticsRecords.toLocaleString()} analytics</div>
                      </div>
                    </div>
                    <div className="storage-card">
                      <div className="storage-icon"><span className="material-symbols-outlined">image</span></div>
                      <div className="storage-label">Photos in R2</div>
                      <div className="storage-value">{stats.storage.r2Objects.toLocaleString()}</div>
                      <div className="storage-details">
                        <div>{stats.storage.r2StorageFormatted} used</div>
                        <div>{stats.storage.r2Objects > 0 ? (stats.storage.r2StorageBytes / stats.storage.r2Objects / 1024).toFixed(1) : '0'} KB per file avg</div>
                      </div>
                    </div>
                    <div className="storage-card">
                      <div className="storage-icon"><span className="material-symbols-outlined">settings</span></div>
                      <div className="storage-label">Total Operations</div>
                      <div className="storage-value">{(stats.database.totalRecords + stats.storage.r2Objects).toLocaleString()}</div>
                      <div className="storage-details">
                        <div>Database: {stats.database.totalRecords.toLocaleString()}</div>
                        <div>Storage: {stats.storage.r2Objects.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Top viewed members */}
              <div className="analytics-block">
                <h3>Most Viewed Members</h3>
                <div className="table-wrap">
                  <table className="member-table compact">
                    <thead><tr><th>#</th><th>Member</th><th>Views</th></tr></thead>
                    <tbody>
                      {(analytics.topMembers || []).map((m, i) => (
                        <tr key={m._id || i}><td>{i + 1}</td><td>{m.name || m._id}</td><td><span className="view-count">{m.views}</span></td></tr>
                      ))}
                      {(!analytics.topMembers || analytics.topMembers.length === 0) && <tr><td colSpan="3" className="empty-row">No data yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent visitors */}
              <div className="analytics-block">
                <h3>Recent Visitors</h3>
                <div className="table-wrap">
                  <table className="member-table compact">
                    <thead><tr><th>Time</th><th>Type</th><th>Member</th><th>IP</th><th>Country</th><th>City</th></tr></thead>
                    <tbody>
                      {(analytics.recentVisitors || []).map((v, i) => (
                        <tr key={v._id || i}>
                          <td className="time-cell">{new Date(v.timestamp).toLocaleString()}</td>
                          <td><span className={`type-badge ${v.type}`}>{v.type === 'page_view' ? 'Page' : 'Card'}</span></td>
                          <td>{v.memberName || '—'}</td>
                          <td className="ip-cell" title={v.ip || 'No IP'}>{v.ip && v.ip.includes('.') ? v.ip.split('.').slice(0, 3).join('.') + '.*' : (v.ip ? v.ip : '—')}</td>
                          <td>{v.country || '—'}</td>
                          <td>{v.city || '—'}</td>
                        </tr>
                      ))}
                      {(!analytics.recentVisitors || analytics.recentVisitors.length === 0) && <tr><td colSpan="6" className="empty-row">No visitors yet</td></tr>}
                    </tbody>
                  </table>
                </div>
                {analytics.pagination && (
                  <div className="pagination-controls">
                    <button onClick={() => setAnalyticsPage(1)} disabled={analyticsPage === 1}>First</button>
                    <button onClick={() => setAnalyticsPage(analyticsPage - 1)} disabled={analyticsPage === 1}>Previous</button>
                    <span className="page-info">Page {analyticsPage} of {analytics.pagination.pages} ({analytics.pagination.total} total)</span>
                    <button onClick={() => setAnalyticsPage(analyticsPage + 1)} disabled={analyticsPage >= analytics.pagination.pages}>Next</button>
                    <button onClick={() => setAnalyticsPage(analytics.pagination.pages)} disabled={analyticsPage >= analytics.pagination.pages}>Last</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal forms */}
      {showAddForm && renderForm(handleAdd, 'Add New Member')}
      {editMember && renderForm(handleEdit, `Edit: ${editMember.Name}`)}
    </>
  );
}

const DASHBOARD_CSS = `
/* ── Bulk Delete ─────────────────────────────────────────────────────────── */
.bulk-delete-btn{background:rgba(224,82,82,.15);border:1px solid rgba(224,82,82,.4);color:var(--red);padding:9px 16px;border-radius:10px;font-family:inherit;font-size:.82rem;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.bulk-delete-btn:hover:not(:disabled){background:rgba(224,82,82,.28);border-color:var(--red);box-shadow:0 0 12px rgba(224,82,82,.2)}
.bulk-delete-btn:disabled{opacity:.55;cursor:not-allowed}
.cb-col{width:38px;text-align:center;padding-left:10px!important;padding-right:4px!important}
.row-cb{width:16px;height:16px;cursor:pointer;accent-color:var(--gold);border-radius:4px}
.selected-row{background:rgba(201,168,76,.08)!important}
.selected-row td{border-bottom-color:rgba(201,168,76,.15)!important}
/* ── Bulk Upload ─────────────────────────────────────────────────────────── */
.bulk-header{margin-bottom:22px}
.bulk-title{font-family:'Playfair Display',serif;font-size:1.3rem;color:var(--gold-light);margin-bottom:4px}
.bulk-subtitle{font-size:.82rem;color:var(--muted);line-height:1.5}
.bulk-form{display:flex;flex-direction:column;gap:24px}
.drop-zone{border:2px dashed var(--border);border-radius:14px;padding:30px 20px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:all .2s;background:var(--card);text-align:center}
.drop-zone:hover,.drop-zone.drag-over{border-color:var(--gold-dim);background:rgba(201,168,76,.06)}
.drop-zone.has-file{border-color:var(--emerald);border-style:solid;background:rgba(50,211,153,.06)}
.drop-icon{font-size:2.2rem;line-height:1;display:flex;align-items:center;justify-content:center}
.drop-label{font-size:.9rem;font-weight:600;color:var(--text)}
.drop-hint{font-size:.74rem;color:var(--muted)}
.drop-file-name{font-size:.88rem;font-weight:600;color:var(--emerald)}
.file-size{font-weight:400;color:var(--muted);font-size:.78rem}
.optional-tag{background:rgba(122,132,153,.18);color:var(--muted);font-size:.65rem;font-weight:700;padding:2px 7px;border-radius:10px;vertical-align:middle;margin-left:6px;text-transform:uppercase;letter-spacing:.06em}
.bulk-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.btn-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(0,0,0,.3);border-top-color:#0d1117;border-radius:50%;animation:spin .7s linear infinite;margin-right:8px;vertical-align:middle}
/* Bulk result */
.bulk-result{margin-top:20px}
.bulk-result-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
.result-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center}
.result-card.success{border-color:rgba(50,211,153,.3)}
.result-card.warn{border-color:rgba(201,168,76,.3)}
.result-card.err{border-color:rgba(224,82,82,.3)}
.result-num{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700;line-height:1}
.result-card.success .result-num{color:var(--emerald)}
.result-card.warn .result-num{color:var(--gold)}
.result-card.err .result-num{color:var(--red)}
.result-lbl{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-top:5px}
.error-list{background:rgba(224,82,82,.07);border:1px solid rgba(224,82,82,.2);border-radius:10px;padding:12px 16px;max-height:180px;overflow-y:auto}
.error-list-title{font-size:.78rem;font-weight:700;color:var(--red);margin-bottom:8px}
.error-item{font-size:.76rem;color:var(--muted);padding:3px 0;border-bottom:1px solid rgba(42,50,69,.3)}
.error-item:last-child{border-bottom:none}
/* Example section */
.example-section{margin-top:36px;border-top:1px solid var(--border);padding-top:28px}
.example-title{font-family:'Playfair Display',serif;font-size:1.05rem;color:var(--gold-light);margin-bottom:8px}
.example-desc{font-size:.8rem;color:var(--muted);margin-bottom:18px;line-height:1.6}
.example-desc code{background:rgba(201,168,76,.12);color:var(--gold);padding:1px 5px;border-radius:4px;font-size:.8em}
.example-two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:700px){.example-two-col{grid-template-columns:1fr}}
.example-box{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.mt-12{margin-top:14px}
.example-box-header{background:var(--surface);padding:10px 16px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);border-bottom:1px solid var(--border)}
.example-note{font-size:.74rem;color:var(--muted);padding:10px 16px;border-top:1px solid var(--border);line-height:1.5}
/* Folder tree */
.folder-tree{padding:16px;font-size:.82rem;font-family:monospace;line-height:1.8}
.tree-row{display:flex;align-items:center}
.indent1{padding-left:20px}
.indent2{padding-left:40px}
.tree-folder{color:var(--gold)}
.tree-file{color:var(--text)}
.muted{color:var(--muted)}
/* Column table */
.col-table{width:100%;border-collapse:collapse;font-size:.78rem}
.col-table th{background:var(--surface);color:var(--muted);font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)}
.col-table td{padding:7px 12px;border-bottom:1px solid rgba(42,50,69,.4)}
.col-table tbody tr:last-child td{border-bottom:none}
.col-name{background:rgba(201,168,76,.1);color:var(--gold);padding:1px 6px;border-radius:4px;font-size:.85em}
.req-yes{color:var(--emerald);font-size:.75rem;font-weight:700}
.req-opt{color:var(--muted);font-size:.75rem}
.ex-val{color:var(--muted);font-size:.76rem}
/* Sample table */
.sample-table-wrap{overflow-x:auto;padding:12px}
.sample-table{border-collapse:collapse;font-size:.74rem;white-space:nowrap;width:100%}
.sample-table th{background:rgba(201,168,76,.1);color:var(--gold);padding:6px 10px;text-align:left;font-weight:700;border:1px solid var(--border)}
.sample-table td{padding:5px 10px;border:1px solid rgba(42,50,69,.5);color:var(--text)}
.sample-table tbody tr:nth-child(even){background:rgba(255,255,255,.02)}
/* Preview sections */
.preview-section{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-top:16px}
.preview-header{background:var(--surface);padding:10px 16px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);border-bottom:1px solid var(--border)}
.zip-files-list{padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;max-height:300px;overflow-y:auto}
.zip-file-item{background:rgba(50,211,153,.08);border:1px solid rgba(50,211,153,.2);border-radius:8px;padding:8px 10px;font-size:.75rem;color:var(--emerald);word-break:break-word}
:root{--bg:#0d1117;--surface:#161b22;--card:#1c2230;--border:#2a3245;--gold:#c9a84c;--gold-dim:#8a6e2f;--gold-light:#e8c96a;--text:#e8eaf0;--muted:#7a8499;--accent:#3a7bd5;--red:#e05252;--emerald:#32d399}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh}
.material-symbols-outlined{font-variation-settings:'FILL' 0,'wght' 500,'GRAD' 0,'opsz' 24;font-family:'Material Symbols Outlined';display:inline-flex;align-items:center;justify-content:center;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}

/* Topbar */
.admin-topbar{background:linear-gradient(135deg,#0d1117 0%,#1a2235 60%,#0d1117 100%);border-bottom:1px solid var(--border);padding:14px 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.admin-brand{display:flex;align-items:center;gap:10px}
.admin-brand h1{font-family:'Playfair Display',serif;font-size:1.2rem;color:var(--gold)}
.admin-tag{background:var(--accent);color:#fff;font-size:.65rem;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:.08em;text-transform:uppercase}
.admin-topbar-actions{display:flex;gap:10px;align-items:center}
.topbar-link{color:var(--muted);font-size:.82rem;text-decoration:none;transition:color .15s}
.topbar-link:hover{color:var(--gold-light)}
.logout-btn{background:rgba(224,82,82,.15);border:1px solid rgba(224,82,82,.3);color:var(--red);padding:6px 14px;border-radius:8px;font-size:.8rem;cursor:pointer;font-family:inherit;transition:all .15s}
.logout-btn:hover{background:rgba(224,82,82,.25);border-color:var(--red)}

/* Flash */
.flash-msg{position:fixed;top:70px;left:50%;transform:translateX(-50%);padding:10px 24px;border-radius:10px;font-size:.85rem;font-weight:600;z-index:200;animation:slideDown .3s ease}
.flash-msg.success{background:rgba(50,211,153,.15);border:1px solid rgba(50,211,153,.3);color:var(--emerald)}
.flash-msg.error{background:rgba(224,82,82,.15);border:1px solid rgba(224,82,82,.3);color:var(--red)}
@keyframes slideDown{from{transform:translateX(-50%) translateY(-20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}

/* Stats */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;padding:20px 28px}
.stat-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;text-align:center;transition:border-color .2s}
.stat-card:hover{border-color:var(--gold-dim)}
.stat-num{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700;color:var(--gold);line-height:1}
.stat-label{font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-top:6px}

/* Tabs */
.admin-tabs{display:flex;gap:4px;padding:0 28px;border-bottom:1px solid var(--border)}
.tab-btn{background:none;border:none;color:var(--muted);font-family:inherit;font-size:.88rem;font-weight:600;padding:12px 20px;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s}
.tab-btn:hover{color:var(--text)}
.tab-btn.active{color:var(--gold);border-bottom-color:var(--gold)}

/* Sections */
.admin-section{padding:20px 28px}
.section-header{display:flex;gap:12px;margin-bottom:16px;align-items:center;flex-wrap:wrap}
.admin-search{flex:1;min-width:200px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px;color:var(--text);font-family:inherit;font-size:.88rem;outline:none}
.admin-search:focus{border-color:var(--gold-dim)}
.admin-search::placeholder{color:var(--muted)}
.add-btn{background:linear-gradient(135deg,var(--gold),var(--gold-dim));border:none;color:#0d1117;padding:10px 18px;border-radius:10px;font-family:inherit;font-size:.85rem;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap}
.add-btn:hover{box-shadow:0 4px 16px rgba(201,168,76,.3);transform:translateY(-1px)}

/* Table */
.table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:var(--card)}
.member-table{width:100%;border-collapse:collapse;font-size:.82rem}
.member-table th{background:var(--surface);color:var(--muted);font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;padding:10px 12px;text-align:left;white-space:nowrap;border-bottom:1px solid var(--border)}
.member-table td{padding:8px 12px;border-bottom:1px solid rgba(42,50,69,.4);vertical-align:middle}
.member-table tbody tr:hover{background:rgba(201,168,76,.04)}
.member-table tbody tr:last-child td{border-bottom:none}
.member-table.compact{font-size:.8rem}
.table-photo{width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--border)}
.table-photo-placeholder{width:36px;height:36px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:1rem;border:1px solid var(--border)}
.name-cell{font-weight:600;color:var(--text);white-space:nowrap}
.email-cell{color:var(--muted);font-size:.78rem}
.org-cell{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.id-badge-sm{background:rgba(201,168,76,.12);color:var(--gold);padding:2px 8px;border-radius:12px;font-size:.72rem;font-weight:600;border:1px solid var(--gold-dim)}
.blood-sm{background:rgba(58,123,213,.12);color:var(--accent);padding:2px 8px;border-radius:12px;font-size:.72rem;font-weight:600}
.empty-row{text-align:center;color:var(--muted);padding:30px!important;font-style:italic}

/* Actions */
.action-btns{display:flex;gap:6px}
.edit-btn,.delete-btn{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--muted);cursor:pointer;font-size:.9rem;display:flex;align-items:center;justify-content:center;transition:all .15s}
.edit-btn:hover{border-color:var(--accent);color:var(--accent)}
.delete-btn:hover{border-color:var(--red);color:var(--red)}
.vis-btn{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--emerald);cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;transition:all .15s}
.vis-btn:hover{border-color:var(--emerald)}
.vis-btn.off{color:var(--muted);opacity:.5}
.vis-btn.off:hover{border-color:var(--muted);opacity:.8}
.hidden-row{opacity:.5}
.hidden-tag{display:inline-block;margin-left:6px;font-size:.6rem;background:rgba(224,82,82,.15);color:var(--red);padding:1px 6px;border-radius:4px;font-weight:700;letter-spacing:.05em;vertical-align:middle}

/* Admin Pagination */
.admin-pagination{display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 0}
.admin-page-info{font-size:.78rem;color:var(--muted)}
.admin-page-btns{display:flex;gap:4px;flex-wrap:wrap;justify-content:center}
.apg-btn{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:.8rem;color:var(--muted);cursor:pointer;font-family:inherit;transition:all .15s;min-width:36px;text-align:center}
.apg-btn:hover:not(:disabled){border-color:var(--gold-dim);color:var(--text)}
.apg-btn.active{background:var(--gold);border-color:var(--gold);color:#0d1117;font-weight:700}
.apg-btn:disabled{opacity:.35;cursor:not-allowed}

/* Modal */
.admin-modal-overlay{position:fixed;inset:0;background:rgba(6,9,16,.85);backdrop-filter:blur(6px);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px}
.admin-modal{width:100%;max-width:560px;background:var(--card);border:1px solid var(--border);border-radius:16px;max-height:90vh;overflow-y:auto;animation:slideUp .25s ease}
@keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
.admin-modal-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border)}
.admin-modal-header h3{font-family:'Playfair Display',serif;font-size:1.1rem;color:var(--gold)}
.modal-close-btn{background:none;border:none;color:var(--muted);font-size:1.2rem;cursor:pointer;padding:4px 8px;transition:color .15s}
.modal-close-btn:hover{color:var(--red)}

/* Form */
.member-form{padding:22px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form-group{display:flex;flex-direction:column;gap:5px}
.form-group.full-width{grid-column:1/-1}
.form-group label{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:600}
.form-group input,.form-group select{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-family:inherit;font-size:.85rem;outline:none;transition:border-color .15s}
.form-group input:focus,.form-group select:focus{border-color:var(--gold-dim)}
.form-group input::placeholder{color:var(--muted)}
.form-group select{cursor:pointer}
.form-group input[type="file"]{padding:8px}
.current-photo-hint{font-size:.75rem;color:var(--muted);margin-top:2px}
.current-photo-hint a{color:var(--accent);text-decoration:none}
.current-photo-hint a:hover{text-decoration:underline}
.form-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}
.cancel-btn{background:var(--surface);border:1px solid var(--border);color:var(--muted);padding:10px 20px;border-radius:10px;font-family:inherit;font-size:.85rem;cursor:pointer;transition:all .15s}
.cancel-btn:hover{border-color:var(--text);color:var(--text)}
.save-btn{background:linear-gradient(135deg,var(--gold),var(--gold-dim));border:none;color:#0d1117;padding:10px 24px;border-radius:10px;font-family:inherit;font-size:.85rem;font-weight:700;cursor:pointer;transition:all .15s}
.save-btn:hover:not(:disabled){box-shadow:0 4px 16px rgba(201,168,76,.3);transform:translateY(-1px)}
.save-btn:disabled{opacity:.6;cursor:not-allowed}

/* Analytics */
.analytics-block{margin-bottom:24px}
.analytics-block h3{font-family:'Playfair Display',serif;font-size:1rem;color:var(--gold-light);margin-bottom:12px}
.view-count{background:rgba(201,168,76,.12);color:var(--gold);padding:2px 10px;border-radius:12px;font-weight:700;font-size:.78rem}
.type-badge{font-size:.7rem;font-weight:600;padding:3px 8px;border-radius:10px}
.type-badge.page_view{background:rgba(58,123,213,.15);color:var(--accent)}
.type-badge.card_view{background:rgba(201,168,76,.15);color:var(--gold)}
.time-cell{font-size:.76rem;color:var(--muted);white-space:nowrap}
.ip-cell{font-size:.75rem;color:var(--muted);font-family:monospace}

/* Pagination */
.pagination-controls{display:flex;align-items:center;gap:12px;justify-content:center;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)}
.pagination-controls button{padding:8px 16px;border:1px solid var(--border);background:rgba(201,168,76,.08);color:var(--gold);border-radius:8px;font-family:inherit;font-weight:600;font-size:.85rem;cursor:pointer;transition:all .15s}
.pagination-controls button:hover:not(:disabled){background:rgba(201,168,76,.15);border-color:var(--gold)}
.pagination-controls button:disabled{opacity:.5;cursor:not-allowed}
.page-info{font-size:.9rem;color:var(--muted);min-width:200px;text-align:center}

/* Charts */
.chart-container{padding:12px 0}
.mini-chart{display:flex;align-items:flex-end;justify-content:space-between;gap:4px;height:120px;padding:0 8px}
.chart-bar{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;cursor:pointer;transition:opacity .15s}
.chart-bar:hover{opacity:.7}
.bar-fill{width:100%;background:linear-gradient(180deg, var(--gold) 0%, rgba(201,168,76,.5) 100%);border-radius:4px 4px 0 0;min-height:2px;transition:all .2s}
.bar-label{font-size:.65rem;color:var(--muted);white-space:nowrap;transform:rotate(-45deg);transform-origin:center;margin-top:4px}

.country-chart{display:flex;flex-direction:column;gap:12px}
.country-row{display:flex;gap:12px;align-items:center}
.country-name{min-width:80px;font-size:.88rem;font-weight:500;color:var(--text)}
.country-bar-wrapper{display:flex;gap:8px;align-items:center;flex:1;height:28px}
.country-bar{background:linear-gradient(90deg, var(--gold) 0%, rgba(201,168,76,.3) 100%);border-radius:6px;height:100%;min-width:4px;transition:all .2s}
.country-bar:hover{background:linear-gradient(90deg, var(--gold) 0%, rgba(201,168,76,.5) 100%)}
.country-count{min-width:40px;font-size:.85rem;font-weight:600;color:var(--gold);text-align:right}

/* Storage & Operations */
.storage-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.storage-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;text-align:center;transition:all .2s}
.storage-card:hover{border-color:var(--gold-dim);box-shadow:0 0 12px rgba(201,168,76,.1)}
.storage-icon{font-size:2rem;margin-bottom:8px;display:flex;align-items:center;justify-content:center;height:48px}
.storage-label{font-size:.85rem;color:var(--muted);margin-bottom:8px;font-weight:500}
.storage-value{font-size:1.8rem;font-weight:700;color:var(--gold);margin-bottom:10px;line-height:1}
.storage-details{font-size:.75rem;color:var(--muted);line-height:1.6}

/* Loading */
.admin-loading{display:flex;justify-content:center;padding:60px}
.spinner{width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* Responsive */
@media(max-width:768px){
  .admin-topbar{padding:12px 16px}
  .stats-grid{padding:14px 16px;grid-template-columns:1fr 1fr}
  .admin-tabs{padding:0 16px}
  .admin-section{padding:14px 16px}
  .form-grid{grid-template-columns:1fr}
  .section-header{flex-direction:column}
  .admin-search{width:100%}
}
`;
