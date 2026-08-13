<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  importOpenVsxThemeExtension,
  searchOpenVsxThemes,
  type OpenVsxThemeExtension,
  type OpenVsxThemeSort,
  type ThemeImportProgress,
} from '../lib/openVsxThemes'
import type { InstalledTheme } from '../lib/themes'
import {
  installedThemes,
  removeInstalledThemeCollection,
  replaceInstalledThemeCollection,
  setTheme,
  uiState,
} from '../store'

const query = ref('')
const sortBy = ref<OpenVsxThemeSort>('downloadCount')
const results = ref<OpenVsxThemeExtension[]>([])
const searching = ref(false)
const installingId = ref<string | null>(null)
const progress = ref<ThemeImportProgress | null>(null)
const error = ref('')
const notice = ref('')
let searchController: AbortController | null = null
let installController: AbortController | null = null

type ThemeGroup = { collection: InstalledTheme['collection']; themes: InstalledTheme[] }

const installedGroups = computed<ThemeGroup[]>(() => {
  const groups = new Map<string, ThemeGroup>()
  for (const theme of installedThemes.value) {
    const group = groups.get(theme.collection.id) ?? {
      collection: theme.collection,
      themes: [],
    }
    group.themes.push(theme)
    groups.set(theme.collection.id, group)
  }
  return [...groups.values()]
})

const progressLabel = computed(() => {
  if (progress.value === 'manifest') return 'CHECKING_MANIFEST'
  if (progress.value === 'download') return 'DOWNLOADING_VSIX'
  if (progress.value === 'verify') return 'VERIFYING_SHA256'
  if (progress.value === 'extract') return 'IMPORTING_COLORS'
  return 'INSTALLING'
})

function isInstalled(extension: OpenVsxThemeExtension) {
  return installedThemes.value.some((theme) => theme.collection.id === extension.collectionId)
}

function formatDownloads(value: number) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}

function messageFrom(cause: unknown) {
  if (cause instanceof DOMException && cause.name === 'AbortError') return ''
  return cause instanceof Error ? cause.message : 'THEME_OPERATION_FAILED.'
}

async function search() {
  const term = query.value.trim()
  if (!term) {
    results.value = []
    error.value = 'ENTER_A_THEME_OR_PUBLISHER_NAME.'
    return
  }

  searchController?.abort()
  searchController = new AbortController()
  searching.value = true
  error.value = ''
  notice.value = ''
  try {
    results.value = await searchOpenVsxThemes(term, {
      signal: searchController.signal,
      sortBy: sortBy.value,
    })
    if (results.value.length === 0) notice.value = 'NO_COMPATIBLE_OPEN_SOURCE_THEMES_FOUND.'
  } catch (cause) {
    error.value = messageFrom(cause)
  } finally {
    searching.value = false
  }
}

async function install(extension: OpenVsxThemeExtension) {
  const updating = isInstalled(extension)
  if (
    updating &&
    !window.confirm(
      `Update ${extension.name}? This replaces every installed variant from this extension.`,
    )
  ) {
    return
  }

  installController?.abort()
  installController = new AbortController()
  installingId.value = extension.id
  progress.value = 'manifest'
  error.value = ''
  notice.value = ''
  try {
    const themes = await importOpenVsxThemeExtension(extension, {
      signal: installController.signal,
      onProgress: (next) => (progress.value = next),
    })
    replaceInstalledThemeCollection(themes)
    setTheme(themes[0]!.id)
    notice.value = `${extension.name.toUpperCase()}_${updating ? 'UPDATED' : 'INSTALLED'}_${themes.length}_VARIANT${themes.length === 1 ? '' : 'S'}.`
  } catch (cause) {
    error.value = messageFrom(cause)
  } finally {
    installingId.value = null
    progress.value = null
  }
}

function remove(group: ThemeGroup) {
  if (!window.confirm(`Remove ${group.collection.label} and all of its installed variants?`)) return
  removeInstalledThemeCollection(group.collection.id)
  notice.value = `${group.collection.label.toUpperCase()}_REMOVED.`
  error.value = ''
}

onBeforeUnmount(() => {
  searchController?.abort()
  installController?.abort()
})
</script>

<template>
  <section
    id="community-themes"
    class="tui-panel flex flex-col gap-4"
    aria-labelledby="themes-title"
  >
    <div>
      <h2 id="themes-title" class="font-bold uppercase">&gt;&gt; OPEN_VSX_THEME_UPLINK</h2>
      <p class="mt-2 opacity-70 leading-relaxed">
        SEARCH PERMISSIVELY_LICENSED VS_CODE COLOR THEMES. PACKAGES ARE SIZE_CHECKED AND THEIR
        OPEN_VSX SHA-256 CHECKSUM IS VERIFIED BEFORE COLORS ARE INSTALLED LOCALLY.
      </p>
    </div>

    <form class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]" @submit.prevent="search">
      <label class="sr-only" for="theme-query">Theme search</label>
      <input
        id="theme-query"
        v-model="query"
        class="tui-field min-w-0"
        type="search"
        autocomplete="off"
        placeholder="SEARCH: DRACULA, CATPPUCCIN, GITHUB..."
      />
      <label class="sr-only" for="theme-sort">Sort themes</label>
      <select id="theme-sort" v-model="sortBy" class="tui-field uppercase">
        <option value="downloadCount">DOWNLOADS</option>
        <option value="rating">RATING</option>
        <option value="timestamp">RECENT</option>
        <option value="relevance">RELEVANCE</option>
      </select>
      <button class="tui-btn" type="submit" :disabled="searching || installingId !== null">
        {{ searching ? '[SCANNING...]' : '[SEARCH]' }}
      </button>
    </form>

    <p v-if="error" class="border border-red-500 bg-red-950/30 p-2 text-red-300" role="alert">
      ERROR: {{ error.toUpperCase() }}
    </p>
    <p v-else-if="notice" class="border border-tui-cyan p-2 text-tui-cyan" role="status">
      {{ notice }}
    </p>

    <div v-if="results.length" class="grid gap-3 lg:grid-cols-2" aria-label="Search results">
      <article
        v-for="extension in results"
        :key="extension.id"
        class="tui-panel-muted flex min-w-0 flex-col gap-3"
      >
        <div class="flex items-start gap-3">
          <img
            v-if="extension.iconUrl"
            class="h-12 w-12 shrink-0 border border-tui-border object-cover"
            :src="extension.iconUrl"
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
          />
          <div class="min-w-0">
            <h3 class="font-bold break-words">{{ extension.name }}</h3>
            <p class="text-sm opacity-70 break-all">
              {{ extension.publisher }} · V{{ extension.version }} · {{ extension.license }} ·
              {{ formatDownloads(extension.downloadCount) }} DL
            </p>
          </div>
        </div>
        <p v-if="extension.description" class="line-clamp-2 text-sm opacity-80">
          {{ extension.description }}
        </p>
        <div class="mt-auto flex items-center justify-between gap-3">
          <a
            v-if="extension.sourceUrl"
            class="text-sm text-tui-cyan underline"
            :href="extension.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            SOURCE
          </a>
          <span v-else></span>
          <button
            class="tui-btn shrink-0"
            type="button"
            :disabled="installingId !== null"
            @click="install(extension)"
          >
            <template v-if="installingId === extension.id">[{{ progressLabel }}...]</template>
            <template v-else-if="isInstalled(extension)">[UPDATE]</template>
            <template v-else>[INSTALL]</template>
          </button>
        </div>
      </article>
    </div>

    <div class="border-t border-tui-active/60 pt-4">
      <h3 class="mb-3 font-bold uppercase">INSTALLED_COMMUNITY_THEMES</h3>
      <p v-if="installedGroups.length === 0" class="opacity-60">NO_COMMUNITY_THEMES_INSTALLED.</p>
      <div v-else class="grid gap-3 lg:grid-cols-2">
        <article
          v-for="group in installedGroups"
          :key="group.collection.id"
          class="tui-panel-muted flex flex-col gap-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h4 class="font-bold">{{ group.collection.label }}</h4>
              <p class="text-sm opacity-60 break-all">
                {{ group.collection.extensionId }} · V{{ group.collection.version }} ·
                {{ group.collection.license }}
              </p>
            </div>
            <button
              class="border border-red-400 px-2 py-1 text-sm text-red-300 hover:bg-red-950/50"
              type="button"
              @click="remove(group)"
            >
              [REMOVE]
            </button>
          </div>

          <div class="flex flex-col gap-2">
            <button
              v-for="theme in group.themes"
              :key="theme.id"
              class="flex items-center gap-2 border px-2 py-1 text-left"
              :class="
                uiState.theme === theme.id
                  ? 'border-tui-cyan bg-tui-active font-bold'
                  : 'border-tui-active/60 hover:border-tui-cyan'
              "
              type="button"
              @click="setTheme(theme.id)"
            >
              <span aria-hidden="true">{{ uiState.theme === theme.id ? '●' : '○' }}</span>
              <span class="min-w-0 flex-1 truncate">{{ theme.label }}</span>
              <span class="text-xs opacity-60">{{ theme.appearance.toUpperCase() }}</span>
              <span class="flex" aria-hidden="true">
                <i
                  v-for="color in [
                    theme.colors.background,
                    theme.colors.text,
                    theme.colors.cyan,
                    theme.colors.yellow,
                  ]"
                  :key="color"
                  class="h-4 w-4 border border-black/30"
                  :style="{ backgroundColor: color }"
                ></i>
              </span>
            </button>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
