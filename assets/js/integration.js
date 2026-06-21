/**
 * INTEGRATION.JS — Frontend ↔ Backend live data loader
 * UBKT Đảng ủy Chi cục Hải quan Khu vực VIII
 *
 * Chạy sau khi page load: phát hiện trang hiện tại, gọi API,
 * cập nhật DOM với dữ liệu thực từ Google Sheets.
 * Nếu backend chưa cấu hình (USE_MOCK=true) → tự bỏ qua, không báo lỗi.
 */

(async function () {
  // Chờ DOM sẵn sàng
  if (document.readyState !== 'complete') {
    await new Promise(r => window.addEventListener('load', r));
  }

  const path = window.location.pathname;
  const page = path.split('/').pop().replace('.html', '') || 'index';

  // Hiển thị indicator kết nối (thêm vào sidebar footer)
  injectStatusBadge();

  // Nếu đang dùng mock → dừng, không cần fetch
  if (!API.isConnected()) return;

  // Hiện loading overlay nhẹ
  showPageLoader(true);

  try {
    if (page === 'index' || page === '') {
      await integrateIndex();
    } else if (page === 'ph2-programs') {
      await integratePrograms();
    } else if (page === 'ph3-cases') {
      await integrateCases();
    } else if (page === 'ph4-conclusions') {
      await integrateConclusions();
    } else if (page === 'ph5-reports') {
      await integrateReports();
    } else if (page === 'theo-doi-chibo') {
      await integrateChiBo();
    }
  } catch (err) {
    console.warn('[Integration] Không thể tải dữ liệu live:', err.message);
    showError(err.message);
  } finally {
    showPageLoader(false);
  }

  // ─────────────────────────────────────────────────────────
  // INDEX.HTML — Dashboard
  // ─────────────────────────────────────────────────────────
  async function integrateIndex() {
    const dash = await API.reports.getDashboard();
    if (!dash) return;

    // Cập nhật 6 KPI values theo thứ tự: kt, gs, progress, done, overdue+todo, nhiemVu
    const kpiEls = document.querySelectorAll('.kpi-value');
    const vals   = [dash.kt, dash.gs, dash.progress, dash.done,
                    dash.overdue + dash.chuaBatDau, dash.nhiemVuChoPhanHoi];
    kpiEls.forEach((el, i) => {
      if (vals[i] !== undefined) animateCount(el, vals[i]);
    });

    // Cập nhật alert list
    const alertList = document.querySelector('.alert-list');
    if (alertList && dash.alerts?.length) {
      alertList.innerHTML = dash.alerts.map(a => {
        const cls  = a.daysLeft < 0 ? 'urgent' : a.daysLeft <= 7 ? 'urgent' : 'warning';
        const days = a.daysLeft < 0
          ? `<span style="color:var(--red)">Quá hạn ${Math.abs(a.daysLeft)} ngày</span>`
          : `${a.daysLeft} ngày`;
        return `<div class="alert-item ${cls}">
          <div class="alert-dot"></div>
          <div class="alert-text">
            <div class="alert-name">${a.tenCuoc || a.id}</div>
            <div class="alert-meta">Hạn: ${a.deadline || ''} · ${a.trangThai || ''}</div>
          </div>
          <div class="alert-days">${days}</div>
        </div>`;
      }).join('');

      // Cập nhật badge đếm
      const badge = document.querySelector('.card-header .badge-red');
      if (badge) badge.textContent = dash.alerts.length + ' mục';
    }
  }

  // ─────────────────────────────────────────────────────────
  // PH2-PROGRAMS.HTML — Chương trình KTGS
  // ─────────────────────────────────────────────────────────
  async function integratePrograms() {
    const rawData = await API.programs.getAll();
    const list    = rawData?.items || rawData || [];
    if (!list.length) return;

    // Map Google Sheets columns → định dạng trang dùng
    window._livePrograms = list.map(r => ({
      id:       r.id,
      name:     r.tenCuoc,
      type:     r.loaiHinh,
      chuthe:   r.chuThe,
      target:   r.doiTuong,
      quy:      r.quy,
      deadline: r.deadline,
      status:   r.trangThai,
      pct:      Number(r.phanTram) || 0,
      step:     Number(r.buocHienTai) || 0,
      lead:     r.truongDoan,
      team:     (r.thanhVien || '').split(',').map(s => s.trim()).filter(Boolean),
      note:     r.noiDung,
      steps:    [], // sẽ bổ sung nếu có sheet riêng bước
    }));

    // Ghi đè mảng demo nếu trang có biến PROGRAMS global
    if (typeof PROGRAMS !== 'undefined') {
      // eslint-disable-next-line no-global-assign
      Object.assign(PROGRAMS, window._livePrograms);
      PROGRAMS.length = window._livePrograms.length;
    }

    // Re-render
    if (typeof applyFilter === 'function') applyFilter();
    else if (typeof renderTable === 'function') renderTable();

    showLiveBanner(`Đã tải ${list.length} chương trình từ Google Sheets`);
  }

  // ─────────────────────────────────────────────────────────
  // PH3-CASES.HTML — Hồ sơ điện tử
  // ─────────────────────────────────────────────────────────
  async function integrateCases() {
    const rawData = await API.cases.getAll();
    const list    = rawData?.items || rawData || [];
    if (!list.length) return;

    window._liveCases = list.map(r => ({
      id:       r.id,
      sohs:     r.soHoSo,
      name:     r.tenHoSo,
      type:     r.loaiHinh,
      target:   r.doiTuong,
      quy:      r.quy,
      deadline: r.deadline,
      status:   r.trangThai,
      pct:      Number(r.phanTram) || 0,
      step:     Number(r.buocHienTai) || 0,
      lead:     r.truongDoan,
      team:     (r.thanhVien || '').split(',').map(s => s.trim()).filter(Boolean),
      cancu:    r.canCu,
      noidung:  r.noiDung,
      steps:    [],
      docs:     {},
    }));

    if (typeof renderCards === 'function') {
      // Thay thế mảng CASES
      CASES.length = 0;
      window._liveCases.forEach(c => CASES.push(c));
      renderCards();
    }

    showLiveBanner(`Đã tải ${list.length} hồ sơ từ Google Sheets`);
  }

  // ─────────────────────────────────────────────────────────
  // PH4-CONCLUSIONS.HTML — Theo dõi kết luận
  // ─────────────────────────────────────────────────────────
  async function integrateConclusions() {
    const [klData, nvData] = await Promise.all([
      API.conclusions.getAll(),
      API.tasks.getAll()
    ]);

    const kls = klData?.items || klData || [];
    const nvs = nvData?.items || nvData || [];
    if (!kls.length) return;

    // Build conclusions with nested tasks
    window._liveConclusions = kls.map(kl => ({
      id:       kl.id,
      so:       kl.soVanBan,
      ngay:     kl.ngayBanHanh,
      type:     kl.loaiHinh,
      title:    kl.tenKetLuan,
      nguoc:    `Từ: ${kl.hosoId || ''}`,
      banhanh:  kl.banHanh,
      doituong: kl.doiTuong,
      tomtat:   kl.tomTat,
      tasks:    nvs
        .filter(t => t.ketluanId === kl.id)
        .map(t => ({
          id:      t.id,
          nv:      t.nhiemVu,
          donvi:   t.donViThucHien,
          deadline:t.deadline,
          status:  t.trangThai,
          pct:     Number(t.phanTram) || 0,
          ghichu:  t.ghiChu,
        })),
    }));

    if (typeof CONCLUSIONS !== 'undefined') {
      CONCLUSIONS.length = 0;
      window._liveConclusions.forEach(c => CONCLUSIONS.push(c));
      if (typeof render === 'function') render();
    }

    showLiveBanner(`Đã tải ${kls.length} kết luận, ${nvs.length} nhiệm vụ từ Google Sheets`);
  }

  // ─────────────────────────────────────────────────────────
  // PH5-REPORTS.HTML — Báo cáo & Thống kê
  // ─────────────────────────────────────────────────────────
  async function integrateReports() {
    const [stats, cbStats] = await Promise.all([
      API.reports.getStats('year'),
      API.reports.getStatsByChiBo()
    ]);
    if (!stats) return;

    // Cập nhật 6 KPI values
    const kpiEls = document.querySelectorAll('.kpi-value');
    const done   = stats.byStatus?.done || 0;
    const prog   = stats.byStatus?.progress || 0;
    const over   = stats.byStatus?.overdue || 0;
    const vals   = [
      stats.tong,
      done,
      prog,
      over,
      stats.tasks?.overdue || 0,
      done > 0 ? Math.round(done / stats.tong * 100) + '%' : '0%'
    ];
    kpiEls.forEach((el, i) => {
      if (vals[i] !== undefined) {
        if (typeof vals[i] === 'string') el.textContent = vals[i];
        else animateCount(el, vals[i]);
      }
    });

    // Cập nhật bảng Chi bộ
    if (cbStats?.length && typeof renderTable === 'function') {
      window._cbData = cbStats;
      renderTable();
    }

    showLiveBanner('Đã cập nhật số liệu thống kê từ Google Sheets');
  }

  // ─────────────────────────────────────────────────────────
  // THEO-DOI-CHIBO.HTML — Tiến độ 13 Chi bộ
  // ─────────────────────────────────────────────────────────
  async function integrateChiBo() {
    const data = await API.chibo.getAll();
    const list = data?.items || data || [];
    if (!list.length) return;
    // Trang này dùng dữ liệu riêng từ Excel – chỉ cập nhật KPI
    const kpiEls = document.querySelectorAll('.kpi-value');
    if (kpiEls.length >= 1) animateCount(kpiEls[0], list.length);
    showLiveBanner(`Đã đồng bộ ${list.length} Chi bộ từ Google Sheets`);
  }

  // ─────────────────────────────────────────────────────────
  // UI HELPERS
  // ─────────────────────────────────────────────────────────

  function injectStatusBadge() {
    const footer = document.querySelector('.sidebar-footer');
    if (!footer) return;
    const badge = document.createElement('div');
    badge.id    = 'api-status';
    badge.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid #eee;';
    footer.appendChild(badge);
    API.showConnectionStatus();
  }

  function showLiveBanner(msg) {
    let banner = document.getElementById('live-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'live-banner';
      banner.style.cssText = [
        'position:fixed;bottom:16px;right:16px;z-index:9999',
        'background:#1A7A4A;color:white;border-radius:8px',
        'padding:10px 16px;font-size:12px;font-family:Be Vietnam Pro,sans-serif',
        'box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:center;gap:8px',
        'animation:slideIn .3s ease',
      ].join(';');
      document.head.insertAdjacentHTML('beforeend',
        '<style>@keyframes slideIn{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}</style>');
      document.body.appendChild(banner);
    }
    banner.innerHTML = `🟢 Live data: ${msg}`;
    setTimeout(() => banner?.remove(), 4000);
  }

  function showError(msg) {
    let toast = document.getElementById('api-error');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'api-error';
      toast.style.cssText = [
        'position:fixed;bottom:16px;right:16px;z-index:9999',
        'background:#CC0000;color:white;border-radius:8px',
        'padding:10px 16px;font-size:12px;font-family:Be Vietnam Pro,sans-serif',
        'box-shadow:0 4px 16px rgba(0,0,0,.2)',
      ].join(';');
      document.body.appendChild(toast);
    }
    toast.textContent = '⚠️ Lỗi API: ' + msg;
    setTimeout(() => toast?.remove(), 5000);
  }

  function showPageLoader(show) {
    let loader = document.getElementById('page-loader');
    if (show && !loader) {
      loader = document.createElement('div');
      loader.id = 'page-loader';
      loader.style.cssText = [
        'position:fixed;top:64px;left:0;right:0;height:3px;z-index:2000',
        'background:linear-gradient(90deg,#CC0000,#D4A017,#1A7A4A)',
        'animation:loadBar 1.5s ease infinite',
      ].join(';');
      document.head.insertAdjacentHTML('beforeend',
        '<style>@keyframes loadBar{0%{transform:scaleX(0);transform-origin:left}50%{transform:scaleX(1);transform-origin:left}51%{transform:scaleX(1);transform-origin:right}100%{transform:scaleX(0);transform-origin:right}}</style>');
      document.body.appendChild(loader);
    } else if (!show && loader) {
      loader.remove();
    }
  }

  function animateCount(el, target) {
    const start = parseInt(el.textContent) || 0;
    const diff  = target - start;
    const steps = 20;
    let   step  = 0;
    const timer = setInterval(() => {
      step++;
      el.textContent = Math.round(start + diff * (step / steps));
      if (step >= steps) { el.textContent = target; clearInterval(timer); }
    }, 30);
  }

})();
