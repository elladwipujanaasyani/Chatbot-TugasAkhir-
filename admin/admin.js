document.addEventListener('DOMContentLoaded', () => {
  // ====== TOKEN CHECK (WAJIB DI AWAL) ======
  const token =
    localStorage.getItem('admin_token') ||
    sessionStorage.getItem('admin_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('token');

  // Peta kategori id → nama
  const kategoriMap = {
    1: "Keanggotaan dan Akses",
    2: "Layanan Referensi atau Rujukan",
    3: "Layanan Perpustakaan Umum",
    4: "Koleksi dan Materi Perpustakaan",
    5: "Pertanyaan E-Resources / Sumber Daya Elektronik",
  };

  if (!token) {
    window.location.href = '/admin/login-admin.html';
    return;
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // ====== DOM ======
  const form = document.getElementById('faq-form');
  const pertanyaanInput = document.getElementById('pertanyaan');
  const jawabanInput = document.getElementById('jawaban');
  const kategoriSelect = document.getElementById('kategori_id');
  const submitBtn = document.getElementById('faq-submit-btn');

  // tabel Daftar Pertanyaan
  const tbody = document.getElementById('faq-body');
  const tpl = document.getElementById('faq-row-template');

  // tabel log
  const logBody = document.getElementById('log-body');
  const logTpl  = document.getElementById('log-row-template');

  // ====== API WRAPPER (auto-handle 401) ======
  async function api(url, options = {}) {
  const BASE_URL = 'http://localhost:9000'; 
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  const res = await fetch(fullUrl, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {}),
    },
    body: options.body || undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_token');
    window.location.href = '/admin/login-admin.html';
    throw new Error('Unauthorized (401)');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}


  // ====== FAQ: LIST & RENDER ======
  async function loadFaqs() {
    const faqs = await api('/api/faq', { method: 'GET' }) || [];
    renderFaqs(faqs);
  }

  function renderFaqs(faqs) {
    if (!tbody || !tpl) return;
    tbody.innerHTML = '';
    faqs.forEach((f, i) => {
      const row = tpl.content.firstElementChild.cloneNode(true);
      row.dataset.id = f.id;
      row.dataset.pertanyaan = f.pertanyaan || '';
      row.dataset.jawaban = f.jawaban || '';
      row.dataset.kategoriId = (f.kategori_id ?? '') + '';

      row.querySelector('.no').textContent = i + 1;
      row.querySelector('.pertanyaan').textContent = f.pertanyaan || '';
      row.querySelector('.jawaban').textContent = f.jawaban || '';

      // kolom kategori
      const kategoriCell = row.querySelector('.kategori');
      if (kategoriCell) {
        const namaKategori =
        f.kategori_nama ||
        kategoriMap[f.kategori_id] ||
        (f.kategori_id ? `ID ${f.kategori_id}` : '—');
        kategoriCell.textContent = namaKategori;
}

      tbody.appendChild(row);
    });
  }

  // ====== FAQ: EDIT / HAPUS ======
  if (tbody) {
    tbody.addEventListener('click', async (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      e.preventDefault();

      const tr = e.target.closest('tr');
      const id = tr?.dataset.id;

      if (link.classList.contains('edit')) {
        pertanyaanInput.value = tr.dataset.pertanyaan || '';
        jawabanInput.value = tr.dataset.jawaban || '';
        if (kategoriSelect) kategoriSelect.value = tr.dataset.kategoriId || '';
        form.dataset.editing = id;
        submitBtn.textContent = 'Simpan Perubahan';
        pertanyaanInput.focus();
        return;
      }

      if (link.classList.contains('hapus')) {
        if (!confirm('Yakin ingin menghapus data ini?')) return;
        try {
          await api(`/api/faq/${id}`, { method: 'DELETE' });
          await loadFaqs();
        } catch (err) {
          console.error('[FAQ] Gagal hapus:', err);
          alert('Gagal menghapus: ' + err.message);
        }
      }
    });
  }

  // ====== FAQ: SUBMIT (TAMBAH / UPDATE) ======
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const pertanyaan = pertanyaanInput.value.trim();
      const jawaban = jawabanInput.value.trim();
      const editingId = form.dataset.editing || null;

      const kategori_id =
        kategoriSelect && kategoriSelect.value !== ''
          ? Number(kategoriSelect.value)
          : null;

      if (!pertanyaan || !jawaban) {
        alert('Pertanyaan dan jawaban wajib diisi.');
        return;
      }

      submitBtn?.setAttribute('disabled', 'disabled');

      try {
        const payload = { pertanyaan, jawaban };
        if (kategori_id !== null && !Number.isNaN(kategori_id)) {
          payload.kategori_id = kategori_id;
        }

        if (editingId) {
          await api(`/api/faq/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else {
          await api('/api/faq', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }

        form.reset();
        delete form.dataset.editing;
        submitBtn.textContent = 'Tambah FAQ';
        await loadFaqs();
      } catch (err) {
        console.error('[FAQ] Gagal simpan:', err);
        alert('Gagal menyimpan FAQ: ' + err.message);
      } finally {
        submitBtn?.removeAttribute('disabled');
      }
    });
  }

// ====== FAQ: KATEGORI SELECT ======
function populateKategoriSelect() {
  if (!kategoriSelect) return;
  kategoriSelect.innerHTML = '<option value="">-- Tanpa Kategori --</option>';
  Object.entries(kategoriMap).forEach(([id, nama]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = nama;
    kategoriSelect.appendChild(opt);
  });
}

  // ====== LOG PERTANYAAN ======
  function fmtTimeJakarta(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });
    } catch { return String(ts); }
  }

  async function loadLogs() {
    if (!logBody || !logTpl) return; // tidak ada tabel log → lewati
    let logs = [];
    try {
      logs = await api('/api/log-pertanyaan', { method: 'GET' }) || [];
    } catch (e) {
      const msg = String(e?.message || e);
      // ← inilah penanganan 404 agar UI tidak meledak
      if (msg.includes('HTTP 404')) {
        console.warn('[LOG] Endpoint /api/log-pertanyaan belum ada, tabel log dilewati.');
        return;
      }
      throw e; // error lain tetap dipropagasi
    }

    logBody.innerHTML = '';
    logs.forEach((r, i) => {
      const row = logTpl.content.firstElementChild.cloneNode(true);
      row.querySelector('.l-no').textContent = i + 1;
      row.querySelector('.l-pertanyaan').textContent = r.pertanyaan_user || '';
      row.querySelector('.l-skor').textContent =
        (r.skor_kemiripan !== null && r.skor_kemiripan !== undefined)
          ? Number(r.skor_kemiripan).toFixed(5)
          : '—';
      row.querySelector('.l-waktu').textContent = fmtTimeJakarta(r.waktu_ditanyakan);
      row.querySelector('.l-faq').textContent = (r.faq_id ?? '—');
      row.querySelector('.l-faq-pertanyaan').textContent = r.faq_pertanyaan || '—';
      row.querySelector('.l-faq-jawaban').textContent = r.faq_jawaban || '—';   
      row.querySelector('.l-source').textContent = r.source || '—';
      logBody.appendChild(row);
    });
  }

  // ====== STARTUP ======
Promise.resolve()
  .then(() => {
    populateKategoriSelect(); // isi dropdown kategori dulu
    return loadFaqs();        // lalu load daftar FAQ
  })
  .then(loadLogs) // akan skip diam-diam jika 404
  .catch(err => {
    console.error('[INIT] Gagal memuat:', err);
    alert('Gagal memuat data awal: ' + err.message);
  });
});