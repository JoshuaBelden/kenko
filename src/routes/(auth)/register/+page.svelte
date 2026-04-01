<script lang="ts">
  import { page } from "$app/state"
  import { Button, Card, Input } from "$lib/components"

  const form = $derived(page.form)
</script>

<div class="auth-container">
  <Card>
    <form method="POST" class="auth-form">
      {#if form?.missing}
        <p class="form-error">Please fill in all fields.</p>
      {/if}
      {#if form?.mismatch}
        <p class="form-error">Passwords do not match.</p>
      {/if}
      {#if form?.weak}
        <p class="form-error">Password must be at least 8 characters.</p>
      {/if}
      {#if form?.emailTaken}
        <p class="form-error">An account with this email already exists.</p>
      {/if}

      <Input name="email" label="Email" type="email" placeholder="you@example.com" value={form?.email ?? ""} required />
      <Input name="password" label="Password" type="password" placeholder="Choose a password" required />
      <Input
        name="confirmPassword"
        label="Confirm password"
        type="password"
        placeholder="Repeat your password"
        required
      />
      <div class="auth-actions">
        <Button variant="primary" type="submit">Create account</Button>
      </div>
    </form>
  </Card>

  <p class="auth-link">
    Already have an account? <a href="/login">Sign in</a>
  </p>
</div>

<style>
  .auth-container {
    max-width: 400px;
    width: 100%;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .auth-actions {
    padding-top: var(--space-2);
  }

  .auth-link {
    text-align: center;
    margin-top: var(--space-6);
    font-size: var(--text-sm);
  }

  .auth-link a {
    color: var(--accent);
    text-decoration: none;
  }

  .auth-link a:hover {
    text-decoration: underline;
  }

  .form-error {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent);
  }
</style>
