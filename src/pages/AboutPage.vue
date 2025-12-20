<script setup lang="ts"></script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>About</h1>
      <p class="muted">
        YKHN is a fast, offline-friendly Hacker News client built with Bun + Vite + Vue.
      </p>
    </header>

    <section class="card">
      <h2>Offline</h2>
      <p class="muted">
        Once you’ve loaded a feed, the app caches the API responses so you can revisit stories even
        without a connection.
      </p>
    </section>

    <section class="card">
      <h2>Data</h2>
      <p class="muted">
        Powered by the official Hacker News Firebase API.
      </p>
    </section>
  </div>
</template>
