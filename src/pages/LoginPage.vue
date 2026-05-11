<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { loginToAuthProxy } from '../api/auth'
import { authState, setAuthSession } from '../store'

const router = useRouter()
const route = useRoute()

const username = ref(authState.userId ?? '')
const password = ref('')
const consent = ref(false)
const loading = ref(false)
const error = ref('')

const canSubmit = computed(
  () =>
    username.value.trim().length > 0 &&
    password.value.length > 0 &&
    consent.value &&
    !loading.value,
)

function nextPath() {
  const next = route.query.next
  return typeof next === 'string' && next.startsWith('/') ? next : '/'
}

async function submit() {
  if (!canSubmit.value) return

  loading.value = true
  error.value = ''

  try {
    const session = await loginToAuthProxy(username.value.trim(), password.value)
    setAuthSession(session)
    password.value = ''
    router.push(nextPath())
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto">
    <form class="tui-panel flex flex-col gap-4" @submit.prevent="submit">
      <div>
        <div class="tui-section-heading mb-3">AUTH_LOGIN</div>
        <div v-if="authState.userId" class="tui-panel-muted">
          CURRENT_USER:
          <span class="font-bold text-tui-yellow">{{ authState.userId.toUpperCase() }}</span>
        </div>
        <div class="tui-panel-muted mt-3 text-sm leading-relaxed">
          Login is handled by
          <a
            class="font-bold text-tui-yellow underline"
            href="https://github.com/Yukaii/hn-auth-proxy"
            target="_blank"
            rel="noreferrer"
          >
            hn-auth-proxy </a
          >. The backend submits your HN credentials to Hacker News, stores the HN session cookie
          server-side, and returns a JWT to this app. Read the
          <RouterLink class="font-bold text-tui-yellow underline" to="/auth-terms">
            auth risk notice
          </RouterLink>
          before logging in.
        </div>
      </div>

      <label class="flex flex-col gap-1 font-bold uppercase">
        <span>HN_USER</span>
        <input
          v-model="username"
          class="tui-field"
          name="username"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          :disabled="loading"
        />
      </label>

      <label class="flex flex-col gap-1 font-bold uppercase">
        <span>HN_PASSWORD</span>
        <input
          v-model="password"
          class="tui-field"
          name="password"
          type="password"
          autocomplete="current-password"
          :disabled="loading"
        />
      </label>

      <div
        v-if="error"
        class="border border-red-500 bg-red-950/60 px-3 py-2 font-bold"
        role="alert"
      >
        {{ error }}
      </div>

      <label class="flex items-start gap-3 tui-panel-muted cursor-pointer">
        <input
          v-model="consent"
          class="mt-1 size-4 accent-current"
          type="checkbox"
          :disabled="loading"
        />
        <span class="font-mono text-sm leading-relaxed">
          I have read the auth risk notice and understand this is an unofficial service mainly built
          for the maintainer's personal use. I accept that my HN credentials pass through this
          project's backend and that published source code does not guarantee the deployed server
          behavior.
        </span>
      </label>

      <div class="flex justify-end gap-2">
        <button class="tui-btn" type="button" :disabled="loading" @click="router.back()">
          CANCEL
        </button>
        <button class="tui-btn" type="submit" :disabled="!canSubmit">
          {{ loading ? 'VERIFYING...' : 'LOGIN' }}
        </button>
      </div>
    </form>
  </div>
</template>
