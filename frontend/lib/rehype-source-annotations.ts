import { visit, SKIP } from "unist-util-visit";

interface HastText {
  type: "text";
  value: string;
}

interface HastElement {
  type: "element";
  tagName?: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
}

type HastNode = HastText | HastElement;

const ANNOTATION_RE = /\[(KB|WEB|AI)\]|\[(\d+)\]/g;

function makeAnnotation(className: string, tagName: "span" | "sup", text: string, data: Record<string, string>): HastElement {
  return {
    type: "element",
    tagName,
    properties: { className: [className], ...data },
    children: [{ type: "text", value: text }],
  };
}

/**
 * Rehype plugin: converts [KB]/[WEB]/[AI] markers and [1]-style citations
 * inside markdown text into clickable annotated elements. Skips code blocks.
 */
export function rehypeSourceAnnotations() {
  return (tree: HastNode): void => {
    visit(tree, "text", (node: HastNode, index: number | undefined, parent: HastNode | undefined) => {
      if (!parent || index === undefined || parent.type !== "element") return;
      if (parent.tagName === "code" || parent.tagName === "pre") return SKIP;

      const text = node as HastText;
      const value = text.value;
      if (!/\[(KB|WEB|AI)\]|\[\d+\]/.test(value)) return;

      const replacements: HastNode[] = [];
      let last = 0;
      let match: RegExpExecArray | null;
      ANNOTATION_RE.lastIndex = 0;
      while ((match = ANNOTATION_RE.exec(value)) !== null) {
        if (match.index > last) {
          replacements.push({ type: "text", value: value.slice(last, match.index) });
        }
        if (match[1]) {
          replacements.push(
            makeAnnotation(`txt-${match[1].toLowerCase()}`, "span", match[0], {
              dataAnnotationType: match[1].toLowerCase(),
            })
          );
        } else if (match[2]) {
          replacements.push(
            makeAnnotation("cite-sup", "sup", match[0], {
              dataCiteIndex: String(parseInt(match[2], 10) - 1),
            })
          );
        }
        last = match.index + match[0].length;
      }
      if (last < value.length) {
        replacements.push({ type: "text", value: value.slice(last) });
      }

      (parent as HastElement).children.splice(index, 1, ...replacements);
      return [SKIP, index + replacements.length];
    });
  };
}
