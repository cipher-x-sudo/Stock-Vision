import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { MarketPipeline } from "./components/modules/MarketPipeline";
import { Conceptualize } from "./components/modules/Conceptualize";
import { DNAExtraction } from "./components/modules/DNAExtraction";
import { ImageStudio } from "./components/modules/ImageStudio";
import { VideoStudio } from "./components/modules/VideoStudio";
import { Archive } from "./components/modules/Archive";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: MarketPipeline },
      { path: "conceptualize", Component: Conceptualize },
      { path: "dna-extraction", Component: DNAExtraction },
      { path: "image-studio", Component: ImageStudio },
      { path: "video-studio", Component: VideoStudio },
      { path: "archive", Component: Archive },
    ],
  },
]);