import { redirect } from "next/navigation";

export default function HomePage() {
  // Mengarahkan pengguna secara otomatis ke halaman login
  redirect("/login");
}
