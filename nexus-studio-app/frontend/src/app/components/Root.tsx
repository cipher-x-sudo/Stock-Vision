import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { useState } from "react";
import { SettingsModal } from "./SettingsModal";

export function Root() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050810]">
      <Sidebar 
        onOpenSettings={() => setSettingsOpen(true)} 
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />
      <main className="flex-1 overflow-auto">
        <Outlet context={{ onOpenMobileMenu: () => setMobileMenuOpen(true) }} />
      </main>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}