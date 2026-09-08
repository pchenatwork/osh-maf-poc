/**
 * A modal that shows any value as pretty-printed JSON.
 *
 * Deliberately typed `value: unknown` rather than a FHIR type: this is a shell
 * widget, not a form control, and nothing here should know what a Questionnaire
 * is. That also keeps it clear of the one-import-point rule in eslint.config.js.
 */
import { useEffect, useId, useMemo, useRef } from "react";
import styles from "./JsonDialog.module.css";

interface Props {
  open: boolean;
  title: string;
  value: unknown;
  onClose: () => void;
}

export function JsonDialog({ open, title, value, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  /* React has no declarative modal. The `open` prop renders a dialog *inline* —
     no backdrop, no focus trap, no top layer — so modal mode is only reachable
     through the imperative showModal().

     Both `.open` guards matter: showModal() on an already-open dialog throws
     InvalidStateError, and main.tsx renders under StrictMode, which invokes
     this effect twice in development. There is intentionally no cleanup: a
     close-on-cleanup would reopen on the second invoke and reset focus. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  /* App owns the live QuestionnaireResponse, so it re-renders on every
     keystroke and drags this component with it. Without the memo the whole
     definition would be re-serialised per character typed, open or not. The
     react-query cache hands back a stable object, so this is a cache hit. */
  const json = useMemo(() => JSON.stringify(value, null, 2), [value]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={headingId}
      /* Esc, the close button and a backdrop click all end in the native
         `close` event. Syncing the parent here — and only here — means one
         exit path, and lets the browser restore focus to the trigger. */
      onClose={onClose}
      /* ::backdrop is not a hit target: clicks on it are dispatched at the
         <dialog>. That is distinguishable from a click on the content only
         because .dialog has no padding — see JsonDialog.module.css. */
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 id={headingId}>{title}</h2>
          {/* First focusable descendant, so showModal() lands focus here. */}
          <button
            type="button"
            className={styles.close}
            onClick={() => ref.current?.close()}
          >
            Close
          </button>
        </header>
        {/* tabIndex makes the scroll region reachable by keyboard. */}
        <pre tabIndex={0}>{json}</pre>
      </div>
    </dialog>
  );
}
