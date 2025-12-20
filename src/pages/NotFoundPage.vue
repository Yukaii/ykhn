<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>Not found</h1>
      <p class="muted">That page doesn’t exist.</p>
    </header>

    <div class="card">
      <RouterLink class="btn" to="/">Go to Top stories</RouterLink>
    </div>
  </div>
</template>
