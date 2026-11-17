<template>
  <div class="p-2 flex flex-col h-full items-center">
    <div class="flex flex-col items-center p-2 mb-4">
      <img class="w-12 h-12 grayscale opacity-75" src="/images/TransferOrb.png" :title="t('app.tagline')">
      <p class="text-base">Unawakened PoE Trade</p>
      <p class="text-gray-400 italic">{{ t('app.tagline') }}</p>
      <p class="">{{ t('app.version', [version]) }}</p>
      <div class="flex gap-2">
        <a class="border-b" :href="`${REPO_URL}/releases`" target="_blank">{{ t('app.release_notes') }}</a>
        <a class="border-b" :href="`${REPO_URL}/issues`" target="_blank">{{ t('app.report_bug') }}</a>
      </div>
    </div>
    <div class="border border-gray-600 rounded p-2 whitespace-nowrap min-w-min w-72">
      <p>{{ info.str1 }}</p>
      <p>{{ info.str2 }}</p>
      <button v-if="info.action" @click="info.action"
        class="btn w-full mt-1">{{ info.actionText }}</button>
    </div>
    <div class="text-center mt-auto py-8 text-gray-400">
      <p>{{ t('app.footer_joke') }}</p>
      <p class="text-xs text-gray-500 mt-2">{{ t('app.disclaimer') }}</p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Host } from '@/web/background/IPC'
import { DateTime } from 'luxon'

function checkForUpdates () {
  Host.sendEvent({
    name: 'CLIENT->MAIN::user-action',
    payload: { action: 'check-for-update' }
  })
}

const REPO_URL = 'https://github.com/SlowQuasar/unawakened-poe-trade'

function openDownloadPage () {
  window.open(`${REPO_URL}/releases/latest`)
}

function quitAndInstall () {
  Host.sendEvent({
    name: 'CLIENT->MAIN::user-action',
    payload: { action: 'update-and-restart' }
  })
}

function fmtTime (millis: number) {
  return DateTime.fromMillis(millis).toRelative({ style: 'long' }) ?? 'n/a'
}

export default defineComponent({
  name: 'settings.about',
  inheritAttrs: false,
  setup () {
    const { t } = useI18n()

    const info = computed(() => {
      const rawInfo = Host.updateInfo.value
      switch (rawInfo.state) {
        case 'initial':
          return { str1: t('updates.maybe_outdated'), str2: t('updates.never_checked'), action: checkForUpdates, actionText: t('updates.check_now') }
        case 'checking-for-update':
          return { str1: t('updates.checking'), str2: t('please_wait') }
        case 'update-not-available':
          return { str1: t('updates.latest'), str2: t('updates.last_checked', [fmtTime(rawInfo.checkedAt)]), action: checkForUpdates, actionText: t('updates.check_now') }
        case 'error':
          return { str1: t('updates.maybe_outdated'), str2: t('updates.error'), action: openDownloadPage, actionText: t('updates.downloads_page') }
        case 'update-downloaded':
          return { str1: t('updates.available', [rawInfo.version]), str2: t('updates.installed_on_exit'), action: quitAndInstall, actionText: t('updates.install_now') }
        case 'update-available':
          return (rawInfo.noDownloadReason)
            ? { str1: t('updates.available', [rawInfo.version]), str2: (rawInfo.noDownloadReason === 'not-supported') ? t('updates.download_manually') : t('updates.download_disabled'), action: openDownloadPage, actionText: t('updates.downloads_page') }
            : { str1: t('updates.available', [rawInfo.version]), str2: t('updates.downloading') }
      }
    })

    return {
      t,
      info,
      version: Host.version,
      REPO_URL
    }
  }
})
</script>
