"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import FaceScanner from "@/components/FaceScanner";

export default function PresensiPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUserSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData);
      setLoading(false);
    };

    checkUserSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-medium">Memeriksa sesi akun...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto mb-4 bg-white p-4 rounded-2xl shadow flex justify-between items-center">
        <div>
          <p className="text-xs text-gray-400">Selamat Datang,</p>
          <h2 className="text-base font-bold text-gray-800">{profile?.full_name || user.email}</h2>
          <p className="text-xs text-blue-900 font-semibold">NISN: {profile?.nisn || "-"}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-200 font-semibold hover:bg-red-100"
        >
          Keluar
        </button>
      </div>

      <FaceScanner userId={user.id} />
    </main>
  );
}
