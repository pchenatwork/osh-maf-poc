import type {
  ItemPath,
  QuestionnaireItem,
  QuestionnaireResponseItemAnswer,
} from "../item-controls/contract";
import { resolveItemControl } from "../item-controls";
import { useRenderMode } from "./renderModeContext";

/**
 * The walker is a recursive component that traverses the questionnaire item tree and
 * renders each item using the appropriate component from the registry. It also passes down
 * the necessary props for managing answers and errors, as well as the current render mode.
 */
export interface WalkerProps {
  items: QuestionnaireItem[];
  getAnswers: (linkId: string) => QuestionnaireResponseItemAnswer[];
  setAnswers: (linkId: string, a: QuestionnaireResponseItemAnswer[]) => void;
  errors: Record<string, string[]>;
  isEnabled: (item: QuestionnaireItem) => boolean;

  /**
   * Path of the enclosing group. Absent at the top level, where the path
   * starts empty. Each level appends its own segment before recursing.
   */
  parentPath?: ItemPath;
}

export function QuestionnaireItemWalker({
  items,
  getAnswers,
  setAnswers,
  errors,
  isEnabled,
  parentPath = [],
}: WalkerProps) {
  const mode = useRenderMode();

  return (
    <>
      {items.map((item) => {
        if (!isEnabled(item)) return null;

        const Component = resolveItemControl(item);

        // index is always 0 until repeating groups are implemented: the
        // walker renders one occurrence per item. The segment is built here
        // anyway so that adding repeats later is a change to this file
        // rather than to every control.
        const path: ItemPath = [
          ...parentPath,
          { linkId: item.linkId, index: 0 },
        ];

        return (
          <Component
            key={item.linkId}
            item={item}
            path={path}
            answers={getAnswers(item.linkId)}
            setAnswers={(a) => setAnswers(item.linkId, a)}
            errors={errors[item.linkId] ?? []}
            mode={mode}
          >
            {item.item && (
              <QuestionnaireItemWalker
                items={item.item}
                getAnswers={getAnswers}
                setAnswers={setAnswers}
                errors={errors}
                isEnabled={isEnabled}
                parentPath={path}
              />
            )}
          </Component>
        );
      })}
    </>
  );
}
