/**
 * Modul Utilitas Biometrik WebAuthn (Fingerprint) - KlinikQue
 * FIX: Tanpa bypass. Gagal = false. Credential ID disimpan di Firestore, bukan cuma flag localStorage.
 * Cara pakai tetap sama:
 *   await window.KlinikQueBio.register(uid)
 *   const ok = await window.KlinikQueBio.authenticate(uid)
 * uid = Firebase Auth UID user (bukan email / nama).
 */

window.KlinikQueBio = {
  _isSecureContextOk() {
    return window.isSecureContext === true;
  },
  _bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    bytes.forEach(b => s += String.fromCharCode(b));
    return btoa(s);
  },
  _b64ToBuf(b64) {
    const s = atob(b64);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  },
  _getDB() {
    return window.dbOnline || (window.fb && window.fb.db) || null;
  },

  register: async function(uid) {
    if (!uid) { alert("Sesi login tidak ditemukan. Login dulu."); return false; }
    if (!this._isSecureContextOk()) {
      alert("Biometrik hanya bisa di HTTPS / localhost. Buka via HTTPS dulu.");
      return false;
    }
    if (!window.PublicKeyCredential || !navigator.credentials) {
      alert("Perangkat / browser ini tidak mendukung sidik jari (WebAuthn).");
      return false;
    }
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new TextEncoder().encode(uid);

      const createOptions = {
        challenge: challenge,
        rp: { name: "KlinikQue Medical System", id: window.location.hostname },
        user: { id: userId, name: uid, displayName: uid },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        attestation: "none",
        timeout: 60000
      };

      const cred = await navigator.credentials.create({ publicKey: createOptions });
      if (!cred) return false;

      const credentialIdB64 = this._bufToB64(cred.rawId);

      // Simpan credential ID ke Firestore (koleksi privat per-user, bukan localStorage doang)
      // Ini yang dipakai authenticate() untuk allowCredentials.
      // Public key attestation tidak disimpan mentah di client - verifikasi penuh butuh backend,
      // jadi modul ini dipakai sebagai "device unlock" + tetap wajib Firebase Auth.
      try {
        const db = this._getDB();
        if (db && window.fsSetDoc && window.fsDoc) {
          await window.fsSetDoc(window.fsDoc(db, "biometrik", uid), {
            uid: uid,
            credentialId: credentialIdB64,
            updatedAt: Date.now()
          }, { merge: true });
        }
      } catch (e) { console.warn("Gagal simpan credential ke Firestore:", e); }

      // Simpan juga sebagai hint lokal (bukan bukti login) - kalau ini dihapus, authenticate tetap cek Firestore
      try { localStorage.setItem(`klinikque_bio_${uid}`, credentialIdB64); } catch (e) {}

      return true;
    } catch (err) {
      console.warn("WebAuthn register gagal / dibatalkan:", err);
      // TIDAK ADA BYPASS - batal = gagal
      if (err && err.name === "NotAllowedError") alert("Pendaftaran sidik jari dibatalkan.");
      else alert("Gagal daftar sidik jari: " + (err.message || err));
      return false;
    }
  },

  authenticate: async function(uid) {
    if (!uid) { alert("Sesi login tidak ditemukan. Login dulu."); return false; }
    if (!this._isSecureContextOk()) {
      alert("Biometrik hanya bisa di HTTPS / localhost.");
      return false;
    }
    if (!window.PublicKeyCredential || !navigator.credentials) {
      alert("Perangkat / browser ini tidak mendukung sidik jari (WebAuthn).");
      return false;
    }
    try {
      // Ambil credential ID yang terdaftar - utamakan Firestore, fallback localStorage hint
      let credentialIdB64 = null;
      try {
        const db = this._getDB();
        if (db && window.fsGetDoc && window.fsDoc) {
          const snap = await window.fsGetDoc(window.fsDoc(db, "biometrik", uid));
          if (snap.exists()) credentialIdB64 = snap.data().credentialId || null;
        }
      } catch (e) {}
      if (!credentialIdB64) {
        try { credentialIdB64 = localStorage.getItem(`klinikque_bio_${uid}`); } catch (e) {}
      }
      if (!credentialIdB64) {
        alert("Akun ini belum terdaftar sidik jari di perangkat ini.");
        return false;
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: "required",
          rpId: window.location.hostname,
          allowCredentials: [{ id: this._b64ToBuf(credentialIdB64), type: "public-key" }]
        }
      });

      // Kalau sampai sini, authenticator berhasil verifikasi user.
      // PENTING: Ini BUKAN pengganti login Firebase Auth.
      // Di halaman login, setelah ini tetap wajib signInWithEmailAndPassword / sesi Auth masih aktif.
      return !!assertion;
    } catch (err) {
      console.warn("Autentikasi biometrik gagal / dibatalkan:", err);
      // TIDAK ADA BYPASS - gagal = false
      if (err && err.name === "NotAllowedError") alert("Verifikasi sidik jari dibatalkan / gagal.");
      else alert("Verifikasi sidik jari gagal: " + (err.message || err));
      return false;
    }
  },

  unregister: async function(uid) {
    if (!uid) return false;
    try { localStorage.removeItem(`klinikque_bio_${uid}`); } catch (e) {}
    try {
      const db = this._getDB();
      if (db && window.fsDeleteDoc && window.fsDoc) {
        await window.fsDeleteDoc(window.fsDoc(db, "biometrik", uid));
      }
    } catch (e) {}
    return true;
  }
};