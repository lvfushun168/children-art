import { onBeforeUnmount, onMounted } from 'vue'

// 手机端断点，必须与 style.css 中的 `@media (max-width: 680px)` 保持一致。
export const MOBILE_MAX_WIDTH = 680

/**
 * 按手机端断点同步 isMobile，并在断点变化时回调 onSync(matches)。
 * 需要在组件 setup 顶层调用。
 */
export function useMobileMedia(isMobile, onSync) {
  let media = null

  const sync = () => {
    isMobile.value = media.matches
    onSync?.(media.matches)
  }

  onMounted(() => {
    media = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`)
    sync()
    media.addEventListener('change', sync)
  })

  onBeforeUnmount(() => media?.removeEventListener('change', sync))
}
