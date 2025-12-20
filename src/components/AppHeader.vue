<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useOnline } from '../composables/useOnline'

const { online } = useOnline()
</script>

<template>
  <header class="app-header">
    <div class="app-header__left">
      <RouterLink class="brand" to="/" aria-label="Go to Top stories">YKHN</RouterLink>
      <span class="pill" :class="online ? 'pill--ok' : 'pill--warn'">
        {{ online ? 'online' : 'offline' }}
      </span>
    </div>

    <nav class="app-header__right" aria-label="Top links">
      <RouterLink class="link" to="/about">About</RouterLink>
    </nav>
  </header>
</template>
