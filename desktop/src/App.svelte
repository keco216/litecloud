<script lang="ts">
  import LoginView from "./views/LoginView.svelte";
  import SetupView from "./views/SetupView.svelte";
  import MainView from "./views/MainView.svelte";
  import SettingsView from "./views/SettingsView.svelte";
  import { currentView } from "./lib/stores.svelte";

  const views: Record<string, any> = {
    login: LoginView,
    setup: SetupView,
    main: MainView,
    settings: SettingsView,
  };
</script>

<div class="app">
  {#if views[currentView.value]}
    <svelte:component this={views[currentView.value]} />
  {/if}
</div>

<style>
  .app {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
</style>
