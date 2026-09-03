"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface PresensiRecord {
  id: string;
  waktu_presensi: string;
  status: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  profiles: {
    full_name: string;
    nisn: string;
  } | null;
}

export default function AdminDashboardPage() {
  const [records, setRecords] = useState<PresensiRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const fetchPresensiData = async (date: string) => {
    setLoading(true);
    try {
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;

      const { data, error } = await supabase
        .from("presensi")
        .select(`
          id,
          waktu_presensi,
          status,
          latitude,
          longitude,
          distance_meters,
          profiles (
            full_name,
            nisn
          )
        `)
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecords((data as unknown as PresensiRecord[]) || []);
    } catch (err: any) {
      console.error("Gagal mengambil data:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresensiData(selectedDate);
  }, [selectedDate]);

  const filteredRecords = records.filter((rec) => {
    const name = rec.profiles?.full_name?.toLowerCase() || "";
    const nisn = rec.profiles?.nisn?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    return name.includes(query) || nisn.includes(query);
  });

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert("Tidak ada data presensi untuk diexport!");
      return;
    }

    const headers = [
      "No",
      "Nama Siswa",
      "NISN",
      "Waktu Presensi",
      "Status",
      "Jarak GPS (Meter)",
      "Latitude",
      "Longitude",
      "Link Google Maps",
    ];

    const rows = filteredRecords.map((item, index) => {
      const time =
        new Date(item.waktu_presensi).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " WIB";

      const name = `"${(item.profiles?.full_name || "Siswa Tanpa Nama").replace(/"/g, '""')}"`;
      const nisn = `"${item.profiles?.nisn || "-"}"`;
      const status = `"${item.status}"`;
      const distance = item.distance_meters;
      const lat = item.latitude;
      const lng = item.longitude;
      const mapUrl = `"https://maps.google.com/?q=${lat},${lng}"`;

      return [
        index + 1,
        name,
        nisn,
        `"${time}"`,
        status,
        distance,
        lat,
        lng,
        mapUrl,
      ].join(",");
    });

    const csvString = "\uFEFF" + [headers.join(","), ...rows].join("\n");

    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Rekap_Presensi_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalHadir = filteredRecords.filter((r) => r.status === "Hadir").length;
  const avgDistance =
    filteredRecords.length > 0
      ? Math.round(
          filteredRecords.reduce((acc, curr) => acc + curr.distance_meters, 0) /
            filteredRecords.length
        )
      : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Rekap Presensi</h1>
            <p className="text-xs text-gray-500 mt-1">
              Pantau kehadiran dan validasi lokasi GPS siswa secara real-time
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={filteredRecords.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>

            <button
              onClick={() => fetchPresensiData(selectedDate)}
              className="px-4 py-2 bg-blue-900 text-white text-xs font-semibold rounded-xl hover:bg-blue-800 transition"
            >
              Refresh Data
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Siswa Absen</p>
            <p className="text-3xl font-extrabold text-gray-800 mt-2">{filteredRecords.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status Hadir</p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">{totalHadir}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Rata-Rata Jarak GPS</p>
            <p className="text-3xl font-extrabold text-blue-900 mt-2">{avgDistance} <span className="text-sm font-normal text-gray-500">meter</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="w-full sm:w-auto flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Pilih Tanggal:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Cari Nama atau NISN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase text-[11px] font-bold tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Siswa</th>
                  <th className="px-6 py-4">NISN</th>
                  <th className="px-6 py-4">Waktu Absen</th>
                  <th className="px-6 py-4">Jarak GPS</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Lokasi Map</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      Memuat data presensi...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      Tidak ada record presensi pada tanggal ini.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {item.profiles?.full_name || "Siswa Tanpa Nama"}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{item.profiles?.nisn || "-"}</td>
                      <td className="px-6 py-4">
                        {new Date(item.waktu_presensi).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })} WIB
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {item.distance_meters} m
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            item.status === "Hadir"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={`https://maps.google.com/?q=${item.latitude},${item.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-700 underline font-semibold hover:text-blue-900"
                        >
                          Cek Koordinat ↗
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
