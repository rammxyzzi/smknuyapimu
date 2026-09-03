const formLogin = document.getElementById("formLogin");
const pesanEl = document.getElementById("pesan");
const btnLogin = document.getElementById("btnLogin");

function tampilkanPesan(teks, jenis = "error") {
  pesanEl.textContent = teks;
  pesanEl.className = `pesan tampil ${jenis}`;
}

// Kalau sudah login, langsung lempar ke halaman absen
(async () => {
  const sesi = await ambilSesi();
  if (sesi) window.location.href = "absen.html";
})();

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  btnLogin.disabled = true;
  btnLogin.textContent = "Memproses…";

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    tampilkanPesan("Email atau kata sandi salah. Coba lagi.", "error");
    btnLogin.disabled = false;
    btnLogin.textContent = "Masuk";
    return;
  }

  tampilkanPesan("Berhasil masuk, mengalihkan…", "sukses");
  window.location.href = "absen.html";
});
