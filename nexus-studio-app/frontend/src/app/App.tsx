import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "sonner";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
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
    </>
  );
}