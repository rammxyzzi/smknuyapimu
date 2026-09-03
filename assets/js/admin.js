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
  muatPresensi();
  muatSiswa();
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
document.getElementById("filterTanggal").addEventListener("change", muatPresensi);

async function muatPresensi() {
  const tbody = document.getElementById("tabelPresensi");
  const tanggal = document.getElementById("filterTanggal").value;

  const { data, error } = await sb
    .from("attendance")
    .select("id, waktu, status, jarak_meter, students(nama, kelas)")
    .eq("tanggal", tanggal)
    .order("waktu", { ascending: false });

  if (error || !data) {
    tbody.innerHTML = `<tr><td colspan="4">Gagal memuat data.</td></tr>`;
    console.error(error);
    return;
  }
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">Belum ada presensi di tanggal ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map((row) => {
      const jam = new Date(row.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      const lencanaKelas = row.status === "hadir" ? "hadir" : "telat";
      return `
        <tr>
          <td>${row.students?.nama || "-"} <span style="color:var(--tinta-lembut);">(${row.students?.kelas || "-"})</span></td>
          <td>${jam}</td>
          <td><span class="lencana ${lencanaKelas}">${row.status}</span></td>
          <td>${row.jarak_meter} m</td>
        </tr>`;
    })
    .join("");
}

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
