<script lang="ts">
  import { enhance } from "$app/forms"
  import { page } from "$app/state"
  import { Button, Card, Input, PageHeader } from "$lib/components"

  const user = $derived(page.data.user)
  const profile = $derived(user?.profile)
  const form = $derived(page.form)
</script>

<PageHeader title="Profile" subtitle="Your personal information" />

<div class="profile-grid">
  <!-- Profile Information -->
  <Card>
    <form method="POST" action="?/updateProfile" use:enhance class="profile-form">
      {#if form?.profileError}
        <p class="form-error">{form.profileError}</p>
      {/if}
      {#if form?.profileSuccess}
        <p class="form-success">Profile updated.</p>
      {/if}

      <div class="form-row">
        <Input name="firstName" label="First name" value={profile?.firstName ?? ""} required />
        <Input name="lastName" label="Last name" value={profile?.lastName ?? ""} required />
      </div>

      <div class="form-row">
        <Input name="weight" label="Weight (lbs)" type="number" value={profile?.weight?.toString() ?? ""} />
        <Input name="height" label="Height (in)" type="number" value={profile?.height?.toString() ?? ""} />
      </div>

      <div class="input-group">
        <span class="input-label">Sex</span>
        <div class="toggle-group">
          <label class="toggle-option">
            <input type="radio" name="sex" value="male" checked={profile?.sex === "male"} />
            <span>Male</span>
          </label>
          <label class="toggle-option">
            <input type="radio" name="sex" value="female" checked={profile?.sex === "female"} />
            <span>Female</span>
          </label>
        </div>
      </div>

      <div class="form-row">
        <Input name="bmi" label="BMI" type="number" value={profile?.bmi?.toString() ?? ""} />
        <Input
          name="bodyFatPercent"
          label="Body fat %"
          type="number"
          value={profile?.bodyFatPercent?.toString() ?? ""}
        />
      </div>

      <div class="form-actions">
        <Button variant="primary" type="submit">Save profile</Button>
      </div>
    </form>
  </Card>

  <!-- Password -->
  <Card>
    <form method="POST" action="?/updatePassword" use:enhance class="profile-form">
      <h3 class="section-title">Update password</h3>

      {#if form?.passwordError}
        <p class="form-error">{form.passwordError}</p>
      {/if}
      {#if form?.passwordSuccess}
        <p class="form-success">Password updated.</p>
      {/if}

      <Input name="currentPassword" label="Current password" type="password" required />
      <Input name="newPassword" label="New password" type="password" required />
      <Input name="confirmNewPassword" label="Confirm new password" type="password" required />

      <div class="form-actions">
        <Button variant="secondary" type="submit">Update password</Button>
      </div>
    </form>
  </Card>
</div>

<style>
  .profile-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: 600px;
  }

  .profile-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .form-actions {
    padding-top: var(--space-2);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }

  .form-error {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent);
  }

  .form-success {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent-green);
  }

  /* Sex toggle group */
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

  .toggle-group {
    display: flex;
    gap: var(--space-2);
  }

  .toggle-option {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .toggle-option input {
    display: none;
  }

  .toggle-option span {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-4);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--ink-light);
    transition: all var(--transition-fast);
  }

  .toggle-option input:checked + span {
    border-color: var(--accent);
    color: var(--accent);
    background: transparent;
  }

  .toggle-option:hover span {
    border-color: var(--border-strong);
  }
</style>
