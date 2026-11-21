"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Camera barcode scanner. Calls onDetect for each new code (the same code is ignored for 2 seconds).
 * Stays open so a cashier can scan several items in a row.
 */
export default function BarcodeScanner({
  onDetect,
  onClose,
  title = "Scan a barcode",
}: {
  onDetect: (code: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectRef = useRef(onDetect);
  const [error, setError] = useState("");
  const [last, setLast] = useState("");

  useEffect(() => {
    detectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | undefined;
    const recent = new Map<string, number>();

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("This browser can't use the camera. Type the barcode instead.");
          return;
        }
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current!,
          (result) => {
            if (!result || stopped) return;
            const code = result.getText();
            const now = Date.now();
            if ((recent.get(code) ?? 0) > now - 2000) return;
            recent.set(code, now);
            setLast(code);
            if (navigator.vibrate) navigator.vibrate(60);
            detectRef.current(code);
          }
        );
        if (stopped) controls.stop();
      } catch {
        setError("Couldn't open the camera. Allow camera access for this site in your browser settings, then try again.");
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="receipt" style={{ fontFamily: "inherit" }} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {error ? (
          <div className="error">{error}</div>
        ) : (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: "100%", borderRadius: 10, background: "#000", aspectRatio: "4 / 3", objectFit: "cover" }}
            />
            <p className="muted center" style={{ marginTop: 8 }}>
              {last ? `Last scan: ${last}` : "Point the camera at the barcode"}
            </p>
          </>
        )}
        <button className="btn full" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
