const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
admin.initializeApp();
const db = admin.firestore();
const GMAIL_USER = "klinikque01@gmail.com";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";
const SITE_URL = process.env.SITE_URL || "https://antrian-pasien-d8698.web.app";
const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });
function hashOTP(otp){ return crypto.createHash("sha256").update(String(otp)).digest("hex"); }
function buatPSN(){ return "PSN-" + String(Math.floor(1000 + Math.random()*9000)); }
function buatOTP(){ return String(Math.floor(100000 + Math.random()*900000)); }
async function kirimEmailOTP(email, nama, psn, otp, uid){
  const link = `${SITE_URL}/codeverifikasi/verify-otp.html?uid=${encodeURIComponent(uid)}&email=${encodeURIComponent(email)}&psn=${encodeURIComponent(psn)}&nama=${encodeURIComponent(nama)}`;
  const html = `<div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0B1A2E;color:#fff;padding:24px;border-radius:16px">
  <h2 style="color:#22d3ee">KlinikQue - Verifikasi Akun Pasien</h2>
  <p>Halo <b>${nama}</b>,</p>
  <p>Akun pasien kamu berhasil dibuat. Ini ID login + OTP kamu:</p>
  <div style="background:#fff;color:#000;padding:16px;border-radius:12px;text-align:center">
  <div style="font-size:12px">ID LOGIN KAMU</div><div style="font-size:24px;font-weight:800;letter-spacing:2px">${psn}</div>
  <div style="font-size:12px;margin-top:12px">KODE OTP (berlaku 10 menit)</div><div style="font-size:32px;font-weight:800;letter-spacing:6px">${otp}</div>
  </div>
  <p style="text-align:center;margin-top:20px"><a href="${link}" style="background:#22d3ee;color:#000;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:800">KLIK VERIFIKASI SEKARANG</a></p>
  <p style="font-size:12px;color:#cbd5e1">Kalo tombol gak bisa diklik, copy link ini: <br>${link}</p>
  <p style="font-size:12px;color:#94a3b8">Jangan bagikan OTP ini ke siapa pun.</p></div>`;
  await transporter.sendMail({ from: `"KlinikQue" <${GMAIL_USER}>`, to: email, subject: `OTP + ID Pasien KlinikQue - ${psn}`, html });
}
exports.registerPasien = onRequest({ cors: true }, async (req, res) => {
  try{
    const { uid, nama, email } = req.body || {};
    if(!uid || !nama || !email) return res.status(400).json({ message: "Data tidak lengkap" });
    const psn = buatPSN(); const otp = buatOTP();
    await db.collection("pasienPending").doc(uid).set({ nama, email: String(email).toLowerCase(), psn, uid, role: "Pasien", status: "PENDING", otpHash: hashOTP(otp), otpVerified: false, otpExpiredAt: Date.now() + 10*60*1000, createdAt: Date.now() });
    await kirimEmailOTP(email, nama, psn, otp, uid);
    return res.json({ ok: true, psn });
  }catch(e){ console.error(e); return res.status(500).json({ message: "Gagal kirim email: " + e.message }); }
});
exports.verifyOTP = onRequest({ cors: true }, async (req, res) => {
  try{
    const { uid, email, otp } = req.body || {};
    if(!uid || !otp) return res.status(400).json({ message: "Data tidak lengkap" });
    const ref = db.collection("pasienPending").doc(uid);
    const snap = await ref.get();
    if(!snap.exists()) return res.status(404).json({ message: "Data pending tidak ditemukan. Daftar ulang." });
    const data = snap.data();
    if(Date.now() > data.otpExpiredAt) return res.status(400).json({ message: "OTP kadaluarsa. Klik Kirim Ulang OTP." });
    if(hashOTP(otp) !== data.otpHash) return res.status(400).json({ message: "OTP salah. Cek lagi email kamu." });
    await db.collection("pasien").doc(uid).set({ nama: data.nama, email: data.email, psn: data.psn, uid, role: "Pasien", status: "Active", otpVerified: true, emailVerified: true, createdAt: data.createdAt || Date.now(), verifiedAt: Date.now() });
    await ref.delete();
    return res.json({ ok: true, psn: data.psn });
  }catch(e){ console.error(e); return res.status(500).json({ message: e.message }); }
});
exports.resendOTP = onRequest({ cors: true }, async (req, res) => {
  try{
    const { uid, email } = req.body || {};
    const ref = db.collection("pasienPending").doc(uid);
    const snap = await ref.get();
    if(!snap.exists()) return res.status(404).json({ message: "Data pending tidak ditemukan." });
    const data = snap.data(); const otp = buatOTP();
    await ref.update({ otpHash: hashOTP(otp), otpExpiredAt: Date.now() + 10*60*1000 });
    await kirimEmailOTP(email || data.email, data.nama, data.psn, otp, uid);
    return res.json({ ok: true });
  }catch(e){ console.error(e); return res.status(500).json({ message: e.message }); }
});