<script lang="ts">
  import { enhance } from "$app/forms"
  import { page } from "$app/state"
  import { Button, Card, Input, PageHeader } from "$lib/components"

  const user = $derived(page.data.user)
  const profile = $derived(user?.profile)
  const form = $derived(page.form)

  const today = new Date().toISOString().split("T")[0]

  let useTdeeOverride = $state(false)
  let selectedActivityLevel = $state("")
  let birthDateValue = $state("")
  let weightValue = $state("")
  let heightValue = $state("")
  let sexValue = $state("")
  let tdeeOverrideValue = $state("")

  // Sync from profile data
  $effect(() => {
    const p = profile
    if (p) {
      useTdeeOverride = p.tdeeOverride != null
      selectedActivityLevel = p.activityLevel ?? ""
      birthDateValue = p.birthDate ?? ""
      weightValue = p.weight?.toString() ?? ""
      heightValue = p.height?.toString() ?? ""
      sexValue = p.sex ?? ""
      tdeeOverrideValue = p.tdeeOverride?.toString() ?? ""
    }
  })

  const ACTIVITY_LEVELS = [
    { value: "sedentary", label: "Sedentary", desc: "Little or no exercise, desk job" },
    { value: "lightly_active", label: "Lightly active", desc: "Light exercise 1\u20133 days/week" },
    {
      value: "moderately_active",
      label: "Moderately active",
      desc: "Moderate exercise 3\u20135 days/week",
    },
    { value: "very_active", label: "Very active", desc: "Hard exercise 6\u20137 days/week" },
    {
      value: "extremely_active",
      label: "Extremely active",
      desc: "Very hard exercise, physical job, or twice daily training",
    },
  ] as const

  const MULTIPLIERS: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9,
  }

  function getAge(birthDate: string): number {
    const birth = new Date(birthDate)
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const monthDiff = now.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const canCalculateTdee = $derived(
    weightValue && heightValue && sexValue && birthDateValue && selectedActivityLevel,
  )

  const tdeeCalc = $derived.by(() => {
    if (!canCalculateTdee) return null
    const weightKg = Number(weightValue) * 0.453592
    const heightCm = Number(heightValue) * 2.54
    const age = getAge(birthDateValue)
    let bmr: number
    if (sexValue === "male") {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    }
    const multiplier = MULTIPLIERS[selectedActivityLevel] ?? 1.2
    const tdee = Math.round(bmr * multiplier)
    return { bmr: Math.round(bmr), multiplier, tdee }
  })

  const effectiveTdee = $derived(
    useTdeeOverride && tdeeOverrideValue ? Number(tdeeOverrideValue) : tdeeCalc?.tdee ?? null,
  )
</script>

<PageHeader title="Profile" subtitle="Your personal information" />

<div class="profile-grid">
  <!-- Profile Information -->
  <Card>
    <form
      method="POST"
      action="?/updateProfile"
      use:enhance
      class="profile-form"
      oninput={(e) => {
        const target = e.target as HTMLInputElement
        if (target.name === "weight") weightValue = target.value
        if (target.name === "height") heightValue = target.value
        if (target.name === "tdeeOverride") tdeeOverrideValue = target.value
      }}
    >
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
        <Input
          name="weight"
          label="Weight (lbs)"
          type="number"
          value={profile?.weight?.toString() ?? ""}
        />
        <Input
          name="height"
          label="Height (in)"
          type="number"
          value={profile?.height?.toString() ?? ""}
        />
      </div>

      <div class="input-group">
        <span class="input-label">Sex</span>
        <div class="toggle-group">
          <label class="toggle-option">
            <input
              type="radio"
              name="sex"
              value="male"
              checked={profile?.sex === "male"}
              onchange={() => (sexValue = "male")}
            />
            <span>Male</span>
          </label>
          <label class="toggle-option">
            <input
              type="radio"
              name="sex"
              value="female"
              checked={profile?.sex === "female"}
              onchange={() => (sexValue = "female")}
            />
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

      <!-- Birth Date -->
      <div class="input-group">
        <label class="input-label" for="birthDate">Date of birth</label>
        <input
          type="date"
          id="birthDate"
          name="birthDate"
          max={today}
          value={profile?.birthDate ?? ""}
          onchange={(e) => (birthDateValue = e.currentTarget.value)}
        />
      </div>

      <!-- Activity Level -->
      <div class="input-group">
        <span class="input-label">Activity level</span>
        <div class="activity-options">
          {#each ACTIVITY_LEVELS as level}
            <label class="activity-option">
              <input
                type="radio"
                name="activityLevel"
                value={level.value}
                checked={profile?.activityLevel === level.value}
                onchange={() => (selectedActivityLevel = level.value)}
              />
              <div class="activity-content">
                <span class="activity-label">{level.label}</span>
                <span class="activity-desc">{level.desc}</span>
              </div>
            </label>
          {/each}
        </div>
      </div>

      <!-- TDEE Display -->
      {#if tdeeCalc}
        <div class="tdee-section">
          <h3 class="section-title">Total Daily Energy Expenditure</h3>

          <div class="tdee-breakdown">
            <div class="tdee-row">
              <span class="tdee-label">BMR (Mifflin-St Jeor)</span>
              <span class="tdee-value">{tdeeCalc.bmr} kcal</span>
            </div>
            <div class="tdee-row">
              <span class="tdee-label">Activity multiplier</span>
              <span class="tdee-value">&times; {tdeeCalc.multiplier}</span>
            </div>
            <div class="tdee-row tdee-total" class:tdee-overridden={useTdeeOverride}>
              <span class="tdee-label">Calculated TDEE</span>
              <span class="tdee-value">{tdeeCalc.tdee} kcal</span>
            </div>
          </div>

          <!-- Override toggle -->
          <label class="override-toggle">
            <input
              type="checkbox"
              name="useTdeeOverride"
              checked={useTdeeOverride}
              onchange={(e) => (useTdeeOverride = e.currentTarget.checked)}
            />
            <span>Use a custom calorie target instead</span>
          </label>

          {#if useTdeeOverride}
            <div class="override-input">
              <Input
                name="tdeeOverride"
                label="Custom calorie target (kcal)"
                type="number"
                value={tdeeOverrideValue}
              />
            </div>
          {:else}
            <input type="hidden" name="tdeeOverride" value="" />
          {/if}

          {#if effectiveTdee}
            <div class="tdee-effective">
              <span class="tdee-effective-label">Effective daily target</span>
              <span class="tdee-effective-value">{effectiveTdee} kcal</span>
            </div>
          {/if}
        </div>
      {:else if birthDateValue || selectedActivityLevel}
        <div class="tdee-section">
          <h3 class="section-title">Total Daily Energy Expenditure</h3>
          <p class="tdee-incomplete">
            Fill in weight, height, sex, date of birth, and activity level to calculate your TDEE.
          </p>
        </div>
      {/if}

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

  /* Date input */
  input[type="date"] {
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

  input[type="date"]:focus {
    border-bottom-color: var(--border-strong);
  }

  /* Activity level selector */
  .activity-options {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .activity-option {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .activity-option:hover {
    border-color: var(--border-strong);
  }

  .activity-option:has(input:checked) {
    border-color: var(--accent);
  }

  .activity-option input[type="radio"] {
    margin-top: 2px;
    accent-color: var(--accent);
  }

  .activity-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .activity-label {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink);
  }

  .activity-option:has(input:checked) .activity-label {
    color: var(--accent);
  }

  .activity-desc {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  /* TDEE section */
  .tdee-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
  }

  .tdee-breakdown {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .tdee-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }

  .tdee-label {
    color: var(--ink-light);
  }

  .tdee-value {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  .tdee-total {
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
    font-weight: 500;
  }

  .tdee-total .tdee-value {
    font-size: var(--text-base);
  }

  .tdee-overridden .tdee-value {
    color: var(--ink-faint);
    text-decoration: line-through;
  }

  .tdee-overridden .tdee-label {
    color: var(--ink-faint);
  }

  /* Override toggle */
  .override-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .override-toggle input {
    accent-color: var(--accent);
  }

  .override-input {
    padding-left: var(--space-6);
  }

  /* Effective TDEE */
  .tdee-effective {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-4);
    background: var(--surface);
    border-radius: var(--radius-sm);
  }

  .tdee-effective-label {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink);
  }

  .tdee-effective-value {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }

  .tdee-incomplete {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
    margin: 0;
  }
</style>
