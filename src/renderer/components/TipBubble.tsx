import { motion } from "framer-motion";

type Props = {
  message: string;
};

export function TipBubble({ message }: Props): React.ReactElement {
  return (
    <motion.div
      className="tip-bubble"
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
    >
      {message}
    </motion.div>
  );
}
