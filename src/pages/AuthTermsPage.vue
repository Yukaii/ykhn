<template>
  <div class="max-w-3xl mx-auto flex flex-col gap-4">
    <section class="tui-panel">
      <div class="tui-section-heading mb-4">AUTH_TERMS_AND_RISK_NOTICE</div>

      <div class="prose prose-invert max-w-none font-content space-y-4">
        <p>
          YKHN login actions are provided through an unofficial Hacker News auth proxy. Hacker News
          does not provide OAuth or API tokens for voting, favorites, replies, or account pages, so
          authenticated actions require a normal HN web login and an HN session cookie.
        </p>

        <p>
          The proxy code is published at
          <a href="https://github.com/Yukaii/hn-auth-proxy" target="_blank" rel="noreferrer"
            >github.com/Yukaii/hn-auth-proxy</a
          >, but published source code does not prove what is currently deployed or how the server
          is operated. Treat login as a trust decision.
        </p>

        <p>
          When you log in, your Hacker News username and password are sent to the auth proxy over
          HTTPS. The proxy submits them to Hacker News, stores the resulting HN session cookie
          server-side, and returns a JWT to this app. The intended design is not to store your HN
          password, but you should not treat that as a guarantee.
        </p>

        <p>
          This service is mainly built for my personal use. If you are not comfortable trusting this
          deployment with your Hacker News login, do not log in. You can continue using YKHN as a
          read-only Hacker News client without authentication.
        </p>
      </div>
    </section>

    <section class="tui-panel-muted">
      <div class="font-bold text-tui-yellow mb-2 uppercase">Before logging in, understand:</div>
      <ul class="list-disc pl-6 space-y-2 font-content">
        <li>This is not an official Hacker News login integration.</li>
        <li>Your credentials pass through a server operated by this project.</li>
        <li>
          The server-side HN session can perform actions as your HN account while it remains valid.
        </li>
        <li>
          Open source helps with review, but does not guarantee the deployed server matches the
          repository.
        </li>
        <li>You should only log in if you understand and accept that trust model.</li>
      </ul>
    </section>
  </div>
</template>
