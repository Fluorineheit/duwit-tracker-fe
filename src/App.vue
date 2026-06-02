<script setup lang="ts">
const navigationItems = [
  { label: 'Dashboard', routeName: 'dashboard', to: '/dashboard', icon: 'pi pi-home' },
  { label: 'Expenses', routeName: 'expenses', to: '/expenses', icon: 'pi pi-wallet' },
  { label: 'Categories', routeName: 'categories', to: '/categories', icon: 'pi pi-tags' },
  { label: 'Budgets', routeName: 'budgets', to: '/budgets', icon: 'pi pi-chart-pie' },
  { label: 'Reports', routeName: 'reports', to: '/reports', icon: 'pi pi-chart-line' },
] as const
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" aria-label="Primary navigation">
      <RouterLink to="/dashboard" class="brand">
        <span class="brand-mark">D</span>
        <span>DuwitTracker</span>
      </RouterLink>

      <nav class="nav-list">
        <RouterLink
          v-for="item in navigationItems"
          :key="item.routeName"
          :to="item.to"
          class="nav-link"
        >
          <i :class="item.icon" aria-hidden="true"></i>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped></style>
