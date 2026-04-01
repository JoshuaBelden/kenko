<script lang="ts">
  import { Card, PageHeader, StatNumber } from "$lib/components"
</script>

<PageHeader kanji="道場" title="Dojo" subtitle="Train with purpose" />

<section class="section">
  <h3>Workout Library</h3>
  <div class="workout-grid">
    <Card>
      <span class="workout-label">Strength</span>
      <h4 class="workout-name">Upper Body Push</h4>
      <p class="workout-detail">Chest, shoulders, triceps</p>
      <div class="workout-meta">
        <StatNumber value="45" label="min" size="sm" />
      </div>
    </Card>
    <Card>
      <span class="workout-label">Strength</span>
      <h4 class="workout-name">Lower Body</h4>
      <p class="workout-detail">Squats, lunges, deadlifts</p>
      <div class="workout-meta">
        <StatNumber value="50" label="min" size="sm" />
      </div>
    </Card>
    <Card>
      <span class="workout-label">Cardio</span>
      <h4 class="workout-name">Morning Run</h4>
      <p class="workout-detail">Easy pace, 5K route</p>
      <div class="workout-meta">
        <StatNumber value="30" label="min" size="sm" />
      </div>
    </Card>
    <Card>
      <span class="workout-label">Flexibility</span>
      <h4 class="workout-name">Yoga Flow</h4>
      <p class="workout-detail">Sun salutations, balance poses</p>
      <div class="workout-meta">
        <StatNumber value="25" label="min" size="sm" />
      </div>
    </Card>
  </div>
</section>

<section class="section">
  <h3>Personal Records</h3>
  <div class="records-grid">
    <Card>
      <StatNumber value="185" label="Bench press (lbs)" size="md" />
    </Card>
    <Card>
      <StatNumber value="24:30" label="5K time" size="md" />
    </Card>
    <Card>
      <StatNumber value="275" label="Deadlift (lbs)" size="md" />
    </Card>
  </div>
</section>

<style>
  .section {
    margin-bottom: var(--space-8);
  }

  .section h3 {
    margin-bottom: var(--space-4);
  }

  .workout-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }

  @media (min-width: 640px) {
    .workout-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .workout-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--accent);
  }

  .workout-name {
    font-size: var(--text-lg);
    margin-top: var(--space-2);
  }

  .workout-detail {
    font-size: var(--text-sm);
    margin-top: var(--space-1);
  }

  .workout-meta {
    margin-top: var(--space-4);
    padding-top: var(--space-3);
    border-top: 0.5px solid var(--border);
  }

  .records-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }

  @media (max-width: 639px) {
    .records-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
