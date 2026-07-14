import { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';

const ConfirmContext = createContext(null);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // null = closed
  const resolveRef = useRef(null);

  const confirm = useCallback(({ message, title, confirmText = 'Confirm', cancelText = 'Cancel', type = 'primary' }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message, title, confirmText, cancelText, type });
    });
  }, []);

  const handleConfirm = () => {
    setState(null);
    resolveRef.current?.(true);
  };

  const handleCancel = () => {
    setState(null);
    resolveRef.current?.(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmModal
          message={state.message}
          title={state.title}
          confirmText={state.confirmText}
          cancelText={state.cancelText}
          type={state.type}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}
