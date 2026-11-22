"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar", "qr_code"];

function cameraError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (!window.isSecureContext) return "The camera only works on a secure (https) page.";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access is blocked. Allow the camera for this site in your phone's browser settings, then open the scanner again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this phone.";
  if (name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  return "Couldn't open the camera. You can type the barcode below instead.";
}

/**
 * Camera barcode scanner. Calls onDetect for each new code (the same code is ignored for 2 seconds).
 * Uses the phone's built-in barcode reader when it has one (fast), otherwise a JavaScript reader.
 * Always offers typing the number by hand, so a bad camera never blocks a sale.
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
  const streamRef = useRef<MediaStream | null>(null);
  const detectRef = useRef(onDetect);
  const [error, setError] = useState("");
  const [last, setLast] = useState("");
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState<boolean | null>(null); // null = this phone has no torch
  const [manual, setManual] = useState("");

  useEffect(() => {
    detectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const recent = new Map<string, number>();

    function found(code: string) {
      const now = Date.now();
      if (!code || (recent.get(code) ?? 0) > now - 2000) return;
      recent.set(code, now);
      setLast(code);
      if (navigator.vibrate) navigator.vibrate(60);
      detectRef.current(code);
    }

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError(window.isSecureContext ? "This browser can't use the camera." : "The camera only works on a secure (https) page.");
          return;
        }
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        } catch (e) {
          if ((e as { name?: string })?.name === "OverconstrainedError") {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } else throw e;
        }
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        try {
          // Keep the picture sharp up close, and offer the torch where the phone has one.
          const caps: any = track.getCapabilities?.() ?? {};
          if (caps.focusMode?.includes?.("continuous")) await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] });
          if (caps.torch) setTorchOn(false);
        } catch {
          /* optional extras */
        }

        const video = videoRef.current!;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();
        setReady(true);

        // Pick the reader: the phone's own, or ZXing.
        let native: any = null;
        const BD = (window as any).BarcodeDetector;
        if (BD) {
          try {
            const have: string[] = (await BD.getSupportedFormats?.()) ?? NATIVE_FORMATS;
            const formats = NATIVE_FORMATS.filter((f) => have.includes(f));
            if (formats.length) native = new BD({ formats });
          } catch {
            native = null;
          }
        }

        let zx: any = null;
        let canvas: HTMLCanvasElement | null = null;
        if (!native) {
          const lib: any = await import("@zxing/library");
          const hints = new Map();
          hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [
            lib.BarcodeFormat.EAN_13,
            lib.BarcodeFormat.EAN_8,
            lib.BarcodeFormat.UPC_A,
            lib.BarcodeFormat.UPC_E,
            lib.BarcodeFormat.CODE_128,
            lib.BarcodeFormat.CODE_39,
            lib.BarcodeFormat.ITF,
          ]);
          hints.set(lib.DecodeHintType.TRY_HARDER, true);
          const reader = new lib.MultiFormatReader();
          reader.setHints(hints);
          canvas = document.createElement("canvas");
          zx = { lib, reader };
        }

        let busy = false;
        const tick = async () => {
          if (stopped) return;
          if (!busy && video.readyState >= 2 && video.videoWidth) {
            busy = true;
            try {
              if (native) {
                const codes = await native.detect(video);
                if (codes?.[0]?.rawValue) found(String(codes[0].rawValue));
              } else if (zx && canvas) {
                const scale = Math.min(1, 960 / video.videoWidth);
                canvas.width = Math.round(video.videoWidth * scale);
                canvas.height = Math.round(video.videoHeight * scale);
                const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                try {
                  const src = new zx.lib.HTMLCanvasElementLuminanceSource(canvas);
                  const bmp = new zx.lib.BinaryBitmap(new zx.lib.HybridBinarizer(src));
                  found(zx.reader.decodeWithState(bmp).getText());
                } catch {
                  /* no barcode in this frame: normal */
                }
              }
            } catch {
              /* a bad frame never stops the scanner */
            }
            busy = false;
          }
          timer = setTimeout(tick, native ? 100 : 160);
        };
        tick();
      } catch (e) {
        if (!stopped) setError(cameraError(e));
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn(!torchOn);
    } catch {
      /* torch not available after all */
    }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manual.replace(/\s+/g, "");
    if (!code) return;
    setLast(code);
    setManual("");
    detectRef.current(code);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="receipt" style={{ fontFamily: "inherit" }} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {error ? (
          <div className="error">{error}</div>
        ) : (
          <>
            <div style={{ position: "relative" }}>
              <video
                ref={videoRef}
                muted
                playsInline
                style={{ width: "100%", borderRadius: 10, background: "#000", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }}
              />
              {ready && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute", left: "10%", right: "10%", top: "32%", bottom: "32%",
                    border: "2px solid rgba(255,255,255,0.85)", borderRadius: 10, boxShadow: "0 0 0 999px rgba(0,0,0,0.25)", pointerEvents: "none",
                  }}
                />
              )}
            </div>
            <p className="muted center" style={{ marginTop: 8 }}>
              {last ? `Last scan: ${last}` : ready ? "Hold the barcode inside the box, about 15 cm away" : "Starting the camera…"}
            </p>
            {torchOn !== null && (
              <button className="btn ghost small full" onClick={toggleTorch} style={{ marginBottom: 8 }}>
                {torchOn ? "Turn light off" : "Turn light on"}
              </button>
            )}
          </>
        )}
        <form onSubmit={submitManual} className="row" style={{ margin: "8px 0 12px" }}>
          <input
            className="grow"
            inputMode="numeric"
            placeholder="Or type the barcode number"
            aria-label="Barcode number"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button className="btn ghost" disabled={!manual.trim()}>
            Use
          </button>
        </form>
        <button className="btn full" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
