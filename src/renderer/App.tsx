import { useEffect, useState } from "react";

import type { AppState } from "@shared/types";

import { Capsule } from "./components/Capsule";
import { useAudioRecorder } from "./hooks/useAudioRecorder";

import "./App.css";

export function App(): React.ReactElement | null {
  const [state, setState] = useState<AppState>({ status: "idle" });
  const { vu } = useAudioRecorder();

  useEffect(() => {
    window.typeless.onStateUpdate(setState);
  }, []);

  if (state.status === "idle") return null;

  return (
    <div className="app">
      <Capsule state={state} vu={vu} />
    </div>
  );
}
