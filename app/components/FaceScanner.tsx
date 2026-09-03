"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

export default function FaceScanner({ userId }: { userId: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
  });
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  });

  // 1. AUTO DETEKSI GEOLOCATION
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Browser Anda tidak mendukung fitur lokasi/GPS.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setGeoError(null);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGeoError("Izin lokasi ditolak. Harap aktifkan GPS di browser Anda.");
            break;
          case err.POSITION_UNAVAILABLE:
            setGeoError("Sinyal GPS tidak ditemukan.");
            break;
          case err.TIMEOUT:
            setGeoError("Waktu permintaan lokasi habis.");
            break;
          default:
            setGeoError("Gagal mengambil data lokasi.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 2. LOAD MODEL FACE-API & SETUP KAMERA
  useEffect(() => {
    const loadModelsAndStartCamera = async () => {
      try {
        setStatus({ type: "loading", message: "Memuat model Face AI..." });
        
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark64Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        setIsModelsLoaded(true);
        setStatus({ type: "loading", message: "Membuka kamera..." });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
          setStatus({ type: "idle", message: "Kamera & GPS Siap. Posisikan wajah Anda." });
        }
      } catch (err: any) {
        setStatus({
          type: "error",
          message: "Gagal memuat kamera atau model AI: " + err.message,
        });
      }
    };

    loadModelsAndStartCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 3. SCAN & SUBMIT PRESENSI
  const handleScanAndPresensi = async () => {
    if (!location.latitude || !location.longitude) {
      alert("Lokasi GPS belum terkunci. Pastikan GPS aktif!");
      return;
    }

    if (!videoRef.current || !isModelsLoaded) return;

    try {
      setIsProcessing(true);
      setStatus({ type: "loading", message: "Mendeteksi wajah..." });

      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus({
          type: "error",
          message: "Wajah tidak terdeteksi! Pastikan pencahayaan cukup.",
        });
        setIsProcessing(false);
        return;
      }

      const faceDescriptor = Array.from(detection.descriptor);

      setStatus({ type: "loading", message: "Memvalidasi lokasi & presensi..." });

      const response = await fetch("/api/presensi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          userLat: location.latitude,
          userLng: location.longitude,
          faceDescriptor,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setStatus({ type: "success", message: result.message });
      } else {
        setStatus({ type: "error", message: result.message || "Gagal melakukan presensi." });
      }
    } catch (err: any) {
      setStatus({ type: "error", message: "Terjadi kesalahan: " + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded-2xl shadow-xl border border-gray-100">
      <h2 className="text-xl font-bold text-center text-gray-800 mb-4">Presensi Online Sekolah</h2>

      <div className="mb-4 p-3 bg-gray-50 rounded-xl text-xs space-y-1 border border-gray-200">
        <div className="flex justify-between items-center font-semibold text-gray-700">
          <span>Status GPS:</span>
          {location.latitude ? (
            <span className="text-emerald-600 flex items-center gap-1">● Terkunci</span>
          ) : (
            <span className="text-amber-500 animate-pulse flex items-center gap-1">● Memuat GPS...</span>
          )}
        </div>
        {geoError ? (
          <p className="text-red-500 font-medium">{geoError}</p>
        ) : (
          <div className="text-gray-500 font-mono">
            <p>Lat : {location.latitude?.toFixed(6) ?? "-"}</p>
            <p>Lng : {location.longitude?.toFixed(6) ?? "-"}</p>
            <p>Akurasi: {location.accuracy ? `±${Math.round(location.accuracy)} meter` : "-"}</p>
          </div>
        )}
      </div>

      <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover transform -scale-x-100"
        />
        <div className="absolute inset-0 border-2 border-dashed border-white/40 rounded-xl pointer-events-none flex items-center justify-center">
          <div className="w-48 h-60 border-2 border-yellow-400/80 rounded-full animate-pulse" />
        </div>
      </div>

      {status.message && (
        <div
          className={`mt-4 p-3 rounded-lg text-sm text-center font-medium ${
            status.type === "success"
              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
              : status.type === "error"
              ? "bg-red-100 text-red-800 border border-red-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          {status.message}
        </div>
      )}

      <button
        onClick={handleScanAndPresensi}
        disabled={!isCameraActive || !location.latitude || isProcessing}
        className="mt-4 w-full py-3 px-4 bg-blue-900 text-white font-bold rounded-xl shadow-lg hover:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-200"
      >
        {isProcessing ? "Memproses..." : "Scan Wajah & Presensi"}
      </button>
    </div>
  );
}
