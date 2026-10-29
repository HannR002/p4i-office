import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire("D:/nga-digital-studio/");
const puppeteer = require("puppeteer-core");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve("docs/evidence/sprint-1b/screenshots");
const LEGACY_DIR = path.resolve("docs/evidence/screenshots");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("[EVIDENCE] Menyiapkan folder bukti:", OUTPUT_DIR);
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(LEGACY_DIR)) {
    fs.mkdirSync(LEGACY_DIR, { recursive: true });
  }

  async function saveScreenshot(filename) {
    const p1 = path.join(OUTPUT_DIR, filename);
    const p2 = path.join(LEGACY_DIR, filename);
    await page.screenshot({ path: p1 });
    fs.copyFileSync(p1, p2);
  }

  console.log("[EVIDENCE] Memulai browser Chrome headless...");
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
    await saveScreenshot("01_login_page.png");

    // 2. Disabled Account Login Rejection
    console.log("2. Mengambil screenshot Penolakan Akun Nonaktif (DISABLED)...");
    await page.type('input[type="email"]', "disabled.test@p4i.local");
    await page.type('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await page.waitForSelector(".bg-rose-50", { timeout: 5000 });
    await sleep(300);
    await saveScreenshot("02_disabled_login_rejection.png");

    // 3. Login as Staf & Dashboard
    console.log("3. Masuk sebagai Staf dan membuka Dashboard...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type('input[type="email"]', "staf.test@p4i.local");
    await page.type('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot("03_dashboard_staf.png");

    // 4. Letters List
    console.log("4. Mengambil screenshot Daftar Surat (/letters)...");
    await page.goto(`${BASE_URL}/letters`, { waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot("04_letters_list.png");

    // 5. Create Draft Form
    console.log("5. Mengambil screenshot Form Buat Draf Surat Baru (/letters/new)...");
    await page.goto(`${BASE_URL}/letters/new`, { waitUntil: "networkidle0" });
    await page.waitForSelector('textarea', { timeout: 5000 });
    await sleep(500);
    await saveScreenshot("05_create_draft_form.png");

    // 6. Submit Draft Form & Open Detail
    console.log("6. Mengisi form draf dan membuat surat uji...");
    await page.type('input[placeholder*="Keterangan Selesai Magang"]', "Surat Keterangan Selesai Magang Riset Kebijakan Publik");
    await page.type('input[placeholder*="Budi Santoso"]', "Sdr. Rian Pratama (Universitas Indonesia)");
    await page.type('textarea', "Dengan ini menerangkan bahwa mahasiswa bersangkutan telah menyelesaikan kegiatan riset kebijakan publik periode semester gasal dengan kinerja Sangat Baik.");
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot("06_draft_detail_revisions.png");

    // Extract current letter ID from URL
    const currentUrl = page.url();
    const letterId = currentUrl.split("/").pop();
    console.log("   Draf dibuat dengan ID:", letterId);

    // 7. Draft Preview with Watermark
    console.log("7. Mengambil screenshot Pratinjau Draf dengan Watermark DRAF — BELUM RESMI...");
    await page.goto(`${BASE_URL}/letters/${letterId}/preview`, { waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot("07_draft_preview_watermark.png");

    // 8. Templates Catalog
    console.log("8. Mengambil screenshot Katalog Templat (/templates)...");
    await page.goto(`${BASE_URL}/templates`, { waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot("08_templates_catalog.png");

    // 9. Settings
    console.log("9. Mengambil screenshot Pengaturan Kebijakan Penomoran (/settings)...");
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot("09_settings_numbering_locked.png");

    // 10. Staf blocked from /users
    console.log("10. Mengambil screenshot Staf Dilarang Akses /users (403)...");
    await page.goto(`${BASE_URL}/users`, { waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot("10_staf_blocked_users.png");

    // 11. Admin login & Users Management
    console.log("11. Masuk sebagai Admin dan membuka Manajemen Pengguna (/users)...");
    const client = await page.target().createCDPSession();
    await client.send("Network.clearBrowserCookies");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type('input[type="email"]', "admin.test@p4i.local");
    await page.type('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle0" });
    await page.goto(`${BASE_URL}/users`, { waitUntil: "networkidle0" });
    await sleep(500);
    await saveScreenshot("11_users_management_admin.png");

    console.log("\n[EVIDENCE] SUKSES! Seluruh 11 tangkapan layar berhasil disimpan ke:", OUTPUT_DIR);
  } catch (err) {
    console.error("[EVIDENCE] Terjadi kesalahan:", err);
  } finally {
    await browser.close();
  }
}

main();
