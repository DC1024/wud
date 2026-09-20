<template>
  <v-app-bar app flat density="compact" color="surface" class="border-b">
    <div class="d-flex align-center px-4 w-100">
      <v-toolbar-title
        v-if="viewTitle && 'home'.toLowerCase() !== viewName.toLowerCase()"
        class="text-subtitle-1 font-weight-bold text-capitalize ma-0 text-high-emphasis"
      >
        {{ viewTitle }}
      </v-toolbar-title>
      <v-spacer />
      <ConnectionStatusPill class="mr-4" />

      <!-- Language switcher: 中 / EN -->
      <v-btn-toggle
        v-model="lang"
        mandatory
        density="comfortable"
        variant="outlined"
        divided
        size="small"
        color="primary"
        class="ml-2"
      >
        <v-btn value="zh-CN" @click="switchLang('zh-CN')">中</v-btn>
        <v-btn value="en" @click="switchLang('en')">EN</v-btn>
      </v-btn-toggle>
    </div>
  </v-app-bar>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import ConnectionStatusPill from "./ConnectionStatusPill.vue";

export default defineComponent({
  components: {
    ConnectionStatusPill
  },
  props: {
    user: {
      type: Object,
      default: undefined,
    },
  },
  setup() {
    const route = useRoute();
    const { t, locale } = useI18n();

    const viewName = computed(() => {
      return route ? (route.name as string) : "";
    });

    const viewTitle = computed(() => {
      const n = route.name as string;
      if (!n) return "";
      const key = "route." + n;
      const tr = t(key);
      // 未翻译时退回首字母大写原名，避免显示原始 key
      return tr === key ? n.charAt(0).toUpperCase() + n.slice(1) : tr;
    });

    const lang = computed({
      get: () => locale.value,
      set: (v: string) => {
        locale.value = v;
      },
    });

    const switchLang = (value: string) => {
      locale.value = value;
      localStorage.setItem("wud-lang", value);
    };

    return {
      viewName,
      viewTitle,
      lang,
      switchLang,
    };
  },
});
</script>
