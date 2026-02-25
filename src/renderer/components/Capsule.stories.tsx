import { useState, useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Capsule } from "./Capsule";

const meta: Meta<typeof Capsule> = {
  component: Capsule,
  parameters: {
    backgrounds: { default: "dark" },
    layout: "centered",
  },
};
export default meta;

type Story = StoryObj<typeof Capsule>;

export const ConnectingTranscribe: Story = {
  args: {
    state: { status: "connecting", mode: "transcribe" },
    skipPostProcessing: false,
  },
};

export const ConnectingTranslate: Story = {
  args: {
    state: { status: "connecting", mode: "translate" },
    skipPostProcessing: false,
  },
};

export const RecordingTranscribe: Story = {
  args: {
    state: { status: "recording", mode: "transcribe" },
    skipPostProcessing: false,
  },
};

export const RecordingTranslate: Story = {
  args: {
    state: { status: "recording", mode: "translate" },
    skipPostProcessing: false,
  },
};

export const RecordingSkipPostProcessing: Story = {
  args: {
    state: { status: "recording", mode: "transcribe" },
    skipPostProcessing: true,
  },
};

export const RecordingSilence: Story = {
  args: {
    state: { status: "recording", mode: "transcribe" },
    skipPostProcessing: false,
  },
};

export const ProcessingTranscribe: Story = {
  args: {
    state: { status: "processing", mode: "transcribe" },
    skipPostProcessing: false,
  },
};

export const ProcessingTranslate: Story = {
  args: {
    state: { status: "processing", mode: "translate" },
    skipPostProcessing: false,
  },
};

export const ProcessingSkipPostProcessing: Story = {
  args: {
    state: { status: "processing", mode: "transcribe" },
    skipPostProcessing: true,
  },
};

export const ErrorState: Story = {
  args: {
    state: { status: "error", message: "Microphone permission denied" },
    skipPostProcessing: false,
  },
};

export const ErrorNothingHeard: Story = {
  args: {
    state: { status: "error", message: "Nothing heard" },
    skipPostProcessing: false,
  },
};

export const ErrorNetworkFailure: Story = {
  args: {
    state: { status: "error", message: "Network error" },
    skipPostProcessing: false,
  },
};

type FlowStep = {
  state: Parameters<typeof Capsule>[0]["state"];
  ms: number;
};

const FULL_FLOW: FlowStep[] = [
  { state: { status: "connecting", mode: "transcribe" }, ms: 900 },
  { state: { status: "recording", mode: "transcribe" }, ms: 600 },
  { state: { status: "recording", mode: "transcribe" }, ms: 500 },
  { state: { status: "recording", mode: "transcribe" }, ms: 700 },
  { state: { status: "recording", mode: "transcribe" }, ms: 500 },
  { state: { status: "processing", mode: "transcribe" }, ms: 1000 },
  { state: { status: "error", message: "Nothing heard" }, ms: 1200 },
];

function FullFlowPlayer() {
  const [step, setStep] = useState(0);

  const entry = FULL_FLOW[step % FULL_FLOW.length];

  useEffect(() => {
    const timer = setTimeout(() => setStep((s) => s + 1), entry.ms);
    return () => clearTimeout(timer);
  }, [step, entry.ms]);

  return <Capsule state={entry.state} skipPostProcessing={false} />;
}

export const FullFlow: Story = {
  render: () => <FullFlowPlayer />,
};
