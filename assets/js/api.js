/**
 * API CLIENT – Kết nối Frontend ↔ Google Apps Script
 * UBKT Đảng ủy Chi cục Hải quan Khu vực VIII
 *
 * Cách dùng trong mỗi trang HTML:
 *   <script src="../assets/js/api.js"></script>
 *   <script>
 *     const programs = await API.get('getPrograms');
 *     await API.post('updateTaskStatus', { id: 'NV_xxx', trangThai: 'done', phanTram: 100 });
 *   </script>
 */

const API = (() => {

  // ── CẤU HÌNH ────────────────────────────────────────────────
  // Thay bằng URL Web App sau khi deploy Apps Script
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzvxYU2L_GazY0vRzcTyj4efWkbMNE_70JI0BE_99e-gvtL8OXqYZ2FeIgFI6MIpiiI8g/exec';
  // true  = dùng dữ liệu demo (mock), không cần backend
  // false = gọi Google Apps Script thật
  const USE_MOCK = (WEB_APP_URL === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE');

  // ── MOCK DATA (dùng khi chưa có backend) ────────────────────
  const MOCK = {
    getDashboard: {
      tong: 20, kt: 12, gs: 8, done: 6, progress: 7, overdue: 3, chuaBatDau: 4,
      nhiemVuChoPhanHoi: 7, nhiemVuQuaHan: 2,
      alerts: [
        { id:'P003', tenCuoc:'KT đảng viên diện BTV – CB HQCK QT Móng Cái', daysLeft: -1, trangThai:'overdue' },
        { id:'T09',  tenCuoc:'Nhiệm vụ kiểm điểm đảng viên – CB Phòng NV',  daysLeft: 1,  trangThai:'progress' },
        { id:'P001', tenCuoc:'KT toàn diện CB Phòng Nghiệp vụ',             daysLeft: 7,  trangThai:'progress' },
      ],
      capNhat: new Date().toISOString()
    },
    getPrograms:    { items: [], total: 0 },
    getCases:       { items: [], total: 0 },
    getConclusions: { items: [], total: 0 },
    getTasks:       { items: [], total: 0 },
    getChiBo:       { items: [], total: 0 },
  };

  // ── HTTP HELPERS ─────────────────────────────────────────────
  async function get(action, params = {}) {
    if (USE_MOCK) {
      await delay(120);
      console.info(`[API:mock] GET ${action}`);
      return MOCK[action] || { items: [], total: 0 };
    }

    const url = new URL(WEB_APP_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    try {
      const res  = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Lỗi API');
      return json.data;
    } catch (err) {
      console.error(`[API] GET ${action} thất bại:`, err);
      throw err;
    }
  }

  async function post(action, body = {}) {
    if (USE_MOCK) {
      await delay(200);
      console.info(`[API:mock] POST ${action}`, body);
      return { action: 'ok', id: 'MOCK_' + Date.now() };
    }

    const url = new URL(WEB_APP_URL);
    url.searchParams.set('action', action);

    try {
      const res  = await fetch(url.toString(), {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Lỗi API');
      return json.data;
    } catch (err) {
      console.error(`[API] POST ${action} thất bại:`, err);
      throw err;
    }
  }

  // ── CONVENIENCE METHODS ──────────────────────────────────────
  const programs = {
    getAll:    (filter = {})          => get('getPrograms', { filter: JSON.stringify(filter) }),
    getById:   (id)                   => get('getProgramById', { id }),
    save:      (data)                 => post('saveProgram', data),
    updateStatus: (id, status, pct, step, note) =>
      post('updateProgramStatus', { id, trangThai: status, phanTram: pct, buocHienTai: step, ghiChu: note }),
  };

  const cases = {
    getAll:    (filter = {})          => get('getCases', { filter: JSON.stringify(filter) }),
    getById:   (id)                   => get('getCaseById', { id }),
    getDocs:   (caseId)               => get('getCaseDocs', { id: caseId }),
    save:      (data)                 => post('saveCase', data),
    updateDoc: (docData)              => post('updateDocument', docData),
  };

  const conclusions = {
    getAll:    (filter = {})          => get('getConclusions', { filter: JSON.stringify(filter) }),
    getById:   (id)                   => get('getConclusionById', { id }),
    save:      (data)                 => post('saveConclusion', data),
  };

  const tasks = {
    getAll:    (filter = {})          => get('getTasks', { filter: JSON.stringify(filter) }),
    getByConclusion: (klId)           => get('getTasksByConclusion', { id: klId }),
    getOverdue:      ()               => get('getOverdueTasks'),
    save:      (data)                 => post('saveTask', data),
    updateStatus: (id, status, pct, note) =>
      post('updateTaskStatus', { id, trangThai: status, phanTram: pct, ghiChu: note }),
  };

  const reports = {
    getDashboard:    ()               => get('getDashboard'),
    getStats:        (period = 'year') => get('getStats', { period }),
    getStatsByChiBo: ()               => get('getStatsByChiBo'),
  };

  const chibo = {
    getAll:    ()                     => get('getChiBo'),
    update:    (id, fields)           => post('updateChiBo', { id, fields }),
  };

  // ── STATE & CONNECTION CHECK ─────────────────────────────────
  function isConnected() { return !USE_MOCK; }

  async function testConnection() {
    if (USE_MOCK) return { ok: false, mode: 'mock', msg: 'Đang dùng dữ liệu demo' };
    try {
      const data = await get('getDashboard');
      return { ok: true, mode: 'live', msg: 'Kết nối thành công', data };
    } catch (e) {
      return { ok: false, mode: 'error', msg: e.message };
    }
  }

  function showConnectionStatus() {
    const el = document.getElementById('api-status');
    if (!el) return;
    if (USE_MOCK) {
      el.innerHTML = '<span style="color:#D46B00;font-size:11px">⚡ Demo mode – chưa kết nối Google Sheets</span>';
    } else {
      el.innerHTML = '<span style="color:#1A7A4A;font-size:11px">🟢 Đã kết nối Google Sheets</span>';
    }
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Public API
  return { get, post, programs, cases, conclusions, tasks, reports, chibo, isConnected, testConnection, showConnectionStatus };

})();

// Tự hiển thị status khi page load
document.addEventListener('DOMContentLoaded', () => API.showConnectionStatus());
