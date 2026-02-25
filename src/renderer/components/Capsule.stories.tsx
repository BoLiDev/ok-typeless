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
    vu: 0,
  },
};

export const ConnectingTranslate: Story = {
  args: {
    state: { status: "connecting", mode: "translate" },
    vu: 0,
  },
};

export const RecordingTranscribe: Story = {
  args: {
    state: { status: "recording", mode: "transcribe" },
    vu: 0.6,
  },
};

export const RecordingTranslate: Story = {
  args: {
    state: { status: "recording", mode: "translate" },
    vu: 0.6,
  },
};

export const RecordingLoud: Story = {
  args: {
    state: { status: "recording", mode: "transcribe" },
    vu: 1.0,
  },
};

export const RecordingSilence: Story = {
  args: {
    state: { status: "recording", mode: "transcribe" },
    vu: 0.0,
  },
};

export const ProcessingTranscribe: Story = {
  args: {
    state: { status: "processing", mode: "transcribe" },
    vu: 0,
  },
};

export const ProcessingTranslate: Story = {
  args: {
    state: { status: "processing", mode: "translate" },
    vu: 0,
  },
};

export const ErrorState: Story = {
  args: {
    state: { status: "error", message: "Microphone permission denied" },
    vu: 0,
  },
};

export const ErrorNothingHeard: Story = {
  args: {
    state: { status: "error", message: "Nothing heard" },
    vu: 0,
  },
};

export const ErrorNetworkFailure: Story = {
  args: {
    state: { status: "error", message: "Network error" },
    vu: 0,
  },
};
