import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire("D:/nga-digital-studio/");
const puppeteer = require("puppeteer-core");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve("docs/evidence/sprint-2/screenshots");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("[EVIDENCE-S2] Menyiapkan folder bukti:", OUTPUT_DIR);
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  async function saveScreenshot(page, filename) {
    const p1 = path.join(OUTPUT_DIR, filename);
    await page.screenshot({ path: p1 });
    console.log(`  ✓ Tersimpan: ${filename}`);
  }

  console.log("[EVIDENCE-S2] Memulai browser Chrome headless...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  try {
    // 1. Login Page
    console.log("1. Mengambil screenshot Halaman Login...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await saveScreenshot(page, "01_login_page.png");

    // 2. Login as Staf
    console.log("2. Masuk sebagai Staf dan membuka Dashboard...");
    await page.type('input[type="email"]', "staf.test@p4i.local");
    await page.type('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot(page, "02_dashboard_staf.png");

    // 3. Create Draft Form & Submit New Letter
    console.log("3. Membuat draf surat uji Sprint 2...");
    await page.goto(`${BASE_URL}/letters/new`, { waitUntil: "networkidle0" });
    await page.waitForSelector('textarea', { timeout: 5000 });
    await page.type('input[placeholder*="Keterangan Selesai Magang"]', "Surat Keterangan Selesai Magang Riset Kebijakan P4I Sprint 2");
    await page.type('input[placeholder*="Budi Santoso"]', "Sdr. Rian Pratama (Universitas Indonesia)");
    await page.type('textarea', "Dengan ini menerangkan bahwa mahasiswa bersangkutan telah menyelesaikan kegiatan riset kebijakan publik periode semester gasal dengan kinerja Sangat Baik.");
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle0" });
    await sleep(500);

    const letterUrl = page.url();
    const letterId = letterUrl.split("/").pop();
    console.log("   Draf dibuat dengan ID:", letterId);
    await saveScreenshot(page, "03_draft_detail_initial.png");

    // 4. Open Submit Modal on Draft Detail
    console.log("4. Membuka Modal Pengajuan Pemeriksaan...");
    const submitBtn = await page.$('button ::-p-text(Ajukan Pemeriksaan)');
    if (submitBtn) {
      await submitBtn.click();
      await sleep(400);
      await saveScreenshot(page, "04_submit_for_review_modal.png");

      // Confirm Submit
      const confirmBtn = await page.$('button ::-p-text(Kirim untuk Diperiksa)');
      if (confirmBtn) {
        await confirmBtn.click();
        await sleep(1000);
      }
    }
    await saveScreenshot(page, "05_draft_submitted_state.png");

    // 5. Watermark Draft Preview
    console.log("5. Mengambil screenshot Pratinjau Draf dengan Watermark DRAF — BELUM RESMI...");
    await page.goto(`${BASE_URL}/letters/${letterId}/preview`, { waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot(page, "06_watermark_draft_preview.png");

    // 6. Reviewer Login & Approval Queue
    console.log("6. Masuk sebagai Reviewer Pejabat...");
    await page.goto(`${BASE_URL}/api/auth/logout`, { waitUntil: "networkidle0" }).catch(() => {});
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type('input[type="email"]', "reviewer.test@p4i.local");
    await page.type('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle0" });
    await sleep(500);

    // 7. Reviewer Inbox Queue Page
    console.log("7. Mengambil screenshot Antrean Pemeriksaan (/approvals)...");
    await page.goto(`${BASE_URL}/approvals`, { waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot(page, "07_reviewer_inbox_queue.png");

    // 8. Open Reviewer Decision Modal
    console.log("8. Membuka Modal Keputusan Pemeriksaan...");
    const periksaBtn = await page.$('button ::-p-text(Periksa)');
    if (periksaBtn) {
      await periksaBtn.click();
      await sleep(400);
      await saveScreenshot(page, "08_reviewer_decision_modal.png");

      // Confirm Approve
      const confirmApproveBtn = await page.$('button ::-p-text(Konfirmasi APPROVED)');
      if (confirmApproveBtn) {
        await confirmApproveBtn.click();
        await sleep(1000);
      }
    }

    // 9. Approved Letter Detail View
    console.log("9. Mengambil screenshot Surat Telah Disetujui (Approved State)...");
    await page.goto(`${BASE_URL}/letters/${letterId}`, { waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot(page, "09_approved_letter_banner.png");

    // 10. Mandates Overview Page
    console.log("10. Mengambil screenshot Manajemen Mandat Pejabat (/mandates)...");
    await page.goto(`${BASE_URL}/mandates`, { waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot(page, "10_mandates_overview.png");

    console.log("\n[EVIDENCE-S2] Seluruh tangkapan layar bukti UI berhasil disimpan ke:", OUTPUT_DIR);
  } catch (err) {
    console.error("[EVIDENCE-S2] Terjadi kesalahan:", err);
  } finally {
    await browser.close();
  }
}

main();

