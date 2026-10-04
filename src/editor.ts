import { basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';

const activeLine = StateEffect.define<number | null>();
const executionLine = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    decorations = decorations.map(transaction.changes);
    for (const effect of transaction.effects) if (effect.is(activeLine)) {
      decorations = effect.value && effect.value <= transaction.state.doc.lines
        ? Decoration.set([Decoration.line({ class: 'executing-line' }).range(transaction.state.doc.line(effect.value).from)])
        : Decoration.none;
    }
    return decorations;
  },
  provide: field => EditorView.decorations.from(field),
});
const starter = 'plant()\nmove("right")\nplant()\nmove("right")\nplant()';
export function createEditor(parent: HTMLElement) {
  const view = new EditorView({
    doc: starter,
    parent,
    extensions: [basicSetup, python(), executionLine,
      EditorView.contentAttributes.of({ 'aria-label': 'Python code editor', spellcheck: 'false' }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': { fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', lineHeight: '1.85' },
        '.cm-content': { padding: '22px 0' },
        '.cm-line': { paddingLeft: '12px' },
        '.cm-gutters': { background: '#fbfaf5', color: '#aaa99a', border: 'none', padding: '0 6px 0 12px' },
        '.cm-activeLine, .cm-activeLineGutter': { background: '#f2f2e9' },
        '.cm-focused': { outline: 'none' },
        '.cm-cursor': { borderLeftColor: '#55724c' },
        '.executing-line': { background: '#e3ecd4 !important', boxShadow: 'inset 3px 0 #799362' },
      }),
    ],
  });
  return {
    source: () => view.state.doc.toString(),
    highlight: (line: number | null) => view.dispatch({ effects: activeLine.of(line) }),
  };
}
