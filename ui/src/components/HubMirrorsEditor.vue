<template>
  <v-dialog v-model="visible" max-width="720" persistent>
    <v-card rounded="lg" elevation="0" class="border">
      <v-toolbar color="surface" flat class="border-b px-2">
        <v-icon icon="mdi-docker" class="mr-2 text-primary" size="24"></v-icon>
        <div>
          <div class="text-subtitle-1 font-weight-bold">{{ $t("hubMirrors.title") }}</div>
          <div class="text-caption text-grey">{{ $t("hubMirrors.subtitle") }}</div>
        </div>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" size="small" @click="close"></v-btn>
      </v-toolbar>

      <v-divider />

      <div class="pa-4">
        <!-- Loading -->
        <div v-if="loading" class="d-flex justify-center py-10">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
        </div>

        <template v-else>
          <!-- Edit list -->
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="text-subtitle-2 font-weight-bold text-medium-emphasis">
              {{ $t("hubMirrors.uiList") }}
            </span>
            <v-chip size="x-small" variant="outlined" color="grey">{{ mirrors.length }}</v-chip>
          </div>

          <!-- Add input -->
          <div class="d-flex align-center gap-2 mb-3">
            <v-text-field
              v-model="newUrl"
              :placeholder="$t('hubMirrors.addPlaceholder')"
              density="compact"
              variant="outlined"
              hide-details
              class="flex-grow-1"
              @keydown.enter="addMirror"
            ></v-text-field>
            <v-btn
              color="primary"
              variant="tonal"
              :disabled="!newUrl.trim()"
              @click="addMirror"
            >
              <v-icon icon="mdi-plus" size="small" class="mr-1"></v-icon>
              {{ $t("hubMirrors.add") }}
            </v-btn>
          </div>

          <!-- Mirror rows -->
          <div v-if="mirrors.length === 0" class="pa-4 text-center text-grey">
            <v-icon size="32" class="mb-2 opacity-50">mdi-docker</v-icon>
            <div class="text-body-2">{{ $t("hubMirrors.empty") }}</div>
            <div class="text-caption text-grey">{{ $t("hubMirrors.effectiveFromEnv") }}</div>
          </div>

          <v-list v-else density="compact" class="border rounded-lg py-0">
            <v-list-item
              v-for="(mirror, index) in mirrors"
              :key="index"
              class="py-2 px-3"
            >
              <div class="d-flex align-center">
                <span class="text-body-2 font-weight-medium flex-grow-1 word-break-all mr-2">
                  {{ mirror }}
                </span>

                <!-- Per-mirror test result -->
                <span
                  v-if="testResults[index]"
                  class="d-flex align-center mr-2"
                  :title="testResults[index].error || ''"
                >
                  <v-icon
                    :icon="testResults[index].ok ? 'mdi-check-circle' : 'mdi-alert-circle'"
                    :color="testResults[index].ok ? 'success' : 'error'"
                    size="20"
                    class="mr-1"
                  ></v-icon>
                  <span class="text-caption" :class="testResults[index].ok ? 'text-success' : 'text-error'">
                    {{ statusLabel(testResults[index]) }}
                  </span>
                </span>

                <!-- Actions -->
                <v-btn
                  icon="mdi-sync"
                  variant="text"
                  size="x-small"
                  density="compact"
                  :loading="testingIndex === index"
                  :disabled="testingIndex !== null"
                  :title="$t('hubMirrors.test')"
                  @click="testOne(index)"
                ></v-btn>
                <v-btn
                  icon="mdi-arrow-up"
                  variant="text"
                  size="x-small"
                  density="compact"
                  :disabled="index === 0"
                  :title="$t('hubMirrors.moveUp')"
                  @click="moveMirror(index, -1)"
                ></v-btn>
                <v-btn
                  icon="mdi-arrow-down"
                  variant="text"
                  size="x-small"
                  density="compact"
                  :disabled="index === mirrors.length - 1"
                  :title="$t('hubMirrors.moveDown')"
                  @click="moveMirror(index, 1)"
                ></v-btn>
                <v-btn
                  icon="mdi-delete-outline"
                  variant="text"
                  size="x-small"
                  density="compact"
                  color="error"
                  :title="$t('hubMirrors.remove')"
                  @click="removeMirror(index)"
                ></v-btn>
              </div>
            </v-list-item>
          </v-list>

          <!-- Effective mirrors hint -->
          <div
            v-if="effective.length > 0"
            class="d-flex align-start mt-3 pa-3 rounded-lg bg-surface border"
          >
            <v-icon icon="mdi-information-outline" size="20" class="mr-2 text-primary flex-shrink-0"></v-icon>
            <div>
              <div class="text-caption font-weight-bold text-medium-emphasis mb-1">
                {{ $t("hubMirrors.effectiveHint") }}
              </div>
              <div
                v-for="(eff, idx) in effective"
                :key="idx"
                class="text-caption text-grey"
              >
                {{ idx + 1 }}. {{ eff }}
              </div>
            </div>
          </div>
        </template>
      </div>

      <v-divider />
      <v-card-actions class="pa-3">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="close">{{ $t("hubMirrors.cancel") }}</v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="loading"
          @click="save"
        >
          {{ $t("hubMirrors.save") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import {
  getHubMirrors,
  setHubMirrors,
  testHubMirror,
} from "@/services/registry";

export default defineComponent({
  name: "HubMirrorsEditor",
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    readOnly: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      loading: false,
      saving: false,
      mirrors: [] as string[],
      effective: [] as string[],
      newUrl: "",
      testResults: {} as Record<number, any>,
      testingIndex: null as number | null,
    };
  },
  computed: {
    visible: {
      get(): boolean {
        return this.modelValue;
      },
      set(v: boolean) {
        this.$emit("update:modelValue", v);
      },
    },
  },
  watch: {
    visible(v: boolean) {
      if (v) {
        this.load();
      }
    },
  },
  methods: {
    async load() {
      this.loading = true;
      this.testResults = {};
      try {
        const data = await getHubMirrors();
        this.mirrors = Array.isArray(data.ui) ? [...data.ui] : [];
        this.effective = Array.isArray(data.effective) ? [...data.effective] : [];
      } catch (e: any) {
        (this as any).$eventBus?.emit(
          "notify",
          this.$t("hubMirrors.loadError", { msg: e.message }),
          "error"
        );
      } finally {
        this.loading = false;
      }
    },
    addMirror() {
      const url = this.newUrl.trim();
      if (!url) {
        return;
      }
      if (!this.mirrors.includes(url)) {
        this.mirrors.push(url);
      }
      this.newUrl = "";
    },
    removeMirror(index: number) {
      this.mirrors.splice(index, 1);
      delete this.testResults[index];
    },
    moveMirror(index: number, delta: number) {
      const target = index + delta;
      if (target < 0 || target >= this.mirrors.length) {
        return;
      }
      const arr = [...this.mirrors];
      const tmp = arr[index];
      arr[index] = arr[target];
      arr[target] = tmp;
      this.mirrors = arr;
      // re-key results
      const results: Record<number, any> = {};
      arr.forEach((_, i) => {
        if (this.testResults[i]) results[i] = this.testResults[i];
      });
      this.testResults = results;
    },
    async testOne(index: number) {
      if (this.readOnly) {
        return;
      }
      this.testingIndex = index;
      try {
        const res = await testHubMirror(this.mirrors[index]);
        this.testResults = { ...this.testResults, [index]: res };
      } catch (e: any) {
        this.testResults = {
          ...this.testResults,
          [index]: { ok: false, error: e.message },
        };
      } finally {
        this.testingIndex = null;
      }
    },
    statusLabel(res: any): string {
      if (res.ok) {
        return this.$t(`hubMirrors.status${this.capitalize(res.kind || "anonymous")}`);
      }
      return this.$t("hubMirrors.statusUnreachable");
    },
    capitalize(s: string): string {
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Anonymous";
    },
    async save() {
      if (this.readOnly) {
        return;
      }
      this.saving = true;
      try {
        const res = await setHubMirrors(this.mirrors);
        this.effective = Array.isArray(res.effective) ? [...res.effective] : [];
        (this as any).$eventBus?.emit("notify", this.$t("hubMirrors.saved"), "success");
        this.visible = false;
      } catch (e: any) {
        (this as any).$eventBus?.emit(
          "notify",
          this.$t("hubMirrors.saveError", { msg: e.message }),
          "error"
        );
      } finally {
        this.saving = false;
      }
    },
    close() {
      this.visible = false;
    },
  },
});
</script>

<style scoped>
.word-break-all {
  word-break: break-word;
}
</style>