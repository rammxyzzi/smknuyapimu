// =========================================================
// Konfigurasi Supabase — GANTI dua nilai di bawah ini dengan
// milik proyek Supabase kamu sendiri (Project Settings > API).
// File ini di-load sebagai <script> biasa (bukan module) di
// setiap halaman, setelah CDN supabase-js.
// =========================================================
const SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "isi-anon-public-key-di-sini";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Client kedua khusus untuk membuat akun siswa baru dari dashboard admin.
// persistSession:false supaya proses signUp() tidak menimpa/menggeser sesi
// admin yang sedang login di `sb` (kalau pakai `sb` biasa, signUp bisa
// membuat browser "pindah login" ke akun siswa yang baru dibuat).
const sbBuatAkun = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Radius default (meter) dipakai sebagai fallback kalau tabel
// school_settings belum diisi. Nilai asli tetap diambil dari DB.
const RADIUS_FALLBACK_METER = 100;

/**
 * Ambil sesi user yang sedang login. Kembalikan null kalau belum login.
 */
async function ambilSesi() {
  const { data } = await sb.auth.getSession();
  return data.session || null;
}

/**
 * Paksa redirect ke login.html kalau belum ada sesi.
 * Panggil di awal halaman yang butuh login (absen.html).
 */
async function wajibLogin(tujuanJikaGagal = "login.html") {
  const sesi = await ambilSesi();
  if (!sesi) {
    window.location.href = tujuanJikaGagal;
    return null;
  }
  return sesi;
}

/**
 * Cek apakah user yang login punya role admin, lewat tabel user_roles.
 * Redirect ke login kalau bukan admin / belum login.
 */
async function wajibAdmin(tujuanJikaGagal = "../login.html") {
  const sesi = await ambilSesi();
  if (!sesi) {
    window.location.href = tujuanJikaGagal;
    return null;
  }
  const { data, error } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", sesi.user.id)
    .single();

  if (error || !data || data.role !== "admin") {
    window.location.href = tujuanJikaGagal;
    return null;
  }
  return sesi;
}

/**
 * Hitung jarak antara dua koordinat pakai formula Haversine.
 * Hasil dalam meter.
 */
function hitungJarakMeter(lat1, lon1, lat2, lon2) {
  const R = 6371000; // radius bumi (meter)
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
