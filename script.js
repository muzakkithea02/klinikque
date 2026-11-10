// script.js - KlinikQue
// Semua dari Firestore + Firebase Auth. localStorage hanya cache tampilan.

let familyProfiles = [];
let activePatient = null;
let currentCategory = "";
let selectedDoctorObject = null;

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-cyan-400');
        btn.classList.add('text-slate-300');
        const span = btn.querySelector('span');
        if (span) { span.classList.remove('font-bold'); span.classList.add('font-medium'); }
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-300');
        activeBtn.classList.add('text-cyan-400');
        const activeSpan = activeBtn.querySelector('span');
        if (activeSpan) { activeSpan.classList.remove('font-medium'); activeSpan.classList.add('font-bold'); }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openFamilyModal() {
    const modal = document.getElementById('family-modal');
    const container = document.getElementById('family-list-container');
    if (!modal || !container) return;
    container.innerHTML = "";
    if (familyProfiles.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">Belum ada profil keluarga. Silakan login ulang.</div>`;
    }
    familyProfiles.forEach((fam, idx) => {
        const isSelected = activePatient && fam.noRM === activePatient.noRM;
        container.innerHTML += `
            <div onclick="switchActiveProfile(${idx})" class="p-4 rounded-2xl bg-white/5 border ${isSelected ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 hover:border-white/30'} cursor-pointer transition-all flex items-center justify-between">
                <div>
                    <h4 class="font-bold text-white text-sm">${fam.name}</h4>
                    <p class="text-[11px] text-cyan-300 mt-0.5">No. RM: ${fam.noRM} • <span class="text-slate-400">${fam.relation || 'Utama'}</span></p>
                </div>
                ${isSelected ? '<span class="text-xs px-2.5 py-1 rounded-full bg-cyan-500 text-slate-950 font-bold">Aktif</span>' : '<span class="text-xs text-slate-400">Pilih</span>'}
            </div>`;
    });
    modal.classList.remove('hidden');
}
function closeFamilyModal() {
    const m = document.getElementById('family-modal');
    if (m) m.classList.add('hidden');
}
function switchActiveProfile(index) {
    activePatient = familyProfiles[index];
    updateActiveProfileUI();
    closeFamilyModal();
    loadPatientHistoryFromCloud();
}
function updateActiveProfileUI() {
    if (!activePatient) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set('user-display-name', activePatient.name);
    set('header-patient-rm', `RM: ${activePatient.noRM}`);
    set('active-profile-label', activePatient.name.split(' ')[0]);
    set('profile-name-title', activePatient.name);
    set('profile-email-subtitle', activePatient.email || '-');
    const inp = document.getElementById('input-profile-name');
    if (inp) inp.value = activePatient.name;
}
function addNewFamilyMember() {
    alert("Penambahan anggota keluarga lewat Dev / pendaftaran resmi supaya No. RM tidak kembar.\nSilakan hubungi Dev KlinikQue.");
    return;
}

function getTanggalWIB(){
  const now = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Jakarta'}));
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,'0');
  const d = String(now.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function getTanggalWIBPanjang(){
  return new Date().toLocaleDateString('id-ID', { timeZone:'Asia/Jakarta', weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

async function openDoctorModal(category) {
    currentCategory = category;
    const modal = document.getElementById('doctor-modal');
    const title = document.getElementById('modal-category-title');
    const listContainer = document.getElementById('modal-doctors-list');
    if (!modal || !listContainer) return;
    if (title) title.innerText = `Spesialis: ${category}`;
    listContainer.innerHTML = '<div class="text-center text-slate-400 text-xs py-4">Sinkronisasi data dokter dari cloud...</div>';
    modal.classList.remove('hidden');
    try {
        if (window.dbOnline && window.fsGetDocs && window.fsCollection && window.fsQuery && window.fsWhere) {
            const q = window.fsQuery(window.fsCollection(window.dbOnline, "dokter"), window.fsWhere("spesialis", "==", category));
            const qs = await window.fsGetDocs(q);
            listContainer.innerHTML = '';
            let found = 0;
            qs.forEach((docSnap) => {
                let d = docSnap.data();
                if (d.status && d.status !== 'approved' && d.status !== 'Buka' && d.status !== 'Tutup') return;
                found++;
                let isOpen = d.isPracticeActive !== false && !d.darurat;
                let statusText = isOpen ? "Buka (ON)" : "Tutup (OFF)";
                let statusColor = isOpen ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/20 text-red-300 border-red-500/30";
                const publik = { id: docSnap.id, nama: d.nama, spesialis: d.spesialis, jam: d.jam, cuti: d.cuti, darurat: d.darurat, isPracticeActive: d.isPracticeActive, foto: d.foto || d.avatar || d.photoURL || "" };
                let safe = JSON.stringify(publik).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                listContainer.innerHTML += `
                    <div onclick="selectDoctorFromCloud(JSON.parse(this.dataset.doc.replace(/&quot;/g,'&quot;')))" data-doc="${safe}" class="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-400 hover:bg-white/10 cursor-pointer transition-all flex items-center justify-between backdrop-blur-md">
                        <div>
                            <div class="flex items-center space-x-2">
                                <h4 class="font-bold text-white text-sm">${d.nama}</h4>
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusColor}">${statusText}</span>
                            </div>
                            <p class="text-xs text-cyan-400 mt-0.5">${d.spesialis}</p>
                            <p class="text-[10px] text-slate-400 mt-1"><i class="fa-solid fa-clock mr-1"></i>${d.jam || '08:00 - 16:00 WIB'}</p>
                        </div>
                        <span class="text-xs px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold shrink-0">Pilih</span>
                    </div>`;
            });
            if (found === 0) listContainer.innerHTML = `<div class="text-center text-slate-400 text-xs py-4">Belum ada data dokter terdaftar untuk spesialis ${category} di database.</div>`;
        }
    } catch (err) {
        console.error("Gagal memuat dokter:", err);
        listContainer.innerHTML = `<div class="text-center text-red-400 text-xs py-4">Gagal memuat data dari cloud.</div>`;
    }
}
function closeDoctorModal() {
    const m = document.getElementById('doctor-modal');
    if (m) m.classList.add('hidden');
}
function selectDoctorFromCloud(docObj) {
    selectedDoctorObject = docObj;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    const inp = document.getElementById('selected-doctor-input');
    if (inp) inp.value = docObj.nama;
    if (inp) inp.dataset.dokterId = docObj.id || "";
    set('preview-doctor-name', `${docObj.nama} (${docObj.spesialis})`);
    const statusEl = document.getElementById('preview-doctor-status');
    const hoursEl = document.getElementById('preview-doctor-hours');
    const leaveEl = document.getElementById('preview-doctor-leave');
    const emergencyBanner = document.getElementById('patient-emergency-banner');
    const emergencyText = document.getElementById('patient-emergency-text');
    const submitBtn = document.getElementById('btn-submit-booking');
    if (hoursEl) hoursEl.innerText = docObj.jam || "08:00 - 16:00 WIB";
    if (leaveEl) leaveEl.innerText = docObj.cuti || "Tidak ada jadwal cuti aktif";
    const isClosed = docObj.isPracticeActive === false || !!docObj.darurat;
    if (statusEl) {
        statusEl.innerText = isClosed ? "Tutup / Darurat (OFF)" : "Praktik Buka (ON)";
        statusEl.className = isClosed ? "px-3 py-1 rounded-full text-xs font-bold uppercase bg-red-500/20 text-red-300 border border-red-500/40" : "px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
    }
    if (isClosed) {
        if (emergencyText) emergencyText.innerText = `PENGUMUMAN (${docObj.nama}): ${docObj.darurat || 'Praktik sedang ditutup sementara.'}`;
        if (emergencyBanner) emergencyBanner.classList.remove('hidden');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('opacity-55', 'cursor-not-allowed'); }
    } else {
        if (emergencyBanner) emergencyBanner.classList.add('hidden');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('opacity-55', 'cursor-not-allowed'); }
    }
    const prev = document.getElementById('selected-doctor-preview');
    if (prev) prev.classList.remove('hidden');
    closeDoctorModal();
}

async function getNextQueueNumber(dokterId) {
    const todayWIB = getTanggalWIB();
    const counterId = `antrian_${todayWIB}_${dokterId || 'umum'}`;
    const counterRef = window.fsDoc(window.dbOnline, "counters", counterId);
    let newNum = 1;
    await window.fsRunTransaction(window.dbOnline, async (tx) => {
        const snap = await tx.get(counterRef);
        if (!snap.exists() || snap.data().date !== todayWIB) {
            tx.set(counterRef, { date: todayWIB, dokterId: dokterId || 'umum', last: 1 });
            newNum = 1;
        } else {
            newNum = (snap.data().last || 0) + 1;
            tx.update(counterRef, { last: newNum });
        }
    });
    return `A-${String(newNum).padStart(2, '0')}`;
}

async function handleBooking(event) {
    event.preventDefault();
    if (!activePatient) { alert("Sesi pasien tidak ditemukan. Silakan login ulang."); return; }
    if (selectedDoctorObject && (selectedDoctorObject.isPracticeActive === false || selectedDoctorObject.darurat)) {
        alert("Maaf, dokter pilihan Anda sedang tutup atau dalam status darurat.");
        return;
    }
    const selectedDoctor = document.getElementById('selected-doctor-input')?.value;
    const selectedDokterId = document.getElementById('selected-doctor-input')?.dataset?.dokterId || selectedDoctorObject?.id || "";
    const selectedTimeInput = document.querySelector('input[name="selected_time"]:checked');
    const paymentInput = document.querySelector('input[name="payment_type"]:checked');
    if (!selectedDoctor || !selectedTimeInput || !paymentInput) {
        alert('Silakan lengkapi pilihan dokter spesialis, sesi waktu, dan jenis jaminan pembayaran!');
        return;
    }
    try {
        const todayWIB = getTanggalWIB();
        if (window.dbOnline && window.fsQuery && window.fsWhere) {
          const qCek = window.fsQuery(window.fsCollection(window.dbOnline, "antrian"),
            window.fsWhere("noRM", "==", activePatient.noRM),
            window.fsWhere("tanggalWIB", "==", todayWIB),
            window.fsWhere("status", "==", "Menunggu"));
          const cekSnap = await window.fsGetDocs(qCek);
          if (!cekSnap.empty) { alert("Kamu sudah punya antrean aktif hari ini. Cek di tab Antrean."); switchTab('antrian'); return; }
        }
        const formattedQueue = await getNextQueueNumber(selectedDokterId);
        const todayFormatted = getTanggalWIBPanjang();
        const ticketData = {
            number: formattedQueue,
            name: activePatient.name,
            noRM: activePatient.noRM,
            doctor: selectedDoctor,
            dokterId: selectedDokterId,
            pasienUid: (window.authOnline && window.authOnline.currentUser) ? window.authOnline.currentUser.uid : (activePatient.uid || ""),
            time: selectedTimeInput.value,
            payment: paymentInput.value,
            date: todayFormatted,
            tanggalWIB: todayWIB,
            note: "Antrean Terverifikasi"
        };
        try { localStorage.setItem('klinikque_active_ticket_cache', JSON.stringify(ticketData)); } catch(e){}
        await pushQueueToFirebase(ticketData);
        renderTicket(ticketData);
        alert(`Berhasil! Nomor antrean Anda adalah ${formattedQueue} (${paymentInput.value}).`);
        switchTab('antrian');
    } catch (e) {
        console.error(e);
        alert("Gagal mengambil nomor antrean. Coba lagi.");
    }
}

async function pushQueueToFirebase(ticket) {
    try {
        if (window.dbOnline && window.fsAddDoc && window.fsCollection) {
            await window.fsAddDoc(window.fsCollection(window.dbOnline, "antrian"), {
                nomorAntrian: ticket.number,
                nomor: ticket.number,
                namaPasien: ticket.name,
                noRM: ticket.noRM,
                dokter: ticket.doctor,
                dokterId: ticket.dokterId || "",
                pasienUid: ticket.pasienUid || "",
                waktu: ticket.time,
                payment: ticket.payment,
                tanggal: ticket.date,
                tanggalWIB: ticket.tanggalWIB || getTanggalWIB(),
                status: "Menunggu",
                createdAt: Date.now()
            });
        }
    } catch (err) { console.error("Gagal mengirim antrean ke cloud:", err); }
}

function renderTicket(ticket) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set('queue-number', ticket.number);
    set('ticket-patient-name', ticket.name);
    set('ticket-patient-rm', ticket.noRM);
    set('queue-doctor', ticket.doctor);
    set('queue-time', ticket.time);
    set('queue-date', ticket.date);
    set('ticket-payment-badge', ticket.payment);
    document.getElementById('no-active-queue')?.classList.add('hidden');
    document.getElementById('active-queue-card')?.classList.remove('hidden');
    document.getElementById('home-active-ticket-widget')?.classList.remove('hidden');
    set('home-ticket-num', `${ticket.number} - ${ticket.name} (${ticket.payment})`);
    set('home-ticket-time', `Sesi: ${ticket.time}`);
}

function loadPatientHistoryFromCloud() {
    const container = document.getElementById('history-list-container');
    if (!container || !activePatient) return;
    container.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">Memuat riwayat...</div>`;
    try {
        if (!window.dbOnline || !window.fsQuery) return;
        const q = window.fsQuery(window.fsCollection(window.dbOnline, "riwayatSelesai"), window.fsWhere("noRM", "==", activePatient.noRM));
        window.fsOnSnapshot(q, (qs) => {
            container.innerHTML = "";
            let count = 0;
            qs.forEach((docSnap) => {
                const data = docSnap.data();
                count++;
                const formattedDate = data.createdAt ? new Date(data.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Hari Ini';
                container.innerHTML += `
                    <div class="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3 text-xs">
                        <div class="flex items-center justify-between border-b border-white/10 pb-2">
                            <span class="font-bold text-cyan-300"><i class="fa-solid fa-calendar-days mr-1"></i> ${formattedDate}</span>
                            <span class="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">Selesai</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><span class="text-slate-400 block text-[10px] uppercase font-semibold">Pasien / No. RM:</span><span class="font-bold text-white text-sm">${data.namaPasien || activePatient.name} (${data.noRM || activePatient.noRM})</span></div>
                            <div><span class="text-slate-400 block text-[10px] uppercase font-semibold">Dokter Pemeriksa:</span><span class="font-bold text-white text-sm">${data.dokter || 'Dokter Mitra'}</span></div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div><span class="text-slate-400 block text-[10px] uppercase font-semibold">Diagnosa SOAP:</span><span class="text-slate-200 font-medium">${data.diagnosaSOAP || '-'}</span></div>
                            <div class="p-2.5 rounded-xl bg-black/30 border border-white/10"><span class="text-amber-400 block text-[10px] uppercase font-bold mb-0.5"><i class="fa-solid fa-pills mr-1"></i> E-Resep Obat:</span><span class="text-amber-200 font-semibold">${data.eResep || 'Tidak ada resep obat'}</span></div>
                        </div>
                    </div>`;
            });
            if (count === 0) {
                container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs border border-dashed border-white/15 rounded-2xl backdrop-blur-md">Belum ada riwayat kunjungan medis untuk <strong>${activePatient.name}</strong> di cloud.</div>`;
            }
        });
    } catch (err) {
        console.error("Gagal memuat riwayat cloud:", err);
        container.innerHTML = `<div class="p-4 text-center text-red-400 text-xs">Gagal menyinkronkan riwayat dari Firestore.</div>`;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const savedSession = JSON.parse(localStorage.getItem('klinikque_current_patient') || 'null');
    if (savedSession && savedSession.nama) {
        familyProfiles = [{ name: savedSession.nama, email: savedSession.email || '', noRM: savedSession.noRM || '', relation: "Utama", uid: savedSession.uid || "" }];
        activePatient = familyProfiles[0];
        updateActiveProfileUI();
    }
    const savedTicket = localStorage.getItem('klinikque_active_ticket_cache') || localStorage.getItem('klinikque_active_ticket');
    if (savedTicket) { try { renderTicket(JSON.parse(savedTicket)); } catch(e){} }
    if (activePatient) loadPatientHistoryFromCloud();
});

function updateProfile(event) {
    event.preventDefault();
    if (!activePatient) return;
    activePatient.name = document.getElementById('input-profile-name').value;
    document.getElementById('user-display-name').innerText = activePatient.name;
    document.getElementById('profile-name-title').innerText = activePatient.name;
    try { localStorage.setItem('klinikque_current_patient', JSON.stringify({ nama: activePatient.name, email: activePatient.email, noRM: activePatient.noRM, uid: activePatient.uid || "" })); } catch(e){}
    alert('Profil pasien berhasil diperbarui.');
}