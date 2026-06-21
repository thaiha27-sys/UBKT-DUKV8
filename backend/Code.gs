/**
 * HỆ THỐNG QUẢN LÝ KTGS & KỶ LUẬT ĐẢNG
 * UBKT Đảng ủy Chi cục Hải quan Khu vực VIII
 * Backend: Google Apps Script REST API
 * Phiên bản: 1.0.0 | Nhiệm kỳ: 2025–2030
 *
 * CẤU TRÚC GOOGLE SHEETS (10 sheets):
 *   1. CHUONG_TRINH   – Chương trình KTGS
 *   2. HO_SO          – Hồ sơ cuộc KTGS
 *   3. TAI_LIEU       – Tài liệu trong hồ sơ
 *   4. KET_LUAN       – Kết luận KTGS
 *   5. NHIEM_VU       – Nhiệm vụ sau kết luận
 *   6. CHI_BO         – Tiến độ 13 Chi bộ
 *   7. THU_VIEN       – Thư viện nghiệp vụ
 *   8. NGUOI_DUNG     – Người dùng & phân quyền
 *   9. NHAT_KY        – Nhật ký thao tác
 *  10. CAU_HINH       – Cấu hình hệ thống
 */

// ============================================================
// CẤU HÌNH
// ============================================================
const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
const ALLOWED_ORIGINS = [
  'https://thaiha27-sys.github.io',
  'http://localhost',
  'null'  // file:// khi mở local
];

// ============================================================
// ENTRY POINTS
// ============================================================

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    const action  = e.parameter.action  || '';
    const id      = e.parameter.id      || '';
    const filter  = e.parameter.filter  || '';
    const limit   = parseInt(e.parameter.limit) || 100;

    let data;

    // ── GET ROUTES ──────────────────────────────────────────
    if (method === 'GET') {
      switch (action) {

        // Dashboard KPIs tổng hợp
        case 'getDashboard':
          data = getDashboard(); break;

        // Chương trình KTGS
        case 'getPrograms':
          data = getSheet('CHUONG_TRINH', filter, limit); break;
        case 'getProgramById':
          data = getRowById('CHUONG_TRINH', id); break;

        // Hồ sơ cuộc KTGS
        case 'getCases':
          data = getSheet('HO_SO', filter, limit); break;
        case 'getCaseById':
          data = getRowById('HO_SO', id); break;
        case 'getCaseDocs':
          data = getByParent('TAI_LIEU', 'hosoId', id); break;

        // Kết luận
        case 'getConclusions':
          data = getSheet('KET_LUAN', filter, limit); break;
        case 'getConclusionById':
          data = getRowById('KET_LUAN', id); break;

        // Nhiệm vụ sau kết luận
        case 'getTasks':
          data = getSheet('NHIEM_VU', filter, limit); break;
        case 'getTasksByConclusion':
          data = getByParent('NHIEM_VU', 'ketluanId', id); break;
        case 'getOverdueTasks':
          data = getOverdueTasks(); break;

        // Chi bộ
        case 'getChiBo':
          data = getSheet('CHI_BO', filter, limit); break;

        // Thư viện
        case 'getLibrary':
          data = getSheet('THU_VIEN', filter, limit); break;

        // Thống kê báo cáo
        case 'getStats':
          data = getStats(e.parameter.period || 'year'); break;
        case 'getStatsByChiBo':
          data = getStatsByChiBo(); break;

        // Nhật ký
        case 'getLog':
          data = getSheet('NHAT_KY', filter, 50); break;

        default:
          return errorResponse(400, 'Action không hợp lệ: ' + action);
      }
    }

    // ── POST ROUTES ──────────────────────────────────────────
    else if (method === 'POST') {
      const body = JSON.parse(e.postData.contents || '{}');

      switch (action) {

        // Thêm/cập nhật chương trình
        case 'saveProgram':
          data = upsertRow('CHUONG_TRINH', body, 'CT'); break;

        // Cập nhật tiến độ chương trình
        case 'updateProgramStatus':
          data = updateField('CHUONG_TRINH', body.id, {
            trangThai: body.trangThai,
            buocHienTai: body.buocHienTai,
            phanTram: body.phanTram,
            ghiChu: body.ghiChu
          }); break;

        // Thêm/cập nhật hồ sơ
        case 'saveCase':
          data = upsertRow('HO_SO', body, 'HS'); break;

        // Cập nhật tài liệu hồ sơ
        case 'updateDocument':
          data = upsertRow('TAI_LIEU', body, 'TL'); break;

        // Thêm kết luận
        case 'saveConclusion':
          data = upsertRow('KET_LUAN', body, 'KL'); break;

        // Cập nhật nhiệm vụ
        case 'saveTask':
          data = upsertRow('NHIEM_VU', body, 'NV'); break;
        case 'updateTaskStatus':
          data = updateField('NHIEM_VU', body.id, {
            trangThai: body.trangThai,
            phanTram: body.phanTram,
            ghiChu: body.ghiChu,
            ngayCapNhat: new Date().toISOString()
          }); break;

        // Cập nhật tiến độ Chi bộ
        case 'updateChiBo':
          data = updateField('CHI_BO', body.id, body.fields); break;

        default:
          return errorResponse(400, 'Action không hợp lệ: ' + action);
      }

      // Ghi nhật ký
      writeLog(action, body.id || '', JSON.stringify(body).substring(0, 200));
    }

    return jsonResponse({ ok: true, data });

  } catch (err) {
    return errorResponse(500, err.message || 'Lỗi hệ thống');
  }
}

// ============================================================
// CORE HELPERS – Google Sheets I/O
// ============================================================

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheetData(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet không tồn tại: ' + sheetName);
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  }).filter(r => r.id); // Bỏ hàng trống
}

function getSheet(sheetName, filter, limit) {
  let rows = getSheetData(sheetName);
  if (filter) {
    try {
      const f = JSON.parse(decodeURIComponent(filter));
      Object.entries(f).forEach(([k, v]) => {
        if (v) rows = rows.filter(r => String(r[k]).toLowerCase().includes(String(v).toLowerCase()));
      });
    } catch(e) {}
  }
  return rows.slice(0, limit);
}

function getRowById(sheetName, id) {
  const rows = getSheetData(sheetName);
  const row = rows.find(r => String(r.id) === String(id));
  if (!row) throw new Error('Không tìm thấy bản ghi: ' + id);
  return row;
}

function getByParent(sheetName, parentKey, parentId) {
  const rows = getSheetData(sheetName);
  return rows.filter(r => String(r[parentKey]) === String(parentId));
}

function upsertRow(sheetName, body, prefix) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet không tồn tại: ' + sheetName);

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  // Nếu có id → cập nhật
  if (body.id) {
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(body.id)) {
        const newRow = headers.map(h => body[h] !== undefined ? body[h] : rows[i][headers.indexOf(h)]);
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
        return { action: 'updated', id: body.id };
      }
    }
  }

  // Nếu chưa có id → thêm mới
  const newId = generateId(prefix);
  const newRow = headers.map(h => {
    if (h === 'id') return newId;
    if (h === 'ngayTao') return new Date().toISOString();
    if (h === 'nguoiTao') return body.nguoiTao || 'UBKT';
    return body[h] !== undefined ? body[h] : '';
  });
  sheet.appendRow(newRow);
  return { action: 'created', id: newId };
}

function updateField(sheetName, id, fields) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      Object.entries(fields).forEach(([k, v]) => {
        const col = headers.indexOf(k);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(v);
      });
      return { action: 'updated', id };
    }
  }
  throw new Error('Không tìm thấy bản ghi để cập nhật: ' + id);
}

// ============================================================
// BUSINESS LOGIC
// ============================================================

function getDashboard() {
  const programs  = getSheetData('CHUONG_TRINH');
  const tasks     = getSheetData('NHIEM_VU');
  const chiboData = getSheetData('CHI_BO');

  const today = new Date();
  const in7   = new Date(); in7.setDate(today.getDate() + 7);
  const in30  = new Date(); in30.setDate(today.getDate() + 30);

  const done     = programs.filter(p => p.trangThai === 'done').length;
  const progress = programs.filter(p => p.trangThai === 'progress').length;
  const overdue  = programs.filter(p => p.trangThai === 'overdue').length;
  const kt       = programs.filter(p => p.loaiHinh === 'kt').length;
  const gs       = programs.filter(p => p.loaiHinh === 'gs').length;

  const pendingTasks = tasks.filter(t => t.trangThai !== 'done');
  const alerts = programs
    .filter(p => p.trangThai !== 'done' && p.deadline)
    .map(p => {
      const dl = new Date(p.deadline);
      const diff = Math.round((dl - today) / 86400000);
      return { ...p, daysLeft: diff };
    })
    .filter(p => p.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);

  return {
    tong: programs.length,
    kt, gs, done, progress, overdue,
    chuaBatDau: programs.length - done - progress - overdue,
    nhiemVuChoPhanHoi: pendingTasks.length,
    nhiemVuQuaHan: tasks.filter(t => t.trangThai === 'overdue').length,
    alerts,
    capNhat: new Date().toISOString()
  };
}

function getOverdueTasks() {
  const today = new Date().toISOString().split('T')[0];
  const tasks = getSheetData('NHIEM_VU');
  return tasks.filter(t =>
    t.trangThai !== 'done' &&
    t.deadline &&
    String(t.deadline).slice(0, 10) < today
  );
}

function getStats(period) {
  const programs = getSheetData('CHUONG_TRINH');
  const tasks    = getSheetData('NHIEM_VU');
  const today    = new Date();
  const year     = today.getFullYear();

  let filtered = programs;
  if (period === 'q2') {
    filtered = programs.filter(p => {
      const quy = String(p.quy || '');
      return quy.includes('Q2') || quy.includes('Quý II');
    });
  } else if (period === '6m') {
    filtered = programs.filter(p => {
      const dl = new Date(p.deadline || '9999');
      return dl <= new Date(year, 5, 30);
    });
  } else if (period === 'year') {
    filtered = programs.filter(p => {
      const dl = new Date(p.deadline || '9999');
      return dl.getFullYear() === year;
    });
  }

  const byStatus = {};
  ['done','progress','late','overdue','todo'].forEach(s => {
    byStatus[s] = filtered.filter(p => p.trangThai === s).length;
  });

  const byType = {
    kt: filtered.filter(p => p.loaiHinh === 'kt').length,
    gs: filtered.filter(p => p.loaiHinh === 'gs').length
  };

  const byQuy = {};
  ['Q1','Q2','Q3','Q4'].forEach(q => {
    byQuy[q] = {
      kt: filtered.filter(p => String(p.quy||'').includes(q) && p.loaiHinh==='kt').length,
      gs: filtered.filter(p => String(p.quy||'').includes(q) && p.loaiHinh==='gs').length,
    };
  });

  return { tong: filtered.length, byStatus, byType, byQuy,
    tasks: { tong: tasks.length, done: tasks.filter(t=>t.trangThai==='done').length,
      overdue: tasks.filter(t=>t.trangThai==='overdue').length } };
}

function getStatsByChiBo() {
  const programs = getSheetData('CHUONG_TRINH');
  const chiBo    = getSheetData('CHI_BO');
  return chiBo.map(cb => {
    const related = programs.filter(p => String(p.doiTuong||'').includes(cb.ten));
    return {
      ...cb,
      tongKTGS: related.length,
      kt: related.filter(p=>p.loaiHinh==='kt').length,
      gs: related.filter(p=>p.loaiHinh==='gs').length,
      hoanthành: related.filter(p=>p.trangThai==='done').length,
      dangTH: related.filter(p=>p.trangThai==='progress').length,
      quaHan: related.filter(p=>p.trangThai==='overdue').length,
    };
  });
}

// ============================================================
// TRIGGERS – Chạy tự động
// ============================================================

/** Trigger 1: Cập nhật trạng thái quá hạn – chạy mỗi ngày lúc 08:00 */
function dailyOverdueSync() {
  const today = new Date().toISOString().split('T')[0];
  const ss = getSpreadsheet();

  ['CHUONG_TRINH','NHIEM_VU'].forEach(sheetName => {
    const sheet   = ss.getSheetByName(sheetName);
    if (!sheet) return;
    const rows    = sheet.getDataRange().getValues();
    const headers = rows[0];
    const iStatus   = headers.indexOf('trangThai');
    const iDeadline = headers.indexOf('deadline');

    for (let i = 1; i < rows.length; i++) {
      const status   = rows[i][iStatus];
      const deadline = String(rows[i][iDeadline] || '').slice(0, 10);
      if (status !== 'done' && deadline && deadline < today) {
        sheet.getRange(i + 1, iStatus + 1).setValue('overdue');
      }
    }
  });
  writeLog('trigger', 'dailyOverdueSync', 'Tự động cập nhật quá hạn: ' + today);
}

/** Trigger 2: Gửi cảnh báo email – chạy mỗi ngày lúc 07:00 */
function dailyAlertEngine() {
  const programs = getSheetData('CHUONG_TRINH');
  const tasks    = getSheetData('NHIEM_VU');
  const today    = new Date();
  const config   = getSheetData('CAU_HINH');
  const emailRow = config.find(c => c.key === 'alertEmail');
  if (!emailRow || !emailRow.value) return;

  const alertEmail = String(emailRow.value);
  const lines = [];

  // Tổng hợp items sắp hạn và quá hạn
  [...programs, ...tasks].forEach(item => {
    const dl   = new Date(item.deadline || '9999');
    const diff = Math.round((dl - today) / 86400000);
    const name = item.tenCuoc || item.nhiemVu || item.id;
    if (item.trangThai === 'overdue') lines.push(`🔴 QUÁ HẠN: ${name}`);
    else if (diff <= 3)  lines.push(`🟠 CẦN XỬ LÝ (${diff} ngày): ${name}`);
    else if (diff <= 7)  lines.push(`🟡 SẮP HẠN (${diff} ngày): ${name}`);
    else if (diff <= 15) lines.push(`⚪ THEO DÕI (${diff} ngày): ${name}`);
  });

  if (!lines.length) return;

  const subject = `[KTGS HQKV8] Cảnh báo tiến độ ${today.toLocaleDateString('vi-VN')}`;
  const body    = `UBKT Đảng ủy Chi cục Hải quan Khu vực VIII\n\nDanh sách cần xử lý:\n\n${lines.join('\n')}\n\n---\nHệ thống KTGS | ${today.toLocaleString('vi-VN')}`;

  GmailApp.sendEmail(alertEmail, subject, body);
  writeLog('trigger', 'dailyAlertEngine', `Đã gửi ${lines.length} cảnh báo đến ${alertEmail}`);
}

/** Trigger 3: Báo cáo tuần – Thứ Hai 07:00 */
function weeklyReport() {
  const dash   = getDashboard();
  const config = getSheetData('CAU_HINH');
  const emailRow = config.find(c => c.key === 'reportEmail');
  if (!emailRow?.value) return;

  const subject = `[Báo cáo tuần] Công tác KTGS – Tuần ${getWeekNumber(new Date())}/${new Date().getFullYear()}`;
  const body = `📊 BÁO CÁO TUẦN – UBKT ĐẢNG ỦY CHI CỤC HQKV8\n\n`
    + `✅ Tổng cuộc KTGS: ${dash.tong} (KT: ${dash.kt} | GS: ${dash.gs})\n`
    + `✅ Hoàn thành: ${dash.done} | Đang TH: ${dash.progress} | Quá hạn: ${dash.overdue}\n`
    + `📋 Nhiệm vụ kết luận chờ xử lý: ${dash.nhiemVuChoPhanHoi}\n\n`
    + `⚠️ CẦN CHÚ Ý:\n${(dash.alerts||[]).map(a => `  - ${a.tenCuoc || a.id}: còn ${a.daysLeft} ngày`).join('\n')}\n\n`
    + `---\nTruy cập hệ thống: https://thaiha27-sys.github.io/UBKT-DUKV8/`;

  GmailApp.sendEmail(emailRow.value, subject, body);
  writeLog('trigger', 'weeklyReport', 'Đã gửi báo cáo tuần');
}

// ============================================================
// UTILITIES
// ============================================================

function generateId(prefix) {
  const now  = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `${prefix}_${date}_${rand}`;
}

function getWeekNumber(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - start) / 86400000) + start.getDay() + 1) / 7);
}

function writeLog(action, targetId, detail) {
  try {
    const sheet = getSpreadsheet().getSheetByName('NHAT_KY');
    if (!sheet) return;
    sheet.appendRow([
      generateId('LOG'),
      new Date().toISOString(),
      action,
      targetId,
      detail,
      Session.getActiveUser().getEmail() || 'system'
    ]);
  } catch(e) {}
}

function jsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function errorResponse(code, message) {
  return jsonResponse({ ok: false, code, message });
}

// ============================================================
// SETUP: Chạy 1 lần để khởi tạo Spreadsheet
// ============================================================

function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const SHEETS = {
    CHUONG_TRINH: ['id','tenCuoc','loaiHinh','chuThe','doiTuong','quy','deadline','trangThai','phanTram','buocHienTai','truongDoan','thanhVien','canCu','noiDung','ngayTao','nguoiTao'],
    HO_SO:        ['id','soHoSo','chuongTrinhId','tenHoSo','loaiHinh','doiTuong','deadline','trangThai','phanTram','buocHienTai','truongDoan','thanhVien','canCu','noiDung','ngayTao','nguoiTao'],
    TAI_LIEU:     ['id','hosoId','loaiTL','tenTaiLieu','coFile','driveLink','ngayCapNhat','nguoiCapNhat'],
    KET_LUAN:     ['id','soVanBan','hosoId','tenKetLuan','ngayBanHanh','loaiHinh','doiTuong','banHanh','tomTat','ngayTao','nguoiTao'],
    NHIEM_VU:     ['id','ketluanId','nhiemVu','donViThucHien','deadline','trangThai','phanTram','ghiChu','ngayCapNhat','nguoiCapNhat'],
    CHI_BO:       ['id','ten','truongChiBo','soLuongDV','ktDone','ktTotal','gsDone','gsTotal','phanTramKT','phanTramGS','ghiChu'],
    THU_VIEN:     ['id','tenTL','loai','soBanHanh','ngayBanHanh','coQuanBH','tomTat','driveLink','luotXem','danh'],
    NGUOI_DUNG:   ['id','hoTen','email','vaiTro','donVi','trangThai','ngayTao'],
    NHAT_KY:      ['id','thoiGian','hanhDong','doiTuong','chiTiet','nguoiDung'],
    CAU_HINH:     ['key','value','moTa']
  };

  Object.entries(SHEETS).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#CC0000').setFontColor('#FFFFFF').setFontWeight('bold');
    }
  });

  // Cấu hình mặc định
  const cfgSheet = ss.getSheetByName('CAU_HINH');
  const defaultCfg = [
    ['alertEmail',  'thaiha27@gmail.com', 'Email nhận cảnh báo'],
    ['reportEmail', 'thaiha27@gmail.com', 'Email nhận báo cáo tuần'],
    ['donVi',       'Chi cục Hải quan Khu vực VIII', 'Tên đơn vị'],
    ['nhiemKy',     '2025-2030', 'Nhiệm kỳ']
  ];
  if (cfgSheet.getLastRow() <= 1) {
    defaultCfg.forEach(row => cfgSheet.appendRow(row));
  }

  // Đăng ký Triggers tự động
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyOverdueSync').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('dailyAlertEngine').timeBased().everyDays(1).atHour(7).create();
  ScriptApp.newTrigger('weeklyReport').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();

  Logger.log('✅ Setup hoàn thành! Spreadsheet ID: ' + SPREADSHEET_ID);
}
