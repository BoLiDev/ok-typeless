import * as OpenCC from "opencc-js";

let toSimplifiedConverter: ((text: string) => string) | null = null;

function getToSimplifiedConverter(): (text: string) => string {
  if (toSimplifiedConverter === null) {
    toSimplifiedConverter = OpenCC.Converter({ from: "tw", to: "cn" });
  }
  return toSimplifiedConverter;
}

export function toSimplifiedChinese(text: string): string {
  try {
    return getToSimplifiedConverter()(text);
  } catch (error) {
    console.error("[toSimplifiedChinese] Failed to convert text:", error);
    return text;
  }
}
