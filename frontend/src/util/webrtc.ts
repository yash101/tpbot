const CLOUDFLARE_STUN: RTCIceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478"] },
];

export function getDefaultIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_WEBRTC_ICE_SERVERS;
  if (!raw) return CLOUDFLARE_STUN;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("ICE servers must be an array");
    return parsed;
  } catch (error) {
    console.warn("Invalid VITE_WEBRTC_ICE_SERVERS, falling back to Cloudflare STUN", error);
    return CLOUDFLARE_STUN;
  }
}
export function isSupportedBrowserMedia() {
  return typeof window !== "undefined" && typeof navigator !== "undefined" && Boolean(navigator.mediaDevices);
}

export interface WebRTCContext {
  pendingIceCandidates: [];
  videoInputDevices: MediaDeviceInfo[],
  audioInputDevices: MediaDeviceInfo[],
  audioOutputDevices: MediaDeviceInfo[],
}
