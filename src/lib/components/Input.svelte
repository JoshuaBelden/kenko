<script lang="ts">
  interface Props {
    label?: string
    type?: string
    name: string
    placeholder?: string
    value?: string
    required?: boolean
    error?: string
    step?: string
  }

  let { label, type = "text", name, placeholder = "", value = "", required = false, error, step }: Props = $props()
</script>

<div class="input-group">
  {#if label}
    <label class="input-label" for={name}>{label}</label>
  {/if}
  <input {type} {name} id={name} {placeholder} bind:value {required} {step} class:has-error={error} />
  {#if error}
    <span class="input-error">{error}</span>
  {/if}
</div>

<style>
  .input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .input-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  input {
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 400;
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-3) 0;
    outline: none;
    transition: border-color var(--transition-fast);
    width: 100%;
  }

  input:focus {
    border-bottom-color: var(--border-strong);
  }

  input.has-error {
    border-bottom-color: var(--accent);
  }

  input::placeholder {
    color: var(--ink-faint);
  }

  .input-error {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--accent);
  }
</style>
