// auth-guard-dokter.js - Penjaga Dashboard Dokter KlinikQue
// Kalo belum login sebagai dokter (Firebase Auth + doc /dokter approved), tendang ke login-dokter.html
// TIDAK lagi cek localStorage - localStorage bisa dipalsukan di console.
(function(){
  const path = window.location.pathname || "";
  if (path.includes("login-dokter") || path.endsWith("/") || path.includes("index.html")) return;

  let redirected = false;
  function tendang(){
    if (redirected) return;
    redirected = true;
    if (path.includes("/dokter/")) window.location.href = "login-dokter.html";
    else window.location.href = "dokter/login-dokter.html";
  }

  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const user = window.authOnline?.currentUser || window.fb?.auth?.currentUser || null;

    if (!user && tries < 50) return;
    clearInterval(iv);

    if (!user) { tendang(); return; }

    try {
      const db = window.dbOnline || (window.fb && window.fb.db) || null;
      if (db && window.fsGetDoc && window.fsDoc) {
        const snap = await window.fsGetDoc(window.fsDoc(db, "dokter", user.uid));
        if (!snap.exists()) {
          // Masih pending? Tolak masuk dashboard dokter
          const pend = await window.fsGetDoc(window.fsDoc(db, "dokterPending", user.uid));
          if (pend.exists()) { alert("Akun dokter masih menunggu ACC Admin."); }
          tendang(); return;
        }
        const d = snap.data() || {};
        if (d.status && d.status !== "approved" && d.status !== "Buka" && d.status !== "Tutup") {
          alert("Akun dokter belum aktif / belum di-ACC Admin.");
          tendang(); return;
        }
      }
      // Lolos - biarkan dashboard jalan
    } catch (e) {
      console.warn("Auth guard dokter: gagal cek doc dokter:", e);
      // Kalau Firestore error (offline), jangan tendang membabi buta -
      // user sudah terbukti login via Firebase Auth, biarkan masuk.
    }
  }, 100);
})();