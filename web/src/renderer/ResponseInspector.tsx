import type { QuestionnaireResponse } from "../item-controls/contract";
import styles from "./ResponseInspector.module.css";

export function ResponseInspector({
  response,
}: {
  response: QuestionnaireResponse;
}) {
  const answered =
    JSON.stringify(response).match(/"answer":\[\{/g)?.length ?? 0;

  return (
    <aside className={styles.inspector}>
      <h2>
        QuestionnaireResponse <small>({answered} answered)</small>
      </h2>
      <pre>{JSON.stringify(response, null, 2)}</pre>
    </aside>
  );
}
