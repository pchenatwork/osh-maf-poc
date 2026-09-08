/**
 * The waiting state for the initial definition fetch.
 *
 * The API is deployed on Render's free tier, which spins the service down when
 * idle; the first request after that pays a cold start of roughly 50 seconds.
 * A warm service answers in well under a second, so the cold-start explanation
 * is withheld until the wait is actually long enough to need explaining —
 * announcing "this may take 50 seconds" on every load would make the common
 * case look broken.
 */
import { useEffect, useState } from "react";
import styles from "./LoadingNotice.module.css";

/** Seconds to wait before assuming this is a cold start rather than a slow hop. */
const COLD_START_AFTER = 3;

/** Observed worst-case Render spin-up, used only to scale the progress bar. */
const COLD_START_ESTIMATE = 50;

export function LoadingNotice() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const cold = elapsed >= COLD_START_AFTER;

  /* Capped below 100: the bar should never sit full while the request is still
     in flight, which would read as a hang rather than as progress. */
  const percent = Math.min(95, (elapsed / COLD_START_ESTIMATE) * 100);

  return (
    /* aria-live is on the container so the switch to the cold-start message is
       announced once. The ticking counter below is aria-hidden — a screen
       reader reciting a new number every second is noise, not information. */
    <div className={styles.notice} role="status" aria-live="polite">
      <p className={styles.headline}>
        {cold ? "Waking up the API service…" : "Loading definition…"}
      </p>

      {cold && (
        <>
          <p className={styles.detail}>
            The API is hosted on a free tier that shuts the service down when
            it is idle, so the first request has to start it again. This can
            take up to about 50 seconds. Everything after it is fast — please
            hold on.
          </p>
          <div className={styles.bar}>
            <div className={styles.fill} style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.elapsed} aria-hidden="true">
            Waiting {elapsed}s…
          </p>
        </>
      )}
    </div>
  );
}
