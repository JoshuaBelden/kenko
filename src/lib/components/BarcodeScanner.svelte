<script lang="ts">
  interface Props {
    onscanned: (barcode: string) => void
    onerror: () => void
    oncancelled: () => void
  }

  let { onscanned, onerror, oncancelled }: Props = $props()

  let videoEl = $state<HTMLVideoElement | null>(null)
  let stream: MediaStream | null = null
  let animFrameId: number | null = null
  let stopped = false

  export function stop() {
    stopped = true
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      stream = null
    }
  }

  $effect(() => {
    startCamera()
    return () => stop()
  })

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      if (videoEl) {
        videoEl.srcObject = stream
      }
      const detector = new BarcodeDetector({ formats: ["ean_13", "upc_a"] })
      scanLoop(detector)
    } catch {
      onerror()
    }
  }

  function scanLoop(detector: BarcodeDetector) {
    if (stopped || !videoEl) return

    animFrameId = requestAnimationFrame(async () => {
      if (stopped || !videoEl || videoEl.readyState < 2) {
        scanLoop(detector)
        return
      }
      try {
        const results = await detector.detect(videoEl)
        if (results.length > 0 && !stopped) {
          stop()
          onscanned(results[0].rawValue)
          return
        }
      } catch {
        // detect can throw if video not ready
      }
      if (!stopped) scanLoop(detector)
    })
  }

  function handleCancel() {
    stop()
    oncancelled()
  }
</script>

<div class="scanner">
  <!-- svelte-ignore a11y_media_has_caption -->
  <video bind:this={videoEl} autoplay playsinline class="scanner-video"></video>
  <div class="scanner-overlay">
    <div class="viewfinder"></div>
  </div>
  <button class="cancel-btn" onclick={handleCancel}>Cancel</button>
</div>

<style>
  .scanner {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
    min-height: 300px;
    background: #000;
  }

  .scanner-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .scanner-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .viewfinder {
    width: 220px;
    height: 140px;
    border: 2px solid rgba(255, 255, 255, 0.7);
    border-radius: 8px;
  }

  .cancel-btn {
    position: absolute;
    bottom: var(--space-4, 16px);
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: var(--radius-sm, 4px);
    padding: var(--space-2, 8px) var(--space-4, 16px);
    font-family: var(--font-body, inherit);
    font-size: var(--text-sm, 14px);
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: rgba(0, 0, 0, 0.8);
  }
</style>
