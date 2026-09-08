import type { QuestionnaireItemProps } from "../contract";
import { isEditable } from "../contract";
import styles from "./SignatureBlockControl.module.css";
import shared from "../item-controls.module.css";

/**
 * Signer identity rendered as one visual unit, so the attestation above it
 * cannot be read apart from who is making it.
 *
 * Every signature group in asthma-maf is signed-by + date, and osh.signature
 * adds a title. The control renders whatever children the group has rather
 * than naming them, so a fourth field in a future MAF needs no code change.
 *
 * The signature TIMESTAMP is deliberately not rendered here: it is recorded
 * server-side on submission, in Provenance, and a client-drawn timestamp
 * would imply an assurance the POC does not provide (§9).
 */
export const SignatureBlockControl = ({
  item,
  children,
  errors,
  mode,
}: QuestionnaireItemProps) => (
  <section className={styles.signature} aria-labelledby={`sig-${item.linkId}`}>
    <h3 id={`sig-${item.linkId}`} className={styles.heading}>
      {item.text}
    </h3>

    <div className={styles.fields}>{children}</div>

    {!isEditable(mode) && (
      <p className={styles.stamp}>Signature recorded on submission.</p>
    )}

    {errors.length > 0 && (
      <div role="alert" className={shared.error}>
        {errors.join(" ")}
      </div>
    )}
  </section>
);
