<script lang="ts">
  import { Button, Card, Input, PageHeader } from "$lib/components"
</script>

<div class="auth-container">
  <PageHeader title="Welcome back" subtitle="Sign in to continue your journey" />

  <Card>
    <form method="POST" class="auth-form">
      <Input name="email" label="Email" type="email" placeholder="you@example.com" required />
      <Input name="password" label="Password" type="password" placeholder="Your password" required />
      <div class="auth-actions">
        <Button variant="primary" type="submit">Sign in</Button>
      </div>
    </form>
  </Card>

  <p class="auth-link">
    Don't have an account? <a href="/register">Create one</a>
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
