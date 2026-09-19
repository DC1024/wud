<template>
  <v-container fluid class="pa-4">
    <!-- Header -->
    <v-card class="border mb-4" elevation="0" rounded="lg">
      <div class="pa-4 d-flex align-center flex-wrap ga-4">
        <v-avatar color="primary" variant="tonal" size="46" rounded="lg">
          <v-icon size="26">mdi-playlist-check</v-icon>
        </v-avatar>

        <div class="flex-grow-1" style="min-width: 240px">
          <div class="text-h6 font-weight-bold">{{ $t('watchlist.title') }}</div>
          <div class="text-body-2 text-medium-emphasis">{{ $t('watchlist.subtitle') }}</div>
        </div>

        <div class="d-flex align-center ga-2">
          <v-chip color="success" variant="tonal" size="small" class="font-weight-medium">
            <v-icon start size="small">mdi-eye-check-outline</v-icon>
            {{ $t('watchlist.watchedCount', { n: watchedCount }) }}
          </v-chip>
          <v-chip variant="tonal" size="small" class="font-weight-medium">
            <v-icon start size="small">mdi-eye-off-outline</v-icon>
            {{ $t('watchlist.unwatchedCount', { n: unwatchedCount }) }}
          </v-chip>
          <v-btn
            color="primary"
            variant="tonal"
            size="small"
            prepend-icon="mdi-refresh"
            :loading="loading"
            @click="load()"
          >
            {{ $t('watchlist.refresh') }}
          </v-btn>
        </div>
      </div>

      <v-divider />

      <!-- Filters -->
      <div class="pa-3 d-flex align-center flex-wrap ga-3">
        <v-text-field
          v-model="search"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          prepend-inner-icon="mdi-magnify"
          :placeholder="$t('watchlist.searchPlaceholder')"
          style="max-width: 360px"
        />

        <v-select
          v-model="watcherFilter"
          :items="watcherOptions"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          :label="$t('watchlist.watcher')"
          style="max-width: 200px"
        />

        <v-switch
          v-model="onlyUnwatched"
          color="primary"
          density="compact"
          hide-details
          inset
          :label="$t('watchlist.onlyUnwatched')"
        />

        <v-spacer />

        <span class="text-caption text-medium-emphasis">
          {{ $t('watchlist.count', { n: filteredContainers.length }) }}
        </span>
      </div>
    </v-card>

    <!-- Pending changes -->
    <v-alert v-if="pendingChanges > 0" type="info" variant="tonal" rounded="lg" class="mb-4">
      <div class="d-flex align-center flex-wrap ga-3">
        <v-icon size="22">mdi-progress-clock</v-icon>
        <div class="flex-grow-1">
          <div class="font-weight-medium">{{ $t('watchlist.pending', { n: pendingChanges }) }}</div>
          <div class="text-caption">{{ $t('watchlist.pendingHint') }}</div>
        </div>
        <v-btn
          color="primary"
          variant="flat"
          size="small"
          prepend-icon="mdi-play"
          :loading="applying"
          :disabled="!canWrite"
          @click="applyNow"
        >
          {{ $t('watchlist.applyNow') }}
        </v-btn>
      </div>
    </v-alert>

    <v-alert
      v-if="!canWrite"
      type="info"
      variant="tonal"
      density="compact"
      rounded="lg"
      class="mb-4"
    >
      {{ $t('watchlist.readOnlyHint') }}
    </v-alert>

    <v-alert
      v-if="labelManagedCount > 0"
      type="warning"
      variant="tonal"
      density="compact"
      rounded="lg"
      class="mb-4"
    >
      {{ $t('watchlist.labelInfo') }}
    </v-alert>

    <!-- Orphan preferences: manual choices whose container is gone -->
    <v-alert v-if="orphanCount > 0" type="warning" variant="tonal" rounded="lg" class="mb-4">
      <div class="d-flex align-center flex-wrap ga-3">
        <v-icon size="22">mdi-delete-sweep-outline</v-icon>
        <div class="flex-grow-1">
          <div class="font-weight-medium">
            {{ $t('watchlist.orphanTitle', { n: orphanCount }) }}
          </div>
          <div class="text-caption">{{ $t('watchlist.orphanHint') }}</div>
          <div v-if="orphanSkippedWatchers.length > 0" class="text-caption mt-1">
            {{
              $t('watchlist.orphanSkippedWatchers', {
                list: orphanSkippedWatchers.join(', '),
              })
            }}
          </div>
        </div>
        <v-btn
          color="warning"
          variant="flat"
          size="small"
          prepend-icon="mdi-delete-sweep-outline"
          :loading="orphanLoading || orphanCleaning"
          :disabled="!canWrite"
          @click="cleanOrphans"
        >
          {{ $t('watchlist.orphanClean') }}
        </v-btn>
      </div>
    </v-alert>

    <!-- Batch actions -->
    <v-card v-if="selected.length > 0" class="border mb-4" elevation="0" rounded="lg">
      <div class="pa-3 d-flex align-center flex-wrap ga-3">
        <v-icon size="22" color="primary">mdi-checkbox-multiple-marked-outline</v-icon>
        <span class="font-weight-medium">
          {{ $t('watchlist.batchSelected', { n: selected.length }) }}
        </span>
        <v-chip
          v-if="skippedSelectionCount > 0"
          label
          size="small"
          variant="tonal"
          color="warning"
          class="font-weight-medium"
        >
          {{ $t('watchlist.batchSkipped', { n: skippedSelectionCount }) }}
        </v-chip>

        <v-spacer />

        <v-btn
          color="success"
          variant="tonal"
          size="small"
          prepend-icon="mdi-eye-check-outline"
          :disabled="!canWrite || selectableRows.length === 0"
          :loading="batchLoading"
          @click="applyBatch(true)"
        >
          {{ $t('watchlist.batchWatch') }}
        </v-btn>
        <v-btn
          color="grey"
          variant="tonal"
          size="small"
          prepend-icon="mdi-eye-off-outline"
          :disabled="!canWrite || selectableRows.length === 0"
          :loading="batchLoading"
          @click="applyBatch(false)"
        >
          {{ $t('watchlist.batchUnwatch') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          size="small"
          prepend-icon="mdi-undo-variant"
          :disabled="!canWrite || selectableRows.length === 0"
          :loading="batchLoading"
          @click="applyBatch(null)"
        >
          {{ $t('watchlist.batchReset') }}
        </v-btn>
        <v-btn variant="text" size="small" @click="clearSelection">
          {{ $t('watchlist.batchClear') }}
        </v-btn>
      </div>
    </v-card>

    <!-- Container table -->
    <v-card class="border" elevation="0" rounded="lg">
      <v-data-table
        v-model="selected"
        :headers="headers"
        :items="filteredContainers"
        item-value="key"
        :loading="loading"
        :items-per-page="25"
        :items-per-page-options="[10, 25, 50, -1]"
        show-select
        hover
        class="bg-surface"
      >
        <template #[`item.name`]="{ item }">
          <div class="d-flex align-center">
            <v-icon size="18" color="primary" class="mr-2 opacity-80">mdi-docker</v-icon>
            <div class="d-flex flex-column">
              <span class="font-weight-medium">{{ row(item).name }}</span>
              <span class="text-caption text-disabled font-monospace">{{ shortId(row(item).id) }}</span>
            </div>
          </div>
        </template>

        <template #[`item.image`]="{ item }">
          <span class="text-body-2 font-monospace">{{ row(item).image }}</span>
        </template>

        <template #[`item.stack`]="{ item }">
          <v-chip
            v-if="row(item).stack"
            label
            color="secondary"
            variant="tonal"
            size="small"
            class="font-weight-medium"
          >
            <v-icon start size="small">mdi-layers-outline</v-icon>
            {{ row(item).stack }}
          </v-chip>
          <span v-else class="text-disabled text-caption">-</span>
        </template>

        <template #[`item.watcher`]="{ item }">
          <v-chip label color="primary" variant="tonal" size="small">
            <v-icon start size="small">mdi-update</v-icon>
            {{ row(item).watcher }}
          </v-chip>
        </template>

        <template #[`item.state`]="{ item }">
          <v-chip
            label
            :color="stateColor(row(item).state)"
            variant="tonal"
            size="small"
            class="font-weight-medium"
          >
            <v-icon start size="small">{{ stateIcon(row(item).state) }}</v-icon>
            {{ row(item).state }}
          </v-chip>
        </template>

        <template #[`item.watchedBy`]="{ item }">
          <v-chip
            label
            :color="sourceColor(row(item).watchedBy)"
            variant="tonal"
            size="small"
            class="font-weight-medium"
            :title="sourceHint(row(item).watchedBy)"
          >
            <v-icon start size="small">{{ sourceIcon(row(item).watchedBy) }}</v-icon>
            {{ sourceLabel(row(item).watchedBy) }}
          </v-chip>
        </template>

        <template #[`item.watched`]="{ item }">
          <div class="d-flex align-center justify-center ga-1">
            <v-icon
              v-if="row(item).watchedBy === 'label'"
              size="x-small"
              class="text-medium-emphasis"
              :title="$t('watchlist.sourceLabelHint')"
            >
              mdi-lock-outline
            </v-icon>

            <v-switch
              :model-value="row(item).watched"
              :disabled="!canWrite || row(item).watchedBy === 'label'"
              :color="row(item).watched ? 'success' : 'grey'"
              hide-details
              density="compact"
              inset
              :title="
                row(item).watched ? $t('watchlist.toggleOff') : $t('watchlist.toggleOn')
              "
              @update:model-value="(value) => onToggle(row(item), value)"
            />

            <v-btn
              v-if="canWrite && row(item).watchedBy === 'preference'"
              icon="mdi-undo-variant"
              size="x-small"
              variant="text"
              color="medium-emphasis"
              :title="$t('watchlist.resetHint')"
              @click="onReset(row(item))"
            />
          </div>
        </template>

        <template #no-data>
          <div class="py-8 text-center">
            <v-icon size="42" class="text-disabled mb-2">mdi-tray-remove</v-icon>
            <div class="text-h6">{{ $t('watchlist.empty') }}</div>
            <div class="text-body-2 text-medium-emphasis">
              {{ $t('watchlist.emptyTryFilters') }}
            </div>
          </div>
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import {
  discoverContainers,
  refreshAllContainers,
  setWatchPreference,
  listOrphanWatchPreferences,
  purgeOrphanWatchPreferences,
  type DiscoveredContainer,
} from "@/services/container";
import { getUser } from "@/services/auth";

interface WatchlistRow extends DiscoveredContainer {
  key: string;
}

interface OrphanRow {
  watcher: string;
  name: string;
  watched: boolean;
}

export default defineComponent({
  data() {
    return {
      containers: [] as WatchlistRow[],
      loading: false,
      applying: false,
      pendingChanges: 0,

      search: "",
      watcherFilter: null as string | null,
      onlyUnwatched: false,

      selected: [] as string[],
      batchLoading: false,

      orphans: [] as OrphanRow[],
      orphanSkippedWatchers: [] as string[],
      orphanLoading: false,
      orphanCleaning: false,

      currentUser: null as any,
    };
  },

  async mounted() {
    try {
      this.currentUser = await getUser();
    } catch {
      // ignore, assume read-only below
    }
    await this.load();
    await this.loadOrphans();
  },

  computed: {
    canWrite(): boolean {
      if (!this.currentUser) return false;
      return this.currentUser.role === "admin" || this.currentUser.role === "rw";
    },

    watchedCount(): number {
      return this.containers.filter((c) => c.watched).length;
    },

    unwatchedCount(): number {
      return this.containers.filter((c) => !c.watched).length;
    },

    labelManagedCount(): number {
      return this.containers.filter((c) => c.watchedBy === "label").length;
    },

    orphanCount(): number {
      return (this.orphans as OrphanRow[]).length;
    },

    /**
     * Selected rows the batch actions may touch. Label-managed containers are
     * excluded: their `wud.watch` label always wins, so writing a preference
     * for them would be a silent no-op.
     */
    selectableRows(): WatchlistRow[] {
      const selected = this.selected as string[];
      return this.containers.filter(
        (container) =>
          selected.includes(container.key) && container.watchedBy !== "label",
      );
    },

    skippedSelectionCount(): number {
      return (this.selected as string[]).length - this.selectableRows.length;
    },

    watcherOptions(): string[] {
      const options: string[] = [];
      (this.containers as WatchlistRow[]).forEach((container) => {
        const watcher = String(container.watcher);
        if (options.indexOf(watcher) === -1) {
          options.push(watcher);
        }
      });
      return options.sort();
    },

    filteredContainers(): WatchlistRow[] {
      const search = this.search.trim().toLowerCase();
      return this.containers.filter((container) => {
        if (this.onlyUnwatched && container.watched) {
          return false;
        }
        if (this.watcherFilter && container.watcher !== this.watcherFilter) {
          return false;
        }
        if (!search) {
          return true;
        }
        return [container.name, container.image, container.stack, container.watcher]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(search));
      });
    },

    headers() {
      const t = (this as any).$t;
      return [
        {
          title: t("watchlist.name"),
          key: "name",
          value: (item: any) => item.name || "",
          sortable: true,
        },
        {
          title: t("watchlist.image"),
          key: "image",
          value: (item: any) => item.image || "",
          sortable: true,
        },
        {
          title: t("watchlist.stack"),
          key: "stack",
          value: (item: any) => item.stack || "",
          sortable: true,
        },
        {
          title: t("watchlist.watcher"),
          key: "watcher",
          value: (item: any) => item.watcher || "",
          sortable: true,
        },
        {
          title: t("watchlist.state"),
          key: "state",
          value: (item: any) => item.state || "",
          sortable: true,
        },
        {
          title: t("watchlist.source"),
          key: "watchedBy",
          value: (item: any) => item.watchedBy || "",
          sortable: true,
        },
        {
          title: t("watchlist.watched"),
          key: "watched",
          align: "center" as const,
          sortable: false,
          width: 130,
        },
      ];
    },
  },

  methods: {
    /** Vuetify may hand over the raw row or a wrapper, support both. */
    row(item: any): WatchlistRow {
      return item && item.raw ? item.raw : item;
    },

    shortId(id: string): string {
      return id ? String(id).substring(0, 12) : "";
    },

    stateColor(state: string): string {
      if (state === "running") return "success";
      if (state === "paused") return "warning";
      if (state === "exited" || state === "dead") return "grey";
      return "primary";
    },

    stateIcon(state: string): string {
      if (state === "running") return "mdi-play-circle-outline";
      if (state === "paused") return "mdi-pause-circle-outline";
      if (state === "exited" || state === "dead") return "mdi-stop-circle-outline";
      return "mdi-help-circle-outline";
    },

    sourceColor(source: string): string {
      if (source === "label") return "secondary";
      if (source === "preference") return "primary";
      return "grey";
    },

    sourceIcon(source: string): string {
      if (source === "label") return "mdi-tag-outline";
      if (source === "preference") return "mdi-cursor-default-click-outline";
      return "mdi-cog-outline";
    },

    sourceLabel(source: string): string {
      const t = (this as any).$t;
      if (source === "label") return t("watchlist.sourceLabel");
      if (source === "preference") return t("watchlist.sourcePreference");
      return t("watchlist.sourceDefault");
    },

    sourceHint(source: string): string {
      const t = (this as any).$t;
      if (source === "label") return t("watchlist.sourceLabelHint");
      if (source === "preference") return t("watchlist.sourcePreferenceHint");
      return t("watchlist.sourceDefaultHint");
    },

    async load(silent = false) {
      if (!silent) {
        this.loading = true;
      }
      try {
        const containers = await discoverContainers();
        this.containers = containers.map((container) => ({
          ...container,
          key: `${container.watcher}/${container.name}`,
        }));
        // Drop the selected keys that are not in the list any more, otherwise
        // a batch action could target a row the user can no longer see.
        const keys = this.containers.map((container) => container.key);
        this.selected = (this.selected as string[]).filter((key) =>
          keys.includes(key),
        );
      } catch (e: any) {
        (this as any).$eventBus?.emit(
          "notify",
          (this as any).$t("watchlist.loadError", { msg: e.message }),
          "error",
        );
      } finally {
        if (!silent) {
          this.loading = false;
        }
      }
    },

    async onToggle(container: WatchlistRow, watched: boolean | null) {
      if (!this.canWrite || container.watchedBy === "label") {
        return;
      }
      // Optimistic: the switch must react instantly, the reload below
      // replaces this with the authoritative state.
      container.watched = watched === true;
      try {
        await setWatchPreference({
          watcher: container.watcher,
          name: container.name,
          watched,
        });
        this.pendingChanges += 1;
        (this as any).$eventBus?.emit(
          "notify",
          (this as any).$t(
            container.watched ? "watchlist.toggleOnOk" : "watchlist.toggleOffOk",
            { name: container.name },
          ),
          "success",
        );
        await this.load(true);
      } catch (e: any) {
        (this as any).$eventBus?.emit(
          "notify",
          (this as any).$t("watchlist.toggleError", { msg: e.message }),
          "error",
        );
        await this.load(true);
      }
    },

    async onReset(container: WatchlistRow) {
      if (!this.canWrite) {
        return;
      }
      try {
        await setWatchPreference({
          watcher: container.watcher,
          name: container.name,
          watched: null,
        });
        this.pendingChanges += 1;
        (this as any).$eventBus?.emit(
          "notify",
          (this as any).$t("watchlist.resetOk", { name: container.name }),
          "success",
        );
        await this.load(true);
      } catch (e: any) {
        (this as any).$eventBus?.emit(
          "notify",
          (this as any).$t("watchlist.toggleError", { msg: e.message }),
          "error",
        );
      }
    },

    async applyNow() {
      this.applying = true;
      try {
        await refreshAllContainers();
        this.pendingChanges = 0;
        (this as any).$eventBus?.emit(
          "notify",
          (this as any).$t("watchlist.applied"),
          "success",
        );
        await this.load(true);
        await this.loadOrphans();
      } catch (e: any) {
        (this as any).$eventBus?.emit(
          "notify",
          (this as any).$t("watchlist.applyError", { msg: e.message }),
          "error",
        );
      } finally {
        this.applying = false;
      }
    },

    /**
     * Fetch the preferences pointing to containers that no longer exist.
     * This is a maintenance detail: a failure must never break the page, so
     * the banner simply stays hidden.
     */
    async loadOrphans() {
      this.orphanLoading = true;
      try {
        const report = await listOrphanWatchPreferences();
        this.orphans = report.orphans;
        this.orphanSkippedWatchers = report.failedWatchers;
      } catch {
        this.orphans = [];
        this.orphanSkippedWatchers = [];
      } finally {
        this.orphanLoading = false;
      }
    },

    async cleanOrphans() {
      if (!this.canWrite) {
        return;
      }
      this.orphanCleaning = true;
      try {
        const result = await purgeOrphanWatchPreferences();
        (this as any).$eventBus?.emit(
          "notify",
          (this as any).$t("watchlist.orphanCleaned", { n: result.count }),
          "success",
        );
        await this.loadOrphans();
      } catch (e: any) {
        (this as any).$eventBus?.emit(
          "notify",
          (this as any).$t("watchlist.orphanCleanError", { msg: e.message }),
          "error",
        );
      } finally {
        this.orphanCleaning = false;
      }
    },

    clearSelection() {
      this.selected = [];
    },

    async applyBatch(watched: boolean | null) {
      if (!this.canWrite) {
        return;
      }
      const targets = this.selectableRows;
      if (targets.length === 0) {
        return;
      }

      this.batchLoading = true;
      const failures: string[] = [];
      let done = 0;
      // Sequential on purpose: keeps the per-container error reporting exact
      // and avoids firing a burst of parallel writes at the API.
      for (const container of targets) {
        try {
          await setWatchPreference({
            watcher: container.watcher,
            name: container.name,
            watched,
          });
          done += 1;
        } catch (e) {
          failures.push(container.name);
        }
      }
      this.batchLoading = false;

      if (done > 0) {
        this.pendingChanges += done;
      }

      if (failures.length === 0) {
        this.clearSelection();
        (this as any).$eventBus?.emit(
          "notify",
          (this as any).$t("watchlist.batchOk", { n: done }),
          "success",
        );
      } else {
        (this as any).$eventBus?.emit(
          "notify",
          (this as any).$t("watchlist.batchPartial", {
            n: done,
            failed: failures.join(", "),
          }),
          "warning",
        );
      }

      await this.load(true);
    },
  },
});
</script>

<style scoped>
.font-monospace {
  font-family: "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace;
}

:deep(.v-data-table tbody tr) {
  transition: background-color 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

:deep(.v-data-table tbody tr:hover) {
  background-color: rgba(var(--v-theme-primary), 0.04);
}
</style>
