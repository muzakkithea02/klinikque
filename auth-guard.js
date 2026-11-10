// auth-guard.js - Penjaga Dashboard Pasien KlinikQue
// Kalo belum login (Firebase Auth), tendang ke login-pasien.html
// TIDAK lagi cek localStorage - localStorage bisa dipalsukan di console.
(function(){
  // Jangan tendang kalau lagi di halaman login / index - guard ini cuma untuk dashboard
  const path = window.location.pathname || "";
  if (path.includes("login-pasien") || path.endsWith("/") || path.includes("index.html")) return;

  let redirected = false;
  function tendang(){
    if (redirected) return;
    redirected = true;
    // Pakai path relatif yang benar dari folder /pasien/
    if (path.includes("/pasien/")) window.location.href = "login-pasien.html";
    else window.location.href = "pasien/login-pasien.html";
  }

  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const user = window.authOnline?.currentUser || window.fb?.auth?.currentUser || null;

    // Auth belum siap, tunggu max ~5 detik (firebase-init.js load async)
    if (!user && tries < 50) return;
    clearInterval(iv);

    if (!user) { tendang(); return; }

    // User ada di Auth, tapi pastikan dia benar-benar pasien (punya doc /pasien/{uid})
    // Kalau tidak ada doc-nya, dia bukan pasien / akunnya sudah dihapus -> tendang
    try {
      const db = window.dbOnline || (window.fb && window.fb.db) || null;
      if (db && window.fsGetDoc && window.fsDoc) {
        const snap = await window.fsGetDoc(window.fsDoc(db, "pasien", user.uid));
        if (!snap.exists()) { tendang(); return; }
      }
      // Lolos - biarkan dashboard jalan
    } catch (e) {
      console.warn("Auth guard: gagal cek doc pasien:", e);
      // Kalau Firestore error (offline), jangan tendang membabi buta -
      // user sudah terbukti login via Firebase Auth, biarkan masuk.
      // Dashboard sendiri akan handle kalau data gagal load.
    }
  }, 100);
})();