import { useEffect, useState } from "react";

type Props = {
  message: string;
};

export function TipBubble({ message }: Props): React.ReactElement | null {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(id);
  }, [message]);

  if (!visible) return null;

  return <div className="tip-bubble">{message}</div>;
}
