/* ══════════════════════════════════════════════════════════════════
   CALLOUT — the highlighted box, as a first-class editor node

   `<div class="callout">` is one of the INSERT snippets and is styled
   on the public page. Without a node for it, TipTap does not recognise
   the div and throws it away the moment an admin switches to visual
   mode — they would watch their callout silently become a plain
   paragraph. This teaches the editor to read it, keep it, and write it
   back out in exactly the shape the public stylesheet expects.
   ══════════════════════════════════════════════════════════════════ */

import { Node, mergeAttributes } from '@tiptap/react'

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    callout: {
      /** Wrap the selection in a callout, or unwrap one already there. */
      toggleCallout: () => ReturnType
    }
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div.callout' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'callout' }), 0]
  },

  addCommands() {
    return {
      toggleCallout: () => ({ commands }) => commands.toggleWrap(this.name),
    }
  },
})
