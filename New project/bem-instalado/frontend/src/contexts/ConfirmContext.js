import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const ConfirmContext = createContext(async () => false);

function normalizeOptions(options = {}) {
  if (typeof options === 'string') {
    return {
      title: 'Confirmar ação',
      message: options || 'Deseja continuar?',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      tone: 'default',
    };
  }

  const safeOptions = options && typeof options === 'object' ? options : {};

  return {
    title: safeOptions.title || 'Confirmar ação',
    message: safeOptions.message || 'Deseja continuar?',
    confirmText: safeOptions.confirmText || 'Confirmar',
    cancelText: safeOptions.cancelText || 'Cancelar',
    tone: safeOptions.tone === 'danger' ? 'danger' : 'default',
  };
}

export function ConfirmProvider({ children }) {
  const queueRef = useRef([]);
  const [dialog, setDialog] = useState(null);

  const openNext = useCallback(() => {
    setDialog((current) => {
      if (current) {
        return current;
      }

      const next = queueRef.current.shift();
      return next || null;
    });
  }, []);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        queueRef.current.push({
          options: normalizeOptions(options),
          resolve,
        });
        openNext();
      }),
    [openNext]
  );

  const resolveDialog = useCallback(
    (accepted) => {
      setDialog((current) => {
        if (!current) {
          return null;
        }

        current.resolve(Boolean(accepted));
        return null;
      });

      window.setTimeout(() => {
        openNext();
      }, 0);
    },
    [openNext]
  );

  useEffect(() => {
    if (!dialog) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        resolveDialog(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dialog, resolveDialog]);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      {dialog ? (
        <div
          className="site-confirm-backdrop"
          onClick={() => resolveDialog(false)}
          role="presentation"
        >
          <div
            aria-describedby="site-confirm-message"
            aria-labelledby="site-confirm-title"
            aria-modal="true"
            className="site-confirm-dialog"
            onClick={(event) => event.stopPropagation()}
            role="alertdialog"
          >
            <p className="eyebrow">Confirmação</p>
            <h3 className="site-confirm-title" id="site-confirm-title">
              {dialog.options.title}
            </h3>
            <p className="site-confirm-message" id="site-confirm-message">
              {dialog.options.message}
            </p>

            <div className="site-confirm-actions">
              <button
                className="ghost-button"
                onClick={() => resolveDialog(false)}
                type="button"
              >
                {dialog.options.cancelText}
              </button>
              <button
                className={
                  dialog.options.tone === 'danger' ? 'danger-button' : 'gold-button'
                }
                onClick={() => resolveDialog(true)}
                type="button"
              >
                {dialog.options.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}

