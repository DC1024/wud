<template>
  <v-card variant="outlined">
    <v-list-item>
      <template v-slot:prepend>
        <v-icon>mdi-bell-ring</v-icon>
      </template>
      <v-list-item-title class="text-capitalize">
        <router-link to="/configuration/triggers">
          {{ trigger.type }} {{ trigger.name }}
        </router-link>
      </v-list-item-title>
      <v-list-item-subtitle>
        {{ $t('triggers.threshold', { threshold: trigger.configuration.threshold }) }}
      </v-list-item-subtitle>
      <template v-slot:append>
        <v-btn
          v-if="canWrite"
          variant="outlined"
          color="accent"
          :disabled="!updateAvailable"
          @click="runTrigger"
          :loading="isTriggering"
        >
          {{ $t('triggers.run') }}
          <v-icon end>mdi-gesture-tap</v-icon>
        </v-btn>
      </template>
    </v-list-item>
  </v-card>
</template>

<script lang="ts">
import { runTrigger } from "@/services/container";
import { getUser } from "@/services/auth";
import { defineComponent } from "vue";

export default defineComponent({
  props: {
    trigger: {
      type: Object,
      required: true,
    },
    updateAvailable: {
      type: Boolean,
      required: true,
    },
    containerId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      isTriggering: false,
      currentUser: null as any,
    };
  },
  computed: {
    canWrite(): boolean {
      if (!this.currentUser) return true;
      return this.currentUser.role === "admin" || this.currentUser.role === "rw";
    },
  },
  async mounted() {
    try {
      this.currentUser = await getUser();
    } catch {
      // ignore
    }
  },

  methods: {
    async runTrigger() {
      this.isTriggering = true;
      try {
        await runTrigger({
          containerId: this.containerId,
          triggerType: this.trigger.type,
          triggerName: this.trigger.name,
        });
        (this as any).$eventBus.emit("notify", this.$t("triggers.success"));
      } catch (err: any) {
        (this as any).$eventBus.emit(
          "notify",
          this.$t("triggers.error", { msg: err.message }),
          "error",
        );
      } finally {
        this.isTriggering = false;
      }
      this.isTriggering = false;
    },
  },
});
</script>
