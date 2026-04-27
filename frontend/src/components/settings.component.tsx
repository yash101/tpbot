import { useLocation } from "react-router-dom";
import { useSettings, useSettingsItem, useStableSettingsItem } from "../service/settings.provider";
import { ReactNode, useEffect } from "react";

export function SettingsPane() {
  const settings = useSettings();
  const location = useLocation();

  useEffect(() => {
    settings.close();
  }, [location.key, settings.close]);

  if (!settings.isOpen) return null;

  return (
    <aside
      className={[
        "fixed right-0 top-0 bottom-0 z-10 scroll-auto w-max[50vw]",
        "w-120 backdrop-blur-2xl opacity-80 bg-gray-800 border-l-gray-600",
        "flex flex-col grow pt-14 px-4 pb-2 scroll-auto"
      ].join(' ')}
    >
      <h1>Preferences</h1>
      {settings.items.map((item, index) => (
        <div key={index}>
          {item.element}
        </div>
      ))}
    </aside>
  );
}

export function SettingsItem({ children }: { children: ReactNode}) {
  useSettingsItem(children);
  return null;
}

export function StableSettingsItem({ children }: { children: ReactNode}) {
  useStableSettingsItem(children);
  return null;
}
