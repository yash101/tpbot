import { ChangeEvent } from "react";

export function AVMediaSettings({
  devices,
  selections,
  isMicMute,
  isVideoMute,
  localPreviewVisible,
  onSelectionChange,
  onMicMuteChange,
  onVideoMuteChange,
  onLocalPreviewVisibleChange,
}: {
  devices: MediaDeviceLists;
  selections: MediaSelections;
  isMicMute: boolean;
  isVideoMute: boolean;
  localPreviewVisible: boolean;
  onSelectionChange: (next: MediaSelections) => void;
  onMicMuteChange: (next: boolean) => void;
  onVideoMuteChange: (next: boolean) => void;
  onLocalPreviewVisibleChange: (next: boolean) => void;
}) {
  return (
    <div className="grid gap-6 text-white">
      <section className="grid gap-3">
        <div>
          <h2 className="m-0 text-sm tracking-[0.24em] text-white/65 uppercase">Camera</h2>
          <p className="m-0 mt-1 text-sm text-white/55">Choose the video input and preview behavior.</p>
        </div>

        <AVSettingsSelect
          label="Camera source"
          value={selections.cameraId}
          onChange={(event) => onSelectionChange({ ...selections, cameraId: event.target.value })}
          devices={devices.cameras}
          placeholder="No cameras detected" />

        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <span className="text-sm text-white/80">Hide outgoing camera</span>
          <input
            type="checkbox"
            checked={isVideoMute}
            onChange={(event) => onVideoMuteChange(event.target.checked)} />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <span className="text-sm text-white/80">Show local preview</span>
          <input
            type="checkbox"
            checked={localPreviewVisible}
            onChange={(event) => onLocalPreviewVisibleChange(event.target.checked)} />
        </label>
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="m-0 text-sm tracking-[0.24em] text-white/65 uppercase">Audio Input</h2>
          <p className="m-0 mt-1 text-sm text-white/55">Choose the microphone source and talkback mute state.</p>
        </div>

        <AVSettingsSelect
          label="Microphone source"
          value={selections.microphoneId}
          onChange={(event) => onSelectionChange({ ...selections, microphoneId: event.target.value })}
          devices={devices.microphones}
          placeholder="No microphones detected" />

        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <span className="text-sm text-white/80">Mute microphone</span>
          <input
            type="checkbox"
            checked={isMicMute}
            onChange={(event) => onMicMuteChange(event.target.checked)} />
        </label>
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="m-0 text-sm tracking-[0.24em] text-white/65 uppercase">Audio Output</h2>
          <p className="m-0 mt-1 text-sm text-white/55">Choose which speaker device should play remote audio.</p>
        </div>

        <AVSettingsSelect
          label="Speaker output"
          value={selections.speakerId}
          onChange={(event) => onSelectionChange({ ...selections, speakerId: event.target.value })}
          devices={devices.speakers}
          placeholder="No speakers detected" />
      </section>
    </div>
  );
}export function AVSettingsSelect({
  label, value, onChange, devices, placeholder,
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  devices: MediaDeviceInfo[];
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-[0.2em] text-white/55 uppercase">{label}</span>
      <select
        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
        value={value}
        onChange={onChange}
      >
        {devices.length === 0 ? (
          <option value="">{placeholder}</option>
        ) : null}
        {devices.map((device, index) => (
          <option key={device.deviceId || `${label}-${index}`} value={device.deviceId}>
            {getDeviceLabel(device, label, index)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function getDeviceLabel(device: MediaDeviceInfo, fallback: string, index: number) {
  return device.label || `${fallback} ${index + 1}`;
}

export const initialDevices: MediaDeviceLists = {
  cameras: [],
  microphones: [],
  speakers: [],
};

export const initialSelections: MediaSelections = {
  cameraId: "",
  microphoneId: "",
  speakerId: "",
};

export type MediaSelections = {
  cameraId: string;
  microphoneId: string;
  speakerId: string;
};
export type MediaDeviceLists = {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
};

