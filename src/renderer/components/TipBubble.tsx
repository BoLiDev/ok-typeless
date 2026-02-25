type Props = {
  message: string;
};

export function TipBubble({ message }: Props): React.ReactElement {
  return <div className="tip-bubble">{message}</div>;
}
