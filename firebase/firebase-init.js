import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC1x-6x4mdrcQZDzyRUXu6AYEvjBV0jS-s",
  authDomain: "antrian-pasien-d8698.firebaseapp.com",
  projectId: "antrian-pasien-d8698",
  storageBucket: "antrian-pasien-d8698.firebasestorage.app",
  messagingSenderId: "989793471331",
  appId: "1:989793471331:web:67f9a6f11f0507c0ad6156"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.fb = { app, db, auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail };
window.dbOnline = db;
window.authOnline = auth;
window.signInFirebase = signInWithEmailAndPassword;
window.createUserFirebase = createUserWithEmailAndPassword;
window.fsCollection = collection;
window.fsDoc = doc;
window.fsGetDoc = getDoc;
window.fsGetDocs = getDocs;
window.fsSetDoc = setDoc;
window.fsAddDoc = addDoc;
window.fsUpdateDoc = updateDoc;
window.fsDeleteDoc = deleteDoc;
window.fsOnSnapshot = onSnapshot;
window.fsQuery = query;
window.fsWhere = where;
window.fsOrderBy = orderBy;
window.fsLimit = limit;
window.fsRunTransaction = runTransaction;
window.fsServerTimestamp = serverTimestamp;

window.getTodayWIB = function(){
  const now = new Date();
  const wib = new Date(now.toLocaleString('en-US',{timeZone:'Asia/Jakarta'}));
  const y = wib.getFullYear();
  const m = String(wib.getMonth()+1).padStart(2,'0');
  const d = String(wib.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
};
window.getTodayDisplayWIB = function(){
  return new Date().toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta', weekday:'long', day:'numeric', month:'long', year:'numeric'});
};
window.getCurrentUid = function(){ return auth.currentUser ? auth.currentUser.uid : null; };
window.requireLogin = function(){
  if(!auth.currentUser){ window.location.href = "/pasien/login-pasien.html"; return false; }
  return true;
};

// VERSI TANPA STORAGE: ubah file jadi teks gambar, disimpan di Firestore
function fileKeBase64Kecil(file, maxWidth=900, kualitas=0.7){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if(w > maxWidth){ h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', kualitas));
      };
      img.onerror = ()=> reject(new Error("Gagal baca gambar"));
      img.src = reader.result;
    };
    reader.onerror = ()=> reject(new Error("Gagal baca file"));
    reader.readAsDataURL(file);
  });
}

window.uploadFotoKeFirebase = async function(file, folder){
  if(!file) return "";
  if(file.size > 3 * 1024 * 1024) throw new Error("Foto maksimal 3MB. Pilih foto yang lebih kecil.");
  const hasil = await fileKeBase64Kecil(file);
  if(hasil.length > 900000) throw new Error("Foto masih terlalu besar setelah dikompres. Coba foto yang lebih kecil / lebih gelap dikit.");
  return hasil;
};
window.uploadFotoDokumen = window.uploadFotoKeFirebase;

window.logoutBersih = async function(redirectUrl){
  try{ await signOut(auth); }catch(e){}
  try{
    const keys = [];
    for(let i=0;i<localStorage.length;i++){ keys.push(localStorage.key(i)); }
    keys.forEach(k=>{ if(k && k.toLowerCase().includes('klinikque')) localStorage.removeItem(k); });
  }catch(e){}
  try{ sessionStorage.clear(); }catch(e){}
  if(redirectUrl) window.location.href = redirectUrl;
  else location.reload();
};
console.log("Firebase KlinikQue loaded - TANPA STORAGE");