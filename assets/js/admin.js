let sesiAdmin = null;

(async function mulaiAdmin() {
  sesiAdmin = await wajibAdmin();
  if (!sesiAdmin) return;
  document.getElementById("adminEmail").textContent = sesiAdmin.user.email;

  document.getElementById("btnKeluarAdmin").addEventListener("click", async (e) => {
    e.preventDefault();
    await sb.auth.signOut();
    window.location.href = "../login.html";
  });

  document.getElementById("filterTanggal").valueAsDate = new Date();

  muatRingkasan();
  muatInformasi();
  muatDaftarKelasUntukDropdown();
  muatPresensi();
  muatSiswa();
  muatKelas();
  muatPengaturan();
})();

// ---------- Navigasi tab ----------
document.querySelectorAll(".admin-nav a[data-tab]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".admin-nav a[data-tab]").forEach((l) => l.classList.remove("aktif"));
    link.classList.add("aktif");
    document.querySelectorAll(".tab-konten").forEach((tab) => (tab.style.display = "none"));
    document.getElementById(
      "tab" + link.dataset.tab.charAt(0).toUpperCase() + link.dataset.tab.slice(1)
    ).style.display = "block";
  });
});

// ---------- Ringkasan ----------
async function muatRingkasan() {
  const hariIni = new Date().toISOString().slice(0, 10);

  const [{ count: totalSiswa }, { count: hadir }, { count: telat }, { count: infoCount }] =
    await Promise.all([
      sb.from("students").select("*", { count: "exact", head: true }),
      sb.from("attendance").select("*", { count: "exact", head: true }).eq("tanggal", hariIni).eq("status", "hadir"),
      sb.from("attendance").select("*", { count: "exact", head: true }).eq("tanggal", hariIni).eq("status", "telat"),
      sb.from("informasi").select("*", { count: "exact", head: true }),
    ]);

  document.getElementById("statTotalSiswa").textContent = totalSiswa ?? 0;
  document.getElementById("statHadirHariIni").textContent = hadir ?? 0;
  document.getElementById("statTelatHariIni").textContent = telat ?? 0;
  document.getElementById("statInformasi").textContent = infoCount ?? 0;
}

// ---------- Informasi (CRUD) ----------
const formInformasi = document.getElementById("formInformasi");
formInformasi.addEventListener("submit", async (e) => {
  e.preventDefault();
  const judul = document.getElementById("judulInfo").value.trim();
  const kategori = document.getElementById("kategoriInfo").value.trim();
  const konten = document.getElementById("kontenInfo").value.trim();

  const { error } = await sb.from("informasi").insert({
    judul,
    kategori,
    konten,
    author_id: sesiAdmin.user.id,
  });

  const pesan = document.getElementById("pesanInformasi");
  if (error) {
    pesan.textContent = "Gagal menyimpan informasi.";
    pesan.className = "pesan tampil error";
    console.error(error);
    return;
  }
  pesan.textContent = "Informasi berhasil dipublikasikan.";
  pesan.className = "pesan tampil sukses";
  formInformasi.reset();
  muatInformasi();
  muatRingkasan();
});

async function muatInformasi() {
  const tbody = document.getElementById("tabelInformasi");
  const { data, error } = await sb
    .from("informasi")
    .select("id, judul, kategori, published_at")
    .order("published_at", { ascending: false });

  if (error || !data) {
    tbody.innerHTML = `<tr><td colspan="4">Gagal memuat data.</td></tr>`;
    return;
  }
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">Belum ada informasi.</td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map(
      (item) => `
      <tr>
        <td>${new Date(item.published_at).toLocaleDateString("id-ID")}</td>
        <td>${item.judul}</td>
        <td>${item.kategori || "-"}</td>
        <td class="aksi-baris">
          <button class="btn-kecil" data-hapus="${item.id}">Hapus</button>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-hapus]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Hapus informasi ini?")) return;
      await sb.from("informasi").delete().eq("id", btn.dataset.hapus);
      muatInformasi();
      muatRingkasan();
    });
  });
}

// ---------- Presensi ----------
let dataPresensiTerkini = []; // dipakai ulang untuk export Excel

document.getElementById("filterTanggal").addEventListener("change", muatPresensi);
document.getElementById("filterKelas").addEventListener("change", muatPresensi);
document.getElementById("filterStatus").addEventListener("change", muatPresensi);

async function muatPresensi() {
  const tbody = document.getElementById("tabelPresensi");
  const tanggal = document.getElementById("filterTanggal").value;
  const kelas = document.getElementById("filterKelas").value;
  const status = document.getElementById("filterStatus").value;

  let query = sb
    .from("attendance")
    .select("id, waktu, status, jarak_meter, students(nama, kelas)")
    .eq("tanggal", tanggal)
    .order("waktu", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error || !data) {
    tbody.innerHTML = `<tr><td colspan="5">Gagal memuat data.</td></tr>`;
    console.error(error);
    return;
  }

  // Filter kelas dilakukan di sisi client karena kolomnya ada di tabel relasi (students)
  const hasil = kelas ? data.filter((row) => row.students?.kelas === kelas) : data;
  dataPresensiTerkini = hasil;

  if (hasil.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Tidak ada presensi yang cocok dengan filter ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = hasil
    .map((row) => {
      const jam = new Date(row.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      const lencanaKelas = row.status === "hadir" ? "hadir" : "telat";
      return `
        <tr>
          <td>${row.students?.nama || "-"}</td>
          <td>${row.students?.kelas || "-"}</td>
          <td>${jam}</td>
          <td><span class="lencana ${lencanaKelas}">${row.status}</span></td>
          <td>${row.jarak_meter} m</td>
        </tr>`;
    })
    .join("");
}

// ---------- Ekspor Excel ----------
document.getElementById("btnUnduhExcel").addEventListener("click", () => {
  if (dataPresensiTerkini.length === 0) {
    alert("Tidak ada data presensi untuk diunduh pada filter saat ini.");
    return;
  }

  const tanggal = document.getElementById("filterTanggal").value;
  const baris = dataPresensiTerkini.map((row) => ({
    Nama: row.students?.nama || "-",
    Kelas: row.students?.kelas || "-",
    Tanggal: tanggal,
    Waktu: new Date(row.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    Status: row.status,
    "Jarak (m)": row.jarak_meter,
  }));

  const worksheet = XLSX.utils.json_to_sheet(baris);
  worksheet["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Presensi");
  XLSX.writeFile(workbook, `presensi-${tanggal}.xlsx`);
});

// ---------- Dropdown kelas (dipakai di filter Presensi & form Tambah Siswa) ----------
async function muatDaftarKelasUntukDropdown() {
  const { data, error } = await sb.from("kelas").select("nama_kelas, jurusan").order("nama_kelas");
  const selectFilter = document.getElementById("filterKelas");
  const selectSiswa = document.getElementById("kelasSiswaInput");
  if (error || !data) return;

  const opsi = data.map((k) => `<option value="${k.nama_kelas}">${k.nama_kelas}</option>`).join("");
  selectFilter.innerHTML = `<option value="">Semua kelas</option>` + opsi;
  selectSiswa.innerHTML = `<option value="">— pilih kelas —</option>` + opsi;
}

// ---------- Tambah siswa ----------
const formSiswa = document.getElementById("formSiswa");
formSiswa.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pesan = document.getElementById("pesanSiswa");
  const btn = document.getElementById("btnTambahSiswa");
  const nama = document.getElementById("namaSiswaInput").value.trim();
  const nisn = document.getElementById("nisnInput").value.trim();
  const kelas = document.getElementById("kelasSiswaInput").value;
  const email = document.getElementById("emailSiswaInput").value.trim();
  const password = document.getElementById("passwordSiswaInput").value;

  btn.disabled = true;
  btn.textContent = "Memproses…";

  // Pakai client kedua (sbBuatAkun) supaya sesi admin di `sb` tidak ikut tergeser
  const { data: dataAkun, error: errAkun } = await sbBuatAkun.auth.signUp({ email, password });

  if (errAkun || !dataAkun.user) {
    pesan.textContent = "Gagal membuat akun: " + (errAkun?.message || "coba lagi.");
    pesan.className = "pesan tampil error";
    btn.disabled = false;
    btn.textContent = "Tambah Siswa";
    return;
  }

  // Cari jurusan dari kelas yang dipilih (kalau ada di tabel kelas)
  const { data: kelasTerpilih } = await sb.from("kelas").select("jurusan").eq("nama_kelas", kelas).single();

  const { error: errSiswa } = await sb.from("students").insert({
    id: dataAkun.user.id,
    nama,
    nisn,
    kelas,
    jurusan: kelasTerpilih?.jurusan || null,
  });

  if (errSiswa) {
    pesan.textContent = "Akun dibuat, tapi gagal menyimpan data siswa: " + errSiswa.message;
    pesan.className = "pesan tampil error";
    btn.disabled = false;
    btn.textContent = "Tambah Siswa";
    return;
  }

  await sb.from("user_roles").insert({ user_id: dataAkun.user.id, role: "siswa" });

  pesan.textContent = `Siswa "${nama}" berhasil ditambahkan. Beri tahu email & kata sandi ini untuk login.`;
  pesan.className = "pesan tampil sukses";
  formSiswa.reset();
  btn.disabled = false;
  btn.textContent = "Tambah Siswa";
  muatSiswa();
  muatRingkasan();
});

// ---------- Siswa ----------
async function muatSiswa() {
  const tbody = document.getElementById("tabelSiswa");
  const { data, error } = await sb
    .from("students")
    .select("nama, nisn, kelas, jurusan, face_descriptor")
    .order("nama");

  if (error || !data) {
    tbody.innerHTML = `<tr><td colspan="5">Gagal memuat data.</td></tr>`;
    return;
  }
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Belum ada siswa terdaftar.</td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map(
      (s) => `
      <tr>
        <td>${s.nama}</td>
        <td>${s.nisn || "-"}</td>
        <td>${s.kelas || "-"}</td>
        <td>${s.jurusan || "-"}</td>
        <td>${s.face_descriptor ? '<span class="lencana hadir">terdaftar</span>' : '<span class="lencana telat">belum</span>'}</td>
      </tr>`
    )
    .join("");
}

// ---------- Kelas & Wali Kelas ----------
const formKelas = document.getElementById("formKelas");
formKelas.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pesan = document.getElementById("pesanKelas");
  const nama_kelas = document.getElementById("namaKelasInput").value.trim();
  const wali_kelas = document.getElementById("waliKelasInput").value.trim();
  const jurusan = document.getElementById("jurusanKelasInput").value.trim();

  const { error } = await sb.from("kelas").insert({ nama_kelas, wali_kelas, jurusan });

  if (error) {
    pesan.textContent = "Gagal menambah kelas (mungkin nama kelas sudah ada).";
    pesan.className = "pesan tampil error";
    console.error(error);
    return;
  }

  pesan.textContent = "Kelas berhasil ditambahkan.";
  pesan.className = "pesan tampil sukses";
  formKelas.reset();
  muatKelas();
  muatDaftarKelasUntukDropdown();
});

async function muatKelas() {
  const tbody = document.getElementById("tabelKelas");
  const { data, error } = await sb.from("kelas").select("id, nama_kelas, wali_kelas, jurusan").order("nama_kelas");

  if (error || !data) {
    tbody.innerHTML = `<tr><td colspan="4">Gagal memuat data.</td></tr>`;
    return;
  }
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">Belum ada kelas. Tambahkan kelas dulu di atas.</td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map(
      (k) => `
      <tr>
        <td>${k.nama_kelas}</td>
        <td>${k.wali_kelas || "-"}</td>
        <td>${k.jurusan || "-"}</td>
        <td class="aksi-baris">
          <button class="btn-kecil" data-hapus-kelas="${k.id}">Hapus</button>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-hapus-kelas]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Hapus kelas ini? Siswa yang sudah punya kelas ini tidak akan terhapus.")) return;
      await sb.from("kelas").delete().eq("id", btn.dataset.hapusKelas);
      muatKelas();
      muatDaftarKelasUntukDropdown();
    });
  });
}

// ---------- Pengaturan lokasi sekolah ----------
async function muatPengaturan() {
  const { data } = await sb.from("school_settings").select("*").eq("id", 1).single();
  if (!data) return;
  document.getElementById("namaSekolahInput").value = data.nama_sekolah || "";
  document.getElementById("latInput").value = data.latitude ?? "";
  document.getElementById("lngInput").value = data.longitude ?? "";
  document.getElementById("radiusInput").value = data.radius_meter ?? 100;
  document.getElementById("jamMasukInput").value = (data.jam_masuk || "07:00:00").slice(0, 5);
}

document.getElementById("btnAmbilLokasiSaya").addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition((pos) => {
    document.getElementById("latInput").value = pos.coords.latitude.toFixed(6);
    document.getElementById("lngInput").value = pos.coords.longitude.toFixed(6);
  });
});

document.getElementById("formPengaturan").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    id: 1,
    nama_sekolah: document.getElementById("namaSekolahInput").value.trim(),
    latitude: parseFloat(document.getElementById("latInput").value),
    longitude: parseFloat(document.getElementById("lngInput").value),
    radius_meter: parseInt(document.getElementById("radiusInput").value, 10),
    jam_masuk: document.getElementById("jamMasukInput").value + ":00",
  };

  const { error } = await sb.from("school_settings").upsert(payload);
  const pesan = document.getElementById("pesanPengaturan");
  if (error) {
    pesan.textContent = "Gagal menyimpan pengaturan.";
    pesan.className = "pesan tampil error";
    console.error(error);
    return;
  }
  pesan.textContent = "Pengaturan lokasi tersimpan.";
  pesan.className = "pesan tampil sukses";
});
