import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "sonner";
import { MediaViewerProvider } from "./contexts/MediaViewerContext";
import { MediaViewer } from "./components/MediaViewer";
import { useMediaViewer } from "./contexts/MediaViewerContext";

function MediaViewerWrapper() {
  const { currentMedia, closeMedia } = useMediaViewer();
  return <MediaViewer media={currentMedia} onClose={closeMedia} />;
}

export default function App() {
  return (
    <MediaViewerProvider>
      <RouterProvider router={router} />
      <MediaViewerWrapper />
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: '#0a0f1d',
            border: '1px solid #161d2f',
            color: '#fff',
          },
        }}
      />
    </MediaViewerProvider>
  );
}