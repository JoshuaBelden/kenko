<script lang="ts">
  import { Button, Card, Input, PageHeader } from "$lib/components"
</script>

<div class="auth-container">
  <PageHeader title="Begin your journey" subtitle="Create an account to get started" />

  <Card>
    <form method="POST" class="auth-form">
      <Input name="name" label="Name" placeholder="Your name" required />
      <Input name="email" label="Email" type="email" placeholder="you@example.com" required />
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
    margin: var(--space-8) auto;
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
</style>
