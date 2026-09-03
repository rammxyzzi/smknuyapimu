"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg("Login gagal: " + error.message);
      setLoading(false);
    } else {
      router.push("/presensi");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-900">Portal Presensi Siswa</h1>
          <p className="text-xs text-gray-500 mt-1">Masukkan akun Anda untuk melanjutkan absensi</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm rounded-lg border border-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email / Account</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="siswa@sekolah.sch.id"
              className="w-full px-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-900 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-900 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-900 text-white font-bold rounded-xl shadow-md hover:bg-blue-800 disabled:bg-gray-300 transition"
          >
            {loading ? "Memeriksa Akun..." : "Masuk & Lanjut Absen"}
          </button>
        </form>
      </div>
    </div>
  );
}
