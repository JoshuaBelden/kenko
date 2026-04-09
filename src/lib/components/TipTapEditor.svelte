<script lang="ts">
  import { onMount, onDestroy } from "svelte"
  import { Editor } from "@tiptap/core"
  import StarterKit from "@tiptap/starter-kit"

  type Props = {
    content: string | null
    onblur?: (html: string) => void
    placeholder?: string
    disabled?: boolean
  }

  let { content = null, onblur, placeholder = "Start writing...", disabled = false }: Props = $props()

  let element: HTMLDivElement | undefined = $state()
  let editor: Editor | undefined = $state()

  onMount(() => {
    if (!element) return
    editor = new Editor({
      element,
      extensions: [StarterKit],
      content: content ?? "",
      editable: !disabled,
      onBlur({ editor: e }) {
        onblur?.(e.getHTML())
      },
    })

    // TipTap replaces the element — update reference
    element = editor.options.element as HTMLDivElement
  })

  onDestroy(() => {
    editor?.destroy()
  })

  // Update editable state when disabled changes
  $effect(() => {
    editor?.setEditable(!disabled)
  })
</script>

<div class="tiptap-wrapper" class:disabled>
  {#if !editor}
    <div class="tiptap-placeholder">{placeholder}</div>
  {/if}
  <div bind:this={element} class="tiptap-editor"></div>
</div>

<style>
  .tiptap-wrapper {
    background: var(--paper-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    transition: border-color var(--transition-fast);
    min-height: 240px;
  }

  .tiptap-wrapper:focus-within {
    border-color: var(--border-strong);
  }

  .tiptap-wrapper.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .tiptap-placeholder {
    padding: var(--space-3) var(--space-4);
    color: var(--ink-faint);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }

  .tiptap-editor {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    line-height: 1.7;
  }

  .tiptap-editor :global(.tiptap) {
    padding: var(--space-3) var(--space-4);
    outline: none;
    min-height: 200px;
  }

  .tiptap-editor :global(.tiptap p) {
    margin: 0 0 var(--space-2) 0;
  }

  .tiptap-editor :global(.tiptap p:last-child) {
    margin-bottom: 0;
  }

  .tiptap-editor :global(.tiptap h1),
  .tiptap-editor :global(.tiptap h2),
  .tiptap-editor :global(.tiptap h3) {
    font-family: var(--font-display);
    font-weight: 500;
    margin: var(--space-3) 0 var(--space-2) 0;
  }

  .tiptap-editor :global(.tiptap ul),
  .tiptap-editor :global(.tiptap ol) {
    padding-left: var(--space-5);
    margin: var(--space-2) 0;
  }

  .tiptap-editor :global(.tiptap blockquote) {
    border-left: 2px solid var(--border);
    padding-left: var(--space-4);
    margin: var(--space-2) 0;
    color: var(--ink-light);
  }

  .tiptap-editor :global(.tiptap code) {
    background: var(--paper-warm);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .tiptap-editor :global(.tiptap pre) {
    background: var(--paper-warm);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    overflow-x: auto;
  }
</style>
