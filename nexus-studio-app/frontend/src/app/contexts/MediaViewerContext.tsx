import { createContext, useContext, useState, ReactNode } from "react";
import { MediaItem } from "../components/MediaViewer";

interface MediaViewerContextType {
  currentMedia: MediaItem | null;
  openMedia: (media: MediaItem) => void;
  closeMedia: () => void;
}

const MediaViewerContext = createContext<MediaViewerContextType | undefined>(undefined);

export function MediaViewerProvider({ children }: { children: ReactNode }) {
  const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null);

  const openMedia = (media: MediaItem) => {
    setCurrentMedia(media);
  };

  const closeMedia = () => {
    setCurrentMedia(null);
  };

  return (
    <MediaViewerContext.Provider value={{ currentMedia, openMedia, closeMedia }}>
      {children}
    </MediaViewerContext.Provider>
  );
}

export function useMediaViewer() {
  const context = useContext(MediaViewerContext);
  if (!context) {
    throw new Error("useMediaViewer must be used within MediaViewerProvider");
  }
  return context;
}
