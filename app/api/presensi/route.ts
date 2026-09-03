import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export async function POST(req: Request) {
  try {
    const { userId, userLat, userLng } = await req.json();

    if (!userId || !userLat || !userLng) {
      return NextResponse.json({ success: false, message: "Data tidak lengkap!" }, { status: 400 });
    }

    const { data: config, error: configErr } = await supabase
      .from("sekolah_config")
      .select("*")
      .limit(1)
      .single();

    if (configErr || !config) {
      return NextResponse.json({ success: false, message: "Pengaturan koordinat sekolah belum diset." }, { status: 500 });
    }

    const distance = getDistanceInMeters(userLat, userLng, config.latitude, config.longitude);

    if (distance > config.max_radius_meters) {
      return NextResponse.json(
        {
          success: false,
          message: `Absen Gagal! Anda berada di luar area sekolah (${distance}m dari lokasi resmi).`,
        },
        { status: 403 }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: existingAttendance } = await supabase
      .from("presensi")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lte("created_at", `${today}T23:59:59.999Z`);

    if (existingAttendance && existingAttendance.length > 0) {
      return NextResponse.json(
        { success: false, message: "Anda sudah melakukan presensi hari ini!" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase.from("presensi").insert([
      {
        user_id: userId,
        latitude: userLat,
        longitude: userLng,
        distance_meters: distance,
        status: "Hadir",
      },
    ]);

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      message: `Presensi Berhasil Disimpan! Jarak: ${distance} meter dari sekolah.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
