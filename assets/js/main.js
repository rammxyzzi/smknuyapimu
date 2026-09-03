// Toggle menu mobile
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
if (navToggle) {
  navToggle.addEventListener("click", () => navLinks.classList.toggle("buka"));
}

// Ambil informasi/berita terbaru dari tabel `informasi`
async function muatBerita() {
  const grid = document.getElementById("beritaGrid");
  if (!grid) return;

  const { data, error } = await sb
    .from("informasi")
    .select("id, judul, konten, kategori, published_at")
    .order("published_at", { ascending: false })
    .limit(6);

  if (error) {
    grid.innerHTML = `<p>Belum bisa memuat informasi. Coba lagi nanti.</p>`;
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    grid.innerHTML = `<p>Belum ada informasi yang dipublikasikan.</p>`;
    return;
  }

  grid.innerHTML = data
    .map((item) => {
      const tanggal = new Date(item.published_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const ringkas =
        item.konten.length > 110 ? item.konten.slice(0, 110) + "…" : item.konten;
      return `
        <div class="kartu-berita">
          <div class="thumb">${item.kategori || "Informasi"}</div>
          <div class="isi">
            <span class="tanggal">${tanggal}</span>
            <h3>${item.judul}</h3>
            <p>${ringkas}</p>
          </div>
        </div>`;
    })
    .join("");
}

muatBerita();
