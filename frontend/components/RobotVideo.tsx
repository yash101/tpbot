"use client";

import React, { useEffect, useRef } from "react";
import { useWebRTC } from "@/app/providers/WebRTCProvider";
import { useSignal } from "@/service/providers";

export function RobotVideo() {
  const mgr = useWebRTC();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // subscribe to the robot stream signal
  const stream = useSignal(mgr.robotStream as any);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      el.srcObject = stream as MediaStream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [stream]);

  return (
    <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "auto" }} />
  );
}
