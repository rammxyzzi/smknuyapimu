// =========================================================
// Alur: 1) wajib login  2) cek radius GPS ke sekolah
// 3) pindai wajah (face-api.js) & cocokkan dengan descriptor
// tersimpan (atau daftarkan kalau siswa belum pernah daftar
// wajah) 4) simpan hasil presensi ke tabel `attendance`.
//
// PENTING: pengecekan lokasi & wajah di file ini berjalan di
// browser siswa, jadi bisa dimanipulasi orang yang paham
// devtools. Untuk keamanan production, ulangi validasi radius
// & kecocokan wajah di sisi server (Supabase Edge Function /
// RPC) sebelum baris attendance benar-benar disimpan — lihat
// catatan di README.
// =========================================================

const AMBANG_KECOCOKAN_WAJAH = 0.5; // makin kecil, makin ketat

let sesiUser = null;
let dataSiswa = null;
let pengaturanSekolah = null;
let lokasiSaatIni = null;
let modelSiap = false;
let sedangMemindai = false;

const elStatusLokasi = document.getElementById("statusLokasi");
const elBtnCekLokasi = document.getElementById("btnCekLokasi");
const elLangkahLokasi = document.getElementById("langkahLokasi");
const elLangkahWajah = document.getElementById("langkahWajah");
const elLangkahHasil = document.getElementById("langkahHasil");
const elStatusWajah = document.getElementById("statusWajah");
const elStatusWajahTeks = document.getElementById("statusWajahTeks");
const elBtnPindai = document.getElementById("btnPindai");
const elKeteranganWajah = document.getElementById("keteranganWajah");
const elKameraBungkus = document.getElementById("kameraBungkus");
const video = document.getElementById("video");

function setLampu(el, kondisi) {
  const lampu = el.querySelector(".lampu");
  lampu.className = "lampu " + kondisi; // "", "ok", "gagal", "proses"
}
function setTitikAktif(n) {
  for (let i = 1; i <= 3; i++) {
    document.getElementById("titik" + i).classList.toggle("aktif", i <= n);
  }
}

// ---------- Inisialisasi halaman ----------
(async function mulai() {
  sesiUser = await wajibLogin();
  if (!sesiUser) return;

  document.getElementById("namaSiswa").textContent = sesiUser.user.email;
  document.getElementById("btnKeluar").addEventListener("click", async (e) => {
    e.preventDefault();
    await sb.auth.signOut();
    window.location.href = "login.html";
  });

  // Ambil profil siswa (nama, face_descriptor tersimpan)
  const { data: siswa, error: errSiswa } = await sb
    .from("students")
    .select("*")
    .eq("id", sesiUser.user.id)
    .single();

  if (errSiswa || !siswa) {
    elStatusLokasi.querySelector("span:last-child").textContent =
      "Profil siswa belum terdaftar. Hubungi admin.";
    setLampu(elStatusLokasi, "gagal");
    elBtnCekLokasi.disabled = true;
    return;
  }
  dataSiswa = siswa;

  // Ambil titik koordinat & radius sekolah
  const { data: pengaturan } = await sb
    .from("school_settings")
    .select("*")
    .eq("id", 1)
    .single();
  pengaturanSekolah = pengaturan;

  // Mulai load model face-api di background sambil siswa cek lokasi
  muatModelWajah();
})();

// ---------- Langkah 1: cek lokasi ----------
elBtnCekLokasi.addEventListener("click", () => {
  setLampu(elStatusLokasi, "proses");
  elStatusLokasi.querySelector("span:last-child").textContent = "Mengambil lokasi GPS…";
  elBtnCekLokasi.disabled = true;

  if (!navigator.geolocation) {
    setLampu(elStatusLokasi, "gagal");
    elStatusLokasi.querySelector("span:last-child").textContent =
      "Perangkat tidak mendukung GPS.";
    elBtnCekLokasi.disabled = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (posisi) => {
      lokasiSaatIni = {
        lat: posisi.coords.latitude,
        lon: posisi.coords.longitude,
        akurasi: posisi.coords.accuracy,
      };

      const titikSekolah = pengaturanSekolah || {
        latitude: -6.2, // fallback contoh — SEHARUSNYA diisi lewat dashboard admin
        longitude: 106.8,
        radius_meter: RADIUS_FALLBACK_METER,
      };

      const jarak = hitungJarakMeter(
        lokasiSaatIni.lat,
        lokasiSaatIni.lon,
        titikSekolah.latitude,
        titikSekolah.longitude
      );
      lokasiSaatIni.jarak = jarak;

      const radius = titikSekolah.radius_meter || RADIUS_FALLBACK_METER;

      if (jarak <= radius) {
        setLampu(elStatusLokasi, "ok");
        elStatusLokasi.querySelector("span:last-child").textContent =
          `Di dalam area sekolah (± ${Math.round(jarak)} m dari titik pusat).`;
        setTimeout(lanjutKeWajah, 700);
      } else {
        setLampu(elStatusLokasi, "gagal");
        elStatusLokasi.querySelector("span:last-child").textContent =
          `Kamu ${Math.round(jarak)} m dari sekolah, melebihi radius ${radius} m yang diizinkan.`;
        elBtnCekLokasi.disabled = false;
        elBtnCekLokasi.textContent = "Coba Lagi";
      }
    },
    (err) => {
      setLampu(elStatusLokasi, "gagal");
      elStatusLokasi.querySelector("span:last-child").textContent =
        "Izin lokasi ditolak. Aktifkan GPS & izinkan akses lokasi di browser.";
      elBtnCekLokasi.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
});

function lanjutKeWajah() {
  elLangkahLokasi.style.display = "none";
  elLangkahWajah.style.display = "block";
  setTitikAktif(2);
  mulaiKamera();

  // Kalau siswa belum pernah daftar wajah, ubah copy jadi mode pendaftaran
  if (!dataSiswa.face_descriptor) {
    elKeteranganWajah.textContent =
      "Wajahmu belum terdaftar. Ini akan jadi pendaftaran wajah pertamamu — pastikan pencahayaan bagus.";
  }
}

// ---------- Langkah 2: kamera & model wajah ----------
async function muatModelWajah() {
  const BASE = "./models"; // lihat README: unduh model face-api.js ke folder ini
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(BASE),
      faceapi.nets.faceLandmark68Net.loadFromUri(BASE),
      faceapi.nets.faceRecognitionNet.loadFromUri(BASE),
    ]);
    modelSiap = true;
    elStatusWajahTeks.textContent = "Model siap. Arahkan wajah ke kamera.";
    elBtnPindai.disabled = false;
  } catch (e) {
    elStatusWajahTeks.textContent =
      "Gagal memuat model wajah. Cek folder /models (lihat README).";
    console.error(e);
  }
}

async function mulaiKamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });
    video.srcObject = stream;
  } catch (e) {
    elStatusWajahTeks.textContent = "Tidak bisa mengakses kamera. Izinkan akses kamera.";
    console.error(e);
  }
}

elBtnPindai.addEventListener("click", pindaiWajah);

async function pindaiWajah() {
  if (!modelSiap || sedangMemindai) return;
  sedangMemindai = true;
  elBtnPindai.disabled = true;
  setLampu(elStatusWajah, "proses");
  elStatusWajahTeks.textContent = "Mendeteksi wajah…";

  const deteksi = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!deteksi) {
    setLampu(elStatusWajah, "gagal");
    elStatusWajahTeks.textContent = "Wajah tidak terdeteksi. Coba lagi, dekatkan wajah ke kamera.";
    elBtnPindai.disabled = false;
    sedangMemindai = false;
    return;
  }

  const descriptorBaru = Array.from(deteksi.descriptor);

  // Kasus 1: siswa belum punya wajah tersimpan -> daftarkan sekarang
  if (!dataSiswa.face_descriptor) {
    const { error } = await sb
      .from("students")
      .update({ face_descriptor: descriptorBaru })
      .eq("id", sesiUser.user.id);

    if (error) {
      setLampu(elStatusWajah, "gagal");
      elStatusWajahTeks.textContent = "Gagal menyimpan data wajah. Coba lagi.";
      elBtnPindai.disabled = false;
      sedangMemindai = false;
      return;
    }

    dataSiswa.face_descriptor = descriptorBaru;
    setLampu(elStatusWajah, "ok");
    elKameraBungkus.classList.add("cocok");
    elStatusWajahTeks.textContent = "Wajah berhasil didaftarkan. Melanjutkan presensi…";
    setTimeout(() => simpanPresensi(true), 600);
    return;
  }

  // Kasus 2: cocokkan dengan descriptor tersimpan
  const descriptorLama = new Float32Array(dataSiswa.face_descriptor);
  const jarakWajah = faceapi.euclideanDistance(descriptorLama, descriptorBaru);

  if (jarakWajah <= AMBANG_KECOCOKAN_WAJAH) {
    setLampu(elStatusWajah, "ok");
    elKameraBungkus.classList.add("cocok");
    elStatusWajahTeks.textContent = "Wajah cocok. Menyimpan presensi…";
    setTimeout(() => simpanPresensi(false), 500);
  } else {
    setLampu(elStatusWajah, "gagal");
    elKameraBungkus.classList.add("gagal");
    elStatusWajahTeks.textContent = "Wajah tidak cocok dengan data terdaftar. Coba lagi.";
    elBtnPindai.disabled = false;
    sedangMemindai = false;
  }
}

// ---------- Langkah 3: simpan ke tabel attendance ----------
async function simpanPresensi(pendaftaranBaru) {
  matikanKamera();

  const jamMasuk = pengaturanSekolah?.jam_masuk || "07:00:00";
  const sekarang = new Date();
  const jamSekarang = sekarang.toTimeString().slice(0, 8);
  const status = jamSekarang > jamMasuk ? "telat" : "hadir";

  const { error } = await sb.from("attendance").insert({
    student_id: sesiUser.user.id,
    tanggal: sekarang.toISOString().slice(0, 10),
    status,
    latitude: lokasiSaatIni.lat,
    longitude: lokasiSaatIni.lon,
    jarak_meter: Math.round(lokasiSaatIni.jarak),
  });

  elLangkahWajah.style.display = "none";
  elLangkahHasil.style.display = "block";
  setTitikAktif(3);

  if (error) {
    document.getElementById("judulHasil").textContent = "Presensi gagal disimpan";
    document.getElementById("deskripsiHasil").textContent =
      "Terjadi kesalahan saat menyimpan. Coba absen ulang atau hubungi admin.";
    console.error(error);
    return;
  }

  document.getElementById("judulHasil").textContent =
    status === "hadir" ? "Presensi berhasil ✓" : "Presensi tercatat (telat)";
  document.getElementById("deskripsiHasil").textContent = pendaftaranBaru
    ? "Wajahmu sudah terdaftar dan presensi hari ini tersimpan."
    : `Tercatat pukul ${jamSekarang.slice(0, 5)} — jarak ${Math.round(lokasiSaatIni.jarak)} m dari sekolah.`;
}

function matikanKamera() {
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach((t) => t.stop());
}
